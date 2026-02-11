// Admin Page Logic

// REPLACE THIS WITH YOUR DEPLOYED WEB APP URL (Same as in script.js)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMTRZJHjIsjJOlRQYM_cek9cGvDLBe8v018aBXwl2UoptVRVs6pbwwvvdBx_isCTv9/exec';

(function() {
    try {
        const storedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = storedTheme || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {}
})();

function setupThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    const syncIcon = () => {
        const theme = document.documentElement.getAttribute('data-theme');
        btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    };

    syncIcon();
    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
        syncIcon();
        try { window.dispatchEvent(new Event('themechange')); } catch (e) {}
    });
}

document.addEventListener('DOMContentLoaded', function() {
    setupThemeToggle();
    // Check authentication
    const isAuthenticated = sessionStorage.getItem('adminAuthenticated');
    
    if (!isAuthenticated) {
        showNotification('Access Denied. Please login first.', 'error');
        setTimeout(function() {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            sessionStorage.removeItem('adminAuthenticated');
            window.location.href = 'index.html';
        });
    }

    // Load Data
    fetchTickets();
    setupRefresh();
});

function setupRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            fetchTickets(true);
        };
    }
}

// Helper to toggle Sync Modal
function showSyncModal() {
    const syncModal = document.getElementById('syncModal');
    if (syncModal) syncModal.style.display = 'flex';
}

function hideSyncModal() {
    const syncModal = document.getElementById('syncModal');
    if (syncModal) {
        setTimeout(() => {
            syncModal.style.display = 'none';
        }, 500);
    }
}

function fetchTickets(manual = false) {
    const tableBody = document.getElementById('ticketTableBody');
    const refreshBtn = document.getElementById('refreshBtn');
    let icon = null;

    if (refreshBtn) {
        icon = refreshBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        refreshBtn.disabled = true;
    }

    // Show modal for all syncs
    showSyncModal();

    // Only show loading if table is empty (first load)
    if (tableBody.children.length === 0 || (tableBody.children.length === 1 && tableBody.children[0].innerText.includes('Loading'))) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading tickets...</td></tr>';
    }

    fetch(SCRIPT_URL, {
        method: 'POST', // Using POST to match Code.gs structure
        body: JSON.stringify({ action: 'getTickets' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            renderDashboard(data.data);
            if (manual) showNotification('Dashboard synced successfully.', 'success');
        } else {
            console.error('Error fetching tickets:', data.message);
            if (manual) showNotification('Error fetching data.', 'error');
            if (tableBody.innerHTML.includes('Loading')) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading tickets. Please check console.</td></tr>';
            }
        }
    })
    .catch(error => {
        console.error('Network Error:', error);
        if (manual) showNotification('Network error during sync.', 'error');
        if (tableBody.innerHTML.includes('Loading')) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Network Error. Please try again.</td></tr>';
        }
    })
    .finally(() => {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            if (icon) icon.classList.remove('fa-spin');
        }
        hideSyncModal();
    });
}

function renderDashboard(tickets) {
    dashboardTickets = Array.isArray(tickets) ? tickets : [];
    updateStats(tickets);
    renderCharts(dashboardTickets);
    renderTable(tickets);
}

let dashboardTickets = [];
let redrawChartsQueued = false;

function queueRedrawCharts() {
    if (redrawChartsQueued) return;
    redrawChartsQueued = true;
    requestAnimationFrame(() => {
        redrawChartsQueued = false;
        if (dashboardTickets.length) renderCharts(dashboardTickets);
    });
}

window.addEventListener('resize', queueRedrawCharts);
window.addEventListener('themechange', queueRedrawCharts);

let trendChartState = {
    canvas: null,
    points: [],
    hoverIndex: null,
    meta: null,
    listenersAttached: false,
    rafQueued: false
};

function setTrendHoverIndex(idx) {
    if (trendChartState.hoverIndex === idx) return;
    trendChartState.hoverIndex = idx;
    if (trendChartState.rafQueued) return;
    trendChartState.rafQueued = true;
    requestAnimationFrame(() => {
        trendChartState.rafQueued = false;
        if (!trendChartState.canvas || !trendChartState.points.length) return;
        trendChartState.meta = drawLineChart(trendChartState.canvas, trendChartState.points, { activeIndex: trendChartState.hoverIndex });
    });
}

