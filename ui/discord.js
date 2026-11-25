// Discord status ("Playing Pearl"). Off until the user turns it on.
// Privacy: by default it only says "Getting things done". Today's count and a goal's
// name/progress are shared only if the user switches them on in Settings > Discord status.

(() => {
  if (new URLSearchParams(location.search).has('win')) return; // only the main window talks to Discord
  const T = window.__TAURI__;
  const REAL = !!(T && T.core);
  const KEY = 'pearl.discord';
  const started = Math.floor(Date.now() / 1000);
  let prefs = { on: false, today: false, goal: '' };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(KEY)) }; } catch {}
  const save = () => localStorage.setItem(KEY, JSON.stringify(prefs));
  const $ = id => document.getElementById(id);

  /* ---------- what to show ---------- */
  function progressOf(card) {
    const range = card.querySelector('.pct input');
    if (range) return +range.value;
    const steps = card.querySelectorAll('.steps li');
    if (steps.length) return Math.round(card.querySelectorAll('.steps li.done').length / steps.length * 100);
    const units = card.querySelectorAll('.pips i, .days i, .week span');
    if (units.length) return Math.round(card.querySelectorAll('.pips i.on, .days i.on, .week span.on').length / units.length * 100);
    const bar = card.querySelector('.bar i');
    return bar ? parseInt(bar.style.width, 10) || 0 : 0;
  }
  const goals = () => [...document.querySelectorAll('.goal-grid .goal')].map(card => {
    const name = card.querySelector('h3').textContent.trim();
    return { id: name, name, pct: Math.min(100, progressOf(card)) };
  });
  const blocks = p => { const n = Math.round(p / 10); return '▰'.repeat(n) + '▱'.repeat(10 - n) + ` ${p}%`; };
  const todayText = () => {
    const all = document.querySelectorAll('.page-today .task').length;
    const done = document.querySelectorAll('.page-today .task.done').length;
    return `${done} of ${all} done today`;
  };
  function presence() {
    const g = prefs.goal && goals().find(x => x.id === prefs.goal);
    if (g) return { details: `Working on: ${g.name}`, state: blocks(g.pct) + (prefs.today ? ` | ${todayText()}` : ''), started };
    return { details: 'Getting things done', state: prefs.today ? todayText() : null, started };
  }

  /* ---------- talking to Discord ---------- */
  let status = 'off';
  async function push() {
    if (!prefs.on) {
      status = 'off';
      if (REAL) await T.core.invoke('discord_clear').catch(() => {});
    } else if (!REAL) {
      status = 'preview';
    } else if (!(await T.core.invoke('discord_ready'))) {
      status = 'not-set-up';
    } else {
      try { await T.core.invoke('discord_set', { presence: presence() }); status = 'live'; }
      catch (e) { status = e === 'discord-closed' ? 'closed' : 'error'; }
    }
    render();
  }
  // Discord allows only a few updates per 20 seconds, so changes are bundled.
  let timer = null;
  const soon = () => { clearTimeout(timer); timer = setTimeout(push, 1500); };

  /* ---------- settings card ---------- */
  const STATUS = {
    off: ['Off', ''],
    preview: ['Preview', 'Open the Pearl app to show this on Discord.'],
    'not-set-up': ['Not set up yet', 'Pearl still needs its Discord app ID. Ask Claude to add it.'],
    live: ['Showing', ''],
    closed: ["Discord isn't open", 'Pearl will connect when Discord is running.'],
    error: ["Couldn't connect", 'Pearl will try again in a minute.'],
  };
  function render() {
    const card = document.querySelector('.discord-set');
    if (!card) return;
    $('dc-on').classList.toggle('on', prefs.on);
    $('dc-today').classList.toggle('on', prefs.today);
    card.querySelector('.dc-options').classList.toggle('dim', !prefs.on);
    const sel = $('dc-goal'), list = goals();
    const opts = '<option value="">None (keep my goals private)</option>' +
      list.map(g => `<option value="${g.id.replace(/"/g, '&quot;')}">${g.name.replace(/</g, '&lt;')}</option>`).join('');
    if (sel.dataset.sig !== opts) { sel.innerHTML = opts; sel.dataset.sig = opts; }
    sel.value = list.some(g => g.id === prefs.goal) ? prefs.goal : '';
    const [label, help] = STATUS[status];
    card.querySelector('[data-dc-status]').textContent = label;
    card.dataset.status = status;
    card.querySelector('[data-dc-help]').textContent = help;
    card.querySelector('[data-dc-help]').hidden = !help;
    const p = presence();
    card.querySelector('[data-dc-details]').textContent = p.details;
    card.querySelector('[data-dc-state]').textContent = p.state || '';
    card.querySelector('[data-dc-state]').hidden = !p.state;
    const mins = Math.floor((Date.now() / 1000 - started) / 60);
    card.querySelector('[data-dc-time]').textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} elapsed`;
  }

  $('dc-on').addEventListener('click', () => { prefs.on = !prefs.on; save(); push(); });
  $('dc-today').addEventListener('click', () => { prefs.today = !prefs.today; save(); render(); soon(); });
  $('dc-goal').addEventListener('change', e => { prefs.goal = e.target.value; save(); render(); soon(); });
  // progress changes on Goals or Today update the status (and the preview)
  document.addEventListener('input', e => { if (e.target.closest('.goal-grid')) { render(); if (prefs.on) soon(); } });
  document.addEventListener('click', e => { if (e.target.closest('.goal-grid, .tasks')) setTimeout(() => { render(); if (prefs.on) soon(); }, 0); });
  setInterval(() => { render(); if (prefs.on && status !== 'live') push(); }, 60000);

  push();
})();
