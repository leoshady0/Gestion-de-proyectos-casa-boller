function projectCanClose(tasks){return tasks.length>0&&tasks.every(t=>t.status==='done')}
function projectClosePDF(project,tasks,documents=[],files=[],now=new Date(),warnings=[]){
 if(!projectCanClose(tasks))throw Error('Completa todas las tareas antes de descargar el cierre.');
 const blocks=[],add=(text='',bold=false)=>blocks.push({text:String(text),bold});
 const section=title=>{add();add(title,true)};
 const when=d=>d?new Date(d).toLocaleString('es'):'Sin fecha registrada';
 add('INFORME GENERAL DE CIERRE',true);add(project.name,true);
 add('Emitido: '+now.toLocaleString('es'));add('Estado: 100% de las tareas completadas');
 add('Este informe refleja los registros actuales. La fecha de emision no acredita la fecha real de finalizacion ni la recepcion formal de la obra.');
 if(warnings.length){section('INFORMACION NO DISPONIBLE');warnings.forEach(w=>add(w));add('Los listados de adjuntos pueden estar incompletos. Su ausencia en este PDF no implica que no existan archivos.');}
 section('1. RESUMEN DEL PROYECTO');add(project.description||'Sin descripcion registrada.');
 add('Fecha de entrega prevista: '+(project.date||'Sin fecha registrada'));
 add('Tareas completadas: '+tasks.length+' de '+tasks.length);
 section('2. TAREAS Y RESPONSABLES');
 tasks.forEach((t,i)=>{add((i+1)+'. '+t.name,true);add('Estado: Completada | Responsable: '+(t.owner||'Sin asignar'));add('Prioridad: '+(t.priority||'Sin dato')+' | Entrega prevista: '+(t.date||'Sin fecha'));if(t.description)add(t.description);const evidence=files.filter(f=>f.taskId===t.id);add('Evidencias: '+(evidence.map(f=>f.name).join(', ')||(warnings.length?'Sin evidencias recuperadas; consultar advertencias.':'Sin evidencias registradas.')))});
 section('3. CRONOGRAMA E INCIDENCIAS');
 if(project.schedule){const s=project.schedule;add('Inicio previsto: '+(s.start||'Sin fecha')+' | Periodo planificado: '+(s.calendarDays||s.weeks*7||0)+' dias');
  for(const row of s.rows||[]){add((row.group?'Grupo: ':'Actividad: ')+(row.name||'Sin nombre'),!!row.group);if(!row.group)add('Dias programados: '+(Array.isArray(row.activeDays)?row.activeDays.length:(row.active||[]).length*7))}
  const incidents=s.incidents||[];add('Incidencias registradas: '+incidents.length);
  const types={rain:'Lluvia',delay:'Atraso',incident:'Incidencia',change:'Cambio de obra',note:'Comentario'};
  incidents.forEach(x=>{
   const activity=x.activityId&&(s.rows||[]).find(row=>row.id===x.activityId);
   add((x.date||'Sin fecha')+' | '+(types[x.type]||x.type||'Comentario')+' | '+(x.author||'Sin responsable'));
   if(activity)add('Actividad: '+activity.name);
   add(x.text||'Sin detalle');
  });
 }else add('Sin cronograma registrado.');
 const versions=project.scheduleVersions||[];add('Versiones guardadas del cronograma: '+versions.length);
 versions.forEach(v=>add('Version '+v.number+' | '+(v.author||'Sin responsable')+' | '+when(v.savedAt)+(v.note?' | '+v.note:'')));
 section('4. RESUMEN ECONOMICO');
 if(project.costs){const c=project.costs,totals=(typeof costTotals==='function'?costTotals:require('./costs-report.js').costTotals)(c);
  const money=n=>new Intl.NumberFormat('es',{style:'currency',currency:c.currency}).format(n);
  add('Moneda: '+c.currency);
  for(const [label,value] of [...(c.approvedBudget===undefined?[['Presupuesto base aprobado',totals.base],['Adicionales aprobados',totals.additionalBudget]]:[]),['Presupuesto total aprobado',totals.budget],['Gasto incurrido',totals.actual],['Pagado',totals.paid],['Pendiente de pago',totals.pending],['Diferencia: gasto menos presupuesto',totals.variance]])add(label+': '+money(value));
  add(totals.pending>0?'ATENCION: existen pagos pendientes. Completar tareas no equivale a liquidar los pagos.':'No se registran pagos pendientes.');
  if(!totals.budget)add('No hay presupuesto aprobado registrado para evaluar la desviacion.');
  add('Gastos registrados',true);if(!c.expenses.length)add('Sin gastos registrados.');
  c.expenses.forEach(x=>{add(x.concept+' | '+money(x.amount),true);add((x.supplier||'Sin proveedor')+' | '+(x.date||'Sin fecha')+' | '+x.status+' | Factura: '+(x.invoice||'Sin numero'));if(x.notes)add(x.notes)});
  add('Cotizaciones',true);if(!c.quotes.length)add('Sin cotizaciones registradas.');
  c.quotes.forEach(x=>add(x.concept+' | '+(x.supplier||'Sin proveedor')+' | '+money(x.amount)+' | '+(x.approved?'Aprobada':'Alternativa')+' | '+x.category));
  add('Proveedores registrados',true);if(!c.suppliers.length)add('Sin proveedores registrados.');
  c.suppliers.forEach(x=>add(x.name+' | RUC / ID: '+(x.taxId||'Sin dato')+' | Contacto: '+(x.contact||'Sin dato')));
  section('5. CONCLUSION Y OBSERVACIONES');add(c.conclusion||'Sin conclusion registrada.');
 }else{add('Sin informacion de costos registrada.');section('5. CONCLUSION Y OBSERVACIONES');add('Sin conclusion registrada.');}
 section('6. DOCUMENTOS Y ADJUNTOS');
 if(!documents.length)add(warnings.length?'Sin documentos recuperados; consultar advertencias.':'Sin documentos activos registrados en la biblioteca.');
 documents.filter(d=>!d.trashedAt).forEach(d=>{add(d.title||d.fileName,true);add((d.category||'Documento')+' | '+(d.documentDate||'Sin fecha')+' | Archivo: '+d.fileName);if(d.notes)add(d.notes)});
 const costFiles=files.filter(f=>f.costProjectId===project.id);add('Comprobantes y adjuntos de costos: '+costFiles.length);costFiles.forEach(f=>add(f.name+' | '+(f.costType==='expense'?'Gasto':'Cotizacion')));
 section('7. ALCANCE DEL INFORME');
 add('El informe contiene el listado de documentos y evidencias, no sus archivos originales. Los adjuntos se conservan y descargan por separado desde la aplicacion.');
 add('Generado con los datos disponibles en este navegador. No incluye firma, aprobacion del cliente ni certificacion de cierre contractual. Si se reabren tareas, el cierre vuelve a quedar deshabilitado.');
 return closeReportBytes(blocks);
}
function closeReportBytes(blocks){
 // Octal escapes keep streams ASCII and preserve correct byte offsets.
 const encode=s=>String(s).normalize('NFC').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\xFF]/g,' ').replace(/[()\\]/g,'\\$&').replace(/[\x80-\xFF]/g,c=>'\\'+c.charCodeAt(0).toString(8).padStart(3,'0'));
 const width=text=>[...text].reduce((sum,c)=>{c=c.normalize('NFD')[0];return sum+10*(/[MWmw@%]/.test(c)?1:/[ilI.,:;!'| ]/.test(c)?.32:/[A-Z]/.test(c)?.8:.65)},0);
 const lines=[];for(const block of blocks){for(const paragraph of block.text.split(/\r?\n/)){let remaining=paragraph.replace(/\s+/g,' ').trim();if(!remaining)lines.push({text:'',bold:block.bold});while(remaining){let end=0;while(end<remaining.length&&width(remaining.slice(0,end+1))<=505)end++;if(end<remaining.length){const space=remaining.lastIndexOf(' ',end);if(space>0)end=space}end=Math.max(1,end);lines.push({text:remaining.slice(0,end),bold:block.bold});remaining=remaining.slice(end).trimStart()}}}
 const pages=[];while(lines.length){let n=Math.min(43,lines.length);if(n<lines.length&&lines[n-1].bold)n--;pages.push(lines.splice(0,n))}
 const objects=[null],obj=s=>(objects.push(s),objects.length-1),catalog=obj(''),pageRoot=obj(''),regular=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),bold=obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),kids=[];
 pages.forEach((lines,index)=>{let content='0.09 0.22 0.58 rg 0 788 595 54 re f\n';
  const text=(value,x,y,size,isBold,color)=>{content+=`BT /${isBold?'B':'F'} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${encode(value)}) Tj ET\n`};
  text('GESTION DE PROYECTOS',40,812,13,true,'1 1 1');text('INFORME DE CIERRE',40,796,8,false,'1 1 1');
  lines.forEach((line,i)=>text(line.text,40,762-i*16,line.bold?10:9.5,line.bold,line.bold?'0.09 0.22 0.58':'0.14 0.19 0.28'));
  text('Cierre segun tareas registradas',40,32,8,false,'0.35 0.4 0.5');text('Pagina '+(index+1)+' de '+pages.length,470,32,8,false,'0.35 0.4 0.5');
  const stream=obj(`<< /Length ${content.length} >>\nstream\n${content}endstream`);kids.push(obj(`<< /Type /Page /Parent ${pageRoot} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F ${regular} 0 R /B ${bold} 0 R >> >> /Contents ${stream} 0 R >>`));
 });
 objects[catalog]=`<< /Type /Catalog /Pages ${pageRoot} 0 R >>`;objects[pageRoot]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(i=>i+' 0 R').join(' ')}] >>`;
 let pdf='%PDF-1.4\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(const n of offsets.slice(1))pdf+=String(n).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;return Uint8Array.from(pdf,c=>c.charCodeAt(0));
}
if(typeof module!=='undefined')module.exports={projectCanClose,projectClosePDF};
