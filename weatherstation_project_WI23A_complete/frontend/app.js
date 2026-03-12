const state = {
    stations: [],
    selectedId: null,
    climate: null,
    page: 'search',
    activeSeries: new Set(['annual_tmin', 'annual_tmax']),
    map: null,
    markers: []
};

const $ = id => document.getElementById(id);

// Seitenwechsel
function showPage(page) {
    state.page = page;
    $('pageSearch').classList.toggle('hidden', page !== 'search');
    $('pageStations').classList.toggle('hidden', page !== 'stations');
    $('pageClimate').classList.toggle('hidden', page !== 'climate');
    
    if (page === 'stations') {
        setTimeout(initMap, 100);
    }
}

// Suche
async function searchStations() {
    const params = new URLSearchParams({
        latitude: $('latitude').value,
        longitude: $('longitude').value,
        radius_km: $('radius').value,
        limit: $('limit').value,
        start_year: $('startYear').value,
        end_year: $('endYear').value
    });
    
    try {
        const res = await fetch(`/api/stations?${params}`);
        const data = await res.json();
        state.stations = data.stations || [];
        state.selectedId = state.stations[0]?.station_id || null;
        
        renderStationTable();
        showPage('stations');
    } catch (err) {
        alert('Fehler: ' + err.message);
    }
}

