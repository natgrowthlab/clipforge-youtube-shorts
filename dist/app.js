const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const app = $('#app');
const loginGate = $('#loginGate');
const loginForm = $('#loginForm');
const loginError = $('#loginError');
const loginBtn = $('#loginBtn');
let sessionToken = null;

function savedSession() {
  try { return window.sessionStorage?.getItem('clipforge_session') || sessionToken; }
  catch { return sessionToken; }
}

function saveSession(token) {
  sessionToken = token;
  try { window.sessionStorage?.setItem('clipforge_session', token); } catch {}
}

function clearSession() {
  sessionToken = null;
  try { window.sessionStorage?.removeItem('clipforge_session'); } catch {}
}

async function request(path, options = {}) {
  const token = savedSession();
  const { headers: extraHeaders, ...requestOptions } = options;
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...requestOptions,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extraHeaders || {}) }
  });
  return { response, body: await response.json().catch(() => ({})) };
}

function showApp() { loginGate.hidden = true; app.hidden = false; loadQueue(); }
setInterval(() => { if (!app.hidden) loadQueue(); }, 15000);

async function checkSession() {
  try { if ((await request('/api/session')).response.ok) showApp(); }
  catch { loginError.textContent = 'No fue posible conectar con el acceso. Inténtalo de nuevo.'; }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Comprobando…';
  try {
    const { response, body } = await request('/api/login', {
      method: 'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value })
    });
    if (response.ok) { if (body.token) saveSession(body.token); loginForm.reset(); showApp(); }
    else loginError.textContent = body.error || 'Correo o contraseña incorrectos.';
  } catch { loginError.textContent = 'No fue posible iniciar sesión. Revisa tu conexión e inténtalo de nuevo.'; }
  finally { loginBtn.disabled = false; loginBtn.innerHTML = 'Entrar a ClipForge <b>↗</b>'; }
});

$('#logoutBtn').addEventListener('click', async () => {
  await request('/api/logout', { method: 'POST' });
  clearSession();
  app.hidden = true;
  loginGate.hidden = false;
  $('#email').focus();
});

const sourceTemplates = {
  youtube: `<input id="sourceInput" type="url" placeholder="Pega un enlace de YouTube: https://youtube.com/watch?v=…" /><span class="field-note">Usa un video propio o material para el que tengas autorización de edición.</span><div id="clipControls" class="clip-only"><label class="rights-confirmation"><input id="clipAuthorized" type="checkbox" /> Confirmo que soy titular o tengo autorización para reeditar este material.</label><span class="field-note">ClipForge analiza el enlace, encuentra los mejores momentos y entrega varios clips subtitulados.</span><div class="clip-config"><div><label>GÉNERO<select id="clipGenre"><option>Detectar automáticamente</option><option>Podcast / entrevista</option><option>Educativo</option><option>Vlog</option><option>Gaming</option><option>Noticias / opinión</option><option>Producto / UGC</option></select></label><label>FORMATO<select id="clipAspect"><option value="9:16">Vertical · 9:16</option><option value="1:1">Cuadrado · 1:1</option><option value="16:9">Horizontal · 16:9</option></select></label></div><div><label>DURACIÓN<select id="clipLength"><option value="25-58">25–58 segundos</option><option value="15-30">15–30 segundos</option><option value="45-90">45–90 segundos</option></select></label><label>CANTIDAD<select id="clipCount"><option value="3">3 clips</option><option value="5" selected>5 clips</option><option value="8">Hasta 8 clips</option></select></label></div><label>AI COPILOT · QUÉ QUIERES ENCONTRAR<textarea id="clipPrompt" rows="2" placeholder="Ej. Encuentra los mejores consejos prácticos y respuestas contundentes."></textarea></label><div><label>CAPTIONS<select id="captionPreset"><option value="impact">Impacto · grandes</option><option value="clean">Limpias · sobrias</option><option value="podcast">Podcast · centradas</option></select></label><label>RANGO DEL VIDEO<select id="clipRange"><option value="full">Video completo</option><option value="intro">Primer tercio</option><option value="middle">Tercio central</option><option value="end">Último tercio</option></select></label></div></div></div>`
};

let sourceType = 'youtube';
let visualStyle = 'Podcast';
let youtubeMode = 'clip';
let project = null;

