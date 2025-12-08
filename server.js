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
            pump_power INT DEFAULT 36,
            schedules JSON DEFAULT '[]',
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS command_queue (
            id SERIAL PRIMARY KEY,
            pump BOOLEAN,
            mode VARCHAR(20),
            pump_power INT,
            schedules JSON,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("✅ DB ready");
}
initDB().catch(err => console.error("❌ DB init error:", err));

// ================= API nhận dữ liệu từ ESP =================
app.post('/api/save', async (req, res) => {
    const { soil, temp, hum, flow, mode, min, max, next, pump_power, schedule } = req.body;
    try {
        await pool.query(
            'INSERT INTO sensor_data (soil,temp,hum,flow) VALUES ($1,$2,$3,$4)',
            [soil, temp, hum, flow]
        );

        let scheduleData = [];
        if(schedule){
            try { scheduleData = JSON.parse(schedule); } catch(e){ scheduleData = []; }
        }

        await pool.query(
            `INSERT INTO system_status (mode,pump,min_val,max_val,next_time,pump_power,schedules)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [mode, flow>0, min, max, next, pump_power ?? 36, scheduleData]
        );

        res.json({ status: 'success' });
    } catch(err){
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API lấy dữ liệu sensor =================
app.get('/api/data', async (req,res)=>{
    try{
        const result = await pool.query('SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1');
        res.json(result.rows[0] || {});
    }catch(err){
        console.error(err);
        res.status(500).json({status:'error'});
    }
});

// ================= API lấy trạng thái system_status =================
app.get('/api/status', async (req,res)=>{
    try{
        const result = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
        res.json(result.rows[0] || {});
    }catch(err){
        console.error(err);
        res.status(500).json({status:'error'});
    }
});

// ================= API UI gửi lệnh =================
app.post('/api/control', async (req, res) => {
    const { pump, mode, pump_power, add_schedule, remove_schedule } = req.body;
    try {
        // Lấy lệnh trước đó
        const lastData = await pool.query('SELECT * FROM command_queue ORDER BY id DESC LIMIT 1');
        const last = lastData.rows[0] || {};

        let schedules = [];
        if(last.schedules){
            try { schedules = JSON.parse(last.schedules); } catch(e){ schedules = []; }
        }

        if(add_schedule) schedules.push(add_schedule);
        if(remove_schedule !== undefined && remove_schedule < schedules.length) schedules.splice(remove_schedule, 1);

        const newPump = pump !== undefined ? pump : (last?.pump ?? false);
        const newMode = mode ?? (last?.mode ?? 'AUTO');
        const newPumpPower = pump_power ?? (last?.pump_power ?? 36);

        await pool.query(
            `INSERT INTO command_queue (pump, mode, pump_power, schedules)
             VALUES ($1, $2, $3, $4)`,
            [newPump, newMode, newPumpPower, JSON.stringify(schedules)]
        );

        res.json({ status: 'success' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error' });
    }
});

// ================= API ESP lấy lệnh =================
app.get('/api/command', async (req,res)=>{
    try{
        const result = await pool.query(
            `SELECT * FROM command_queue WHERE status='pending' ORDER BY id ASC LIMIT 1`
        );
        const cmd = result.rows[0];
        if(!cmd) return res.send('');

        let cmdStr = '';
        cmdStr += cmd.pump ? 'PUMP:ON;' : 'PUMP:OFF;';
        cmdStr += 'MODE:' + cmd.mode + ';';
        cmdStr += 'POWER:' + cmd.pump_power + ';';
        if(cmd.schedules) cmdStr += 'SCHEDULES:' + JSON.stringify(cmd.schedules) + ';';

        await pool.query(`UPDATE command_queue SET status='sent' WHERE id=$1`, [cmd.id]);
        res.send(cmdStr);
    }catch(err){
        console.error(err);
        res.status(500).send('ERROR');
    }
});

// ================= RUN SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`🚀 Server running on port ${PORT}`));
