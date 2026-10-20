/* Tablero de Vida Diario Inteligente v2 */
const MODEL = 'claude-3-5-haiku-20241022'; // Cambia aquí el modelo si lo retiran
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 400;
const MAX_CHARS = 6000;

const LS = {
  key: 'tv_api_key', week: 'tv_week', draft: 'tv_draft', state: 'tv_state',
  manana: 'tv_manana', recs: 'tv_recs', hist: 'tv_history', notif: 'tv_notif', notified: 'tv_notified',
};

// [nombre, inicio, fin, energía, fijo]  (fijo = clase o hábito que no se mueve)
const mk = (d, l) => l.map(([nombre, inicio, fin, energia, fijo], i) => ({ id: `${d}-${i}`, nombre, inicio, fin, energia, fijo: !!fijo }));
const DEFAULT_WEEK = {
  1: mk(1, [
    ['Clase: Cálculo Integral', '06:00', '07:45', 'baja', 1],
    ['Ejercicio de fuerza + desayuno', '08:30', '09:30', 'alta'],
    ['Programación (Estructuras de Datos / Proyectos)', '10:00', '12:00', 'alta'],
    ['Almuerzo y descanso', '12:00', '14:00', 'baja'],
    ['Estudio académico (repaso de Cálculo y Álgebra)', '14:00', '16:00', 'alta'],
    ['Práctica de inglés', '16:30', '17:30', 'baja'],
    ['Trote nocturno', '20:00', '20:45', 'baja', 1],
    ['Lectura', '21:30', '22:00', 'baja']]),
  2: mk(2, [
    ['Ejercicio de fuerza', '07:00', '08:00', 'alta'],
    ['Programación', '08:30', '10:30', 'alta'],
    ['Estudio académico (Ingeniería de Software / prep. clases)', '10:30', '12:00', 'alta'],
    ['Clase: Ingeniería de Software', '13:00', '15:45', 'baja', 1],
    ['Repaso / Lectura', '16:30', '17:30', 'baja'],
    ['Clase: Lengua Extranjera I (Inglés)', '18:30', '21:00', 'baja', 1],
    ['Cena y cierre del día', '21:30', '22:00', 'baja']]),
  3: mk(3, [
    ['Ejercicio de fuerza', '07:00', '08:00', 'alta'],
    ['Clase: Probabilidad y Estadística', '09:00', '11:45', 'baja', 1],
    ['Clase: Álgebra Lineal', '13:00', '15:45', 'baja', 1],
    ['Programación', '16:15', '18:00', 'alta'],
    ['Estudio académico (Probabilidad / Álgebra)', '18:30', '19:30', 'baja'],
    ['Trote nocturno', '20:00', '20:45', 'baja', 1],
    ['Lectura', '21:30', '22:00', 'baja']]),
  4: mk(4, [
    ['Clase: Bases de Datos I', '06:00', '08:45', 'baja', 1],
    ['Clase: Cálculo Integral', '10:00', '11:45', 'baja', 1],
    ['Clase: Programación Avanzada', '13:00', '15:45', 'baja', 1],
    ['Estudio académico (Bases de Datos / Programación)', '16:30', '18:00', 'alta'],
    ['Ejercicio de fuerza', '18:30', '19:30', 'alta'],
    ['Trote nocturno', '20:00', '20:45', 'baja', 1],
    ['Lectura', '21:30', '22:00', 'baja']]),
  5: mk(5, [
    ['Ejercicio de fuerza', '07:00', '08:00', 'alta'],
    ['Deep Work: Programación y proyectos principales', '08:30', '11:30', 'alta'],
    ['Estudio académico: proyectos en grupo, talleres e invariantes', '13:30', '16:00', 'alta'],
    ['Práctica de inglés', '16:30', '17:30', 'baja'],
    ['Trote nocturno', '20:00', '20:45', 'baja', 1],
    ['Lectura', '21:30', '22:00', 'baja']]),
  // Sábado y domingo: armados con tus hábitos; ajústalos en la pestaña Horario
  6: mk(6, [
    ['Ejercicio de fuerza', '07:00', '08:00', 'alta'],
    ['Programación', '08:30', '10:30', 'alta'],
    ['Estudio académico (talleres y ejercicios)', '10:30', '12:00', 'alta'],
    ['Almuerzo y descanso', '12:00', '14:00', 'baja'],
    ['Práctica de inglés', '14:30', '15:15', 'baja'],
    ['Lectura', '21:30', '22:00', 'baja']]),
  0: mk(0, [
    ['Ejercicio de fuerza', '07:00', '08:00', 'alta'],
    ['Programación', '08:30', '10:30', 'alta'],
    ['Estudio académico (talleres y ejercicios)', '10:30', '12:00', 'alta'],
    ['Almuerzo y descanso', '12:00', '14:00', 'baja'],
    ['Práctica de inglés', '14:30', '15:15', 'baja'],
    ['Trote nocturno', '20:00', '20:45', 'baja', 1],
    ['Lectura', '21:30', '22:00', 'baja']]),
};

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loadJSON = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } };
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const pad = (n) => String(n).padStart(2, '0');

/* Estado del día: { dia, fecha, plan, done:{id:true}, completed:[texto], cerrado } */
let state = loadJSON(LS.state, null);
function persist() { saveJSON(LS.state, state); syncSW(); }

/* ---------- Pestañas ---------- */
document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  const tabs = ['hoy', 'horario', 'datos', 'fechas', 'cierre', 'ajustes'];
  if (!tabs.includes(name)) name = 'hoy';
  tabs.forEach((t) => $('#tab-' + t).classList.toggle('hidden', t !== name));
  document.querySelectorAll('.tab-btn').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  if (name === 'cierre') renderCierre();
  if (name === 'fechas') renderRecs();
  window.scrollTo({ top: 0 });
}

/* ---------- Horario editable ---------- */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
let selDay = new Date().getDay();
const uid = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const loadWeek = () => loadJSON(LS.week, DEFAULT_WEEK);
const dayBlocks = (d) => (loadWeek()[d] || []).slice().sort((a, b) => a.inicio.localeCompare(b.inicio));