function getRelativeCanvasPoint(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.clientX;
    const clientY = evt.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function findNearestTrendPoint(meta, x, y) {
    if (!meta || !Array.isArray(meta.ptsPrimary) || meta.ptsPrimary.length === 0) return null;
    let bestIdx = null;
    let bestD2 = Infinity;
    for (let i = 0; i < meta.ptsPrimary.length; i += 1) {
        const p = meta.ptsPrimary[i];
        const dx = p.x - x;
        const dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
            bestD2 = d2;
            bestIdx = i;
        }
    }
    const threshold = 18;
    return bestD2 <= threshold * threshold ? bestIdx : null;
}

function ensureTrendInteractions(canvas) {
    if (trendChartState.listenersAttached) return;
    trendChartState.listenersAttached = true;

    canvas.addEventListener('mousemove', e => {
        if (!trendChartState.meta) return;
        const pt = getRelativeCanvasPoint(canvas, e);
        const idx = findNearestTrendPoint(trendChartState.meta, pt.x, pt.y);
        setTrendHoverIndex(idx);
    });

    canvas.addEventListener('mouseleave', () => {
        setTrendHoverIndex(null);
    });

    const onTouch = e => {
        if (!trendChartState.meta || !e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        const pt = getRelativeCanvasPoint(canvas, t);
        const idx = findNearestTrendPoint(trendChartState.meta, pt.x, pt.y);
        setTrendHoverIndex(idx);
    };

    canvas.addEventListener('touchstart', onTouch, { passive: true });
    canvas.addEventListener('touchmove', onTouch, { passive: true });
    canvas.addEventListener('touchend', () => setTrendHoverIndex(null), { passive: true });
}

function updateTrendChart(canvas, points) {
    trendChartState.canvas = canvas;
    trendChartState.points = Array.isArray(points) ? points : [];
    ensureTrendInteractions(canvas);
    trendChartState.meta = drawLineChart(canvas, trendChartState.points, { activeIndex: trendChartState.hoverIndex });
}

function renderCharts(tickets) {
    const statusCanvas = document.getElementById('statusChart');
    const trendCanvas = document.getElementById('trendChart');
    if (!statusCanvas || !trendCanvas) return;

    const { openCount, pendingCount, closedCount } = getStatusCounts(tickets);
    drawDoughnutChart(statusCanvas, [
        { label: 'Open', value: openCount, color: getCssVar('--primary-color') || '#5b5ce2' },
        { label: 'Pending', value: pendingCount, color: getCssVar('--warning-color') || '#f59e0b' },
        { label: 'Closed', value: closedCount, color: getCssVar('--success-color') || '#10b981' }
    ]);

    const trendPoints = getTrendPoints(tickets, 14);
    updateTrendChart(trendCanvas, trendPoints);
}

function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toDateKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getStatusCounts(tickets) {
    let openCount = 0;
    let pendingCount = 0;
    let closedCount = 0;

    tickets.forEach(t => {
        const s = String(t.status || '').toLowerCase();
        if (s.includes('closed') || s.includes('resolved')) closedCount += 1;
        else if (s.includes('pending') || s.includes('new')) pendingCount += 1;
        else openCount += 1;
    });

    return { openCount, pendingCount, closedCount };
}

function getTrendPoints(tickets, days = 14) {
    const map = new Map();
    tickets.forEach(t => {
        const d = new Date(t.date);
        if (Number.isNaN(d.getTime())) return;
        const key = toDateKey(d);
        map.set(key, (map.get(key) || 0) + 1);
    });

    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const points = [];
    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        const key = toDateKey(d);
        const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        points.push({ label, value: map.get(key) || 0 });
    }
    return points;
}

function setupCanvas(canvas, cssHeight = 220) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(260, rect.width || 0);
    const height = cssHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
}

function drawDoughnutChart(canvas, segments) {
    const { ctx, width, height } = setupCanvas(canvas, 220);
    ctx.clearRect(0, 0, width, height);

    const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);
    const textColor = getCssVar('--text-main') || '#0f172a';
    const subColor = getCssVar('--text-secondary') || '#64748b';

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.34;
    const innerRadius = radius * 0.62;

    if (!total) {
        ctx.fillStyle = subColor;
        ctx.font = '600 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data yet', cx, cy);
        return;
    }

    let start = -Math.PI / 2;
    segments.forEach(seg => {
        const v = seg.value || 0;
        if (!v) return;
        const angle = (v / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, start + angle);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();
        start += angle;
    });

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = textColor;
    ctx.font = '800 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - 6);
    ctx.fillStyle = subColor;
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('tickets', cx, cy + 14);

    const legendX = 14;
    let legendY = 14;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 12px Inter, sans-serif';

    segments.forEach(seg => {
        ctx.fillStyle = seg.color;
        ctx.beginPath();
        roundRectPath(ctx, legendX, legendY - 6, 10, 10, 3);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText(`${seg.label}: ${seg.value}`, legendX + 16, legendY);
        legendY += 18;
    });
}

