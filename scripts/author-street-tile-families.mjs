import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';

const checkout=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),stage=path.join(checkout,'out/tile-families-authoring'),themes=path.join(stage,'themes');
fs.mkdirSync(stage,{recursive:true});
fs.cpSync(path.join(checkout,'sources/street-tile-families/raw'),path.join(stage,'raw'),{recursive:true});
fs.copyFileSync(path.join(checkout,'sources/street-tile-families/publish.mjs'),path.join(stage,'publish.mjs'));
const clip=(a,l=0,h=1)=>Math.max(l,Math.min(h,a));
const sm=(a,b,v)=>{const q=clip((v-a)/(b-a));return q*q*(3-2*q);};
const mod=(a,b)=>(a%b+b)%b;
const hash=(x,y,s)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+71,668265263)^Math.imul(s+3,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const digest=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const json=(f,v)=>fs.writeFileSync(path.join(stage,f),JSON.stringify(v,null,2)+'\n');
for(const d of ['prepared','masks','requests','review','docs','themes'])fs.mkdirSync(path.join(stage,d),{recursive:true});
function noise(u,v,n,s){const x=u*n,y=v*n,ix=Math.floor(x),iy=Math.floor(y),fx=sm(0,1,x-ix),fy=sm(0,1,y-iy);const a=hash(mod(ix,n),mod(iy,n),s),b=hash(mod(ix+1,n),mod(iy,n),s),c=hash(mod(ix,n),mod(iy+1,n),s),d=hash(mod(ix+1,n),mod(iy+1,n),s);return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;}
function field(u,v,s){return .53*noise(u,v,5,s)+.27*noise(u,v,13,s+1)+.14*noise(u,v,31,s+2)+.06*noise(u,v,83,s+3);}
function distSegment(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clip(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}
function closeEdges(a,w,h,c){for(let y=0;y<h;y++)for(let k=0;k<c;k++)a[(y*w+w-1)*c+k]=a[y*w*c+k];for(let x=0;x<w;x++)for(let k=0;k<c;k++)a[((h-1)*w+x)*c+k]=a[x*c+k];return a;}
async function png(file,a,w,h,c=1,unit=true){const b=Buffer.alloc(a.length);for(let i=0;i<a.length;i++)b[i]=Math.round(clip(a[i],0,unit?1:255)*(unit?255:1));closeEdges(b,w,h,c);await sharp(b,{raw:{width:w,height:h,channels:c}}).png().toFile(file);}
function normalFromMetres(height,w,h,world){const a=new Float32Array(w*h*3),dx=world[0]/(w-1),dy=world[1]/(h-1);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const sx=(height[y*w+mod(x+1,w-1)]-height[y*w+mod(x-1,w-1)])/(2*dx),sy=(height[mod(y+1,h-1)*w+x]-height[mod(y-1,h-1)*w+x])/(2*dy);const len=Math.hypot(sx,sy,1);a[i*3]=.5-.5*sx/len;a[i*3+1]=.5+.5*sy/len;a[i*3+2]=.5+.5/len;}return closeEdges(a,w,h,3);}

async function intrinsic(f){const [w,h]=f.resolution;const file=path.join(stage,'raw',f.raw),meta=await sharp(file).metadata();
 const crop=f.family==='terracotta'?{left:0,top:0,width:meta.width,height:meta.height}:{left:Math.floor((meta.width-1086)/2),top:0,width:1086,height:1254};
 if(crop.width<w||crop.height<h)throw Error('Photographic upscaling is forbidden');
 const a=await sharp(file).removeAlpha().extract(crop).resize(w,h,{fit:'fill',kernel:'lanczos3'}).raw().toBuffer();const b=Float32Array.from(a,v=>v/255);
 // Only the intrinsic photograph is reconciled at its boundary. All construction is analytical and periodic.
 for(let axis=0;axis<2;axis++){const src=b.slice(),n=axis?h:w,band=48;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=axis?y:x,d=Math.min(q,n-1-q);if(d>=band)continue;const t=1-sm(0,band,d),xx=axis?x:(x+Math.floor(w/2))%w,yy=axis?(y+Math.floor(h/2))%h:y;for(let k=0;k<3;k++)b[(y*w+x)*3+k]=src[(y*w+x)*3+k]*(1-t)+src[(yy*w+xx)*3+k]*t;}}
 closeEdges(b,w,h,3);let mean=0;const lum=new Float32Array(w*h);for(let i=0;i<lum.length;i++){lum[i]=b[i*3]*.2126+b[i*3+1]*.7152+b[i*3+2]*.0722;mean+=lum[i]/lum.length;}
 return {lum,mean,record:{file:path.relative(stage,file),sha256:digest(file),nativeDimensions:[meta.width,meta.height],crop,outputDimensions:[w,h],upscaled:false,aspectPixelError:(w/h)/(f.world[0]/f.world[1])-1}};
}
function construction(f){const [w,h]=f.resolution;const id=new Int16Array(w*h),edge=new Float32Array(w*h),joint=new Float32Array(w*h),height=new Float32Array(w*h),centre=new Float32Array(w*h),tones=new Float32Array(w*h);const centers=new Map();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,px=x/(w-1)*f.world[0],py=y/(h-1)*f.world[1];let col,row,cx,cy,d;
 if(f.family==='terracotta'){row=Math.floor((py+1e-8)/.15);col=Math.floor((px+(row%2)*.1+1e-8)/.2);cx=(col+.5)*.2-(row%2)*.1;cy=(row+.5)*.15;d=Math.min(.1-Math.abs(px-cx),.075-Math.abs(py-cy));id[i]=mod(row,8)*6+mod(col,6);joint[i]=1-sm(.001,.0025,d);edge[i]=1-sm(.0025,.008,d);height[i]=-.00115*joint[i]-.00012*edge[i];tones[i]=.74+.34*hash(mod(col,6),mod(row,8),145);if(hash(mod(col,6),mod(row,8),43)<.16)tones[i]*=.72;}
 else {let best=99;const ix=Math.round(px/.15);for(let cc=ix-1;cc<=ix+1;cc++){const iy=Math.round(py/(Math.sqrt(3)*.1)-mod(cc,2)*.5);for(let rr=iy-1;rr<=iy+1;rr++){const xx=cc*.15,yy=(rr+mod(cc,2)*.5)*Math.sqrt(3)*.1,dx=Math.abs(px-xx),dy=Math.abs(py-yy),q=Math.max(dy,.8660254*dx+.5*dy);if(q<best){best=q;col=cc;row=rr;cx=xx;cy=yy;}}}d=.08660254-best;id[i]=mod(row,8)*8+mod(col,8);joint[i]=1-sm(.0005,.0017,d);edge[i]=1-sm(.0017,.0065,d);const ring=sm(.002,.0038,d)*(1-sm(.0052,.0071,d));centre[i]=1-sm(.002,.006,Math.hypot(px-cx,py-cy));height[i]=-.00048*joint[i]+.00018*ring-.00024*centre[i];tones[i]=.955+.085*hash(mod(col,8),mod(row,8),52);}
 centers.set(`${col},${row}`,{id:id[i],col,row,cx,cy});
 }return {id,edge,joint,height,centre,tones,centers};}