function setSource() {
  $('.hero').innerHTML = `<div class="eyebrow">CLIPPING AUTOMÁTICO PARA YOUTUBE</div><h1>Un video largo.<br><em>Varios clips</em> listos.</h1><p class="lead">Pega un enlace de YouTube autorizado. ClipForge encuentra los mejores momentos, los adapta y añade subtítulos.</p>`;
  $('.studio .source-tabs')?.remove();
  $('#format')?.closest('label')?.remove();
  $('#styleGrid')?.previousElementSibling?.remove();
  $('#styleGrid')?.remove();
  const panel = $('.studio .panel');
  if (panel) { panel.querySelector('.eyebrow').textContent = '01 · VIDEO DE YOUTUBE'; panel.querySelector('h2').textContent = 'Convierte un video en clips que vale la pena publicar.'; }
  $('#createScript').innerHTML = 'Analizar video y encontrar clips <b>↗</b>';
  ['renderTestBtn', 'voiceSelect', 'voiceBtn', 'composeBtn', 'renderFullBtn'].forEach(id => $(`#${id}`)?.remove());
  const productionText = $('.render-bar div p');
  if (productionText) productionText.textContent = 'Revisa el enfoque y envía el video a la cola. El motor creará los clips, los subtítulos y los enlaces de descarga.';
  $('#sourceBody').innerHTML = sourceTemplates.youtube;
}

function spokenLanguage(language) {
  return { 'Español latino': 'español latino natural', 'Español colombiano': 'español colombiano cercano', 'Inglés (EE. UU.)': 'inglés estadounidense natural', 'Portugués brasileño': 'portugués brasileño natural' }[language];
}