function renderDays() {
  $('#diasSel').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => `<button data-dia="${d}" role="tab" aria-selected="${d === selDay}" class="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border ${d === selDay ? 'bg-iris text-ink border-iris' : 'border-line text-mist'}">${DIAS_CORTO[d]}${d === new Date().getDay() ? ' •' : ''}</button>`).join('');
}
function rowHTML(b) {
  return `<div class="rounded-2xl bg-panel border border-line p-4" data-id="${esc(b.id)}">
    <div class="flex items-center gap-2 mb-3">
      <input type="text" data-nombre value="${esc(b.nombre)}" class="field flex-1 p-2 text-sm font-semibold" aria-label="Nombre del bloque">
      <button type="button" data-del class="rounded-lg border border-line text-rosa px-3 py-2 text-sm" aria-label="Eliminar bloque">✕</button>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <label class="text-xs text-mist">Inicio<input type="time" data-inicio value="${esc(b.inicio)}" class="field w-full mt-1 p-2 text-base text-[#e7e9ee]"></label>
      <label class="text-xs text-mist">Fin<input type="time" data-fin value="${esc(b.fin)}" class="field w-full mt-1 p-2 text-base text-[#e7e9ee]"></label>
    </div>
    <div class="flex items-center justify-between mt-3">
      <select class="field text-sm px-2 py-1" data-energia aria-label="Nivel de energía">
        <option value="alta" ${b.energia === 'alta' ? 'selected' : ''}>Energía alta</option>
        <option value="baja" ${b.energia === 'baja' ? 'selected' : ''}>Energía baja</option>
      </select>
      <label class="flex items-center gap-2 text-sm text-mist"><input type="checkbox" data-fijo ${b.fijo ? 'checked' : ''} class="accent-[#a8a4ff] w-4 h-4"> Fijo (clase o hábito)</label>
    </div>
  </div>`;
}
function renderSchedule() {
  const list = dayBlocks(selDay);
  $('#schedule').innerHTML = list.length ? list.map(rowHTML).join('') : '<p class="text-sm text-mist">Este día no tiene bloques. Añade uno.</p>';
}
function readSchedule() {
  return [...document.querySelectorAll('#schedule [data-id]')].map((row) => ({
    id: row.dataset.id,
    nombre: row.querySelector('[data-nombre]').value.trim() || 'Bloque',
    inicio: row.querySelector('[data-inicio]').value,
    fin: row.querySelector('[data-fin]').value,
    energia: row.querySelector('[data-energia]').value,
    fijo: row.querySelector('[data-fijo]').checked,
  }));
}
function validateBlocks(list) {
  for (const b of list) {
    if (!b.inicio || !b.fin) return `Completa las horas de "${b.nombre}".`;
    if (b.fin <= b.inicio) return `En "${b.nombre}" el fin debe ser posterior al inicio.`;
  }
  const s = list.slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < s.length; i++) if (s[i].inicio < s[i - 1].fin) return `"${s[i].nombre}" se cruza con "${s[i - 1].nombre}".`;
  return null;
}
function saveDay() {
  const list = readSchedule(), err = validateBlocks(list);
  if (err) return err;
  const w = loadWeek(); w[selDay] = list; saveJSON(LS.week, w);
  return null;
}
let schedTimer;
function autosave() {
  clearTimeout(schedTimer);
  schedTimer = setTimeout(() => {
    const err = saveDay();
    $('#horarioEstado').innerHTML = err ? `<span class="text-rosa">${esc(err)} Sin guardar.</span>` : 'Cambios guardados.';
  }, 400);
}
$('#schedule').addEventListener('input', autosave);
$('#schedule').addEventListener('change', autosave);
$('#schedule').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) { del.closest('[data-id]').remove(); autosave(); }
});
$('#diasSel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dia]');
  if (!b) return;
  selDay = +b.dataset.dia; $('#horarioEstado').textContent = ''; renderDays(); renderSchedule();
});
$('#btnAddBloque').addEventListener('click', () => {
  const box = $('#schedule');
  if (!box.querySelector('[data-id]')) box.innerHTML = '';
  box.insertAdjacentHTML('beforeend', rowHTML({ id: uid(), nombre: 'Nuevo bloque', inicio: '09:00', fin: '10:00', energia: 'alta', fijo: false }));
  autosave();
});
$('#btnGuardarHorario').addEventListener('click', () => {
  const err = saveDay();
  if (err) return toast(err, true);
  renderSchedule(); $('#horarioEstado').textContent = ''; toast(`Horario del ${DIAS[selDay]} guardado`);
});
$('#btnRestaurar').addEventListener('click', () => {
  const w = loadWeek(); w[selDay] = structuredClone(DEFAULT_WEEK[selDay]); saveJSON(LS.week, w);
  renderSchedule(); $('#horarioEstado').textContent = ''; toast(`Restaurado el ${DIAS[selDay]}`);
});

/* ---------- Limpieza de texto ---------- */
const NOISE = [
  /^(enviado desde|sent from|obtener outlook|get outlook)/i,
  /^(saludos|atentamente|cordialmente|un abrazo|gracias|muchas gracias|best regards|kind regards|regards|cheers|thanks)[,.!\s]*$/i,
  /(este (mensaje|correo)|this (e-?mail|message)).*(confidencial|confidential|destinatario|intended)/i,
  /^(aviso legal|disclaimer|unsubscribe|cancelar suscripci|ver en el navegador|view in browser)/i,
  /^>/,
  /^(el|on) .+(escribi[óo]|wrote):$/i,
];
function cleanText(raw) {
  if (!raw) return '';
  const seen = new Set(); const out = []; let inSig = false;
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const t = line.replace(/[ \t\u00a0]+/g, ' ').trim();
    if (!t) { inSig = false; continue; }
    if (/^(--|__|—)$/.test(t)) { inSig = true; continue; }
    if (inSig || NOISE.some((r) => r.test(t))) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out.join('\n').slice(0, MAX_CHARS);
}
function readInputs() {
  return { tareas: $('#inTareas').value, eventos: $('#inEventos').value, correos: $('#inCorreos').value, notas: $('#inNotas').value };
}
function taskLines() { return cleanText($('#inTareas').value).split('\n').filter(Boolean).slice(0, 4); }
function updateSavings() {
  const vals = Object.values(readInputs());
  const raw = vals.join('\n'); const clean = vals.map(cleanText).join('\n');
  const saved = Math.max(0, Math.round((raw.length - clean.length) / 4));
  $('#ahorro').textContent = raw.trim() ? `Limpieza: ~${saved} tokens menos en la próxima petición.` : '';
}
let draftTimer;
['#inTareas', '#inEventos', '#inCorreos', '#inNotas'].forEach((id) => {
  $(id).addEventListener('input', () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => { saveJSON(LS.draft, readInputs()); updateSavings(); }, 400);
  });
});
$('#btnVaciar').addEventListener('click', () => {
  ['#inTareas', '#inEventos', '#inCorreos', '#inNotas'].forEach((id) => { $(id).value = ''; });
  saveJSON(LS.draft, readInputs()); updateSavings(); toast('Campos vaciados');
});

