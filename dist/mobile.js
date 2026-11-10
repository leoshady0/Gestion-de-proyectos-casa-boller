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
function drawMobile(){
 document.body.dataset.mobileView=selected?'detail':view;
 mobileContext.hidden=!selected;
 mobileNav.querySelectorAll('button').forEach(b=>{const active=b.dataset.view===(selected?'projects':view);b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 document.querySelectorAll('.mobile-task-state').forEach(el=>el.remove());
 document.querySelectorAll('.task[data-task]').forEach(card=>{
  const task=data.tasks.find(t=>t.id===card.dataset.task);if(!task)return;
  const label=document.createElement('label');label.className='mobile-task-state';label.textContent='Estado de la tarea';
  const select=document.createElement('select');select.setAttribute('aria-label','Estado: '+task.name);
  for(const [value,text] of [['todo','Por hacer'],['doing','En curso'],['done','Completada']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}
  select.value=task.status;select.addEventListener('click',e=>e.stopPropagation());select.addEventListener('keydown',e=>e.stopPropagation());select.addEventListener('change',()=>{task.status=select.value;save()});label.addEventListener('click',e=>e.stopPropagation());label.append(select);card.append(label);
 });
}
render=function(){mobileBaseRender();drawMobile()};drawMobile();