function clean(value) { return value.trim().replace(/\s+/g, ' '); }
function cap(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function estimatedCredits(item = project) {
  if (!item) return 0;
  const base = item.format === 'long' ? 8 : 3;
  return item.sourceType === 'youtube' && item.youtubeMode === 'clip' ? base + 4 : base;
}

function updateCostEstimate() {
  if (!project) return;
  const credits = estimatedCredits();
  $('#costEstimate').textContent = `Estimado para este proyecto: ${credits} créditos. El render se bloquea si supera tu límite.`;
  const budget = $('#budgetSelect');
  budget.value = credits > 8 ? '15' : credits > 3 ? '8' : '3';
}

async function loadQueue() {
  const list = $('#queueList');
  if (!list) return;
  try {
    const { response, body } = await request('/api/render-jobs');
    if (!response.ok || !body.jobs?.length) return;
    list.hidden = false;
    list.innerHTML = `<b>COLA DE PRODUCCIÓN</b><br>${body.jobs.slice(0, 5).map(job => {
      const outputs = Array.isArray(job.clips) && job.clips.length ? `<br>${job.clips.map((clip, index) => `<a href="${escapeHtml(clip.url)}" target="_blank" rel="noopener">Ver Short ${index + 1}: ${escapeHtml(clip.title)}${clip.viralityScore ? ` · ${escapeHtml(clip.viralityScore)}/100` : ''}</a><small>${escapeHtml(clip.description || '')} ${Array.isArray(clip.hashtags) ? escapeHtml(clip.hashtags.join(' ')) : ''}</small>`).join('<br>')}` : '';
      return `${escapeHtml(job.title)} · ${job.kind === 'clip-reedit' ? 'clips autorizados' : 'video generado'} · ${escapeHtml(job.status)} · ${job.estimatedCredits} créditos${outputs}`;
    }).join('<br>')}`;
  } catch { /* Queue remains optional if storage is unavailable. */ }
}

function buildScenes(brief, format, language, style) {
  const subject = clean(brief);
  const languageNote = `Habla en ${spokenLanguage(language)}.`;
  const directions = {
    UGC: 'Plano vertical de mano, luz natural y texto grande en pantalla.',
    Faceless: 'B-roll de apoyo, voz en off y captions dinámicos.',
    Podcast: 'Plano conversacional, cambios de encuadre y subtítulos centrados.',
    Educativo: 'Plano limpio, gráficos simples y palabras clave destacadas.',
    'Direct response': 'Ritmo rápido, promesa concreta, prueba visual y CTA visible.'
  };
  const long = format === 'long';
  const scripts = long ? [
    ['00:00–00:25', 'Hook y promesa', `“${cap(subject)}. Si esto te está costando, probablemente no es por falta de disciplina: es porque estás usando el enfoque equivocado.”`],
    ['00:25–01:10', 'El problema', `“La mayoría trata de resolverlo haciendo más. Pero eso solo crea más presión y menos claridad. Primero necesitamos identificar qué está bloqueando el siguiente paso.”`],
    ['01:10–02:35', 'La idea central', `“La clave es simplificar: toma ${subject.toLowerCase()} y conviértelo en una decisión pequeña, visible y medible. Eso cambia la forma en que avanzas.”`],
    ['02:35–03:45', 'Ejemplo aplicable', `“Imagina que mañana tienes poco tiempo. No busques terminarlo todo; busca una señal de progreso. Esa señal te ayuda a ajustar sin abandonar.”`],
    ['03:45–04:50', 'Cierre y CTA', `“Quédate con esto: ${subject}. Prueba una acción esta semana y observa qué cambia. Si quieres volver a aplicarlo, guarda este video.”`]
  ] : [
    ['00:00–00:05', 'Hook', `“Si ${subject.toLowerCase()} te está frenando, escucha esto.”`],
    ['00:05–00:15', 'Tensión', `“La mayoría intenta arreglarlo haciendo más. Pero el problema no es esfuerzo: es no tener un siguiente paso claro.”`],
    ['00:15–00:38', 'Valor', `“Haz esto: define una acción mínima, ejecútala hoy y mide una sola señal. No necesitas un plan perfecto; necesitas movimiento con intención.”`],
    ['00:38–00:55', 'Remate + CTA', `“No se trata de resolver ${subject.toLowerCase()} de una vez. Se trata de empezar de una forma que puedas repetir. Guárdalo para aplicarlo.”`]
  ];
  return scripts.map(([time, title, script]) => ({ time, title, script, direction: `${directions[style]} ${languageNote}` }));
}

async function renderProject() {
  const input = $('#sourceInput');
  const raw = input?.type === 'file' ? input.files?.[0]?.name : input?.value;
  if (!raw || clean(raw).length < 10) {
    const note = $('.field-note') || $('#sourceBody');
    note.textContent = 'Añade una idea, texto o referencia más concreta para crear el guion.';
    note.style.color = '#d64632';
    return;
  }
  const format = 'short';
  const language = $('#language').value;
  let sourceAsset = null;
  if (sourceType === 'pdf') {
    $('.field-note').textContent = 'La carga de PDF necesita Vercel Blob. Configura el almacenamiento para continuar con esta fuente.';
    return;
  }
  const button = $('#createScript');
  button.disabled = true;
  button.textContent = 'Generando guion con IA…';
  let generated;
  try {
    if (sourceType === 'youtube' && youtubeMode === 'clip' && !$('#clipAuthorized')?.checked) throw new Error('Confirma que tienes autorización para reeditar este material.');
    const { response, body } = await request('/api/generate-script', { method: 'POST', body: JSON.stringify({ sourceType, source: raw, youtubeMode, format, language, visualStyle }) });
    if (!response.ok) throw new Error(body.error || 'No pudimos generar el guion.');
    generated = body.script;
  } catch (error) {
    $('.field-note').textContent = error.message;
    $('.field-note').style.color = '#d64632';
    return;
  } finally { button.disabled = false; button.innerHTML = 'Crear guion para revisión <b>↗</b>'; }
  const scenes = generated.scenes.map(scene => ({ time: scene.time, title: scene.title, script: scene.script, direction: scene.direction, visualPrompt: scene.visual_prompt, subtitle: scene.subtitle, cta: scene.cta }));
  const clipSettings = sourceType === 'youtube' && youtubeMode === 'clip' ? { genre: $('#clipGenre')?.value, aspectRatio: $('#clipAspect')?.value, duration: $('#clipLength')?.value, clipCount: Number($('#clipCount')?.value || 5), prompt: $('#clipPrompt')?.value?.trim(), captionPreset: $('#captionPreset')?.value, range: $('#clipRange')?.value } : null;
  project = { sourceType, source: raw, sourceAsset, rightsConfirmed: Boolean($('#clipAuthorized')?.checked), youtubeMode, format, language, visualStyle, clipSettings, title: generated.title, brief: generated.brief, hook: generated.hook, scenes, status: 'revisión' };
  updateCostEstimate();
  $('#scriptTitle').textContent = `Plan de clips · ${generated.title}`;
  $('#strategy').innerHTML = `<div><label>IDEA CENTRAL</label><p>${escapeHtml(generated.brief)}</p></div><div><label>HOOK</label><p>${escapeHtml(generated.hook)}</p></div><div><label>ESTILO</label><p>${escapeHtml(visualStyle)} · ${escapeHtml(language)}</p></div>`;
  const output = $('#scriptOutput');
  output.innerHTML = '';
  scenes.forEach((scene, index) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.innerHTML = `<div class="time">ESCENA ${String(index + 1).padStart(2, '0')} · ${escapeHtml(scene.time)}</div><h3>${escapeHtml(scene.title)}</h3><textarea aria-label="Texto de escena ${index + 1}">${escapeHtml(scene.script)}</textarea><p class="direction">DIRECCIÓN: ${escapeHtml(scene.direction)}<br>VISUAL: ${escapeHtml(scene.visualPrompt)}<br>SUBTÍTULO: ${escapeHtml(scene.subtitle)}<br>CTA: ${escapeHtml(scene.cta)}</p>`;
    output.append(card);
  });
  $('#review').hidden = false;
  $('#review').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function wrapText(context, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
    else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

async function createTestMp4() {
  if (!project) return;
  const button = $('#renderTestBtn');
  const note = $('.field-note');
  if (!window.VideoEncoder || !window.VideoFrame) {
    note.textContent = 'Este navegador no puede codificar MP4. Abre ClipForge en Chrome actualizado para generar la prueba.';
    note.style.color = '#d64632';
    return;
  }
  button.disabled = true;
  button.textContent = 'Codificando prueba…';
  try {
    const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs');
    const width = 540, height = 960, fps = 30, seconds = 12, frameDuration = 1_000_000 / fps;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, fastStart: 'in-memory', video: { codec: 'avc', width, height, frameRate: fps } });
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: error => { throw error; } });
    const support = await VideoEncoder.isConfigSupported({ codec: 'avc1.42001f', width, height, bitrate: 1_600_000, framerate: fps });
    if (!support.supported) throw new Error('Tu navegador no tiene codificador H.264 disponible.');
    encoder.configure(support.config);
    const totalFrames = seconds * fps;
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const sceneIndex = Math.min(project.scenes.length - 1, Math.floor(frameIndex / totalFrames * project.scenes.length));
      const scene = project.scenes[sceneIndex];
      const progress = frameIndex / totalFrames;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#17201a'); gradient.addColorStop(0.6, '#384a2e'); gradient.addColorStop(1, '#b7ef52');
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(255,255,255,.1)'; context.beginPath(); context.arc(500 - progress * 230, 120 + progress * 90, 250, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#d7ff87'; context.font = '600 19px DM Mono, monospace'; context.fillText(`CLIPFORGE  /  ESCENA ${String(sceneIndex + 1).padStart(2, '0')}`, 42, 80);
      context.fillStyle = '#f7f5ed'; context.font = '600 42px Georgia, serif';
      let y = 180; wrapText(context, scene.title, 450).slice(0, 3).forEach(line => { context.fillText(line, 42, y); y += 53; });
      context.fillStyle = 'rgba(9,15,11,.72)'; context.fillRect(34, 430, 472, 280);
      context.fillStyle = '#ffffff'; context.font = '400 24px Arial, sans-serif';
      y = 475; wrapText(context, scene.script, 420).slice(0, 7).forEach(line => { context.fillText(line, 60, y); y += 34; });
      context.fillStyle = '#17201a'; context.fillRect(42, 850, 456 * progress, 8);
      context.fillStyle = 'rgba(255,255,255,.78)'; context.font = '500 16px Arial, sans-serif'; context.fillText('PRUEBA SILENCIOSA · 12 SEGUNDOS', 42, 900);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(frameIndex * frameDuration), duration: Math.round(frameDuration) });
      encoder.encode(frame, { keyFrame: frameIndex % fps === 0 });
      frame.close();
    }
    await encoder.flush(); encoder.close(); muxer.finalize();
    const mp4 = new Blob([target.buffer], { type: 'video/mp4' });
    const { response, body } = await request('/api/upload-render', { method: 'POST', body: mp4, headers: { 'Content-Type': 'video/mp4', 'X-Project-Title': project.title } });
    if (!response.ok) throw new Error(body.error || 'No pudimos guardar el MP4.');
    const link = document.createElement('a'); link.href = body.downloadUrl || body.url; link.download = `${project.title || 'clipforge-prueba'}.mp4`; link.textContent = 'Descargar MP4 de prueba'; link.target = '_blank';
    link.style.cssText = 'display:inline-block;margin-top:12px;font:600 12px DM Mono;color:#17201a;text-decoration:underline';
    const oldLink = $('#renderDownload'); if (oldLink) oldLink.remove(); link.id = 'renderDownload'; $('#review').append(link);
    button.textContent = 'MP4 listo ✓';
  } catch (error) {
    note.textContent = error.message || 'No pudimos crear la prueba MP4.';
    note.style.color = '#d64632';
    button.disabled = false;
    button.textContent = 'MP4 de prueba · 12 s';
  }
}

