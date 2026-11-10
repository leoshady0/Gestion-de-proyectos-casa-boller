import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||8090);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT debe ser un puerto valido.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let file;try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=path.resolve(root,'.'+(name==='/'?'/index.html':name));}catch{res.writeHead(400);res.end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.stat(file,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404);res.end('Archivo no encontrado');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':stat.size});
  if(req.method==='HEAD'){res.end();return;}const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
 });
});
server.on('error',e=>{console.error('No se pudo iniciar el servidor:',e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`FORJA local: http://127.0.0.1:${port}\nCtrl+C para detener. Este servidor solo acepta conexiones de este equipo.`));

