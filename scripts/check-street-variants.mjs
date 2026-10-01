import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {Ajv2020} from 'ajv/dist/2020.js';import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p))),hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const b=read('bindings/street-variants.json'),base=read(b.baseBinding.path),theme=read('themes/cyberpunk/theme.json');
const validate=new Ajv2020({strict:true}).compile(read('schema/street-variants.schema.json'));assert(validate(b),JSON.stringify(validate.errors));assert.equal(hash(b.baseBinding.path),b.baseBinding.sha256);
for(const[id,set]of Object.entries(b.surfaces)){assert(base.surfaces[id],id);assert(b.sets[set],set);if(b.sets[set].selection.unit==='world-cell'){assert.equal(base.surfaces[id].uv.mode,'world-xz',id+': world-cell family needs confirmed metric sampling');assert.deepEqual(base.surfaces[id].uv.scale,b.sets[set].worldSize,id+': native and catalog world scales differ');}}
const used=new Set();
for(const[name,set]of Object.entries(b.sets)){
 assert.equal(new Set(set.variants.map(v=>v.id)).size,set.variants.length);assert(set.variants.some(v=>v.id===set.selection.fallback));assert(Math.abs(set.variants.reduce((s,v)=>s+v.weight,0)-1)<1e-9);
 const colourHashes=new Set(),roughHashes=new Set();
 for(const v of set.variants){const entry=theme.entries[v.material.key],variant=entry?.variants.find(x=>x.id===v.material.variant);assert(variant,v.material.variant);assert.deepEqual(variant.tiling?.worldSize??entry.tiling.worldSize,set.worldSize);
  for(const[ch,id]of Object.entries(v.maps)){used.add(id);const t=b.textures[id];assert(t,id);assert.equal(hash('themes/cyberpunk/'+variant.maps[ch]),t.sha256);assert.equal(hash(t.path),t.sha256);const m=await sharp(path.join(root,t.path)).metadata();assert.deepEqual([m.width,m.height],t.resolution);assert.equal(t.colorSpace,ch==='basecolor'?'srgb':'linear');if(t.ktx2)assert.equal(hash(t.ktx2),t.ktx2Sha256);}
  colourHashes.add(b.textures[v.maps.basecolor].sha256);roughHashes.add(b.textures[v.maps.roughness].sha256);
 }
 assert.equal(colourHashes.size,set.variants.length,`${name}: duplicated albedo masquerades as variety`);assert.equal(roughHashes.size,set.variants.length,`${name}: duplicated roughness masquerades as variety`);
}
assert.deepEqual([...used].sort(),Object.keys(b.textures).sort());console.log(JSON.stringify({ok:true,sets:Object.keys(b.sets).length,surfaces:Object.keys(b.surfaces).length,textures:used.size,distinctAlbedoAndRoughness:true}));
