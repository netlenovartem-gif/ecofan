const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'ecofan-secret-key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'docs')));

// --- Запись активности ---
function logActivity(userId, type, description) {
  try {
    db.prepare('INSERT INTO activity (user_id, type, description) VALUES (?, ?, ?)')
      .run(userId, type, description);
  } catch (e) { /* игнорируем */ }
}

// --- Очистка прошедших мероприятий ---
function cleanupEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const old = db.prepare('SELECT id FROM events WHERE date < ?').all(today);
  old.forEach(e => {
    db.prepare('DELETE FROM event_signups WHERE event_id = ?').run(e.id);
    db.prepare('DELETE FROM events WHERE id = ?').run(e.id);
  });
  if (old.length > 0) {
    console.log(`Удалено устаревших мероприятий: ${old.length}`);
  }
}

cleanupEvents();
setInterval(cleanupEvents, 60 * 60 * 1000);

// --- Регистрация ---
app.post('/api/register', (req, res) => {
  const { phone, name, password } = req.body;
  if (!phone || !name || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (exists) return res.status(400).json({ error: 'Такой телефон уже есть' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (phone, name, password) VALUES (?, ?, ?)'
  ).run(phone, name, hash);

  logActivity(result.lastInsertRowid, 'register', 'Регистрация в системе');

  const token = jwt.sign({ id: result.lastInsertRowid }, SECRET);
  res.json({ token, name, role: 'user', id: result.lastInsertRowid });
});

// --- Вход ---
app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: 'Неверный пароль' });
  }
  const token = jwt.sign({ id: user.id }, SECRET);
  res.json({ token, name: user.name, role: user.role, id: user.id });
});

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Нужен вход' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Плохой токен' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.role !== role) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    next();
  };
}

app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// --- Профиль ---
app.get('/api/profile', auth, (req, res) => {
  const user = db.prepare(
    'SELECT id, phone, name, role, points, level, total_kg, streak FROM users WHERE id = ?'
  ).get(req.user.id);
  const deliveries = db.prepare(
    'SELECT type, weight, points, created_at FROM deliveries WHERE user_id = ? ORDER BY id DESC LIMIT 10'
  ).all(req.user.id);
  const orders = db.prepare(`
    SELECT o.id, p.name, o.status, o.created_at, pt.name as point_name
    FROM orders o
    JOIN products p ON p.id = o.product_id
    LEFT JOIN points pt ON pt.id = o.point_id
    WHERE o.user_id = ? ORDER BY o.id DESC
  `).all(req.user.id);
  res.json({ user, deliveries, orders });
});

app.post('/api/profile/update', auth, (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Заполните имя и телефон' });

  const exists = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, req.user.id);
  if (exists) return res.status(400).json({ error: 'Такой телефон уже занят' });

  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.user.id);
  logActivity(req.user.id, 'profile', `Изменены данные профиля: имя «${name}», телефон «${phone}»`);
  res.json({ ok: true });
});

app.post('/api/profile/password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({ error: 'Старый пароль неверный' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// --- Точки, тарифы, товары ---
app.get('/api/points', (req, res) => {
  res.json(db.prepare('SELECT * FROM points').all());
});

app.get('/api/tariffs', (req, res) => {
  res.json(db.prepare('SELECT * FROM tariffs').all());
});

app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products').all());
});

app.get('/api/find-user', auth, requireRole('receiver'), (req, res) => {
  const q = req.query.q || '';
  if (q.length < 2) return res.json([]);
  const users = db.prepare(
    `SELECT id, name, phone FROM users
     WHERE (name LIKE ? OR phone LIKE ?) AND role = 'user'
     LIMIT 10`
  ).all(`%${q}%`, `%${q}%`);
  res.json(users);
});

