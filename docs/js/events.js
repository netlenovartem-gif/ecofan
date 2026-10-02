initPage();

async function load() {
  const my = await api('/api/events/my');
  document.getElementById('my-events').innerHTML = my.length
    ? my.map(e => `<li><span>${e.title}</span><em>${e.date} · ${e.place}</em></li>`).join('')
    : '<li>Вы пока никуда не записаны</li>';

  const events = await api('/api/events');
  document.getElementById('events').innerHTML = events.map(e => `
    <div class="event">
      <h3>${e.title}</h3>
      <p>${e.description}</p>
      <p><strong>Место:</strong> ${e.place}</p>
      <p><strong>Дата:</strong> ${e.date}</p>
      ${e.signed
        ? '<button class="btn btn-secondary" disabled>Вы записаны</button>'
        : `<button class="btn btn-primary signup" data-id="${e.id}">Записаться</button>`}
    </div>
  `).join('');

  document.querySelectorAll('.signup').forEach(btn => {
    btn.onclick = async () => {
      const res = await api(`/api/events/${btn.dataset.id}/signup`, { method: 'POST' });
      if (res.ok) { alert('Вы записаны!'); load(); }
      else alert(res.error);
    };
  });
}

load();