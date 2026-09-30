// Preserve alias callers and exact companions when a canonical tier gains its own finish.
import fs from 'node:fs';import sharp from 'sharp';import {createHash}from'node:crypto';import {Database}from'../dist/db/Database.js';
const db=new Database('themes'),file='themes/cyberpunk/theme.json';const index=JSON.parse(fs.readFileSync(file));
for(const entry of Object.values(index.entries))if(entry.aliases?.some(a=>index.entries[a])){
 for(const alias of entry.aliases.filter(a=>index.entries[a])){const target=index.entries[alias];for(const v of entry.variants)if(!target.variants.some(t=>t.id===v.id))target.variants.push({...v,tiling:v.tiling??entry.tiling});db.write(target,true);}
 entry.aliases=entry.aliases.filter(a=>!index.entries[a]);db.write(entry,true);
}
const acceptance=JSON.parse(fs.readFileSync('sources/exterior-native/accepted.json'));const sha=v=>createHash('sha256').update(v).digest('hex');
for(const finish of acceptance.finishes){const entry=db.resolve(finish.key),exact=db.resolve(finish.exactKey);if(entry.variants.some(v=>v.class==='prepared')){
 db.write({...exact,physical:entry.physical,finish:entry.finish,variants:entry.variants},true);finish.remaster='sources/surface-remaster/INDEX.md';
 }finish.entrySha256=sha(JSON.stringify({...entry,variants:entry.variants.map(({ktx2,...v})=>v)}));}
for(const [p,map]of Object.entries(acceptance.maps)){const bytes=fs.readFileSync('themes/cyberpunk/'+p),m=await sharp(bytes).metadata();map.sha256=sha(bytes);map.resolution=[m.width,m.height];map.channels=m.channels;}
fs.writeFileSync('sources/exterior-native/accepted.json',JSON.stringify(acceptance,null,2)+'\n');
const monolith=db.resolve('cyberpunk/concrete-monolith/mid'),roof=db.resolve('cyberpunk/concrete-monolith-graphite/mid');db.write({...roof,physical:monolith.physical,variants:[monolith.variants.find(v=>v.id==='graphite')]},true);
console.log('synchronized aliases, exact exterior companions and accepted checksums');
