# Pearl

A colorful to-do and reminder app that rewards you for getting things done.

- A to-do list with points, plus a "get it all done by" time with a live countdown
- Every-day routines (laundry, dishes...) with streaks
- Goals that fill up as you finish linked tasks
- A mascot you choose yourself (any transparent PNG) that cheers you on
- Reminders that mean it: a 15 second warning, then a soft blurred screen lock, then corner nudges until you confirm
- Colors you can change, and updates that install themselves

Windows now, Android later. Built with [Tauri 2](https://tauri.app).

## Develop

```
npm install
npm run dev        # run the app (needs Rust)
npm run preview    # just the UI in a browser, at http://127.0.0.1:5121
```

## Release

```
npm run release -- 0.2.0 "What's new, line one" "Line two"
```

This tags and pushes the release. GitHub Actions then builds the signed installer and publishes it, and installed copies of Pearl pick it up on their next start.