// --- Начисление баллов ---
app.post('/api/deliver', auth, requireRole('receiver'), (req, res) => {
  const { userId, pointId, type, weight } = req.body;
  const tariff = db.prepare('SELECT points_per_kg FROM tariffs WHERE type = ?').get(type);
  if (!tariff) return res.status(400).json({ error: 'Нет такого тарифа' });

  const points = Math.round(tariff.points_per_kg * weight);
  db.prepare(
    'INSERT INTO deliveries (user_id, point_id, type, weight, points) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, pointId, type, weight, points);

  const user = db.prepare(
    'SELECT total_kg, points, streak, last_delivery FROM users WHERE id = ?'
  ).get(userId);
  if (!user) return res.status(400).json({ error: 'Пользователь не найден' });

  const today = new Date().toISOString().slice(0, 10);
  let streak = user.streak;
  if (user.last_delivery !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = user.last_delivery === yesterday ? user.streak + 1 : 1;
  }

  let multiplier = 1;
  if (streak >= 7) multiplier = 1.2;
  const finalPoints = Math.round(points * multiplier);
  const newTotalKg = user.total_kg + weight;
  const newPoints = user.points + finalPoints;

  let level = 'Новичок';
  if (newPoints >= 5000) level = 'Легенда';
  else if (newPoints >= 2000) level = 'Мастер';
  else if (newPoints >= 800) level = 'Ветеран';
  else if (newPoints >= 200) level = 'Опытный';

  db.prepare(
    'UPDATE users SET points = ?, total_kg = ?, streak = ?, last_delivery = ?, level = ? WHERE id = ?'
  ).run(newPoints, newTotalKg, streak, today, level, userId);

  logActivity(userId, 'delivery', `Сдано ${weight} кг ${type}, начислено ${finalPoints} баллов`);

  res.json({ points: finalPoints, multiplier, total: newPoints, level });
});

// --- Покупка ---
app.post('/api/buy', auth, (req, res) => {
  const { productId, pointId } = req.body;
  if (!pointId) return res.status(400).json({ error: 'Выберите точку выдачи' });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(400).json({ error: 'Товар не найден' });

  const user = db.prepare('SELECT points FROM users WHERE id = ?').get(req.user.id);
  if (user.points < product.price) return res.status(400).json({ error: 'Не хватает баллов' });

  db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(product.price, req.user.id);
  db.prepare('INSERT INTO orders (user_id, product_id, point_id) VALUES (?, ?, ?)').run(req.user.id, productId, pointId);
  logActivity(req.user.id, 'purchase', `Куплено «${product.name}» за ${product.price} баллов`);
  res.json({ ok: true, spent: product.price });
});

app.get('/api/my-orders', auth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.id, p.name, o.status, o.created_at, pt.name as point_name
    FROM orders o
    JOIN products p ON p.id = o.product_id
    LEFT JOIN points pt ON pt.id = o.point_id
    WHERE o.user_id = ? ORDER BY o.id DESC
  `).all(req.user.id);
  res.json(orders);
});

app.get('/api/point-orders', auth, requireRole('receiver'), (req, res) => {
  const orders = db.prepare(`
    SELECT o.id, o.status, o.created_at, p.name as product_name, u.name as user_name, u.phone, pt.name as point_name
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN users u ON u.id = o.user_id
    LEFT JOIN points pt ON pt.id = o.point_id
    WHERE o.status IN ('в пути', 'готов к выдаче')
    ORDER BY o.id DESC
  `).all();
  res.json(orders);
});

app.post('/api/point-orders/:id/status', auth, requireRole('receiver'), (req, res) => {
  const { status } = req.body;
  if (!['готов к выдаче', 'выдан'].includes(status)) {
    return res.status(400).json({ error: 'Неверный статус' });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, +req.params.id);
  res.json({ ok: true });
});

// --- Лента ---
app.get('/api/posts', (req, res) => {
  const posts = db.prepare(`
    SELECT p.id, p.text, p.created_at, p.user_id, u.name,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments
    FROM posts p JOIN users u ON u.id = p.user_id
    ORDER BY p.id DESC
  `).all();
  res.json(posts);
});

app.post('/api/posts', auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Пустой пост' });
  db.prepare('INSERT INTO posts (user_id, text) VALUES (?, ?)').run(req.user.id, text);
  res.json({ ok: true });
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(+req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });

  const me = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (post.user_id !== req.user.id && me.role !== 'admin') {
    return res.status(403).json({ error: 'Нет прав' });
  }

  db.prepare('DELETE FROM comments WHERE post_id = ?').run(+req.params.id);
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(+req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(+req.params.id);
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const postId = +req.params.id;
  const exists = db.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?').get(postId, req.user.id);
  if (exists) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(postId, req.user.id);
    res.json({ liked: false });
  } else {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(postId, req.user.id);
    res.json({ liked: true });
  }
});

app.get('/api/posts/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT c.id, c.text, c.created_at, c.user_id, u.name
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.id ASC
  `).all(+req.params.id);
  res.json(comments);
});

app.post('/api/posts/:id/comment', auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Пустой комментарий' });
  db.prepare('INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)').run(+req.params.id, req.user.id, text);
  res.json({ ok: true });
});

