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

function showApp() { loginGate.hidden = true; app.hidden = false; }

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
  idea: `<textarea id="sourceInput" placeholder="Ej. Cómo dejar de posponer lo importante cuando tienes demasiadas tareas y poco tiempo."></textarea><span class="field-note">Describe el tema, a quién va dirigido o el resultado que quieres lograr.</span>`,
  youtube: `<input id="sourceInput" type="url" placeholder="https://youtube.com/watch?v=…" /><div class="source-tabs" style="margin-top:10px"><button class="source-tab active" data-youtube-mode="reference">Usar como referencia</button><button class="source-tab" data-youtube-mode="clip">Cortar y reeditar</button></div><span class="field-note" id="youtubeNote">La IA analizará estructura, tema y ángulo para proponer contenido nuevo.</span>`,
  text: `<textarea id="sourceInput" placeholder="Pega aquí tu artículo, notas, brief o post."></textarea><span class="field-note">El sistema extraerá la idea central, los argumentos y las frases aprovechables.</span>`,
  pdf: `<input id="sourceInput" type="file" accept="application/pdf" /><span class="field-note">El archivo se guardará de forma privada en Vercel Blob al conectar el almacenamiento.</span>`,
  transcript: `<textarea id="sourceInput" placeholder="00:00 — Introducción\n00:28 — Idea principal\n01:14 — Ejemplo…"></textarea><span class="field-note">Incluye tiempos si quieres usar la transcripción para un futuro recorte de video.</span>`
};

let sourceType = 'idea';
let visualStyle = 'UGC';
let youtubeMode = 'reference';
let project = null;

function setSource(type) {
  sourceType = type;
  $$('.source-tab[data-source]').forEach(button => button.classList.toggle('active', button.dataset.source === type));
  $('#sourceBody').innerHTML = sourceTemplates[type];
  if (type === 'youtube') {
    $$('.source-tab[data-youtube-mode]').forEach(button => button.addEventListener('click', () => {
      youtubeMode = button.dataset.youtubeMode;
      $$('.source-tab[data-youtube-mode]').forEach(item => item.classList.toggle('active', item === button));
      $('#youtubeNote').textContent = youtubeMode === 'reference'
        ? 'La IA analizará estructura, tema y ángulo para proponer contenido nuevo.'
        : 'Usa solo material propio o autorizado. Se preparará una ruta de clips y reedición.';
    }));
  }
}

function spokenLanguage(language) {
  return { 'Español latino': 'español latino natural', 'Español colombiano': 'español colombiano cercano', 'Inglés (EE. UU.)': 'inglés estadounidense natural', 'Portugués brasileño': 'portugués brasileño natural' }[language];
}

function clean(value) { return value.trim().replace(/\s+/g, ' '); }
function cap(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

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
  const format = $('#format').value;
  const language = $('#language').value;
  if (sourceType === 'pdf') {
    $('.field-note').textContent = 'La carga de PDF necesita Vercel Blob. Configura el almacenamiento para continuar con esta fuente.';
    return;
  }
  const button = $('#createScript');
  button.disabled = true;
  button.textContent = 'Generando guion con IA…';
  let generated;
  try {
    const { response, body } = await request('/api/generate-script', { method: 'POST', body: JSON.stringify({ sourceType, source: raw, youtubeMode, format, language, visualStyle }) });
    if (!response.ok) throw new Error(body.error || 'No pudimos generar el guion.');
    generated = body.script;
  } catch (error) {
    $('.field-note').textContent = error.message;
    $('.field-note').style.color = '#d64632';
    return;
  } finally { button.disabled = false; button.innerHTML = 'Crear guion para revisión <b>↗</b>'; }
  const scenes = generated.scenes.map(scene => ({ time: scene.time, title: scene.title, script: scene.script, direction: scene.direction, visualPrompt: scene.visual_prompt, subtitle: scene.subtitle, cta: scene.cta }));
  project = { sourceType, source: raw, youtubeMode, format, language, visualStyle, title: generated.title, brief: generated.brief, hook: generated.hook, scenes, status: 'revisión' };
  $('#scriptTitle').textContent = `${format === 'long' ? 'Video 4–5 min' : 'Short / Reel'} · ${generated.title}`;
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

setSource('idea');
$$('.source-tab[data-source]').forEach(button => button.addEventListener('click', () => setSource(button.dataset.source)));
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
$('#renderTestBtn').addEventListener('click', createTestMp4);
$('#queueRender').addEventListener('click', () => {
  if (!project) return;
  const button = $('#queueRender');
  button.textContent = 'Render reservado — activa Blob y motor MP4';
  button.disabled = true;
  project.status = 'pendiente de render';
});
