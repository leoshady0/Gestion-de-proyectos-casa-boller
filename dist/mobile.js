// Shared application data; mobile presentation only.
const mobileNav=document.createElement('nav');
mobileNav.className='mobile-nav';mobileNav.setAttribute('aria-label','Navegación principal móvil');
mobileNav.innerHTML='<button data-view="all"><span aria-hidden="true">⌂</span>Inicio</button><button data-view="projects"><span aria-hidden="true">▤</span>Proyectos</button><button data-view="tasks"><span aria-hidden="true">✓</span>Tareas</button>';
document.body.append(mobileNav);
const mobileHeading=document.createElement('div');mobileHeading.className='mobile-heading';
mobileHeading.innerHTML='<div><small>MI ESPACIO DE TRABAJO</small><strong>Gestión de proyectos</strong></div><span class="mobile-workspace" aria-label="Espacio personal">P</span>';
document.querySelector('main').prepend(mobileHeading);
const mobileContext=document.createElement('button');mobileContext.className='mobile-back';mobileContext.textContent='‹ Todos los proyectos';mobileContext.dataset.view='projects';document.querySelector('.intro').before(mobileContext);
const mobileBaseRender=render;
const mobileTaskGroups=document.createElement('div');mobileTaskGroups.className='mobile-task-groups';document.querySelector('#board').after(mobileTaskGroups);
function mobileProjectTaskGroups(projects,tasks,query='',priority=''){
 const matching=tasks.filter(t=>t.name.toLowerCase().includes(query.toLowerCase())&&(!priority||t.priority===priority));
 return projects.map(project=>{const rows=matching.filter(t=>t.project===project.id);return {project,total:tasks.filter(t=>t.project===project.id).length,matching:rows.length,tasks:rows.slice(0,3)}}).filter(group=>group.matching>0);
}
function drawMobileTaskGroups(){
 mobileTaskGroups.replaceChildren();if(selected||view!=='tasks')return;
 const groups=mobileProjectTaskGroups(data.projects,data.tasks,$('#search').value,$('#priority').value);
 const cards=new Map([...document.querySelectorAll('#board .task[data-task]')].map(card=>[card.dataset.task,card]));
 for(const group of groups){
  const section=document.createElement('section');section.className='mobile-project-tasks';
  const heading=document.createElement('div');heading.className='mobile-project-tasks-heading';
  const title=document.createElement('h3');title.textContent=group.project.name;
  const count=document.createElement('p');count.textContent=`${group.tasks.length} de ${group.matching} tareas${group.matching!==group.total?' coincidentes con el filtro':''}`;
  heading.append(title,count);section.append(heading);
  const statuses={todo:'Por hacer',doing:'En curso',done:'Completada'};
  for(const task of group.tasks){const original=cards.get(task.id);if(!original)continue;
   const card=original.cloneNode(true);card.classList.add('mobile-project-task');card.dataset.mobileStatus=task.status;card.removeAttribute('draggable');
   const projectName=card.querySelector('.taskproject');projectName.textContent=group.project.name;projectName.title=group.project.name;
   const status=document.createElement('span');status.className='mobile-task-status';status.textContent=statuses[task.status]||task.status;card.querySelector('h4').before(status);section.append(card);
  }
  if(group.total>3){const more=document.createElement('button');more.className='mobile-project-more';more.dataset.project=group.project.id;more.textContent=`Ver más · ${group.total} tareas en el proyecto`;more.setAttribute('aria-label',`Ver más tareas de ${group.project.name}`);
   more.addEventListener('click',()=>{projectPanel='tasks';$('#search').value='';$('#priority').value='';window.scrollTo({top:0,behavior:'instant'})});section.append(more);
  }
  mobileTaskGroups.append(section);
 }
 if(!groups.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No hay tareas que coincidan. Probá otra búsqueda o creá una tarea.';mobileTaskGroups.append(empty)}
}
function drawMobile(){
 document.body.dataset.mobileView=selected?'detail':view;
 mobileContext.hidden=!selected;
 mobileNav.querySelectorAll('button').forEach(b=>{const active=b.dataset.view===(selected?'projects':view);b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 document.querySelectorAll('.mobile-task-state').forEach(el=>el.remove());
 drawMobileTaskGroups();
 document.querySelectorAll('.task[data-task]').forEach(card=>{
  const task=data.tasks.find(t=>t.id===card.dataset.task);if(!task)return;
  const label=document.createElement('label');label.className='mobile-task-state';label.textContent='Estado de la tarea';
  const select=document.createElement('select');select.setAttribute('aria-label','Estado: '+task.name);
  for(const [value,text] of [['todo','Por hacer'],['doing','En curso'],['done','Completada']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}
  select.value=task.status;select.addEventListener('click',e=>e.stopPropagation());select.addEventListener('keydown',e=>e.stopPropagation());select.addEventListener('change',()=>{task.status=select.value;save()});label.addEventListener('click',e=>e.stopPropagation());label.append(select);card.append(label);
 });
}
render=function(){mobileBaseRender();drawMobile()};
// Resolve the current renderer so filters also refresh the mobile project groups.
$('#search').oninput=()=>render();$('#priority').onchange=()=>render();drawMobile();
