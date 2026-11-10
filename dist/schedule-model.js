// Canonical calendar days preserve exact dates when switching daily/weekly views.
function normalizeSchedule(s){if(!s.unit)s.unit='weeks';if(!Number.isInteger(s.calendarDays))s.calendarDays=s.weeks*7;if(!Array.isArray(s.incidents))s.incidents=[];for(const r of s.rows)if(!Array.isArray(r.activeDays))r.activeDays=r.group?[]:[...new Set((r.active||[]).flatMap(w=>Array.from({length:7},(_,i)=>(w-1)*7+i+1)))].filter(d=>d<=s.calendarDays).sort((a,b)=>a-b);return s}
function scheduleStep(s){return s.unit==='days'?1:7}
function scheduleCount(s){normalizeSchedule(s);return Math.ceil(s.calendarDays/scheduleStep(s))}
function schedulePeriodDays(s,index){const first=(index-1)*scheduleStep(s)+1;return Array.from({length:Math.max(0,Math.min(scheduleStep(s),s.calendarDays-first+1))},(_,i)=>first+i)}
function schedulePeriodState(s,row,index){const days=schedulePeriodDays(s,index),n=days.filter(d=>row.activeDays.includes(d)).length;return {marked:n>0,partial:n>0&&n<days.length,count:n,total:days.length}}
function scheduleDuration(s,row,pdf=false){const n=row.activeDays.length;if(s.unit==='days')return n+(pdf?' D.':' d.');const w=Math.floor(n/7),d=n%7;return d?(w?w+(pdf?'s ':' sem. '):'')+d+(pdf?'d':' d.'):w+(pdf?' SEM.':' sem.')}
function schedulePeriodDate(s,index){if(!s.start)return '';const d=new Date(s.start+'T12:00:00');d.setDate(d.getDate()+(index-1)*scheduleStep(s));return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')}
function syncLegacySchedule(s){s.weeks=Math.ceil(s.calendarDays/7);for(const r of s.rows)r.active=[...new Set(r.activeDays.map(d=>Math.ceil(d/7)))].sort((a,b)=>a-b)}
function setSchedulePeriod(s,row,index){const days=schedulePeriodDays(s,index),remove=days.some(d=>row.activeDays.includes(d));row.activeDays=remove?row.activeDays.filter(d=>!days.includes(d)):[...new Set([...row.activeDays,...days])].sort((a,b)=>a-b);syncLegacySchedule(s)}
function resizeSchedule(s,count){s.calendarDays=count*scheduleStep(s);for(const r of s.rows)r.activeDays=r.activeDays.filter(d=>d<=s.calendarDays);syncLegacySchedule(s)}
function rangeSchedule(s,row,start,end){row.activeDays=Array.from({length:end-start+1},(_,i)=>schedulePeriodDays(s,start+i)).flat();syncLegacySchedule(s)}
function scheduleDayISO(start,day){if(!start)return '';const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+day-1);return d.toISOString().slice(0,10)}
function scheduleIncidentDay(s,event){if(!s.start||!event.date)return null;return Math.round((Date.parse(event.date+'T12:00:00Z')-Date.parse(s.start+'T12:00:00Z'))/86400000)+1}
function schedulePeriodIncidents(s,index){const days=schedulePeriodDays(s,index);return (s.incidents||[]).filter(event=>days.includes(scheduleIncidentDay(s,event)))}
function scheduleSnapshot(s){const copy=structuredClone(s);normalizeSchedule(copy);return {start:copy.start,unit:copy.unit,calendarDays:copy.calendarDays,weeks:Math.ceil(copy.calendarDays/7),rows:copy.rows.map(r=>({id:r.id,name:r.name,group:!!r.group,activeDays:[...r.activeDays],active:[...new Set(r.activeDays.map(d=>Math.ceil(d/7)))].sort((a,b)=>a-b)})),incidents:structuredClone(copy.incidents)}}
function scheduleFingerprint(s){return JSON.stringify(scheduleSnapshot(s))}
function buildScheduleVersion(project,author,note,now=new Date().toISOString(),id=crypto.randomUUID()){if(!author.trim())throw Error('Escribe el nombre del responsable.');return {id,number:Math.max(0,...(project.scheduleVersions||[]).map(v=>v.number))+1,author:author.trim(),note:note.trim(),savedAt:now,snapshot:scheduleSnapshot(project.schedule)}}
const ForjaCalendar={normalizeSchedule,scheduleCount,schedulePeriodState,scheduleDuration,schedulePeriodDate,scheduleStep,setSchedulePeriod,resizeSchedule,rangeSchedule,scheduleDayISO,scheduleIncidentDay,schedulePeriodIncidents,scheduleSnapshot,scheduleFingerprint,buildScheduleVersion};
if(typeof module!=='undefined')module.exports=ForjaCalendar;

