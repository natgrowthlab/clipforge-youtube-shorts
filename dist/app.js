const $ = s => document.querySelector(s);
const clips = [
  {title:'La creencia que te frena', duration:'00:18 — 00:52 · 34 s', thesis:'Abre con la fricción más reconocible y cambia la perspectiva rápido.', hook:'Si todavía haces esto para avanzar, estás perdiendo tiempo.', cut:'CORTE: reacción + ejemplo', cta:'CTA: ¿Te pasa?', score:'RETENCIÓN 92%'},
  {title:'El método en 3 pasos', duration:'03:14 — 04:00 · 46 s', thesis:'Una pieza guardable: marco simple, ritmo ágil y texto en pantalla.', hook:'No necesitas más disciplina. Necesitas este orden.', cut:'CORTE: 3 beats visuales', cta:'CTA: Guárdalo', score:'GUARDADOS ALTO'},
  {title:'La objeción incómoda', duration:'08:40 — 09:27 · 47 s', thesis:'Convierte la duda natural de la audiencia en una conversación.', hook:'“Eso suena bien, pero no funciona para mí.” Justo por eso.', cut:'CORTE: pausa antes del giro', cta:'CTA: Debate abajo', score:'COMENTARIOS ALTO'},
  {title:'La frase que se queda', duration:'12:06 — 12:36 · 30 s', thesis:'Una idea contundente, aislada del contexto y diseñada para compartir.', hook:'Tu problema no es falta de tiempo; es falta de decisión.', cut:'CORTE: punch-in al remate', cta:'CTA: Envíalo a alguien', score:'COMPARTIBLE'},
  {title:'El cierre con promesa', duration:'16:21 — 17:10 · 49 s', thesis:'Cierra la serie con una transformación concreta y un siguiente paso.', hook:'Cuando entiendes esto, todo el sistema se vuelve más ligero.', cut:'CORTE: antes / después', cta:'CTA: Parte 2', score:'SERIE POTENCIAL'}
];
const demoTranscript = `00:00 - Hoy quiero hablarte de la idea que casi todos tienen sobre avanzar más rápido.
00:28 - El primer problema es que confundes movimiento con progreso.
01:14 - La mayoría abre diez frentes y luego llama a eso ambición.
02:06 - Cuando hay demasiadas opciones, la energía se va en decidir.
03:14 - El método empieza por elegir una sola palanca para esta semana.
04:00 - Después defines la señal que te dirá si funcionó.
05:18 - Esto no es falta de disciplina; es falta de un orden visible.
06:42 - La objeción que siempre aparece es: mi caso es diferente.
08:40 - Precisamente porque tu caso es diferente, necesitas un criterio.
10:04 - Una buena decisión elimina muchas decisiones pequeñas.
12:06 - Tu problema no es falta de tiempo; es falta de decisión.
14:22 - Si cambias el orden, cambias la experiencia completa.
16:21 - Cuando entiendes esto, todo el sistema se vuelve más ligero.`;
function videoId(value){const m=value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);return m?.[1]}
function titleFrom(id){return id ? `Episodio ${id.slice(0,6).toUpperCase()}` : 'Tu episodio'}
function renderPlan(){
 const url=$('#youtubeUrl').value.trim(), id=videoId(url), supplied=$('#episodeTitle').value.trim();
 const hint=$('#hint');
 if(!id){hint.textContent='Revisa el enlace: usa una URL pública de youtube.com o youtu.be.';hint.style.color='#ff9d8e';$('#youtubeUrl').focus();return}
 hint.style.color=''; hint.textContent='Plan generado. Las ventanas son creativas hasta que añadas una transcripción con timecodes.';
 const name=supplied || titleFrom(id), format=document.querySelector('.pill.active').dataset.format;
 $('#resultTitle').textContent=`${name}: 5 clips para ${format}`;
 $('#strategy').innerHTML=`<div><label>ÁNGULO CENTRAL</label><p>Convertir una idea densa en una secuencia de descubrimientos cortos.</p></div><div><label>AUDIENCIA</label><p>Personas curiosas que quieren una respuesta clara, no un resumen.</p></div><div><label>ARCO DE PUBLICACIÓN</label><p>Dolor → método → objeción → frase → promesa.</p></div>`;
 const grid=$('#clipGrid'); grid.innerHTML=''; const template=$('#clipTemplate');
 clips.forEach((c,i)=>{const node=template.content.cloneNode(true);node.querySelector('.clip-number').textContent=`CLIP ${String(i+1).padStart(2,'0')}`;node.querySelector('.score').textContent=c.score;node.querySelector('.duration').textContent=c.duration;node.querySelector('h3').textContent=c.title;node.querySelector('.thesis').textContent=c.thesis;node.querySelector('q').textContent=c.hook;node.querySelector('.cut').textContent=c.cut;node.querySelector('.cta').textContent=c.cta;grid.append(node)});
 $('#results').hidden=false;$('#results').scrollIntoView({behavior:'smooth',block:'start'});
 window.currentPlan={source:url,videoId:id,episode:name,format,clips};
}
$('#analyzeBtn').addEventListener('click',renderPlan);
$('#youtubeUrl').addEventListener('keydown',e=>{if(e.key==='Enter')renderPlan()});
document.querySelectorAll('.pill').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.pill').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));
$('#copyBtn').addEventListener('click',async()=>{if(!window.currentPlan)return;const t=window.currentPlan.clips.map((c,i)=>`${i+1}. ${c.title}\n${c.hook}\n${c.duration}\n${c.cta}`).join('\n\n');await navigator.clipboard.writeText(`PLAN · ${window.currentPlan.episode}\n\n${t}`);$('#copyBtn').textContent='Copiado ✓';setTimeout(()=>$('#copyBtn').textContent='Copiar plan',1600)});
$('#downloadBtn').addEventListener('click',()=>{if(!window.currentPlan)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(window.currentPlan,null,2)],{type:'application/json'}));a.download='clipforge-plan.json';a.click();URL.revokeObjectURL(a.href)});
const dialog=$('#transcriptDialog');
function seconds(time){const p=time.split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1]}
function stamp(n){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
function parseTranscript(text){return text.split('\n').map(line=>{const m=line.match(/(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s*(?:-|–|—)?\s*(.*)/);return m?{time:seconds(m[1]),text:m[2].trim()}:null}).filter(Boolean)}
function addRealTimecodes(text){const rows=parseTranscript(text);if(rows.length<3){$('#transcriptStatus').textContent='Añade al menos 3 líneas con tiempo.';return false}const cards=[...document.querySelectorAll('.clip-card')];cards.forEach((card,i)=>{const point=rows[Math.min(Math.floor((i+1)*rows.length/6),rows.length-1)];const end=rows[Math.min(Math.floor((i+2)*rows.length/6),rows.length-1)]||{time:point.time+38};card.querySelector('.duration').textContent=`${stamp(point.time)} — ${stamp(Math.max(point.time+20,end.time))} · CORTE REAL`;card.querySelector('.thesis').textContent=point.text||card.querySelector('.thesis').textContent});window.currentPlan.transcript=text;window.currentPlan.timecoded=true;localStorage.setItem('clipforge-transcript',text);$('#addTranscript').textContent='Timecodes aplicados ✓';$('#transcriptStatus').textContent=`${rows.length} segmentos procesados`;return true}
$('#addTranscript').addEventListener('click',()=>{const saved=localStorage.getItem('clipforge-transcript');$('#transcriptText').value=saved||demoTranscript;$('#transcriptStatus').textContent='';dialog.showModal()});
$('#saveTranscript').addEventListener('click',event=>{event.preventDefault();if(addRealTimecodes($('#transcriptText').value)){dialog.close()}});
