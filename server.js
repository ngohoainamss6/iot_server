<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🌱 IoT Smart Garden Dashboard</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
body { background: #f5f7fa; font-family: 'Segoe UI', sans-serif; }
.card { border-radius: 15px; box-shadow: 0 8px 20px rgba(0,0,0,0.12); margin-bottom: 20px; text-align:center; padding:20px;}
.sensor-value { font-size: 2rem; font-weight: bold; margin-top:10px; }
.gradient-card { background: linear-gradient(135deg,#6dd5ed,#2193b0); color:#fff; }
.gradient-card2 { background: linear-gradient(135deg,#f093fb,#f5576c); color:#fff; }
.gradient-card3 { background: linear-gradient(135deg,#43e97b,#38f9d7); color:#fff; }
</style>
</head>
<body>
<div class="container py-4">
<h1 class="fw-bold text-center mb-4">🌱 IoT Smart Garden Dashboard</h1>

<div class="row g-3 mb-3">
  <div class="col-md-4"><div class="card gradient-card"><div>🌿 Độ ẩm đất</div><div class="sensor-value" id="soil">- %</div></div></div>
  <div class="col-md-4"><div class="card gradient-card2"><div>🌤 Nhiệt độ</div><div class="sensor-value" id="temp">- °C</div></div></div>
  <div class="col-md-4"><div class="card gradient-card3"><div>💧 Độ ẩm KK</div><div class="sensor-value" id="hum">- %</div></div></div>
</div>

<div class="row g-3 mb-3">
  <div class="col-md-3"><div class="card"><div>Chế độ hiện tại</div><div class="sensor-value" id="currentMode">-</div></div></div>
  <div class="col-md-3"><div class="card"><div>Bơm hiện tại</div><div class="sensor-value" id="pumpStatusText">-</div></div></div>
  <div class="col-md-3"><div class="card"><div>📉 Min Threshold</div><div class="sensor-value" id="min_val">- %</div></div></div>
  <div class="col-md-3"><div class="card"><div>📈 Max Threshold</div><div class="sensor-value" id="max_val">- %</div></div></div>
</div>

<div class="row g-3 mb-3">
  <div class="col-md-3"><div class="card"><div>🚿 Dòng chảy</div><div class="sensor-value" id="flow">-</div></div></div>
  <div class="col-md-3"><div class="card"><div>⏱️ Thời gian tưới tiếp theo</div><div class="sensor-value" id="next_time">- phút</div></div></div>
</div>

<div class="row g-3 mt-3">
  <div class="col-md-4">
    <div class="card p-3 text-center">
      <div>💡 Chọn chế độ</div>
      <select id="modeSelect" class="form-select mt-2">
        <option value="AUTO">AUTO</option>
        <option value="MANUAL">MANUAL</option>
        <option value="SCHEDULE">SCHEDULE</option>
        <option value="SLEEP">SLEEP</option>
      </select>
      <button class="btn btn-primary mt-2" id="modeApply">Gửi lệnh</button>
    </div>
  </div>

  <div class="col-md-4">
    <div class="card p-3 text-center">
      <div>🚰 Bật/Tắt bơm</div>
      <div class="form-check form-switch d-flex justify-content-center mt-3">
        <input class="form-check-input" type="checkbox" id="pumpSwitch" style="transform: scale(1.8); cursor:pointer;">
      </div>
    </div>
  </div>

  <div class="col-md-4">
    <div class="card p-3 text-center">
      <div>⚡ Công suất bơm (%)</div>
      <input type="range" class="form-range" min="0" max="100" step="1" id="pumpPower">
      <span id="pumpPowerLabel">36%</span>
    </div>
  </div>
</div>

<div class="row g-3 mt-3">
  <div class="col-md-12">
    <div class="card p-3">
      <h5>Lịch tưới</h5>
      <div id="scheduleList" class="mb-2"></div>
      <div class="input-group mb-2">
        <input type="time" id="scheduleTime" class="form-control">
        <button class="btn btn-primary" id="addScheduleBtn">Thêm lịch</button>
      </div>
    </div>
  </div>
</div>

<div class="row g-3 mt-3">
  <div class="col-md-12">
    <div class="card p-3">
      <h5>Lệnh chờ ESP thực hiện</h5>
      <div id="commandList">-</div>
    </div>
  </div>
</div>
</div>

<script>
const API_BASE = "https://iot-server-yc6r.onrender.com";

// =============== SWITCH BƠM ===============
const pumpSwitch = document.getElementById('pumpSwitch');
const pumpStatusText = document.getElementById('pumpStatusText');

pumpSwitch.addEventListener('change', async () => {
  const newState = pumpSwitch.checked;
  pumpStatusText.textContent = newState ? "Đang bật..." : "Đang tắt...";
  try {
    const res = await fetch(`${API_BASE}/api/control`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ pump: newState })
    });
    const data = await res.json();
    if (data.status === "success") {
      pumpStatusText.textContent = newState ? "BẬT" : "TẮT";
    } else {
      pumpSwitch.checked = !newState;
      pumpStatusText.textContent = "❌ Lỗi!";
    }
  } catch(err){
    console.error(err);
    pumpSwitch.checked = !newState;
    pumpStatusText.textContent = "❌ Lỗi mạng!";
  }
});

function updatePumpUI(pump){
  pumpSwitch.checked = !!pump;
  pumpStatusText.textContent = pump ? "BẬT" : "TẮT";
}

// =============== FETCH DỮ LIỆU ===============
async function fetchData() {
  try {
    const sensorRes = await fetch(`${API_BASE}/api/data`);
    const sensor = await sensorRes.json();
    const statusRes = await fetch(`${API_BASE}/api/status`);
    const status = await statusRes.json();

    document.getElementById('soil').textContent = sensor.soil ?? '- %';
    document.getElementById('temp').textContent = sensor.temp ?? '- °C';
    document.getElementById('hum').textContent = sensor.hum ?? '- %';
    document.getElementById('flow').textContent = sensor.flow ?? '-';

    document.getElementById('currentMode').textContent = status.mode ?? '-';
    document.getElementById('min_val').textContent = status.min_val ?? '- %';
    document.getElementById('max_val').textContent = status.max_val ?? '- %';
    document.getElementById('next_time').textContent = status.next_time ?? '- phút';
    document.getElementById('pumpPower').value = status.pump_power ?? 36;
    document.getElementById('pumpPowerLabel').textContent = (status.pump_power ?? 36)+'%';
    updatePumpUI(status.pump);
    updateScheduleUI(Array.isArray(status.schedules) ? status.schedules : []);

    const cmdRes = await fetch(`${API_BASE}/api/command`);
    const cmdStr = await cmdRes.text();
    document.getElementById('commandList').textContent = cmdStr || '-';
  } catch(err){ console.error(err); }
}

// =============== MODE ===============
document.getElementById('modeApply').addEventListener('click', async ()=>{
  const mode = document.getElementById('modeSelect').value;
  await fetch(`${API_BASE}/api/control`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ mode })
  });
});

// =============== CÔNG SUẤT ===============
const pumpPowerInput = document.getElementById('pumpPower');
pumpPowerInput.addEventListener('input', ()=> {
  document.getElementById('pumpPowerLabel').textContent = pumpPowerInput.value+'%';
});
pumpPowerInput.addEventListener('change', async ()=>{
  await fetch(`${API_BASE}/api/control`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ pump_power: parseInt(pumpPowerInput.value) })
  });
});

// =============== LỊCH TƯỚI ===============
function updateScheduleUI(schedules){
  const list = document.getElementById('scheduleList');
  list.innerHTML = '';
  schedules.forEach((t,i)=>{
    const div = document.createElement('div');
    div.className='d-flex justify-content-between align-items-center mb-1';
    div.innerHTML = `<span>${t.hour.toString().padStart(2,'0')}:${t.minute.toString().padStart(2,'0')}</span>
                     <button class="btn btn-sm btn-danger" onclick="removeSchedule(${i})">X</button>`;
    list.appendChild(div);
  });
}
document.getElementById('addScheduleBtn').addEventListener('click', async ()=>{
  const val = document.getElementById('scheduleTime').value;
  if(!val) return;
  const [hour,minute] = val.split(':').map(Number);
  await fetch(`${API_BASE}/api/control`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({add_schedule:{hour,minute}})
  });
  document.getElementById('scheduleTime').value='';
});
async function removeSchedule(index){
  await fetch(`${API_BASE}/api/control`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({remove_schedule:index})
  });
}

// =============== AUTO REFRESH ===============
setInterval(fetchData,2000);
fetchData();
</script>
</body>
</html>
