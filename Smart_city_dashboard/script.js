// ==========================================
// 1. CONFIGURATION & DEMO DATA
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAr8swHvTGLhmXOcmpUnQmNdz1R1EXSb2s",
    authDomain: "smart-city-dashboard-72269.firebaseapp.com",
    databaseURL: "https://smart-city-dashboard-72269-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-city-dashboard-72269",
    storageBucket: "smart-city-dashboard-72269.firebasestorage.app",
    messagingSenderId: "475195279309",
    appId: "1:475195279309:web:8a3c05df9c6b07e63c6684",
    measurementId: "G-H2ZG6ZR17C"
};

const demoData = {
    environment: { aqi: 45, pm25: 18, temperature: 28, humidity: 65 },
    parking: [
        { id: 1, name: "Bãi đỗ xe Vincom", address: "72 Lê Thánh Tôn, Q.1", available: 45, total: 200, lat: 10.7769, lng: 106.7009 },
        { id: 2, name: "Bãi đỗ xe Diamond", address: "34 Lê Duẩn, Q.1", available: 23, total: 150, lat: 10.7811, lng: 106.6992 },
        { id: 3, name: "Bãi đỗ xe Takashimaya", address: "65 Lê Lợi, Q.1", available: 67, total: 300, lat: 10.7731, lng: 106.7001 }
    ],
    cameras: [
        { id: 1, name: "Camera Ngã tư Phú Nhuận", vehicles: 234 },
        { id: 2, name: "Camera Cầu Sài Gòn", vehicles: 789 }
    ],
    traffic: { totalVehicles: 12453, avgSpeed: 32, incidents: 7 },
    trafficPoints: [
        { lat: 10.7769, lng: 106.7009, density: 'low' },
        { lat: 10.7879, lng: 106.6972, density: 'high' },
        { lat: 10.8045, lng: 106.7321, density: 'medium' }
    ]
};

let database, map;
let trafficChart, speedChart, incidentsChart;
let trafficMarkers = [];
let sensorSystemIsAuto = false; // Biến trạng thái quan trọng

// ==========================================
// 2. INITIALIZATION
// ==========================================
function initApp() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();

    initMap();
    setupFirebaseListeners();
    setupControlListeners();
    
    // Load dữ liệu demo ban đầu
    updateParkingUI(demoData.parking);
    updateCameraUI(demoData.cameras);
    showTrafficLayer();

    // Cập nhật thời gian thực
    setInterval(() => {
        const dtEl = document.getElementById('datetime');
        if(dtEl) dtEl.textContent = new Date().toLocaleString('vi-VN');
    }, 1000);

    // BẢO VỆ: Tự động ẩn loading sau 4 giây nếu Firebase không phản hồi
    setTimeout(hideLoader, 4000);
}

function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
    }
}

