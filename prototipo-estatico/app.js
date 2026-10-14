/* MTB Cronômetro - protótipo frontend
 * Estado salvo em localStorage e sincronizado entre abas do mesmo navegador
 * via evento "storage" (simula o que depois será feito por um servidor em tempo real).
 * Cada "descida" (run): { id, num, start, end, status: 'track' | 'done' | 'dnf' }
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'mtb-cronometro-v1';
  const CATEGORIES = ['Elite', 'Master', 'Sport', 'Feminino', 'Iniciante'];

  // ---------- Estado ----------
  let state = load();
  let currentCat = 'Todas';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignora */ }
    return { riders: [], runs: [] };
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // Relógio único (no futuro: horário do servidor, corrigido por offset)
  function now() { return Date.now(); }

  // ---------- Utilidades ----------
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmt(ms) {
    if (ms < 0) ms = 0;
    const cs = Math.floor((ms % 1000) / 10);
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  }

  function clock(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR');
  }

  function rider(num) {
    return state.riders.find((r) => String(r.num) === String(num));
  }

  function openRun(num) {
    return state.runs.find((r) => String(r.num) === String(num) && r.status === 'track');
  }

  let toastTimer;
  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 2200);
    if (navigator.vibrate) navigator.vibrate(isErr ? [80, 60, 80] : 60);
  }

  // ---------- Ações ----------
  function startRider(num) {
    num = num.trim();
    if (!num) return toast('Informe o número', true);
    const r = rider(num);
    if (!r) return toast('Piloto #' + num + ' não cadastrado', true);
    if (openRun(num)) return toast(r.name + ' já está na pista', true);
    state.runs.push({ id: Date.now() + '-' + num, num: r.num, start: now(), end: null, status: 'track' });
    save();
    toast('🚦 ' + r.name + ' largou!');
    renderAll();
  }

  function finishRider(num) {
    num = String(num).trim();
    if (!num) return toast('Informe o número', true);
    const r = rider(num);
    if (!r) return toast('Piloto #' + num + ' não cadastrado', true);
    const run = openRun(num);
    if (!run) return toast(r.name + ' não está na pista', true);
    run.end = now();
    run.status = 'done';
    save();
    toast('🏁 ' + r.name + ' - ' + fmt(run.end - run.start));
    renderAll();
  }

  function dnf(id) {
    const run = state.runs.find((r) => r.id === id);
    if (!run) return;
    run.status = 'dnf';
    run.end = now();
    save();
    renderAll();
  }

  function undoRun(id) {
    state.runs = state.runs.filter((r) => r.id !== id);
    save();
    renderAll();
  }

  // ---------- Render ----------
  function emptyLi(text) {
    return '<li class="empty">' + text + '</li>';
  }

  function renderStart() {
    const list = state.runs.slice().sort((a, b) => b.start - a.start).slice(0, 8);
    $('startList').innerHTML = list.length
      ? list.map((run) => {
          const r = rider(run.num);
          return '<li><div class="num">' + esc(run.num) + '</div>' +
            '<div class="info"><div class="name">' + esc(r ? r.name : '?') + '</div>' +
            '<div class="sub">largou às ' + clock(run.start) + '</div></div>' +
            (run.status === 'track' ? '<button class="mini danger" data-undo="' + run.id + '">Desfazer</button>' : '') +
            '</li>';
        }).join('')
      : emptyLi('Nenhuma largada ainda');
  }

  function renderFinish() {
    const track = state.runs.filter((r) => r.status === 'track').sort((a, b) => a.start - b.start);
    $('trackCount').textContent = track.length;
    $('trackList').innerHTML = track.length
      ? track.map((run) => {
          const r = rider(run.num);
          return '<li><div class="num">' + esc(run.num) + '</div>' +
            '<div class="info"><div class="name">' + esc(r ? r.name : '?') + '</div>' +
            '<div class="sub">' + esc(r ? r.cat : '') + '</div></div>' +
            '<div class="time" data-start="' + run.start + '">' + fmt(now() - run.start) + '</div>' +
            '<button class="mini finish" data-finish="' + esc(run.num) + '">CHEGOU</button>' +
            '<button class="mini danger" data-dnf="' + run.id + '">DNF</button></li>';
        }).join('')
      : emptyLi('Ninguém na pista');

    const done = state.runs.filter((r) => r.status !== 'track').sort((a, b) => b.end - a.end).slice(0, 8);
    $('finishList').innerHTML = done.length
      ? done.map((run) => {
          const r = rider(run.num);
          return '<li><div class="num">' + esc(run.num) + '</div>' +
            '<div class="info"><div class="name">' + esc(r ? r.name : '?') + '</div>' +
            '<div class="sub">chegou às ' + clock(run.end) + '</div></div>' +
            (run.status === 'dnf'
              ? '<div class="time" style="color:var(--red)">DNF</div>'
              : '<div class="time done">' + fmt(run.end - run.start) + '</div>') +
            '<button class="mini danger" data-undo="' + run.id + '">Desfazer</button></li>';
        }).join('')
      : emptyLi('Nenhuma chegada ainda');
  }

  function buildRanking() {
    const best = {};
    state.runs.forEach((run) => {
      if (run.status !== 'done') return;
      const t = run.end - run.start;
      if (!best[run.num] || t < best[run.num].time) best[run.num] = { num: run.num, time: t };
    });
    return Object.values(best)
      .map((b) => ({ ...b, rider: rider(b.num) }))
      .filter((b) => b.rider)
      .sort((a, b) => a.time - b.time);
  }

  function renderRanking() {
    const cats = ['Todas'].concat(CATEGORIES);
    $('catChips').innerHTML = cats
      .map((c) => '<button class="chip' + (c === currentCat ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>')
      .join('');

    let rows = buildRanking();
    if (currentCat !== 'Todas') rows = rows.filter((r) => r.rider.cat === currentCat);

    $('rankBody').innerHTML = rows.length
      ? rows.map((row, i) => {
          const gap = i === 0 ? '—' : '+' + fmt(row.time - rows[0].time);
          return '<tr class="p' + (i + 1) + '">' +
            '<td class="pos">' + (i + 1) + '</td>' +
            '<td class="pname">' + esc(row.rider.name) + '<small>#' + esc(row.rider.num) + '</small></td>' +
            '<td><span class="cat-tag">' + esc(row.rider.cat) + '</span></td>' +
            '<td class="r"><strong>' + fmt(row.time) + '</strong></td>' +
            '<td class="r gap">' + gap + '</td></tr>';
        }).join('')
      : '<tr><td class="empty" colspan="5">Sem tempos nesta categoria</td></tr>';
  }

  function renderRiders() {
    const list = state.riders.slice().sort((a, b) => Number(a.num) - Number(b.num));
    $('riderList').innerHTML = list.length
      ? list.map((r) =>
          '<li><div class="num">' + esc(r.num) + '</div>' +
          '<div class="info"><div class="name">' + esc(r.name) + '</div>' +
          '<div class="sub">' + esc(r.cat) + '</div></div>' +
          '<button class="mini danger" data-del="' + esc(r.num) + '">Remover</button></li>'
        ).join('')
      : emptyLi('Nenhum piloto cadastrado');
  }

  function renderPreview(inputId, previewId, mode) {
    const num = $(inputId).value.trim();
    const el = $(previewId);
    if (!num) { el.textContent = 'Digite o número…'; el.className = 'preview'; return; }
    const r = rider(num);
    if (!r) { el.textContent = 'Piloto não encontrado'; el.className = 'preview err'; return; }
    const open = openRun(num);
    if (mode === 'start' && open) { el.textContent = r.name + ' já está na pista'; el.className = 'preview err'; return; }
    if (mode === 'finish' && !open) { el.textContent = r.name + ' não está na pista'; el.className = 'preview err'; return; }
    el.textContent = r.name + ' · ' + r.cat;
    el.className = 'preview ok';
  }

  function renderAll() {
    renderStart();
    renderFinish();
    renderRanking();
    renderRiders();
    renderPreview('startNum', 'startPreview', 'start');
    renderPreview('finishNum', 'finishPreview', 'finish');
  }

  // ---------- Navegação ----------
  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  // ---------- Eventos ----------
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

  $('btnStart').addEventListener('click', () => { startRider($('startNum').value); $('startNum').value = ''; $('startNum').focus(); renderAll(); });
  $('btnFinish').addEventListener('click', () => { finishRider($('finishNum').value); $('finishNum').value = ''; $('finishNum').focus(); renderAll(); });

  $('startNum').addEventListener('input', () => renderPreview('startNum', 'startPreview', 'start'));
  $('finishNum').addEventListener('input', () => renderPreview('finishNum', 'finishPreview', 'finish'));
  $('startNum').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnStart').click(); });
  $('finishNum').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnFinish').click(); });

  document.body.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.finish) finishRider(t.dataset.finish);
    else if (t.dataset.dnf) dnf(t.dataset.dnf);
    else if (t.dataset.undo) undoRun(t.dataset.undo);
    else if (t.dataset.cat) { currentCat = t.dataset.cat; renderRanking(); }
    else if (t.dataset.del) {
      state.riders = state.riders.filter((r) => String(r.num) !== t.dataset.del);
      save(); renderAll();
    }
  });

  $('rCat').innerHTML = CATEGORIES.map((c) => '<option>' + c + '</option>').join('');

  $('riderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const num = $('rNum').value.trim();
    const name = $('rName').value.trim();
    if (rider(num)) return toast('Número #' + num + ' já existe', true);
    state.riders.push({ num, name, cat: $('rCat').value });
    save();
    $('rNum').value = ''; $('rName').value = ''; $('rNum').focus();
    toast('Piloto adicionado');
    renderAll();
  });

  $('btnDemo').addEventListener('click', () => {
    const t = now();
    state.riders = [
      { num: '101', name: 'Lucas Silva', cat: 'Elite' },
      { num: '102', name: 'Marcos Pereira', cat: 'Elite' },
      { num: '103', name: 'Rafael Costa', cat: 'Master' },
      { num: '104', name: 'Bruno Alves', cat: 'Sport' },
      { num: '105', name: 'Ana Souza', cat: 'Feminino' },
      { num: '106', name: 'Julia Lima', cat: 'Feminino' },
      { num: '107', name: 'Pedro Rocha', cat: 'Iniciante' },
    ];
    const times = { 101: 165555, 102: 168210, 103: 172900, 104: 181430, 105: 190120, 106: 195800, 107: 214300 };
    state.runs = Object.keys(times).map((n, i) => ({
      id: 'demo-' + n, num: n, start: t - 600000 + i * 30000, end: t - 600000 + i * 30000 + times[n], status: 'done',
    }));
    save(); renderAll(); toast('Dados de exemplo carregados');
  });

  $('btnReset').addEventListener('click', () => {
    if (!confirm('Apagar todos os pilotos e tempos?')) return;
    state = { riders: [], runs: [] };
    save(); renderAll();
  });

  // Sincronização entre abas (simulação do tempo real)
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = load();
    renderAll();
    const s = $('syncStatus');
    s.classList.add('flash');
    setTimeout(() => s.classList.remove('flash'), 600);
  });

  // Cronômetros ao vivo
  setInterval(() => {
    document.querySelectorAll('[data-start]').forEach((el) => {
      el.textContent = fmt(now() - Number(el.dataset.start));
    });
  }, 50);

  // ---------- Init ----------
  renderAll();
  const initial = location.hash.replace('#', '');
  showView(['largada', 'chegada', 'ranking', 'pilotos'].includes(initial) ? initial : 'largada');
})();
