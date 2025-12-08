const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// ================= PostgreSQL =================
const pool = new Pool({
    user: 'iot_database_uhsn_wxop_user',                      // User Render
    host: 'dpg-d4r9l5ogjchc73bomesg-a',       // Host Render
    database: 'iot_database_uhsn_wxop',         // DB Name
    password: 'ef4xs9jYCrceOnMJOkZ7KdLdDR6v2sXr',             // Password Render
    port: 5432,
});

// ================= Khởi tạo bảng nếu chưa có =================
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sensor_data (
            id SERIAL PRIMARY KEY,
            soil INT,
            temp FLOAT,
            hum FLOAT,
            flow INT,
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS system_status (
            id SERIAL PRIMARY KEY,
            mode VARCHAR(20) DEFAULT 'AUTO',
            pump BOOLEAN DEFAULT FALSE,
            min_val INT DEFAULT 30,
            max_val INT DEFAULT 70,
            next_time INT DEFAULT 0,
            last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const res = await pool.query('SELECT COUNT(*) FROM system_status');
    if (parseInt(res.rows[0].count) === 0) {
        await pool.query('INSERT INTO system_status (mode, pump) VALUES ($1,$2)', ['AUTO', false]);
        console.log("✅ Thêm row mặc định cho system_status");
    }
}

initDB().then(() => console.log("✅ Database ready"))
        .catch(err => console.error("❌ DB init error:", err));

// ================= API nhận dữ liệu từ ESP =================
app.post('/api/save', async (req, res) => {
    const { soil, temp, hum, flow, mode, min, max, next } = req.body;
    try {
        await pool.query(
            'INSERT INTO sensor_data (soil, temp, hum, flow) VALUES ($1,$2,$3,$4)',
            [soil, temp, hum, flow]
        );

        await pool.query(
            'UPDATE system_status SET mode=$1, min_val=$2, max_val=$3, next_time=$4, last_update=NOW() WHERE id=(SELECT id FROM system_status ORDER BY id DESC LIMIT 1)',
            [mode, min, max, next]
        );

        res.json({ status: 'success' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API trả trạng thái =================
app.get('/api/status', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API điều khiển từ UI =================
app.post('/api/control', async (req, res) => {
    const { pump, mode } = req.body;
    try {
        await pool.query(
            'UPDATE system_status SET pump=$1, mode=$2, last_update=NOW() WHERE id=(SELECT id FROM system_status ORDER BY id DESC LIMIT 1)',
            [pump, mode]
        );
        res.json({ status: 'success' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= RUN SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
