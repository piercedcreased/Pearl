// Mascot pop-up (owner's idea, 2026-11-25): the mascot climbs out of the bottom-left corner
// with a big speech bubble about the task. This file only draws it and reports what was
// clicked. flow.js decides what comes next (moods, timers, snooze lockdowns).
//
// Moods: calm -> annoyed -> mad -> furious, one step per ignore. happy when it's done.

window.PearlPop = (() => {
  const MOODS = ['calm', 'annoyed', 'mad', 'furious'];

  // {task} becomes the task name, {n} the ignore/snooze count, {pts} points. Keep lines short.
  const LINES = {
    ask: [
      'you gonna go do {task} now?',
      "lock's gone. {task} isn't. going now?",
      'ok you dismissed it. so are you doing {task} or what?',
      '{task}. now? yes or no.',
    ],
    going: ["bet. i'll check on you", "that's what i like to hear", 'go go go', "ok. i'm watching"],
    no: ["no?? ok. i'll be back", "wrong answer. i'll ask again", "fine. but i'm coming back"],
    snooze: ['5 more min. FIVE.', "fine. 5 minutes. i'm counting", 'ok but this is the last snooze (it is not)'],
    snoozeLock: ["10 more minutes. that's it", "fine. i'll lock it again in 10", 'snoozed. i remember everything'],
    nudge: [
      ['hey. {task}. still waiting', '{task} is not gonna do itself', 'just checking. {task} done yet?'],
      ['you said you would do {task}...', "i'm still here. {task}.", 'still no {task}? hm.'],
      ['you dismissed the lock AND skipped {task}??', 'i KNOW you saw that lock screen', '{task}. NOW.', "don't make me lock your screen again"],
      ['I AM NOT LEAVING UNTIL {task} IS DONE', "{task}. GO. I'M SO SERIOUS", "you've ignored me {n} times. {task}. now.", 'PUT. THE. GAME. DOWN.'],
    ],
    check: ['you finish {task}?', 'so... {task} done?', 'status report. {task}?'],
    notyet: ["ok. finish it. i'll be back", 'hurry up then'],
    done: ["LET'S GO. +{pts} points", 'see? easy. +{pts}', 'proud of you fr. +{pts}'],
    lucky: ['LUCKY ROLL. +{pts}!!', 'TRIPLE POINTS. +{pts}. you deserve it'],
    lockdown: ["THAT'S IT. LOCKDOWN.", 'snooze again? no. screen time OVER.', 'you did this to yourself'],
  };
  // Extra lines when the task name mentions one of these (calm and annoyed only).
  const TOPICS = [
    [/laundry|clothes|wash/i, ['your clothes are getting crusty', 'the laundry pile is plotting against you']],
    [/dish/i, ['those dishes are growing legs', 'the sink is starting to smell. just saying']],
    [/trash|garbage/i, ['the trash is NOT gonna walk itself out']],
    [/walk|run|gym|workout|exercise/i, ['legs. move them.', 'go touch some grass real quick']],
    [/clean|room|vacuum/i, ['your room is a crime scene. go']],
    [/shower/i, ['go shower. for everyone']],
    [/homework|study|essay/i, ['the homework is still there. i checked']],
    [/meds|pill|medicine/i, ['meds. now. take care of yourself']],
  ];
  const BUTTONS = {
    ask: [['primary', 'yeah, going now', 'yes'], ['secondary', 'no', 'no']],
    nudge: [['primary', 'did it', 'done'], ['secondary', 'doing it now', 'going'], ['secondary', '5 more min', 'snooze']],
    check: [['primary', 'done', 'done'], ['secondary', 'not yet', 'notyet']],
  };

  const pick = a => a[Math.floor(Math.random() * a.length)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fill(line, v) {
    const bare = line.replace(/\{\w+\}/g, ''); // shouty lines shout the task name too
    const loud = bare === bare.toUpperCase() && /[A-Z]{3}/.test(bare);
    const task = String(v.task || 'it');
    const name = loud ? task.toUpperCase() : task.toLowerCase();
    return esc(line).replace('{task}', `<em>${esc(name)}</em>`).replace('{n}', v.n ?? '').replace('{pts}', v.pts ?? '');
  }
  const moodOf = level => MOODS[Math.max(0, Math.min(3, level | 0))];

  let el, lineEl, actsEl, countEl, waitT = 0, hideT = 0;

  function mount(host) {
    host.insertAdjacentHTML('beforeend', `
      <div class="pop-glow"></div>
      <div class="pop" id="pop" data-mood="calm" hidden role="dialog" aria-live="assertive" aria-label="Pearl">
        <div class="mascot pop-mascot"><svg viewBox="0 0 120 120"><use href="#pearl"/></svg></div>
        <svg class="pop-vein" viewBox="0 0 50 50" aria-hidden="true"><path d="M8 20 Q20 20 20 8 M30 8 Q30 20 42 20 M42 30 Q30 30 30 42 M20 42 Q20 30 8 30"/></svg>
        <div class="pop-bubble"><span class="pop-count"></span><p class="pop-line"></p><div class="pop-actions"></div></div>
      </div>`);
    el = document.getElementById('pop');
    lineEl = el.querySelector('.pop-line'); actsEl = el.querySelector('.pop-actions'); countEl = el.querySelector('.pop-count');
    const src = localStorage.getItem('pearl.mascot');
    if (src) el.querySelector('.pop-mascot').innerHTML = `<img src="${src}" alt="">`;
  }

  function paint(html, mood, buttons, count, onAnswer) {
    clearTimeout(waitT); clearTimeout(hideT);
    // restart the entrance animation each time it pops
    el.hidden = true; el.classList.remove('out'); void el.offsetWidth; el.hidden = false;
    el.dataset.mood = mood;
    lineEl.innerHTML = html;
    countEl.textContent = count >= 2 && mood !== 'happy' ? `ignored ${count}x` : '';
    actsEl.innerHTML = '';
    for (const [cls, label, answer] of buttons) {
      const b = document.createElement('button');
      b.className = cls; b.textContent = label;
      b.onclick = () => { clearTimeout(waitT); actsEl.querySelectorAll('button').forEach(x => x.disabled = true); onAnswer(answer); };
      actsEl.append(b);
    }
  }

  // A question with buttons. Not answering within ignoreMs counts as 'silent'.
  function show({ step, level = 0, task, n = 0 }, onAnswer, ignoreMs) {
    let pool = step === 'nudge' ? LINES.nudge[Math.min(3, level)] : LINES[step];
    const topic = TOPICS.find(([re]) => re.test(task || ''));
    if (step === 'nudge' && level < 2 && topic && Math.random() < .5) pool = topic[1];
    const mood = step === 'ask' ? moodOf(Math.min(level, 1)) : step === 'check' ? 'calm' : moodOf(level);
    paint(fill(pick(pool), { task, n }), mood, BUTTONS[step] || [], n, onAnswer);
    if (ignoreMs) waitT = setTimeout(() => onAnswer('silent'), ignoreMs);
  }

  // A line with no buttons; it goes away by itself. Resolves once it's gone.
  function say({ kind, mood = 'calm', task, n, pts }, ms = 2600) {
    paint(fill(pick(LINES[kind] || [kind]), { task, n, pts }), mood, [], 0, () => {});
    return new Promise(res => { hideT = setTimeout(() => { hide(); setTimeout(res, 380); }, ms); });
  }

  function hide() {
    clearTimeout(waitT);
    if (!el) return;
    el.classList.add('out');
    setTimeout(() => { if (el.classList.contains('out')) el.hidden = true; }, 380);
  }

  return { mount, show, say, hide, moodOf, LINES };
})();
