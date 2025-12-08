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
@@ -48,15 +50,16 @@

// ================= API nhận dữ liệu từ ESP =================
app.post('/api/save', async (req, res) => {
    const { soil, temp, hum, flow, mode, min, max, next } = req.body;
    const { soil, temp, hum, flow, mode, min, max, next, pump_power, schedule } = req.body;
    try {
        await pool.query(
            'INSERT INTO sensor_data (soil,temp,hum,flow) VALUES ($1,$2,$3,$4)',
            [soil,temp,hum,flow]
        );
        await pool.query(
            'INSERT INTO system_status (mode,pump,min_val,max_val,next_time) VALUES ($1,$2,$3,$4,$5)',
            [mode, flow>0, min, max, next]
            `INSERT INTO system_status (mode,pump,min_val,max_val,next_time,pump_power,schedules)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [mode, flow>0, min, max, next, pump_power ?? 36, JSON.stringify(schedule ?? [])]
        );
        res.json({ status: 'success' });
    } catch(err){
@@ -69,7 +72,7 @@
app.get('/api/data', async (req,res)=>{
    try{
        const result = await pool.query('SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1');
        res.json(result.rows[0]);
        res.json(result.rows[0] || {});
    }catch(err){
        console.error(err);
        res.status(500).json({status:'error'});
@@ -80,7 +83,7 @@
app.get('/api/status', async (req,res)=>{
    try{
        const result = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
        res.json(result.rows[0]);
        res.json(result.rows[0] || {});
    }catch(err){
        console.error(err);
        res.status(500).json({status:'error'});
@@ -92,9 +95,12 @@
    try{
        const result = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
        const s = result.rows[0];
        if(!s) return res.send('');
        let cmd = '';
        cmd += s.pump ? 'PUMP:ON;' : 'PUMP:OFF;';
        cmd += 'MODE:' + s.mode + ';';
        cmd += 'POWER:' + s.pump_power + ';';
        if(s.schedules) cmd += 'SCHEDULES:' + s.schedules + ';';
        res.send(cmd);
    }catch(err){
        console.error(err);
@@ -104,13 +110,19 @@

// ================= API điều khiển từ UI =================
app.post('/api/control', async (req,res)=>{
    const { pump, mode } = req.body;
    const { pump, mode, pump_power, add_schedule, remove_schedule } = req.body;
    try{
        const lastData = await pool.query('SELECT * FROM system_status ORDER BY id DESC LIMIT 1');
        const last = lastData.rows[0];
        const schedules = last && last.schedules ? JSON.parse(last.schedules) : [];

        if(add_schedule) schedules.push(add_schedule);
        if(remove_schedule !== undefined) schedules.splice(remove_schedule,1);

        await pool.query(
            'INSERT INTO system_status (mode,pump,min_val,max_val,next_time) VALUES ($1,$2,$3,$4,$5)',
            [mode, pump, last.min_val, last.max_val, last.next_time]
            `INSERT INTO system_status (mode,pump,min_val,max_val,next_time,pump_power,schedules)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [mode ?? last.mode, pump ?? last.pump, last.min_val, last.max_val, last.next_time, pump_power ?? last.pump_power, JSON.stringify(schedules)]
        );
        res.json({status:'success'});
    }catch(err){
