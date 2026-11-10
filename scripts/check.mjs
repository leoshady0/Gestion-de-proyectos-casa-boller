import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function check(){
 const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 const forbidden=/(^|\/)(?:\.openai|\.env(?:\..*)?|\.aws|\.ssh|\.azure|node_modules|uploads|attachments|data|backups)(\/|$)|\.(?:pdf|docx?|xlsx?|eml|msg|pem|key|pfx|p12|sqlite\w*|db|zip|bundle|tar|gz)$/i;
 const corp=new RegExp('casa[\\s_-]*'+'bo'+'ller','i');
 const secret=/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|art_v2_[A-Za-z0-9_]{15,})\b/;
 for(const file of [...new Set(files)]){
  if(forbidden.test(file))throw Error('Archivo excluido detectado: '+file);
  const abs=path.join(root,file);if(!fs.existsSync(abs))continue;const text=fs.readFileSync(abs,'utf8');
  if(corp.test(text)||secret.test(text))throw Error('Posible informacion sensible en '+file+'; revisar localmente sin publicar su contenido.');
  if(/\.(?:js|mjs)$/.test(file))execFileSync(process.execPath,['--check',abs],{stdio:'pipe'});
 }
 const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const resource=match[1];if(/^(https?:|data:)/.test(resource))continue;const resolved=path.resolve(root,'dist',resource);if(!resolved.startsWith(path.join(root,'dist')+path.sep)||!fs.existsSync(resolved))throw Error('Recurso local ausente: '+resource);}
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(pkg.private!==true)throw Error('package.json debe declarar private=true.');
 console.log('Sintaxis, recursos locales y revision preventiva: OK. No reemplaza una auditoria de secretos.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)check();