app.delete('/api/comments/:id', auth, (req, res) => {
  const comment = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(+req.params.id);
  if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

  const me = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (comment.user_id !== req.user.id && me.role !== 'admin') {
    return res.status(403).json({ error: 'Нет прав' });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(+req.params.id);
  res.json({ ok: true });
});

// --- Мероприятия ---
app.get('/api/events', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  let userId = 0;
  if (token) {
    try { userId = jwt.verify(token, SECRET).id; } catch {}
  }
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_signups WHERE event_id = e.id AND user_id = ?) as signed
    FROM events e ORDER BY e.date ASC
  `).all(userId);
  res.json(events);
});

app.get('/api/events/my', auth, (req, res) => {
  const events = db.prepare(`
    SELECT e.id, e.title, e.date, e.place
    FROM event_signups s JOIN events e ON e.id = s.event_id
    WHERE s.user_id = ? ORDER BY e.date
  `).all(req.user.id);
  res.json(events);
});

app.post('/api/events/:id/signup', auth, (req, res) => {
  const eventId = +req.params.id;
  const exists = db.prepare('SELECT id FROM event_signups WHERE event_id = ? AND user_id = ?').get(eventId, req.user.id);
  if (exists) return res.status(400).json({ error: 'Вы уже записаны' });
  db.prepare('INSERT INTO event_signups (event_id, user_id) VALUES (?, ?)').run(eventId, req.user.id);

  const event = db.prepare('SELECT title FROM events WHERE id = ?').get(eventId);
  logActivity(req.user.id, 'event', `Запись на «${event.title}»`);

  res.json({ ok: true });
});

// --- Админ: пользователи ---
app.get('/api/admin/users', auth, requireRole('admin'), (req, res) => {
  res.json(db.prepare('SELECT id, phone, name, role, points FROM users').all());
});

app.post('/api/admin/role', auth, requireRole('admin'), (req, res) => {
  const { userId, role } = req.body;
  if (!['user', 'receiver', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Неверная роль' });
  }

  const target = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
  const roleNames = { user: 'Пользователь', receiver: 'Приёмщик', admin: 'Администратор' };

  db.prepare('DELETE FROM deliveries WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM orders WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM event_signups WHERE user_id = ?').run(userId);

  db.prepare(`
    UPDATE users
    SET role = ?, points = 0, level = 'Новичок', total_kg = 0, streak = 0, last_delivery = NULL
    WHERE id = ?
  `).run(role, userId);

  logActivity(
    req.user.id,
    'role',
    `Сменил роль пользователю «${target?.name || '—'}» на «${roleNames[role]}»`
  );

  res.json({ ok: true });
});

app.delete('/api/admin/user/:id', auth, requireRole('admin'), (req, res) => {
  const id = +req.params.id;
  db.prepare('DELETE FROM deliveries WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM orders WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM posts WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM comments WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM likes WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM event_signups WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- Админ: товары ---
app.post('/api/admin/product', auth, requireRole('admin'), (req, res) => {
  const { name, price, category, badge } = req.body;
  db.prepare('INSERT INTO products (name, price, category, badge) VALUES (?, ?, ?, ?)')
    .run(name, price, category || 'middle', badge || null);
  res.json({ ok: true });
});

app.delete('/api/admin/product/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(+req.params.id);
  res.json({ ok: true });
});

// --- Админ: точки ---
app.post('/api/admin/point', auth, requireRole('admin'), (req, res) => {
  const { name, address, lat, lng, hours, accepts } = req.body;
  db.prepare('INSERT INTO points (name, address, lat, lng, hours, accepts) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, address, +lat, +lng, hours || '24/7', accepts || 'всё вторсырьё');
  res.json({ ok: true });
});

app.delete('/api/admin/point/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM points WHERE id = ?').run(+req.params.id);
  res.json({ ok: true });
});

// --- Админ: мероприятия ---
app.get('/api/admin/events', auth, requireRole('admin'), (req, res) => {
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_signups WHERE event_id = e.id) as signups
    FROM events e ORDER BY e.date ASC
  `).all();
  res.json(events);
});

app.post('/api/admin/event', auth, requireRole('admin'), (req, res) => {
  const { title, description, place, date } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Заполните название и дату' });

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    return res.status(400).json({ error: 'Дата не может быть в прошлом' });
  }

  db.prepare('INSERT INTO events (title, description, place, date) VALUES (?, ?, ?, ?)')
    .run(title, description || '', place || '', date);
  res.json({ ok: true });
});

app.delete('/api/admin/event/:id', auth, requireRole('admin'), (req, res) => {
  const id = +req.params.id;
  db.prepare('DELETE FROM event_signups WHERE event_id = ?').run(id);
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
  res.json({ ok: true });
});

// --- Админ: активность ---
app.get('/api/admin/activity', auth, requireRole('admin'), (req, res) => {
  const list = db.prepare(`
    SELECT a.id, a.type, a.description, a.created_at, u.name
    FROM activity a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 200
  `).all();
  res.json(list);
});

// --- Публичный отчёт по сданному мусору ---
app.get('/api/report', (req, res) => {
  const { period } = req.query;
  let dateCondition = '';
  const now = new Date();

  if (period === 'day') {
    const today = now.toISOString().slice(0, 10);
    dateCondition = `AND date(created_at) = '${today}'`;
  } else if (period === 'month') {
    const month = now.toISOString().slice(0, 7);
    dateCondition = `AND strftime('%Y-%m', created_at) = '${month}'`;
  } else if (period === 'year') {
    const year = now.toISOString().slice(0, 4);
    dateCondition = `AND strftime('%Y', created_at) = '${year}'`;
  }

  const report = db.prepare(`
    SELECT type, SUM(weight) as total_weight, COUNT(*) as total_deliveries
    FROM deliveries
    WHERE 1=1 ${dateCondition}
    GROUP BY type
    ORDER BY total_weight DESC
  `).all();

  const totalStats = db.prepare(`
    SELECT COALESCE(SUM(weight), 0) as total_kg,
           COALESCE(COUNT(*), 0) as total_count
    FROM deliveries
    WHERE 1=1 ${dateCondition}
  `).get();

  res.json({ report, totalStats });
});

app.listen(PORT, () => {
  console.log(`ЭкоФан запущен: http://localhost:${PORT}`);
});