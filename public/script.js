async function fetchStatus() {
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('soil').innerText = 'Soil: ' + data.soil;
    document.getElementById('temp').innerText = 'Temp: ' + data.temp;
    document.getElementById('hum').innerText = 'Humidity: ' + data.hum;
    document.getElementById('flow').innerText = 'Flow: ' + data.flow;
    document.getElementById('pump').innerText = 'Pump: ' + (data.pump ? 'ON' : 'OFF');
    document.getElementById('mode').innerText = 'Mode: ' + data.mode;
}

async function togglePump() {
    const res = await fetch('/api/status');
    const data = await res.json();
    await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pump: !data.pump, mode: data.mode })
    });
}

async function toggleMode() {
    const res = await fetch('/api/status');
    const data = await res.json();
    const newMode = data.mode === 'AUTO' ? 'MANUAL' : 'AUTO';
    await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pump: data.pump, mode: newMode })
    });
}

setInterval(fetchStatus, 5000);
fetchStatus();
