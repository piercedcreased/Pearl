// Every day page: routines with a time and days. Saved in localStorage pearl.routines, so the
// reminders (flow.js) know what's due. The first run starts from the sample rows in the HTML.
// Each routine: { id, name, h, m (24 h), days [Mon..Sun booleans], lock, streak, doneOn, c }

window.PearlDaily = (() => {
  const page = document.querySelector('.page-daily');
  const KEY = 'pearl.routines';
  const list = page.querySelector('.routines');
  const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const clock = (h, m) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const daysText = days => days.every(Boolean) ? 'Every day' : days.map((on, i) => on ? NAMES[i] : null).filter(Boolean).join(', ') || 'No days picked';
  const streakText = n => !n ? 'New' : n >= 14 && n % 7 === 0 ? `${n / 7} week streak` : `${n} day streak`;

  function fromHtml() {
    return [...list.querySelectorAll('.routine')].map((li, i) => {
      const [, hh, mm, ap] = li.querySelector('.r-time').textContent.match(/(\d+):(\d+)\s*(AM|PM)/) || [, 9, 0, 'AM'];
      const dtext = li.querySelector('.r-days').textContent;
      const days = dtext === 'Every day' ? Array(7).fill(true) : NAMES.map(n => dtext.includes(n));
      const st = li.querySelector('.streak').textContent.match(/(\d+)\s*(day|week)/);
      return {
        id: 'r' + (i + 1), name: li.querySelector('.name').textContent,
        h: (+hh % 12) + (ap === 'PM' ? 12 : 0), m: +mm, days,
        lock: !li.querySelector('.lock-chip').classList.contains('off'),
        streak: st ? +st[1] * (st[2] === 'week' ? 7 : 1) : 0,
        doneOn: li.classList.contains('done') ? ymd() : null,
        c: [...li.classList].find(c => /^c\d$/.test(c)) || 'c1',
      };
    });
  }

  let routines;
  try { routines = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!Array.isArray(routines)) routines = fromHtml();
  const save = () => { localStorage.setItem(KEY, JSON.stringify(routines)); document.dispatchEvent(new Event('pearl-routines')); };

  function render() {
    const today = ymd();
    list.innerHTML = '';
    for (const r of routines) {
      const li = document.createElement('li');
      li.className = `routine ${r.c}` + (r.doneOn === today ? ' done' : '');
      li.dataset.id = r.id;
      li.innerHTML = `<button class="check" aria-label="${r.doneOn === today ? 'Done today' : 'Mark done today'}"></button>
        <span class="r-main"><span class="name"></span><span class="r-days"></span></span>
        <span class="r-time"></span><span class="streak"></span>
        <span class="lock-chip${r.lock ? '' : ' off'}" title="${r.lock ? 'Locks your screen' : 'Just the mascot popup'}">${r.lock ? 'Locks' : 'Popup'}</span>
        <button class="r-del" aria-label="Remove" title="Remove">&times;</button>`;
      li.querySelector('.name').textContent = r.name;
      li.querySelector('.r-days').textContent = daysText(r.days);
      li.querySelector('.r-time').textContent = clock(r.h, r.m);
      li.querySelector('.streak').textContent = streakText(r.streak);
      list.appendChild(li);
    }
    if (!routines.length) list.innerHTML = '<li class="r-empty">Nothing yet. Add something below.</li>';
    count();
  }

  function count() {
    const today = ymd(), done = routines.filter(r => r.doneOn === today).length;
    page.querySelector('.count-pill').textContent = `${done} of ${routines.length} done today`;
  }

  // points.js flips the row's done class and rolls points; this saves it.
  document.addEventListener('click', e => {
    const check = e.target.closest('.page-daily .routine .check');
    if (check) setTimeout(() => {
      const li = check.closest('.routine'), r = routines.find(x => x.id === li.dataset.id);
      if (!r) return;
      const done = li.classList.contains('done'), today = ymd();
      if (done && r.doneOn !== today) { r.doneOn = today; r.streak++; }
      if (!done && r.doneOn === today) { r.doneOn = null; r.streak = Math.max(0, r.streak - 1); }
      save(); count();
    }, 0);
    const del = e.target.closest('.page-daily .r-del');
    if (del) {
      const id = del.closest('.routine').dataset.id, r = routines.find(x => x.id === id);
      if (r && confirm(`Remove "${r.name}"?`)) { routines = routines.filter(x => x.id !== id); save(); render(); }
    }
  });

  // add form: real hour/minute choices
  const form = page.querySelector('.routine-add');
  const [hSel, mSel] = form.querySelectorAll('.tp-row select');
  hSel.innerHTML = Array.from({ length: 12 }, (_, i) => `<option${i + 1 === 6 ? ' selected' : ''}>${i + 1}</option>`).join('');
  mSel.innerHTML = Array.from({ length: 12 }, (_, i) => `<option${i === 0 ? ' selected' : ''}>${String(i * 5).padStart(2, '0')}</option>`).join('');
  form.querySelector('.tp-ampm').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    form.querySelectorAll('.tp-ampm button').forEach(x => x.classList.toggle('on', x === b));
  });
  page.querySelector('.days-pick').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) b.classList.toggle('on');
  });
  page.querySelector('.add-routine').addEventListener('click', () => {
    const input = form.querySelector('input'), name = input.value.trim();
    if (!name) { input.focus(); return; }
    const pm = (form.querySelector('.tp-ampm .on')?.textContent || 'PM') === 'PM';
    routines.push({
      id: 'r' + Date.now().toString(36), name,
      h: (+hSel.value % 12) + (pm ? 12 : 0), m: +mSel.value,
      days: [...form.querySelectorAll('.days-pick button')].map(b => b.classList.contains('on')),
      lock: form.querySelector('.toggle').classList.contains('on'),
      streak: 0, doneOn: null, c: 'c' + (routines.length % 4 + 1),
    });
    input.value = '';
    save(); render();
  });

  render();
  // a new day: un-check yesterday's
  let day = ymd();
  setInterval(() => { if (ymd() !== day) { day = ymd(); render(); } }, 60e3);

  return {
    list: () => routines,
    ymd, clock,
    markDone(id) {
      const r = routines.find(x => x.id === id); if (!r || r.doneOn === ymd()) return;
      r.doneOn = ymd(); r.streak++; save(); render();
    },
  };
})();
