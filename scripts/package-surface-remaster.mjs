import fs from'node:fs';import path from'node:path';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
const version=JSON.parse(fs.readFileSync('package.json')).version;
const keys=new Set(JSON.parse(fs.readFileSync('sources/surface-remaster/keys.json')));
const catalog=JSON.parse(fs.readFileSync('themes/cyberpunk/theme.json'));
const files=new Set(['bindings/street-native.json','bindings/surface-detail.json','themes/cyberpunk/theme.json','sources/surface-remaster/INDEX.md','sources/surface-remaster/keys.json']);
for(const e of Object.values(catalog.entries))if(keys.has(e.key))for(const v of e.variants)for(const p of [...Object.values(v.maps),...Object.values(v.ktx2??{})])files.add('themes/cyberpunk/'+p);
for(const name of ['street-native','surface-detail'])for(const t of Object.values(JSON.parse(fs.readFileSync(`bindings/${name}.json`)).textures)){files.add(t.path);if(t.ktx2)files.add(t.ktx2);}
const report=JSON.parse(fs.readFileSync('out/surface-remaster/verification.json'));if(report.failures.length)throw Error('cannot package a failed verification');
const manifest={version,kind:'material overlay for the matching source checkout',verification:report,files:[...files].sort().map(p=>({path:p,bytes:fs.statSync(p).size,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}))};
fs.mkdirSync('releases',{recursive:true});const manifestPath=`releases/surface-remaster-${version}.json`;fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');files.add(manifestPath);
fs.writeFileSync('out/surface-remaster/release-files.txt',[...files].sort().join('\n')+'\n');const output=`out/urbe-materials-${version}-surface-remaster.tar.gz`;const tar=spawnSync('tar',['-czf',output,'-T','out/surface-remaster/release-files.txt'],{stdio:'inherit'});if(tar.status!==0)process.exit(tar.status);console.log(JSON.stringify({output,bytes:fs.statSync(output).size,files:files.size,sha256:createHash('sha256').update(fs.readFileSync(output)).digest('hex')},null,2));
