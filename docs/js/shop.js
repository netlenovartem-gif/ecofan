initPage();

let balance = 0;
let points = [];

async function load() {
  const products = await api('/api/products');
  points = await api('/api/points');
  const profile = await api('/api/profile');
  balance = profile.user ? profile.user.points : 0;
  document.getElementById('balance').textContent = balance;

  document.getElementById('products').innerHTML = products.map(p => `
    <div class="product">
      <h3>${p.name}</h3>
      ${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
      <div class="price">${p.price} баллов</div>
      <select class="point-select" data-id="${p.id}">
        <option value="">— выберите точку —</option>
        ${points.map(pt => `<option value="${pt.id}">${pt.name} · ${pt.address}</option>`).join('')}
      </select>
      <button class="btn btn-primary buy-btn" data-id="${p.id}" data-price="${p.price}" disabled>
        ${balance >= p.price ? 'Купить' : 'Не хватает'}
      </button>
    </div>
  `).join('');

  document.querySelectorAll('.point-select').forEach(sel => {
    sel.onchange = () => {
      const id = sel.dataset.id;
      const btn = document.querySelector(`.buy-btn[data-id="${id}"]`);
      btn.disabled = !sel.value || balance < +btn.dataset.price;
    };
  });

  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!isLoggedIn()) { location.href = './login.html'; return; }
      const sel = document.querySelector(`.point-select[data-id="${btn.dataset.id}"]`);
      const pointId = +sel.value;
      if (!pointId) { alert('Выберите точку выдачи'); return; }
      const res = await api('/api/buy', {
        method: 'POST',
        body: JSON.stringify({ productId: +btn.dataset.id, pointId })
      });
      if (res.ok) { alert('Куплено! Заберите на выбранной точке.'); load(); }
      else { alert(res.error); }
    };
  });

  const orders = await api('/api/my-orders');
  document.getElementById('my-orders').innerHTML = orders.length
    ? orders.map(o => `<li><span>${o.name}${o.point_name ? ` · ${o.point_name}` : ''}</span><em>${o.status}</em></li>`).join('')
    : '<li>Пока нет заказов</li>';
}

load();