/* =========================================================
   Estación de niebla — app.js
   Fuente de datos: TODOS los .xlsx de la carpeta excel/
   Foto del panel:  assets/panel.jpg (o .png)
   Requiere abrir la página con iniciar.bat (servidor local),
   porque un navegador no puede leer carpetas desde file://
   ========================================================= */

const CARPETA_EXCEL = 'excel/';
const RUTAS_IMAGEN = ['assets/panel.jpg', 'assets/panel.png', 'assets/panel.jpeg'];
const K_FECHAS = 'estacion_niebla_fechas';        // fechas corregidas a mano, por archivo

let sesiones = [];
let imagenPanel = null;
const graficas = {};
const filtro = { anio: '', mes: '', dia: '', sesion: '' };
let fechasManuales = leer(K_FECHAS, {});

function leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function avisar(msg, error) {
  const el = document.getElementById('aviso');
  el.textContent = msg; el.className = 'aviso' + (error ? ' error' : ''); el.style.display = 'block';
  clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', 4500);
}

/* =========================================================
   Pestañas y botones
   ========================================================= */
document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.nav button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.pestana').forEach(p => p.classList.toggle('on', p.id === 'tab-' + b.dataset.tab));
  render();
}));
/* =========================================================
   Vigilancia automática de la carpeta excel/
   Cada pocos segundos mira qué archivos hay y su fecha de
   modificación. Si algo cambió, recarga los datos solo.
   ========================================================= */
const CADA_MS = 4000;
let firmaAnterior = null;
let nombresAnteriores = new Set();

function nombreDesdeHref(href) {
  return decodeURIComponent(href.split('?')[0].split('/').filter(Boolean).pop() || '');
}

async function listarArchivos() {
  const html = await (await fetch(CARPETA_EXCEL, { cache: 'no-store' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('a')].map(a => nombreDesdeHref(a.getAttribute('href') || ''))
    .filter(h => /\.xlsx$/i.test(h) && !h.startsWith('~$'));
}

async function firmaCarpeta() {
  const nombres = await listarArchivos();
  const partes = [];
  for (const n of nombres) {
    try {
      const r = await fetch(CARPETA_EXCEL + encodeURIComponent(n), { method: 'HEAD', cache: 'no-store' });
      partes.push(n + '|' + (r.headers.get('last-modified') || '') + '|' + (r.headers.get('content-length') || ''));
    } catch { partes.push(n); }
  }
  // La foto del panel también entra en la firma: si la cambias, se refresca sola
  for (const ruta of RUTAS_IMAGEN) {
    try {
      const r = await fetch(ruta, { method: 'HEAD', cache: 'no-store' });
      if (r.ok) partes.push('IMG|' + ruta + '|' + (r.headers.get('last-modified') || '') + '|' + (r.headers.get('content-length') || ''));
    } catch {}
  }
  return { firma: partes.sort().join('\n'), nombres };
}

async function vigilar() {
  const vig = document.querySelectorAll('.vigia');
  try {
    const { firma, nombres } = await firmaCarpeta();
    vig.forEach(v => { v.classList.remove('error'); v.querySelector('.txt').textContent = `Vigilando excel/ · ${nombres.length} archivo(s) · ${new Date().toLocaleTimeString('es-CO')}`; });
    if (firma !== firmaAnterior) {
      const esPrimera = firmaAnterior === null;
      const nuevos = nombres.filter(n => !nombresAnteriores.has(n));
      firmaAnterior = firma; nombresAnteriores = new Set(nombres);
      await cargarTodo(esPrimera ? [] : nuevos);
    }
  } catch (e) {
    vig.forEach(v => { v.classList.add('error'); v.querySelector('.txt').textContent = 'No se puede leer excel/ (abre con iniciar.bat o Live Server)'; });
  }
}

/* =========================================================
   Carga de la carpeta excel/
   ========================================================= */
async function cargarTodo(nuevos = []) {
  if (location.protocol === 'file:') {
    document.getElementById('panel-cuerpo').innerHTML = document.getElementById('analisis-cuerpo').innerHTML =
      `<div class="vacio"><strong>Abre el dashboard con iniciar.bat</strong>
       Abierto con doble clic el navegador no puede leer la carpeta excel/. Ejecuta <b>iniciar.bat</b> (está en la misma carpeta) y se abrirá solo en http://localhost:8000</div>`;
    return;
  }
  try {
    const archivos = await listarArchivos();
    const nuevas = [];
    for (const nombreArchivo of archivos) {
      try {
        const buf = await (await fetch(CARPETA_EXCEL + encodeURIComponent(nombreArchivo), { cache: 'no-store' })).arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const hoja = wb.Sheets['Datos'] || wb.Sheets[wb.SheetNames[0]];
        const filas = interpretar(XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null }));
        if (!filas.length) continue;
        const nombre = nombreArchivo.replace(/\.xlsx$/i, '');
        const m = nombre.match(/(\d{4})-(\d{2})-(\d{2})/);
        const fecha = fechasManuales[nombreArchivo] || (m ? `${m[1]}-${m[2]}-${m[3]}` : new Date().toISOString().slice(0, 10));
        nuevas.push({ id: nombreArchivo, nombre, fecha, filas });
      } catch (e) { console.warn('No se pudo leer', nombreArchivo, e); }
    }
    sesiones = nuevas;
    if (nuevos.length) avisar(`Nueva medición detectada: ${nuevos.join(', ')}`);
    else avisar(`${sesiones.length} medición(es) en la carpeta excel/`);
  } catch (e) {
    avisar('No pude leer la carpeta excel/: ' + e.message, true);
  }
  await cargarImagen();
  render();
}

