import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const catalog=read('sources/street-variants/catalog.json');
const textures={},dedup=new Map();
function texture(record,channel){const p='themes/cyberpunk/'+record.maps[channel],sha=hash(p),space=channel==='basecolor'?'srgb':'linear',identity=sha+space;
 if(dedup.has(identity))return dedup.get(identity);
 const id=(record.texturePrefix??'slab')+'-'+(record.id??record.condition)+'-'+channel;textures[id]={path:p,sha256:sha,resolution:record.resolution,colorSpace:space,wrap:['repeat','repeat']};
 const compressed=p.replace(/\.png$/,'.ktx2');if(fs.existsSync(path.join(root,compressed))){textures[id].ktx2=compressed;textures[id].ktx2Sha256=hash(compressed)}
 dedup.set(identity,id);return id;
}
const weights={clean:.55,stained:.28,cracked:.1,patched:.07};
const variants=catalog.map(r=>({id:r.id??r.condition,condition:r.condition,weight:weights[r.condition]/catalog.filter(x=>x.condition===r.condition).length,material:{key:r.key,variant:r.variant},maps:Object.fromEntries(['basecolor','normal','roughness','ao'].map(c=>[c,texture(r,c)]))}));
const binding={version:1,baseBinding:{path:'bindings/street-native.json',sha256:hash('bindings/street-native.json')},textures,sets:{'concrete-slabs':{worldSize:[2,2],structuralFrame:'precast-2m-joints-v1',selection:{unit:'panel',salt:'precast-variants-v1',fallback:'clean',uvTransform:'identity'},variants}},surfaces:Object.fromEntries(['ordinary','worn-a','worn-b','worn-c','damaged','paper','district-panel-blue','district-panel-dark'].map(id=>[id,'concrete-slabs']))};
const redFile=path.join(root,'sources/street-variants/red/catalog.json');
if(fs.existsSync(redFile)){
 const red=read('sources/street-variants/red/catalog.json').map(r=>({...r,texturePrefix:'red-coat'}));
 const redWeights={clean:.50,stained:.20,cracked:.08,patched:.06,weathered:.16};
 binding.sets['red-coated-slabs']={worldSize:[2,2],structuralFrame:'coated-precast-2m-v1',selection:{unit:'panel',salt:'red-coated-variants-v1',fallback:'clean',uvTransform:'identity'},variants:red.map(r=>({id:r.id,condition:r.condition,weight:redWeights[r.condition]/red.filter(x=>x.condition===r.condition).length,material:{key:r.key,variant:r.variant},maps:Object.fromEntries(['basecolor','normal','roughness','ao'].map(c=>[c,texture(r,c)]))}))};
 for(const id of ['district-panel-red','oxblood'])binding.surfaces[id]='red-coated-slabs';
}
const asphaltFile=path.join(root,'sources/street-variants/asphalt/catalog.json');
if(fs.existsSync(asphaltFile)){
 const asphalt=read('sources/street-variants/asphalt/catalog.json').map(r=>({...r,texturePrefix:'asphalt-condition'}));
 const asphaltWeights={clean:.80,stained:.15,cracked:.03,patched:.02};
 // Intentionally no surfaces mapping: native asphalt/parking require coordinated
 // clean+main slot adaptation, not the simple photographed-surface override.
 binding.sets['asphalt-conditions']={worldSize:[2,2],structuralFrame:'continuous-asphalt-2m-v1',selection:{unit:'world-cell',salt:'asphalt-conditions-v1',fallback:'clean',uvTransform:'identity'},variants:asphalt.map(r=>({id:r.id,condition:r.condition,weight:asphaltWeights[r.condition]/asphalt.filter(x=>x.condition===r.condition).length,material:{key:r.key,variant:r.variant},maps:Object.fromEntries(['basecolor','normal','roughness','ao'].map(c=>[c,texture(r,c)]))}))};
}
const tileCatalogFile=path.join(root,'sources/street-tile-families/catalog.json');
if(fs.existsSync(tileCatalogFile)){
 const tileCatalog=read('sources/street-tile-families/catalog.json');
 for(const family of ['grey','orange','terracotta']){
  const records=tileCatalog.filter(r=>r.family===family).map(r=>({...r,texturePrefix:'tile-'+family}));
  const setName=family==='terracotta'?'terracotta-court':'hex-'+family;
  binding.sets[setName]={worldSize:records[0].worldSize,structuralFrame:family==='terracotta'?'clay-running-bond-200x150mm-v1':'hex-ring-100mm-radius-v1',selection:{unit:'world-cell',salt:'street-'+setName+'-v1',fallback:'clean-a',uvTransform:'identity'},variants:records.map(r=>({id:r.id,condition:r.condition,weight:weights[r.condition]/records.filter(x=>x.condition===r.condition).length,material:{key:r.key,variant:r.variant},maps:Object.fromEntries(['basecolor','normal','roughness','ao'].map(c=>[c,texture(r,c)]))}))};
 }
 for(const id of ['district-hex','district-junction-blue','basalt'])binding.surfaces[id]='hex-grey';
 for(const id of ['hex-orange','district-junction-yellow'])binding.surfaces[id]='hex-orange';
 binding.surfaces.terracotta='terracotta-court';
 // The paired native binding calibrates these horizontal paving roles to world metres.
}
fs.writeFileSync(path.join(root,'bindings/street-variants.json'),JSON.stringify(binding,null,2)+'\n');
const native=read('schema/street-native.schema.json');
const named={type:'string',pattern:'^[a-zA-Z0-9_-]+$'};
const pair={type:'array',items:{type:'number',exclusiveMinimum:0},minItems:2,maxItems:2};
const textureDef=structuredClone(native.properties.textures.additionalProperties);textureDef.dependentRequired={ktx2:['ktx2Sha256'],ktx2Sha256:['ktx2']};
const schema={$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:urbe:street-variants',title:'Street surface variants companion binding',type:'object',additionalProperties:false,required:['version','baseBinding','textures','sets','surfaces'],properties:{version:{const:1},baseBinding:{type:'object',additionalProperties:false,required:['path','sha256'],properties:{path:{const:'bindings/street-native.json'},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}},textures:{type:'object',minProperties:1,propertyNames:named,additionalProperties:{$ref:'#/$defs/texture'}},sets:{type:'object',minProperties:1,propertyNames:named,additionalProperties:{$ref:'#/$defs/set'}},surfaces:{type:'object',minProperties:1,propertyNames:named,additionalProperties:named}},$defs:{texture:textureDef,set:{type:'object',additionalProperties:false,required:['worldSize','structuralFrame','selection','variants'],properties:{worldSize:pair,structuralFrame:named,selection:{type:'object',additionalProperties:false,required:['unit','salt','fallback','uvTransform'],properties:{unit:{enum:['panel','placement','world-cell']},salt:named,fallback:named,uvTransform:{const:'identity'}}},variants:{type:'array',minItems:4,maxItems:16,items:{type:'object',additionalProperties:false,required:['id','condition','weight','material','maps'],properties:{id:named,condition:{enum:['clean','stained','cracked','patched','scuffed','weathered']},weight:{type:'number',exclusiveMinimum:0,maximum:1},material:{type:'object',additionalProperties:false,required:['key','variant'],properties:{key:{type:'string',pattern:'^[a-z0-9_-]+/[a-z0-9_-]+/[a-z0-9_-]+$'},variant:named}},maps:{type:'object',additionalProperties:false,required:['basecolor','normal','roughness','ao'],properties:Object.fromEntries(['basecolor','normal','roughness','ao'].map(c=>[c,named]))}}}}}}}};
fs.writeFileSync(path.join(root,'schema/street-variants.schema.json'),JSON.stringify(schema,null,2)+'\n');
console.log(`${Object.values(binding.sets).reduce((n,s)=>n+s.variants.length,0)} variants, ${Object.keys(textures).length} unique texture resources, ${Object.keys(binding.surfaces).length} surface IDs`);
