// The reminder flow. Runs in the main window of the app (it only hides to the tray, so this
// keeps running), and on the demo desktop in a browser.
//
//   due  -> 15 s warning (bottom middle) -> lock screen (blurred, full screen)
//   lock: Start -> "go go go", asks later if it's done
//         Dismiss -> mascot asks "you gonna go do it now?"
//         Snooze -> back in 10 min
//   mascot: no / "5 more min" / not answering = ignored, and the next pop-up is angrier
//   It keeps coming back until "did it", which rolls points.
//
// Snooze punishment (owner's call, 2026-11-25, disclosed in the readme): after 3 snoozes,
// every snooze has a random chance of a lockdown: the lock screen for 1-2 minutes with no
// way to dismiss it. More snoozes and ignores make it more likely and longer.

(() => {
  const bus = PearlBus, q = new URLSearchParams(location.search);
  const cls = document.body.classList;
  if (q.has('win')) return; // pop-up windows just show what they're told (screens.js)
  const isDemo = !cls.contains('s-main');
  const isApp = bus.app && !isDemo;

  const REAL = { warn: 15, ignore: 90e3, back: 5 * 60e3, check: 10 * 60e3, snoozeLock: 10 * 60e3, snoozePop: 5 * 60e3, say: 2800 };
  const DEMO = { warn: 8, ignore: 14e3, back: 3e3, check: 6e3, snoozeLock: 5e3, snoozePop: 4e3, say: 2800 };
  const T = isDemo ? DEMO : REAL;
  const moodOf = n => PearlPop.moodOf(n);

  /* ---------- windows (app) or parts of the demo page (browser) ---------- */
  const view = {
    open(kind, params) {
      if (isDemo) { cls.add('s-' + kind); PearlScreens.start(kind, params); return; }
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
      return bus.invoke('popup_open', { kind, query: qs });
    },
    close(kind) {
      if (isDemo) { cls.remove('s-' + kind); if (kind === 'pop') PearlPop.hide(); return; }
      return bus.invoke('popup_close', { kind });
    },
  };

  // Timers that keep working while the main window is hidden (Rust keeps time in the app).
  let seq = 0;
  const waiting = new Map();
  function after(ms, fn) {
    const id = st.flow, tag = `${id}:${++seq}`;
    const run = () => { if (st.flow === id && st.active) fn(); };
    if (isApp) { waiting.set(tag, run); bus.invoke('pearl_after', { ms: Math.round(ms), tag }); }
    else setTimeout(run, ms);
  }
  if (isApp) bus.on('pearl-timer', tag => { const f = waiting.get(tag); waiting.delete(tag); if (f) f(); });

  /* ---------- the flow ---------- */
  let st = { flow: 0, active: false };

  function start(task, { lock = true, routineId = null, test = false, streak = '' } = {}) {
    if (st.active) stop();
    st = { flow: Date.now() % 1e9, active: true, task, routineId, test, streak, snoozes: 0, ignores: 0, popOpen: false, day: PearlDaily.ymd() };
    if (lock) view.open('warn', { flow: st.flow, task, secs: T.warn });
    else ask('nudge');
  }

  function stop() {
    st.active = false;
    ['warn', 'lock', 'pop'].forEach(k => view.close(k));
  }

  const openLock = () => view.open('lock', { flow: st.flow, task: st.task, streak: st.streak });

  function ask(step) {
    st.popOpen = true;
    view.open('pop', { flow: st.flow, step, level: st.ignores, task: st.task, n: st.ignores, ignore: T.ignore });
  }

  // The mascot says one line and leaves. Reuses the pop-up if it's up, else pops one.
  function say(kind, mood, extra = {}) {
    const p = { flow: st.flow, kind, mood, task: st.task, n: st.ignores, ...extra };
    if (st.popOpen) bus.send('pearl-say', p);
    else view.open('pop', { flow: st.flow, say: kind, mood, task: st.task, n: st.ignores, pts: extra.pts });
    st.popOpen = false;
  }

  function going() {
    say('going', 'calm');
    after(T.check, () => ask('check'));
  }

  function snooze(from) {
    st.snoozes++;
    if (from !== 'lock' && from !== 'warn') st.ignores++; // snoozing the mascot counts as ignoring him
    if (punish()) {
      const secs = Math.round(Math.min(120, 60 + 12 * (st.snoozes - 4) + Math.random() * 30));
      say('lockdown', 'furious');
      after(T.say, () => {
        st.popOpen = false;
        view.close('pop');
        view.open('lock', { flow: st.flow, task: st.task, mode: 'hard', secs, n: st.snoozes });
        if (isApp) bus.invoke('lock_hold', { secs });
      });
      return;
    }
    const mood = moodOf(st.ignores);
    if (from === 'lock' || from === 'warn') { say('snoozeLock', mood); after(T.snoozeLock, () => view.open('warn', { flow: st.flow, task: st.task, secs: T.warn })); }
    else if (from === 'no') { say('no', mood); after(T.back, () => ask('nudge')); }
    else { say('snooze', mood); after(T.snoozePop, () => ask('nudge')); }
  }

  // After 3 snoozes, each one might lock the screen. Ignoring the mascot adds to the odds.
  function punish() {
    if (st.snoozes <= 3) return false;
    const chance = Math.min(0.85, 0.2 + 0.15 * (st.snoozes - 4) + 0.05 * st.ignores);
    return Math.random() < chance;
  }

  function finish() {
    const { pts, lucky } = window.PearlPoints ? PearlPoints.roll() : { pts: 10, lucky: false };
    if (!st.test) {
      window.PearlPoints?.add(pts);
      if (st.routineId) PearlDaily.markDone(st.routineId, pts);
    }
    say(lucky ? 'lucky' : 'done', 'happy', { pts });
    st.active = false;
    writeStatus();
  }

  bus.on('pearl-flow', m => {
    if (m.flow !== st.flow || !st.active) return;
    const a = m.answer;
    if (m.kind === 'warn') {
      view.close('warn');
      if (a === 'done') openLock(); else snooze('warn');
    } else if (m.kind === 'lock') {
      view.close('lock');
      if (a === 'start') going();
      else if (a === 'dismiss') ask('ask');
      else if (a === 'snooze') snooze('lock');
      else if (a === 'over') { st.ignores = Math.max(st.ignores, 2); ask('nudge'); }
    } else if (m.kind === 'pop') {
      if (a === 'yes' || a === 'going') going();
      else if (a === 'done') finish();
      else if (a === 'no') snooze('no');
      else if (a === 'snooze') snooze('pop');
      else if (a === 'notyet') { say('notyet', 'annoyed'); after(T.check, () => ask('check')); }
      else if (a === 'silent') { st.ignores++; st.popOpen = false; view.close('pop'); after(T.back, () => ask('nudge')); }
    }
  });

  // for testing from devtools: PearlFlow.start('Dishes'), PearlFlow.state()
  window.PearlFlow = { start, stop, state: () => ({ ...st }), snooze: n => { st.snoozes = n; snooze('pop'); }, after: (ms, fn) => after(ms, fn) };

  /* ---------- schedule: routines at their time ---------- */
  const ON_KEY = 'pearl.remind';
  const prefs = (() => { try { return { on: false, fired: {}, ...JSON.parse(localStorage.getItem(ON_KEY)) }; } catch { return { on: false, fired: {} }; } })();
  const savePrefs = () => localStorage.setItem(ON_KEY, JSON.stringify(prefs));
  const minsNow = d => d.getHours() * 60 + d.getMinutes();

  function checkDue() {
    const now = new Date(), today = PearlDaily.ymd(now), dow = (now.getDay() + 6) % 7, mins = minsNow(now);
    if (st.active && st.day !== today) stop(); // a new day: yesterday's reminder is over
    if (!prefs.on || st.active) return;
    for (const r of PearlDaily.list()) {
      const t = r.h * 60 + r.m;
      // due now, or up to 15 min ago (the PC was asleep, a game was loading...)
      if (!r.days[dow] || mins < t || mins >= t + 15 || r.doneOn === today || prefs.fired[r.id] === today) continue;
      prefs.fired[r.id] = today; savePrefs();
      const streak = r.streak ? `${r.streak} day streak` : '';
      start(r.name, { lock: r.lock, routineId: r.id, streak });
      break;
    }
  }

  // What the tray widget shows.
  function writeStatus() {
    if (isDemo) return;
    const now = new Date(), dow = (now.getDay() + 6) % 7, mins = minsNow(now), today = PearlDaily.ymd(now);
    const tasks = [...document.querySelectorAll('.page-today .task')];
    const rs = PearlDaily.list().filter(r => r.days[dow]);
    const next = rs.filter(r => r.doneOn !== today && r.h * 60 + r.m >= mins).sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m))[0];
    localStorage.setItem('pearl.status', JSON.stringify({
      left: tasks.filter(t => !t.classList.contains('done')).length,
      rDone: rs.filter(r => r.doneOn === today).length, rAll: rs.length,
      points: document.querySelector('.points strong')?.textContent,
      next: next ? { name: next.name, time: PearlDaily.clock(next.h, next.m) } : null,
    }));
  }

  /* ---------- settings: Reminders card ---------- */
  const onT = document.getElementById('remind-on');
  if (onT) {
    const draw = () => { onT.classList.toggle('on', prefs.on); onT.setAttribute('aria-checked', prefs.on); };
    onT.addEventListener('click', () => { prefs.on = !prefs.on; savePrefs(); draw(); checkDue(); });
    draw();
    document.getElementById('remind-test').addEventListener('click', () => {
      if (isApp) start('Test reminder', { test: true });
      else location.href = '?screen=warn';
    });
    const auto = document.getElementById('autostart');
    if (isApp) {
      bus.invoke('autostart_get').then(on => auto.classList.toggle('on', !!on));
      auto.addEventListener('click', () => bus.invoke('autostart_set', { on: !auto.classList.contains('on') }).then(on => auto.classList.toggle('on', !!on)));
    } else auto.closest('.set-row').querySelector('small').textContent = 'Only in the app';
  }

  /* ---------- go ---------- */
  if (isApp) {
    bus.on('pearl-tick', () => { checkDue(); writeStatus(); });
    bus.on('pearl-test', () => start('Test reminder', { test: true }));
    document.addEventListener('pearl-routines', writeStatus);
    document.addEventListener('click', () => setTimeout(writeStatus, 50));
    setTimeout(() => { checkDue(); writeStatus(); }, 3000);
  } else if (isDemo) {
    const task = 'Laundry';
    const begin = () => { st = { flow: Date.now() % 1e9, active: true, task, routineId: null, test: true, streak: '4 day streak', snoozes: +q.get('snoozes') || 0, ignores: Math.min(3, +q.get('level') || 0), popOpen: false, day: PearlDaily.ymd() }; };
    begin();
    const screen = q.get('screen');
    if (screen === 'warn') { if (q.has('still')) PearlScreens.start('warn', { task, still: 1 }); else { st.active = false; start(task, { test: true, streak: '4 day streak' }); } }
    else if (screen === 'lock') view.open('lock', { flow: st.flow, task, streak: st.streak, mode: q.get('mode'), secs: q.get('secs') || 75, n: st.snoozes || 5 });
    else if (screen === 'pop' || screen === 'nudge') {
      const step = q.get('step') || (screen === 'nudge' ? 'nudge' : 'ask');
      if (step === 'done') { st.popOpen = true; PearlScreens.start('pop', { flow: st.flow, step: 'check', task }); bus.send('pearl-say', { flow: st.flow, kind: 'done', mood: 'happy', task, pts: 12, close: false }); }
      else ask(step);
      // demo step picker
      document.querySelector('.desk').insertAdjacentHTML('beforeend', `<div class="pop-demo">
        <button data-d="ask">ask</button><button data-d="0">nudge</button><button data-d="1">annoyed</button>
        <button data-d="2">mad</button><button data-d="3">furious</button><button data-d="check">check</button>
        <button data-d="lockdown">lockdown</button><button data-d="restart">start over</button></div>`);
      document.querySelector('.pop-demo').addEventListener('click', e => {
        const d = e.target.dataset.d; if (d == null) return;
        if (d === 'restart') { location.href = '?screen=warn'; return; }
        begin();
        if (d === 'lockdown') { st.snoozes = 6; st.ignores = 3; st.popOpen = true; PearlScreens.start('pop', { flow: st.flow, step: 'nudge', level: 3, task }); snoozeForced(); return; }
        if (/^\d$/.test(d)) { st.ignores = +d; ask('nudge'); } else ask(d);
      });
    }
  }
  // demo: always punish
  function snoozeForced() { const r = Math.random; Math.random = () => 0; snooze('pop'); Math.random = r; }
})();