function cargarImagen() {
  return new Promise(res => {
    let i = 0;
    const intentar = () => {
      if (i >= RUTAS_IMAGEN.length) { imagenPanel = null; return res(); }
      const img = new Image();
      img.onload = () => { imagenPanel = RUTAS_IMAGEN[i] + '?v=' + Date.now(); res(); };
      img.onerror = () => { i++; intentar(); };
      img.src = RUTAS_IMAGEN[i] + '?v=' + Date.now();
    };
    intentar();
  });
}

function interpretar(crudo) {
  if (!crudo.length) return [];
  const enc = crudo[0].map(x => String(x ?? '').toLowerCase());
  const col = (...k) => enc.findIndex(h => k.some(c => h.includes(c)));
  const iMin = col('minuto'), iHora = col('hora'), iT = col('temperatura', 'temp'), iH = col('humedad', 'hum');
  const iG = col('gramos acumulados', 'agua total (ml)', 'gramos'), iGm = col('gramos en este minuto', 'ml por minuto');
  const out = [];
  for (let r = 1; r < crudo.length; r++) {
    const f = crudo[r];
    if (!f || f[iMin] == null || isNaN(Number(f[iMin]))) continue;
    out.push({ minuto: +f[iMin], hora: iHora >= 0 ? String(f[iHora] ?? '') : '', temp: +f[iT], hum: +f[iH], g: +f[iG], gm: iGm >= 0 ? +f[iGm] : NaN });
  }
  out.forEach((f, i) => { if (isNaN(f.gm)) f.gm = i ? Math.max(0, f.g - out[i - 1].g) : f.g; });
  return out;
}

/* =========================================================
   Cálculos
   ========================================================= */
