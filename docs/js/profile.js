if (!isLoggedIn()) location.href = './login.html';
initPage();

const roleNames = {
  user: 'Пользователь',
  receiver: 'Приёмщик',
  admin: 'Администратор'
};

api('/api/profile').then(data => {
  if (data.error) { location.href = './login.html'; return; }

  document.getElementById('hello').textContent = `Привет, ${data.user.name}!`;
  document.getElementById('role').textContent = roleNames[data.user.role] || data.user.role;

  document.getElementById('profile-name').value = data.user.name;
  document.getElementById('profile-phone').value = data.user.phone;

  const isUser = data.user.role === 'user';
  document.getElementById('user-stats').classList.toggle('hidden', !isUser);
  document.getElementById('user-deliveries').classList.toggle('hidden', !isUser);
  document.getElementById('user-orders').classList.toggle('hidden', !isUser);

  if (!isUser) return;

  document.getElementById('points').textContent = data.user.points;
  document.getElementById('level').textContent = data.user.level;
  document.getElementById('kg').textContent = data.user.total_kg.toFixed(1);
  document.getElementById('streak').textContent = data.user.streak;

  document.getElementById('deliveries').innerHTML = data.deliveries.length
    ? data.deliveries.map(d =>
        `<li><span>${d.type} — ${d.weight} кг</span><strong>+${d.points} баллов</strong></li>`
      ).join('')
    : '<li>Пока пусто</li>';

  document.getElementById('orders').innerHTML = data.orders.length
    ? data.orders.map(o =>
        `<li><span>${o.name}${o.point_name ? ` · ${o.point_name}` : ''}</span><em>${o.status}</em></li>`
      ).join('')
    : '<li>Пока пусто</li>';
});

document.getElementById('profile-form').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await api('/api/profile/update', { method: 'POST', body: JSON.stringify(data) });
  if (res.ok) {
    localStorage.setItem('name', data.name);
    alert('Профиль обновлён');
    location.reload();
  } else {
    alert(res.error);
  }
};

document.getElementById('password-form').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await api('/api/profile/password', { method: 'POST', body: JSON.stringify(data) });
  if (res.ok) { alert('Пароль изменён'); e.target.reset(); }
  else alert(res.error);
};