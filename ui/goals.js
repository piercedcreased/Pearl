// Goals: saved in localStorage pearl.goals, start empty. Made with the New goal form.
// Kinds: times (pips), amount (bar), streak (day squares), weekly (M-S boxes, resets Monday),
// percent (drag the bar), steps (a checklist fills the bar).
// A times/streak/weekly goal can count an Every day routine: checking it off logs one.
// Finishing a goal pays its bonus once and moves it to Finished. Any goal can be deleted (with Undo).

window.PearlGoals = (() => {
  const KEY = 'pearl.goals';
  const grid = document.querySelector('.goal-grid');
  const page = document.querySelector('.page-goals');
  const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDate = s => s ? new Date(s + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const monday = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return ymd(x); };
  const money = (g, n) => (g.unit || '') + n.toLocaleString('en-US', Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ICON = {
    times: '<path d="M5 12l4 4 10-10"/><circle cx="12" cy="12" r="10"/>',
    amount: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.6-.6-3-1.6M12 6v2M12 16v2"/>',
    streak: '<path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/>',
    weekly: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    percent: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    steps: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2"/><circle cx="5" cy="18" r="1.2"/>',
  };

  let goals = [];
  try { goals = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  if (!Array.isArray(goals)) goals = [];
  const save = () => { localStorage.setItem(KEY, JSON.stringify(goals)); document.dispatchEvent(new Event('pearl-goals')); };

  /* ---------- progress ---------- */
  function streakNow(g) {
    // days in a row ending today (or yesterday, if today isn't logged yet)
    const d = new Date(); let n = 0;
    if (!g.log[ymd(d)]) d.setDate(d.getDate() - 1);
    while (g.log[ymd(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function weekDays(g) {
    if (g.week !== monday()) { g.week = monday(); g.days = [false, false, false, false, false, false, false]; g.paidWeek = null; }
    return g.days;
  }
  function amountOf(g) {
    switch (g.kind) {
      case 'times': case 'amount': case 'percent': return g.value;
      case 'streak': return streakNow(g);
      case 'weekly': return weekDays(g).filter(Boolean).length;
      case 'steps': return g.steps.filter(s => s.done).length;
    }
    return 0;
  }
  const goalOf = g => g.kind === 'percent' ? 100 : g.kind === 'steps' ? g.steps.length : g.target;
  const pctOf = g => { const t = goalOf(g); return t ? Math.min(100, Math.round(amountOf(g) / t * 100)) : 0; };

  // Reaching the target finishes the goal and pays the bonus once. Weekly goals pay once per week.
  function settle(g, anchor) {
    const reached = goalOf(g) > 0 && amountOf(g) >= goalOf(g);
    if (g.kind === 'weekly') {
      if (reached && g.paidWeek !== g.week) {
        g.paidWeek = g.week; pay(g, anchor, `${g.name}: week done!`);
      }
      return;
    }
    if (reached && !g.doneOn) { g.doneOn = ymd(); if (!g.paid) { g.paid = true; pay(g, anchor, `Goal done: ${g.name}!`); } }
    if (!reached && g.doneOn) g.doneOn = null; // took a step back; the bonus stays paid
  }
  function pay(g, anchor, text) {
    if (!g.bonus) { PearlToast(text); return; }
    PearlPoints.add(g.bonus);
    if (anchor) PearlPoints.pop(anchor, `+${g.bonus}`, true);
    PearlToast(`${text} +${g.bonus} points`);
  }

  /* ---------- drawing ---------- */
  function subtitle(g) {
    const have = amountOf(g), due = g.due ? `, by ${fmtDate(g.due)}` : '';
    switch (g.kind) {
      case 'times': return `${have} of ${g.target} times${due}`;
      case 'amount': return `${money(g, have)} of ${money(g, g.target)}${due}`;
      case 'streak': return have >= g.target ? `${g.target} days in a row!` : `${have} day streak, ${g.target - have} to go`;
      case 'weekly': return `${have} of ${g.target} this week`;
      case 'percent': return (have >= 100 ? 'Done!' : have ? `${have}% there` : 'Not started yet') + due;
      case 'steps': return g.steps.length ? (have === g.steps.length ? 'All steps done!' : `${have} of ${g.steps.length} steps`) + due : 'Add the first step';
    }
  }
  function linkText(g) {
    const r = g.link && window.PearlDaily?.list().find(x => x.id === g.link);
    return r ? `Counts when you finish <b>${esc(r.name)}</b>` : '';
  }

  function body(g) {
    const have = amountOf(g), pct = pctOf(g);
    switch (g.kind) {
      case 'times': {
        const big = g.target <= 4, cells = g.target <= 30;
        const vis = cells ? `<div class="pips${big ? ' big' : ''}" style="--n:${g.target}">${Array.from({ length: g.target }, (_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('')}</div>`
          : `<div class="bar"><i style="width:${pct}%"></i><span>${pct}%</span></div>`;
        return vis + `<div class="g-foot"><span class="g-link">${linkText(g) || 'You log these yourself'}</span>
          <span class="g-btns">${have ? '<button class="ghost small" data-act="minus" aria-label="Take one back">&minus;</button>' : ''}<button class="ghost small" data-act="plus">Log one</button></span></div>`;
      }
      case 'amount':
        return `<div class="bar"><i style="width:${pct}%"></i><span>${pct}%</span></div>
          <div class="g-foot"><span class="g-link">You add to this one yourself</span>
          <form class="g-amt"><input inputmode="decimal" placeholder="${esc(g.unit || '')}0" aria-label="Amount to add"><button class="ghost small">Add</button></form></div>`;
      case 'streak': {
        const n = Math.min(g.target, 30), today = ymd(), d = new Date();
        // the streak so far, then today, then the days still to go
        const cells = Array.from({ length: n }, (_, i) => i < Math.min(have, n) ? '<i class="on"></i>' : i === Math.min(have, n) && !g.log[today] ? '<i class="is-today"></i>' : '<i></i>').join('');
        return `<div class="days" style="--n:${Math.min(n, 14)}">${cells}</div>
          <div class="g-foot"><span class="g-link">${linkText(g) || 'Miss a day and it starts over'}</span>
          <button class="ghost small" data-act="today">${g.log[today] ? 'Undo today' : 'Log today'}</button></div>`;
      }
      case 'weekly': {
        const days = weekDays(g), t = (new Date().getDay() + 6) % 7;
        // a day only counts as missed if the goal existed then
        const dayOf = i => { const d = new Date(); d.setDate(d.getDate() - t + i); return ymd(d); };
        return `<div class="week">${'MTWTFSS'.split('').map((l, i) => `<span class="${days[i] ? 'on' : i < t && dayOf(i) >= g.created ? 'miss' : ''}" data-day="${i}">${l}</span>`).join('')}</div>
          <div class="g-foot"><span class="g-link">${linkText(g) || 'Resets every Monday'}</span>
          <button class="ghost small" data-act="today">${days[t] ? 'Undo today' : 'Log today'}</button></div>`;
      }
      case 'percent':
        return `<label class="pct"><input type="range" min="0" max="100" step="5" value="${have}" style="--v:${have}%" aria-label="How far along"><output>${have}%</output></label>
          <div class="g-foot"><span class="g-link">Drag the bar to where you're at</span>${have < 100 ? '<button class="ghost small" data-act="full">Mark done</button>' : ''}</div>`;
      case 'steps':
        return `<div class="bar"><i style="width:${pct}%"></i><span>${pct}%</span></div>
          <ul class="steps">${g.steps.map((s, i) => `<li class="${s.done ? 'done' : ''}" data-step="${i}"><button class="step-check" aria-label="${s.done ? 'Step done' : 'Mark step done'}"></button><span>${esc(s.name)}</span><button class="step-del" aria-label="Remove step">&times;</button></li>`).join('')}</ul>
          <form class="step-add"><span class="plus">+</span><input placeholder="Add a step" maxlength="80"></form>`;
    }
    return '';
  }

  function card(g) {
    return `<article class="goal card ${g.c}${g.doneOn ? ' complete' : ''}" data-id="${g.id}" data-goal="${g.kind}">
      <div class="g-head">
        <span class="g-icon"><svg viewBox="0 0 24 24">${ICON[g.kind]}</svg></span>
        <div><h3>${esc(g.name)}</h3><p>${esc(subtitle(g))}</p></div>
        ${g.bonus ? `<span class="g-reward">+${g.bonus}</span>` : ''}
        <button class="g-del" data-act="del" aria-label="Delete goal" title="Delete goal">&times;</button>
      </div>${body(g)}</article>`;
  }

  function render() {
    const active = goals.filter(g => !g.doneOn), done = goals.filter(g => g.doneOn);
    grid.innerHTML = active.map(card).join('')
      + (!goals.length ? `<section class="card empty-state span2 g-empty"><b>No goals yet</b><span>Hit New goal for something bigger: walk 20 times, save $300, a 2 week streak...</span><button class="primary" data-open-new>New goal</button></section>` : '')
      + (done.length ? `<section class="card finished span2"><h2>Finished</h2><ul>${done.map(g =>
        `<li data-id="${g.id}"><span class="tick"></span><span class="name">${esc(g.name)}</span><span class="when">${fmtDate(g.doneOn)}</span><span class="pts">${g.bonus ? '+' + g.bonus : ''}</span><button class="g-del" data-act="del" aria-label="Delete goal" title="Delete goal">&times;</button></li>`).join('')}</ul></section>` : '');
    // side: which every-day things count toward a goal
    const helps = active.filter(g => g.link).map(g => [g, window.PearlDaily?.list().find(r => r.id === g.link)]).filter(([, r]) => r);
    const side = page.querySelector('.helps');
    side.hidden = !helps.length;
    side.querySelector('ul').innerHTML = helps.map(([g, r]) => `<li class="${g.c}"><span class="name">${esc(r.name)}</span><span class="arrow">counts toward</span><b>${esc(g.name)}</b></li>`).join('');
    const close = active.map(g => [g, pctOf(g)]).sort((a, b) => b[1] - a[1])[0];
    page.querySelector('.goals-side .bubble').textContent = !goals.length ? 'Got something bigger in mind? Make it a goal and I\'ll cheer you on.'
      : !active.length ? 'Every goal done. Time for a new one?'
      : close && close[1] > 0 ? `${close[0].name}: ${close[1]}% there. Keep going!` : "Every goal starts at zero. Let's get the first one logged.";
    const nav = document.querySelector('[data-nav="goals"] b');
    if (nav) { nav.textContent = active.length; nav.hidden = !active.length; }
  }

  /* ---------- clicks on the cards ---------- */
  const find = el => goals.find(g => g.id === el.closest('[data-id]')?.dataset.id);
  grid.addEventListener('click', e => {
    if (e.target.closest('[data-open-new]')) { location.hash = 'goals/new'; return; }
    const g = find(e.target); if (!g) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    const anchor = e.target.closest('button, li') || e.target;
    if (act === 'del') {
      const i = goals.indexOf(g);
      goals.splice(i, 1); save(); render();
      PearlToast(`Deleted "${g.name}"`, 'Undo', () => { goals.splice(Math.min(i, goals.length), 0, g); save(); render(); });
      return;
    }
    const today = ymd();
    if (act === 'plus') g.value++;
    else if (act === 'minus') g.value = Math.max(0, g.value - 1);
    else if (act === 'full') g.value = 100;
    else if (act === 'today' && g.kind === 'streak') { if (g.log[today]) delete g.log[today]; else g.log[today] = true; }
    else if (act === 'today' && g.kind === 'weekly') { const t = (new Date().getDay() + 6) % 7; weekDays(g)[t] = !g.days[t]; }
    else if (e.target.closest('.step-del')) g.steps.splice(+e.target.closest('li').dataset.step, 1);
    else if (e.target.closest('.steps li')) { const s = g.steps[+e.target.closest('li').dataset.step]; s.done = !s.done; }
    else if (e.target.closest('.week [data-day]') && g.kind === 'weekly') {
      // tap a day earlier this week to fix it
      const i = +e.target.closest('[data-day]').dataset.day, t = (new Date().getDay() + 6) % 7;
      if (i > t) return;
      weekDays(g)[i] = !g.days[i];
    } else return;
    settle(g, anchor); save(); render();
  });
  grid.addEventListener('submit', e => {
    e.preventDefault();
    const g = find(e.target); if (!g) return;
    const inp = e.target.querySelector('input'), v = inp.value.trim();
    if (e.target.classList.contains('step-add')) { if (!v) return; g.steps.push({ name: v, done: false }); }
    if (e.target.classList.contains('g-amt')) {
      const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
      if (!isFinite(n) || !n) { inp.focus(); return; }
      g.value = Math.max(0, g.value + n);
    }
    settle(g, e.target); save(); render();
    grid.querySelector(`[data-id="${g.id}"] ${e.target.classList.contains('step-add') ? '.step-add' : '.g-amt'} input`)?.focus();
  });
  grid.addEventListener('input', e => {
    if (e.target.type !== 'range') return;
    const g = find(e.target); if (!g) return;
    g.value = +e.target.value;
    e.target.style.setProperty('--v', g.value + '%');
    e.target.nextElementSibling.textContent = g.value + '%';
    e.target.closest('.goal').querySelector('.g-head p').textContent = subtitle(g);
  });
  grid.addEventListener('change', e => {
    if (e.target.type !== 'range') return;
    const g = find(e.target); if (!g) return;
    settle(g, e.target); save(); render();
  });

  /* ---------- New goal form ---------- */
  const form = document.getElementById('goal-form');
  const kinds = document.getElementById('goal-kinds');
  let kind = 'times';
  function pickKind(k) {
    kind = k;
    kinds.querySelectorAll('.kind').forEach(b => b.classList.toggle('on', b.dataset.kind === k));
    form.querySelectorAll('[data-kind-for]').forEach(el => { el.hidden = !el.dataset.kindFor.split(' ').includes(k); });
    form.querySelector('[data-target-label]').textContent = { times: 'How many times', amount: 'Amount to reach', streak: 'Days in a row', weekly: 'Days a week' }[k] || 'Target';
    form.querySelector('#g-target').placeholder = { times: '12', amount: '$300', streak: '14', weekly: '5' }[k] || '';
  }
  kinds.addEventListener('click', e => { const b = e.target.closest('.kind'); if (b) pickKind(b.dataset.kind); });

  // steps: typing in the last box adds a new empty one
  const stepList = document.getElementById('g-steps');
  stepList.addEventListener('input', () => {
    const boxes = [...stepList.querySelectorAll('input')];
    if (boxes[boxes.length - 1].value.trim()) stepList.insertAdjacentHTML('beforeend', '<li><input placeholder="Another step" maxlength="80"></li>');
  });

  function resetForm() {
    form.reset();
    stepList.innerHTML = '<li><input placeholder="First step" maxlength="80"></li>';
    form.querySelectorAll('.swatches i').forEach((x, i) => x.classList.toggle('on', i === goals.length % 4));
    form.querySelector('#g-err').hidden = true;
    const sel = form.querySelector('#g-link');
    sel.innerHTML = '<option value="">Nothing, I\'ll log it myself</option>' + (window.PearlDaily?.list() || []).map(r => `<option value="${r.id}">${esc(r.name)} (every day)</option>`).join('');
    pickKind(new URLSearchParams(location.search).get('kind') || 'times');
  }
  const err = msg => { const p = form.querySelector('#g-err'); p.textContent = msg; p.hidden = false; };

  form.addEventListener('submit', e => {
    e.preventDefault();
    form.querySelector('#g-err').hidden = true;
    const name = form.querySelector('#g-name').value.trim();
    if (!name) { err('Give the goal a name.'); form.querySelector('#g-name').focus(); return; }
    const rawT = form.querySelector('#g-target').value.trim();
    const target = parseFloat(rawT.replace(/[^0-9.]/g, ''));
    const steps = [...stepList.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean).map(name => ({ name, done: false }));
    if (['times', 'amount', 'streak', 'weekly'].includes(kind)) {
      if (!(target > 0)) { err('Set a target bigger than 0.'); form.querySelector('#g-target').focus(); return; }
      if (kind === 'weekly' && target > 7) { err('A week only has 7 days.'); return; }
    }
    if (kind === 'steps' && !steps.length) { err('Add at least one step.'); stepList.querySelector('input').focus(); return; }
    const start = Math.max(0, Math.min(100, parseInt(form.querySelector('#g-start').value, 10) || 0));
    const g = {
      id: 'g' + Date.now().toString(36), name, kind,
      target: ['times', 'streak', 'weekly'].includes(kind) ? Math.round(target) : kind === 'amount' ? target : 0,
      unit: kind === 'amount' && rawT.startsWith('$') ? '$' : '',
      value: kind === 'percent' ? Math.round(start / 5) * 5 : 0,
      log: {}, week: monday(), days: [false, false, false, false, false, false, false], paidWeek: null,
      steps, due: form.querySelector('#g-due').value || null,
      link: ['times', 'streak', 'weekly'].includes(kind) ? form.querySelector('#g-link').value || null : null,
      c: form.querySelector('.swatches i.on')?.className.match(/c\d/)?.[0] || 'c1',
      bonus: Math.max(0, parseInt(form.querySelector('#g-bonus').value, 10) || 0),
      created: ymd(), doneOn: null, paid: false,
    };
    goals.unshift(g);
    save(); render();
    location.hash = 'goals';
  });
  addEventListener('hashchange', () => { if (location.hash === '#goals/new') resetForm(); });
  if (location.hash === '#goals/new') resetForm();

  /* ---------- an Every day routine got checked off (or unchecked) ---------- */
  function routineDone(id, done) {
    const today = ymd(), t = (new Date().getDay() + 6) % 7;
    let changed = false;
    for (const g of goals.filter(g => g.link === id)) {
      if (g.kind === 'times') g.value = Math.max(0, g.value + (done ? 1 : -1));
      else if (g.kind === 'streak') { if (done) g.log[today] = true; else delete g.log[today]; }
      else if (g.kind === 'weekly') weekDays(g)[t] = done;
      else continue;
      settle(g); changed = true;
    }
    if (changed) { save(); render(); }
  }

  addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { goals = JSON.parse(e.newValue); render(); } catch {} } });
  render();
  setInterval(render, 5 * 60e3); // streaks and weeks roll over
  return { list: () => goals.filter(g => !g.doneOn).map(g => ({ id: g.id, name: g.name, pct: pctOf(g) })), routineDone, render };
})();
