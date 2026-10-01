/** Photo sources become coordinated slab PBR variants through the public native import. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodeRgb,luminance,wrapBlur,encodeRgbPng,encodeGrayPng} from '../dist/gen/pixels.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const themes=path.join(root,'themes'),out=path.join(root,'out/street-variants');
fs.mkdirSync(out,{recursive:true});
const size=1024, count=size*size, world=[2,2], pixel=world[0]/size;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
const gray=data=>({data,width:size,height:size});
async function rgb(file){return decodeRgb(await sharp(file).removeAlpha().resize(size,size).png().toBuffer())}
async function scalar(file){const b=await sharp(file).removeAlpha().greyscale().resize(size,size).raw().toBuffer();return Float32Array.from(b,x=>x/255)}
const commonDir=path.join(themes,'cyberpunk/assets/street-sidewalk/mid/slab');
const common={basecolor:await rgb(commonDir+'/basecolor.png'),roughness:await scalar(commonDir+'/roughness.png'),height:await scalar(commonDir+'/height.png'),normal:await rgb(commonDir+'/normal.png'),ao:await scalar(commonDir+'/ao.png')};
const broad=await scalar(path.join(root,'sources/surface-remaster/raw/smudge.png'));
const fine=await scalar(path.join(root,'sources/surface-remaster/raw/fingerprint.png'));
const apron=i=>{const x=i%size,y=Math.floor(i/size);return 1-smooth(.035,.08,Math.min(x,y,size-1-x,size-1-y)/(size-1))};
function normals(height){const data=new Uint8Array(count*3);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const i=y*size+x,x0=(x+size-1)%size,x1=(x+1)%size,y0=(y+size-1)%size,y1=(y+1)%size;
 const dx=(height[y*size+x1]-height[y*size+x0])/(2*pixel),dy=(height[y1*size+x]-height[y0*size+x])/(2*pixel),len=Math.hypot(dx,dy,1);
 data.set([Math.round((-.5*dx/len+.5)*255),Math.round((.5*dy/len+.5)*255),Math.round((.5/len+.5)*255)],i*3);
 }return {data,width:size,height:size}}
function close(data,channels){for(let y=0;y<size;y++)for(let c=0;c<channels;c++)data[(y*size+size-1)*channels+c]=data[y*size*channels+c];for(let x=0;x<size;x++)for(let c=0;c<channels;c++)data[((size-1)*size+x)*channels+c]=data[x*channels+c];return data}
const summaries=[];
for(const [index,id]of ['clean','stained','cracked','patched','clean-b','stained-b','cracked-b','patched-b'].entries()){
 const condition=id.replace(/-b$/, ''),pass=index>=4?2:1;
 const source=path.join(root,`sources/street-variants/${id}.png`),base=await rgb(source),lum=luminance(base),soft=wrapBlur(lum,2),large=wrapBlur(lum,14);
 const mean=lum.data.reduce((a,b)=>a+b,0)/count,target=[.53,.515,.525,.53][index%4];
 const height=new Float32Array(count),rough=new Float32Array(count),ao=new Float32Array(count).fill(1);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,u=x/(size-1),v=y/(size-1),edge=apron(i);
  const bi=((y+index*157)%size)*size+(x+index*271)%size,fi=((y*7+index*113)%size)*size+(x*7+index*67)%size;
  const smudge=smooth(.2,.8,broad[bi]),finger=fine[fi];
  height[i]=(soft.data[i]-large.data[i])*.0002+(lum.data[i]-soft.data[i])*.00008;
  rough[i]=[.40,.34,.43,.43][index%4]+smudge*[.19,.29,.19,.19][index%4]+(finger-.5)*.035;
  if(condition==='stained')rough[i]-=smooth(.035,.11,large.data[i]-soft.data[i])*.10;
  if(condition==='cracked'){
   const region=pass===1?(1-smooth(.025,.09,Math.abs(v-(.80-.59*u))))*smooth(.1,.18,u)*(1-smooth(.70,.80,u)):(1-smooth(.025,.085,Math.abs(u-(.14+.5*v))))*smooth(.10,.19,v)*(1-smooth(.8,.9,v));
   const fracture=region*smooth(.012,.05,large.data[i]-soft.data[i]);height[i]-=fracture*.00022;rough[i]+=fracture*.2;ao[i]-=fracture*.16;
  }
  if(condition==='patched'){
   const patch=pass===1?1-smooth(.86,1.04,Math.pow(Math.abs((u-.77)/.123),8)+Math.pow(Math.abs((v-.753)/.15),8)):1-smooth(.86,1.04,Math.pow(Math.abs((u-.264)/.197),8)+Math.pow(Math.abs((v-.235)/.06),8));
   rough[i]=rough[i]*(1-patch)+(.72+smudge*.1)*patch;height[i]+=patch*(soft.data[i]-large.data[i])*.0005;
  }
  // Shared physical border preserves the existing joint/anchor arrangement.
  for(let c=0;c<3;c++)base.data[i*3+c]=Math.round(clamp((base.data[i*3+c]/255+(target-mean))*(1-edge)+common.basecolor.data[i*3+c]/255*edge)*255);
  rough[i]=clamp(rough[i]*(1-edge)+common.roughness[i]*edge,.2,.92);
 }
 const normal=normals(height),heightMap=new Float32Array(count);
 for(let i=0;i<count;i++){
  const edge=apron(i);heightMap[i]=clamp((.5+height[i]/.006)*(1-edge)+common.height[i]*edge);ao[i]=ao[i]*(1-edge)+common.ao[i]*edge;
  let n=[0,0,0];for(let c=0;c<3;c++)n[c]=(normal.data[i*3+c]/127.5-1)*(1-edge)+(common.normal.data[i*3+c]/127.5-1)*edge;
  const len=Math.hypot(...n);for(let c=0;c<3;c++)normal.data[i*3+c]=Math.round((n[c]/len*.5+.5)*255);
 }
 const maps={basecolor:base,normal,roughness:gray(rough),height:gray(heightMap),ao:gray(ao),metallic:gray(new Float32Array(count))};
 const dir=path.join(out,'prepared',id);fs.mkdirSync(dir,{recursive:true});const sourceMaps={};
 for(const[channel,img]of Object.entries(maps)){
  const channels=['basecolor','normal'].includes(channel)?3:1;close(img.data,channels);sourceMaps[channel]=path.join(dir,channel+'.png');
  fs.writeFileSync(sourceMaps[channel],await(channels===3?encodeRgbPng(img):encodeGrayPng(img)));
 }
 const variantId='slab-'+condition+'-'+pass;
 const request={key:'cyberpunk/street-sidewalk/mid',variantId,append:true,alignment:'tile',description:`Independent generated photographic source for ${id} precast slab, sealed pedestrian finish; common structural border and separately authored wear response`,resolution:[size,size],tiling:{worldSize:world},layout:{family:'panel',moduleSize:world,jointWidth:.006,origin:[0,0],orientation:'horizontal'},physical:{roughnessFactor:1,metallicFactor:0},sourceMaps};
 const requestFile=path.join(out,id+'.json');fs.writeFileSync(requestFile,JSON.stringify(request,null,2)+'\n');
 const exists=JSON.parse(fs.readFileSync(path.join(themes,'cyberpunk/theme.json'))).entries[request.key]?.variants.some(v=>v.id===variantId);
 const imported=exists?{status:0,stdout:'existing variant retained'}:spawnSync(process.execPath,[path.join(root,'dist/cli/pbrforge.js'),'create',requestFile,'--native','--themes',themes],{encoding:'utf8',cwd:root});
 if(imported.status!==0)throw Error(imported.stdout+'\n'+imported.stderr);
 const resolved=spawnSync(process.execPath,[path.join(root,'dist/cli/pbrforge.js'),'resolve',request.key,'--themes',themes],{encoding:'utf8',cwd:root});if(resolved.status!==0)throw Error(resolved.stdout);
 const entry=JSON.parse(resolved.stdout).data.entry,variant=entry.variants.find(v=>v.id===variantId);
 summaries.push({id,condition,key:request.key,variant:variantId,source:path.relative(root,source),sourceSha256:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),worldSize:world,resolution:variant.resolution,maps:variant.maps});
 console.log('Imported and resolved',variantId);
}
fs.writeFileSync(path.join(root,'sources/street-variants/catalog.json'),JSON.stringify(summaries,null,2)+'\n');
