/** Correct two horizontal paving material routes using the existing native sampler. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const file=path.join(root,'bindings/street-native.json'),binding=JSON.parse(fs.readFileSync(file)),before=structuredClone(binding),theme=JSON.parse(fs.readFileSync(path.join(root,'themes/cyberpunk/theme.json')));
const authoredPath=path.join(root,binding.authored.manifest),authored=JSON.parse(fs.readFileSync(authoredPath));
const digest=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
for(const [id,key,variantId] of [['terracotta','cyberpunk/street-terracotta/poor','clean-a'],['basalt','cyberpunk/street-hex/mid','grey-clean-a']]){
 const entry=theme.entries[key],variant=entry?.variants.find(v=>v.id===variantId);assert(variant,key+'#'+variantId);const surface=binding.surfaces[id];assert.equal(surface.effect,'photographed');
 for(const channel of ['basecolor','normal','roughness','ao']){const textureId=surface.maps[channel],png='themes/cyberpunk/'+variant.maps[channel];assert(textureId);const texture={path:png,sha256:digest(png),resolution:variant.resolution,colorSpace:channel==='basecolor'?'srgb':'linear',wrap:['repeat','repeat']};const ktx2=png.replace(/\.png$/,'.ktx2');if(fs.existsSync(path.join(root,ktx2))){texture.ktx2=ktx2;texture.ktx2Sha256=digest(ktx2)}binding.textures[textureId]=texture;const record=authored.files.find(f=>f.target===png);if(record)record.sha256=texture.sha256;else authored.files.push({target:png,sha256:texture.sha256});}
 surface.uv={mode:'world-xz',scale:variant.tiling?.worldSize??entry.tiling.worldSize};
}
// Paving.cell and CornerPaving.lay emit horizontal polygons. This changes only
// their material sampling; the producer's geometry/UVs and palette are intact.
for(const [id,surface]of Object.entries(before.surfaces))if(!['terracotta','basalt'].includes(id))assert.deepEqual(binding.surfaces[id],surface,id);
authored.tileFamilies={inventory:'sources/street-tile-families/INDEX.md',catalog:'sources/street-tile-families/catalog.json',bindingScript:'scripts/bind-metric-tile-surfaces.mjs',surfaces:['terracotta','basalt'],sampling:'existing world-XZ at catalog metre periods; horizontal paving only'};
fs.writeFileSync(authoredPath,JSON.stringify(authored,null,2)+'\n');
fs.writeFileSync(file,JSON.stringify(binding,null,2)+'\n');console.log('Bound terracotta and basalt at catalog metre periods using existing world-XZ sampling');
