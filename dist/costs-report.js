function costTotals(c){
 const sum=xs=>xs.reduce((a,x)=>a+Math.round(Number(x.amount)*100),0)/100;
 const approved=c.quotes.filter(x=>x.approved),base=sum(approved.filter(x=>x.category==='Base')),additionalBudget=sum(approved.filter(x=>x.category==='Adicional'));
 const actual=sum(c.expenses),paid=sum(c.expenses.filter(x=>x.status==='Pagado')),additional=sum(c.expenses.filter(x=>x.category==='Adicional'));
 return {base,additionalBudget,budget:Math.round((base+additionalBudget)*100)/100,actual,paid,pending:Math.round((actual-paid)*100)/100||0,additional,variance:Math.round((actual-base-additionalBudget)*100)/100||0};
}
function costMoney(n,currency){return new Intl.NumberFormat('es',{style:'currency',currency,maximumFractionDigits:2}).format(n)}
function costsPDF(project,c,files=[]){
 const totals=costTotals(c),money=n=>costMoney(n,c.currency),blocks=[];
 const add=(text,bold=false)=>blocks.push({text,bold});
 add('CIERRE DE COSTOS DEL PROYECTO',true);add(project.name,true);add('Fecha del informe: '+new Date().toLocaleDateString('es')+' | Moneda: '+c.currency);add('');
 add('RESUMEN ECONOMICO',true);
 for(const [label,n] of [['Presupuesto base aprobado',totals.base],['Adicionales presupuestados aprobados',totals.additionalBudget],['Presupuesto total aprobado',totals.budget],['Gasto total incurrido',totals.actual],['De los cuales son gastos adicionales',totals.additional],['Pagado',totals.paid],['Pendiente de pago',totals.pending],['Diferencia (gasto - presupuesto)',totals.variance]])add(label+': '+money(n));
 add('');add('CONCLUSION',true);add(totals.budget===0?'No hay presupuesto aprobado registrado para evaluar la desviacion.':totals.variance>0?'El gasto supera el presupuesto aprobado en '+money(totals.variance)+'.':'El gasto queda por debajo del presupuesto aprobado en '+money(-totals.variance)+'.');
 add('El total incurrido incluye gastos pagados y pendientes. Las cotizaciones no aprobadas no integran el presupuesto ni se cuentan como gastos. Importes finales con impuestos incluidos, segun los registros ingresados.');
 if(c.conclusion){add('Observaciones del cierre:',true);add(c.conclusion)}
 add('');add('GASTOS INCURRIDOS',true);
 if(!c.expenses.length)add('No se registraron gastos.');
 for(const x of [...c.expenses].sort((a,b)=>a.date.localeCompare(b.date))){add(x.concept+' | '+money(x.amount),true);add('Proveedor: '+(x.supplier||'Sin proveedor')+' | Fecha: '+(x.date||'Sin fecha')+' | '+x.category+' | '+x.status);add('Factura: '+(x.invoice||'Sin numero')+' | Adjuntos: '+(files.filter(f=>f.costEntryId===x.id&&f.costType==='expense').map(f=>f.name).join(', ')||'Sin factura adjunta'));if(x.notes)add(x.notes);add('')}
 add('PRESUPUESTOS Y COMPARATIVOS',true);
 if(!c.quotes.length)add('No se registraron cotizaciones.');
 for(const x of [...c.quotes].sort((a,b)=>a.concept.localeCompare(b.concept)||a.amount-b.amount)){add(x.concept+' | '+(x.supplier||'Sin proveedor')+' | '+money(x.amount),true);add((x.approved?'APROBADO':'Alternativa')+' | '+x.category+' | Fecha: '+(x.date||'Sin fecha'));if(x.notes)add(x.notes);add('')}
 add('TOTALES POR PROVEEDOR',true);const suppliers=[...new Set(c.expenses.map(x=>x.supplier||'Sin proveedor'))];for(const name of suppliers){const rows=c.expenses.filter(x=>(x.supplier||'Sin proveedor')===name);add(name+': '+money(rows.reduce((a,x)=>a+Math.round(x.amount*100),0)/100))}if(!suppliers.length)add('Sin gastos por proveedor.');
 add('');add('PROVEEDORES REGISTRADOS',true);for(const x of c.suppliers)add(x.name+' | RUC / ID: '+(x.taxId||'Sin dato')+' | Contacto: '+(x.contact||'Sin dato'));if(!c.suppliers.length)add('Sin proveedores registrados.');
 add('');add('Las facturas se conservan como archivos independientes en la app; este informe incluye su listado, no las incorpora como paginas. Datos y archivos guardados en este navegador y dispositivo.');
 const escape=s=>String(s).normalize('NFC').replace(/[^\x20-\xFF]/g,' ').replace(/[()\\]/g,'\\$&').replace(/[\x80-\xFF]/g,x=>'\\'+x.charCodeAt(0).toString(8).padStart(3,'0'));
 const lines=[];for(const b of blocks){let line='';for(const word of b.text.split(/\s+/)){if(line.length+word.length+1>88){lines.push({text:line,bold:b.bold});line=''}if(word.length>88){if(line)lines.push({text:line,bold:b.bold});line='';for(let i=0;i<word.length;i+=88)lines.push({text:word.slice(i,i+88),bold:b.bold})}else line+=(line?' ':'')+word}lines.push({text:line,bold:b.bold})}
 const pageLines=[];for(let start=0;start<lines.length;){let end=Math.min(start+45,lines.length);if(end<lines.length&&lines[end-1].bold)end--;pageLines.push(lines.slice(start,end));start=end}
 const objs=[null],addObj=s=>(objs.push(s),objs.length-1),root=addObj(''),pages=addObj(''),font=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),bold=addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),kids=[],count=pageLines.length;
 for(let page=0;page<count;page++){let ops='';const text=(s,x,y,size,b=false)=>ops+=`BT /${b?'B':'F'} ${size} Tf 0.102 0.208 0.565 rg 1 0 0 1 ${x} ${y} Tm (${escape(s)}) Tj ET\n`;text('Gestión de proyectos / CONTROL DE COSTOS',40,806,9,true);pageLines[page].forEach((l,i)=>text(l.text,40,778-i*16,10,l.bold));text('Pagina '+(page+1)+' de '+count+' | '+c.currency,40,36,8);const stream=addObj(`<< /Length ${ops.length} >>\nstream\n${ops}endstream`);kids.push(addObj(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F ${font} 0 R /B ${bold} 0 R >> >> /Contents ${stream} 0 R >>`))}
 objs[root]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;objs[pages]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(x=>x+' 0 R').join(' ')}] >>`;let pdf='%PDF-1.4\n',offsets=[0];for(let i=1;i<objs.length;i++){offsets.push(pdf.length);pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;for(let i=1;i<objs.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objs.length} /Root ${root} 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array([...pdf].map(x=>x.charCodeAt(0)));
}
if(typeof module!=='undefined')module.exports={costTotals,costsPDF};