function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, radius);
        return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
}

function movingAverage(values, windowSize) {
    const size = Math.max(1, Math.floor(windowSize || 1));
    const out = [];
    for (let i = 0; i < values.length; i += 1) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - size + 1); j <= i; j += 1) {
            sum += values[j];
            count += 1;
        }
        out.push(count ? sum / count : values[i]);
    }
    return out;
}

function movingAverageCentered(values, windowSize) {
    const size = Math.max(1, Math.floor(windowSize || 1));
    const half = Math.floor(size / 2);
    const out = [];
    for (let i = 0; i < values.length; i += 1) {
        let sum = 0;
        let count = 0;
        const start = Math.max(0, i - half);
        const end = Math.min(values.length - 1, i + half);
        for (let j = start; j <= end; j += 1) {
            sum += values[j];
            count += 1;
        }
        out.push(count ? sum / count : values[i]);
    }
    return out;
}

function buildSmoothPath(ctx, pts) {
    if (!pts.length) return;
    if (pts.length < 3) {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
        return;
    }

    const n = pts.length;
    const dx = new Array(n - 1);
    const m = new Array(n - 1);
    for (let i = 0; i < n - 1; i += 1) {
        dx[i] = pts[i + 1].x - pts[i].x || 1;
        m[i] = (pts[i + 1].y - pts[i].y) / dx[i];
    }

    const t = new Array(n);
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i += 1) {
        if (m[i - 1] === 0 || m[i] === 0 || m[i - 1] * m[i] < 0) t[i] = 0;
        else t[i] = (m[i - 1] + m[i]) / 2;
    }

    for (let i = 0; i < n - 1; i += 1) {
        if (m[i] === 0) {
            t[i] = 0;
            t[i + 1] = 0;
            continue;
        }
        const a = t[i] / m[i];
        const b = t[i + 1] / m[i];
        const s = a * a + b * b;
        if (s > 9) {
            const k = 3 / Math.sqrt(s);
            t[i] = k * a * m[i];
            t[i + 1] = k * b * m[i];
        }
    }

    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < n - 1; i += 1) {
        const h = dx[i];
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const c1x = p0.x + h / 3;
        const c1y = p0.y + (t[i] * h) / 3;
        const c2x = p1.x - h / 3;
        const c2y = p1.y - (t[i + 1] * h) / 3;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p1.x, p1.y);
    }
}

function drawValueBadge(ctx, x, y, value, label) {
    const fill = 'rgba(15, 23, 42, 0.88)';
    const text = '#ffffff';

    const vText = String(value);
    const lText = String(label || '');

    ctx.font = '800 14px Inter, sans-serif';
    const vW = ctx.measureText(vText).width;
    ctx.font = '600 11px Inter, sans-serif';
    const lW = ctx.measureText(lText).width;

    const padX = 12;
    const padTop = 8;
    const padBottom = 8;
    const gap = lText ? 4 : 0;
    const w = Math.ceil(Math.max(vW, lW) + padX * 2);
    const h = lText ? (padTop + 16 + gap + 12 + padBottom) : (padTop + 16 + padBottom);

    const r = 10;
    const bx = Math.round(x - w / 2);
    const by = Math.round(y - h - 14);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = fill;
    ctx.beginPath();
    roundRectPath(ctx, bx, by, w, h, r);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 14px Inter, sans-serif';
    ctx.fillText(vText, x, by + padTop);
    if (lText) {
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillText(lText, x, by + padTop + 16 + gap);
    }

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x - 7, y - 14);
    ctx.lineTo(x + 7, y - 14);
    ctx.closePath();
    ctx.fill();
}