/* Pegar portapapeles (requiere HTTPS y un toque del usuario) */
document.querySelectorAll('[data-paste]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('no-soportado');
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return toast('El portapapeles está vacío', true);
      const ta = $(btn.dataset.paste);
      ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' + text : text;
      ta.dispatchEvent(new Event('input'));
      toast('Texto pegado');
    } catch {
      toast('No se pudo leer el portapapeles. Permite el acceso o pega a mano.', true);
    }
  });
});

/* ---------- Rutina base (sin conexión) ---------- */

const CASOS = [
  { re: /^clase/i, tipo: 'Clase', tip: 'Llega con 10 minutos de margen.' },
  { re: /fuerza|trote|entren|ejerc/i, tipo: 'Entrenamiento', tip: 'Calienta 5 minutos y registra lo hecho.' },
  { re: /estudio|taller/i, tipo: 'Estudio', tip: 'Empieza por el ejercicio más difícil.' },
  { re: /programaci|deep|proyect/i, tipo: 'Deep Work', tip: 'Sin celular ni pestañas extra; pausa a la mitad.' },
  { re: /almuerzo|descans|lectura|cena/i, tipo: 'Descanso', tip: 'Desconecta de las pantallas.' },
  { re: /ingl|repaso/i, tipo: 'Gestión', tip: 'Habla en voz alta, no solo leas.' },
];
const casoDe = (b) => CASOS.find((c) => c.re.test(b.nombre)) || { tipo: 'Gestión', tip: 'Resuelve primero lo pequeño.' };
function tipoDe(b) { const t = casoDe(b).tipo; return t === 'Estudio' ? (b.energia === 'alta' ? 'Deep Work' : 'Gestión') : t; }
function parseRange(txt) {
  const m = String(txt || '').match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
  return m ? [`${pad(m[1])}:${m[2]}`, `${pad(m[3])}:${m[4]}`] : null;
}
const normH = (h) => { const m = String(h || '').match(/(\d{1,2}):(\d{2})/); return m ? `${pad(m[1])}:${m[2]}` : ''; };
const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

/* Une la respuesta de Claude (solo asignaciones) con los bloques reales del día */
function mergePlan(raw, blocks) {
  const asg = new Map((Array.isArray(raw.bloques) ? raw.bloques : []).filter((x) => x && x.tarea).map((x) => [normH(x.h), x]));
  return {
    mision_principal: String(raw.mision_principal || ''),
    alertas_urgentes: arr(raw.alertas_urgentes),
    cronograma_sugerido: blocks.slice().sort((a, b) => a.inicio.localeCompare(b.inicio)).map((b) => {
      const a = !b.fijo && asg.get(b.inicio);
      return {
        bloque: `${b.inicio} - ${b.fin}`, tipo: tipoDe(b),
        actividad_principal: a ? `${b.nombre}: ${a.tarea}` : b.nombre,
        sugerencia_optimizacion: (a && a.tip) || casoDe(b).tip,
      };
    }),
    tareas_secundarias: arr(raw.tareas_secundarias),
    sugerencias_espacios_libres: arr(raw.sugerencias_espacios_libres),
  };
}
function fallbackPlan({ pending = [], fromNow = false }) {
  let blocks = dayBlocks(new Date().getDay());
  if (fromNow) { const n = nowHHMM(); blocks = blocks.filter((b) => b.fin > n); }
  const p = mergePlan({
    mision_principal: pending.length ? `Avanzar en: ${pending[0]}` : 'Cumplir los bloques clave del día',
    alertas_urgentes: ['Rutina base sin conexión. Genera de nuevo cuando vuelva la red.'],
    tareas_secundarias: pending.slice(0, 5),
    sugerencias_espacios_libres: ['Pausa activa de 5 minutos', 'Repasa tus apuntes 10 minutos', 'Toma agua y descansa la vista'],
  }, blocks);
  p.fallback = true;
  return p;
}

/* ---------- Claude ---------- */

const SYSTEM_PROMPT = `Eres mi asistente ejecutivo y estratega de productividad. Recibes los bloques fijos y flexibles de mi día y mis pendientes, y asignas cada pendiente al bloque correcto.
Reglas:
- Responde SOLO con un objeto JSON válido, sin texto extra ni markdown.
- Tareas complejas de código o matemática solo en bloques de energía alta (mañana o tarde libre); tareas administrativas o breves en energía baja.
- Nunca asignes nada a bloques con fijo=true (clases y trote) ni sobrepongas actividades.
- No inventes tareas, fechas ni pagos. Si un bloque no tiene un pendiente que encaje, no lo incluyas.
- Límite estricto: mision_principal máx 15 palabras; máx 5 elementos en "bloques" (tarea y tip máx 6 palabras); máx 3 tareas_secundarias, 2 alertas_urgentes y 2 sugerencias_espacios_libres de máx 8 palabras.
- sugerencias_espacios_libres: actividades breves para huecos entre bloques (repaso, pausa activa, avance de pendientes o descanso).
- Los "Vencimientos próximos" de hoy o mañana van en alertas_urgentes y se priorizan en el plan.
- Una sola misión principal.
Metas diarias de referencia: programación 1.5-2 h, estudio universitario 1.5-2 h, inglés 45 min, fuerza 45 min, lectura 30 min.
Formato exacto, en este orden de claves ("h" = hora de inicio del bloque):
{"mision_principal":"","alertas_urgentes":[""],"bloques":[{"h":"HH:MM","tarea":"","tip":""}],"tareas_secundarias":[""],"sugerencias_espacios_libres":[""]}`;
const REORG_RULE = `\nModo reorganizar: es un día caótico. Los bloques recibidos son solo los que quedan desde la hora actual. Prioriza los pendientes por urgencia y pon la tarea clave en el próximo bloque de energía alta.`;

