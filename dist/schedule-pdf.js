/* Small vector PDF writer: no remote services; keeps the schedule selectable and sharp. */
function schedulePDF(project, schedule, version=null) {
  const calendar=typeof module!=='undefined'?require('./schedule-model.js'):ForjaCalendar;
  calendar.normalizeSchedule(schedule);const daily=schedule.unit==='days',periods=calendar.scheduleCount(schedule),prefix=daily?'D':'S';
  const objects=[null], add=s=>(objects.push(s),objects.length-1);
  const catalog=add(''),pages=add('');
  const normal=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const escape=s=>String(s).normalize('NFC').replace(/[^\x20-\xFF]/g,'?').replace(/[()\\]/g,'\\$&').replace(/[\x80-\xFF]/g,c=>'\\'+c.charCodeAt(0).toString(8).padStart(3,'0'));
  const wrap=(s,n)=>{const lines=[];let line='';for(const word of String(s).split(/\s+/)){if(line.length+word.length+1>n&&line){lines.push(line);line=''}if(word.length>n){if(line){lines.push(line);line=''}for(let i=0;i<word.length;i+=n)lines.push(word.slice(i,i+n))}else line+=(line?' ':'')+word}if(line)lines.push(line);return lines.length?lines:['']};
  const chunks=[[]];let usedHeight=0;
  for(const row of schedule.rows){const h=Math.max(17,wrap(row.name,43).length*9+6);if(usedHeight+h>390||chunks.at(-1).length>=22){chunks.push([]);usedHeight=0}chunks.at(-1).push(row);usedHeight+=h}
  const eventLabels={rain:'Lluvia',delay:'Retraso',change:'Cambio de obra',note:'Comentario'},eventColors={rain:'1 0.94 0.68',delay:'1 0.83 0.74',change:'0.89 0.83 1',note:'0.86 0.92 0.99'};
  const noteLines=[];for(const event of schedule.incidents.slice().sort((a,b)=>a.date.localeCompare(b.date))){const day=calendar.scheduleIncidentDay(schedule,event);for(const line of wrap(`${event.date} | ${eventLabels[event.type]||'Comentario'} | ${day>=1&&day<=schedule.calendarDays?'Dia '+day:'Fuera del plazo actual'}`,90))noteLines.push({text:line,bold:true});for(const line of wrap(event.text,90))noteLines.push({text:line});for(const line of wrap(`Registrado por ${event.author} | ${new Date(event.createdAt).toLocaleString('es')}`,90))noteLines.push({text:line});noteLines.push({text:''})}
  const notePages=Math.ceil(noteLines.length/34);
  const kids=[],bands=Math.ceil(periods/20),rowChunks=chunks.length,total=bands*rowChunks+notePages;
  let pageNo=0;
  for(let band=0;band<bands;band++)for(let chunk=0;chunk<rowChunks;chunk++){
    pageNo++;const first=band*20+1,count=Math.min(20,periods-first+1),cw=510/count,rows=chunks[chunk];let ops='0.35 w\n';
    const text=(x,y,s,size=9,b=false)=>{ops+=`BT /${b?'B':'F'} ${size} Tf 0.102 0.208 0.565 rg 1 0 0 1 ${x} ${595-y} Tm (${escape(s)}) Tj ET\n`};
    const rect=(x,y,w,h,color)=>{ops+=`${color||'1 1 1'} rg 0.22 0.28 0.24 RG ${x} ${595-y-h} ${w} ${h} re B\n`};
    text(28,30,'CRONOGRAMA DE OBRA',16,true);wrap(project.name,80).slice(0,2).forEach((l,i)=>text(28,49+i*12,l,11,true));
    text(28,70,version?`VERSION V${version.number} | ${version.author} | ${new Date(version.savedAt).toLocaleString('es')}`:`BORRADOR | ${project.scheduleDraftInfo?.author||'Autor sin identificar'}${project.scheduleDraftInfo?.savedAt?' | '+new Date(project.scheduleDraftInfo.savedAt).toLocaleString('es'):''}`,7);
    text(28,80,`Inicio: ${schedule.start||'Sin fecha'}  |  ${daily?'Dias':'Semanas'} ${first}-${first+count-1} de ${periods} | Dias calendario`,9);
    text(28,96,'Cian: programado. Cian claro: semana parcial. Duracion: dias programados (s = semanas, d = dias).',8);
    rect(28,109,205,25,'0.90 0.94 0.99');rect(233,109,43,25,'0.90 0.94 0.99');text(33,125,'ACTIVIDAD',8,true);text(236,125,'DUR.',8,true);
    for(let w=0;w<count;w++){const events=calendar.schedulePeriodIncidents(schedule,first+w),type=events.length===1?events[0].type:events.length?'change':null;rect(276+w*cw,109,cw,25,type?eventColors[type]:'0.90 0.94 0.99');text(279+w*cw,119,prefix+(first+w)+(events.length?'*':''),8,true);text(279+w*cw,129,calendar.schedulePeriodDate(schedule,first+w),6)}
    let y=134;
    for(const row of rows){const lines=wrap(row.name,43),h=Math.max(17,lines.length*9+6);rect(28,y,205,h,row.group?'0.88 0.92 0.98':null);rect(233,y,43,h,row.group?'0.88 0.92 0.98':null);lines.forEach((l,i)=>text(32,y+11+i*9,l,8,!!row.group));if(!row.group)text(237,y+11,calendar.scheduleDuration(schedule,row,true),7);
      for(let w=0;w<count;w++){const state=calendar.schedulePeriodState(schedule,row,first+w);rect(276+w*cw,y,cw,h,row.group?'0.88 0.92 0.98':state.partial?'0.65 0.89 0.91':state.marked?'0 0.718 0.741':null)}y+=h;
    }
    if(!rows.length)text(33,155,'Sin actividades. Agrega filas desde la app.',10);
    text(28,548,'* Incidencias: amarillo = lluvia; naranja = retraso; violeta = cambio / varias; azul = comentario. Detalle en anexo.',7);
    text(28,565,'Gestión de proyectos | '+new Date().toLocaleDateString('es'),8);text(694,565,`Pagina ${pageNo} de ${total}`,8);
    const stream=add(`<< /Length ${ops.length} >>\nstream\n${ops}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F ${normal} 0 R /B ${bold} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  for(let n=0;n<notePages;n++){pageNo++;let ops='';const text=(x,y,s,size=9,b=false)=>{ops+=`BT /${b?'B':'F'} ${size} Tf 0.102 0.208 0.565 rg 1 0 0 1 ${x} ${595-y} Tm (${escape(s)}) Tj ET\n`};text(28,30,'COMENTARIOS E INCIDENCIAS DE OBRA',15,true);text(28,51,project.name.slice(0,100),10,true);text(28,72,version?`VERSION V${version.number} | ${version.author} | ${new Date(version.savedAt).toLocaleString('es')}`:'BORRADOR DEL CRONOGRAMA',7);noteLines.slice(n*34,(n+1)*34).forEach((line,i)=>text(28,100+i*12,line.text,9,!!line.bold));text(28,565,'Gestión de proyectos | Nombres declarados por el usuario, sin autenticacion corporativa.',7);text(694,565,`Pagina ${pageNo} de ${total}`,8);const stream=add(`<< /Length ${ops.length} >>\nstream\n${ops}endstream`);kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F ${normal} 0 R /B ${bold} 0 R >> >> /Contents ${stream} 0 R >>`))}
  objects[catalog]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;objects[pages]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(id=>id+' 0 R').join(' ')}] >>`;
  let pdf='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array([...pdf].map(c=>c.charCodeAt(0)));
}
if(typeof module!=='undefined')module.exports={schedulePDF};

