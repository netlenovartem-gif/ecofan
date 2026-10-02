const API_BASE = '';

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function myId() {
  return +localStorage.getItem('userId') || 0;
}

function isAdmin() {
  return localStorage.getItem('role') === 'admin';
}

function homeLink() {
  if (!isLoggedIn()) return '/';
  const role = localStorage.getItem('role');
  if (role === 'receiver') return '/receiver.html';
  if (role === 'admin') return '/admin.html';
  return '/feed.html';
}

function setupLogo() {
  const logo = document.getElementById('logo');
  if (logo) logo.href = homeLink();
}

async function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  if (!isLoggedIn()) {
    nav.innerHTML = `
      <a href="/map.html">Карта</a>
      <a href="/login.html">Войти</a>
    `;
    return;
  }

  const me = await api('/api/me');
  if (!me || me.error) {
    localStorage.clear();
    location.href = '/';
    return;
  }

  if (me.role === 'receiver') {
    nav.innerHTML = `
      <a href="/receiver.html">Приёмка</a>
      <a href="/feed.html">Лента</a>
      <a href="/report.html"> Отчёт</a>
      <a href="/profile.html">Профиль</a>
      <a href="#" id="logout">Выйти</a>
    `;
  } else if (me.role === 'admin') {
    nav.innerHTML = `
      <a href="/admin.html">Админ-панель</a>
      <a href="/feed.html">Лента</a>
      <a href="/report.html"> Отчёт</a>
      <a href="/activity.html">Активность</a>
      <a href="/profile.html">Профиль</a>
      <a href="#" id="logout">Выйти</a>
    `;
  } else {
    nav.innerHTML = `
      <a href="/map.html">Карта</a>
      <a href="/feed.html">Лента</a>
      <a href="/report.html"> Отчёт</a>
      <a href="/events.html">Мероприятия</a>
      <a href="/shop.html">Магазин</a>
      <a href="/profile.html">Профиль</a>
      <a href="#" id="logout">Выйти</a>
    `;
  }

  const logout = document.getElementById('logout');
  if (logout) {
    logout.onclick = (e) => {
      e.preventDefault();
      localStorage.clear();
      location.href = '/';
    };
  }
}

async function api(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + url, { ...options, headers });
  return res.json();
}

function initPage() {
  setupLogo();
  renderNav();
}