const specs=[{family:'grey',key:'cyberpunk/street-hex/mid',raw:'hex-mineral.png',world:[1.2,1.385640646],resolution:[1024,1182],pigment:[96,102,103],seed:300},{family:'orange',key:'cyberpunk/street-hex/mid',raw:'hex-mineral.png',world:[1.2,1.385640646],resolution:[1024,1182],pigment:[170,101,39],seed:730},{family:'terracotta',key:'cyberpunk/street-terracotta/poor',raw:'terracotta-face.png',world:[1.2,1.2],resolution:[1024,1024],pigment:[172,91,48],seed:1210}];
const report={authoredAt:new Date().toISOString(),database:'themes',heightEncoding:{zero:.5,metresPerUnit:.008},normalConvention:'+Y; physical unquantized height gradient',pigmentDisclosure:'Grey and orange share the same mineral photo and analytical hex construction. Colour is an authored pigment variation; histories use independent masks and seeds. Terracotta uses its own native photographic clay face.',sourceUpscaling:false,visualAcceptance:false,sourceInventory:[],variants:[]};
const requests=[];const histories={clean:'Intact construction with restrained local wipe and sparse fine abrasive hairlines; no major damage.',stained:'Two irregular oil/residue islands, independent dull scuff island, light boundary dirt and local suppressed hex ring relief.',cracked:'Localized branching cracks in selected tile faces tied to their own joints, rough chipped lips and residue at affected edges.',patched:'Selected complete tiles/modules replaced or resealed with fresh pigment/gloss and localized new grout, preserving existing joint alignment.'};

