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

// ================= Khởi tạo bảng =================
async function initDB() {
    await pool.query(`CREATE TABLE IF NOT EXISTS sensor_data (
        id SERIAL PRIMARY KEY,
        soil INT, temp FLOAT, hum FLOAT, flow INT,
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS system_status (
        id SERIAL PRIMARY KEY,
        mode VARCHAR(20) DEFAULT 'AUTO',
        pump BOOLEAN DEFAULT FALSE,
        pump_power INT DEFAULT 36,
        schedules JSON DEFAULT '[]',
        updated BOOLEAN DEFAULT FALSE,
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`);
    console.log("✅ DB ready");
}
initDB().catch(console.error);

// ================= ESP gửi dữ liệu =================
app.post('/api/save', async (req,res)=>{
    const { soil,temp,hum,flow } = req.body;
    try{
        await pool.query('INSERT INTO sensor_data (soil,temp,hum,flow) VALUES ($1,$2,$3,$4)',
            [soil,temp,hum,flow]);
        res.json({status:'ok'});
    }catch(e){ console.error(e); res.status(500).json({status:'error'});}
});

// ================= ESP fetch lệnh =================
app.get('/api/command', async (req,res)=>{
    try{
        const r = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
        const s = r.rows[0];
        if(!s || !s.updated) return res.send('');
        let cmd = `PUMP:${s.pump?'ON':'OFF'};MODE:${s.mode};POWER:${s.pump_power};SCHEDULES:${JSON.stringify(s.schedules)}`;
        await pool.query('UPDATE system_status SET updated=false WHERE id=$1',[s.id]);
        res.send(cmd);
    }catch(e){ console.error(e); res.status(500).send('ERROR');}
});

// ================= UI điều khiển =================
app.post('/api/control', async (req,res)=>{
    const { mode, pump, pump_power, schedules } = req.body;
    try{
        await pool.query(
            `INSERT INTO system_status (mode,pump,pump_power,schedules,updated)
             VALUES ($1,$2,$3,$4,true)`,
            [mode, pump, pump_power ?? 36, schedules ?? []]
        );
        res.json({status:'ok'});
    }catch(e){ console.error(e); res.status(500).json({status:'error'});}
});

// ================= API lấy trạng thái (UI) =================
app.get('/api/status', async (req,res)=>{
    try{
        const r = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
        res.json(r.rows[0] || {});
    }catch(e){ console.error(e); res.status(500).json({});}
});

app.get('/api/data', async (req,res)=>{
    try{
        const r = await pool.query('SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1');
        res.json(r.rows[0] || {});
    }catch(e){ console.error(e); res.status(500).json({});}
});

// ================= RUN =================
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`🚀 Server running on port ${PORT}`));
