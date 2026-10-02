initPage();

let searchTimer = null;

document.getElementById('user-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  const box = document.getElementById('user-results');

  if (q.length < 2) { box.innerHTML = ''; return; }

  searchTimer = setTimeout(async () => {
    const users = await api('/api/find-user?q=' + encodeURIComponent(q));
    box.innerHTML = users.map(u =>
      `<div class="user-option" data-id="${u.id}" data-name="${u.name}">
        ${u.name} — ${u.phone}
      </div>`
    ).join('') || '<div class="user-option">Никого не найдено</div>';

    document.querySelectorAll('.user-option').forEach(opt => {
      if (!opt.dataset.id) return;
      opt.onclick = () => {
        document.getElementById('user-search').value = `${opt.dataset.name} (ID ${opt.dataset.id})`;
        document.getElementById('user-id').value = opt.dataset.id;
        box.innerHTML = '';
      };
    });
  }, 300);
});

async function loadOptions() {
  const points = await api('/api/points');
  const tariffs = await api('/api/tariffs');

  document.getElementById('point-select').innerHTML = points.map(p =>
    `<option value="${p.id}">${p.name} — ${p.address}</option>`
  ).join('');

  document.getElementById('type-select').innerHTML = tariffs.map(t =>
    `<option value="${t.type}">${t.type} — ${t.points_per_kg} баллов/кг</option>`
  ).join('');
}

document.getElementById('deliver-form').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.userId = +data.userId;
  data.pointId = +data.pointId;
  data.weight = +data.weight;

  if (!data.userId) { alert('Выберите пользователя из списка'); return; }

  const res = await api('/api/deliver', { method: 'POST', body: JSON.stringify(data) });

  const result = document.getElementById('result');
  result.classList.remove('hidden');

  if (res.error) {
    result.innerHTML = `<p style="color:#c62828">${res.error}</p>`;
    return;
  }

  result.innerHTML = `
    <p>Начислено: <strong>+${res.points}</strong> баллов</p>
    ${res.multiplier > 1 ? `<p>Множитель за стрик: ×${res.multiplier}</p>` : ''}
    <p>Всего у пользователя: <strong>${res.total}</strong> баллов</p>
    <p>Уровень: <strong>${res.level}</strong></p>
  `;
  e.target.reset();
  document.getElementById('user-search').value = '';
  document.getElementById('user-id').value = '';
  loadOptions();
  loadOrders();
};

async function loadOrders() {
  const orders = await api('/api/point-orders');
  document.getElementById('orders-board').innerHTML = orders.length
    ? orders.map(o => `
        <li>
          <span>
            <strong>${o.product_name}</strong><br>
            ${o.user_name} · ${o.phone}<br>
            Точка: ${o.point_name || '—'}<br>
            Статус: <strong>${o.status}</strong>
          </span>
          <div>
            ${o.status === 'в пути'
              ? `<button class="btn btn-secondary status-btn" data-id="${o.id}" data-status="готов к выдаче">Получен</button>`
              : ''}
            ${o.status === 'готов к выдаче'
              ? `<button class="btn btn-primary status-btn" data-id="${o.id}" data-status="выдан">Выдан</button>`
              : ''}
          </div>
        </li>
      `).join('')
    : '<li>Нет активных заказов</li>';

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.onclick = async () => {
      await api(`/api/point-orders/${btn.dataset.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: btn.dataset.status })
      });
      loadOrders();
    };
  });
}

loadOptions();
loadOrders();