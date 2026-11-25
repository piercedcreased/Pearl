// Goals page behaviour (prototype): percent goals you slide, step goals a checklist fills,
// and the goal-type picker in the New goal form.

function setBar(card, pct) {
  const bar = card.querySelector('.bar');
  if (!bar) return;
  bar.querySelector('i').style.width = pct + '%';
  bar.querySelector('span').textContent = pct + '%';
}

/* percent goals */
document.querySelectorAll('[data-goal="percent"]').forEach(card => {
  const range = card.querySelector('input[type=range]'), out = card.querySelector('output');
  const text = card.querySelector('[data-pct-text]');
  const show = () => {
    const v = +range.value;
    range.style.setProperty('--v', v + '%');
    out.textContent = v + '%';
    text.textContent = v >= 100 ? 'Done!' : v === 0 ? 'Not started yet' : `${v}% there`;
    card.classList.toggle('complete', v >= 100);
  };
  range.addEventListener('input', show);
  card.querySelector('[data-pct-done]').addEventListener('click', () => { range.value = 100; show(); });
  show();
});

/* step goals: every step is worth the same share of the bar */
function refreshSteps(card) {
  const steps = [...card.querySelectorAll('.steps li')];
  const done = steps.filter(li => li.classList.contains('done')).length;
  const pct = steps.length ? Math.round(done / steps.length * 100) : 0;
  setBar(card, pct);
  card.querySelector('[data-steps-text]').textContent =
    steps.length && done === steps.length ? 'All steps done!' : `${done} of ${steps.length} steps`;
  card.classList.toggle('complete', pct === 100);
}
document.querySelectorAll('[data-goal="steps"]').forEach(card => {
  card.querySelector('.steps').addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    li.classList.toggle('done'); refreshSteps(card);
  });
  card.querySelector('.step-add').addEventListener('submit', e => {
    e.preventDefault();
    const inp = e.target.querySelector('input'), name = inp.value.trim(); if (!name) return;
    const li = document.createElement('li');
    li.innerHTML = '<button class="step-check" aria-label="Mark step done"></button><span></span>';
    li.querySelector('span').textContent = name;
    card.querySelector('.steps').appendChild(li);
    inp.value = ''; refreshSteps(card);
  });
  refreshSteps(card);
});

/* New goal form: show only the fields that fit the chosen type */
const kinds = document.getElementById('goal-kinds');
function pickKind(kind) {
  kinds.querySelectorAll('.kind').forEach(b => b.classList.toggle('on', b.dataset.kind === kind));
  document.querySelectorAll('#new-goal [data-kind-for]').forEach(el => { el.hidden = !el.dataset.kindFor.split(' ').includes(kind); });
  const label = document.querySelector('[data-target-label]');
  if (label) label.textContent = { times: 'How many times', amount: 'Amount to reach', streak: 'Days in a row' }[kind] || 'Target';
}
kinds.addEventListener('click', e => { const b = e.target.closest('.kind'); if (b) pickKind(b.dataset.kind); });
pickKind(new URLSearchParams(location.search).get('kind') || 'times');
