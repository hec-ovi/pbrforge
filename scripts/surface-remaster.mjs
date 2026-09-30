/** Rebuild the remaster through pbrforge; raw generations are the only photographic inputs. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { decodeRgb, luminance, wrapBlur, encodeRgbPng, encodeGrayPng } from '../dist/gen/pixels.js';
import { deriveHeight, deriveNormal, deriveAo, constantGray, flatNormal } from '../dist/gen/maps.js';
import { seamScore } from '../dist/gen/seam.js';
const mode = process.argv[2] ?? 'all';
const root = 'sources/surface-remaster';
const out = 'out/surface-remaster';
fs.mkdirSync(out, { recursive: true });
const clip = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clip((v-a)/(b-a));return t*t*(3-2*t);};
const gray=(data,w,h=w)=>({data,width:w,height:h});
const rgb=(data,w,h=w)=>({data,width:w,height:h});
const hash=(x,y,s=0)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+71,668265263)^Math.imul(s+3,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
function wrapEdges(data,w,h,c) { // Cross-fade an offset copy at each edge; never mirror a source.
  let src=data.slice();const bands=[Math.round(w*.18),Math.round(h*.18)];
  for(let axis=0;axis<2;axis++) {const size=axis?h:w,band=bands[axis];src=data.slice();for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const q=axis?y:x,d=Math.min(q,size-1-q);if(d>=band)continue;const a=1-smooth(0,band,d);
    const sx=axis?x:(x+Math.floor(w/2))%w,sy=axis?(y+Math.floor(h/2))%h:y;
    for(let k=0;k<c;k++){const i=(y*w+x)*c+k;data[i]=src[i]*(1-a)+src[(sy*w+sx)*c+k]*a;}
  }} return data;
}
function closeEdges(data,w,h,c) {for(let y=0;y<h;y++)for(let k=0;k<c;k++)data[(y*w+w-1)*c+k]=data[y*w*c+k];for(let x=0;x<w;x++)for(let k=0;k<c;k++)data[((h-1)*w+x)*c+k]=data[x*c+k];return data;}
const cache=new Map();
async function loadSource(id,w=1024,h=w,{flatten=true}={}) {
  const cacheKey=`${id}:${w}:${h}:${flatten}`;if(cache.has(cacheKey))return structuredClone(cache.get(cacheKey));
  const file=id.includes('/')?id:`${root}/raw/${id}.png`;
  const img=await decodeRgb(await sharp(file).removeAlpha().resize(w,h,{fit:'fill'}).png().toBuffer());
  if(flatten){const lum=luminance(img),low=wrapBlur(lum,Math.round(Math.min(w,h)/8),2);let mean=0;for(const v of low.data)mean+=v/low.data.length;
    for(let i=0;i<lum.data.length;i++){const change=(mean-low.data[i])*.65*255;for(let k=0;k<3;k++)img.data[i*3+k]=clip(img.data[i*3+k]+change,0,255);}}
  wrapEdges(img.data,w,h,3);closeEdges(img.data,w,h,3);cache.set(cacheKey,structuredClone(img));return img;
}
function stretch(img,low=.08,high=.92){let hist=new Uint32Array(256);for(const v of img.data)hist[Math.round(v*255)]++;let a=0,b=255,total=0;for(let i=0;i<256;i++){total+=hist[i];if(total<img.data.length*.02)a=i;if(total<img.data.length*.98)b=i;}
  return gray(Float32Array.from(img.data,v=>low+(high-low)*clip((v*255-a)/(b-a))),img.width,img.height);}
async function mask(id,w=1024,h=w){return stretch(luminance(await loadSource(id,w,h,{flatten:false})));}
const requests=[],records=[];
const existing=JSON.parse(fs.readFileSync('themes/cyberpunk/theme.json')).entries;
async function publish(id,key,variant,base,height,roughness,{world=[2,2],metal=0,metalMap,ao,opacity,exact=false,layout,group='streets'}={}){
 const {width:w,height:h}=base;const dir=`${out}/prepared/${id}`;fs.mkdirSync(dir,{recursive:true});
 if(!exact){closeEdges(base.data,w,h,3);closeEdges(height.data,w,h,1);closeEdges(roughness.data,w,h,1);if(metalMap)closeEdges(metalMap.data,w,h,1);}
 const normal=deriveNormal(height,2);if(!exact)closeEdges(normal.data,w,h,3);
 const maps={basecolor:base,normal,roughness,metallic:metalMap??constantGray(base,metal),height,ao:ao??deriveAo(height),...(opacity?{opacity}:{})};const sourceMaps={};
 for(const [channel,img]of Object.entries(maps)){sourceMaps[channel]=`${dir}/${channel}.png`;fs.writeFileSync(sourceMaps[channel],await (channel==='basecolor'||channel==='normal'?encodeRgbPng(img):encodeGrayPng(img)));}
 const req={key,alignment:exact?'exact':'tile',description:`surface remaster: ${id}; generated source and independently authored oily roughness`,...(exact?{aspect:world}:{tiling:{worldSize:world}}),resolution:[w,h],variantId:variant,sourceMaps,physical:{roughnessFactor:1,metallicFactor:metal,...(opacity?{alphaMode:'BLEND'}:{})},...(layout?{layout}:{}),...(existing[key]?{append:true}:{}),overwrite:true};
 requests.push(req);const seam=seamScore(base);let lo=1,hi=0,sum=0,sq=0;for(const v of roughness.data){lo=Math.min(lo,v);hi=Math.max(hi,v);sum+=v;sq+=v*v;}
 records.push({id,key,variant,group,worldSize:world,resolution:[w,h],roughness:{min:lo,max:hi,mean:sum/(w*h),std:Math.sqrt(sq/(w*h)-(sum/(w*h))**2)},seam,sourceMaps});
 console.log('prepared',id,key,variant);
}
function recolor(base,target,strength=1){const lum=luminance(base);let avg=0;for(const v of lum.data)avg+=v/lum.data.length;for(let i=0;i<lum.data.length;i++)for(let k=0;k<3;k++){const val=target[k]*(.65+.35*lum.data[i]/avg);base.data[i*3+k]=clip(base.data[i*3+k]*(1-strength)+val*strength,0,255);}return base;}
function response(base,broad,fine,range,grain=.1,relief=.15){const height=deriveHeight(base,{roughness:range,grain,relief});const roughness=gray(Float32Array.from(broad.data,(v,i)=>range[0]+(range[1]-range[0])*clip(.12+.76*v+.20*fine.data[i])),base.width,base.height);return {height,roughness};}
async function surface(spec){let {id,key,variant='used',source='concrete',world=[2,2],shape,range=[.24,.73],color,group='streets',size=[1024,1024],metal=0}=spec;const [w,h]=size;
 let base=await loadSource(source,w,h);if(color)recolor(base,color);const broad=await mask('smudge',w,h),fine=await mask('fingerprint',w,h); // Fine mask repeats at its physical scale.
 const fdata=fine.data.slice();const repeats=Math.max(1,Math.round(world[0]/.25));for(let y=0;y<h;y++)for(let x=0;x<w;x++)fine.data[y*w+x]=fdata[((y*repeats)%h)*w+(x*repeats)%w];
 const {height,roughness}=response(base,broad,fine,range,.055,shape==='asphalt'?.5:.13);const metallic=constantGray(base,metal);
 const natural=luminance(base);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++) {const i=y*w+x,u=x/w,v=y/h,b=broad.data[i],f=fine.data[i];let edge=0,joint=0,chip=0,polish=0;
   if(shape==='slab'||shape==='red-slab'||shape==='curb'){
     const dx=Math.min(u,1-u)*world[0],dy=Math.min(v,1-v)*world[1],d=shape==='curb'?Math.min(dx,dy):Math.min(dx,dy);
     joint=1-smooth(.0015,.004,d);edge=1-smooth(.004,.07,d);chip=edge*smooth(.58,.8,b*.7+f*.3);
     polish=(1-edge)*smooth(.36,.72,b);height.data[i]-=joint*.15;roughness.data[i]=clip(roughness.data[i]+edge*.14-polish*.05,.16,.94);
     if(shape!=='curb'){for(const bx of [.018,.042,.958,.982]){const r=Math.hypot((u-bx)*world[0],(v-.06)*world[1]);if(r<.01){const rim=smooth(.0065,.008,r)*(1-smooth(.009,.011,r));height.data[i]-=.10*(1-rim);roughness.data[i]=.42;metallic.data[i]=1;for(let k=0;k<3;k++)base.data[i*3+k]=rim?110:48;}}
     }
   }
   if(shape==='hex'){
     // Staggered regular hex centres; repeat dimensions are 6 radii by 4 sqrt(3) radii.
     const cols=8,rows=8,px=u*cols*1.5,py=v*rows*Math.sqrt(3),ix=Math.round(px/1.5);let d=99;
     for(let cx=ix-1;cx<=ix+1;cx++){let yy=Math.round(py/Math.sqrt(3)-(cx%2)*.5);for(let cy=yy-1;cy<=yy+1;cy++){const dx=Math.abs(px-cx*1.5),dy=Math.abs(py-(cy+(cx%2)*.5)*Math.sqrt(3));const dist=Math.max(dy,dx*.8660254+dy*.5);d=Math.min(d,dist);}}
     const border=.8660254-d;joint=1-smooth(.004,.025,border);edge=1-smooth(.025,.10,border);height.data[i]-=joint*.035;roughness.data[i]=clip(roughness.data[i]+edge*.1,.2,.86);
   }
   if(shape==='octagon'){
     const tx=(u*4)%1,ty=(v*4)%1;const dx=Math.min(tx,1-tx),dy=Math.min(ty,1-ty),cut=.292893;
     const square=dx+dy<cut;const distance=Math.min(Math.abs(dx+dy-cut),square?1:Math.min(dx,dy));joint=1-smooth(.009,.018,distance);edge=1-smooth(.018,.09,distance);
     if(square)for(let k=0;k<3;k++)base.data[i*3+k]*=[.33,.30,.27][k];height.data[i]-=joint*.12;roughness.data[i]=clip(roughness.data[i]+joint*.5+edge*.07,.12,.94);
   }
   if(shape==='terracotta') {const dx=Math.min((u*3)%1,1-(u*3)%1),dy=Math.min((v*3)%1,1-(v*3)%1),d=Math.min(dx,dy);joint=1-smooth(.007,.017,d);edge=1-smooth(.02,.08,d);height.data[i]-=joint*.1;roughness.data[i]=clip(roughness.data[i]+joint*.34+edge*.10,.25,.95);}
   if(shape==='grate'||shape==='drain'){
     const a=(u*world[0]/.055)%1,bb=(v*world[1]/.16)%1;
     const slot=smooth(.22,.27,a)*(1-smooth(.71,.76,a))*smooth(.16,.20,bb)*(1-smooth(.78,.82,bb));
     joint=slot;height.data[i]=.51-slot*.40;roughness.data[i]=clip(roughness.data[i]+slot*.3,.32,.92);metallic.data[i]=1-slot;
   }
   if(shape==='asphalt'||shape==='patched') {polish=smooth(.44,.78,b)*.11;roughness.data[i]-=polish;const patch=shape==='patched'?smooth(.51,.59,b):0;for(let k=0;k<3;k++)base.data[i*3+k]*=(1-patch*.23);height.data[i]-=patch*.02;}
   if(shape==='paint') {chip=smooth(.63,.78,b*.55+f*.25+hash(x,y,4)*.2);height.data[i]-=chip*.02;roughness.data[i]=clip(roughness.data[i]+chip*.22,.25,.94);}
   if(shape==='wall') {const streak=(Math.sin(u*Math.PI*38+Math.sin(v*6))*0.5+.5)*b;roughness.data[i]=clip(roughness.data[i]+streak*.08,.42,.95);}
   for(let k=0;k<3;k++){
     let value=base.data[i*3+k];if(chip>0)value=value*(1-chip)+(90+natural.data[i]*45)*chip;
     value=value*(1-joint*.72)*(1-edge*.026)+polish*5;
     base.data[i*3+k]=clip(value,0,255);
   }
 }
 let layout= ['slab','red-slab'].includes(shape)?{family:'panel',moduleSize:world,jointWidth:.006,origin:[0,0],orientation:'horizontal'}:undefined;
 await publish(id,key,variant,base,height,roughness,{world,metal,metalMap:metallic,layout,group});
}
async function masks(){const w=2048;const broad=await mask('smudge',w),fine=await mask('fingerprint',w);for(const [id,world]of [['broad-smudge',2],['fine-fingerprint',.25],['edge-scuff',1],['edge-chips',1],['dirt-dust',2],['dirt-streaks',2]]){
 let data=new Float32Array(w*w);for(let y=0;y<w;y++)for(let x=0;x<w;x++){const i=y*w+x,b=broad.data[i],f=fine.data[i],edge=1-smooth(.008,.16,Math.min(x,y,w-1-x,w-1-y)/w);
 data[i]=id==='broad-smudge'?b:id==='fine-fingerprint'?f:id==='edge-scuff'?clip(edge*(.3+.7*b)+f*.07):id==='edge-chips'?edge*smooth(.45,.76,b*.6+f*.4):id==='dirt-dust'?clip(.7*b+.3*f):clip(.55*b+.45*broad.data[(Math.floor(y/5)*w+(x*7)%w)]);}
 closeEdges(data,w,w,1);const response=gray(data,w),base=rgb(new Uint8Array(w*w*3),w);for(let i=0;i<data.length;i++)base.data.fill(Math.round(data[i]*255),i*3,i*3+3);
 await publish(id,`cyberpunk/surface-detail/${id}`,'field',base,constantGray(base,.5),response,{world:[world,world],group:'masks'});
 }
 const src=await sharp(`${root}/raw/atlas.png`).ensureAlpha().resize(2048,2048).raw().toBuffer({resolveWithObject:true});const base=rgb(new Uint8Array(2048*2048*3),2048);const opacity=gray(new Float32Array(2048*2048),2048);const roughness=gray(new Float32Array(2048*2048),2048);const height=constantGray(base,.5);
 for(let y=0;y<2048;y++)for(let x=0;x<2048;x++){const i=y*2048+x,cellX=Math.floor(x*3/2048),cellY=Math.floor(y*2/2048),u=(x*3/2048)%1,v=(y*2/2048)%1;const inset=smooth(.022,.042,Math.min(u,v,1-u,1-v));base.data.set(src.data.subarray(i*4,i*4+3),i*3);opacity.data[i]=src.data[i*4+3]/255*inset;roughness.data[i]=[.62,.18,.76,.88,.87,.43][cellY*3+cellX]+.06*Math.sin(x*.041)*Math.sin(y*.031);}
 await publish('decal-atlas','cyberpunk/surface-detail/decal-atlas','six-marks',base,height,roughness,{world:[1,1],opacity,exact:true,group:'masks'});
}
async function engineAtlas(){
 const w=2048,cell=512;const source=await sharp(`${root}/raw/atlas.png`).metadata();const sw=Math.floor(source.width/3),sh=Math.floor(source.height/2);const cells=[];
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
 const index=row===0?(col===3?0:1):row===1?3:row===2?5:col<2?4:2;
 let p=sharp(`${root}/raw/atlas.png`).extract({left:index%3*sw,top:Math.floor(index/3)*sh,width:sw,height:sh}).resize(448,448,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}});
 if(col%2)p=p.flop();if(col===2)p=p.flip();const input=await p.extend({top:32,bottom:32,left:32,right:32,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();cells.push({input,left:col*cell,top:row*cell});}
 const raw=await sharp({create:{width:w,height:w,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(cells).raw().toBuffer();
 const base=rgb(new Uint8Array(w*w*3),w),opacity=gray(new Float32Array(w*w),w),rough=gray(new Float32Array(w*w),w);
 for(let y=0;y<w;y++)for(let x=0;x<w;x++){const i=y*w+x,row=Math.floor(y/cell),col=Math.floor(x/cell);base.data.set(raw.subarray(i*4,i*4+3),i*3);opacity.data[i]=raw[i*4+3]/255;rough.data[i]=[col===3?.65:.2,.88,.45,.85][row]+.04*Math.sin(x*.05)*Math.sin(y*.05);}
 await publish('engine-atlas','cyberpunk/surface-detail/decal-atlas','engine-grid',base,constantGray(base,.5),rough,{world:[1,1],opacity,exact:true,group:'masks'});
 requests.at(-1).canonical=true;requests.at(-1).append=true;
}
const streetSpecs=[
 ['asphalt-clean','cyberpunk/street-asphalt/mid','clean','asphalt',[2,2],'asphalt',[.59,.87]],
 ['asphalt-worn','cyberpunk/street-asphalt/mid','worn','asphalt',[2,2],'asphalt',[.39,.81]],
 ['asphalt-patched','cyberpunk/street-asphalt/mid','patched','asphalt',[2,2],'patched',[.43,.9]],
 ['sidewalk-slab','cyberpunk/street-sidewalk/mid','slab','concrete',[2,2],'slab',[.27,.73]],
 ['sidewalk-worn','cyberpunk/street-sidewalk/mid','walked','concrete',[2,2],'slab',[.22,.72],[117,117,109]],
 ['red-lane','cyberpunk/street-coated/mid','red','red',[2,2],'red-slab',[.22,.68]],
 ['curb-red','cyberpunk/street-curb/mid','red','red',[2,.25],'curb',[.27,.78]],
 ['curb-yellow','cyberpunk/street-curb/mid','yellow','red',[2,.25],'curb',[.3,.8],[186,126,39]],
 ['curb-blue','cyberpunk/street-curb/mid','blue','painted',[2,.25],'curb',[.28,.77],[50,96,114]],
 ['hex-grey','cyberpunk/street-hex/mid','grey','concrete',[1.2,1.385640646],'hex',[.28,.72],[105,105,99]],
 ['hex-orange','cyberpunk/street-hex/mid','orange','red',[1.2,1.385640646],'hex',[.29,.76],[170,99,35]],
 ['lane-yellow','cyberpunk/street-paint/mid','yellow','concrete',[1,1],'paint',[.38,.77],[204,162,61]],
 ['crosswalk-white','cyberpunk/street-paint/mid','white','concrete',[1,1],'paint',[.38,.79],[210,207,192]],
 ['grate','cyberpunk/street-drain/mid','grate','metal',[.8,.8],'grate',[.35,.75],[80,87,85]],
 ['drain','cyberpunk/street-drain/mid','slotted','metal',[.8,.8],'drain',[.34,.81],[65,75,73]],
];
const exteriorSpecs=[
 ['weathered-concrete','cyberpunk/concrete-monolith/mid','weathered','weathered',[2,2],'wall',[.49,.9]],
 ['cast-concrete','cyberpunk/exterior-cast-concrete/mid','native','weathered',[2,2],'wall',[.5,.86],[140,140,131]],
 ['graphite-concrete','cyberpunk/exterior-graphite-concrete/mid','native','weathered',[2,2],'wall',[.48,.89],[83,91,90]],
 ['weathered-exterior','cyberpunk/exterior-weathered-concrete/mid','native','weathered',[2,2],'wall',[.5,.91]],
 ['graphite-coating','cyberpunk/exterior-graphite-coating/mid','native','painted',[1,1],'wall',[.3,.73],[66,83,85]],
 ['poor-concrete','cyberpunk/concrete-monolith/poor','weathered','weathered',[2,2],'wall',[.53,.94]],
 ['poor-teal-panel','cyberpunk/exterior-painted-panel/poor','teal','painted',[1,1],'wall',[.28,.76]],
 ['mid-teal-panel','cyberpunk/exterior-painted-panel/mid','teal','painted',[1,1],'wall',[.25,.68]],
 ['poor-service-alloy','cyberpunk/service-alloy/poor','brushed','metal',[1,1],'wall',[.39,.8],[106,113,110]],
 ['poor-painted-metal','cyberpunk/metal/poor','paint','painted',[1,1],'wall',[.33,.81],[96,108,106]],
 ['mid-painted-metal','cyberpunk/metal/mid','paint','painted',[1,1],'wall',[.29,.73],[94,107,108]],
];
const interiorSpecs=[
 ['octagon-tile','cyberpunk/interior-octagon/mid','ivory-inserts','lacquer',[1.2,1.2],'octagon',[.14,.54],[178,168,149]],
 ['e1-cream','cyberpunk/e1-panel/high_rich','cream','lacquer',[1,1],null,[.2,.5],[216,210,192]],
 ['e1-lacquer','cyberpunk/e1-ceiling/high_rich','gloss-black','lacquer',[1,1],null,[.12,.4],[34,36,37]],
 ['e1-teal-stone','cyberpunk/e1-floor/high_rich','dark-stone','sources/interior-kinds/e1-floor-stone.png',[1.5,1.5],null,[.16,.53]],
 ['e1-metal-panel','cyberpunk/e1-housing/high_rich','cool-grey','metal',[1,1],null,[.24,.56],[143,153,160]],
 ['e1-worktop','cyberpunk/e1-worktop/high_rich','steel','metal',[1,1],null,[.2,.53],[104,115,123]],
 ['r1-walnut','cyberpunk/r1-floor/rich','walnut','sources/interior-kinds/r1-walnut-floor.png',[2,2],null,[.23,.56]],
 ['b3-walnut','cyberpunk/corpo-plaza-veneer/rich','smoked','sources/interior-kinds/r1-walnut-floor.png',[2,2],null,[.23,.56],[90,66,47]],
 ['b3-gold','cyberpunk/b3-trim/rich','gold','metal',[.5,.5],null,[.24,.54],[168,132,72]],
 ['c4-terracotta','cyberpunk/c4-tile/poor','terracotta','sources/interior-kinds/c4-terracotta-tile.png',[1.2,1.2],'terracotta',[.28,.74]],
 ['capsule-enamel','cyberpunk/interior-capsule-enamel/poor','worn-ivory','lacquer',[1,1],null,[.25,.65],[204,202,180]],
 ['capsule-ivory','cyberpunk/interior-capsule-enamel/mid','ivory','lacquer',[1,1],null,[.21,.6],[205,202,187]],
 ['c4-teal','cyberpunk/c4-paint/poor','teal','painted',[2,2],null,[.28,.7]],
];
if(mode==='masks'||mode==='all'){await masks();await engineAtlas();}
if(mode==='atlas')await engineAtlas();
for(const [group,specs]of [['streets',streetSpecs],['exteriors',exteriorSpecs],['interiors',interiorSpecs]])if(mode===group||mode==='all')for(const [id,key,variant,source,world,shape,range,color]of specs){let size=shape==='curb'?[2048,256]:shape==='hex'?[880,1016]:[1024,1024];await surface({id,key,variant,source,world,shape,range,color,group,size,metal:/alloy|worktop|metal-panel|b3-gold|grate|drain/.test(id)?1:0});}
// Sequential per request: later variants append to entries created earlier in this run.
fs.writeFileSync(`${out}/${mode}-requests.json`,JSON.stringify(requests,null,2)+'\n');
for(const req of requests){const live=JSON.parse(fs.readFileSync('themes/cyberpunk/theme.json')).entries;if(live[req.key])req.append=true;
 const file=`${out}/request.json`;fs.writeFileSync(file,JSON.stringify(req));const r=spawnSync('node',['dist/cli/pbrforge.js','create',file,'--native','--overwrite'],{encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);console.log('published',req.key,req.variantId);
 const resolved=spawnSync('node',['dist/cli/pbrforge.js','resolve',req.key],{encoding:'utf8'});if(resolved.status!==0)throw Error(resolved.stdout+resolved.stderr);
}
fs.writeFileSync(`${out}/${mode}-report.json`,JSON.stringify(records,null,2)+'\n');
fs.mkdirSync(`${root}/catalog`,{recursive:true});fs.writeFileSync(`${root}/catalog/${mode}.json`,JSON.stringify(records.map(({sourceMaps,...r})=>r),null,2)+'\n');
