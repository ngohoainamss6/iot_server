const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ================= PostgreSQL =================
const pool = new Pool({
    user: 'iot_database_uhsn_wxop_user',              
    host: 'dpg-d4r9l5ogjchc73bomesg-a',       
    database: 'iot_database_uhsn_wxop',        
    password: 'ef4xs9jYCrceOnMJOkZ7KdLdDR6v2sXr',            
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

    console.log("✅ Database ready");
}

initDB().catch(err => console.error("❌ DB init error:", err));

// ================= API nhận dữ liệu từ ESP =================
app.post('/api/save', async (req, res) => {
    const { soil, temp, hum, flow, mode, min, max, next } = req.body;
    try {
        // Lưu sensor_data
        await pool.query(
            'INSERT INTO sensor_data (soil, temp, hum, flow) VALUES ($1,$2,$3,$4)',
            [soil, temp, hum, flow]
        );

        // Lưu trạng thái mới vào system_status (INSERT mỗi lần)
        await pool.query(
            'INSERT INTO system_status (mode, pump, min_val, max_val, next_time, last_update) VALUES ($1,$2,$3,$4,$5,NOW())',
            [mode, flow > 0, min, max, next]
        );

        res.json({ status: 'success' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API trả trạng thái mới nhất =================
app.get('/api/status', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_status ORDER BY last_update DESC LIMIT 1');
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API lấy toàn bộ lịch sử system_status =================
app.get('/api/status/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_status ORDER BY last_update DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API lệnh cho ESP =================
app.get('/api/command', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_status ORDER BY last_update DESC LIMIT 1');
        const status = result.rows[0];
        let cmd = '';
        cmd += status.pump ? 'PUMP:ON;' : 'PUMP:OFF;';
        cmd += 'MODE:' + status.mode + ';';
        res.send(cmd);
    } catch (err) {
        console.error(err);
        res.status(500).send('ERROR');
    }
});

// ================= API điều khiển từ UI =================
app.post('/api/control', async (req, res) => {
    const { pump, mode } = req.body;
    try {
        // INSERT trạng thái mới vào system_status
        await pool.query(
            'INSERT INTO system_status (pump, mode, last_update) VALUES ($1,$2,NOW())',
            [pump, mode]
        );
        res.json({ status: 'success' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API lấy dữ liệu sensor =================
app.get('/api/data', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API lấy lịch sử sensor_data =================
app.get('/api/data/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sensor_data ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= RUN SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