// Tabelle
function renderStationTable() {
    const tbody = $('stationTable').querySelector('tbody');
    tbody.innerHTML = '';
    
    state.stations.forEach(s => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${s.name}</td>
            <td>${s.distance_km?.toFixed(1) || '?'} km</td>
            <td>${s.first_year || '?'} - ${s.last_year || '?'}</td>
            <td><button onclick="window.selectStation('${s.station_id}')">Select</button></td>
        `;
    });
    
    // Dropdown
    const select = $('stationSelect');
    select.innerHTML = '';
    state.stations.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.station_id;
        opt.text = s.name;
        opt.selected = s.station_id === state.selectedId;
        select.appendChild(opt);
    });
}

// Station auswählen
window.selectStation = (id) => {
    state.selectedId = id;
    loadClimate();
};

// Klimadaten laden
async function loadClimate() {
    try {
        const res = await fetch(`/api/stations/${state.selectedId}/climate?start_year=${$('startYear').value}&end_year=${$('endYear').value}`);
        const data = await res.json();
        state.climate = data;
        renderClimate();
        showPage('climate');
    } catch (err) {
        alert('Fehler: ' + err.message);
    }
}

// Klimaansicht
function renderClimate() {
    $('climateTitleStation').textContent = state.climate.station.name;
    renderLegend();
    renderTable();
    drawChart();
}

// Legende
function renderLegend() {
    const legend = $('chartLegend');
    legend.innerHTML = '';
    
    const series = [
        {name: 'annual_tmin', label: 'Annual TMIN', color: '#2d73c4'},
        {name: 'annual_tmax', label: 'Annual TMAX', color: '#d23d30'}
    ];
    
    series.forEach(s => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.activeSeries.has(s.name);
        cb.onchange = () => toggleSeries(s.name);
        
        const span = document.createElement('span');
        span.style.cssText = `display:inline-block; width:20px; height:3px; background:${s.color}; margin:0 5px;`;
        
        label.appendChild(cb);
        label.appendChild(span);
        label.appendChild(document.createTextNode(s.label));
        legend.appendChild(label);
    });
}

function toggleSeries(name) {
    if (state.activeSeries.has(name)) {
        state.activeSeries.delete(name);
    } else {
        state.activeSeries.add(name);
    }
    renderTable();
    drawChart();
}

// Tabelle
function renderTable() {
    const container = $('compactTable');
    if (!state.climate?.table) return;
    
    let html = '<table border="1" style="border-collapse:collapse; width:100%"><thead><tr><th>Year</th>';
    const active = Array.from(state.activeSeries).sort();
    
    active.forEach(name => {
        html += `<th>${name.replace('_', ' ').toUpperCase()}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    state.climate.table.forEach(row => {
        html += `<tr><td>${row.year}</td>`;
        active.forEach(name => {
            const val = row[name];
            html += `<td>${val !== undefined ? val.toFixed(1) : '–'}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Chart
function drawChart() {
    const svg = $('chart');
    svg.innerHTML = '';
    
    if (!state.climate?.annual_series) return;
    
    const points = [];
    state.climate.annual_series.forEach(s => {
        if (state.activeSeries.has(s.name)) {
            s.points.forEach(p => points.push(p));
        }
    });
    
    if (points.length === 0) return;
    
    const years = points.map(p => p.year);
    const values = points.map(p => p.value);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const minVal = Math.floor(Math.min(...values));
    const maxVal = Math.ceil(Math.max(...values));
    
    const w = 760, h = 400;
    const pad = {l: 70, r: 30, t: 30, b: 50};
    
    // Hintergrund
    svg.innerHTML += `<rect x="0" y="0" width="${w}" height="${h}" fill="white"/>`;
    
    // Y-Achse
    for (let i = 0; i <= 5; i++) {
        const val = minVal + (maxVal - minVal) * i / 5;
        const y = pad.t + (h - pad.t - pad.b) * (1 - (val - minVal) / (maxVal - minVal));
        svg.innerHTML += `<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="#eee" stroke-dasharray="4"/>`;
        svg.innerHTML += `<text x="${pad.l-10}" y="${y+5}" text-anchor="end">${val.toFixed(1)}</text>`;
    }
    
    // X-Achse
    for (let y = minYear; y <= maxYear; y += Math.ceil((maxYear-minYear)/8)) {
        const x = pad.l + (w - pad.l - pad.r) * (y - minYear) / (maxYear - minYear);
        svg.innerHTML += `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${h-pad.b}" stroke="#eee" stroke-dasharray="4"/>`;
        svg.innerHTML += `<text x="${x}" y="${h-20}" text-anchor="middle">${y}</text>`;
    }
    
    // Linien
    state.climate.annual_series.forEach(s => {
        if (!state.activeSeries.has(s.name)) return;
        
        const color = s.name === 'annual_tmin' ? '#2d73c4' : '#d23d30';
        const pts = s.points.sort((a,b) => a.year - b.year)
            .map(p => {
                const x = pad.l + (w - pad.l - pad.r) * (p.year - minYear) / (maxYear - minYear);
                const y = pad.t + (h - pad.t - pad.b) * (1 - (p.value - minVal) / (maxVal - minVal));
                return `${x},${y}`;
            }).join(' ');
        
        svg.innerHTML += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>`;
        
        s.points.forEach(p => {
            const x = pad.l + (w - pad.l - pad.r) * (p.year - minYear) / (maxYear - minYear);
            const y = pad.t + (h - pad.t - pad.b) * (1 - (p.value - minVal) / (maxVal - minVal));
            svg.innerHTML += `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
        });
    });
    
    // Achsenbeschriftung
    svg.innerHTML += `<text x="20" y="200" transform="rotate(-90 20 200)">°C</text>`;
    svg.innerHTML += `<text x="${w/2}" y="${h-5}" text-anchor="middle">Year</text>`;
}

// Karte
function initMap() {
    const lat = Number($('latitude').value);
    const lon = Number($('longitude').value);
    
    if (!state.map) {
        state.map = L.map('leafletMap').setView([lat, lon], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map);
    } else {
        state.map.setView([lat, lon], 7);
    }
    
    // Alte Marker löschen
    state.markers.forEach(m => m.remove());
    state.markers = [];
    
    // Suchzentrum
    L.circleMarker([lat, lon], {
        radius: 8,
        color: '#dc3545',
        fillColor: '#dc3545',
        fillOpacity: 1
    }).addTo(state.map).bindTooltip('Search Center');
    
    // Stationen
    state.stations.forEach(s => {
        const m = L.circleMarker([s.latitude, s.longitude], {
            radius: s.station_id === state.selectedId ? 8 : 6,
            color: s.station_id === state.selectedId ? '#ffc107' : '#28a745',
            fillColor: s.station_id === state.selectedId ? '#ffc107' : '#28a745',
            fillOpacity: 1
        }).addTo(state.map);
        
        m.bindTooltip(`${s.name} (${s.distance_km?.toFixed(1)} km)`);
        m.on('click', () => {
            state.selectedId = s.station_id;
            initMap(); // Karte neu zeichnen
            renderStationTable(); // Tabelle aktualisieren
        });
        
        state.markers.push(m);
    });
    
    // Zoom anpassen
    if (state.stations.length > 0) {
        const bounds = L.latLngBounds([[lat, lon]]);
        state.stations.forEach(s => bounds.extend([s.latitude, s.longitude]));
        state.map.fitBounds(bounds, {padding: [50,50]});
    }
}

// Event Listener
$('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    searchStations();
});

$('showDataButton').addEventListener('click', () => {
    if (state.selectedId) loadClimate();
});

$('backToSearchButton').addEventListener('click', () => showPage('search'));
$('selectNewStationButton').addEventListener('click', () => showPage('stations'));

$('stationSelect').addEventListener('change', (e) => {
    state.selectedId = e.target.value;
    renderStationTable();
    initMap();
});

// Start
showPage('search');