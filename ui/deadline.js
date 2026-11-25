// "Get it all done by" time: a real countdown to a time the user picks (12-hour).
// The ring empties from 8:00 AM to the done-by time. Saved in localStorage pearl.deadline (minutes after midnight).
// ?now=13:58 fakes the current time, for screenshots.

(() => {
  const KEY = 'pearl.deadline';
  const DAY_START = 8 * 60;
  let due = parseInt(localStorage.getItem(KEY), 10);
  if (!(due >= 0 && due < 1440)) due = 16 * 60 + 15;

  const q = new URLSearchParams(location.search);
  const fake = (q.get('now') || '').match(/^(\d{1,2}):(\d{2})$/);
  const t0 = Date.now(), fakeStart = fake ? (+fake[1] * 60 + +fake[2]) * 60 : null;
  const nowSecs = () => {
    if (fakeStart !== null) return fakeStart + Math.floor((Date.now() - t0) / 1000);
    const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  };

  const pad = n => String(n).padStart(2, '0');
  const label = mins => {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
  };

  const card = document.querySelector('.deadline');
  const strong = card.querySelector('.dl-copy strong');
  const fill = card.querySelector('.ring-fill');
  const count = card.querySelector('[data-count]'), sec = card.querySelector('[data-sec]');

  function tick() {
    const left = due * 60 - nowSecs();
    strong.textContent = label(due);
    card.classList.toggle('late', left <= 0);
    if (left <= 0) {
      count.textContent = "Time's up";
      sec.textContent = 'Pick a new time?';
      fill.setAttribute('stroke-dasharray', '0 100');
      return;
    }
    const h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
    count.textContent = h ? `${h}h ${pad(m)}m` : `${m}m`;
    sec.textContent = `${pad(s)}s left`;
    const span = Math.max(60, (due - DAY_START) * 60);
    fill.setAttribute('stroke-dasharray', `${Math.max(2, Math.min(100, left / span * 100)).toFixed(1)} 100`);
  }

  /* ---------- the Change time picker ---------- */
  const pop = card.querySelector('.time-pop');
  const hourSel = pop.querySelector('[data-hour]'), minSel = pop.querySelector('[data-min]');
  hourSel.innerHTML = Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join('');
  minSel.innerHTML = Array.from({ length: 12 }, (_, i) => `<option>${pad(i * 5)}</option>`).join('');
  let ampm = 'PM';
  const setAmpm = v => { ampm = v; pop.querySelectorAll('[data-ampm]').forEach(b => b.classList.toggle('on', b.dataset.ampm === v)); };

  function open() {
    const h = Math.floor(due / 60), m = due % 60;
    hourSel.value = String(h % 12 || 12);
    minSel.value = pad(Math.round(m / 5) * 5 % 60);
    setAmpm(h < 12 ? 'AM' : 'PM');
    pop.hidden = false;
    hourSel.focus();
  }
  const close = () => { pop.hidden = true; };

  card.querySelector('[data-change-time]').addEventListener('click', e => { e.stopPropagation(); pop.hidden ? open() : close(); });
  pop.addEventListener('click', e => {
    e.stopPropagation();
    const a = e.target.closest('[data-ampm]'); if (a) setAmpm(a.dataset.ampm);
    if (e.target.closest('[data-cancel]')) close();
    if (e.target.closest('[data-save]')) {
      const h12 = +hourSel.value % 12, m = +minSel.value;
      due = (ampm === 'PM' ? h12 + 12 : h12) * 60 + m;
      localStorage.setItem(KEY, String(due));
      close(); tick();
    }
  });
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  tick(); setInterval(tick, 1000);
})();
