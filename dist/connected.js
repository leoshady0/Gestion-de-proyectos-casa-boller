'use strict';
const q=selector=>document.querySelector(selector);
const state={user:null,csrf:null,page:'home',projectId:null,tab:'tasks',projects:[],tasks:[],directory:[],users:[],requests:[],records:{},query:'',priority:'',generation:0};
const scheduleDrafts=new Map();
const roleNames={admin:'Administrador',responsable:'Responsable de proyectos',consulta:'Gerencia / Consultor'};
const statuses={todo:'Por hacer',doing:'En curso',done:'Completada'};
const editable=()=>['admin','responsable'].includes(state.user?.role);
const admin=()=>state.user?.role==='admin';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=escapeHTML;
const fmtDate=value=>value?new Date(value.length===10?value+'T12:00:00':Number.isNaN(Number(value))?value:Number(value)).toLocaleDateString('es'):'Sin fecha';
const projectById=id=>state.projects.find(p=>p.id===id);
const projectTasks=id=>state.tasks.filter(t=>t.project_id===id);
const username=id=>state.directory.find(u=>u.id===id)?.name||'Sin asignar';
let toastTimer,editorSubmit;
function toast(message){clearTimeout(toastTimer);q('#connected-toast').textContent=message;q('#connected-toast').style.display='block';toastTimer=setTimeout(()=>q('#connected-toast').style.display='none',4000)}
function showLogin(){scheduleDrafts.clear();state.generation++;Object.assign(state,{user:null,csrf:null,projects:[],tasks:[],directory:[],users:[],requests:[],records:{},projectId:null,page:'home'});q('#connected-app').hidden=true;q('#login-screen').hidden=false;q('#page').replaceChildren();q('#user-name').textContent='';q('#user-role').textContent='';q('#mobile-identity').textContent='';q('#desktop-nav').replaceChildren();q('#connected-mobile-nav').replaceChildren();q('#page-error').hidden=true;if(q('#editor').open)q('#editor').close();q('#editor-fields').replaceChildren();q('#login-form').elements.password.value='';}
async function api(method,route,body,fileHeaders){
 let response;try{response=await fetch('/api'+route,{method,credentials:'same-origin',headers:{...(fileHeaders??(body===undefined?{}:{'Content-Type':'application/json'})),...(state.csrf?{'X-CSRF-Token':state.csrf}:{})},body:fileHeaders||body===undefined?body:JSON.stringify(body)})}catch{throw Error('No se pudo conectar. Revisá que el servidor local esté en ejecución.');}
 const result=await response.json();if(!response.ok){if(response.status===401&&route!=='/login'){showLogin();q('#login-error').textContent='La sesión venció o fue revocada. Volvé a ingresar.';}const error=new Error(result.error||'No se pudo completar la operación.');error.status=response.status;throw error}return result;
}
function reportError(error){if(!state.user)return;q('#page-error').hidden=false;q('#page-error').textContent=error.message+(error.status===409?' Usá «Actualizar» para traer la versión más reciente.':'');}
async function reload(){
 const generation=++state.generation,userId=state.user?.id;if(!userId)return;q('#app-loading').hidden=false;q('#page-error').hidden=true;
 try{
  const [projects,directory,requests,users]=await Promise.all([api('GET','/projects'),api('GET','/directory'),editable()?api('GET','/requests'):[],admin()?api('GET','/users'):[]]);
  const tasks=(await Promise.all(projects.map(p=>api('GET',`/projects/${p.id}/tasks`)))).flat();
  if(generation!==state.generation||userId!==state.user?.id)return;
  Object.assign(state,{projects,directory,requests,users,tasks,records:{}});
  if(state.projectId&&!projectById(state.projectId)){state.projectId=null;state.page='projects';}
  render();if(state.page==='detail'&&state.tab!=='tasks')await loadRecord();if(state.page==='audit')await loadAudit();
 }finally{if(generation===state.generation)q('#app-loading').hidden=true;}
}
function progress(tasks){const done=tasks.filter(t=>t.status==='done').length,percent=tasks.length?Math.round(done/tasks.length*100):0;return {done,percent,tone:!tasks.length?'empty':percent===100?'complete':percent>=70?'advanced':percent>=30?'moving':'start',label:!tasks.length?'Sin tareas':percent===100?'Completado':percent>=70?'Cerca de terminar':percent>=30?'En progreso':percent?'Primeros avances':'Por comenzar'}}
function intro(title,description,actions=''){return `<section class="intro"><div><div class="eyebrow">EQUIPO. AVANCE. CONTROL.</div><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div>${actions?`<div class="intro-actions">${actions}</div>`:''}</section>`}
function actionButton(action,label,extra='',primary=false){return `<button ${primary?'class="primary"':''} data-action="${action}" ${extra}>${escapeHTML(label)}</button>`}
function render(){if(!state.user)return;
 q('#login-screen').hidden=true;q('#connected-app').hidden=false;q('#user-name').textContent=state.user.name;q('#user-role').textContent=roleNames[state.user.role];q('#mobile-identity').textContent=state.user.name+' · '+roleNames[state.user.role];
 const nav=[['home','⌂','Inicio'],['projects','▤','Proyectos'],['tasks','✓','Tareas'],...(editable()?[['requests','↗','Solicitudes']]:[]),...(admin()?[['users','♙','Usuarios']]:[])];
 const active=state.page==='detail'?'projects':state.page;
 q('#desktop-nav').innerHTML=nav.map(([page,icon,label])=>`<button data-action="navigate" data-page="${page}" class="${active===page?'active':''}" ${active===page?'aria-current="page"':''}>${icon} &nbsp; ${label}</button>`).join('')+(admin()?`<button data-action="navigate" data-page="audit" class="${active==='audit'?'active':''}">≡ &nbsp; Registro de cambios</button>`:'');
 q('#connected-mobile-nav').innerHTML=nav.map(([page,icon,label])=>`<button data-action="navigate" data-page="${page}" class="${active===page?'active':''}" ${active===page?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('');
 q('#breadcrumb').textContent=state.page==='detail'?projectById(state.projectId)?.name:({home:'Inicio',projects:'Proyectos',tasks:'Tareas',requests:'Solicitudes',users:'Usuarios',audit:'Registro de cambios'}[state.page]);
 q('#page').innerHTML=({home:homeView,projects:projectsView,tasks:tasksView,detail:detailView,requests:requestsView,users:usersView,audit:auditView}[state.page]||homeView)();
}
function projectCards(projects){return projects.map(p=>{const t=projectTasks(p.id),pr=progress(t);return `<article class="project progress-tone tone-${pr.tone}" role="button" tabindex="0" data-action="open-project" data-id="${attr(p.id)}"><div class="projecttop"><span class="projecticon">▤</span><span class="badge">${pr.label}</span></div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||'Sin descripción')}</p><div class="progresslabel"><span>Progreso del proyecto</span><b>${pr.percent}%</b></div><div class="progress" role="progressbar" aria-label="Progreso del proyecto" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pr.percent}"><div style="width:${pr.percent}%"></div></div><div class="projectbottom"><span>✓ ${pr.done} de ${t.length} tareas</span><span>◷ ${fmtDate(p.due_date)}</span></div></article>`}).join('')||'<p class="empty">Todavía no hay proyectos activos.</p>'}
function projectActions(){return editable()?actionButton('new-project',admin()?'＋ Nuevo proyecto':'＋ Solicitar proyecto','',true):''}
function homeView(){const pr=progress(state.tasks);return intro('Proyectos bajo control.','Tu equipo trabaja con la misma información, según los permisos de cada perfil.',projectActions())+`<section class="stats">${[['Proyectos',state.projects.length,'Proyectos activos'],['Tareas en curso',state.tasks.filter(t=>t.status==='doing').length,'Trabajo en movimiento'],['Completadas',pr.done,'Tareas finalizadas'],['Avance general',pr.percent+'%',pr.label]].map(([label,value,note],i)=>`<div class="stat stat-${i} ${i===3?'progress-tone tone-'+pr.tone:''}"><label>${label}</label><b>${value}</b><small>${note}</small>${i===3?`<div class="progress"><div style="width:${pr.percent}%"></div></div>`:''}</div>`).join('')}</section>${!editable()?'<p class="role-note">Acceso de consulta: podés revisar todos los proyectos y sus datos. Las modificaciones están reservadas a los perfiles autorizados.</p>':''}<div class="sectionhead"><h2>Proyectos en marcha</h2></div><div class="projects">${projectCards(state.projects)}</div>`}
function projectsView(){return intro('Todos los proyectos','Revisá el avance y abrí un proyecto para ver sus tareas, cronograma y costos.',projectActions())+`<div class="projects">${projectCards(state.projects)}</div>`}
function filters(){return `<div class="connected-filters"><input id="connected-search" type="search" aria-label="Buscar tareas" placeholder="Buscar una tarea…" value="${attr(state.query)}"><select id="connected-priority" aria-label="Filtrar prioridad">${[['','Todas las prioridades'],['Alta','Alta'],['Media','Media'],['Baja','Baja']].map(([v,label])=>`<option value="${v}" ${state.priority===v?'selected':''}>${label}</option>`).join('')}</select></div>`}
function taskCard(task){const p=projectById(task.project_id);return `<article class="connected-task ${task.status}"><div class="taskmeta"><span class="priority ${task.priority}">${escapeHTML(task.priority)}</span><span class="taskproject">${escapeHTML(p?.name)}</span></div><span class="connected-status">${statuses[task.status]}</span><h3>${escapeHTML(task.name)}</h3>${task.description?`<p>${escapeHTML(task.description)}</p>`:''}<p>◷ ${fmtDate(task.due_date)} · ${escapeHTML(username(task.owner_id))}</p>${editable()?`<div class="task-controls"><label>Estado de la tarea<select data-task-status="${attr(task.id)}" aria-label="Estado: ${attr(task.name)}">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${value===task.status?'selected':''}>${label}</option>`).join('')}</select></label>${actionButton('edit-task','Editar',`data-id="${attr(task.id)}"`)}</div>`:''}</article>`}
function matchingTasks(tasks){return tasks.filter(t=>t.name.toLowerCase().includes(state.query.toLowerCase())&&(!state.priority||t.priority===state.priority))}
function taskBoard(tasks){return `<div class="connected-kanban">${[['todo','Por hacer'],['doing','En proceso'],['done','Completado']].map(([status,title])=>{const rows=tasks.filter(t=>t.status===status);return `<section class="connected-status-column ${status}" aria-label="${title}"><div class="connected-column-head"><h3>${title}</h3><span aria-label="Cantidad de tareas">${rows.length}</span></div><div class="connected-task-list">${rows.map(taskCard).join('')}</div>${rows.length?'':'<p class="empty">Sin tareas en este estado.</p>'}</section>`}).join('')}</div>`}
function taskGroups(){const mobile=matchMedia('(max-width:780px)').matches;return state.projects.map(p=>{const all=projectTasks(p.id),matching=matchingTasks(all);if(!matching.length)return '';const visible=mobile?matching.slice(0,3):matching;return `<section class="connected-project-group"><h3>${escapeHTML(p.name)}</h3><p>${visible.length} de ${matching.length} tareas${all.length!==matching.length?' coincidentes con el filtro':''}</p>${taskBoard(visible)}${mobile&&all.length>3?`<button class="group-more" data-action="open-project" data-id="${attr(p.id)}">Ver más · ${all.length} tareas en el proyecto</button>`:''}</section>`}).join('')||'<p class="empty">No hay tareas que coincidan con la búsqueda.</p>'}
function tasksView(){return intro('Tareas por proyecto','Cada tarea con su proyecto, responsable y estado.',editable()&&state.projects.length?actionButton('new-task','＋ Añadir tarea','',true):'')+filters()+`<div id="task-groups" class="connected-task-groups">${taskGroups()}</div>`}
function detailView(){const p=projectById(state.projectId);if(!p)return '<p>Proyecto no disponible.</p>';const tasks=projectTasks(p.id),pr=progress(tasks);
 return actionButton('navigate','‹ Todos los proyectos','data-page="projects"')+intro(p.name,p.description||'Sin descripción',editable()?actionButton('edit-project','Editar proyecto')+actionButton('delete-project',admin()?'Archivar proyecto':'Solicitar eliminación'):'')+
 `<section class="project-close"><div><h2>${pr.percent===100&&tasks.length?'✓ Proyecto completado':'Cierre del proyecto'}</h2><p>${pr.done} de ${tasks.length} tareas completadas. ${pr.percent===100&&tasks.length?'Podés descargar el informe general.':'El informe se habilita cuando todas estén completadas.'}</p></div><button class="primary" data-action="closure" ${pr.percent!==100||!tasks.length?'disabled':''}>↓ Descargar cierre en PDF</button></section>`+
 `<div class="connected-tabs" role="group" aria-label="Secciones del proyecto">${[['tasks','Tareas'],['schedule','Cronograma'],['costs','Costos']].map(([key,label])=>`<button data-action="project-tab" data-tab="${key}" class="${key===state.tab?'primary':''}">${label}</button>`).join('')}</div>`+
 `<div id="project-panel">${state.tab==='tasks'?`${editable()?`<div class="sectionhead"><h2>Tareas del proyecto</h2>${actionButton('new-task','＋ Añadir tarea')}</div>`:'<p class="role-note">Vista de consulta. No se permite modificar las tareas.</p>'}${taskBoard(tasks)}`:recordView()}</div>`;
}
function recordView(){const kind=state.tab,record=state.records[kind];if(!record)return '<p role="status">Cargando registros…</p>';const value=record.payload;
 if(kind==='schedule')return scheduleView(record);
 const costs=value||{currency:'PYG',quotes:[],expenses:[],suppliers:[],conclusion:''},totals=costTotals(costs),money=n=>costMoney(n,costs.currency);
 return `<div class="sectionhead"><h2>Costos del proyecto</h2>${editable()?actionButton('new-expense','＋ Registrar gasto'):''}</div><div class="costStats">${[['Presupuesto aprobado',totals.budget],['Gasto incurrido',totals.actual],['Pagado',totals.paid],['Pendiente de pago',totals.pending]].map(([label,amount],index)=>`<div class="stat"><label>${label}</label><strong>${money(amount)}</strong>${index===0&&admin()?actionButton('edit-budget','Editar presupuesto'):''}</div>`).join('')}</div><section class="connected-summary"><h3>Gastos registrados</h3><div class="table-scroll"><table class="connected-table expenses-table"><thead><tr><th>Concepto</th><th>Proveedor</th><th>Importe</th><th>Pago</th><th>Comprobantes</th></tr></thead><tbody>${costs.expenses.map(x=>`<tr><td>${escapeHTML(x.concept)}</td><td data-label="Proveedor">${escapeHTML(x.supplier||"Sin proveedor")}</td><td data-label="Importe">${money(x.amount)}</td><td data-label="Pago">${escapeHTML(x.status)}</td><td data-label="Comprobantes">${expenseEvidence(x)}</td></tr>`).join('')||'<tr><td colspan="5">Sin gastos registrados.</td></tr>'}</tbody></table></div></section><section class="connected-summary"><div class="sectionhead"><h3>Conclusión</h3>${editable()?actionButton('conclusion','Editar'):''}</div><p>${escapeHTML(costs.conclusion||'Sin conclusión registrada.')}</p></section>`;
}
function expenseEvidence(expense){
 const files=(state.records.costs?.attachments??[]).filter(file=>file.expense_id===expense.id);
 const list=files.length?'<ul>'+files.map(file=>'<li><a download href="/api/projects/'+encodeURIComponent(state.projectId)+'/costs/attachments/'+encodeURIComponent(file.id)+'">'+escapeHTML(file.category+' · '+file.name)+'</a></li>').join('')+'</ul>':'<span>Sin comprobantes</span>';
 return '<div class="expense-evidence">'+list+(editable()?actionButton('attach-expense','Adjuntar comprobante','data-expense-id="'+attr(expense.id)+'"'):'')+'</div>';
}
function requestsView(){return intro('Solicitudes de proyectos',admin()?'Revisá las solicitudes del equipo antes de autorizarlas.':'Consultá el estado de tus solicitudes de creación y eliminación.',actionButton('new-project','＋ Solicitar proyecto','',true))+state.requests.slice().reverse().map(r=>{const p=JSON.parse(r.payload),name=r.kind==='create'?p.name:projectById(r.project_id)?.name||'Proyecto archivado';return `<article class="request-card"><div class="sectionhead"><h3>${r.kind==='create'?'Crear proyecto':'Eliminar proyecto'} · ${escapeHTML(name)}</h3><span class="request-status ${r.status}">${{pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada'}[r.status]}</span></div><p>${escapeHTML(r.reason)}</p><p>Solicitó: ${escapeHTML(username(r.requested_by))} · ${fmtDate(r.created_at)}</p>${r.review_note?`<p>Respuesta: ${escapeHTML(r.review_note)}</p>`:''}${r.kind==='create'&&p.description?`<p>${escapeHTML(p.description)}</p>`:''}${admin()&&r.status==='pending'?`<div class="request-actions">${actionButton('review-request','Aprobar',`data-id="${attr(r.id)}" data-decision="approve"`,true)}${actionButton('review-request','Rechazar',`data-id="${attr(r.id)}" data-decision="reject"`)}</div>`:''}</article>`}).join('')+(state.requests.length?'':'<p class="empty">No hay solicitudes registradas.</p>')}
function usersView(){return intro('Usuarios y permisos','Solo el administrador puede crear cuentas y modificar permisos.',actionButton('new-user','＋ Nuevo usuario','',true))+state.users.map(u=>`<article class="user-card"><div class="sectionhead"><h3>${escapeHTML(u.name)}</h3><span class="badge">${u.active?'Activo':'Desactivado'}</span></div><p>${escapeHTML(u.email)}</p><p>${roleNames[u.role]}</p>${actionButton('edit-user','Editar permisos',`data-id="${attr(u.id)}"`)}</article>`).join('')}
function auditView(){return intro('Registro de cambios','Acciones registradas por el servidor, con el usuario y la fecha.')+'<div id="audit-list"><p role="status">Cargando historial…</p></div>'}
async function loadAudit(){const rows=await api('GET','/audit');if(state.page!=='audit'||!state.user)return;q('#audit-list').innerHTML=rows.map(r=>`<article class="audit-card"><b>${escapeHTML(r.action)}</b><p>${escapeHTML(username(r.actor_id))} · ${new Date(Number(r.created_at)).toLocaleString('es')}</p><p>${escapeHTML(r.entity_type)} · ${escapeHTML(r.entity_id)}</p></article>`).join('')||'<p class="empty">Sin eventos.</p>'}
async function loadRecord(){const pid=state.projectId,kind=state.tab;if(!['costs','schedule'].includes(kind))return;const record=await api('GET',`/projects/${pid}/${kind}`);if(pid!==state.projectId||state.tab!==kind||!state.user)return;state.records[kind]=record;q('#project-panel').innerHTML=recordView();}
function input(name,label,value='',options=''){return `<label>${escapeHTML(label)}<input name="${name}" value="${attr(value)}" ${options}></label>`}
function textarea(name,label,value='',options=''){return `<label>${escapeHTML(label)}<textarea name="${name}" rows="3" ${options}>${escapeHTML(value)}</textarea></label>`}
function select(name,label,choices,current){return `<label>${escapeHTML(label)}<select name="${name}">${choices.map(([value,text])=>`<option value="${attr(value)}" ${value===current?'selected':''}>${escapeHTML(text)}</option>`).join('')}</select></label>`}
function showEditor(title,html,onSubmit,label='Guardar'){
 q('#editor-title').textContent=title;q('#editor-fields').innerHTML=html;q('#editor-error').textContent='';q('#editor-submit').textContent=label;editorSubmit=onSubmit;q('#editor').showModal();
}
function projectEditor(existing){const request=!existing&&(!admin()||state.page==='requests');showEditor(existing?'Editar proyecto':request?'Solicitar un proyecto':'Nuevo proyecto',input('name','Nombre',existing?.name||'','required maxlength="160"')+textarea('description','Descripción',existing?.description||'','maxlength="5000"')+input('due_date','Fecha de entrega prevista',existing?.due_date||'','type="date"')+(request?textarea('reason','Motivo de la solicitud','','required maxlength="2000"'):''),async f=>{const project={name:f.name.value.trim(),description:f.description.value.trim(),due_date:f.due_date.value};if(existing)await api('PATCH',`/projects/${existing.id}`,{...project,version:existing.version});else if(request)await api('POST','/requests',{kind:'create',project,reason:f.reason.value.trim()});else await api('POST','/projects',project);return existing?'Proyecto actualizado':request?'Solicitud enviada al administrador':'Proyecto creado';},request?'Enviar solicitud':'Guardar');}
function taskEditor(existing){const pid=existing?.project_id||state.projectId||state.projects[0]?.id;if(!pid)throw Error('Primero debe existir un proyecto autorizado.');
 showEditor(existing?'Editar tarea':'Nueva tarea',(existing?'':select('project_id','Proyecto',state.projects.map(p=>[p.id,p.name]),pid))+input('name','Nombre',existing?.name||'','required maxlength="160"')+textarea('description','Descripción',existing?.description||'','maxlength="5000"')+select('status','Estado',Object.entries(statuses),existing?.status||'todo')+select('priority','Prioridad',[['Alta','Alta'],['Media','Media'],['Baja','Baja']],existing?.priority||'Media')+select('owner_id','Responsable',[['','Sin asignar'],...state.directory.map(u=>[u.id,u.name])],existing?.owner_id||'')+input('due_date','Fecha de entrega',existing?.due_date||'','type="date"'),async f=>{const body={name:f.name.value.trim(),description:f.description.value.trim(),status:f.status.value,priority:f.priority.value,owner_id:f.owner_id.value||null,due_date:f.due_date.value};if(existing)await api('PATCH',`/tasks/${existing.id}`,{...body,version:existing.version});else await api('POST',`/projects/${f.project_id.value}/tasks`,body);return 'Tarea guardada';});}
function deleteProjectEditor(){const project=projectById(state.projectId);showEditor(admin()?'Archivar proyecto':'Solicitar eliminación',`<p class="field-note">${admin()?'El proyecto saldrá de la lista activa. Sus registros se conservarán.':'La solicitud deberá ser aprobada por un administrador. Hasta entonces el proyecto seguirá activo.'}</p>`+textarea('reason','Motivo','','required maxlength="2000"'),async f=>{if(admin())await api('DELETE',`/projects/${project.id}`,{version:project.version,reason:f.reason.value.trim()});else await api('POST','/requests',{kind:'delete',project_id:project.id,reason:f.reason.value.trim()});return admin()?'Proyecto archivado':'Solicitud de eliminación enviada';},admin()?'Archivar proyecto':'Enviar solicitud');}
function userEditor(existing){showEditor(existing?'Editar permisos':'Nuevo usuario',input('name','Nombre',existing?.name||'','required maxlength="120"')+(existing?`<p class="field-note">${escapeHTML(existing.email)}</p>`:input('email','Correo','','required type="email" autocomplete="off"'))+select('role','Perfil',Object.entries(roleNames),existing?.role||'consulta')+(existing?select('active','Estado',[['true','Activo'],['false','Desactivado']],String(existing.active)):'')+input('password',existing?'Nueva contraseña (opcional)':'Contraseña inicial','','type="password" autocomplete="new-password" minlength="14" maxlength="128" '+(existing?'':'required'))+'<p class="field-note">Al cambiar permisos, estado o contraseña se revocan las sesiones del usuario. Debe quedar un administrador activo.</p>',async f=>{const body={name:f.name.value.trim(),role:f.role.value};if(existing){Object.assign(body,{version:existing.version,active:f.active.value==='true'});if(f.password.value)body.password=f.password.value;await api('PATCH',`/users/${existing.id}`,body)}else await api('POST','/users',{...body,email:f.email.value.trim(),password:f.password.value});return existing?'Usuario actualizado':'Usuario creado';});}
function requestEditor(button){const request=state.requests.find(r=>r.id===button.dataset.id),approve=button.dataset.decision==='approve';showEditor(approve?'Aprobar solicitud':'Rechazar solicitud',`<p>${escapeHTML(request.reason)}</p>`+textarea('note','Respuesta al solicitante','','maxlength="2000"'),async f=>{await api('POST',`/requests/${request.id}/${approve?'approve':'reject'}`,{note:f.note.value.trim()});return approve?'Solicitud aprobada':'Solicitud rechazada';},approve?'Aprobar':'Rechazar');}
function costPayload(){return structuredClone(state.records.costs?.payload||{currency:'PYG',quotes:[],expenses:[],suppliers:[],conclusion:''})}
async function saveCosts(payload,version=state.records.costs?.version??0){await api('PUT',`/projects/${state.projectId}/costs`,{version,payload})}
function budgetEditor(){
 const costs=costPayload(),version=state.records.costs?.version??0;
 showEditor('Editar presupuesto aprobado',input('amount','Presupuesto aprobado ('+costs.currency+')',costTotals(costs).budget,'type="number" min="0" max="1000000000000" step="0.01" required'),async f=>{
  costs.approvedBudget=f.amount.valueAsNumber;
  await saveCosts(costs,version);
  return 'Presupuesto aprobado actualizado';
 });
}
function expenseEvidenceEditor(expenseId){
 const projectId=state.projectId;
 const expense=state.records.costs?.payload?.expenses.find(row=>row.id===expenseId);
 if(!expense)return;
 showEditor('Adjuntar comprobante',
  '<p>'+escapeHTML(expense.concept)+'</p>'+
  select('category','Tipo de comprobante',[['Comparativo','Comparativo'],['Factura','Factura'],['Otro','Otro']],'Factura')+
  '<label>Archivo<input name="evidence" type="file" accept=".pdf,.xlsx,.xls" required></label>'+
  '<p class="field-note">PDF o Excel (.xlsx o .xls), hasta 10 MB por archivo.</p>',async f=>{
   const file=f.evidence.files[0];
   if(!file||!file.size)throw Error('Elegí un archivo que no esté vacío.');
   if(file.size>10*1024*1024)throw Error('El archivo supera el límite de 10 MB.');
   await api('POST','/projects/'+projectId+'/costs/attachments',file,{
    'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name),
    'X-Expense-Id':encodeURIComponent(expenseId),'X-File-Category':f.category.value
   });
   return 'Comprobante guardado';
  },'Adjuntar archivo');
}
function expenseEditor(){const costs=costPayload();showEditor('Registrar gasto',input('concept','Concepto','','required maxlength="160"')+input('supplier','Proveedor','','maxlength="120"')+input('amount','Importe ('+costs.currency+')','','type="number" min="0.01" max="1000000000000" step="0.01" required')+input('date','Fecha',new Date().toLocaleDateString('en-CA'),'type="date" required')+select('category','Tipo',[['Base','Base'],['Adicional','Adicional']],'Base')+select('status','Pago',[['Pendiente','Pendiente'],['Pagado','Pagado']],'Pendiente')+input('invoice','Número de factura','','maxlength="80"')+textarea('notes','Notas','','maxlength="2000"'),async f=>{costs.expenses.push({id:crypto.randomUUID(),concept:f.concept.value.trim(),supplier:f.supplier.value.trim(),amount:Number(f.amount.value),date:f.date.value,category:f.category.value,status:f.status.value,invoice:f.invoice.value.trim(),notes:f.notes.value.trim()});await saveCosts(costs);return 'Gasto guardado';});}
const scheduleDayMs=86400000;
const ganttStatuses={todo:'Por iniciar',doing:'En curso',done:'Completada',delayed:'Atrasada'};
const scheduleIncidentTypes={delay:'Atraso',incident:'Incidencia',rain:'Lluvia',change:'Cambio',note:'Nota'};
function scheduleDate(start,day){
 return new Date(Date.parse(start+'T00:00:00Z')+(day-1)*scheduleDayMs).toISOString().slice(0,10);
}
function scheduleDayIndex(start,date){
 return (Date.parse(date+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/scheduleDayMs+1;
}
function ganttSegments(days){
 const segments=[];
 for(const day of [...days].sort((a,b)=>a-b)){
  const last=segments.at(-1);
  if(last&&day===last.end+1)last.end=day;
  else segments.push({start:day,end:day});
 }
 return segments;
}
function ganttPosition(segment,total){
 return `left:${(segment.start-1)/total*100}%;width:${(segment.end-segment.start+1)/total*100}%`;
}
const ganttScales={day:{label:'Día',width:40},week:{label:'Semana',width:16},month:{label:'Mes',width:6}};
let ganttScale='week';
const ganttMonthFormat=new Intl.DateTimeFormat('es',{month:'short',year:'numeric',timeZone:'UTC'});
function ganttPeriods(schedule){
 const periods=[];
 for(let day=1;day<=schedule.calendarDays;day++){
  const iso=scheduleDate(schedule.start,day),date=new Date(iso+'T00:00:00Z');
  if(day===1||ganttScale==='day'||(ganttScale==='week'&&date.getUTCDay()===1)||(ganttScale==='month'&&date.getUTCDate()===1)){
   const label=ganttScale==='month'?ganttMonthFormat.format(date):iso.slice(8)+'/'+iso.slice(5,7);
   periods.push({start:day,label});
  }
 }
 return periods.map((period,index)=>({...period,end:(periods[index+1]?.start??schedule.calendarDays+1)-1}));
}
function ganttView(schedule){
 if(!schedule.start)return '<p>Definí la fecha de inicio para ver el Gantt.</p>';
 if(!schedule.rows.length)return '<p>Todavía no hay actividades programadas.</p>';
 const total=schedule.calendarDays;
 const dayWidth=ganttScales[ganttScale].width;
 const periods=ganttPeriods(schedule);
 const axis=periods.map(period=>`<span title="${attr(period.label)}" style="${ganttPosition(period,total)}">${escapeHTML(period.label)}</span>`).join('');
 const dividers=periods.slice(1).map(period=>`<span class="gantt-divider" aria-hidden="true" style="left:${(period.start-1)/total*100}%"></span>`).join('');
 const rows=ForjaCalendar.scheduleGroupedRows(schedule.rows).map(row=>{
  if(row.group){
   const name=escapeHTML(row.name);
   const label=editable()?actionButton('edit-schedule-group',row.name,`data-id="${attr(row.id)}" aria-label="Editar rubro ${attr(row.name)}"`):name;
   return `<div class="gantt-group">${label}</div>`;
  }
  const status=Object.hasOwn(ganttStatuses,row.status)?row.status:'todo';
  const segments=ganttSegments(row.activeDays);
  const dateLabel=segments.length?`${fmtDate(scheduleDate(schedule.start,segments[0].start))} – ${fmtDate(scheduleDate(schedule.start,segments.at(-1).end))}`:'Sin fechas';
  const activity=`<strong>${escapeHTML(row.name)}</strong><small>${dateLabel}</small><small>${row.activeDays.length} días programados · ${ganttStatuses[status]}</small>`;
  const label=editable()?`<button type="button" class="gantt-name-button" data-action="edit-schedule" data-id="${attr(row.id)}" aria-label="Editar ${attr(row.name)}">${activity}</button>`:activity;
  const bars=segments.map((segment,index)=>{
   const style=ganttPosition(segment,total);
   const description=`${row.name}: ${fmtDate(scheduleDate(schedule.start,segment.start))} – ${fmtDate(scheduleDate(schedule.start,segment.end))} · ${ganttStatuses[status]}`;
   if(!editable())return `<span class="gantt-bar" role="img" aria-label="${attr(description)}" title="${attr(description)}" style="${style}"></span>`;
   const left=index===0?'<span class="gantt-handle start" data-edge="start" aria-hidden="true"></span>':'';
   const right=index===segments.length-1?'<span class="gantt-handle end" data-edge="end" aria-hidden="true"></span>':'';
   return `<button type="button" class="gantt-bar" data-action="edit-schedule" data-id="${attr(row.id)}" aria-label="Editar ${attr(description)}" title="${attr(description)}" style="${style}">${left}${right}</button>`;
  }).join('');
  const markers=schedule.incidents.filter(event=>event.activityId===row.id).map(event=>{
   const day=scheduleDayIndex(schedule.start,event.date);
   if(!Number.isInteger(day)||day<1||day>total)return '';
   const description=`${scheduleIncidentTypes[event.type]||'Incidencia'} · ${fmtDate(event.date)} · ${event.text}`;
   return `<span class="gantt-incident-marker" style="left:${(day-0.5)/total*100}%" role="img" aria-label="${attr(description)}" title="${attr(description)}"></span>`;
  }).join('');
  return `<div class="gantt-row gantt-state-${status}"><div class="gantt-name">${label}</div><div class="gantt-track">${bars}${markers}</div></div>`;
 }).join('');
 const legend=Object.entries(ganttStatuses).map(([status,label])=>`<span class="gantt-state-${status}"><i aria-hidden="true"></i>${label}</span>`).join('');
 return `${editable()?'<p class="gantt-help">Seleccioná una actividad para editar fechas y estado.<span class="gantt-mouse-help"> Arrastrá una barra para moverla o sus extremos para ajustar la duración.</span></p>':''}
 <div class="gantt-legend" aria-label="Estados de actividad">${legend}<span><i class="incident-key" aria-hidden="true"></i>Incidencia</span></div>
 <div class="gantt-scroll" tabindex="0" aria-label="Cronograma de Gantt">
  <div class="gantt-chart" style="--gantt-width:${total*dayWidth}px">
   <div class="gantt-guides" aria-hidden="true">${dividers}</div>
   <div class="gantt-row gantt-heading"><div class="gantt-name">Actividad</div><div class="gantt-axis" aria-hidden="true">${axis}</div></div>
   ${rows}
  </div>
 </div>`;
}
function scheduleView(record){
 const draft=scheduleDrafts.get(state.projectId), schedule=draft?.payload??record.payload;
 const saving=ganttSaving?'disabled':'';
 const stale=draft&&draft.version!==record.version;
 const actions=editable()?actionButton('schedule-settings',schedule?'Editar período':'Crear cronograma')
  +(schedule?.start?actionButton('edit-schedule-group','Agregar rubro')+actionButton('edit-schedule','Agregar actividad'):'')
  +(schedule?actionButton('save-schedule',ganttSaving?'Guardando…':'Guardar cronograma',draft&&!stale?saving:'disabled',true):''):'';
 const header=`<div class="sectionhead"><h2>Cronograma</h2><div class="schedule-actions">${actions}</div></div>`;
 const history=(record.history||[]).map(entry=>{
  const download=entry.has_snapshot?actionButton('download-schedule','Descargar PDF',`data-version="${entry.version}" aria-label="Descargar PDF de la versión ${entry.version}"`):'Solo registro';
  return `<tr><td>${entry.version}</td><td>${escapeHTML(new Date(Number(entry.saved_at)).toLocaleString('es'))}</td><td>${escapeHTML(entry.author_name)}</td><td>${download}</td></tr>`;
 }).join('');
 const log=`<section class="connected-summary"><h3>Historial de guardados</h3>${history?`<div class="table-scroll"><table class="connected-table"><thead><tr><th>Versión</th><th>Fecha y hora</th><th>Autor</th><th>PDF</th></tr></thead><tbody>${history}</tbody></table></div>`:'<p>Todavía no hay guardados.</p>'}</section>`;
 if(!schedule)return header+'<p class="empty">Sin cronograma registrado.</p>'+log;
 const end=schedule.start?scheduleDate(schedule.start,schedule.calendarDays):'';
 const progressState=progress(projectTasks(state.projectId));
 const incidents=[...schedule.incidents].sort((a,b)=>b.date.localeCompare(a.date)).map(event=>{
  const activity=schedule.rows.find(row=>row.id===event.activityId);
  const edit=editable()?actionButton('edit-schedule-incident','Editar',`data-id="${attr(event.id)}" aria-label="Editar incidencia del ${attr(fmtDate(event.date))}"`):'';
  return `<li><div><strong>${scheduleIncidentTypes[event.type]||'Incidencia'}</strong> · <time datetime="${attr(event.date)}">${fmtDate(event.date)}</time> · ${escapeHTML(activity?.name||'Proyecto')}<p>${escapeHTML(event.text)}</p><small>${escapeHTML(event.author)}</small></div>${edit}</li>`;
 }).join('');
 const scales=Object.entries(ganttScales).map(([key,scale])=>`<button type="button" data-action="gantt-scale" data-scale="${key}" aria-pressed="${key===ganttScale}">${scale.label}</button>`).join('');
 const draftStatus=draft?`<div class="gantt-draft" role="status"><span>${stale?'Hay una versión más reciente en el servidor. Descartá este borrador para abrirla.':'Cambios sin guardar'}</span>${actionButton('discard-schedule','Descartar borrador',saving)}</div>`:'';
 return header+draftStatus+`<section class="connected-summary"><div class="gantt-toolbar"><p>Período: ${schedule.start?`${fmtDate(schedule.start)} – ${fmtDate(end)}`:'Sin fecha de inicio'} · ${schedule.calendarDays} días</p><span class="gantt-project-state progress-tone tone-${progressState.tone}">Proyecto · ${progressState.label} · ${progressState.percent}%</span><div class="gantt-scales" role="group" aria-label="Escala del Gantt">${scales}</div></div>
 ${ganttView(schedule)}
 </section>
 <section class="connected-summary"><div class="sectionhead"><h3>Atrasos e incidencias</h3>${editable()?actionButton('edit-schedule-incident','Registrar incidencia'):''}</div>
 ${incidents?`<ul class="schedule-incidents">${incidents}</ul>`:'<p>Sin incidencias registradas.</p>'}</section>`+log;
}
function scheduleWorkingRecord(){
 return scheduleDrafts.get(state.projectId)??state.records.schedule;
}
function renderSchedulePanel(){
 const panel=q('#project-panel');
 if(!panel||state.tab!=='schedule')return;
 const scroll=panel.querySelector('.gantt-scroll')?.scrollLeft??0;
 panel.innerHTML=recordView();
 const chart=panel.querySelector('.gantt-scroll');
 if(chart)chart.scrollLeft=scroll;
}
function stageSchedule(projectId,version,payload){
 const current=scheduleWorkingRecord();
 if(projectId!==state.projectId||JSON.stringify(current.payload)===JSON.stringify(payload))return;
 scheduleDrafts.set(projectId,{version,payload});
 renderSchedulePanel();
}
async function saveSchedule(){
 const projectId=state.projectId,draft=scheduleDrafts.get(projectId);
 if(!draft||ganttSaving||draft.version!==state.records.schedule.version)return;
 ganttSaving=true;
 renderSchedulePanel();
 try{
  await api('PUT',`/projects/${projectId}/schedule`,draft);
  scheduleDrafts.delete(projectId);
  toast('Cronograma guardado');
  await reload();
 }catch(error){
  if(error.status===409&&state.projectId===projectId&&state.tab==='schedule'){
   try{await loadRecord();}catch{ /* The draft remains available if refreshing fails. */ }
  }
  reportError(error);
 }
 finally{ganttSaving=false;renderSchedulePanel();}
}
function scheduleSettings(){
 const {version,payload}=scheduleWorkingRecord(), projectId=state.projectId;
 showEditor(payload?'Editar período':'Crear cronograma',
  input('start','Inicio previsto',payload?.start||'','type="date" required')
  +input('calendarDays','Duración en días',payload?.calendarDays??30,'type="number" min="1" max="3660" required')
  +(payload?.rows.some(row=>row.activeDays.length)?'<p class="field-note">Si cambiás el inicio, las actividades se desplazarán junto con el cronograma.</p>':''),
  async fields=>{
   const start=fields.start.value, calendarDays=Number(fields.calendarDays.value);
   if(!Number.isFinite(Date.parse(start+'T00:00:00Z'))||!Number.isInteger(calendarDays)||calendarDays<1||calendarDays>3660)throw Error('Ingresá una fecha de inicio y una duración entre 1 y 3660 días.');
   const schedule=structuredClone(payload||{unit:'days',rows:[],incidents:[]});
   if(schedule.rows.some(row=>row.activeDays.some(day=>day>calendarDays)))throw Error('Hay actividades fuera del período nuevo. Ajustá sus fechas antes de reducir la duración.');
   Object.assign(schedule,{start,calendarDays,weeks:Math.ceil(calendarDays/7)});
   stageSchedule(projectId,version,schedule);
  },'Aplicar al borrador');
}
function scheduleEditor(rowId){
 const {version,payload}=scheduleWorkingRecord(), projectId=state.projectId;
 const schedule=structuredClone(payload);
 const row=schedule.rows.find(activity=>activity.id===rowId&&!activity.group);
 const groups=schedule.rows.filter(activity=>activity.group).map(group=>[group.id,group.name]);
 const selectedGroup=ForjaCalendar.scheduleActivityGroups(schedule.rows).get(rowId)??'';
 const start=schedule.start, end=scheduleDate(start,3660);
 const days=row?.activeDays||[];
 const first=days.length?scheduleDate(start,Math.min(...days)):start;
 const last=days.length?scheduleDate(start,Math.max(...days)):first;
 const dateOptions=`type="date" min="${attr(start)}" max="${attr(end)}" required`;
 showEditor(row?'Editar actividad':'Agregar actividad',
  input('name','Actividad',row?.name||'','required maxlength="200"')
  +select('groupId','Rubro',[['','Sin rubro'],...groups],selectedGroup)
  +input('first','Fecha de inicio',first,dateOptions)
  +input('last','Fecha de fin',last,dateOptions)
  +select('status','Estado',Object.entries(ganttStatuses),row?.status||'todo')
  +'<p class="field-note">La barra abarca todo el rango de fechas. Si el fin supera el período actual, el cronograma se amplía hasta esa fecha.</p>'
  +(days.length&&Math.max(...days)-Math.min(...days)+1>days.length?'<p class="field-note">Esta actividad tiene días salteados. Si cambiás las fechas, se programará en días consecutivos.</p>':'')
  +(row?scheduleRemoveButton(row):''),
  async fields=>{
   const name=fields.name.value.trim(), firstDate=fields.first.value, lastDate=fields.last.value;
   if(!name)throw Error('Ingresá el nombre de la actividad.');
   const from=scheduleDayIndex(start,firstDate), to=scheduleDayIndex(start,lastDate);
   if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>3660)throw Error('Ingresá fechas válidas dentro del límite de 3660 días. El fin debe ser igual o posterior al inicio.');
   const activity=row||{id:crypto.randomUUID(),group:false};
   activity.name=name;
   activity.groupId=fields.groupId.value||null;
   activity.status=fields.status.value;
   if(!days.length||firstDate!==first||lastDate!==last){
    activity.activeDays=Array.from({length:to-from+1},(_,index)=>from+index);
    delete activity.active;
   }
   if(!row)schedule.rows.push(activity);
   if(to>schedule.calendarDays){
    schedule.calendarDays=to;
    schedule.weeks=Math.ceil(to/7);
   }
   stageSchedule(projectId,version,schedule);
  },'Aplicar al borrador');
}
function scheduleGroupEditor(groupId){
 const {version,payload}=scheduleWorkingRecord(), projectId=state.projectId;
 const schedule=structuredClone(payload);
 const group=schedule.rows.find(row=>row.group&&row.id===groupId);
 showEditor(group?'Editar rubro':'Agregar rubro',input('name','Nombre del rubro',group?.name||'','required maxlength="200"')
  +(group?scheduleRemoveButton(group):''),fields=>{
  const name=fields.name.value.trim();
  if(!name)throw Error('Ingresá el nombre del rubro.');
  if(schedule.rows.some(row=>row.group&&row.id!==groupId&&row.name.toLowerCase()===name.toLowerCase()))throw Error('Ya existe un rubro con ese nombre.');
  if(group)group.name=name;
  else schedule.rows.push({id:crypto.randomUUID(),name,group:true,activeDays:[]});
  stageSchedule(projectId,version,schedule);
 },'Aplicar al borrador');
}
function scheduleRemoveButton(row){
 const label=row.group?'Eliminar rubro':'Eliminar actividad';
 const note=row.group?'Las actividades del rubro pasarán a «Sin rubro».':'Las incidencias vinculadas quedarán registradas en el proyecto.';
 return `<div class="schedule-remove"><button type="button" data-action="remove-schedule-row" data-id="${attr(row.id)}">${label}</button><p class="field-note">${note}</p></div>`;
}
function removeScheduleRow(id){
 const {version,payload}=scheduleWorkingRecord(), projectId=state.projectId;
 const schedule=structuredClone(payload);
 const removed=schedule.rows.find(row=>row.id===id);
 if(!removed)return;
 if(removed.group){
  const membership=ForjaCalendar.scheduleActivityGroups(schedule.rows);
  for(const row of schedule.rows){
   if(!row.group&&membership.get(row.id)===id)row.groupId=null;
  }
 }else{
  for(const incident of schedule.incidents){
   if(incident.activityId===id)delete incident.activityId;
  }
 }
 schedule.rows=schedule.rows.filter(row=>row.id!==id);
 stageSchedule(projectId,version,schedule);
 q('#editor').close();
}
async function downloadScheduleVersion(projectId,version){
 const saved=await api('GET',`/projects/${projectId}/schedule/versions/${version}`);
 const schedule=saved.payload;
 // Keep longer plans readable without producing a page for every 20 days.
 if(schedule.calendarDays>60)schedule.unit='weeks';
 const bytes=schedulePDF({name:saved.project_name},schedule,{number:saved.version,author:saved.author_name,savedAt:Number(saved.saved_at)});
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const link=document.createElement('a');
 link.href=url;
 link.download=`cronograma-V${saved.version}.pdf`;
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function scheduleIncidentEditor(eventId){
 const {version,payload}=scheduleWorkingRecord(), projectId=state.projectId;
 const schedule=structuredClone(payload);
 const existing=schedule.incidents.find(event=>event.id===eventId);
 const activities=schedule.rows.filter(row=>!row.group).map(row=>[row.id,row.name]);
 showEditor(existing?'Editar incidencia':'Registrar incidencia',
  select('type','Tipo',Object.entries(scheduleIncidentTypes),existing?.type||'delay')
  +input('date','Fecha',existing?.date||new Date().toLocaleDateString('sv-SE'),'type="date" required')
  +select('activityId','Relacionar con',[['','Todo el proyecto'],...activities],existing?.activityId||'')
  +textarea('detail','Detalle',existing?.text||'','required maxlength="3000"'),
  fields=>{
   const text=fields.detail.value.trim();
   if(!text)throw Error('Ingresá el detalle del atraso o la incidencia.');
   const incident=existing||{id:crypto.randomUUID(),author:state.user.name,createdAt:new Date().toISOString()};
   Object.assign(incident,{type:fields.type.value,date:fields.date.value,text});
   if(fields.activityId.value)incident.activityId=fields.activityId.value;
   else delete incident.activityId;
   if(!existing)schedule.incidents.push(incident);
   stageSchedule(projectId,version,schedule);
  },'Aplicar al borrador');
}
function shiftGanttSegments(segments,edge,delta,total){
 const next=segments.map(segment=>({...segment}));
 const first=next[0], last=next.at(-1);
 if(edge==='start')first.start=Math.max(1,Math.min(first.end,first.start+delta));
 else if(edge==='end')last.end=Math.max(last.start,Math.min(total,last.end+delta));
 else{
  const shift=Math.max(1-first.start,Math.min(total-last.end,delta));
  for(const segment of next){segment.start+=shift;segment.end+=shift;}
 }
 return next;
}
let ganttDrag=null, ganttSaving=false, ganttIgnoreClick=null;
document.addEventListener('pointerdown',event=>{
 ganttIgnoreClick=null;
 const bar=event.target.closest('button.gantt-bar');
 if(!bar||event.pointerType!=='mouse'||event.button!==0||!editable()||ganttSaving||ganttDrag)return;
 const record=scheduleWorkingRecord();
 const row=record?.payload.rows.find(activity=>activity.id===bar.dataset.id);
 if(!row?.activeDays.length)return;
 const track=bar.closest('.gantt-track');
 ganttDrag={bar,track,row,record,projectId:state.projectId,pointerId:event.pointerId,
  origin:event.clientX,edge:event.target.dataset.edge,segments:ganttSegments(row.activeDays)};
 bar.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
 const drag=ganttDrag;
 if(!drag||event.pointerId!==drag.pointerId||!drag.track.isConnected)return;
 const total=drag.record.payload.calendarDays;
 const delta=Math.round((event.clientX-drag.origin)*total/drag.track.getBoundingClientRect().width);
 drag.next=shiftGanttSegments(drag.segments,drag.edge,delta,total);
 drag.track.querySelectorAll('.gantt-bar').forEach((bar,index)=>bar.style.cssText=ganttPosition(drag.next[index],total));
});
function restoreGanttDrag(drag){
 drag.track.querySelectorAll('.gantt-bar').forEach((bar,index)=>bar.style.cssText=ganttPosition(drag.segments[index],drag.record.payload.calendarDays));
}
function cancelGanttDrag(event){
 if(ganttDrag?.pointerId!==event.pointerId)return;
 restoreGanttDrag(ganttDrag);ganttDrag=null;
}
document.addEventListener('pointercancel',cancelGanttDrag);
document.addEventListener('lostpointercapture',cancelGanttDrag);
document.addEventListener('pointerup',event=>{
 const drag=ganttDrag;
 if(!drag||event.pointerId!==drag.pointerId)return;
 ganttDrag=null;
 if(!drag.next||!drag.next.some((segment,index)=>segment.start!==drag.segments[index].start||segment.end!==drag.segments[index].end))return;
 ganttIgnoreClick=drag.bar;
 if(!drag.track.isConnected||state.projectId!==drag.projectId||scheduleWorkingRecord()!==drag.record){restoreGanttDrag(drag);return;}
 const payload=structuredClone(drag.record.payload);
 const row=payload.rows.find(activity=>activity.id===drag.row.id);
 row.activeDays=drag.next.flatMap(({start,end})=>Array.from({length:end-start+1},(_,index)=>start+index));
 delete row.active;
 stageSchedule(drag.projectId,drag.record.version,payload);
});
async function closure(){const snapshot=await api('GET',`/projects/${state.projectId}/closure`),records=Object.fromEntries(snapshot.records.map(r=>[r.kind,r.payload]));const project={...snapshot.project,date:snapshot.project.due_date,costs:records.costs,schedule:records.schedule};const tasks=snapshot.tasks.map(t=>({...t,date:t.due_date,owner:username(t.owner_id)}));const files=(snapshot.attachments??[]).map(file=>({name:file.name,costProjectId:project.id,costEntryId:file.expense_id,costType:'expense'}));const bytes=projectClosePDF(project,tasks,[],files,new Date(snapshot.generated_at),['Esta versión de pruebas conectada aún no incorpora la biblioteca de documentos ni las evidencias de tareas.']);const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download='cierre-proyecto-'+project.name.replace(/[^\p{L}\p{N}-]/gu,'-').slice(0,80)+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Informe generado con los datos del servidor');}
q('#login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;q('#login-error').textContent='';try{const session=await api('POST','/login',{email:form.elements.email.value.trim(),password:form.elements.password.value});state.user=session.user;state.csrf=session.csrf_token;form.elements.password.value='';render();await reload();}catch(error){if(state.user)reportError(error);else q('#login-error').textContent=error.message;}finally{button.disabled=false;}});
q('#editor-form').addEventListener('submit',async event=>{event.preventDefault();const button=q('#editor-submit');button.disabled=true;q('#editor-error').textContent='';try{const message=await editorSubmit(event.currentTarget.elements);q('#editor').close();q('#editor-fields').replaceChildren();if(message){toast(message);await reload();}}catch(error){if(q('#editor').open)q('#editor-error').textContent=error.message;else reportError(error);}finally{button.disabled=false;}});
q('#editor').addEventListener('close',()=>{q('#editor-fields').replaceChildren();editorSubmit=null});
document.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;
 if(button===ganttIgnoreClick){ganttIgnoreClick=null;return;}
 if(ganttSaving&&['edit-schedule','schedule-settings','edit-schedule-incident','edit-schedule-group','remove-schedule-row'].includes(action))return;
 try{
  if(action==='close-dialog'){q('#editor').close();return}
  if(action==='logout'){if(scheduleDrafts.size&&!window.confirm('Hay borradores de cronograma sin guardar. ¿Cerrar sesión y descartarlos?'))return;button.disabled=true;await api('POST','/logout',{});showLogin();return}
  if(action==='refresh'){button.disabled=true;await reload();return}
  if(action==='navigate'){state.page=button.dataset.page;state.projectId=null;state.query='';state.priority='';render();if(state.page==='audit')await loadAudit();return}
  if(action==='open-project'){state.projectId=button.dataset.id;state.page='detail';state.tab='tasks';state.records={};render();window.scrollTo({top:0,behavior:'instant'});return}
  if(action==='project-tab'){state.tab=button.dataset.tab;render();if(state.tab!=='tasks')await loadRecord();return}
  if(action==='new-project')projectEditor();
  if(action==='edit-project')projectEditor(projectById(state.projectId));
  if(action==='new-task')taskEditor();
  if(action==='edit-task')taskEditor(state.tasks.find(t=>t.id===button.dataset.id));
  if(action==='delete-project')deleteProjectEditor();
  if(action==='review-request')requestEditor(button);
  if(action==='new-user')userEditor();
  if(action==='edit-user')userEditor(state.users.find(u=>u.id===button.dataset.id));
  if(action==='new-expense')expenseEditor();
  if(action==='attach-expense'&&editable())expenseEvidenceEditor(button.dataset.expenseId);
  if(action==='edit-budget'&&admin())budgetEditor();
  if(action==='schedule-settings')scheduleSettings();
  if(action==='edit-schedule')scheduleEditor(button.dataset.id);
  if(action==='edit-schedule-group')scheduleGroupEditor(button.dataset.id);
  if(action==='remove-schedule-row'&&editable())removeScheduleRow(button.dataset.id);
  if(action==='download-schedule'){button.disabled=true;await downloadScheduleVersion(state.projectId,button.dataset.version);}
  if(action==='edit-schedule-incident')scheduleIncidentEditor(button.dataset.id);
  if(action==='save-schedule')await saveSchedule();
  if(action==='discard-schedule'){scheduleDrafts.delete(state.projectId);renderSchedulePanel();}
  if(action==='gantt-scale'&&Object.hasOwn(ganttScales,button.dataset.scale)){
   ganttScale=button.dataset.scale;
   renderSchedulePanel();
   q('.gantt-scales [aria-pressed="true"]')?.focus({preventScroll:true});
  }
  if(action==='conclusion'){const costs=costPayload();showEditor('Conclusión del proyecto',textarea('conclusion','Conclusión y observaciones',costs.conclusion,'maxlength="5000"'),async f=>{costs.conclusion=f.conclusion.value.trim();await saveCosts(costs);return 'Conclusión guardada';});}
  if(action==='closure'){button.disabled=true;await closure();}
 }catch(error){reportError(error);}finally{if(button.isConnected)button.disabled=false;}
});
document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('article[data-action]')){event.preventDefault();event.target.click()}});
document.addEventListener('input',event=>{if(event.target.id==='connected-search'){state.query=event.target.value;q('#task-groups').innerHTML=taskGroups();}});
document.addEventListener('change',async event=>{const selectElement=event.target;if(selectElement.id==='connected-priority'){state.priority=selectElement.value;q('#task-groups').innerHTML=taskGroups();return}if(!selectElement.dataset.taskStatus)return;const task=state.tasks.find(t=>t.id===selectElement.dataset.taskStatus);selectElement.disabled=true;try{await api('PATCH',`/tasks/${task.id}`,{version:task.version,status:selectElement.value});await reload();toast('Estado guardado en el servidor');}catch(error){selectElement.value=task.status;reportError(error);}finally{selectElement.disabled=false;}});
matchMedia('(max-width:780px)').addEventListener('change',()=>{if(state.user&&state.page==='tasks')q('#task-groups').innerHTML=taskGroups();});
window.addEventListener('beforeunload',event=>{
 if(!scheduleDrafts.size)return;
 event.preventDefault();
 event.returnValue='';
});
(async()=>{try{const session=await api('GET','/me');state.user=session.user;state.csrf=session.csrf_token;render();await reload();}catch(error){if(state.user)reportError(error);else{showLogin();q('#login-error').textContent='';}}})();
