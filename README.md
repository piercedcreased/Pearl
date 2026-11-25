# pearl

a to do app for people who know exactly what they need to do and still dont do it

i made this because i cant make myself do normal stuff during the day unless something actually makes me. reminders on my phone get swiped away in half a second so pearl doesnt let you do that lol

## what it does

- **to do list** like microsoft to do but way less clicking around
- **done by time** you pick a time like 4:15pm and theres a little countdown ticking down to it all day
- **every day stuff** laundry, dishes, meds, whatever. set it once and it comes back every day and keeps a streak going
- **goals** for bigger things. you can count them (walk 20 times), track an amount (save $300), keep a streak, drag a percent bar yourself, or break it into steps and the bar fills up as you check them off
- **the mascot** you pick any png with no background and it becomes your little guy. you dont have to feed it or keep it alive or anything, it just pops up sometimes to hype you up when you finish stuff
- **it locks your screen** when something on your schedule is due. you get a 15 second heads up at the bottom of the screen first so you can pause your game, then everything gets a soft blur with the task on it. you can dismiss it if you really have to, but then little popups in the corner keep asking if youre doing it until you say yes
- **make it yours** pick your colors, a background (the pearl mix, a gradient or just one color) and a font
- **discord status** shows youre on pearl if you want. your goals stay private unless you pick one to show off
- **updates itself** checks for a new version when you open it and theres a button in settings too

## where its at

works on windows right now. android is coming later and your settings will sync between them

still early so stuff is gonna change a lot. points are a thing but how you earn them isnt figured out yet

## running it yourself

you need node and rust

```
npm install
npm run dev
```

just want to look at the ui in a browser

```
npm run preview
```

## putting out an update

```
npm run release -- 0.2.0 "what changed" "another thing that changed"
```

that bumps the version, tags it and pushes. github builds the installer, signs it and posts the release, and everyone who has pearl gets the update next time they open it

made with tauri
