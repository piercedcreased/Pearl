// The To do list: saved in localStorage pearl.tasks, starts empty.
// Each task: { id, name, h, m (24 h, or null for "any time"), done, rolled, c, day }
// Typing "gym by 5pm" or "call mom at 3:30" sets the time. Done tasks clear out the next day.

window.PearlTasks = (() => {
  const page = document.querySelector('.page-today');
  const list = page.querySelector('.tasks');
  const input = page.querySelector('.add input');
  const KEY = 'pearl.tasks';
  const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const clock = (h, m) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;

  let tasks = [];
  try { tasks = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  if (!Array.isArray(tasks)) tasks = [];
  const save = () => { localStorage.setItem(KEY, JSON.stringify(tasks)); document.dispatchEvent(new Event('pearl-tasks')); };

  // yesterday's finished tasks go away, unfinished ones stay
  function newDay() {
    const today = ymd(), before = tasks.length;
    tasks = tasks.filter(t => !(t.done && t.day !== today));
    if (tasks.length !== before) save();
  }

  // "gym by 5pm", "call mom at 3:30", "laundry by 18:00"
  function parse(text) {
    const m = text.match(/\s+(?:by|at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?\s*$/i);
    if (!m) return { name: text, h: null, m: null };
    let h = +m[1]; const min = +(m[2] || 0), ap = (m[3] || '').toLowerCase();
    if (h > 23 || min > 59) return { name: text, h: null, m: null };
    if (ap.startsWith('p') && h < 12) h += 12;
    if (ap.startsWith('a') && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 7) h += 12; // "by 5" means 5 PM
    return { name: text.slice(0, m.index).trim() || text, h, m: min };
  }

  function render() {
    list.innerHTML = '';
    // timed ones first, by time, then "any time" in the order they were added
    const order = [...tasks].sort((a, b) => (a.h == null) - (b.h == null) || ((a.h ?? 0) * 60 + (a.m ?? 0)) - ((b.h ?? 0) * 60 + (b.m ?? 0)));
    for (const t of order) {
      const li = document.createElement('li');
      li.className = `task ${t.c}` + (t.done ? ' done' : '');
      li.dataset.id = t.id;
      li.innerHTML = `<button class="check" aria-label="${t.done ? 'Done' : 'Mark done'}"></button><span class="name"></span>
        <span class="when"></span><span class="pts${t.done ? '' : ' mystery'}">${t.done ? '+' + t.rolled : '?'}</span>
        <button class="t-del" aria-label="Remove" title="Remove">&times;</button>`;
      li.querySelector('.name').textContent = t.name;
      li.querySelector('.when').textContent = t.h == null ? 'Any time' : clock(t.h, t.m);
      list.appendChild(li);
    }
    if (!tasks.length) list.innerHTML = '<li class="t-empty"><b>Nothing to do yet.</b><span>Add something below, like "gym by 5pm".</span></li>';
    counts();
  }

  // header line, the count pill, the sidebar number and the mascot's bubble
  function counts() {
    const left = tasks.filter(t => !t.done).length, done = tasks.length - left;
    page.querySelector('.count-pill').textContent = `${done} of ${tasks.length}`;
    const nav = document.querySelector('[data-nav="today"] b');
    if (nav) { nav.textContent = left; nav.hidden = !left; }
    const d = new Date();
    page.querySelector('.top h1').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    page.querySelector('.top p').textContent = !tasks.length ? 'A clean slate. Add what you need to get done.'
      : !left ? `All ${done} done. Go enjoy it.`
      : `${left} thing${left > 1 ? 's' : ''} left today.` + (done ? ` ${done} already done.` : '');
    const bubble = page.querySelector('.pet .bubble');
    if (bubble) bubble.textContent = !tasks.length ? "What are we doing today? Add something and I'll keep you on it."
      : !left ? 'Everything done! I am so proud of you.'
      : done ? `${done} down! ${left} to go.` : `${left} on the list. Let's get the first one.`;
  }

  page.querySelector('.add').addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const { name, h, m } = parse(text);
    tasks.push({ id: 't' + Date.now().toString(36), name, h, m, done: false, rolled: 0, c: 'c' + (tasks.length % 4 + 1), day: ymd() });
    input.value = '';
    save(); render();
  });

  list.addEventListener('click', e => {
    const li = e.target.closest('.task'); if (!li) return;
    const t = tasks.find(x => x.id === li.dataset.id); if (!t) return;
    if (e.target.closest('.t-del')) {
      const i = tasks.indexOf(t);
      tasks.splice(i, 1);
      if (t.done) PearlPoints.take(t.rolled);
      save(); render();
      PearlToast(`Removed "${t.name}"`, 'Undo', () => {
        tasks.splice(Math.min(i, tasks.length), 0, t);
        if (t.done) PearlPoints.add(t.rolled);
        save(); render();
      });
      return;
    }
    if (!e.target.closest('.check')) return;
    if (!t.done) {
      const { pts, lucky } = PearlPoints.roll();
      t.done = true; t.rolled = pts; t.day = ymd();
      PearlPoints.add(pts);
      PearlPoints.pop(e.target.closest('.check'), lucky ? `Lucky! +${pts}` : `+${pts}`, lucky);
    } else {
      PearlPoints.take(t.rolled);
      t.done = false; t.rolled = 0;
    }
    save(); render();
  });

  addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { tasks = JSON.parse(e.newValue); render(); } catch {} } });
  newDay(); render();
  setInterval(() => { newDay(); render(); }, 5 * 60e3);
  return { list: () => tasks };
})();
