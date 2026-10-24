const $ = s => document.querySelector(s);
const clips = [
  {title:'La creencia que te frena', duration:'00:18 — 00:52 · 34 s', thesis:'Abre con la fricción más reconocible y cambia la perspectiva rápido.', hook:'Si todavía haces esto para avanzar, estás perdiendo tiempo.', cut:'CORTE: reacción + ejemplo', cta:'CTA: ¿Te pasa?', score:'RETENCIÓN 92%'},
  {title:'El método en 3 pasos', duration:'03:14 — 04:00 · 46 s', thesis:'Una pieza guardable: marco simple, ritmo ágil y texto en pantalla.', hook:'No necesitas más disciplina. Necesitas este orden.', cut:'CORTE: 3 beats visuales', cta:'CTA: Guárdalo', score:'GUARDADOS ALTO'},
  {title:'La objeción incómoda', duration:'08:40 — 09:27 · 47 s', thesis:'Convierte la duda natural de la audiencia en una conversación.', hook:'“Eso suena bien, pero no funciona para mí.” Justo por eso.', cut:'CORTE: pausa antes del giro', cta:'CTA: Debate abajo', score:'COMENTARIOS ALTO'},
  {title:'La frase que se queda', duration:'12:06 — 12:36 · 30 s', thesis:'Una idea contundente, aislada del contexto y diseñada para compartir.', hook:'Tu problema no es falta de tiempo; es falta de decisión.', cut:'CORTE: punch-in al remate', cta:'CTA: Envíalo a alguien', score:'COMPARTIBLE'},
  {title:'El cierre con promesa', duration:'16:21 — 17:10 · 49 s', thesis:'Cierra la serie con una transformación concreta y un siguiente paso.', hook:'Cuando entiendes esto, todo el sistema se vuelve más ligero.', cut:'CORTE: antes / después', cta:'CTA: Parte 2', score:'SERIE POTENCIAL'}
];
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
$('#addTranscript').addEventListener('click',()=>{const text=prompt('Pega una transcripción con marcas de tiempo. Esta versión guardará tu contenido en el navegador.');if(text?.trim()){localStorage.setItem('clipforge-transcript',text.trim());$('#addTranscript').textContent='Transcripción guardada ✓'}});