async function createFullVisual() {
  if (!project) return;
  const button = $('#renderFullBtn');
  const note = $('.field-note');
  if (!window.VideoEncoder || !window.VideoFrame) {
    note.textContent = 'Este navegador no puede codificar MP4. Abre ClipForge en Chrome actualizado.';
    note.style.color = '#d64632';
    return;
  }
  button.disabled = true;
  button.textContent = 'Renderizando…';
  try {
    const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs');
    const { upload } = await import('https://esm.sh/@vercel/blob@2.8.2/client');
    const isLong = project.format === 'long';
    const width = isLong ? 1280 : 540, height = isLong ? 720 : 960, fps = isLong ? 5 : 10;
    const seconds = isLong ? 270 : 45, frameDuration = 1_000_000 / fps;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, fastStart: 'in-memory', video: { codec: 'avc', width, height, frameRate: fps } });
    const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: error => { throw error; } });
    const support = await VideoEncoder.isConfigSupported({ codec: 'avc1.42001f', width, height, bitrate: isLong ? 280_000 : 450_000, framerate: fps });
    if (!support.supported) throw new Error('Tu navegador no tiene codificador H.264 disponible.');
    encoder.configure(support.config);
    const totalFrames = seconds * fps, sceneFrames = Math.ceil(totalFrames / project.scenes.length), margin = Math.round(width * .08), contentWidth = width - margin * 2;
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const sceneIndex = Math.min(project.scenes.length - 1, Math.floor(frameIndex / sceneFrames));
      const scene = project.scenes[sceneIndex];
      const sceneProgress = (frameIndex % sceneFrames) / sceneFrames;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#142219'); gradient.addColorStop(.6, isLong ? '#213d46' : '#384a2e'); gradient.addColorStop(1, '#b7ef52');
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(255,255,255,.11)'; context.beginPath(); context.arc(width * .83 - sceneProgress * width * .18, height * .17, width * .22, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#d7ff87'; context.font = `600 ${Math.round(width * .028)}px DM Mono, monospace`; context.fillText(`CLIPFORGE  /  ${isLong ? 'YOUTUBE' : 'SHORT'}  /  ${String(sceneIndex + 1).padStart(2, '0')}`, margin, Math.round(height * .1));
      context.fillStyle = '#f7f5ed'; context.font = `600 ${Math.round(width * (isLong ? .052 : .078))}px Georgia, serif`;
      let y = Math.round(height * .25); wrapText(context, scene.title, contentWidth).slice(0, 3).forEach(line => { context.fillText(line, margin, y); y += Math.round(width * .075); });
      const boxY = isLong ? Math.round(height * .5) : Math.round(height * .48), boxH = isLong ? Math.round(height * .28) : Math.round(height * .31);
      context.fillStyle = 'rgba(9,15,11,.72)'; context.fillRect(margin - 16, boxY, contentWidth + 32, boxH);
      context.fillStyle = '#fff'; context.font = `400 ${Math.round(width * (isLong ? .027 : .045))}px Arial, sans-serif`;
      y = boxY + Math.round(width * .06); wrapText(context, scene.script, contentWidth - 36).slice(0, isLong ? 5 : 7).forEach(line => { context.fillText(line, margin, y); y += Math.round(width * (isLong ? .04 : .062)); });
      const progress = frameIndex / totalFrames; context.fillStyle = '#17201a'; context.fillRect(margin, height - Math.round(height * .1), contentWidth * progress, 9);
      context.fillStyle = 'rgba(255,255,255,.75)'; context.font = `500 ${Math.round(width * .022)}px Arial, sans-serif`; context.fillText('RENDER VISUAL · SIN NARRACIÓN', margin, height - Math.round(height * .045));
      const frame = new VideoFrame(canvas, { timestamp: Math.round(frameIndex * frameDuration), duration: Math.round(frameDuration) });
      encoder.encode(frame, { keyFrame: frameIndex % fps === 0 }); frame.close();
    }
    await encoder.flush(); encoder.close(); muxer.finalize();
    const mp4 = new Blob([target.buffer], { type: 'video/mp4' });
    button.textContent = 'Subiendo render…';
    const stored = await upload(`renders/${Date.now()}-${(project.title || 'clipforge').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`, mp4, {
      access: 'public', handleUploadUrl: '/api/blob-client-upload', headers: savedSession() ? { Authorization: `Bearer ${savedSession()}` } : {}, contentType: 'video/mp4'
    });
    const link = document.createElement('a'); link.href = stored.downloadUrl || stored.url; link.download = `${project.title || 'clipforge-render'}.mp4`; link.textContent = 'Descargar render visual completo'; link.target = '_blank';
    link.style.cssText = 'display:inline-block;margin-top:12px;font:600 12px DM Mono;color:#17201a;text-decoration:underline';
    const oldLink = $('#fullRenderDownload'); if (oldLink) oldLink.remove(); link.id = 'fullRenderDownload'; $('#review').append(link);
    button.textContent = 'Render visual listo ✓';
  } catch (error) {
    note.textContent = error.message || 'No pudimos crear el render visual.'; note.style.color = '#d64632';
    button.disabled = false; button.textContent = 'Render visual completo';
  }
}

