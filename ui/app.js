// Pearl UI prototype. Pages by hash (#today, #goals, #goals/new, #settings),
// desktop moments by ?screen=warn|lock|nudge, ?still turns off entrance animations.

const q = new URLSearchParams(location.search);
document.body.className = `s-${q.get('screen') || 'main'}` + (q.has('still') ? ' still' : '');

/* ---------------- colors ---------------- */
const PRESETS = {
  lagoon:    { name: 'Lagoon',    c: ['#7B5CFF', '#FF5FA2', '#14B996', '#FF9E1B'] },
  bubblegum: { name: 'Bubblegum', c: ['#FF4F9A', '#8C6CFF', '#1FBFA4', '#FFB547'] },
  ocean:     { name: 'Ocean',     c: ['#2F6BFF', '#12BFE0', '#1DB980', '#FF8A3D'] },
  sunset:    { name: 'Sunset',    c: ['#FF5A4E', '#FF3D8B', '#22B573', '#FFB020'] },
  mint:      { name: 'Mint',      c: ['#0FB39A', '#7B5CFF', '#4CC764', '#FF7A59'] },
  grape:     { name: 'Grape',     c: ['#8E3FD9', '#FF6FB5', '#18B38A', '#FFA62B'] },
};
const ROLES = [
  ['Main color', 'Buttons, selected list, points card'],
  ['Pop color', 'Countdown ring and highlights'],
  ['Done color', 'Checkmarks, streaks, finished goals'],
  ['Extra color', 'Another color for tasks and goals'],
];
// The five fonts the owner picked (2026-11-25). display = headings, body = everything else.
const FONTS = {
  pearl:     { name: 'Pearl',        display: "'Fredoka'",      body: "'Figtree'" },
  quicksand: { name: 'Quicksand',    display: "'Quicksand'",    body: "'Quicksand'" },
  fraunces:  { name: 'Fraunces',     display: "'Fraunces'",     body: "'Fraunces'" },
  patrick:   { name: 'Patrick Hand', display: "'Patrick Hand'", body: "'Patrick Hand'" },
  lexend:    { name: 'Lexend',       display: "'Lexend'",       body: "'Lexend'" },
};
const KEY = 'pearl.look';
const freshBg = () => ({ mode: 'pearl', solid: '#F1EEF8', from: '#CDBEFF', to: '#FFC6DF', angle: 135 });
const fresh = () => ({ preset: 'lagoon', colors: [...PRESETS.lagoon.c], glow: 60, bg: freshBg(), font: 'pearl' });
let look = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { return fresh(); } })();
look.bg = { ...freshBg(), ...(look.bg || {}) };
if (!FONTS[look.font]) look.font = 'pearl';

const toRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = h => { const [r, g, b] = toRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + .05) / (l2 + .05); };
// darken a color until it reads as text on white
const inkOf = h => { let c = h; for (let t = .1; contrast(c, '#ffffff') < 4 && t < 1; t += .1) c = mix(h, '#1A1533', t); return c; };

