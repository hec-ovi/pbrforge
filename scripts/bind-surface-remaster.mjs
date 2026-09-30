import fs from 'node:fs';import sharp from 'sharp';import {createHash} from 'node:crypto';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const entries=JSON.parse(fs.readFileSync('themes/cyberpunk/theme.json')).entries;
const b=JSON.parse(fs.readFileSync('bindings/street-native.json'));
const get=(kind,id,tier='mid')=>{const key=`cyberpunk/${kind}/${tier}`,e=entries[key];if(!e)throw Error(key);const v=e.variants.find(v=>v.id===id);if(!v)throw Error(`${key}#${id}`);return {e,v};};
const tex=async(id,p,colorSpace='linear',wrap='repeat')=>{const m=await sharp(p).metadata();b.textures[id]={path:p,resolution:[m.width,m.height],sha256:hash(p),colorSpace,wrap:[wrap,wrap]};return id;};
async function bind(surface,kind,variant,{tier='mid',mode='panel',scale,tint='#ffffff',metal=0}={}){const {e,v}=get(kind,variant,tier);const maps={};for(const ch of ['basecolor','normal','roughness','ao'])maps[ch]=await tex(`${surface}-${ch}`,`themes/cyberpunk/${v.maps[ch]}`,ch==='basecolor'?'srgb':'linear');b.surfaces[surface]={effect:'photographed',maps,uv:mode==='panel'?{mode}:{mode,scale:scale??(v.tiling??e.tiling).worldSize},parameters:{tint,normalScale:.5,aoIntensity:.45,metalness:metal,roughnessGain:1,roughnessBias:0,roughnessRange:[.12,.96]}};}
for(const id of ['ordinary','worn-a','worn-b','worn-c','paper','damaged','district-panel-dark','district-panel-blue'])await bind(id,'street-sidewalk',id==='ordinary'?'slab':'walked');
for(const id of ['oxide','oxblood','district-panel-red'])await bind(id,'street-coated','red');
await bind('basalt','street-hex','grey');await bind('terracotta','street-hex','orange');
await bind('district-hex','street-hex','grey',{mode:'world-xz'});
await bind('hex-orange','street-hex','orange',{mode:'world-xz'});
for(const [id,variant]of [['curb','red'],['district-curb-red','red'],['district-curb-blue','blue'],['district-curb-yellow','yellow'],['district-gutter-red','red'],['district-gutter-blue','blue'],['district-gutter-yellow','yellow']])await bind(id,'street-curb',variant,{mode:'curb-band'});
for(const [id,v]of [['district-junction-blue','grey'],['district-junction-yellow','orange']])await bind(id,'street-hex',v,{mode:'world-xz'});
await bind('drainGrate','street-drain','grate',{mode:'metres',metal:1});await bind('drainCover','street-drain','slotted',{mode:'metres',metal:1});
await bind('asphalt-clean','street-asphalt','clean',{mode:'world-xz'});await bind('asphalt-patched','street-asphalt','patched',{mode:'world-xz'});
await bind('crosswalk-worn','street-paint','white',{mode:'metres'});await bind('lane-worn','street-paint','yellow',{mode:'metres'});
const worn=get('street-asphalt','worn').v,clean=get('street-asphalt','clean').v;
for(const ch of ['basecolor','normal','roughness','ao'])await tex(`asphalt-${ch}`,`themes/cyberpunk/${worn.maps[ch]}`,ch==='basecolor'?'srgb':'linear');
for(const ch of ['basecolor','normal'])await tex(`asphalt-clean-${ch}`,`themes/cyberpunk/${clean.maps[ch]}`,ch==='basecolor'?'srgb':'linear');
b.surfaces.asphalt.parameters={...b.surfaces.asphalt.parameters,colorGain:.92,normalScale:.35,roughnessRange:[.32,.94]};b.surfaces.parking.parameters.asphaltColorGain=.92;
// The existing shader thresholds this coverage; the generated fingerprint source makes ragged wear.
const fine=get('surface-detail','field','fine-fingerprint').v;await tex('paint-mask',`themes/cyberpunk/${fine.maps.roughness}`);
for(const id of ['whitePaint','yellowPaint']){b.surfaces[id].parameters.wearStrength=.88;b.surfaces[id].parameters.erosionRange=[.08,.30];}
// A previously bound facade-derived cap changes when that facade is remastered too.
for(const [id,t]of Object.entries(b.textures)){t.sha256=hash(t.path);const m=await sharp(t.path).metadata();t.resolution=[m.width,m.height];delete t.ktx2;delete t.ktx2Sha256;}
const used=new Set(Object.values(b.surfaces).flatMap(s=>Object.values(s.maps)));b.textures=Object.fromEntries(Object.entries(b.textures).filter(([id])=>used.has(id)));
fs.writeFileSync('bindings/street-native.json',JSON.stringify(b,null,2)+'\n');
const manifest=JSON.parse(fs.readFileSync('sources/streets/district/manifest.json'));const byPath=new Map(manifest.files.map(x=>[x.target,x]));for(const t of Object.values(b.textures))byPath.set(t.path,{target:t.path,sha256:t.sha256});manifest.files=[...byPath.values()];manifest.remaster='sources/surface-remaster/INDEX.md';fs.writeFileSync('sources/streets/district/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const detail={version:1,textures:{},masks:{},atlas:{key:'cyberpunk/surface-detail/decal-atlas',variant:'engine-grid',columns:4,rows:4,origin:'top-left',gutterPixels:24,cells:[]}};
for(const [name,role,world]of [['broad-smudge','smudge',2],['fine-fingerprint','fingerprint',.25],['edge-scuff','edge',1],['edge-chips','edgeChips',1],['dirt-dust','macro',2],['dirt-streaks','dirtStreaks',2]]){const {v}=get('surface-detail','field',name);const p=`themes/cyberpunk/${v.maps.roughness}`;detail.textures[name]={path:p,sha256:hash(p),resolution:v.resolution,colorSpace:'linear',wrap:['repeat','repeat']};detail.masks[role]={key:`cyberpunk/surface-detail/${name}`,variant:'field',map:'roughness',texture:name,worldSize:[world,world],channel:'r',meaning:'0 absent, 1 strongest residue or wear'};}
const av=get('surface-detail','engine-grid','decal-atlas').v;for(const ch of ['basecolor','roughness','opacity']){const p=`themes/cyberpunk/${av.maps[ch]}`;detail.textures[`atlas-${ch}`]={path:p,sha256:hash(p),resolution:av.resolution,colorSpace:ch==='basecolor'?'srgb':'linear',wrap:['clamp','clamp']};}
for(let row=0;row<4;row++)for(let col=0;col<4;col++)detail.atlas.cells.push({column:col,row,kind:row===0?(col===3?'tyre':'oil'):row===1?'crack':row===2?'water':col<2?'gum':'paint-chip',uvRect:[col/4,row/4,(col+1)/4,(row+1)/4]});
fs.writeFileSync('bindings/surface-detail.json',JSON.stringify(detail,null,2)+'\n');
const records=fs.readdirSync('sources/surface-remaster/catalog').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(fs.readFileSync(`sources/surface-remaster/catalog/${f}`)));
fs.writeFileSync('sources/surface-remaster/keys.json',JSON.stringify([...new Set(records.map(r=>r.key))].sort(),null,2)+'\n');
console.log(`bound ${Object.keys(b.surfaces).length} street surfaces and ${Object.keys(detail.masks).length} shared masks`);
