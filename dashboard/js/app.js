// Configuration
const MAP_CENTER = [12.9716, 77.5946];
const MAP_ZOOM = 12;
const TILE_LAYER = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://carto.com/">CartoDB</a>';

// Global Data State
let violationsData = [];
let zoneSummary = [];
let hourlyData = null;

// Map Instances
let mapLeft, mapRight;
let heatLayerLeft, heatLayerRight, priorityMarkersGroup;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    initMaps();
    await loadData();
    initCharts();
    populateTable();
    setupFilters();
});

function initMaps() {
    // Left Map: Density
    mapLeft = L.map('map-left', { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer(TILE_LAYER, { attribution: TILE_ATTR }).addTo(mapLeft);

    // Right Map: Priority
    mapRight = L.map('map-right', { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer(TILE_LAYER, { attribution: TILE_ATTR }).addTo(mapRight);

    // Sync panning and zooming
    mapLeft.on('move', () => {
        mapRight.setView(mapLeft.getCenter(), mapLeft.getZoom(), { animate: false });
    });
    mapRight.on('move', () => {
        mapLeft.setView(mapRight.getCenter(), mapRight.getZoom(), { animate: false });
    });
}

async function loadData() {
    try {
        const [vData, zData, hData, sData] = await Promise.all([
            fetch('data/violations_sample.json').then(r => r.json()),
            fetch('data/zone_summary.json').then(r => r.json()),
            fetch('data/hourly_distribution.json').then(r => r.json()),
            fetch('data/shap_importance.json').then(r => r.json())
        ]);
        
        violationsData = vData;
        zoneSummary = zData;
        hourlyData = hData;
        window.shapData = sData; // Store globally for chart

        renderMapData();
    } catch (e) {
        console.error("Error loading data. Did you run the python server?", e);
        alert("Could not load data. Ensure you ran 'python export_dashboard_data.py' and started the HTTP server.");
    }
}

function getPriorityColor(normValue) {
    if (normValue < 0.2) return "#3498DB";
    if (normValue < 0.4) return "#2ECC71";
    if (normValue < 0.6) return "#F1C40F";
    if (normValue < 0.8) return "#E67E22";
    return "#E74C3C";
}

function renderMapData(hourFilter = null) {
    // Clear existing layers
    if (heatLayerLeft) mapLeft.removeLayer(heatLayerLeft);
    if (heatLayerRight) mapRight.removeLayer(heatLayerRight);
    if (priorityMarkersGroup) mapRight.removeLayer(priorityMarkersGroup);

    // Filter data
    let currentData = violationsData;
    if (hourFilter !== null && hourFilter !== 'all') {
        currentData = violationsData.filter(d => d.hour == hourFilter);
    }

    // 1. Left Map: Raw Density Heatmap
    const heatPointsLeft = currentData.map(d => [d.lat, d.lng, 1]); // Equal weight
    heatLayerLeft = L.heatLayer(heatPointsLeft, {
        radius: 12,
        blur: 15,
        maxZoom: 15,
        gradient: {0.2: '#3498DB', 0.4: '#2ECC71', 0.6: '#F1C40F', 0.8: '#E67E22', 1.0: '#E74C3C'}
    }).addTo(mapLeft);

    // 2. Right Map: Priority Visualization
    
    // Priority Heatmap underlay
    const heatPointsRight = currentData.map(d => [d.lat, d.lng, d.priority]);
    heatLayerRight = L.heatLayer(heatPointsRight, {
        radius: 12,
        blur: 15,
        maxZoom: 15,
        gradient: {0.2: '#3498DB', 0.4: '#2ECC71', 0.6: '#F1C40F', 0.8: '#E67E22', 1.0: '#E74C3C'}
    }).addTo(mapRight);

    // High Priority Markers overlay
    priorityMarkersGroup = L.layerGroup().addTo(mapRight);
    
    // Only show top highest priority markers for performance
    const topMarkers = currentData.sort((a,b) => b.priority - a.priority).slice(0, 500);
    
    topMarkers.forEach(point => {
        const radius = 3 + (point.priority_norm * 8);
        const color = getPriorityColor(point.priority_norm);
        
        const popupContent = `
            <div class="popup-content">
                <h4>${point.zone}</h4>
                <div class="popup-row"><span class="popup-label">Priority Score</span> <span class="popup-value" style="color: #E74C3C">${point.priority.toFixed(2)}</span></div>
                <div class="popup-row"><span class="popup-label">Vehicle</span> <span class="popup-value">${point.vehicle}</span></div>
                <div class="popup-row"><span class="popup-label">Violation</span> <span class="popup-value">${point.violation}</span></div>
                <div class="popup-row"><span class="popup-label">Hour (IST)</span> <span class="popup-value">${point.hour}:00</span></div>
            </div>
        `;

        L.circleMarker([point.lat, point.lng], {
            radius: radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 1
        }).bindPopup(popupContent).addTo(priorityMarkersGroup);
    });
}

function populateTable() {
    const tbody = document.querySelector('#rank-table tbody');
    tbody.innerHTML = '';

    // Sort by absolute rank change
    const sortedZones = [...zoneSummary].sort((a, b) => Math.abs(b.rank_change) - Math.abs(a.rank_change)).slice(0, 10);

    sortedZones.forEach(zone => {
        const changeStr = zone.rank_change > 0 
            ? `<span class="rank-up">▲ +${zone.rank_change}</span>` 
            : `<span class="rank-down">▼ ${zone.rank_change}</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${zone.police_station}</strong></td>
            <td>#${zone.count_rank}</td>
            <td>#${zone.priority_rank}</td>
            <td>${changeStr}</td>
            <td>${zone.count.toLocaleString()}</td>
            <td>${zone.mean_priority.toFixed(2)}</td>
            <td>${(zone.junction_pct * 100).toFixed(0)}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function initCharts() {
    Chart.defaults.color = '#adb5bd';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // SHAP Chart
    const ctxShap = document.getElementById('shapChart').getContext('2d');
    new Chart(ctxShap, {
        type: 'bar',
        data: {
            labels: window.shapData.labels,
            datasets: [{
                label: 'SHAP Value (Impact)',
                data: window.shapData.values,
                backgroundColor: '#ef4444',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { grid: { display: false } }
            }
        }
    });

    // Hourly Distribution Chart
    const ctxHourly = document.getElementById('hourlyChart').getContext('2d');
    new Chart(ctxHourly, {
        type: 'line',
        data: {
            labels: hourlyData.hours.map(h => `${h}:00`),
            datasets: [
                {
                    label: 'Violation Count',
                    data: hourlyData.counts,
                    borderColor: '#3b82f6',
                    yAxisID: 'y',
                    tension: 0.4
                },
                {
                    label: 'Avg Priority',
                    data: hourlyData.priority,
                    borderColor: '#f97316',
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } }
            },
            scales: {
                x: { grid: { display: false } },
                y: { 
                    type: 'linear', display: true, position: 'left',
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y1: {
                    type: 'linear', display: true, position: 'right',
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function setupFilters() {
    const slider = document.getElementById('hour-slider');
    const display = document.getElementById('hour-display');
    
    // Add "All" option to slider
    slider.min = -1;
    slider.value = -1;
    display.textContent = "All Hours";

    slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (val === -1) {
            display.textContent = "All Hours";
            renderMapData('all');
        } else {
            display.textContent = `${val.toString().padStart(2, '0')}:00`;
            renderMapData(val);
        }
    });
}