const prom = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const f1 = x => isNaN(x) ? '—' : x.toFixed(1);
function dur(min) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h ${m} min` : `${m} min`; }
function resumen(filas) {
  const t = filas.map(f => f.temp).filter(x => !isNaN(x)), h = filas.map(f => f.hum).filter(x => !isNaN(x));
  const g = filas.length ? filas[filas.length - 1].g : 0, min = filas.length ? filas[filas.length - 1].minuto : 0;
  const gmin = min ? g / min : 0;
  return { min, g, gmin, h1L: gmin > 0 ? 1000 / gmin / 60 : null,
           tP: prom(t), tMin: Math.min(...t), tMax: Math.max(...t), hP: prom(h), hMin: Math.min(...h), hMax: Math.max(...h) };
}

// Promedio de TODAS las filas de TODOS los Excel de la carpeta.
// Es la única fuente de los tres datos que se ven sobre el panel y en el 3D.
// 1 g de agua = 1 mL, así que el peso de la celda se muestra como mililitros.
function promediosTodos() {
  const filas = sesiones.flatMap(s => s.filas);
  const p = k => prom(filas.map(k).filter(x => !isNaN(x)));
  return { t: p(f => f.temp), h: p(f => f.hum), mlMin: p(f => f.gm) };
}
const fechaBonita = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/* =========================================================
   Render
   ========================================================= */
function render() {
  Object.values(graficas).forEach(g => g.destroy()); for (const k in graficas) delete graficas[k];
  if (document.getElementById('tab-panel').classList.contains('on')) renderPanel(); else renderAnalisis();
}

/* ---------- Pestaña PANEL ---------- */
function renderPanel() {
  const cont = document.getElementById('panel-cuerpo');
  const ult = [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)).pop();
  const r = ult ? resumen(ult.filas) : null;
  const g = promediosTodos();

  const pins = ult ? `
    <div class="pin p1"><span class="dot" style="background:var(--amber)">${ico('temp')}</span><div>${f1(g.t)} °C<small>temperatura promedio</small></div></div>
    <div class="pin p2"><span class="dot" style="background:var(--sky)">${ico('gota')}</span><div>${f1(g.h)} %<small>humedad promedio</small></div></div>
    <div class="pin p3"><span class="dot" style="background:var(--violet)">${ico('agua')}</span><div>${f1(g.mlMin)} mL<small>agua promedio por minuto</small></div></div>
    <div class="pin p4"><span class="dot" style="background:var(--green)">${ico('reloj')}</span><div>${dur(r.min)}<small>${fechaBonita(ult.fecha)}</small></div></div>` : '';

  cont.innerHTML = `
    <div class="panel-grid">
      <div class="escena">
        <div class="imagen">
          ${imagenPanel ? `<img src="${imagenPanel}" alt="Foto del panel de la estación">` : `<div id="panel-3d" style="width:100%;height:100%;"></div>`}
          ${pins}
        </div>
        <div class="barra-sensores">
          <div class="sensor"><span class="ic">${ico('temp')}</span><div><strong>DHT11</strong><span>Temperatura y humedad</span></div><span class="estado ${ult ? 'ok' : ''}"></span></div>
          <div class="sensor"><span class="ic">${ico('peso')}</span><div><strong>Celda de carga + HX711</strong><span>Peso del agua</span></div><span class="estado ${ult ? 'ok' : ''}"></span></div>
          <div class="sensor"><span class="ic">${ico('pantalla')}</span><div><strong>LCD 16x2 I2C</strong><span>${ult ? 'Última medición: ' + fechaBonita(ult.fecha) : 'Sin mediciones en excel/'}</span></div><span class="estado ${ult ? 'ok' : ''}"></span></div>
        </div>
      </div>

      <div class="col">
        <div class="card">
          <div class="enc"><div><h3>Agua captada</h3><div class="sub">Última medición</div></div>${ult ? `<span class="badge">${f1(r.gmin)} mL/min</span>` : ''}</div>
          <div class="grande">${ult ? Math.round(r.g) : 0}<small>mL</small></div>
          <div class="spark"><canvas id="gSpark"></canvas></div>
          <div class="lista-mini">
            <span>Por hora</span><span>${ult ? Math.round(r.gmin * 60) + ' mL/h' : '—'}</span>
            <span>1000 mL en</span><span>${ult && r.h1L ? f1(r.h1L) + ' h' : '—'}</span>
            <span>Duración</span><span>${ult ? dur(r.min) : '—'}</span>
          </div>
        </div>

        <div class="card">
          <div class="enc"><div><h3>Temperatura</h3><div class="sub">Promedio de la medición</div></div></div>
          <div class="gauge">${gauge(ult ? r.tP : NaN, 0, 40, '°C', ult ? [r.tMin, r.tMax] : null)}</div>
          <div class="nota">${ult ? `mínima ${f1(r.tMin)} · máxima ${f1(r.tMax)} °C` : 'Copia un Excel en la carpeta excel/'}</div>
        </div>

        <div class="card">
          <div class="enc"><div><h3>Humedad</h3><div class="sub">Promedio de la medición</div></div><span class="badge">${ult ? f1(r.hP) + ' %' : '—'}</span></div>
          <div class="barra"><i style="width:${ult ? Math.min(100, r.hP) : 0}%"></i></div>
          <div class="pill-row"><span>mín <b>${ult ? f1(r.hMin) : '—'} %</b></span><span>·</span><span>máx <b>${ult ? f1(r.hMax) : '—'} %</b></span></div>
        </div>
      </div>
    </div>`;

  if (ult) {
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    graficas.spark = new Chart(document.getElementById('gSpark'), {
      type: 'line',
      data: { labels: ult.filas.map(f => f.minuto), datasets: [{ data: ult.filas.map(f => f.g), borderColor: '#8B7CF6', backgroundColor: 'rgba(139,124,246,.15)', fill: true, tension: .3, pointRadius: 0, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => Math.round(c.parsed.y) + ' mL' } } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }
    });
  }

  if (!imagenPanel) {
    document.getElementById('panel-3d').innerHTML =
      `<iframe src="panel-3d-real.html?${promedios3D()}" title="Panel 3D" style="width:100%;height:100%;border:0;display:block"></iframe>`;
  }
}

// Los mismos tres promedios de los pines, para las etiquetas del panel 3D
function promedios3D() {
  const g = promediosTodos();
  return new URLSearchParams({
    t: isNaN(g.t) ? '—' : `${f1(g.t)} °C`,
    h: isNaN(g.h) ? '—' : `${f1(g.h)} %`,
    l: isNaN(g.mlMin) ? '—' : `${f1(g.mlMin)} mL`
  }).toString();
}

function gauge(v, min, max, unidad, rango) {
  const R = 80, cx = 110, cy = 100;
  const ang = t => Math.PI * (1 - Math.max(0, Math.min(1, (t - min) / (max - min))));
  const pt = t => ({ x: cx + R * Math.cos(ang(t)), y: cy - R * Math.sin(ang(t)) });
  const arco = (a, b, color, w) => { const p = pt(a), q = pt(b); return `<path d="M${p.x} ${p.y} A${R} ${R} 0 0 1 ${q.x} ${q.y}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; };
  const ticks = []; for (let i = 0; i <= 40; i++) { const t = min + (max - min) * i / 40; const a = ang(t); const r1 = R + 12, r2 = R + (i % 10 === 0 ? 20 : 16); ticks.push(`<line x1="${cx + r1 * Math.cos(a)}" y1="${cy - r1 * Math.sin(a)}" x2="${cx + r2 * Math.cos(a)}" y2="${cy - r2 * Math.sin(a)}" stroke="#D6D3EE" stroke-width="1.5"/>`); }
  const ok = !isNaN(v);
  return `<svg viewBox="0 0 220 125">
    ${ticks.join('')}
    ${arco(min, max, '#EEEDF8', 12)}
    ${rango ? arco(rango[0], rango[1], '#D9D3FB', 12) : ''}
    ${ok ? arco(min, v, '#8B7CF6', 12) : ''}
    <text x="${cx - R - 10}" y="${cy + 18}" class="lab" text-anchor="middle">${min}°</text>
    <text x="${cx}" y="${cy - R - 26}" class="lab" text-anchor="middle">${(min + max) / 2}°</text>
    <text x="${cx + R + 10}" y="${cy + 18}" class="lab" text-anchor="middle">${max}°</text>
    <text x="${cx}" y="${cy}" text-anchor="middle" class="val" fill="currentColor">${ok ? v.toFixed(1) : '—'}${unidad}</text>
  </svg>`;
}

