// The reminder pop-ups' own pages: the 15 s warning, the lock screen, the mascot pop-up and
// the tray widget. In the app each one is its own window (index.html?screen=<kind>&win=1&...),
// opened by flow.js through Rust. In a browser they're all parts of the demo desktop page.
// Whatever gets clicked goes back to flow.js as a 'pearl-flow' message.

// Messages between the pop-up windows and the flow in the main window:
// Tauri events in the app, a plain in-page event target in the browser demo.
window.PearlBus = (() => {
  const T = window.__TAURI__;
  if (T && T.event) return {
    app: true,
    send: (name, payload) => T.event.emit(name, payload),
    on: (name, fn) => T.event.listen(name, e => fn(e.payload)),
    invoke: (cmd, args) => T.core.invoke(cmd, args).catch(e => console.warn(cmd, e)),
  };
  const et = new EventTarget();
  return {
    app: false,
    send: (name, payload) => setTimeout(() => et.dispatchEvent(new CustomEvent(name, { detail: payload }))),
    on: (name, fn) => et.addEventListener(name, e => fn(e.detail)),
    invoke: async () => {},
  };
})();

window.PearlScreens = (() => {
  const bus = PearlBus;
  const desk = document.querySelector('.desk');
  const answer = (p, kind, a, extra) => bus.send('pearl-flow', { flow: +p.flow, kind, answer: a, ...extra });
  const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let warnT = 0, lockT = 0, popMounted = false, sayOff = null, popFlow = 0;

  /* ---------- 15 s warning ---------- */
  function warn(p) {
    clearInterval(warnT);
    const box = desk.querySelector('.warn');
    const secs = +p.secs || 15, end = Date.now() + secs * 1000;
    box.querySelector('.warn-copy strong').innerHTML = `${esc(p.task)} in <span data-warn>${secs}</span> seconds`;
    const btn = box.querySelector('.warn-btn');
    btn.textContent = 'Snooze 10 min';
    btn.onclick = () => { clearInterval(warnT); answer(p, 'warn', 'snooze'); };
    const draw = left => {
      box.querySelectorAll('[data-warn]').forEach(e => e.textContent = left);
      box.querySelector('.w-fill').setAttribute('stroke-dasharray', `${left / secs * 15} 15`);
    };
    if (p.still) { draw(12); return; }
    draw(secs);
    warnT = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      draw(left);
      if (left === 0) { clearInterval(warnT); answer(p, 'warn', 'done'); }
    }, 200);
  }

  /* ---------- lock screen (normal, or a lockdown you can't dismiss) ---------- */
  // In the app: a blurred snapshot of the screen sits behind the lock card.
  async function backdrop() {
    const veil = desk.querySelector('.veil');
    if (!bus.app || veil.querySelector('canvas')) return;
    const buf = await window.__TAURI__.core.invoke('lock_backdrop').catch(() => null);
    if (!buf || buf.byteLength < 12) return;
    const v = new DataView(buf), w = v.getUint32(0, true), h = v.getUint32(4, true);
    const c = document.createElement('canvas');
    c.width = w; c.height = h; c.className = 'backdrop';
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf, 8, w * h * 4), w, h), 0, 0);
    veil.prepend(c);
  }

  function lock(p) {
    clearInterval(lockT);
    backdrop();
    const card = desk.querySelector('.lock-card');
    const hard = p.mode === 'hard';
    card.classList.toggle('hard', hard);
    card.querySelector('.lock-time').textContent = hard ? 'lockdown' : timeNow();
    const h2 = card.querySelector('h2'), sub = card.querySelector('.lock-sub');
    const tags = card.querySelector('.lock-tags');
    const acts = card.querySelector('.lock-actions'), dismiss = card.querySelector('.dismiss');
    if (!card.querySelector('.lock-vein')) {
      card.insertAdjacentHTML('beforeend', '<svg class="lock-vein" viewBox="0 0 50 50" aria-hidden="true"><path d="M8 20 Q20 20 20 8 M30 8 Q30 20 42 20 M42 30 Q30 30 30 42 M20 42 Q20 30 8 30"/></svg><div class="lock-count" aria-live="polite"></div>');
    }
    const count = card.querySelector('.lock-count');
    acts.hidden = dismiss.hidden = hard;
    count.hidden = !hard;
    if (hard) {
      h2.textContent = 'You snoozed too much.';
      sub.innerHTML = `${esc(p.task)} got snoozed ${+p.n || 4} times. No screen until this runs out.`;
      tags.innerHTML = '';
      const end = Date.now() + (+p.secs || 60) * 1000;
      const draw = () => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        count.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        if (left === 0) { clearInterval(lockT); answer(p, 'lock', 'over'); }
      };
      draw(); lockT = setInterval(draw, 250);
      return;
    }
    h2.textContent = `Time for ${p.task}`;
    sub.textContent = 'Get it going and roll for points.';
    tags.innerHTML = p.streak ? `<span class="c2">${esc(p.streak)}</span>` : '';
    const [start, snooze] = acts.querySelectorAll('button');
    start.textContent = `Start ${p.task}`;
    start.onclick = () => answer(p, 'lock', 'start');
    snooze.onclick = () => answer(p, 'lock', 'snooze');
    dismiss.onclick = () => answer(p, 'lock', 'dismiss');
  }

  /* ---------- mascot pop-up ---------- */
  function pop(p) {
    if (!popMounted) { PearlPop.mount(desk); popMounted = true; }
    const vars = { task: p.task, n: +p.n || 0, pts: p.pts, kind: p.say, mood: p.mood };
    const closeAfter = () => { if (bus.app) bus.invoke('popup_close', { kind: 'pop' }); };
    if (p.say) { PearlPop.say(vars).then(closeAfter); return; }
    popFlow = +p.flow;
    PearlPop.show({ step: p.step, level: +p.level || 0, task: p.task, n: +p.n || 0 },
      a => answer(p, 'pop', a), +p.ignore || 0);
    // the flow answers with a line to say, then this pop-up goes away
    if (!sayOff) sayOff = bus.on('pearl-say', s => {
      if (s.flow !== popFlow) return;
      PearlPop.say(s).then(() => { if (s.close !== false) closeAfter(); });
    });
  }

  /* ---------- tray widget (left click on the tray icon) ---------- */
  function tray() {
    desk.insertAdjacentHTML('beforeend', `
      <div class="tray-card">
        <div class="tray-top"><div class="mascot tray-mascot"><svg viewBox="0 0 120 120"><use href="#pearl"/></svg></div>
          <div><b class="tray-hi">Pearl</b><p class="tray-line"></p></div></div>
        <div class="tray-due"><span>Get it all done by</span><strong data-t="due"></strong><small data-t="left"></small></div>
        <div class="tray-stats">
          <div><strong data-t="todo"></strong><span>to do left</span></div>
          <div><strong data-t="daily"></strong><span>every day</span></div>
          <div><strong data-t="points"></strong><span>points</span></div>
        </div>
        <div class="tray-next"><span>Next up</span><b data-t="next"></b></div>
        <div class="tray-actions"><button class="primary" data-a="open">Open Pearl</button><button class="secondary" data-a="test">Try a reminder</button></div>
        <button class="tray-quit" data-a="quit">Quit Pearl</button>
      </div>`);
    const card = desk.querySelector('.tray-card');
    const lines = ['what are we doing today?', 'one thing at a time.', "i'm watching the clock for you.", 'get one done. just one.', 'points are waiting.'];
    const label = mins => `${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${mins < 720 ? 'AM' : 'PM'}`;
    function draw() {
      let s = {};
      try { s = JSON.parse(localStorage.getItem('pearl.status')) || {}; } catch {}
      // browser demo: nothing writes the status, so show sample numbers
      if (!bus.app && !s.rAll) s = { left: 3, rDone: 1, rAll: 3, points: '1,240', next: { name: 'Laundry', time: '6:00 PM' } };
      const due = parseInt(localStorage.getItem('pearl.deadline'), 10);
      const dueMins = due >= 0 && due < 1440 ? due : 975;
      const d = new Date(), left = dueMins - (d.getHours() * 60 + d.getMinutes());
      const set = (k, v) => card.querySelector(`[data-t="${k}"]`).textContent = v;
      set('due', label(dueMins));
      set('left', left > 0 ? `${Math.floor(left / 60)}h ${left % 60}m left` : "time's up");
      set('todo', s.left ?? '-');
      set('daily', s.rAll != null ? `${s.rDone}/${s.rAll}` : '-');
      set('points', s.points ?? '-');
      set('next', s.next ? `${s.next.name} at ${s.next.time}` : 'nothing else today');
      card.querySelector('.tray-line').textContent = lines[Math.floor(Math.random() * lines.length)];
    }
    card.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'open') bus.invoke('show_main');
      if (a === 'test') { bus.send('pearl-test', {}); bus.invoke('tray_hide'); }
      if (a === 'quit') bus.invoke('quit');
    });
    draw();
    bus.on('pearl-tray-open', draw);
    addEventListener('storage', draw);
    setInterval(draw, 30e3);
  }

  const start = (kind, p) => ({ warn, lock, pop, tray }[kind] || (() => {}))(p);

  // In the app, a pop-up window starts itself from its URL.
  const q = new URLSearchParams(location.search);
  if (q.has('win')) start(q.get('screen'), Object.fromEntries(q));
  else if (q.get('screen') === 'tray') start('tray'); // browser demo of the tray widget

  return { start };
})();