function drawLineChart(canvas, points, opts = {}) {
    const { ctx, width, height } = setupCanvas(canvas, 220);
    ctx.clearRect(0, 0, width, height);

    const subColor = getCssVar('--text-secondary') || '#64748b';
    const primary = getCssVar('--warning-color') || '#d4a72c';
    const secondary = subColor;

    const padding = { left: 12, right: 12, top: 16, bottom: 16 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (!Array.isArray(points) || points.length === 0) {
        const sub = subColor;
        ctx.fillStyle = sub;
        ctx.font = '600 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data yet', width / 2, height / 2);
        return null;
    }

    const values = points.map(p => Number(p.value) || 0);
    const plotValues = values.map(v => Math.log1p(Math.max(0, v)));
    const primarySeries = movingAverageCentered(plotValues, 5);
    const secondarySeries = movingAverageCentered(plotValues, 9);

    const maxV = Math.max(1, ...primarySeries, ...secondarySeries);
    const minV = 0;

    const toX = idx => padding.left + (chartW * idx) / Math.max(1, points.length - 1);
    const toY = v => padding.top + chartH - ((v - minV) / (maxV - minV)) * chartH;

    const ptsPrimary = primarySeries.map((v, idx) => ({ x: toX(idx), y: toY(v) }));
    const ptsSecondary = secondarySeries.map((v, idx) => ({ x: toX(idx), y: toY(v) }));
    const labels = points.map(p => String(p.label || ''));

    ctx.save();
    ctx.beginPath();
    buildSmoothPath(ctx, ptsPrimary, 1);
    ctx.lineTo(ptsPrimary[ptsPrimary.length - 1].x, padding.top + chartH);
    ctx.lineTo(ptsPrimary[0].x, padding.top + chartH);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    g.addColorStop(0, 'rgba(212, 167, 44, 0.28)');
    g.addColorStop(1, 'rgba(212, 167, 44, 0)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = secondary;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    buildSmoothPath(ctx, ptsSecondary, 1);
    ctx.stroke();

    ctx.strokeStyle = primary;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    buildSmoothPath(ctx, ptsPrimary, 1);
    ctx.stroke();

    let peakIdx = 0;
    for (let i = 1; i < values.length; i += 1) {
        if (values[i] > values[peakIdx]) peakIdx = i;
    }

    const activeIndex = Number.isFinite(opts.activeIndex) ? Math.max(0, Math.min(ptsPrimary.length - 1, opts.activeIndex)) : null;
    const showIdx = activeIndex === null ? peakIdx : activeIndex;
    const peak = ptsPrimary[showIdx];
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    drawValueBadge(ctx, peak.x, peak.y, values[showIdx], labels[showIdx] || 'Tickets');
    return { ptsPrimary, values, labels };
}

function updateStats(tickets) {
    const totalCount = tickets.length;
    const pendingCount = tickets.filter(t => t.status === 'New' || t.status === 'Open').length;
    const resolvedCount = tickets.filter(t => t.status === 'Closed' || t.status === 'Resolved').length;

    // Update DOM
    // Note: In a real app, you'd want IDs on these stat values. 
    // For now, I'll select them by their position or add IDs to admin.html in a next step if needed.
    // But since I can't easily change HTML structure without re-writing, I'll try to select carefully.
    
    // Better approach: Let's assume the order: Total, Pending, Resolved
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 3) {
        statValues[0].textContent = totalCount;
        statValues[1].textContent = pendingCount;
        statValues[2].textContent = resolvedCount;
    }
}

function renderTable(tickets) {
    const tableBody = document.getElementById('ticketTableBody');
    tableBody.innerHTML = ''; // Clear loading/sample data

    if (tickets.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No tickets found.</td></tr>';
        return;
    }

    tickets.slice(0, 5).forEach(ticket => {
        const row = document.createElement('tr');
        
        // Format Date
        let dateStr = ticket.date;
        try {
            const dateObj = new Date(ticket.date);
            if (!isNaN(dateObj)) {
                dateStr = dateObj.toLocaleDateString();
            }
        } catch(e) {}

        // Status Badge Color
        let statusClass = 'status-open';
        const s = ticket.status.toLowerCase();
        if (s === 'new' || s === 'pending') statusClass = 'status-pending';
        if (s === 'closed' || s === 'resolved') statusClass = 'status-closed';

        row.innerHTML = `
            <td>${ticket.id || 'N/A'}</td>
            <td>${ticket.subject || 'No Subject'}</td>
            <td>${ticket.requesterName || 'Unknown'}</td>
            <td>${dateStr}</td>
            <td>
                <span class="status-badge ${statusClass}">${ticket.status}</span>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        if (event.target.id === 'syncModal') return;
        event.target.style.display = 'none';
    }
}