function section(label, text) { const c = cleanText(text); return c ? `${label}:\n${c}` : ''; }
const blocksLine = (blocks) => `Bloques de hoy: ${JSON.stringify(blocks.map(({ inicio, fin, nombre, energia, fijo }) => ({ inicio, fin, nombre, energia, fijo })))}`;
function buildUserMessage(manana, blocks) {
  const i = readInputs();
  const now = new Date().toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return [
    `Ahora: ${now}`, blocksLine(blocks),
    manana.length ? `Pendientes de ayer:\n${manana.join('\n')}` : '',
    recsSection(7),
    section('Tareas pendientes', i.tareas), section('Eventos del calendario', i.eventos),
    section('Correos y alertas', i.correos), section('Contexto', i.notas),
  ].filter(Boolean).join('\n\n');
}
function buildReorgMessage(blocks, pending, completed) {
  const i = readInputs();
  return [
    `Hora actual: ${nowHHMM()} (${DIAS[new Date().getDay()]})`, blocksLine(blocks),
    `Pendientes por hacer:\n${pending.length ? pending.join('\n') : '(ninguno)'}`,
    completed.length ? `Ya completado hoy:\n${completed.join('\n')}` : '',
    recsSection(2), section('Eventos del calendario', i.eventos), section('Contexto', i.notas),
  ].filter(Boolean).join('\n\n');
}

/* Si la respuesta se corta por max_tokens, recupera lo completo y cierra el JSON */
function repairJSON(s) {
  let inStr = false, esc_ = false, safe = -1, safeStack = []; const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc_) esc_ = false; else if (c === '\\') esc_ = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
    else if (c === ',') { safe = i; safeStack = stack.slice(); }
  }
  if (safe < 0) throw new Error('Respuesta incompleta.');
  return s.slice(0, safe) + safeStack.reverse().join('');
}
function parseRaw(text) {
  const a = text.indexOf('{');
  if (a === -1) throw new Error('La respuesta no contiene JSON.');
  const b = text.lastIndexOf('}');
  try { return JSON.parse(text.slice(a, b + 1)); }
  catch { return JSON.parse(repairJSON(text.slice(a))); }
}

async function callClaude(userMsg, system) {
  if (!navigator.onLine) throw new Error('Sin conexión a internet.');
  const key = (localStorage.getItem(LS.key) || '').trim();
  if (!key) { const e = new Error('Sin API Key. Usa el Modo gratis (abajo) o guarda tu clave en Ajustes.'); e.noFallback = true; throw e; }
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 25000);
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: {
        'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: MAX_TOKENS, temperature: 0.3, system,
        messages: [{ role: 'user', content: userMsg }, { role: 'assistant', content: '{' }], // prefill: fuerza JSON
      }),
    });
  } catch { throw new Error('No se pudo conectar con la API.'); }
  finally { clearTimeout(to); }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Error ${res.status} de la API`);
  }
  const data = await res.json();
  return parseRaw('{' + (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

function setBusy(on, mode) {
  const g = $('#btnGenerar'), r = $('#btnReorg');
  g.disabled = r.disabled = on;
  g.textContent = on && mode === 'gen' ? 'Generando...' : 'Generar plan de hoy';
  r.textContent = on && mode === 'reorg' ? 'Reorganizando...' : 'Día caótico: reorganizar lo que queda';
}

async function runPlan(mode) {
  if (mode === 'reorg' && !state?.plan) return toast('Primero genera el plan de hoy', true);
  const all = dayBlocks(new Date().getDay());
  const err = validateBlocks(all);
  if (err) { selDay = new Date().getDay(); renderDays(); renderSchedule(); showTab('horario'); return toast(err, true); }
  const blocks = mode === 'reorg' ? all.filter((b) => b.fin > nowHHMM()) : all;
  if (mode === 'reorg' && !blocks.length) return toast('Ya no quedan bloques hoy. Usa Cierre del día.', true);
  setBusy(true, mode); $('#estado').textContent = '';

  const manana = loadJSON(LS.manana, []);
  let pending = [], completedNow = [];
  if (mode === 'reorg') {
    const items = taskItems(state.plan), done = state.done || {};
    pending = items.filter((x) => !done[x.id]).map((x) => x.text);
    completedNow = items.filter((x) => done[x.id]).map((x) => x.text);
  }

  let plan, aviso = '';
  try {
    const raw = await callClaude(
      mode === 'reorg' ? buildReorgMessage(blocks, pending, completedNow) : buildUserMessage(manana, blocks),
      mode === 'reorg' ? SYSTEM_PROMPT + REORG_RULE : SYSTEM_PROMPT);
    plan = mergePlan(raw, blocks);
  } catch (e) {
    if (e.noFallback) { $('#estado').innerHTML = `<span class="text-rosa">${esc(e.message)}</span>`; setBusy(false); return; }
    if (state?.dia === today() && state.plan && !state.plan.fallback) { // conserva el plan bueno de hoy
      $('#estado').innerHTML = `<span class="text-rosa">${esc(e.message)} Se mantiene tu plan actual.</span>`; setBusy(false); return;
    }
    plan = mode === 'reorg' ? fallbackPlan({ pending, fromNow: true }) : fallbackPlan({ pending: [...manana, ...taskLines()] });
    aviso = `${e.message} Mostrando rutina base.`;
  }

  const fecha = new Date().toISOString();
  state = mode === 'reorg'
    ? { dia: today(), fecha, plan, done: {}, completed: [...(state.completed || []), ...completedNow] }
    : { dia: today(), fecha, plan, done: {}, completed: [] };
  if (mode === 'gen') saveJSON(LS.manana, []);
  persist(); renderDashboard(); updateManana(); updateCierreBadge();
  $('#estado').innerHTML = aviso ? `<span class="text-sand">${esc(aviso)}</span>` : 'Plan actualizado.';
  setBusy(false);
}
$('#btnGenerar').addEventListener('click', () => runPlan('gen'));
$('#btnReorg').addEventListener('click', () => runPlan('reorg'));

/* ---------- Modo gratis (sin API) ---------- */
const COMPLEJA = /c[oó]digo|program|taller|c[aá]lcul|[aá]lgebra|estad[ií]stic|probabil|proyecto|base[s]? de datos|sql|algoritm|estructura|integral|invariante|ejercicio|parcial|examen/i;

function setPlan(plan) {
  state = { dia: today(), fecha: new Date().toISOString(), plan, done: {}, completed: [] };
  saveJSON(LS.manana, []);
  persist(); renderDashboard(); updateManana(); updateCierreBadge();
}

// Reparte tus pendientes sin IA: tareas complejas a bloques de energía alta, el resto a energía baja
function localPlan() {
  const blocks = dayBlocks(new Date().getDay()), n = nowHHMM();
  const venc = recsPendientes(2).map((r) => `${r.titulo} (${cuando(r.fecha).toLowerCase()})`);
  const tareas = [...venc, ...loadJSON(LS.manana, []), ...cleanText($('#inTareas').value).split('\n').filter(Boolean)].slice(0, 10);
  const libres = blocks.filter((b) => !b.fijo && b.fin > n && /estudio|taller|programaci|deep|proyect|ingl|repaso/i.test(b.nombre));
  const pools = { alta: libres.filter((b) => b.energia === 'alta'), baja: libres.filter((b) => b.energia !== 'alta') };
  const bloques = [], sobran = [];
  for (const t of tareas) {
    const pref = COMPLEJA.test(t) ? 'alta' : 'baja', otro = pref === 'alta' ? 'baja' : 'alta';
    const b = pools[pref].shift() || pools[otro].shift();
    if (b) bloques.push({ h: b.inicio, tarea: t.slice(0, 60), tip: '' }); else sobran.push(t.slice(0, 60));
  }
  const alertas = recsPendientes(1).map((r) => `${r.titulo}: ${cuando(r.fecha).toLowerCase()}`).slice(0, 2);
  if (!tareas.length) alertas.push('Sin pendientes: pégalos en la pestaña Datos.');
  else if (sobran.length) alertas.push('No quedan bloques libres para todo. Revisa las tareas secundarias.');
  return mergePlan({
    mision_principal: tareas.length ? `Completar: ${(tareas.find((t) => COMPLEJA.test(t)) || tareas[0]).slice(0, 80)}` : 'Cumplir los bloques clave del día',
    alertas_urgentes: alertas, bloques, tareas_secundarias: sobran.slice(0, 5),
    sugerencias_espacios_libres: ['Pausa activa de 5 minutos', 'Repasa tus apuntes 10 minutos', 'Toma agua y descansa la vista'],
  }, blocks);
}
$('#btnLocal').addEventListener('click', () => {
  const err = validateBlocks(dayBlocks(new Date().getDay()));
  if (err) { selDay = new Date().getDay(); renderDays(); renderSchedule(); showTab('horario'); return toast(err, true); }
  setPlan(localPlan()); $('#estado').textContent = 'Plan local generado (sin IA, sin costo).';
});

// Camino manual: prompt a claude.ai (cuenta gratis) y de vuelta aquí
$('#btnCopiarPrompt').addEventListener('click', async () => {
  const blocks = dayBlocks(new Date().getDay());
  const err = validateBlocks(blocks);
  if (err) return toast(err, true);
  const texto = `${SYSTEM_PROMPT}\n\n---\nDatos de hoy:\n${buildUserMessage(loadJSON(LS.manana, []), blocks)}\n\nResponde únicamente con el JSON.`;
  try { await navigator.clipboard.writeText(texto); toast('Prompt copiado. Pégalo en claude.ai'); }
  catch { toast('No pude copiar. Permite el portapapeles.', true); }
});
$('#btnPegarResp').addEventListener('click', async () => {
  let texto = '';
  try { texto = await navigator.clipboard.readText(); } catch { /* se pide a mano */ }
  if (!texto.includes('{')) texto = window.prompt('Pega aquí la respuesta de Claude:') || '';
  if (!texto.trim()) return;
  try {
    const raw = parseRaw(texto);
    if (!raw.mision_principal && !Array.isArray(raw.bloques)) throw new Error('sin datos');
    setPlan(mergePlan(raw, dayBlocks(new Date().getDay())));
    $('#estado').textContent = 'Plan cargado desde Claude.ai.';
  } catch { toast('No pude leer la respuesta. Copia el JSON completo.', true); }
});

/* ---------- Dashboard con progreso ---------- */
const TIPO_COLOR = { 'deep work': 'text-iris border-iris/40', entrenamiento: 'text-sand border-sand/40', 'gestión': 'text-menta border-menta/40', gestion: 'text-menta border-menta/40', descanso: 'text-mist border-line', clase: 'text-[#7fb2ff] border-[#7fb2ff]/40' };

function taskItems(p) {
  const items = [];
  if (p.mision_principal) items.push({ id: 'm', text: p.mision_principal });
  p.tareas_secundarias.forEach((t, i) => items.push({ id: 't' + i, text: t }));
  return items;
}
function progressHTML() {
  const items = taskItems(state.plan), done = state.done || {};
  const n = items.filter((x) => done[x.id]).length, pct = items.length ? Math.round((n / items.length) * 100) : 0;
  return `<div class="flex items-center justify-between text-sm mb-2"><span class="font-semibold">Progreso del día</span><span class="text-mist">${n} de ${items.length} · ${pct}%</span></div>
    <div class="h-2 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="bar-fill h-full bg-menta" style="width:${pct}%"></div></div>`;
}
function updateProgress() { const el = $('#progreso'); if (el && state?.plan) el.innerHTML = progressHTML(); }

