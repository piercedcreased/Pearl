# Pearl: handoff

Read this first. Last updated 2026-11-25 (round 5).

Pearl is the owner's to-do and reminder app that pushes them to actually do things. It's Windows now and Android later, with settings synced between the two. The repo is public at https://github.com/piercedcreased/Pearl (default branch `main`).

## Where things stand
- **Partly real now.** Every-day routines are saved (localStorage `pearl.routines`) and the whole reminder flow runs for real: scheduler, warning, lock, mascot pop-ups, lockdowns, tray. To-do tasks, goals and the points total are still sample HTML that isn't saved.
- **Installed on the owner's PC:** Pearl 0.1.0 (a local build) at `%LOCALAPPDATA%\Pearl`, with Desktop and Start menu shortcuts. Reinstalling over it: `Start-Process <installer> /S`.
- **Released:** 0.1.1 is on GitHub (2026-11-25). The round 5 work below is committed but NOT released yet; the next release is 0.1.2 (`npm run release -- 0.1.2 "..."`).
- **Never close the owner's running apps**, and check before restarting things. The owner games on this PC, so keep Pearl light.

## The owner's brief
- A to-do list like Microsoft To Do, but simpler to get around.
- A daily "get it all done by" time (12-hour, e.g. 4:15 PM) with a live countdown.
- Every-day routines (laundry, dishes...) with streaks.
- Colorful and vibrant, but sleek: poppy and bubbly. Corners are **barely rounded but noticeable**.
- A mascot: the owner's own transparent PNG. It needs no care. It pops up with random lines and cheers when things get done.
- **Screen lock:** when a scheduled item is due:
  1. A 15 s warning shows near the bottom of the screen, so a game can be paused.
  2. Then a full-screen soft-blur lock with the task on a card. It can be dismissed.
  3. After a dismiss, the mascot pops out of the bottom-left corner (NOT a Windows notification) and asks "you gonna go do it now?" with yes / no. He says something about the task, and he gets angrier every time he's ignored, until the owner confirms it's done.
  4. Snoozing more than 3 times can randomly lock the screen for 1 to 2 minutes with no way out. It must stay disclosed in the readme.
