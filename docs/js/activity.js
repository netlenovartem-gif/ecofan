initPage();

function formatMoscow(dateStr) {
  const utc = new Date(dateStr.replace(' ', 'T') + 'Z');
  return utc.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const typeLabels = {
  register: 'Регистрация',
  delivery: 'Сдача сырья',
  purchase: 'Покупка',
  event: 'Мероприятие',
  profile: 'Профиль',
  role: 'Роль'
};

async function load() {
  const list = await api('/api/admin/activity');
  document.getElementById('activity').innerHTML = list.length
    ? list.map(a => `
        <li>
          <span>
            <strong>${typeLabels[a.type] || a.type}</strong> · ${a.name || '—'}<br>
            ${a.description}
          </span>
          <em>${formatMoscow(a.created_at)}</em>
        </li>
      `).join('')
    : '<li>Пока пусто</li>';
}

load();