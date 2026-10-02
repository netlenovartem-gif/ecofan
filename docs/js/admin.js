initPage();

function setMinEventDate() {
  const input = document.getElementById('event-date');
  const hint = document.getElementById('event-date-hint');
  if (!input) return;

  const today = new Date();
  input.min = today.toISOString().slice(0, 10);

  const monthLater = new Date();
  monthLater.setMonth(monthLater.getMonth() + 1);
  hint.textContent = `Рекомендуем ставить дату не раньше ${monthLater.toLocaleDateString('ru-RU')}`;
}

setMinEventDate();

async function loadUsers() {
  const users = await api('/api/admin/users');
  document.getElementById('users').innerHTML = users.map(u => `
    <li>
      <span>#${u.id} ${u.name} (${u.phone}) — ${u.role}, ${u.points} баллов</span>
      <select data-id="${u.id}" class="role-select">
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Пользователь</option>
        <option value="receiver" ${u.role === 'receiver' ? 'selected' : ''}>Приёмщик</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Админ</option>
      </select>
      <button class="btn-delete-user" data-id="${u.id}" ${u.id === 3 ? 'disabled' : ''}>Удалить</button>
    </li>
  `).join('');

  document.querySelectorAll('.role-select').forEach(sel => {
    sel.onchange = async () => {
      if (!confirm('Сменить роль? Баллы, уровень, кг, стрик, сдачи, заказы и записи на мероприятия будут обнулены.')) {
        loadUsers();
        return;
      }
      await api('/api/admin/role', {
        method: 'POST',
        body: JSON.stringify({ userId: +sel.dataset.id, role: sel.value })
      });
      alert('Роль обновлена. Данные пользователя обнулены.');
      loadUsers();
    };
  });

  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить пользователя? Все его данные тоже удалятся.')) return;
      await api(`/api/admin/user/${btn.dataset.id}`, { method: 'DELETE' });
      loadUsers();
    };
  });
}

async function loadEvents() {
  const events = await api('/api/admin/events');
  document.getElementById('events-list').innerHTML = events.map(e => `
    <li>
      <span>
        <strong>${e.title}</strong><br>
        ${e.date} · ${e.place || '—'}<br>
        Записались: ${e.signups}
      </span>
      <button class="btn-delete-event" data-id="${e.id}">Удалить</button>
    </li>
  `).join('') || '<li>Мероприятий нет</li>';

  document.querySelectorAll('.btn-delete-event').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить мероприятие?')) return;
      await api(`/api/admin/event/${btn.dataset.id}`, { method: 'DELETE' });
      loadEvents();
    };
  });
}

async function loadProducts() {
  const products = await api('/api/products');
  document.getElementById('products-list').innerHTML = products.map(p => `
    <li>
      <span>${p.name} — ${p.price} баллов</span>
      <button class="btn-delete-product" data-id="${p.id}">Удалить</button>
    </li>
  `).join('') || '<li>Товаров нет</li>';

  document.querySelectorAll('.btn-delete-product').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить товар?')) return;
      await api(`/api/admin/product/${btn.dataset.id}`, { method: 'DELETE' });
      loadProducts();
    };
  });
}

async function loadPoints() {
  const points = await api('/api/points');
  document.getElementById('points-list').innerHTML = points.map(p => `
    <li>
      <span>${p.name} — ${p.address}</span>
      <button class="btn-delete-point" data-id="${p.id}">Удалить</button>
    </li>
  `).join('') || '<li>Точек нет</li>';

  document.querySelectorAll('.btn-delete-point').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Удалить точку приёма?')) return;
      await api(`/api/admin/point/${btn.dataset.id}`, { method: 'DELETE' });
      loadPoints();
    };
  });
}

document.getElementById('event-form').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await api('/api/admin/event', { method: 'POST', body: JSON.stringify(data) });
  if (res.ok) { alert('Мероприятие добавлено'); e.target.reset(); setMinEventDate(); loadEvents(); }
  else alert(res.error);
};

document.getElementById('product-form').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.price = +data.price;
  const res = await api('/api/admin/product', { method: 'POST', body: JSON.stringify(data) });
  if (res.ok) { alert('Товар добавлен'); e.target.reset(); loadProducts(); }
  else alert(res.error);
};

document.getElementById('point-form').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.lat = +data.lat;
  data.lng = +data.lng;
  const res = await api('/api/admin/point', { method: 'POST', body: JSON.stringify(data) });
  if (res.ok) { alert('Точка добавлена'); e.target.reset(); loadPoints(); }
  else alert(res.error);
};

loadUsers();
loadEvents();
loadProducts();
loadPoints();