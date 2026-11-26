// Every day page: routines with a time and days. Saved in localStorage pearl.routines, so the
// reminders (flow.js) know what's due. Starts empty.
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

  let routines;
  try { routines = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!Array.isArray(routines)) routines = [];
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
    if (!routines.length) list.innerHTML = '<li class="r-empty"><b>Nothing here yet.</b><span>Add laundry, dishes, meds... anything that comes back every day.</span></li>';
    count();
  }

  function count() {
    const today = ymd(), done = routines.filter(r => r.doneOn === today).length;
    page.querySelector('.count-pill').textContent = `${done} of ${routines.length} done today`;
    const dow = (new Date().getDay() + 6) % 7, left = routines.filter(r => r.days[dow] && r.doneOn !== today).length;
    const nav = document.querySelector('[data-nav="daily"] b');
    if (nav) { nav.textContent = left; nav.hidden = !left; }
    const mins = new Date().getHours() * 60 + new Date().getMinutes();
    const next = routines.filter(r => r.days[dow] && r.doneOn !== today && r.h * 60 + r.m >= mins).sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m))[0];
    const bubble = page.querySelector('.daily-bubble');
    if (bubble) bubble.textContent = !routines.length ? "Add your every-day stuff and I'll remind you when it's time."
      : next ? `${next.name}'s next at ${clock(next.h, next.m)}. I'll give you a heads up first.` : 'Nothing else today. Nice.';
  }

  // checking one off rolls points; unchecking gives back exactly what it rolled
  list.addEventListener('click', e => {
    const li = e.target.closest('.routine'); if (!li) return;
    const r = routines.find(x => x.id === li.dataset.id); if (!r) return;
    const today = ymd();
    if (e.target.closest('.r-del')) {
      const i = routines.indexOf(r);
      routines.splice(i, 1); save(); render();
      PearlToast(`Removed "${r.name}"`, 'Undo', () => { routines.splice(Math.min(i, routines.length), 0, r); save(); render(); });
      return;
    }
    const check = e.target.closest('.check'); if (!check) return;
    if (r.doneOn !== today) {
      const { pts, lucky } = PearlPoints.roll();
      r.doneOn = today; r.streak++; r.rolled = pts;
      PearlPoints.add(pts);
      PearlPoints.pop(check, lucky ? `Lucky! +${pts}` : `+${pts}`, lucky);
    } else {
      PearlPoints.take(r.rolled || 0);
      r.doneOn = null; r.streak = Math.max(0, r.streak - 1); r.rolled = 0;
    }
    save(); render();
    window.PearlGoals?.routineDone(r.id, r.doneOn === today);
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
    markDone(id, pts = 0) {
      const r = routines.find(x => x.id === id); if (!r || r.doneOn === ymd()) return;
      r.doneOn = ymd(); r.streak++; r.rolled = pts; save(); render();
      window.PearlGoals?.routineDone(id, true);
    },
  };
})();
