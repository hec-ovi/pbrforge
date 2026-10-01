// All writes use the native public CLI; --themes is mandatory, with no bundled database default.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const stage=path.dirname(fileURLToPath(import.meta.url)),checkout=path.resolve(stage,'../..'),i=process.argv.indexOf('--themes');
if(i<0||!process.argv[i+1])throw Error('Explicit --themes /absolute/staged/database is required');
const themes=path.resolve(process.argv[i+1]),cli=process.env.PBRFORGE_CLI??path.join(checkout,'dist/cli/pbrforge.js');
const call=args=>{const r=spawnSync(process.execPath,[cli,...args,'--themes',themes],{cwd:stage,encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);return JSON.parse(r.stdout);};
const requests=JSON.parse(fs.readFileSync(path.join(stage,'portable-publish-requests.json'))),seen=new Map(),logs=[];
for(const request of requests){if(!seen.has(request.key)){const result=spawnSync(process.execPath,[cli,'resolve',request.key,'--themes',themes],{encoding:'utf8'});const envelope=JSON.parse(result.stdout);if(result.status!==0&&!['E_KEY_NOT_FOUND','E_THEME_NOT_FOUND'].includes(envelope.error?.code))throw Error(result.stdout);seen.set(request.key,result.status===0);}
const concrete={...request,append:seen.get(request.key),sourceMaps:Object.fromEntries(Object.entries(request.sourceMaps).map(([k,v])=>[k,path.resolve(stage,v)]))};
const file=path.join(stage,'requests','active-import.json');fs.writeFileSync(file,JSON.stringify(concrete,null,2)+'\n');logs.push(call(['create',file,'--native']));seen.set(request.key,true);console.log('imported',request.key+'#'+request.variantId);}
for(const key of seen.keys())logs.push(call(['resolve',key]));
fs.writeFileSync(path.join(stage,'publish-log.json'),JSON.stringify({themes,cli,logs},null,2)+'\n');
