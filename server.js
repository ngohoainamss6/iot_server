const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  user: 'iot_database_uhsn_wxop_user',
  host: 'dpg-d4r9l5ogjchc73bomesg-a',
  database: 'iot_database_uhsn_wxop',
  password: 'ef4xs9jYCrceOnMJOkZ7KdLdDR6v2sXr',
  port: 5432,
});

// ================= INIT TABLES =================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_data (
      id SERIAL PRIMARY KEY,
      soil INT, temp FLOAT, hum FLOAT, flow INT,
      time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_status (
      id SERIAL PRIMARY KEY,
      mode VARCHAR(20) DEFAULT 'AUTO',
      pump BOOLEAN DEFAULT FALSE,
      pump_power INT DEFAULT 36,
      schedules JSON DEFAULT '[]',
      time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS command_queue (
      id SERIAL PRIMARY KEY,
      command TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ Database ready");
}
initDB();

// ================= API: ESP gửi dữ liệu =================
app.post('/api/save', async (req, res) => {
  const { soil, temp, hum, flow, mode, pump_power } = req.body;
  try {
    await pool.query(
      'INSERT INTO sensor_data (soil,temp,hum,flow) VALUES ($1,$2,$3,$4)',
      [soil, temp, hum, flow]
    );
    await pool.query(
      'INSERT INTO system_status (mode,pump,pump_power) VALUES ($1,$2,$3)',
      [mode || 'AUTO', flow > 0, pump_power ?? 36]
    );
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error' });
  }
});

// ================= API: lấy dữ liệu =================
app.get('/api/data', async (_, res) => {
  const r = await pool.query('SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1');
  res.json(r.rows[0] || {});
});
app.get('/api/status', async (_, res) => {
  const r = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
  res.json(r.rows[0] || {});
});

// ================= API: điều khiển riêng biệt =================
app.post('/api/pump', async (req, res) => {
  const { state } = req.body;
  try {
    await pool.query('INSERT INTO command_queue (command) VALUES ($1)', [state ? 'PUMP:ON;' : 'PUMP:OFF;']);
    await pool.query('INSERT INTO system_status (pump) VALUES ($1)', [state]);
    res.json({ status: 'success' });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/mode', async (req, res) => {
  const { mode } = req.body;
  try {
    await pool.query('INSERT INTO command_queue (command) VALUES ($1)', [`MODE:${mode};`]);
    await pool.query('INSERT INTO system_status (mode) VALUES ($1)', [mode]);
    res.json({ status: 'success' });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/power', async (req, res) => {
  const { power } = req.body;
  try {
    await pool.query('INSERT INTO command_queue (command) VALUES ($1)', [`POWER:${power};`]);
    await pool.query('INSERT INTO system_status (pump_power) VALUES ($1)', [power]);
    res.json({ status: 'success' });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/schedule/add', async (req, res) => {
  const { hour, minute } = req.body;
  try {
    const status = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
    let schedules = status.rows[0]?.schedules || [];
    schedules.push({ hour, minute });
    await pool.query('INSERT INTO command_queue (command) VALUES ($1)', [`ADD_SCHEDULE:${hour}:${minute};`]);
    await pool.query('INSERT INTO system_status (schedules) VALUES ($1)', [JSON.stringify(schedules)]);
    res.json({ status: 'success' });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/schedule/remove', async (req, res) => {
  const { index } = req.body;
  try {
    const status = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
    let schedules = status.rows[0]?.schedules || [];
    if (index >= 0 && index < schedules.length) schedules.splice(index, 1);
    await pool.query('INSERT INTO command_queue (command) VALUES ($1)', ['REMOVE_SCHEDULE;']);
    await pool.query('INSERT INTO system_status (schedules) VALUES ($1)', [JSON.stringify(schedules)]);
    res.json({ status: 'success' });
  } catch (err) { res.status(500).json({ status: 'error' }); }
});

// ================= API: ESP lấy lệnh mới nhất =================
app.get('/api/command', async (_, res) => {
  const r = await pool.query('SELECT * FROM command_queue ORDER BY id DESC LIMIT 1');
  res.send(r.rows[0]?.command || '');
});

// ================= RUN =================
app.listen(process.env.PORT || 3000, () => console.log("🚀 Server running on port 3000"));
