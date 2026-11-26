// Points are random (the owner's call, 2026-11-25): nothing is weighed, so laundry and a big
// project roll the same dice. Each finish rolls 5-20 points, with a 1 in 20 "lucky" roll worth
// triple. Goals still pay the fixed bonus that's set on the goal.
// Saved in localStorage pearl.points: { total, today, day }. Starts at 0.
// The to-do list (tasks.js), Every day (daily.js) and the mascot (flow.js) pay out through here.

window.PearlPoints = (() => {
  const MIN = 5, MAX = 20, LUCKY_CHANCE = 0.05, LUCKY_TIMES = 3, KEY = 'pearl.points';
  const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let p = { total: 0, today: 0, day: ymd() };
  try { p = { ...p, ...JSON.parse(localStorage.getItem(KEY)) }; } catch {}

  function roll() {
    const base = MIN + Math.floor(Math.random() * (MAX - MIN + 1));
    const lucky = Math.random() < LUCKY_CHANCE;
    return { pts: lucky ? base * LUCKY_TIMES : base, lucky };
  }

  function show() {
    if (p.day !== ymd()) { p.day = ymd(); p.today = 0; }
    document.querySelectorAll('.points strong').forEach(e => e.textContent = p.total.toLocaleString('en-US'));
    document.querySelectorAll('.pts-today').forEach(e => e.textContent = p.today ? `+${p.today} today` : 'Get one done to roll');
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(p)); show(); }

  // the little "+12" that floats up from what you checked
  function pop(anchor, text, lucky) {
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'pts-pop' + (lucky ? ' lucky' : '');
    el.textContent = text;
    el.style.left = r.left + r.width / 2 + 'px';
    el.style.top = r.top + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // Unchecking gives back exactly what was rolled, so it can't be re-rolled for more.
  const add = pts => { p.total += pts; p.today += pts; save(); };
  const take = pts => { p.total = Math.max(0, p.total - pts); p.today = Math.max(0, p.today - pts); save(); };

  addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { p = JSON.parse(e.newValue); show(); } catch {} } });
  setInterval(show, 60e3); // a new day resets "today"
  show();
  return { roll, add, take, pop };
})();
