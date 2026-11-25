// Pearl auto-updater.
// In the real app this uses the Tauri updater plugin: it checks the GitHub release feed
// (latest.json), verifies the signature, downloads, installs and relaunches.
// In a plain browser (the design preview) it fakes an update so the UI can be tried:
// ?update=available (default) | none | error

(() => {
  if (new URLSearchParams(location.search).has('win')) return; // not in the reminder pop-up windows
  const T = window.__TAURI__;
  const REAL = !!(T && T.updater);
  const q = new URLSearchParams(location.search);
  const KEY = 'pearl.updates';
  const RECHECK_MS = 6 * 60 * 60 * 1000;   // while open, look again every 6 hours
  const STARTUP_DELAY_MS = 3000;           // let the app settle before the first check

  let prefs = { auto: true, skipped: null, lastChecked: null };
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(KEY)) }; } catch {}
  const save = () => localStorage.setItem(KEY, JSON.stringify(prefs));

  // status: idle | checking | uptodate | available | downloading | installing | error
  let state = { status: prefs.lastChecked ? 'uptodate' : 'idle', update: null, progress: 0, error: '' };
  let bannerOpen = false;

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  /* ---------- talking to the updater ---------- */
  function fakeUpdate() {
    const mode = q.get('update') || 'available';
    return new Promise((res, rej) => setTimeout(() => {
      if (mode === 'error') return rej(new Error('Network request failed'));
      if (mode === 'none') return res(null);
      res({
        version: '0.2.0',
        body: 'Goals can now link to every-day tasks.\nThe lock screen remembers your snooze.\nFaster startup.',
        async downloadAndInstall(onEvent) {
          const total = 4_200_000; let got = 0;
          onEvent({ event: 'Started', data: { contentLength: total } });
          while (got < total) {
            await new Promise(r => setTimeout(r, 120));
            const chunk = Math.min(total - got, 180_000); got += chunk;
            onEvent({ event: 'Progress', data: { chunkLength: chunk } });
          }
          onEvent({ event: 'Finished' });
        },
      });
    }, 1100));
  }

  async function noReleaseYet() {
    try {
      const r = await fetch('https://api.github.com/repos/piercedcreased/Pearl/releases/latest', { cache: 'no-store' });
      return r.status === 404;
    } catch { return false; }  // couldn't reach GitHub at all: really offline
  }

  async function check({ silent }) {
    if (['checking', 'downloading', 'installing'].includes(state.status)) return;
    set({ status: 'checking', error: '' });
    try {
      const update = REAL ? await T.updater.check({ timeout: 20000 }) : await fakeUpdate();
      prefs.lastChecked = Date.now(); save();
      if (!update) return set({ status: 'uptodate', update: null });
      set({ status: 'available', update });
      // Startup and background checks pop the banner, unless this version was skipped.
      if (silent && prefs.skipped !== update.version) openBanner();
    } catch (e) {
      console.warn('Update check failed:', e);
      // The updater gives the same error for "offline" and "no release published yet".
      // Ask GitHub directly: if it answers 404, there's simply nothing out yet, which counts as up to date.
      if (REAL && await noReleaseYet()) {
        prefs.lastChecked = Date.now(); save();
        return set({ status: 'uptodate', update: null });
      }
      // A failed background check stays quiet. A check you asked for says what happened.
      set({ status: silent ? (prefs.lastChecked ? 'uptodate' : 'idle') : 'error', error: String(e) });
    }
  }

  async function install() {
    const u = state.update;
    if (!u || state.status === 'downloading' || state.status === 'installing') return;
    let total = 0, got = 0;
    set({ status: 'downloading', progress: 0 });
    try {
      await u.downloadAndInstall(ev => {
        if (ev.event === 'Started') total = ev.data.contentLength || 0;
        else if (ev.event === 'Progress') { got += ev.data.chunkLength; set({ progress: total ? got / total : 0 }); }
        else if (ev.event === 'Finished') set({ status: 'installing', progress: 1 });
      });
      set({ status: 'installing', progress: 1 });
      // On Windows the installer closes Pearl by itself and reopens it.
      if (REAL) await T.process.relaunch();
      else setTimeout(() => { closeBanner(); set({ status: 'uptodate', update: null }); fakeVersion = u.version; render(); }, 1500);
    } catch (e) {
      console.warn('Update install failed:', e);
      set({ status: 'error', error: String(e) });
    }
  }

  /* ---------- UI ---------- */
  let fakeVersion = '0.1.0';
  const appVersion = REAL ? T.app.getVersion() : Promise.resolve(null);

  function set(patch) { state = { ...state, ...patch }; render(); }

  function ago(t) {
    if (!t) return 'Not checked yet';
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'Last checked just now';
    if (m < 60) return `Last checked ${m} minute${m === 1 ? '' : 's'} ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `Last checked ${h} hour${h === 1 ? '' : 's'} ago`;
    return `Last checked ${new Date(t).toLocaleDateString()}`;
  }

  function notesOf(u) { return (u && u.body ? u.body.trim() : ''); }

  async function render() {
    const v = (await appVersion) || fakeVersion;
    $$('[data-appver]').forEach(e => e.textContent = v);
    const u = state.update, pct = Math.round(state.progress * 100);

    // settings card
    const card = $('.updates');
    if (card) {
      card.dataset.status = state.status;
      const [title, sub] = {
        idle:        ['Check for new versions', ago(prefs.lastChecked)],
        checking:    ['Checking for updates', 'This only takes a moment'],
        uptodate:    ["You're up to date", ago(prefs.lastChecked)],
        available:   [`Version ${u?.version} is ready`, `You have ${v}`],
        downloading: [`Downloading ${u?.version}`, `${pct}% done`],
        installing:  ['Installing', 'Pearl will close and reopen by itself'],
        error:       ["Couldn't reach the update server", 'Check your internet connection, then try again'],
      }[state.status];
      card.querySelector('[data-ustatus]').textContent = title;
      card.querySelector('[data-usub]').textContent = sub;
      const notes = card.querySelector('[data-unotes]');
      notes.hidden = state.status !== 'available' || !notesOf(u);
      notes.textContent = notesOf(u);
      const btn = card.querySelector('[data-ucheck]');
      btn.textContent = state.status === 'available' ? 'Update now' : state.status === 'checking' ? 'Checking…' : 'Check for updates';
      btn.disabled = ['checking', 'downloading', 'installing'].includes(state.status);
      btn.classList.toggle('busy', state.status === 'checking');
      card.querySelector('.ub-progress').hidden = !['downloading', 'installing'].includes(state.status);
      card.querySelector('.ub-progress i').style.width = pct + '%';
      card.querySelector('#upd-auto').classList.toggle('on', prefs.auto);
    }

    // banner
    const b = $('#update-banner');
    b.hidden = !bannerOpen;
    if (bannerOpen && u) {
      b.querySelector('[data-uv]').textContent = u.version;
      b.querySelector('[data-unotes]').textContent = notesOf(u) || 'Fixes and improvements.';
      const busy = ['downloading', 'installing'].includes(state.status);
      b.querySelector('.ub-actions').hidden = busy;
      b.querySelector('[data-uskip]').hidden = busy;
      b.querySelector('.ub-progress').hidden = !busy;
      b.querySelector('.ub-progress i').style.width = pct + '%';
      b.querySelector('[data-uprog]').hidden = !busy;
      b.querySelector('[data-uprog]').textContent = state.status === 'installing' ? 'Installing. Pearl will reopen in a moment.' : `Downloading… ${pct}%`;
      b.querySelector('[data-uerr]').hidden = state.status !== 'error';
    }
  }

  function openBanner() { bannerOpen = true; render(); }
  function closeBanner() { bannerOpen = false; render(); }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-ucheck]')) state.status === 'available' ? install() : check({ silent: false });
    else if (e.target.closest('[data-uinstall]')) install();
    else if (e.target.closest('[data-ulater]')) closeBanner();
    else if (e.target.closest('[data-uskip]')) { prefs.skipped = state.update?.version; save(); closeBanner(); }
    else if (e.target.closest('#upd-auto')) { prefs.auto = !prefs.auto; save(); render(); }
  });

  // keep "Last checked" fresh while Settings is open
  setInterval(() => { if (['idle', 'uptodate'].includes(state.status)) render(); }, 60000);

  render();
  if (prefs.auto || q.has('update')) setTimeout(() => check({ silent: true }), q.has('update') ? 300 : STARTUP_DELAY_MS);
  setInterval(() => { if (prefs.auto) check({ silent: true }); }, RECHECK_MS);

  window.pearlUpdater = { check, install, get state() { return state; } };
})();