async function createAiVoice() {
  if (!project) return;
  const button = $('#voiceBtn');
  const note = $('.field-note');
  const script = $$('.review-card textarea').map(field => field.value.trim()).filter(Boolean).join(' ');
  button.disabled = true;
  button.textContent = 'Generando voz…';
  try {
    const { response, body } = await request('/api/generate-voice', {
      method: 'POST', body: JSON.stringify({ script, voice: $('#voiceSelect').value, title: project.title, language: project.language })
    });
    if (!response.ok) throw new Error(body.error || 'No pudimos generar la voz IA.');
    const old = $('#voiceOutput'); if (old) old.remove();
    const output = document.createElement('div'); output.id = 'voiceOutput'; output.style.cssText = 'margin-top:12px;display:grid;gap:8px;font:12px DM Sans;color:#17201a';
    const disclosure = document.createElement('span'); disclosure.textContent = 'Narración generada con IA.';
    const audio = document.createElement('audio'); audio.controls = true; audio.src = body.url;
    const link = document.createElement('a'); link.href = body.downloadUrl || body.url; link.textContent = 'Descargar narración MP3'; link.target = '_blank';
    output.append(disclosure, audio, link); $('#review').append(output);
    button.textContent = 'Voz IA lista ✓';
  } catch (error) {
    note.textContent = error.message || 'No pudimos generar la voz IA.'; note.style.color = '#d64632';
    button.disabled = false; button.textContent = 'Generar voz IA';
  }
}

