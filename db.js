const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('ecoidea.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    name TEXT,
    password TEXT,
    role TEXT DEFAULT 'user',
    points INTEGER DEFAULT 0,
    level TEXT DEFAULT 'Новичок',
    total_kg REAL DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_delivery TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    hours TEXT,
    accepts TEXT
  );

  CREATE TABLE IF NOT EXISTS tariffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    points_per_kg INTEGER
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    point_id INTEGER,
    type TEXT,
    weight REAL,
    points INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price INTEGER,
    category TEXT,
    badge TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_id INTEGER,
    point_id INTEGER,
    status TEXT DEFAULT 'в пути',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    UNIQUE(post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    place TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS event_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    user_id INTEGER,
    UNIQUE(event_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const pointsCount = db.prepare('SELECT COUNT(*) as c FROM points').get().c;

if (pointsCount === 0) {
  const insertPoint = db.prepare(
    'INSERT INTO points (name, address, lat, lng, hours, accepts) VALUES (?, ?, ?, ?, ?, ?)'
  );

  insertPoint.run('Экопункт на Карла Маркса', 'ул. Карла Маркса, 7б, Нижний Новгород', 56.344853, 43.926532, '24/7', 'картон, бумага, алюминий, бутылки, батарейки');
  insertPoint.run('Экопункт на Дьяконова', 'ул. Дьяконова, 20, Нижний Новгород', 56.260468, 43.880716, '24/7', 'пластик, стекло, бумага');
  insertPoint.run('Экопункт на Южном шоссе', 'ул. Южное шоссе, 22б, Нижний Новгород', 56.223706, 43.861304, '24/7', 'всё вторсырьё');
  insertPoint.run('Экопункт на Казанском шоссе', 'Казанское шоссе, 10к5, Нижний Новгород', 56.286677, 44.077816, '24/7', 'пластик, алюминий, стекло');
  insertPoint.run('Экопункт на Коминтерна', 'ул. Коминтерна, 6/1, Нижний Новгород', 56.337870, 43.882513, '24/7', 'бумага, картон, батарейки');
  insertPoint.run('Экопункт на Московском шоссе', 'Московское шоссе, 11, Нижний Новгород', 56.323558, 43.942073, '24/7', 'всё вторсырьё');
  insertPoint.run('Экопункт на Родионова', 'ул. Родионова, 15, Нижний Новгород', 56.319864, 44.051756, 'ежедневно, круглосуточно', 'всё вторсырьё');

  const insertTariff = db.prepare('INSERT INTO tariffs (type, points_per_kg) VALUES (?, ?)');
  insertTariff.run('пластик', 30);
  insertTariff.run('стекло', 10);
  insertTariff.run('бумага', 15);
  insertTariff.run('алюминий', 50);
  insertTariff.run('прочее', 5);

  const insertProduct = db.prepare(
    'INSERT INTO products (name, price, category, badge) VALUES (?, ?, ?, ?)'
  );
  insertProduct.run('Купон 100 ₽ в продуктовом', 100, 'coupon', null);
  insertProduct.run('Купон 300 ₽ в продуктовом', 280, 'coupon', null);
  insertProduct.run('Термокружка', 500, 'middle', null);
  insertProduct.run('Складная удочка', 800, 'middle', null);
  insertProduct.run('Рюкзак из переработки', 1500, 'top', 'сделан из 12 бутылок');
  insertProduct.run('Худи из переработки', 2000, 'top', 'сделано из 20 бутылок');
  insertProduct.run('Куртка из переработки', 3500, 'top', 'сделана из 40 бутылок');
  insertProduct.run('Шоппер из переработки', 400, 'top', 'сделан из 5 бутылок');

  const insertEvent = db.prepare(
    'INSERT INTO events (title, description, place, date) VALUES (?, ?, ?, ?)'
  );
  insertEvent.run('Субботник в парке Швейцария', 'Собираем мусор, баллы ×2', 'парк Швейцария', '2026-10-15');
  insertEvent.run('Чистка берега Оки', 'Уборка берега, баллы ×2', 'набережная Оки', '2026-10-22');
  insertEvent.run('Эко-лекция в Экоториуме', 'Лекция о переработке', 'Экоториум', '2026-10-01');
}

const testAccounts = [
  { phone: '+70000000001', name: 'Иван Пользователь', password: 'user123', role: 'user' },
  { phone: '+70000000002', name: 'Пётр Приёмщик', password: 'receiver123', role: 'receiver' },
  { phone: '+70000000003', name: 'Анна Админ', password: 'admin123', role: 'admin' }
];

testAccounts.forEach(acc => {
  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(acc.phone);
  if (!exists) {
    const hash = bcrypt.hashSync(acc.password, 10);
    db.prepare(
      'INSERT INTO users (phone, name, password, role) VALUES (?, ?, ?, ?)'
    ).run(acc.phone, acc.name, hash, acc.role);
  }
});

console.log('Встроенные аккаунты:');
console.log('  Пользователь: +70000000001 / user123');
console.log('  Приёмщик:     +70000000002 / receiver123');
console.log('  Админ:        +70000000003 / admin123');

module.exports = db;