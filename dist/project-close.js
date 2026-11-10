const projectCloseSection=document.createElement('section');projectCloseSection.className='project-close';projectCloseSection.hidden=true;document.querySelector('.intro').after(projectCloseSection);
function drawProjectClose(){
 const project=data.projects.find(p=>p.id===selected);projectCloseSection.hidden=!project;if(!project)return;
 const tasks=data.tasks.filter(t=>t.project===project.id),completed=tasks.filter(t=>t.status==='done').length,ready=projectCanClose(tasks);
 projectCloseSection.innerHTML=`<div><h2>${ready?'✓ Proyecto completado':'Cierre del proyecto'}</h2><p>${ready?'Descargá el informe general con los registros actuales.':tasks.length?`${completed} de ${tasks.length} tareas completadas. El PDF se habilita al completar todas.`:'Agregá y completá las tareas para habilitar el informe.'}</p></div><button class="primary" id="projectClosePDF" ${ready?'':'disabled'}>↓ Descargar cierre en PDF</button><span class="project-close-error" role="status"></span>`;
}
const renderBeforeProjectClose=render;render=function(){renderBeforeProjectClose();drawProjectClose()};drawProjectClose();
// Read one evidence record at a time; keep file metadata, never copy blobs into the PDF.
async function closeEvidenceMetadata(projectId,taskIds){const db=await evidenceDB;return new Promise((resolve,reject)=>{const result=[],tx=db.transaction('files','readonly'),request=tx.objectStore('files').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const f=cursor.value;if(f.costProjectId===projectId||taskIds.has(f.taskId))result.push({name:f.name,taskId:f.taskId,costProjectId:f.costProjectId,costType:f.costType,costEntryId:f.costEntryId});cursor.continue()};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
projectCloseSection.addEventListener('click',async event=>{
 const button=event.target.closest('#projectClosePDF');if(!button||button.disabled)return;
 const pid=selected,project=structuredClone(data.projects.find(p=>p.id===pid)),tasks=structuredClone(data.tasks.filter(t=>t.project===pid));if(!projectCanClose(tasks))return;
 button.disabled=true;button.textContent='Preparando PDF…';const status=projectCloseSection.querySelector('[role="status"]');status.textContent='';
 try{
  const results=await Promise.allSettled([documentRead('documents',pid,'projectId'),closeEvidenceMetadata(pid,new Set(tasks.map(t=>t.id)))]);
  const documents=results[0].status==='fulfilled'?results[0].value:[],files=results[1].status==='fulfilled'?results[1].value:[],warnings=[];
  if(results[0].status==='rejected')warnings.push('No se pudo consultar la biblioteca de documentos en este navegador.');
  if(results[1].status==='rejected')warnings.push('No se pudieron consultar las evidencias ni los comprobantes adjuntos en este navegador.');
  const liveTasks=data.tasks.filter(t=>t.project===pid);if(!data.projects.some(p=>p.id===pid)||!projectCanClose(liveTasks))throw Error('El proyecto cambió. Revisá las tareas antes de descargar el cierre.');
  const bytes=projectClosePDF(project,tasks,documents.filter(d=>!d.trashedAt),files,new Date(),warnings),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=url;link.download='cierre-proyecto-'+(project.name.replace(/[^\p{L}\p{N}-]/gu,'-').slice(0,80)||'proyecto')+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Informe general de cierre descargado');if(warnings.length)status.textContent='PDF generado con advertencias: no se pudieron consultar algunos adjuntos. El detalle figura en el informe.';
 }catch(error){console.error('No se pudo generar el informe de cierre:',error);status.textContent=error.message?.startsWith('El proyecto')?error.message:'No se pudo generar el cierre. Revisá el acceso a documentos y evidencias e intentá nuevamente.'}
 finally{if(button.isConnected){button.disabled=!projectCanClose(data.tasks.filter(t=>t.project===pid));button.textContent='↓ Descargar cierre en PDF'}}
});