- Dark mode with a by-clock option (light 6 AM, dark 6 PM), custom window colors, custom pearl mix colors, and a Mullvad-style tray widget (owner's request, 2026-11-25).
- No Godot. "Slug" is the owner's nickname, not a theme.
- The owner sends changes in the format in `REQUEST-TEMPLATE.md` (kept deliberately tiny). The owner writes casually. The GitHub readme is written in their voice: all lowercase, no em dashes.

## Stack
- **Tauri 2:** Rust shell in `src-tauri/`, plain HTML/CSS/JS in `ui/`, no bundler. `withGlobalTauri` is on, so the JS uses `window.__TAURI__`.
- The version lives only in `package.json`. `tauri.conf.json` points at it, and `build.rs` reruns when it changes.
- Fonts are bundled in `ui/fonts/` (works offline).
- **Building locally** needs these in PowerShell: `$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"` and `$env:TAURI_SIGNING_PRIVATE_KEY=(Get-Content $env:USERPROFILE\.tauri\pearl.key -Raw)`. Then run `npx tauri build`. The installer ends up in `src-tauri/target/release/bundle/nsis/`.
- **Preview in a browser:** the `pearl-ui` config in `C:\claudingprojects\.claude\launch.json` (port 5121).
  - Pages: `#today`, `#goals`, `#goals/new`, `#settings`.
  - Desktop popups: `?screen=warn|lock|pop|nudge|tray`. `pop` takes `&step=ask|nudge|check|done&level=0-3` and has a step picker at the top left. `lock` takes `&mode=hard`.
  - Other switches: `?preset=ocean` (color set), `?kind=steps` (goal form type), `?update=available|none|error` (fake updater), `?still` (no animations).
- **Inspecting the real app:** launch it with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, then evaluate JS over CDP (`http://127.0.0.1:9333/json`).

## Features built
- **Today:** tasks, done-by countdown ring, Every day list with streaks, mascot bubble.
- **Points: fully random** (owner's call, 2026-11-25), in `ui/points.js`.
  - Finishing a task rolls 5-20 points, with a 1 in 20 "lucky" roll worth triple.
  - Unfinished tasks show "?".
  - Unchecking a task takes back exactly what it rolled, so it can't be re-rolled.
  - Goals still pay their own fixed bonus.
  - What points buy or unlock is still open.
- **Goals:** `ui/goals.js` / `goals.css`. Seven ways to track:
  - Times (pips), Amount (bar), Streak (day squares), Weekly (M-S boxes).
  - Percent: drag the bar.
  - Steps: a checklist, where each step is an equal share of the bar, and steps can be added on the card.
  - A goal can be linked to a task, which then shows a goal tag on Today.
  - The New goal form has 5 types.
- **Settings:**
  - Colors: 6 presets plus 4 custom accents. Everything else is derived and stays readable.
  - Background: Pearl mix with a glow slider, Gradient (2 colors + direction), or Solid. Text flips to white on dark backgrounds.
  - Font: the owner's 5 picks: Pearl (Fredoka + Figtree), Quicksand, Fraunces, Patrick Hand, Lexend. The `FONTS` map is in app.js, and the full sample sheet is `design/fonts.html`.
  - Mascot image upload.
  - Reminders (UI only).
  - Updates.
  - Discord status.
  - Two columns (`.set-col`).
- **Mascot pop-up** (`ui/pop.js` draws it, owner's idea 2026-11-25). See round 5 for how it runs.
  - The mascot climbs out of the bottom-left corner (clipped at the taskbar line) with a big speech bubble that names the task.
  - Moods: calm, annoyed (orange), mad (red bubble, anger mark, shakes), furious (bigger, shakes nonstop, red glow, "ignored 3x"), happy (done).
  - Lines are in `LINES` in pop.js, plus `TOPICS` (extra lines when the task name mentions laundry, dishes, trash...). All-caps lines shout the task name too. The owner's reference was a photo cut-out in the corner with a black speech bubble. Don't copy its style.
  - It replaced the old corner nudge card.
- **Corners:** tokens in pearl.css: `--r-lg` 10px, `--r-md` 7px, `--r-sm` 5px.
- **Auto-update** (`ui/updater.js` + `tauri-plugin-updater`):
  - Checks 3 s after start, then every 6 h.
  - When it finds one: a banner with the notes and Update now / Later / Skip this version.
  - Settings > Updates: version, status, a Check for updates button, and an auto-check toggle.
  - Feed: `https://github.com/piercedcreased/Pearl/releases/latest/download/latest.json`.
  - Release: `npm run release -- 0.1.2 "note" "note"` builds and signs on this PC, writes `latest.json`, commits, tags, pushes, then uploads the installer, the .sig and latest.json with `gh release create`. This is the same way Windowsill releases, and it takes about 2 min. `.github/workflows/release.yml` is now a manual-only backup. It needs the GitHub secret, which once broke because a PowerShell pipe added a BOM; re-set it with `gh secret set ... < file` from bash.
  - Signing key: `C:\Users\coastlineshore\.tauri\pearl.key` (not in the repo, no password). It's also the GitHub secret `TAURI_SIGNING_PRIVATE_KEY`. **If it's lost, installed copies can never update again.**
  - `PEARL_UPDATE_FEED=http://127.0.0.1:PORT/latest.json` points at a local test feed. A full 0.1.0 to 0.1.1 self-update was verified.
- **Discord status** (`src-tauri/src/discord.rs`, `ui/discord.js`):
  - Uses the `discord-rich-presence` crate. App ID `1575110259775770755`.
  - Off by default. When on it shows "Getting things done".
  - Two opt-ins: today's count (never task names) and one picked goal (name + ▰▱ bar).
  - Updates are batched, because of Discord's rate limit.
  - Tested once against the owner's running Discord, then cleared.
  - The icon loads from the repo's raw GitHub URL.

## Round 4 (2026-11-25)
- **To do and Every day are separate pages.** The sidebar says "To do" (`#today`) and "Every day" (`#daily`). Upcoming (`#upcoming`) and Done (`#done`) exist as empty-state pages. Before this, every one of those links went to the To do page.
- **Every day page** (`ui/daily.js`, `ui/pages.css`):
  - Each routine row shows time, days, streak, and whether it locks the screen or only shows a corner popup.
  - Checking one off rolls points.
  - An "Add something every day" form: name, time, days, lock toggle.
- **Change time works** (`ui/deadline.js`):
  - A 12-hour picker (hour, 5-minute steps, AM/PM) saved in localStorage `pearl.deadline`.
  - The countdown uses the real clock. The ring empties from 8:00 AM to the done-by time and shows "Time's up" after it.
  - `?now=13:58` fakes the clock for screenshots.
- **Popup demo on the owner's wallpaper:** `?screen=warn|lock|nudge` uses `ui/demo/wallpaper.jpg` when it exists, and falls back to the drawn game scene. `ui/demo/` (the raw wallpaper) is gitignored. The owner asked for the readme's reminder images to be their desktop with the popups over it: `docs/desktop-lock.jpg`, `docs/desktop-warn-mascot.png`, `docs/desktop-mascot-mad.png` and `docs/desktop-lockdown.jpg` (made with headless Edge at 1600x900 with `&still`, pairs pasted side by side at 800x450).

## Round 5 (2026-11-25, overnight): the reminder flow for real
The owner asked for everything from their request template plus the mascot behavior. Built and tested in a debug build of the real app (screenshots of each step).

- **How it runs.** The main window never really closes: the X hides it to the tray, so its JS keeps running. `ui/flow.js` is the flow, `ui/screens.js` draws each pop-up, `src-tauri/src/popups.rs` opens windows and keeps time.
  - Rust sends `pearl-tick` every 15 s. `flow.js` checks the Every day routines: due now or up to 15 min ago, today's weekday, not done, not fired today (`pearl.remind.fired`).
  - Reminders are **off until the owner turns them on** (Settings > Reminders > Turn on reminders, localStorage `pearl.remind`). "Try it" runs a test reminder (no points, nothing checked off). The tray menu has "Try a reminder now" too.
  - Routines marked "Locks": 15 s warning window (bottom middle, doesn't take focus) -> lock window (whole screen) -> Start / Snooze 10 min / Dismiss. "Popup" routines skip straight to the mascot.
  - Dismiss -> mascot asks "you gonna go do X now?". Start -> "go go go", asks "you finish X?" 10 min later.
  - No / "5 more min" / not answering for 90 s = ignored: he leaves and comes back in 5 min, one mood angrier. "did it" rolls points, checks the routine off (`PearlDaily.markDone`) and he cheers.
  - Timers go through Rust (`pearl_after` -> `pearl-timer` event) so a hidden window can't slow them down.
  - Pop-ups are windows labelled `warn-N`, `lock-N`, `pop-N`, `tray`, loading `index.html?screen=<kind>&win=1&...`. They report clicks with the `pearl-flow` event. The flow tells a pop-up what to say with `pearl-say`. `updater.js` and `discord.js` don't run in pop-up windows.
  - `popup_open` must stay `async`: building a window from a sync command deadlocks on Windows (that bit us).
- **Lock blur:** Windows' Acrylic/Blur window effects showed flat grey in testing (no focus allowed). Instead, right before the lock opens, Rust grabs a 1/6-size screen snapshot (GDI, `windows-sys`), the page draws it on a canvas and CSS blurs it.
- **Snooze punishment** (owner's call, disclosed in the readme's warning box and "snooze punishment" section):
  - Snoozes = lock/warning "Snooze 10 min", mascot "5 more min", and "no" on the ask.
  - From the 4th snooze on, each one has a chance of a **lockdown**: 0.2 + 0.15 per snooze past 4 + 0.05 per ignore, capped at 0.85.
  - Lockdown = the lock window in `mode=hard`: no buttons, a countdown of 60 s + 12 s per snooze past 4 + up to 30 s random, capped at 120 s. Rust (`lock_hold`) keeps it on top and focused and blocks Alt+F4. Ctrl+Alt+Del can't be blocked, and the readme says so.
  - After it, the mascot nudges again (at least "mad").
- **Tray** (`lib.rs`): left click opens the tray widget right above the icon (like Mullvad): done-by countdown, to-do left, every day x/y, points, next routine, Open Pearl / Try a reminder / Quit. It hides when it loses focus. Double click opens Pearl. Right click menu: Open, Try a reminder now, Quit. The main window writes `pearl.status` for the widget.
- **Single instance:** opening Pearl again brings up the hidden one.
- **Start with Windows:** Settings > Reminders toggle (tauri-plugin-autostart). It starts with `--hidden`, straight to the tray. Off by default. The main window is `visible: false` in the config and shown in setup unless `--hidden`.
- **Dark mode:** Settings > Colors > Light / Dark / By clock (light 6 AM to 6 PM). Every hard-coded white in the CSS is now `var(--w)`, the window color.
- **Window color:** a picker for cards, rows and pop-ups. Text color flips by the window color's brightness, and accent text gets lightened on dark windows (`inkOn` in app.js). "Auto" goes back to white, or dark in dark mode.
- **Pearl mix colors:** "Pick the pearl colors" toggle with three pickers. With them on, Glow is how strong they are.
- **Every day routines are saved** (`daily.js`, `window.PearlDaily`). The first run copies the sample rows from the HTML. Rows have a remove button (shows on hover). The add form has all hours and 5-minute steps.
- **Testing the real app without touching the owner's install:** build a separate debug copy with its own data folder:
  `npx tauri build --debug --no-bundle --config '{"identifier":"app.pearl.reminders.test","productName":"Pearl Test"}'`, then run `src-tauri/target/debug/pearl.exe` with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`. In the main window's devtools: `PearlFlow.start('Dishes')`, `PearlFlow.state()`, `PearlFlow.snooze(6)`. `PEARL_TRAY_TEST=1` opens the tray widget 4 s after start, as if the tray icon was clicked. Stop test copies by process id, never by name (the owner's Pearl has the same exe name).
- **Browser demo:** `?screen=warn` runs the whole flow on the fake desktop with short timers. `?screen=pop` has a step picker, including "lockdown". `?screen=lock&mode=hard`, `?screen=tray`, `?theme=dark|light|auto`.
- **Not done / not checked:**
  - Clicking the real tray icon by hand wasn't tested (it's in the hidden-icons overflow). The same code path ran through `PEARL_TRAY_TEST`.
  - Start with Windows wasn't toggled in testing (it writes the registry).
  - The lockdown hasn't been tried over a real fullscreen game. Exclusive-fullscreen games may show over or under it, and the snapshot may be black.

## Next up (in rough order)
1. **Real data:** to-do tasks, goals and the points total saved (routines already are). Tasks with a time could feed the same reminder flow.
2. Release 0.1.2 with round 5 so the owner's installed copy gets it.
3. Upcoming and Done pages (empty states for now).
4. What points are for. The owner's "not sure yet" list: a points leaderboard that can't be farmed by spam-checking, and a shared daily task list (how to confirm people really did them is the open problem).
5. Android, plus settings sync.

## Files
- `ui/`: the app's frontend.
- `src-tauri/`: Rust shell (updater, Discord, tray, reminder pop-up windows in `popups.rs`).
- `mockups/`: the 3 original design directions.
- `design/`: the font sample sheet.
- `art/icon-source.png`: the app icon source.
- `scripts/release.mjs`: the release script.
- `README.md`: in the owner's voice, all lowercase with no em dashes. It uses images from `docs/`: the logo (rendered from `docs/logo.html` with headless Edge `--default-background-color=00000000`) and screenshots. Re-take the screenshots when the UI changes.
- `REQUEST-TEMPLATE.md`: the owner's change-request format.
