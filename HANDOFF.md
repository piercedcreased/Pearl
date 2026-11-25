# Pearl: handoff

Pearl is a to-do and reminder app that pushes you to actually do things. It's Windows first, with Android later and settings synced between the two.

## What the owner asked for (2026-11-25)
- A to-do list like Microsoft To Do, but simpler to get around.
- A daily "get it all done by" time, in 12-hour format (e.g. 4:15 PM), with a live countdown.
- Every-day routines (laundry, dishes...) on a schedule.
- Points for finishing things. How points work is still open, so decide that later.
- Colorful and vibrant, but sleek: a poppy, bubbly feel.
- A mascot (like Duolingo's, but you never have to take care of it). The owner sets their own transparent PNG. It pops up sometimes with random lines, and congratulates you, especially when everything is done.
- When a scheduled item is due:
  1. A warning near the bottom of the screen counts down 15 seconds, so you can pause a game.
  2. Then a full-screen lock appears, softly blurred, with the task on a card. It can be dismissed.
  3. If you dismiss it, small custom corner popups (NOT Windows notifications) keep asking if you're doing the task until you confirm.
- Name: Pearl (for now).
- Must not use Godot. Use a stack that runs on both Windows and Android.

## Stack (recommended, not final until the owner OKs it)
**Tauri 2** (Rust shell, web UI). It builds Windows and Android from one codebase.
- Light on RAM/CPU, which matters because the owner games on this PC.
- Multiple windows are easy: the main window, a transparent always-on-top fullscreen lock window, and small borderless corner windows for nudges.
- The `window-vibrancy` crate gives real Windows acrylic blur behind the lock screen.
- The mockup HTML/CSS in `mockups/` can be reused as the real UI.
- Android later: the lock needs a small native plugin ("display over other apps" permission + a foreground service). Every stack needs that part.
- Caveat: games in exclusive fullscreen can sit above overlays. Borderless windowed games are fine.

The fallback is Flutter. It's also fine, but multi-window desktop overlays are clumsier there.

## Mockups
`mockups/index.html?theme=lagoon|night|sticker&screen=main|warn|lock|nudge` (add `&still` to turn off the entrance animations).
`mockups/overview.html` shows all 12 at once. Screenshots are in `mockups/shots/`.
To view them, run the `pearl-mockups` config in `C:\claudingprojects\.claude\launch.json` (port 5120).
- A. Lagoon: iridescent pearl glass, a sidebar, and a countdown ring. Fredoka + Figtree.
- B. Night Pop: dark grape with candy brights, an icon rail, and a big countdown with a day timeline. Unbounded + Outfit.
- C. Sticker: sunflower yellow, thick outlines, top tabs, and a big mascot panel. Baloo 2.
The mascot in the mockups is a placeholder pearl. The real one is the owner's PNG.

## Chosen design: A (Lagoon), with colors you can change (picked 2026-11-25)
The working prototype is `ui/` (index.html, pearl.css, app.js). Run the `pearl-ui` config in launch.json (port 5121). It becomes the real app's frontend.
- Pages are chosen by hash: `#today`, `#goals`, `#goals/new` (the New goal form), `#settings`. For the desktop popups, use `?screen=warn|lock|nudge`. `?preset=ocean` etc. forces a color set, and `?still` turns off the entrance animations.
- **Colors:** the user picks 4 accents (Main, Pop, Done, Extra). There are six presets (Lagoon, Bubblegum, Ocean, Sunset, Mint, Grape) plus a "Background glow" slider. `app.js` works out everything else from the 4 accents: text-safe darker shades (`--aN-ink`), text color on each accent (`--on-aN`), the background tints, ink and soft gray. Light colors like yellow stay readable. Saved in localStorage `pearl.look`. This should become part of the synced settings later.
- **Mascot:** Settings has "Choose image" (a transparent PNG). It's stored in localStorage `pearl.mascot` and replaces every `.mascot` element.
- **Goals:** goals are bigger targets that pay bonus points. There are three ways to track them: a number of times (pips), an amount (bar), and a streak (day squares). A weekly target shows M-S boxes. A goal can be linked to a task or routine, so finishing that task counts toward it; the task shows a small goal tag on Today. The right column on Goals shows "Today helps with" and the mascot. A Finished list sits at the bottom.
- "Every day", "Upcoming" and "Done" in the sidebar don't have their own pages yet.

## App shell and updates (added 2026-11-25)
- The Tauri 2 shell is in `src-tauri/`. `ui/` is served as the frontend as-is, with no bundler. `withGlobalTauri` is on, so the JS uses `window.__TAURI__`.
- The version lives only in `package.json`. `tauri.conf.json` points at it.
- Fonts are bundled in `ui/fonts/`, so the app works offline.
- **Updater** (`ui/updater.js` + `tauri-plugin-updater`):
  - Checks 3 s after start, then every 6 h while open. Both can be turned off in Settings.
  - If a version is found, a banner shows top-right with the release notes and Update now / Later / Skip this version.
  - Settings > Updates shows the current version, its status and when it last checked. It has a Check for updates button that turns into Update now.
  - A download shows a progress bar. Then the NSIS installer runs in passive mode and Pearl reopens.
  - Failed background checks stay quiet. A failed manual check says so.
  - In a plain browser it fakes an update: `?update=available|none|error`.
- **Feed:** `https://github.com/piercedcreased/Pearl/releases/latest/download/latest.json`. If the repo has a different name, change it in `src-tauri/tauri.conf.json`.
- **Signing:** the private key is at `C:\Users\coastlineshore\.tauri\pearl.key`. It is NOT in the repo and has no password. The public key is in tauri.conf.json. If the key is lost, installed copies can never update again, so back it up. It must be added as the GitHub secret `TAURI_SIGNING_PRIVATE_KEY`.
- **Releasing:** run `npm run release -- 0.2.0 "note one" "note two"`. That bumps the version, writes `release-notes.md`, commits, tags and pushes. `.github/workflows/release.yml` then builds on windows-latest, signs, and publishes the release with `latest.json`.
- **Testing updates locally:** setting the env var `PEARL_UPDATE_FEED=http://127.0.0.1:PORT/latest.json` points the app at a local feed. Plain http is allowed only for localhost, and the update must still be signed with Pearl's key. Verified 2026-11-25: an installed 0.1.0 found 0.1.1, downloaded it, installed it and reopened as 0.1.1.
- `src-tauri/build.rs` reruns when package.json changes. Without that, a version bump alone kept the old version inside the exe.
- Local builds need `$env:PATH` to include `%USERPROFILE%\.cargo\bin` (Rust was installed by winget 2026-11-25), plus `TAURI_SIGNING_PRIVATE_KEY` set to the key file's contents.
- Android: the Tauri updater is desktop only. Android updates will go through the Play Store or an APK.

## Round 3 (2026-11-25)
- **Corners:** three tokens in pearl.css: `--r-lg` 10px (cards), `--r-md` 7px (rows, buttons), `--r-sm` 5px (chips). The owner wants corners "barely rounded but noticeable".
- **Background** (Settings > Colors): Pearl mix (accent-tinted, with a Glow slider), Gradient (2 colors + direction), or Solid. On a dark background, text that sits right on it turns white and the cards become more opaque.
- **Fonts:** the owner picked 5 from the 28 in `design/fonts.html`: Pearl (Fredoka + Figtree), Quicksand, Fraunces, Patrick Hand, Lexend. They're bundled in `ui/fonts`, and the `FONTS` map is in app.js.
- **Goals:** two new types. Percent: you drag the bar. Steps: a checklist, and each step is an equal share of the bar. The New goal form now has 5 types (Times, Amount, Streak, Percent, Steps). The code is in goals.js and goals.css.
- **Discord status** (`src-tauri/src/discord.rs`, `ui/discord.js`):
  - Off by default.
  - When on, it shows "Getting things done". Two opt-ins add more: "today's progress" (counts only, never task names) and one goal the user picks (name plus a ▰▱ bar).
  - **Needs a Discord Application ID** in `APP_ID` (or the env var `PEARL_DISCORD_APP_ID`). The owner creates the application at discord.com/developers/applications, and its name is what shows after "Playing". The icon comes from the repo's raw GitHub URL.
- **Points:** still undecided. The owner doesn't want flat points for daily tasks unless there's a weight system. Proposal: guess each task's size from built-in rules (keywords, how many steps, any time mentioned), let the user change it with one tap, then roll random points within that size.
- `REQUEST-TEMPLATE.md` is the owner's template for sending change lists.
- Pearl 0.1.0 (local build) is installed on the owner's PC, with Desktop and Start menu shortcuts.

## Status
- [x] Mockups for three directions
- [x] Owner picked A, with colors you can change, plus a Goals page
- [ ] Scaffold the Tauri 2 app around `ui/` (main window, lock window, corner nudge windows, tray icon, start with Windows)
- [ ] Real data: tasks, routines, goals, points, saved to disk
- [ ] Decide how points work (what they buy or unlock)
