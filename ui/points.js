// Points for tasks and every-day items are random (the owner's call, 2026-11-25):
// nothing is weighed, so laundry and a big project roll the same dice.
// Each finish rolls 5-20 points, with a 1 in 20 "lucky" roll worth triple.
// Goals still pay the fixed bonus that's set on the goal.

(() => {
  const MIN = 5, MAX = 20, LUCKY_CHANCE = 0.05, LUCKY_TIMES = 3;

  function roll() {
    const base = MIN + Math.floor(Math.random() * (MAX - MIN + 1));
    const lucky = Math.random() < LUCKY_CHANCE;
    return { pts: lucky ? base * LUCKY_TIMES : base, lucky };
  }

  const total = document.querySelector('.points strong');
  const today = document.querySelector('.pts-today');
  let points = parseInt(total.textContent.replace(/,/g, ''), 10) || 0;
  let todayPts = parseInt(today.textContent.replace(/\D/g, ''), 10) || 0;

  function show() {
    total.textContent = points.toLocaleString('en-US');
    today.textContent = `+${todayPts} today`;
  }

  function pop(anchor, text, lucky) {
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'pts-pop' + (lucky ? ' lucky' : '');
    el.textContent = text;
    el.style.left = r.left + r.width / 2 + 'px';
    el.style.top = r.top + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  document.addEventListener('click', e => {
    const check = e.target.closest('.page-today .task .check');
    if (!check) return;
    const task = check.closest('.task'), chip = task.querySelector('.pts');
    if (!task.classList.contains('done')) {
      const { pts, lucky } = roll();
      task.classList.add('done');
      task.dataset.rolled = pts;
      chip.textContent = `+${pts}`;
      chip.classList.remove('mystery');
      chip.classList.toggle('lucky', lucky);
      points += pts; todayPts += pts;
      pop(check, lucky ? `Lucky! +${pts}` : `+${pts}`, lucky);
      check.setAttribute('aria-label', 'Done');
    } else {
      // Unchecking gives back exactly what was rolled, so it can't be re-rolled for more.
      const pts = parseInt(task.dataset.rolled || chip.textContent.replace(/\D/g, ''), 10) || 0;
      task.classList.remove('done');
      points -= pts; todayPts = Math.max(0, todayPts - pts);
      chip.textContent = '?';
      chip.classList.add('mystery');
      chip.classList.remove('lucky');
      check.setAttribute('aria-label', 'Mark done');
      delete task.dataset.rolled;
    }
    show();
    const left = document.querySelectorAll('.page-today .task:not(.done)').length;
    const all = document.querySelectorAll('.page-today .task').length;
    const pill = document.querySelector('.page-today .count-pill');
    if (pill) pill.textContent = `${all - left} of ${all}`;
  });
})();