function card(title, inner, extra = '') {
  return `<section class="rounded-2xl bg-panel border border-line p-4 ${extra}"><h3 class="font-bold mb-3">${esc(title)}</h3>${inner}</section>`;
}
function listItems(items, bullet) {
  return `<ul class="space-y-2">${items.map((t) => `<li class="flex gap-3 text-sm leading-relaxed"><span class="mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${bullet}"></span><span>${esc(t)}</span></li>`).join('')}</ul>`;
}

function renderDashboard() {
  const box = $('#dashboard');
  if (!state?.plan) {
    box.innerHTML = '<p class="text-sm text-mist leading-relaxed">Aún no hay plan. Guarda tu API Key en Ajustes, pega tus pendientes en Datos y toca Generar plan de hoy.</p>';
    return;
  }
  const p = state.plan, done = state.done || {}, html = [];
  if (p.fallback) html.push('<div class="rounded-xl border border-sand/50 bg-panel px-3 py-2 text-sm text-sand">Rutina base guardada en tu dispositivo. Cuando haya conexión, genera el plan con Claude.</div>');
  else if (state.dia !== today()) html.push('<div class="rounded-xl border border-line bg-panel px-3 py-2 text-sm text-mist">Este plan es de otro día. Genera uno nuevo.</div>');

  if (taskItems(p).length) html.push(`<section id="progreso" class="rounded-2xl bg-panel border border-line p-4">${progressHTML()}</section>`);
  if (p.mision_principal) {
    const c = done.m;
    html.push(`<section class="rounded-2xl bg-iris text-ink p-5"><p class="text-sm font-semibold opacity-70">Misión principal del día</p>
      <label class="flex gap-3 items-start mt-2"><input type="checkbox" data-task="m" ${c ? 'checked' : ''} class="mt-1.5 w-5 h-5 accent-[#0f1218]">
      <span class="task-text text-xl font-extrabold leading-snug ${c ? 'line-through opacity-60' : ''}">${esc(p.mision_principal)}</span></label></section>`);
  }
  if (p.alertas_urgentes.length) html.push(card('Alertas urgentes', listItems(p.alertas_urgentes, 'bg-rosa'), 'border-rosa/40'));
  if (p.cronograma_sugerido.length) {
    const rows = p.cronograma_sugerido.map((b) => {
      const tipo = String(b.tipo || ''), cls = TIPO_COLOR[tipo.toLowerCase()] || 'text-mist border-line';
      return `<li class="flex gap-3"><span class="w-24 shrink-0 text-sm font-semibold text-mist pt-0.5">${esc(b.bloque)}</span>
        <div class="flex-1 pb-4 border-l border-line pl-4 -ml-1"><span class="inline-block text-xs font-semibold border rounded-full px-2 py-0.5 ${cls}">${esc(tipo)}</span>
        <p class="font-semibold mt-1">${esc(b.actividad_principal)}</p><p class="text-sm text-mist mt-0.5">${esc(b.sugerencia_optimizacion)}</p></div></li>`;
    }).join('');
    html.push(card('Cronograma ajustado', `<ol>${rows}</ol>`));
  }
  if (p.tareas_secundarias.length) {
    const items = p.tareas_secundarias.map((t, i) => {
      const id = 't' + i, c = done[id];
      return `<li><label class="flex gap-3 text-sm items-start"><input type="checkbox" data-task="${id}" ${c ? 'checked' : ''} class="mt-0.5 accent-[#a8a4ff] w-5 h-5 shrink-0"><span class="task-text ${c ? 'line-through opacity-60' : ''}">${esc(t)}</span></label></li>`;
    }).join('');
    html.push(card('Tareas secundarias', `<ul class="space-y-3">${items}</ul>`));
  }
  if (p.sugerencias_espacios_libres.length) html.push(card('Para tus huecos libres', listItems(p.sugerencias_espacios_libres, 'bg-menta')));
  box.innerHTML = html.join('');
}