async function composeMp4WithVoice() {
  if (!project) return;
  const audioUrl = $('#voiceOutput audio')?.src;
  const button = $('#composeBtn');
  const note = $('.field-note');
  if (!audioUrl) {
    note.textContent = 'Primero genera una voz IA para este guion.'; note.style.color = '#d64632';
    return;
  }
  if (!window.VideoEncoder || !window.AudioEncoder || !window.AudioData || !window.VideoFrame) {
    note.textContent = 'Este navegador no puede componer audio y video. Abre ClipForge en Chrome actualizado.'; note.style.color = '#d64632';
    return;
  }
  button.disabled = true; button.textContent = 'Preparando audio…';
  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error('No pudimos cargar la narración generada.');
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(await audioResponse.arrayBuffer());
    await audioContext.close();
    const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs');
    const { upload } = await import('https://esm.sh/@vercel/blob@2.8.2/client');
    const isLong = project.format === 'long';
    const width = isLong ? 1280 : 540, height = isLong ? 720 : 960, fps = isLong ? 5 : 10;
    const minDuration = isLong ? 240 : 45, maxDuration = isLong ? 300 : 60;
    const seconds = Math.max(minDuration, Math.min(maxDuration, Math.ceil(audioBuffer.duration)));
    const frameDuration = 1_000_000 / fps, sampleRate = audioBuffer.sampleRate, channels = Math.min(2, audioBuffer.numberOfChannels);
    const videoConfig = { codec: 'avc1.42001f', width, height, bitrate: isLong ? 280_000 : 450_000, framerate: fps };
    const audioConfig = { codec: 'mp4a.40.2', sampleRate, numberOfChannels: channels, bitrate: 96_000 };
    const [videoSupport, audioSupport] = await Promise.all([VideoEncoder.isConfigSupported(videoConfig), AudioEncoder.isConfigSupported(audioConfig)]);
    if (!videoSupport.supported || !audioSupport.supported) throw new Error('Tu navegador no tiene los codificadores H.264/AAC necesarios.');
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, fastStart: 'in-memory', video: { codec: 'avc', width, height, frameRate: fps }, audio: { codec: 'aac', sampleRate, numberOfChannels: channels } });
    const videoEncoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: error => { throw error; } });
    const audioEncoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: error => { throw error; } });
    videoEncoder.configure(videoSupport.config); audioEncoder.configure(audioSupport.config);
    const totalFrames = seconds * fps, sceneFrames = Math.ceil(totalFrames / project.scenes.length), margin = Math.round(width * .08), contentWidth = width - margin * 2;
    button.textContent = 'Componiendo video…';
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const sceneIndex = Math.min(project.scenes.length - 1, Math.floor(frameIndex / sceneFrames)); const scene = project.scenes[sceneIndex];
      const gradient = context.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, '#142219'); gradient.addColorStop(.6, isLong ? '#213d46' : '#384a2e'); gradient.addColorStop(1, '#b7ef52'); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(255,255,255,.11)'; context.beginPath(); context.arc(width * .8 - (frameIndex % sceneFrames) / sceneFrames * width * .18, height * .17, width * .22, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#d7ff87'; context.font = `600 ${Math.round(width * .028)}px DM Mono, monospace`; context.fillText(`CLIPFORGE  /  CON VOZ IA  /  ${String(sceneIndex + 1).padStart(2, '0')}`, margin, Math.round(height * .1));
      context.fillStyle = '#f7f5ed'; context.font = `600 ${Math.round(width * (isLong ? .052 : .078))}px Georgia, serif`; let y = Math.round(height * .25);
      wrapText(context, scene.title, contentWidth).slice(0, 3).forEach(line => { context.fillText(line, margin, y); y += Math.round(width * .075); });
      const boxY = isLong ? Math.round(height * .5) : Math.round(height * .48), boxH = isLong ? Math.round(height * .28) : Math.round(height * .31);
      context.fillStyle = 'rgba(9,15,11,.72)'; context.fillRect(margin - 16, boxY, contentWidth + 32, boxH); context.fillStyle = '#fff'; context.font = `400 ${Math.round(width * (isLong ? .027 : .045))}px Arial, sans-serif`; y = boxY + Math.round(width * .06);
      wrapText(context, scene.script, contentWidth - 36).slice(0, isLong ? 5 : 7).forEach(line => { context.fillText(line, margin, y); y += Math.round(width * (isLong ? .04 : .062)); });
      const progress = frameIndex / totalFrames; context.fillStyle = '#17201a'; context.fillRect(margin, height - Math.round(height * .1), contentWidth * progress, 9);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(frameIndex * frameDuration), duration: Math.round(frameDuration) }); videoEncoder.encode(frame, { keyFrame: frameIndex % fps === 0 }); frame.close();
    }
    button.textContent = 'Codificando narración…';
    const framesPerChunk = 1024;
    for (let offset = 0; offset < audioBuffer.length; offset += framesPerChunk) {
      const frameCount = Math.min(framesPerChunk, audioBuffer.length - offset); const data = new Float32Array(frameCount * channels);
      for (let channel = 0; channel < channels; channel += 1) { const source = audioBuffer.getChannelData(channel); for (let index = 0; index < frameCount; index += 1) data[index * channels + channel] = source[offset + index]; }
      const audioData = new AudioData({ format: 'f32', sampleRate, numberOfFrames: frameCount, numberOfChannels: channels, timestamp: Math.round(offset * 1_000_000 / sampleRate), data });
      audioEncoder.encode(audioData); audioData.close();
    }
    await Promise.all([videoEncoder.flush(), audioEncoder.flush()]); videoEncoder.close(); audioEncoder.close(); muxer.finalize();
    button.textContent = 'Subiendo MP4…'; const mp4 = new Blob([target.buffer], { type: 'video/mp4' });
    const stored = await upload(`renders/${Date.now()}-${(project.title || 'clipforge').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-con-voz.mp4`, mp4, { access: 'public', handleUploadUrl: '/api/blob-client-upload', headers: savedSession() ? { Authorization: `Bearer ${savedSession()}` } : {}, contentType: 'video/mp4' });
    const old = $('#composedRenderDownload'); if (old) old.remove(); const link = document.createElement('a'); link.id = 'composedRenderDownload'; link.href = stored.downloadUrl || stored.url; link.target = '_blank'; link.textContent = 'Descargar MP4 final con voz IA'; link.style.cssText = 'display:inline-block;margin-top:12px;font:600 12px DM Mono;color:#17201a;text-decoration:underline'; $('#review').append(link);
    button.textContent = 'MP4 con voz listo ✓';
  } catch (error) {
    note.textContent = error.message || 'No pudimos componer el MP4 con voz.'; note.style.color = '#d64632'; button.disabled = false; button.textContent = 'Componer MP4 + voz';
  }
}