function initMap() {
    map = L.map('cityMap', { zoomControl: false }).setView([10.7879, 106.6972], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
}

// ==========================================
// 3. FIREBASE LISTENERS (RECEIVE DATA)
// ==========================================
function setupFirebaseListeners() {
    database.ref('environment').on('value', snap => {
        hideLoader(); // Ẩn loading khi có dữ liệu
        const d = snap.val();
        if(d) {
            document.getElementById('aqiValue').textContent = d.aqi || '--';
            document.getElementById('tempValue').textContent = d.temperature || '--';
            document.getElementById('humidityValue').textContent = d.humidity || '--';
            document.getElementById('pm25Value').textContent = d.pm25 || '--';
        }
    });

    database.ref('traffic').on('value', snap => {
        hideLoader();
        const d = snap.val() || demoData.traffic;
        document.getElementById('totalVehicles').textContent = (d.totalVehicles || 0).toLocaleString();
        document.getElementById('avgSpeed').textContent = d.avgSpeed || 0;
        document.getElementById('incidents').textContent = d.incidents || 0;
        updateCharts(d.totalVehicles/24, d.avgSpeed, d.incidents);
    });

    database.ref('parking').on('value', snap => {
        if(snap.val()) updateParkingUI(Object.values(snap.val()));
    });
}

function setupControlListeners() {
    database.ref('controls').on('value', snap => {
        const data = snap.val();
        if (!data) return;

        // Cập nhật Đèn đường (Light Mode)
        const lightMode = data.lightMode || 'auto';
        updateLightUI(lightMode);

        // Cập nhật Đèn giao thông (Sensor Mode)
        sensorSystemIsAuto = (data.sensorMode === 'auto');
        const sensorColor = data.sensorColor || 'red';
        updateSensorUI(sensorSystemIsAuto, sensorColor);

        // --- Cập nhật Camera (ON/OFF) ---
const camCard = document.getElementById('card-camera');
const camStatusText = document.getElementById('status-camera');
const camIcon = document.getElementById('camera-icon'); // Lấy thẻ icon ảnh

if (camCard) {
    if (data.camera === 1) {
        // Trạng thái ON
        camCard.classList.add('on');
        if (camStatusText) camStatusText.textContent = "ON";
        if (camIcon) camIcon.src = 'camera.png';      // Đổi sang ảnh camera đang bật
    } else {
        // Trạng thái OFF (0 hoặc null)
        camCard.classList.remove('on');
        if (camStatusText) camStatusText.textContent = "OFF";
        if (camIcon) camIcon.src = 'camera_off.png';  // Đổi sang ảnh camera đang tắt
    }
}
    });
}

// ==========================================
// 4. CONTROL FUNCTIONS (SEND DATA)
// ==========================================

// --- Hệ thống Chiếu sáng ---
function setLightMode(mode) {
    database.ref('controls/lightMode').set(mode);
}

function updateLightUI(mode) {
    const btnAuto = document.getElementById('btn-light-auto');
    const btnOn = document.getElementById('btn-light-on');
    const badge = document.getElementById('light-status-badge');
    const card = document.getElementById('card-light');
    const lightIcon = document.getElementById('light-icon'); // Lấy thẻ img đã thêm ID ở bước trước

    btnAuto.classList.remove('active');
    btnOn.classList.remove('active');

    if (mode === 'auto') {
        btnAuto.classList.add('active');
        badge.textContent = "AUTO";
        badge.className = "card-badge badge-auto";
        card.classList.remove('on');
        
        // Đổi icon sang file light_off.png khi ở chế độ AUTO
        if (lightIcon) lightIcon.src = 'light_off.png';
    } else {
        btnOn.classList.add('active');
        badge.textContent = "ON";
        badge.className = "card-badge badge-on";
        card.classList.add('on');
        
        // Đổi lại icon mặc định (logo.png) khi ở chế độ ON
        if (lightIcon) lightIcon.src = 'logo.png';
    }
}

// --- Hệ thống Đèn Giao Thông ---
function toggleSensorMode() {
    const checkbox = document.getElementById('sensorModeCheckbox');
    const newMode = checkbox.checked ? 'auto' : 'manual';
    database.ref('controls/sensorMode').set(newMode);
}

function setSensorColor(color) {
    if (sensorSystemIsAuto) return; // Khóa nếu đang AUTO
    database.ref('controls/sensorColor').set(color);
}

function updateSensorUI(isAuto, color) {
    const checkbox = document.getElementById('sensorModeCheckbox');
    const controls = document.getElementById('sensorControls');
    const label = document.getElementById('mode-text');
    const btnRed = document.getElementById('btn-red');
    const btnGreen = document.getElementById('btn-green');

    checkbox.checked = isAuto;
    label.textContent = isAuto ? "AUTO" : "MANUAL";

    if (isAuto) controls.classList.add('disabled-ui');
    else controls.classList.remove('disabled-ui');

    btnRed.classList.remove('active');
    btnGreen.classList.remove('active');

    if (color === 'red') btnRed.classList.add('active');
    else btnGreen.classList.add('active');
}

// --- Các thiết bị Toggle khác (Camera) ---
function toggleDevice(device) {
    database.ref('controls/' + device).once('value').then(s => {
        database.ref('controls/' + device).set(s.val() === 1 ? 0 : 1);
    });
}

// ==========================================
// 5. UI HELPERS & CHARTS
// ==========================================
function updateParkingUI(parkingData) {
    const container = document.getElementById('parkingList');
    if (!container) return;
    container.innerHTML = '';
    parkingData.forEach(p => {
        container.innerHTML += `
            <div class="parking-item">
                <div class="parking-info"><h4>${p.name}</h4><p>${p.address}</p></div>
                <div class="parking-slots">
                    <div class="available" style="color:var(--cyan-primary);font-family:Orbitron;font-size:1.5rem">${p.available}</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary)">/ ${p.total}</div>
                </div>
            </div>`;
    });
}

function updateCameraUI(cameraData) {
    const container = document.getElementById('cameraGrid');
    if (!container) return;
    container.innerHTML = '';
    cameraData.forEach(c => {
        container.innerHTML += `
            <div class="camera-card">
                <div class="camera-feed"><div class="live-badge">Live</div><div class="camera-placeholder">CAM FEED: ${c.name}</div></div>
                <div class="camera-info"><h4>${c.name}</h4><span>Lưu lượng: ${c.vehicles} xe/h</span></div>
            </div>`;
    });
}

function showTrafficLayer() {
    trafficMarkers.forEach(m => map.removeLayer(m));
    const colors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
    demoData.trafficPoints.forEach(p => {
        const m = L.circleMarker([p.lat, p.lng], { radius: 20, color: colors[p.density], fillOpacity: 0.4 }).addTo(map);
        trafficMarkers.push(m);
    });
}

function showParkingLayer() {
    trafficMarkers.forEach(m => map.removeLayer(m));
    demoData.parking.forEach(p => {
        const m = L.marker([p.lat, p.lng]).addTo(map).bindPopup(p.name);
        trafficMarkers.push(m);
    });
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const targetSection = document.getElementById(tab + '-section');
    if(targetSection) targetSection.classList.add('active');
    const btnId = tab === 'dashboard' ? 'nav-dash' : 'nav-ctrl';
    const btnEl = document.getElementById(btnId);
    if(btnEl) btnEl.classList.add('active');
    if(map) setTimeout(() => map.invalidateSize(), 200);
}

function updateCharts(avgVeh, avgSpd, inc) {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
    };

    if (!trafficChart) {
        const ctx = document.getElementById('trafficLineChart').getContext('2d');
        trafficChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => i + 'h'),
                datasets: [{ data: Array.from({length: 24}, () => Math.round(avgVeh + (Math.random()-0.5)*100)), borderColor: '#00fff7', fill: true, backgroundColor: 'rgba(0,255,247,0.1)', tension: 0.4, pointRadius: 0 }]
            },
            options: commonOptions
        });
    }

    if (!speedChart) {
        const ctx = document.getElementById('speedLineChart').getContext('2d');
        speedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => i + 'h'),
                datasets: [{ data: Array.from({length: 24}, () => Math.round(avgSpd + (Math.random()-0.5)*10)), borderColor: '#00d4ff', tension: 0.4, pointRadius: 0 }]
            },
            options: commonOptions
        });
    }

    const incCanvas = document.getElementById('incidentsBarChart');
    if (incCanvas && !incidentsChart) {
        incidentsChart = new Chart(incCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                datasets: [{ data: [Math.round(inc*0.2), Math.round(inc*0.3), Math.round(inc*0.1), Math.round(inc*0.4)], backgroundColor: '#ef4444', borderRadius: 4 }]
            },
            options: { ...commonOptions, indexAxis: 'y' }
        });
    }
}

// Khởi chạy hệ thống
document.addEventListener('DOMContentLoaded', initApp);