$('#dashboard').addEventListener('change', (e) => {
  const cb = e.target.closest('[data-task]');
  if (!cb || !state) return;
  state.done = state.done || {};
  if (cb.checked) state.done[cb.dataset.task] = true; else delete state.done[cb.dataset.task];
  const txt = cb.parentElement.querySelector('.task-text');
  txt.classList.toggle('line-through', cb.checked); txt.classList.toggle('opacity-60', cb.checked);
  persist(); updateProgress();
});

/* ---------- Fechas y recordatorios ---------- */
const loadRecs = () => loadJSON(LS.recs, []);
function saveRecs(list) { saveJSON(LS.recs, list); syncSW(); }
const diasHasta = (f) => Math.round((new Date(f + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
const fechaCorta = (f) => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
function cuando(f) {
  const d = diasHasta(f);
  if (d < 0) return `Venció hace ${-d} día${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoy';
  if (d === 1) return 'Vence mañana';
  return `Vence en ${d} días (${fechaCorta(f)})`;
}
const corto = (f) => { const d = diasHasta(f); return d < 0 ? 'vencido' : d === 0 ? 'hoy' : d === 1 ? 'mañana' : `${d} días`; };
const colorCuando = (f) => { const d = diasHasta(f); return d <= 0 ? 'text-rosa' : d === 1 ? 'text-sand' : 'text-mist'; };
const recsPendientes = (maxDias) => loadRecs().filter((r) => !r.hecho && diasHasta(r.fecha) <= maxDias).sort((a, b) => a.fecha.localeCompare(b.fecha));
function recsSection(maxDias) {
  const l = recsPendientes(maxDias);
  return l.length ? `Vencimientos próximos:\n${l.map((r) => `${r.titulo}: ${cuando(r.fecha).toLowerCase()}`).join('\n')}` : '';
}
// Disparadores: la hora del aviso el día de la fecha y, si se pidió, las 18:00 del día anterior
function triggersDe(r) {
  const t = [['dia', new Date(`${r.fecha}T${r.hora || '08:00'}:00`).getTime()]];
  if (r.pre) { const d = new Date(`${r.fecha}T18:00:00`); d.setDate(d.getDate() - 1); t.push(['pre', d.getTime()]); }
  return t;
}
function checkRecs() {
  if (!notifOn()) return;
  const list = loadRecs(), now = Date.now(); let changed = false;
  for (const r of list) {
    if (r.hecho) continue;
    const end = new Date(r.fecha + 'T23:59:59').getTime(), ya = r.enviados || [];
    const due = triggersDe(r).filter(([k, t]) => now >= t && now <= end && !ya.includes(k)).sort((x, y) => y[1] - x[1]);
    if (!due.length) continue;
    r.enviados = [...ya, ...due.map((x) => x[0])]; changed = true;
    showNotif(`Recordatorio: ${r.titulo}`, cuando(r.fecha), `rec-${r.id}-${due[0][0]}`, './index.html?tab=fechas');
  }
  if (changed) saveJSON(LS.recs, list);
}
const recsParaSW = () => loadRecs().filter((r) => !r.hecho).map(({ id, titulo, fecha, hora, pre, enviados }) => ({ id, titulo, fecha, hora, pre, enviados: enviados || [] }));

function renderRecHoy() {
  const l = recsPendientes(7), box = $('#recHoy');
  box.classList.toggle('hidden', !l.length);
  box.innerHTML = l.length ? `<h3 class="font-bold mb-3">Vencimientos próximos</h3><ul class="space-y-2">${l.slice(0, 6).map((r) => `<li class="flex justify-between gap-3 text-sm"><span>${esc(r.titulo)}</span><span class="shrink-0 font-semibold ${colorCuando(r.fecha)}">${esc(corto(r.fecha))}</span></li>`).join('')}</ul>` : '';
}
function renderRecs() {
  const all = loadRecs().slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pend = all.filter((r) => !r.hecho), hechos = all.filter((r) => r.hecho).slice(-5);
  const item = (r) => `<div class="rounded-2xl bg-panel border border-line p-4 flex items-start gap-3" data-rid="${esc(r.id)}">
    <input type="checkbox" data-rec-done ${r.hecho ? 'checked' : ''} class="mt-1 w-5 h-5 accent-[#5fd3c4] shrink-0" aria-label="Marcar como hecho">
    <div class="flex-1 min-w-0"><p class="font-semibold ${r.hecho ? 'line-through opacity-60' : ''}">${esc(r.titulo)}</p>
      <p class="text-sm ${r.hecho ? 'text-mist' : colorCuando(r.fecha)}">${r.hecho ? esc(fechaCorta(r.fecha)) : esc(cuando(r.fecha))}</p>
      <p class="text-xs text-mist mt-0.5">Aviso a las ${esc(r.hora || '08:00')}${r.pre ? ' y el día antes a las 18:00' : ''}</p></div>
    <button type="button" data-rec-del class="text-sm text-rosa font-semibold px-2 py-1">Borrar</button></div>`;
  $('#recLista').innerHTML = (pend.length ? pend.map(item).join('') : '<p class="text-sm text-mist">Aún no tienes recordatorios.</p>')
    + (hechos.length ? '<h3 class="font-bold pt-2">Hechos</h3>' + hechos.map(item).join('') : '');
  $('#recAviso').textContent = notifOn() ? '' : 'Activa los avisos en Ajustes para recibir notificaciones.';
}
$('#btnAddRec').addEventListener('click', () => {
  const titulo = $('#recTitulo').value.trim(), fecha = $('#recFecha').value;
  if (!titulo) return toast('Escribe qué es', true);
  if (!fecha) return toast('Elige una fecha', true);
  const r = { id: uid(), titulo: titulo.slice(0, 80), fecha, hora: $('#recHora').value || '08:00', pre: $('#recPre').checked, hecho: false, enviados: [] };
  r.enviados = triggersDe(r).filter(([, t]) => t <= Date.now()).map(([k]) => k); // no avisar lo que ya pasó
  saveRecs([...loadRecs(), r]);
  $('#recTitulo').value = ''; renderRecs(); renderRecHoy(); toast('Recordatorio guardado');
});
$('#recLista').addEventListener('click', (e) => {
  const del = e.target.closest('[data-rec-del]');
  if (!del) return;
  const id = del.closest('[data-rid]').dataset.rid;
  saveRecs(loadRecs().filter((r) => r.id !== id)); renderRecs(); renderRecHoy();
});
$('#recLista').addEventListener('change', (e) => {
  const cb = e.target.closest('[data-rec-done]');
  if (!cb) return;
  const id = cb.closest('[data-rid]').dataset.rid;
  saveRecs(loadRecs().map((r) => (r.id === id ? { ...r, hecho: cb.checked } : r))); renderRecs(); renderRecHoy();
});

/* ---------- Cierre del día ---------- */
let cierrePend = [];
function renderCierre() {
  const box = $('#cierreBox');
  if (!state?.plan) { box.innerHTML = '<p class="text-sm text-mist">Aún no hay plan de hoy. Genera uno en la pestaña Hoy.</p>'; renderHistorial(); return; }
  const items = taskItems(state.plan), done = state.done || {};
  const hechas = [...(state.completed || []), ...items.filter((x) => done[x.id]).map((x) => x.text)];
  cierrePend = items.filter((x) => !done[x.id]).map((x) => x.text);
  const total = hechas.length + cierrePend.length, pct = total ? Math.round((hechas.length / total) * 100) : 0;
  box.innerHTML = `
    <section class="rounded-2xl bg-panel border border-line p-4">
      <div class="flex items-center justify-between text-sm mb-2"><span class="font-semibold">Lo logrado hoy</span><span class="text-mist">${hechas.length} de ${total} · ${pct}%</span></div>
      <div class="h-2 rounded-full bg-line overflow-hidden"><div class="bar-fill h-full bg-menta" style="width:${pct}%"></div></div>
      ${hechas.length ? `<ul class="mt-3 space-y-2">${hechas.map((t) => `<li class="flex gap-3 text-sm"><span class="text-menta">✓</span><span>${esc(t)}</span></li>`).join('')}</ul>` : '<p class="text-sm text-mist mt-3">Aún no marcaste nada como hecho.</p>'}
    </section>
    <section class="rounded-2xl bg-panel border border-line p-4">
      <h3 class="font-bold mb-1">Pendiente</h3><p class="text-sm text-mist mb-3">Los marcados pasan al plan de mañana.</p>
      ${cierrePend.length ? `<ul class="space-y-3">${cierrePend.map((t, i) => `<li><label class="flex gap-3 text-sm items-start"><input type="checkbox" data-carry="${i}" checked class="mt-0.5 accent-[#f2c46d] w-5 h-5 shrink-0"><span>${esc(t)}</span></label></li>`).join('')}</ul>` : '<p class="text-sm text-menta">Todo completado.</p>'}
    </section>
    <label class="block"><span class="text-sm font-semibold">Nota rápida del día (opcional)</span>
      <textarea id="cierreNota" rows="2" class="field w-full mt-1 p-3 text-sm" placeholder="¿Qué salió bien? ¿Qué cambiarías mañana?">${esc((loadJSON(LS.hist, []).find((h) => h.dia === state.dia) || {}).nota || '')}</textarea></label>
    <button id="btnCerrar" class="w-full rounded-2xl bg-sand text-ink font-bold py-4">${state.cerrado ? 'Actualizar cierre' : 'Cerrar el día'}</button>`;
  $('#btnCerrar').addEventListener('click', cerrarDia);
  renderHistorial();
}
function cerrarDia() {
  const carry = [...document.querySelectorAll('#cierreBox [data-carry]:checked')].map((c) => cierrePend[+c.dataset.carry]);
  const items = taskItems(state.plan), done = state.done || {};
  const hechas = [...(state.completed || []), ...items.filter((x) => done[x.id]).map((x) => x.text)];
  const entry = { dia: state.dia, hechas: hechas.length, pendientes: cierrePend.length, completadas: hechas, nota: ($('#cierreNota').value || '').trim().slice(0, 300) };
  const hist = loadJSON(LS.hist, []).filter((h) => h.dia !== entry.dia); hist.unshift(entry);
  saveJSON(LS.hist, hist.slice(0, 14));
  saveJSON(LS.manana, carry);
  state.cerrado = true; persist(); updateManana(); updateCierreBadge(); renderCierre();
  toast(carry.length ? `Día cerrado. ${carry.length} pendiente(s) pasan a mañana` : 'Día cerrado');
}
function renderHistorial() {
  const hist = loadJSON(LS.hist, []).slice(0, 7);
  $('#historial').innerHTML = hist.length ? `<section class="rounded-2xl bg-panel border border-line p-4"><h3 class="font-bold mb-3">Últimos cierres</h3>
    <div class="overflow-x-auto"><table class="w-full text-sm"><thead class="text-mist text-left"><tr><th class="py-1 pr-3 font-semibold">Día</th><th class="py-1 pr-3 font-semibold">Hecho</th><th class="py-1 pr-3 font-semibold">Pendiente</th><th class="py-1 font-semibold">Nota</th></tr></thead>
    <tbody>${hist.map((h) => `<tr class="border-t border-line"><td class="py-2 pr-3 whitespace-nowrap">${esc(h.dia)}</td><td class="py-2 pr-3">${h.hechas}</td><td class="py-2 pr-3">${h.pendientes}</td><td class="py-2 text-mist">${esc(h.nota || '')}</td></tr>`).join('')}</tbody></table></div></section>` : '';
}
function updateManana() {
  const m = loadJSON(LS.manana, []), el = $('#avisoManana');
  el.classList.toggle('hidden', !m.length);
  el.textContent = m.length ? `${m.length} pendiente(s) de ayer entrarán en el próximo plan.` : '';
}
function updateCierreBadge() {
  const late = new Date().getHours() >= 19 && state?.dia === today() && !state.cerrado;
  $('#dotCierre').classList.toggle('attn', !!late);
}

/* ---------- Notificaciones locales ---------- */
const notifOn = () => 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem(LS.notif) === '1';
function blockList() {
  if (!state?.plan) return [];
  return state.plan.cronograma_sugerido.map((b) => {
    const r = parseRange(b.bloque);
    return r && { hhmm: r[0], title: `${b.tipo || 'Bloque'}: ${b.actividad_principal}`, body: `${b.bloque}. ${b.sugerencia_optimizacion || ''}`.trim() };
  }).filter(Boolean);
}
async function showNotif(title, body, tag, url = './index.html?tab=hoy') {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [120, 60, 120], data: { url } });
  } catch { try { new Notification(title, { body, tag }); } catch { /* sin soporte */ } }
}
function checkBlocks() {
  if (!notifOn() || !state || state.dia !== today()) return;
  const n = new Date(), min = n.getHours() * 60 + n.getMinutes();
  const sent = loadJSON(LS.notified, {});
  if (sent.dia !== today()) { sent.dia = today(); sent.list = []; }
  for (const b of blockList()) {
    const [h, m] = b.hhmm.split(':').map(Number), diff = min - (h * 60 + m), tag = `${sent.dia}-${b.hhmm}`;
    if (diff >= 0 && diff <= 10 && !sent.list.includes(tag)) { sent.list.push(tag); showNotif(b.title, b.body, tag); }
  }
  saveJSON(LS.notified, sent);
}
async function syncSW() { // copia el cronograma al service worker (IndexedDB) para periodicsync
  if (!('serviceWorker' in navigator)) return;
  try { const reg = await navigator.serviceWorker.ready; reg.active?.postMessage({ type: 'SCHEDULE', dia: state?.dia, enabled: notifOn(), blocks: blockList(), recs: recsParaSW() }); } catch { /* ignorar */ }
}
async function registerPeriodic() {
  try { const reg = await navigator.serviceWorker.ready; if ('periodicSync' in reg) await reg.periodicSync.register('check-blocks', { minInterval: 15 * 60 * 1000 }); } catch { /* opcional */ }
}
function refreshNotifUI() {
  const btn = $('#btnNotif'), st = $('#notifEstado');
  if (!('Notification' in window)) { btn.disabled = true; st.textContent = 'Este navegador no admite notificaciones. En iPhone instala la app en inicio (iOS 16.4 o superior).'; return; }
  if (Notification.permission === 'denied') { btn.disabled = true; st.textContent = 'Permiso bloqueado. Actívalo en los ajustes del navegador para este sitio.'; return; }
  btn.disabled = false;
  btn.textContent = notifOn() ? 'Desactivar avisos' : 'Activar avisos';
  st.textContent = notifOn() ? 'Avisos activos: recibirás uno al iniciar cada bloque del cronograma.' : 'Avisos desactivados.';
}
$('#btnNotif').addEventListener('click', async () => {
  if (notifOn()) localStorage.setItem(LS.notif, '0');
  else {
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p === 'granted') { localStorage.setItem(LS.notif, '1'); registerPeriodic(); } else toast('Permiso de notificaciones no concedido', true);
  }
  refreshNotifUI(); syncSW();
});
$('#btnProbar').addEventListener('click', () => {
  if (Notification?.permission !== 'granted') return toast('Activa primero los avisos', true);
  showNotif('Tablero de Vida', 'Así se verán los avisos de tus bloques.', 'prueba');
});

/* ---------- Ajustes ---------- */
$('#btnGuardarKey').addEventListener('click', () => {
  const v = $('#apiKey').value.trim();
  if (!v.startsWith('sk-ant-')) { $('#keyEstado').innerHTML = '<span class="text-rosa">La clave debe empezar por sk-ant-</span>'; return; }
  localStorage.setItem(LS.key, v); $('#keyEstado').textContent = 'Clave guardada en este dispositivo.';
});
$('#btnBorrarKey').addEventListener('click', () => { localStorage.removeItem(LS.key); $('#apiKey').value = ''; $('#keyEstado').textContent = 'Clave eliminada.'; });
$('#btnVer').addEventListener('click', () => {
  const i = $('#apiKey'), show = i.type === 'password';
  i.type = show ? 'text' : 'password'; $('#btnVer').textContent = show ? 'Ocultar' : 'Ver';
});
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#btnInstalar').classList.remove('hidden'); });
$('#btnInstalar').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#btnInstalar').classList.add('hidden');
});

function toast(msg, isError = false) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.className = `fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2 rounded-full text-sm font-semibold shadow-lg max-w-[90vw] text-center ${isError ? 'bg-rosa text-ink' : 'bg-[#e7e9ee] text-ink'}`;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

/* ---------- Inicio ---------- */
(function init() {
  $('#fecha').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!localStorage.getItem(LS.week)) saveJSON(LS.week, DEFAULT_WEEK);
  renderDays(); renderSchedule();
  const d = loadJSON(LS.draft, {});
  $('#inTareas').value = d.tareas || ''; $('#inEventos').value = d.eventos || '';
  $('#inCorreos').value = d.correos || ''; $('#inNotas').value = d.notas || '';
  updateSavings(); updateManana(); updateCierreBadge(); refreshNotifUI();
  if (localStorage.getItem(LS.key)) $('#keyEstado').textContent = 'Hay una clave guardada en este dispositivo.';
  renderDashboard(); renderRecHoy(); $('#recFecha').min = today();
  if (state?.fecha) $('#estado').textContent = `Último plan: ${new Date(state.fecha).toLocaleString('es-CO', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
  showTab(new URLSearchParams(location.search).get('tab') || 'hoy');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(syncSW).catch((e) => console.warn('SW', e));
  setInterval(() => { checkBlocks(); checkRecs(); updateCierreBadge(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkBlocks(); checkRecs(); renderRecHoy(); } });
  checkBlocks(); checkRecs();
})();