setSource();
$$('.style-card').forEach(button => button.addEventListener('click', () => {
  visualStyle = button.dataset.style;
  $$('.style-card').forEach(item => item.classList.toggle('active', item === button));
}));
$('#createScript').addEventListener('click', renderProject);
$('#copyBtn').addEventListener('click', async () => {
  if (!project) return;
  const edited = $$('.review-card textarea').map((field, index) => ({ ...project.scenes[index], script: field.value }));
  await navigator.clipboard.writeText(edited.map(scene => `${scene.time} · ${scene.title}\n${scene.script}\nDirección: ${scene.direction}`).join('\n\n'));
  $('#copyBtn').textContent = 'Copiado ✓';
  setTimeout(() => { $('#copyBtn').textContent = 'Copiar'; }, 1400);
});
$('#downloadBtn').addEventListener('click', () => {
  if (!project) return;
  project.scenes = $$('.review-card textarea').map((field, index) => ({ ...project.scenes[index], script: field.value }));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }));
  link.download = 'clipforge-proyecto.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
$('#renderTestBtn')?.addEventListener('click', createTestMp4);
$('#renderFullBtn')?.addEventListener('click', createFullVisual);
$('#voiceBtn')?.addEventListener('click', createAiVoice);
$('#composeBtn')?.addEventListener('click', composeMp4WithVoice);
$('#queueRender').addEventListener('click', async () => {
  if (!project) return;
  const button = $('#queueRender');
  project.scenes = $$('.review-card textarea').map((field, index) => ({ ...project.scenes[index], script: field.value }));
  button.disabled = true; button.textContent = 'Enviando a cola…';
  try {
    const { response, body } = await request('/api/render-jobs', { method: 'POST', body: JSON.stringify({ ...project, maxCredits: Number($('#budgetSelect').value) }) });
    if (!response.ok) throw new Error(body.error || 'No pudimos crear el trabajo.');
    project.status = 'queued';
    $('#queueStatus').textContent = `En cola · ${body.job.kind === 'clip-reedit' ? 'analizando el enlace para crear Shorts' : 'video generado'} · máximo ${body.job.maxCredits} créditos.`;
    button.textContent = 'Enviado ✓';
    await loadQueue();
  } catch (error) {
    $('#queueStatus').textContent = error.message; $('#queueStatus').style.color = '#a92820';
    button.disabled = false; button.textContent = 'Enviar a cola de render';
  }
});
