import {execFileSync,spawnSync} from 'node:child_process';
import {check,root} from './check.mjs';
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const run=args=>{const p=spawnSync('git',args,{cwd:root,stdio:'inherit',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});if(p.status!==0)throw Error('Git no completo la operacion. Revisar autenticacion o divergencias; no se forzaron cambios.');};
const command=process.argv[2];
try{
 const branch=git(['branch','--show-current']);if(!branch)throw Error('Selecciona una rama antes de sincronizar.');
 if(command==='status'){console.log('Rama:',branch);console.log(git(['status','--short','--branch']));console.log('Remotos configurados:',git(['remote'])||'(ninguno)');process.exit(0);}
 if(!['pull','push'].includes(command))throw Error('Usar status, pull o push.');
 const remotes=git(['remote']).split('\n');if(!remotes.includes('origin'))throw Error('Falta origin. Configuralo con la URL HTTPS del repositorio privado aprobado.');
 const remote=git(['remote','get-url','origin']),url=new URL(remote);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['github.com','dev.azure.com'].includes(url.hostname))throw Error('origin debe ser HTTPS de GitHub o Azure DevOps, sin credenciales en la URL.');
 if(command==='pull'){
  if(git(['status','--porcelain']))throw Error('Hay cambios locales. Guardalos en un commit antes de traer cambios. No se sobrescribio ningun archivo.');
  run(['pull','--ff-only','origin',branch]);
 }else{
  if(!process.argv.includes('--confirm-upload'))throw Error('La subida necesita aprobacion explicita: agregar --confirm-upload solo tras autorizar el destino y el contenido.');
  check();
  if(git(['status','--porcelain']))throw Error('Primero revisa git diff, selecciona archivos y crea un commit. Este comando no agrega ni confirma archivos automaticamente.');
  run(['push','--set-upstream','origin',branch]);
 }
}catch(e){console.error(e.message);process.exitCode=1;}

