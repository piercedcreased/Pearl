// Every day page (prototype): pick days, update the "done today" count, add a routine row.

(() => {
  const page = document.querySelector('.page-daily');
  if (!page) return;
  const list = page.querySelector('.routines');

  function count() {
    const all = list.querySelectorAll('.routine').length, done = list.querySelectorAll('.routine.done').length;
    page.querySelector('.count-pill').textContent = `${done} of ${all} done today`;
  }

  page.querySelector('.days-pick').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) b.classList.toggle('on');
  });

  page.querySelector('.add-routine').addEventListener('click', () => {
    const form = page.querySelector('.routine-add');
    const name = form.querySelector('input').value.trim();
    if (!name) { form.querySelector('input').focus(); return; }
    const [h, m] = form.querySelectorAll('.tp-row select');
    const ampm = form.querySelector('.tp-ampm .on')?.textContent || 'PM';
    const days = [...form.querySelectorAll('.days-pick button')];
    const on = days.filter(b => b.classList.contains('on')).length;
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayText = on === 7 ? 'Every day' : days.map((b, i) => b.classList.contains('on') ? names[i] : null).filter(Boolean).join(', ') || 'No days picked';
    const locks = form.querySelector('.toggle').classList.contains('on');
    const li = document.createElement('li');
    li.className = 'routine c' + (list.children.length % 4 + 1);
    li.innerHTML = `<button class="check" aria-label="Mark done today"></button>
      <span class="r-main"><span class="name"></span><span class="r-days"></span></span>
      <span class="r-time"></span><span class="streak">New</span>
      <span class="lock-chip${locks ? '' : ' off'}">${locks ? 'Locks' : 'Popup'}</span>`;
    li.querySelector('.name').textContent = name;
    li.querySelector('.r-days').textContent = dayText;
    li.querySelector('.r-time').textContent = `${h.value}:${m.value} ${ampm}`;
    list.appendChild(li);
    form.querySelector('input').value = '';
    count();
  });

  document.addEventListener('click', e => { if (e.target.closest('.page-daily .routine .check')) setTimeout(count, 0); });
  count();
})();
