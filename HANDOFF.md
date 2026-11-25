# Pearl: handoff

Read this first. Last updated 2026-11-25.

Pearl is the owner's to-do and reminder app that pushes them to actually do things. It's Windows now and Android later, with settings synced between the two. The repo is public at https://github.com/piercedcreased/Pearl (default branch `main`).

## Where things stand
- **It's still a clickable prototype inside a real app.** The UI in `ui/` runs in the Tauri shell and looks finished, but the data is hard-coded sample HTML. Nothing is saved except the look and settings (localStorage).
- **Installed on the owner's PC:** Pearl 0.1.0 (a local build) at `%LOCALAPPDATA%\Pearl`, with Desktop and Start menu shortcuts. Reinstalling over it: `Start-Process <installer> /S`.
- **Not released:** the GitHub repo has no release yet, so installed copies have nothing to update to. The first public release must be **0.1.1 or higher**, or the owner's local 0.1.0 won't take it.
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
  3. After a dismiss, custom corner popups (NOT Windows notifications) keep asking until the owner confirms.
- No Godot. "Slug" is the owner's nickname, not a theme.
- The owner sends changes in the format in `REQUEST-TEMPLATE.md` (kept deliberately tiny). The owner writes casually. The GitHub readme is written in their voice: all lowercase, no em dashes.

## Stack
- **Tauri 2:** Rust shell in `src-tauri/`, plain HTML/CSS/JS in `ui/`, no bundler. `withGlobalTauri` is on, so the JS uses `window.__TAURI__`.
- The version lives only in `package.json`. `tauri.conf.json` points at it, and `build.rs` reruns when it changes.
- Fonts are bundled in `ui/fonts/` (works offline).
- **Building locally** needs these in PowerShell: `$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"` and `$env:TAURI_SIGNING_PRIVATE_KEY=(Get-Content $env:USERPROFILE\.tauri\pearl.key -Raw)`. Then run `npx tauri build`. The installer ends up in `src-tauri/target/release/bundle/nsis/`.
- **Preview in a browser:** the `pearl-ui` config in `C:\claudingprojects\.claude\launch.json` (port 5121).
  - Pages: `#today`, `#goals`, `#goals/new`, `#settings`.
  - Desktop popups: `?screen=warn|lock|nudge`.
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
- **Popup demo on the owner's wallpaper:** `?screen=warn|lock|nudge` uses `ui/demo/wallpaper.jpg` when it exists, and falls back to the drawn game scene. `ui/demo/` (the raw wallpaper) is gitignored. The owner asked for the readme's reminder images to be their desktop with the popups over it: `docs/desktop-lock.jpg` and `docs/desktop-warn-nudge.png`.

## Next up (in rough order)
1. **Real data:** tasks, routines, goals and points saved to disk (JSON in the app data dir via a Rust command, or tauri-plugin-store). Replace the sample HTML with rendering from data. Make adding, editing and deleting work.
2. **The lock flow for real:**
   - A second always-on-top, transparent, fullscreen Tauri window with acrylic blur (`window-vibrancy`).
   - The 15 s warning window.
   - Corner nudge windows.
   - A scheduler in Rust, so it works while the main window is closed.
   - A tray icon and start with Windows.
3. Mascot pop-ups with random lines.
4. The Upcoming and Done pages (empty states for now).
5. What points are for.
6. Android, plus settings sync.

## Files
- `ui/`: the app's frontend.
- `src-tauri/`: Rust shell (updater, Discord).
- `mockups/`: the 3 original design directions.
- `design/`: the font sample sheet.
- `art/icon-source.png`: the app icon source.
- `scripts/release.mjs`: the release script.
- `README.md`: in the owner's voice, all lowercase with no em dashes. It uses images from `docs/`: the logo (rendered from `docs/logo.html` with headless Edge `--default-background-color=00000000`) and screenshots. Re-take the screenshots when the UI changes.
- `REQUEST-TEMPLATE.md`: the owner's change-request format.