for(const f of specs){const src=await intrinsic(f),wipe=await intrinsic({...f,raw:'wipe-history.png'}),g=construction(f);report.sourceInventory.push({...src.record,family:f.family},{...wipe.record,family:f.family,role:'Secondary native photograph: wiping/residue response ingredient, phase-offset and masked independently per condition.'});const [w,h]=f.resolution,n=w*h;
 for(const [s,state] of ['clean','stained','cracked','patched'].entries())for(const [version,vi] of [['a',0],['b',1]]){
 const vid=(f.family==='terracotta'?'':f.family+'-')+state+'-'+version,name=f.family+'-'+state+'-'+version,seed=f.seed+s*83+vi*307;
 const cands=[...g.centers.values()].filter(c=>c.cx>.18&&c.cx<f.world[0]-.18&&c.cy>.18&&c.cy<f.world[1]-.18).sort((a,b)=>hash(a.col,a.row,seed)-hash(b.col,b.row,seed));
 const selected=cands.slice(0,vi?3:2);const damaged=new Set(selected.map(c=>c.id));const patchSet=new Set(cands.slice(0,vi?4:3).map(c=>c.id));
 const segments=[];for(const c of selected){const cs=seed+c.id*91;
  const boundary=angle=>{const dx=Math.cos(angle),dy=Math.sin(angle),r=f.family==='terracotta'?Math.min(.1/Math.abs(dx),.075/Math.abs(dy)):.08660254/Math.max(Math.abs(dy),.8660254*Math.abs(dx)+.5*Math.abs(dy));return[c.cx+dx*r,c.cy+dy*r];};
  const angle=hash(c.id,3,cs)*Math.PI*2,p0=boundary(angle),p1=[c.cx+(hash(1,c.id,cs)-.5)*.047,c.cy+(hash(2,c.id,cs)-.5)*.032],p2=boundary(angle+Math.PI+(hash(3,c.id,cs)-.5)*.7),p3=boundary(angle+1.3+hash(5,c.id,cs));
  const jagged=(a,b,s)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);let prev=a;for(let j=1;j<=11;j++){const t=j/11,amp=Math.sin(t*Math.PI),offset=(hash(j,c.id,s)-.5)*.006*amp;const p=[a[0]+dx*t-dy/len*offset,b[1]-dy*(1-t)+dx/len*offset];segments.push([prev,p]);prev=p;}};
  jagged(p0,p1,cs+7);jagged(p1,p2,cs+23);jagged(p1,p3,cs+91);
  if(hash(c.id,19,cs)>.5){const branch=[p1[0]+(p2[0]-p1[0])*.44,p1[1]+(p2[1]-p1[1])*.44];jagged(branch,boundary(angle-1.1-hash(c.id,2,cs)),cs+119);}
 }
 const color=new Float32Array(n*3),height=new Float32Array(n),rough=new Float32Array(n),ao=new Float32Array(n),primary=new Float32Array(n),polished=new Float32Array(n),crackMask=new Float32Array(n),repair=new Float32Array(n),chipMask=new Float32Array(n);
 const oilCenters=vi?[[.68,.35,.17,.24],[.28,.71,.15,.13]]:[[.32,.45,.21,.28],[.74,.69,.10,.16]];
 const wipeOffsetX=Math.floor(hash(11,23,seed)*w),wipeOffsetY=Math.floor(hash(9,17,seed)*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,u=x/(w-1),v=y/(h-1),px=u*f.world[0],py=v*f.world[1],border=Math.min(x,y,w-1-x,h-1-y),envelope=sm(12,58,border),a=field(u,v,seed),b=field(u,v,seed+23),intrinsic=src.lum[i]-src.mean,photograph=wipe.lum[mod(y+wipeOffsetY,h)*w+mod(x+wipeOffsetX,w)],residue=sm(.19,.48,photograph);
 let oil=0,dust=0,wear=0,crack=0,chip=0,patch=0,scratch=0;const distort=(a-.5)*.48;
 for(const [cx,cy,rx,ry] of oilCenters){const d=Math.hypot((u-cx)/rx,(v-cy)/ry);oil=Math.max(oil,1-sm(.46,1.40,d+distort*4.6+(residue-.5)*.75));}oil*=envelope*(.27+.73*sm(.18,.78,residue));
 const worn=sm(.35,.68,a)*envelope,grain=intrinsic*.001;
 if(state==='clean'){wear=oil*.27;oil=0;dust=0;}
 if(state==='stained'){dust=(1-sm(.23,.49,Math.hypot((u-(vi?.29:.78))/.32,(v-(vi?.32:.24))/.4)+distort))*.63*envelope;wear=clip(oil*.83+sm(.51,.66,a)*(1-residue)*.42*envelope);oil*=.82+.18*b;chip=g.edge[i]*sm(.51,.68,b)*oil*.36;}
 if(state==='cracked'){oil*=.12;wear=worn*.20;if(damaged.has(g.id[i])){let d=99;for(const [p,q]of segments)d=Math.min(d,distSegment(px,py,p,q));crack=(1-sm(.0004,.00165,d))*(.78+.22*noise(u,v,211,seed));chip=(1-sm(.0012,.004,d))*sm(.32,.62,b);chip=Math.max(chip,g.edge[i]*sm(.52,.72,a)*.7);}crack*=envelope;chip*=envelope;}
 if(state==='patched'){oil*=.13;wear=worn*.21;patch=patchSet.has(g.id[i])?envelope:0;}
 // Small surface scratches are physical, unlike oily/dust response. Two arrangements and every pigment get their own locations.
 const cx=.30+.25*hash(2,3,seed),cy=.25+.40*hash(5,8,seed),sd=Math.abs((v-cy)-.19*(u-cx));scratch=(1-sm(.0002,.0011,sd))*sm(.04,.08,u-cx)*(1-sm(.20,.25,u-cx))*envelope*(state==='clean'?.25:.55);
 const geomStrength=f.family==='terracotta'?1:1-wear*.91;
 height[i]=g.height[i]*geomStrength+clip(grain,-.000055,.000055)-crack*.00062-chip*.00015+patch*.00013-scratch*.000028;
 const tileGloss=f.family==='terracotta'?.39+.13*hash(g.id[i],13,20):.51+.05*hash(g.id[i],9,20);
 let r=tileGloss+intrinsic*.11+(residue-.5)*envelope*(state==='clean'?.035:.067)+g.joint[i]*.28+g.edge[i]*.035-oil*.36-wear*.13+dust*.20+crack*.26+chip*.15+scratch*.08;
 r=r*(1-patch*.87)+(.32+(f.family==='terracotta'?.04:0)+a*.07+g.joint[i]*.38)*patch*.87;
 rough[i]=clip(r,.16,.91);ao[i]=clip(1-g.joint[i]*(f.family==='terracotta'?.23:.11)*geomStrength-crack*.15-chip*.08,.57,1);
 for(let k=0;k<3;k++){let val=(f.pigment[k]/255)*g.tones[i]+intrinsic*(f.family==='terracotta'?.31:.14);const mortar=(f.family==='terracotta'?[65,57,48]:[63,66,64])[k]/255;
 val=val*(1-g.joint[i]*.65*geomStrength)+mortar*g.joint[i]*.65*geomStrength;
 val*=1-oil*.24-wear*.025-dust*.06-crack*.48;
 const rawChip=(f.family==='terracotta'?[181,114,70]:[129,125,109])[k]/255;val=val*(1-chip*.62)+rawChip*chip*.62;
 const patchColor=f.pigment[k]/255*(f.family==='terracotta'?(vi?1.06:.92):(vi?.91:1.035))+intrinsic*.13;
 val=val*(1-patch*.75*(1-g.joint[i]))+patchColor*patch*.75*(1-g.joint[i]);
 if(patch&&g.joint[i])val=val*(1-patch*g.joint[i]*.4)+(.36+(k===0?.04:0))*patch*g.joint[i]*.4;
 color[i*3+k]=clip(val,0,1);}
 primary[i]=state==='clean'?wear:state==='stained'?oil:state==='cracked'?Math.max(crack,chip):patch;polished[i]=wear;crackMask[i]=crack;repair[i]=patch;chipMask[i]=chip;
 }
 // A common intrinsic 12px boundary avoids cross-variant discontinuities. Variant histories fade across the next46px.
 // Photographic grain and analytical geometry were identical at those boundaries from the start.
 closeEdges(height,w,h,1);const normal=normalFromMetres(height,w,h,f.world),hmap=Float32Array.from(height,z=>.5+z/.008),metal=new Float32Array(n);
 const dir=path.join(stage,'prepared',name),mdir=path.join(stage,'masks',name);fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(mdir,{recursive:true});
 const maps={basecolor:color,normal,roughness:rough,metallic:metal,height:hmap,ao};const sourceMaps={};for(const [channel,a]of Object.entries(maps)){const file=path.join(dir,channel+'.png');await png(file,a,w,h,['basecolor','normal'].includes(channel)?3:1);sourceMaps[channel]=path.relative(stage,file);}
 for(const [channel,a]of Object.entries({primary,polished,crack:crackMask,repair,chip:chipMask}))await png(path.join(mdir,channel+'.png'),a,w,h);
 const req={key:f.key,variantId:vid,alignment:'tile',tiling:{worldSize:f.world},resolution:f.resolution,description:`${f.family} street tiles; ${state} ${version}. ${histories[state]} Photographic intrinsic source; independent seeded use history; isolated review candidate.`,sourceMaps,physical:{roughnessFactor:1,metallicFactor:0},append:true,overwrite:true};
 requests.push(req);json(`requests/${name}.json`,req);
 let lo=1,hi=0,mean=0,cov=0;for(let i=0;i<n;i++){lo=Math.min(lo,rough[i]);hi=Math.max(hi,rough[i]);mean+=rough[i]/n;cov+=primary[i]>.25?1/n:0;}
 report.variants.push({family:f.family,name,key:f.key,variantId:vid,state,arrangement:version,seed,resolution:f.resolution,worldSize:f.world,history:histories[state],selectedModules:selected.map(c=>({id:c.id,cx:c.cx,cy:c.cy})),patchModules:[...patchSet],roughness:{min:lo,max:hi,mean},primaryCoverage:cov,maps:sourceMaps,mapHashes:Object.fromEntries(Object.entries(sourceMaps).map(([k,file])=>[k,digest(path.join(stage,file))]))});
 console.log('prepared',name);
 }
}
json('portable-publish-requests.json',requests);json('author-report.json',report);
if(!process.argv.includes('--prepare-only')){const p=spawnSync(process.execPath,[path.join(stage,'publish.mjs'),'--themes',path.join(stage,'themes')],{cwd:stage,encoding:'utf8'});if(p.status!==0)throw Error(p.stdout+p.stderr);console.log(p.stdout);}