/* ---------- Pestaña ANÁLISIS ---------- */
function renderAnalisis() {
  const cont = document.getElementById('analisis-cuerpo');
  if (!sesiones.length) { cont.innerHTML = `<div class="vacio"><strong>Todavía no hay mediciones</strong>Copia los Excel que genera registro_estacion.py en la carpeta <b>excel/</b> y pulsa "Recargar carpeta excel".</div>`; return; }

  const anios = [...new Set(sesiones.map(s => s.fecha.slice(0, 4)))].sort();
  const meses = [...new Set(sesiones.filter(s => !filtro.anio || s.fecha.startsWith(filtro.anio)).map(s => s.fecha.slice(0, 7)))].sort();
  const dias  = [...new Set(sesiones.filter(s => (!filtro.anio || s.fecha.startsWith(filtro.anio)) && (!filtro.mes || s.fecha.startsWith(filtro.mes))).map(s => s.fecha))].sort();
  const sel = sesiones.filter(s => (!filtro.anio || s.fecha.startsWith(filtro.anio)) && (!filtro.mes || s.fecha.startsWith(filtro.mes)) && (!filtro.dia || s.fecha === filtro.dia) && (!filtro.sesion || s.id === filtro.sesion))
                      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

  const todas = sel.flatMap(s => s.filas);
  const mlTot = sel.reduce((a, s) => a + resumen(s.filas).g, 0);
  const minTot = sel.reduce((a, s) => a + resumen(s.filas).min, 0);
  const nombreMes = m => new Date(m + '-15T12:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  cont.innerHTML = `
    <div class="stats">
      <div class="stat"><span class="ic">${ico('lista')}</span><div><b>${sel.length}</b><span>mediciones</span></div></div>
      <div class="stat"><span class="ic">${ico('reloj')}</span><div><b>${dur(minTot)}</b><span>tiempo registrado</span></div></div>
      <div class="stat"><span class="ic">${ico('agua')}</span><div><b>${Math.round(mlTot)} mL</b><span>agua captada en total</span></div></div>
      <div class="stat"><span class="ic">${ico('temp')}</span><div><b>${f1(prom(todas.map(f => f.temp)))} °C</b><span>temperatura promedio</span></div></div>
      <div class="stat"><span class="ic">${ico('gota')}</span><div><b>${f1(prom(todas.map(f => f.hum)))} %</b><span>humedad promedio</span></div></div>
    </div>

    <div class="filtros">
      <label>Año<select id="fAnio"><option value="">Todos</option>${anios.map(a => `<option ${filtro.anio === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <label>Mes<select id="fMes"><option value="">Todos</option>${meses.map(m => `<option value="${m}" ${filtro.mes === m ? 'selected' : ''}>${nombreMes(m)}</option>`).join('')}</select></label>
      <label>Día<select id="fDia"><option value="">Todos</option>${dias.map(d => `<option value="${d}" ${filtro.dia === d ? 'selected' : ''}>${fechaBonita(d)}</option>`).join('')}</select></label>
      <label>Medición<select id="fSes"><option value="">Todas</option>${sesiones.filter(s => (!filtro.dia || s.fecha === filtro.dia)).map(s => `<option value="${escapar(s.id)}" ${filtro.sesion === s.id ? 'selected' : ''}>${escapar(s.nombre)}</option>`).join('')}</select></label>
      <button class="btn limpiar" id="fLimpiar">Quitar filtros</button>
    </div>

    <div class="analisis-grid">
      <div class="col">
        <div class="card"><h3>Agua acumulada por medición</h3><div class="sub">Mililitros a lo largo de cada medición (una línea por medición)</div><div class="lienzo"><canvas id="gAcum"></canvas></div></div>
        <div class="card"><h3>Temperatura y humedad</h3><div class="sub">Minuto a minuto de las mediciones seleccionadas</div><div class="lienzo"><canvas id="gClima"></canvas></div></div>
      </div>
      <div class="col">
        <div class="card"><h3>Mililitros por medición</h3><div class="sub">Comparación entre días</div><div class="lienzo"><canvas id="gBarras"></canvas></div></div>
        <div class="card oscura">
          <div class="enc"><div><h3>Archivos en excel/</h3><div class="sub">Toca uno para verlo solo · corrige la fecha si el nombre no la traía · para quitar uno, bórralo de la carpeta</div></div><span class="badge">${sel.length}/${sesiones.length}</span></div>
          <div class="lista-med" id="listaMed"></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Tabla de datos</h3><div class="sub">${todas.length} minutos en las mediciones seleccionadas</div>
      <div class="tabla-wrap"><table>
        <thead><tr><th>Fecha</th><th>Medición</th><th>Minuto</th><th>Hora</th><th>Temp (°C)</th><th>Hum (%)</th><th>mL acumulados</th><th>mL en el minuto</th></tr></thead>
        <tbody>${sel.flatMap(s => s.filas.map(f => `<tr><td>${s.fecha}</td><td>${escapar(s.nombre)}</td><td>${f.minuto}</td><td>${escapar(f.hora)}</td><td>${f1(f.temp)}</td><td>${f1(f.hum)}</td><td>${Math.round(f.g)}</td><td>${f1(f.gm)}</td></tr>`)).join('')}</tbody>
      </table></div>
    </div>`;

  // Filtros en cascada
  const on = (id, k, reset) => document.getElementById(id).addEventListener('change', e => { filtro[k] = e.target.value; reset.forEach(x => filtro[x] = ''); render(); });
  on('fAnio', 'anio', ['mes', 'dia', 'sesion']); on('fMes', 'mes', ['dia', 'sesion']); on('fDia', 'dia', ['sesion']); on('fSes', 'sesion', []);
  document.getElementById('fLimpiar').addEventListener('click', () => { Object.keys(filtro).forEach(k => filtro[k] = ''); render(); });

  // Lista de archivos
  const lm = document.getElementById('listaMed');
  [...sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id)).forEach(s => {
    const r = resumen(s.filas), en = sel.includes(s);
    const d = document.createElement('div'); d.className = 'med';
    d.innerHTML = `<span class="check ${en ? 'si' : ''}">${en ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>' : ''}</span>
      <div class="info"><b>${escapar(s.nombre)}</b><span>${dur(r.min)} · ${Math.round(r.g)} mL · ${f1(r.tP)} °C</span></div>
      <input type="date" value="${s.fecha}" title="Fecha de la medición">`;
    d.querySelector('.info').style.cursor = 'pointer';
    d.querySelector('.info').addEventListener('click', () => { Object.keys(filtro).forEach(k => filtro[k] = ''); filtro.sesion = s.id; render(); });
    d.querySelector('input').addEventListener('change', e => { if (e.target.value) { s.fecha = e.target.value; fechasManuales[s.id] = e.target.value; guardar(K_FECHAS, fechasManuales); render(); } });
    lm.appendChild(d);
  });

  // Gráficas
  Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif"; Chart.defaults.font.size = 11;
  const paleta = ['#8B7CF6', '#4CA6E6', '#35B37A', '#F0A24B', '#E06C8C', '#5B4CD1', '#2C2A45'];
  const maxMin = Math.max(0, ...sel.map(s => s.filas.length));
  const ejeX = Array.from({ length: maxMin }, (_, i) => i + 1);
  const opc = (fmt, leyenda) => ({ responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: leyenda, position: 'bottom', labels: { usePointStyle: true, boxWidth: 7 } }, tooltip: { callbacks: { label: c => (c.dataset.label ? c.dataset.label + ': ' : '') + fmt(c.parsed.y) } } },
    scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10, color: '#7B7D95' } }, y: { beginAtZero: true, grid: { color: '#EEEDF8' }, ticks: { color: '#7B7D95', callback: v => fmt(v) } } } });

  graficas.acum = new Chart(document.getElementById('gAcum'), { type: 'line',
    data: { labels: ejeX, datasets: sel.map((s, i) => ({ label: `${s.fecha} ${s.nombre}`, data: s.filas.map(f => f.g), borderColor: paleta[i % paleta.length], tension: .25, pointRadius: 0, borderWidth: 2 })) },
    options: opc(v => Math.round(v) + ' mL', sel.length > 1) });

  const climaDatos = sel.flatMap(s => s.filas.map(f => ({ t: f.temp, h: f.hum })));
  const o2 = opc(v => v, true);
  o2.scales = { x: { grid: { display: false }, ticks: { maxTicksLimit: 10, color: '#7B7D95' } },
    y: { position: 'left', grid: { color: '#EEEDF8' }, ticks: { color: '#F0A24B' }, title: { display: true, text: '°C', color: '#F0A24B' } },
    y2: { position: 'right', grid: { display: false }, ticks: { color: '#4CA6E6' }, title: { display: true, text: '%', color: '#4CA6E6' } } };
  graficas.clima = new Chart(document.getElementById('gClima'), { type: 'line',
    data: { labels: climaDatos.map((_, i) => i + 1), datasets: [
      { label: 'Temperatura (°C)', data: climaDatos.map(d => d.t), borderColor: '#F0A24B', yAxisID: 'y', tension: .25, pointRadius: 0, borderWidth: 2 },
      { label: 'Humedad (%)', data: climaDatos.map(d => d.h), borderColor: '#4CA6E6', yAxisID: 'y2', tension: .25, pointRadius: 0, borderWidth: 2 }] },
    options: o2 });

  graficas.barras = new Chart(document.getElementById('gBarras'), { type: 'bar',
    data: { labels: sel.map(s => s.fecha), datasets: [{ data: sel.map(s => resumen(s.filas).g), backgroundColor: '#8B7CF6', borderRadius: 8, maxBarThickness: 40 }] },
    options: opc(v => Math.round(v) + ' mL', false) });

  // Exportar CSV de lo filtrado
  document.getElementById('exportar').onclick = () => {
    const lineas = ['fecha,medicion,minuto,hora,temp_C,hum_%,ml_acumulados,ml_en_el_minuto'];
    sel.forEach(s => s.filas.forEach(f => lineas.push([s.fecha, `"${s.nombre}"`, f.minuto, f.hora, f.temp, f.hum, f.g, f.gm].join(','))));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lineas.join('\n')], { type: 'text/csv' })); a.download = 'estacion_filtrado.csv'; a.click();
  };
}

/* ---------- Íconos ---------- */
function ico(n) {
  const s = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return {
    temp: `<svg ${s}><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/></svg>`,
    gota: `<svg ${s}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>`,
    agua: `<svg ${s}><path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 6c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>`,
    reloj: `<svg ${s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    peso: `<svg ${s}><path d="M4 20h16M6 20l2-11h8l2 11M9 9V5h6v4"/></svg>`,
    pantalla: `<svg ${s}><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M7 9h10M7 13h6"/></svg>`,
    lista: `<svg ${s}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`
  }[n];
}
function escapar(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

vigilar();
setInterval(vigilar, CADA_MS);
