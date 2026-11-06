const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const app = $('#app');
const loginGate = $('#loginGate');
const loginForm = $('#loginForm');
const loginError = $('#loginError');
const loginBtn = $('#loginBtn');

async function request(path, options = {}) {
  const sessionToken = sessionStorage.getItem('clipforge_session');
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...(options.headers || {}) },
    ...options
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
    if (response.ok) { if (body.token) sessionStorage.setItem('clipforge_session', body.token); loginForm.reset(); showApp(); }
    else loginError.textContent = body.error || 'Correo o contraseña incorrectos.';
  } catch { loginError.textContent = 'No fue posible iniciar sesión. Revisa tu conexión e inténtalo de nuevo.'; }
  finally { loginBtn.disabled = false; loginBtn.innerHTML = 'Entrar a ClipForge <b>↗</b>'; }
});

$('#logoutBtn').addEventListener('click', async () => {
  await request('/api/logout', { method: 'POST' });
  sessionStorage.removeItem('clipforge_session');
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

function renderProject() {
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
  const scenes = buildScenes(raw, format, language, visualStyle);
  project = { sourceType, source: raw, youtubeMode, format, language, visualStyle, scenes, status: 'revisión' };
  $('#scriptTitle').textContent = `${format === 'long' ? 'Video 4–5 min' : 'Short / Reel'} · ${cap(clean(raw)).slice(0, 76)}`;
  $('#strategy').innerHTML = `<div><label>ORIGEN</label><p>${sourceType === 'youtube' ? `YouTube · ${youtubeMode === 'clip' ? 'recorte autorizado' : 'referencia creativa'}` : cap(sourceType)}</p></div><div><label>ADAPTACIÓN</label><p>${language}</p></div><div><label>ESTILO</label><p>${visualStyle}</p></div>`;
  const output = $('#scriptOutput');
  output.innerHTML = '';
  scenes.forEach((scene, index) => {
    const card = document.createElement('article');
    card.className = 'review-card';
    card.innerHTML = `<div class="time">ESCENA ${String(index + 1).padStart(2, '0')} · ${scene.time}</div><h3>${scene.title}</h3><textarea aria-label="Texto de escena ${index + 1}">${scene.script}</textarea><p class="direction">DIRECCIÓN: ${scene.direction}</p>`;
    output.append(card);
  });
  $('#review').hidden = false;
  $('#review').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
$('#queueRender').addEventListener('click', () => {
  if (!project) return;
  const button = $('#queueRender');
  button.textContent = 'Pendiente de clave de producción';
  button.disabled = true;
  project.status = 'pendiente de render';
});