function applyLook() {
  const s = document.documentElement.style, [a1, a2, a3] = look.colors, ink = mix(a1, '#15122B', .82);
  look.colors.forEach((c, i) => {
    s.setProperty(`--a${i + 1}`, c);
    s.setProperty(`--a${i + 1}-ink`, inkOf(c));
    s.setProperty(`--on-a${i + 1}`, contrast(c, '#ffffff') >= 2.6 ? '#ffffff' : ink);
  });
  const g = look.glow / 100 * .3;
  s.setProperty('--bg1', mix('#ffffff', a1, g));
  s.setProperty('--bg2', mix('#ffffff', a3, g * .9));
  s.setProperty('--bg3', mix('#ffffff', a2, g * .9));
  s.setProperty('--ink', ink);
  s.setProperty('--soft', mix(a1, '#6E6A85', .78));

  // Page background: the pearl mix (tinted by the accents), a two-color gradient, or one solid color.
  const bg = look.bg;
  const page = bg.mode === 'solid' ? bg.solid
    : bg.mode === 'gradient' ? `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
    : 'linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 48%, var(--bg3) 100%)';
  s.setProperty('--page-bg', page);
  // Text sitting right on the background flips to white when the background is dark.
  const sample = bg.mode === 'solid' ? bg.solid : bg.mode === 'gradient' ? mix(bg.from, bg.to, .5) : '#ffffff';
  const dark = lum(sample) < .28;
  s.setProperty('--page-ink', dark ? '#ffffff' : ink);
  s.setProperty('--page-soft', dark ? 'rgba(255,255,255,.78)' : mix(a1, '#6E6A85', .78));
  s.setProperty('--glass', dark ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.64)');
  const f = FONTS[look.font];
  s.setProperty('--display', f.display);
  s.setProperty('--body', f.body);
  localStorage.setItem(KEY, JSON.stringify(look));
  renderColorSettings();
}

function renderColorSettings() {
  const presets = document.getElementById('presets'), pickers = document.getElementById('pickers');
  presets.innerHTML = Object.entries(PRESETS).map(([id, p]) =>
    `<button class="preset${look.preset === id ? ' on' : ''}" data-preset="${id}"><span class="dots">${p.c.map(c => `<i style="background:${c}"></i>`).join('')}</span>${p.name}</button>`).join('');
  if (!pickers.children.length) {
    pickers.innerHTML = ROLES.map(([n, d], i) =>
      `<label class="picker"><input type="color" data-i="${i}"><span><b>${n}</b><small>${d}</small></span><span class="hex"></span></label>`).join('');
  }
  pickers.querySelectorAll('input').forEach(inp => {
    const c = look.colors[inp.dataset.i];
    if (document.activeElement !== inp) inp.value = c;
    inp.closest('.picker').querySelector('.hex').textContent = c.toUpperCase();
  });
  document.getElementById('glow').value = look.glow;
  const bg = look.bg;
  document.querySelectorAll('#bg-mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === bg.mode));
  document.querySelectorAll('[data-bg-for]').forEach(el => el.hidden = !el.dataset.bgFor.split(' ').includes(bg.mode));
  for (const k of ['solid', 'from', 'to']) {
    const inp = document.getElementById('bg-' + k);
    if (document.activeElement !== inp) inp.value = bg[k];
    inp.closest('.picker').querySelector('.hex').textContent = bg[k].toUpperCase();
  }
  document.getElementById('bg-angle').value = bg.angle;
  document.getElementById('fonts').innerHTML = Object.entries(FONTS).map(([id, f]) =>
    `<button class="font-opt${look.font === id ? ' on' : ''}" data-font="${id}" style="--fd:${f.display.replace(/"/g, '')};--fb:${f.body.replace(/"/g, '')}"><span class="aa">Aa</span><b>${f.name}</b></button>`).join('');
  document.getElementById('bg-preview').style.background = getComputedStyle(document.documentElement).getPropertyValue('--page-bg');
}

document.addEventListener('click', e => {
  const p = e.target.closest('[data-preset]');
  if (p) { look.preset = p.dataset.preset; look.colors = [...PRESETS[p.dataset.preset].c]; applyLook(); }
  const f = e.target.closest('[data-font]');
  if (f) { look.font = f.dataset.font; applyLook(); }
});
document.getElementById('pickers').addEventListener('input', e => {
  look.colors[e.target.dataset.i] = e.target.value; look.preset = 'custom'; applyLook();
});
document.getElementById('glow').addEventListener('input', e => { look.glow = +e.target.value; applyLook(); });
document.getElementById('reset-colors').addEventListener('click', () => { look = { ...fresh(), font: look.font }; applyLook(); });
document.getElementById('bg-mode').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (b) { look.bg.mode = b.dataset.mode; applyLook(); }
});
for (const k of ['solid', 'from', 'to']) document.getElementById('bg-' + k).addEventListener('input', e => { look.bg[k] = e.target.value; applyLook(); });
document.getElementById('bg-angle').addEventListener('input', e => { look.bg.angle = +e.target.value; applyLook(); });

/* ---------------- mascot image ---------------- */
const MKEY = 'pearl.mascot';
const DEFAULT_MASCOT = '<svg viewBox="0 0 120 120"><use href="#pearl"/></svg>';
function applyMascot() {
  const src = localStorage.getItem(MKEY);
  document.querySelectorAll('.mascot').forEach(m => { m.innerHTML = src ? `<img src="${src}" alt="Mascot">` : DEFAULT_MASCOT; });
}
document.getElementById('mascot-file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { localStorage.setItem(MKEY, r.result); } catch { alert('That image is too big. Try one under 2 MB.'); } applyMascot(); };
  r.readAsDataURL(f);
});
document.getElementById('mascot-reset').addEventListener('click', () => { localStorage.removeItem(MKEY); applyMascot(); });

/* ---------------- pages ---------------- */
function route() {
  const [page, sub] = (location.hash.slice(1) || 'today').split('/');
  document.querySelectorAll('.page').forEach(p => p.hidden = p.dataset.page !== page);
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === page));
  document.getElementById('new-goal').hidden = !(page === 'goals' && sub === 'new');
}
addEventListener('hashchange', route);
document.querySelectorAll('[data-open="new-goal"]').forEach(b => b.addEventListener('click', () => location.hash = 'goals/new'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => location.hash = 'goals'));
document.getElementById('new-goal').addEventListener('click', e => { if (e.target.id === 'new-goal') location.hash = 'goals'; });
document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
}));
document.querySelectorAll('.swatches').forEach(sw => sw.addEventListener('click', e => {
  if (e.target.tagName !== 'I') return;
  sw.querySelectorAll('i').forEach(x => x.classList.toggle('on', x === e.target));
}));
document.querySelectorAll('.toggle:not([data-own])').forEach(t => t.addEventListener('click', () => t.classList.toggle('on')));

/* ---------------- 15 s warning countdown on the demo screen (the done-by countdown lives in deadline.js) ---------------- */
const start = Date.now();
function tick() {
  const w = 12 - Math.floor((Date.now() - start) / 1000) % 13;
  document.querySelectorAll('[data-warn]').forEach(e => e.textContent = w);
  document.querySelectorAll('.w-fill').forEach(e => e.setAttribute('stroke-dasharray', `${w} 15`));
}

/* ---------------- demo desktop: show the owner's wallpaper behind the popups when it's there ---------------- */
if (!document.body.classList.contains('s-main')) {
  const wall = new Image();
  wall.onload = () => document.querySelector('.desk').classList.add('has-wall');
  wall.src = 'demo/wallpaper.jpg';
}

if (q.get('preset') && PRESETS[q.get('preset')]) { look = { ...look, preset: q.get('preset'), colors: [...PRESETS[q.get('preset')].c] }; }
applyLook(); applyMascot(); route(); tick(); setInterval(tick, 1000);
