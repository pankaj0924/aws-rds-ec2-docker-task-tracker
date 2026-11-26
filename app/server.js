const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.urlencoded({ extended: false }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'taskdb',
  connectionLimit: 5,
  connectTimeout: 10000
});

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function initDb() {
  for (let i = 1; i <= 10; i++) {
    try {
      await pool.query(
        'CREATE TABLE IF NOT EXISTS tasks (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
      );
      console.log('Database ready');
      return;
    } catch (err) {
      console.error('DB init attempt ' + i + ' failed: ' + (err.code || err.message));
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  console.error('Could not reach the database');
}

app.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, title FROM tasks ORDER BY id DESC');
    const items = rows.map(r =>
      '<li>' + esc(r.title) +
      ' <form method="post" action="/delete/' + r.id + '" style="display:inline"><button>Delete</button></form></li>'
    ).join('');
    res.send(
      '<!doctype html><html><head><title>Task Tracker</title></head>' +
      '<body style="font-family:sans-serif;max-width:480px;margin:40px auto">' +
      '<h1>Task Tracker</h1>' +
      '<form method="post" action="/add"><input name="title" placeholder="New task" required maxlength="255"> <button>Add</button></form>' +
      '<ul>' + items + '</ul></body></html>'
    );
  } catch (err) {
    console.error(err.code || err.message);
    res.status(500).send('Database error');
  }
});

app.post('/add', async (req, res) => {
  try {
    const title = (req.body.title || '').trim();
    if (title) await pool.query('INSERT INTO tasks (title) VALUES (?)', [title]);
    res.redirect('/');
  } catch (err) {
    console.error(err.code || err.message);
    res.status(500).send('Database error');
  }
});

app.post('/delete/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.redirect('/');
  } catch (err) {
    console.error(err.code || err.message);
    res.status(500).send('Database error');
  }
});

app.get('/health', (req, res) => res.send('ok'));

initDb();
app.listen(3000, () => console.log('Server running on port 3000'));
