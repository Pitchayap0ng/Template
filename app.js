// ============================================================
// FINANCE MANAGER — app.js
// Passbook-style personal finance tracker: dashboard, manual
// entries, bank-slip OCR (single + batch), CSV export, activity
// log, 50/30/20 analysis, tax estimate, diagnostics.
// ============================================================

// ============================================================
// 1. CONSTANTS
// ============================================================
const CATEGORIES = [
    { id: 'food', label: 'อาหาร/เครื่องดื่ม', icon: '🍲', color: '#1E5B47' },
    { id: 'transport', label: 'เดินทาง/น้ำมัน', icon: '🚗', color: '#3F7D66' },
    { id: 'shopping', label: 'ชอปปิง', icon: '🛍️', color: '#A9772E' },
    { id: 'bills', label: 'บิล/ค่าน้ำค่าไฟ', icon: '⚡', color: '#C79A4B' },
    { id: 'entertainment', label: 'บันเทิง', icon: '🎬', color: '#7A8B6F' },
    { id: 'other', label: 'อื่นๆ', icon: '📦', color: '#B9AF9C' }
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const STORAGE_KEY = 'finance_app_data';
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

let state = {
    currentMonth: new Date().toISOString().slice(0, 7),
    income: {},
    transactions: [],
    logs: []
};
let selectedCategory = 'food';
let currentScannedImageBase64 = null;
let multiSlipItems = []; // { id, file, base64, status, parsed, error }
let chartMode = 'daily';
let txSearchQuery = '';
let txCategoryFilter = '';
let activeTxId = null;

// ============================================================
// 2. INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    normalizeState();
    initUI();
    initNetStatus();
    renderAll();
});

// ============================================================
// 3. STORAGE
// ============================================================
function normalizeState() {
    if (!state || typeof state !== 'object') {
        state = { currentMonth: new Date().toISOString().slice(0, 7), income: {}, transactions: [], logs: [] };
    }
    if (!state.currentMonth) state.currentMonth = new Date().toISOString().slice(0, 7);
    if (!state.income || typeof state.income !== 'object') state.income = {};
    if (!Array.isArray(state.transactions)) state.transactions = [];
    if (!Array.isArray(state.logs)) state.logs = [];
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        state = JSON.parse(saved);
    } catch (error) {
        console.error('Data parsing error:', error);
        notifyError('โหลดข้อมูลไม่สำเร็จ', 'ข้อมูลเดิมอาจเสียหาย ระบบจะเริ่มต้นข้อมูลใหม่');
    }
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('LocalStorage error:', error);
        notifyError('บันทึกข้อมูลไม่สำเร็จ', 'พื้นที่จัดเก็บข้อมูลของเบราว์เซอร์อาจเต็ม');
    }
}

// ============================================================
// 4. HELPERS — date, money, text
// ============================================================
function todayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
}

function csvEscape(value) {
    return String(value ?? '').replace(/"/g, '""');
}

function formatThaiDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

function normalizeThaiDigits(text) {
    if (!text) return '';
    const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
    return String(text).replace(/[๐-๙]/g, d => String(thaiDigits.indexOf(d)));
}

function normalizeOCRText(text) {
    let result = normalizeThaiDigits(text || '');
    result = result.replace(/\u00A0/g, ' ').replace(/[‐-‒–—]/g, '-').replace(/[|]/g, 'I');
    return result;
}

// ============================================================
// 5. NOTIFICATIONS (SweetAlert2 wrappers)
// ============================================================
function notifySuccess(title, text = '') {
    return Swal.fire({ icon: 'success', title, text, timer: 1800, showConfirmButton: false, timerProgressBar: true });
}
function notifyInfo(title, text = '') {
    return Swal.fire({ icon: 'info', title, text, confirmButtonText: 'ตกลง' });
}
function notifyWarning(title, text = '') {
    return Swal.fire({ icon: 'warning', title, text, confirmButtonText: 'ตกลง' });
}
function notifyError(title, text = '') {
    return Swal.fire({ icon: 'error', title, text, confirmButtonText: 'ตกลง' });
}
async function confirmAction(title, text, confirmText = 'ยืนยัน') {
    const result = await Swal.fire({
        icon: 'question', title, text, showCancelButton: true,
        confirmButtonText: confirmText, cancelButtonText: 'ยกเลิก',
        reverseButtons: true, focusCancel: true
    });
    return result.isConfirmed;
}
function toast(title, icon = 'success') {
    return Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2000, timerProgressBar: true });
}

// ============================================================
// 6. UI INIT
// ============================================================
function initUI() {
    const fDate = document.getElementById('fDate');
    if (fDate) fDate.value = todayStr();

    renderCategoryPickers();
    initNavigation();
    initIncomeInput();
    initManualForm();
    initExportButtons();
    initTaxButton();
    initDiagnostics();
    initSlipScanner();
    initMultiScanActions();
    initChartToggle();
    initTxSearch();
    initTxModal();

    window.addEventListener('resize', () => {
        clearTimeout(window.__financeResizeTimer);
        window.__financeResizeTimer = setTimeout(renderChart, 150);
    });
}

function renderCategoryPickers() {
    const catGrid = document.getElementById('catGrid');
    if (catGrid) {
        catGrid.innerHTML = CATEGORIES.map(c => `
            <div class="cat-item ${c.id === selectedCategory ? 'active' : ''}" data-id="${c.id}">
                <span class="cat-icon">${c.icon}</span>
                <span>${escapeHtml(c.label)}</span>
            </div>
        `).join('');
        catGrid.querySelectorAll('.cat-item').forEach(el => {
            el.addEventListener('click', () => {
                catGrid.querySelectorAll('.cat-item').forEach(item => item.classList.remove('active'));
                el.classList.add('active');
                selectedCategory = el.dataset.id;
            });
        });
    }
    const resCat = document.getElementById('resCategory');
    if (resCat) resCat.innerHTML = buildCategoryOptions();
}

function buildCategoryOptions(selected) {
    return CATEGORIES.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.icon} ${escapeHtml(c.label)}</option>`).join('');
}

// ============================================================
// 7. NAVIGATION (tabs / dropdown / underline)
// ============================================================
function initNavigation() {
    const tabs = document.getElementById('tabs');
    const underline = document.getElementById('underline');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const dropdownBtn = document.getElementById('dropdownBtn');

    function updateUnderline(btn) {
        if (!btn || !underline || !tabs) return;
        const rect = btn.getBoundingClientRect();
        const parentRect = tabs.getBoundingClientRect();
        underline.style.width = `${rect.width}px`;
        underline.style.left = `${rect.left - parentRect.left}px`;
    }

    document.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const pageId = btn.dataset.page;
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            document.getElementById(pageId)?.classList.add('active');
            document.querySelectorAll('#tabs > button, .dropdown-menu button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const inDropdown = dropdownMenu && dropdownMenu.contains(btn);
            if (inDropdown) {
                dropdownBtn?.classList.add('active');
            }
            dropdownMenu?.classList.remove('show');
            updateUnderline(inDropdown ? dropdownBtn : btn);
            renderAll();
        });
    });

    dropdownBtn?.addEventListener('click', event => {
        event.stopPropagation();
        dropdownMenu?.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdownMenu?.classList.remove('show'));

    setTimeout(() => updateUnderline(tabs?.querySelector('button.active')), 80);
}

function initNetStatus() {
    const badge = document.getElementById('netStatus');
    if (!badge) return;
    function update() {
        const online = navigator.onLine;
        badge.textContent = online ? 'ออนไลน์' : 'ออฟไลน์';
        badge.classList.toggle('offline', !online);
    }
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
}

// ============================================================
// 8. CATEGORY SELECT (used by OCR result form)
// ============================================================
function selectCategory(categoryId) {
    if (!CATEGORY_MAP[categoryId]) return;
    selectedCategory = categoryId;
    document.querySelectorAll('.cat-item').forEach(el => el.classList.toggle('active', el.dataset.id === categoryId));
}

// ============================================================
// 9. MONTH NAVIGATION
// ============================================================
function shiftMonth(delta) {
    const [year, month] = state.currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    state.currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    save();
    renderAll();
}

function renderMonthLabels() {
    const [year, month] = state.currentMonth.split('-').map(Number);
    const text = `${THAI_MONTHS[month - 1]} ${year + 543}`;
    ['monthLabel', 'monthLabel2', 'monthLabel3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });
    const passbookMonth = document.getElementById('passbookMonth');
    if (passbookMonth) passbookMonth.textContent = text;
    const stamp = document.getElementById('passbookStamp');
    if (stamp) stamp.innerHTML = `${THAI_MONTHS_SHORT[month - 1].replace('.', '')}<br>${String(year + 543).slice(-2)}`;
}

// ============================================================
// 10. RENDER ALL
// ============================================================
function renderAll() {
    renderMonthLabels();
    renderDashboard();
    renderTransactions();
    renderAnalysis();
    renderLogs();
    renderChart();
}

// ============================================================
// 11. DASHBOARD (passbook + donut)
// ============================================================
function renderDashboard() {
    const income = Number(state.income[state.currentMonth] || 0);
    const incomeInput = document.getElementById('incomeInput');
    if (incomeInput && document.activeElement !== incomeInput) {
        incomeInput.value = income || '';
    }

    const monthTx = state.transactions.filter(tx => String(tx.date || '').startsWith(state.currentMonth));
    const expense = monthTx.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const remaining = income - expense;

    const expenseEl = document.getElementById('totalExpenseVal');
    const remainingEl = document.getElementById('remainingVal');
    if (expenseEl) expenseEl.textContent = `฿${formatMoney(expense)}`;
    if (remainingEl) {
        remainingEl.textContent = `฿${formatMoney(remaining)}`;
        remainingEl.style.color = remaining >= 0 ? '#A8D8BE' : '#E3AFA0';
    }

    const rangeLabel = document.getElementById('rangeLabel');
    if (rangeLabel) rangeLabel.textContent = `${monthTx.length} รายการเดือนนี้`;

    renderDonut(monthTx, expense);
}

function renderDonut(transactions, total) {
    const donut = document.getElementById('donut');
    const legend = document.getElementById('legend');
    if (!donut || !legend) return;

    if (total <= 0) {
        donut.style.background = 'conic-gradient(var(--paper-line) 0deg 360deg)';
        legend.innerHTML = `<div class="legend-empty">ยังไม่มีรายจ่ายในเดือนนี้</div>`;
        return;
    }

    const totals = {};
    transactions.forEach(tx => {
        totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount || 0);
    });

    let degree = 0;
    const stops = [];
    let html = '';
    CATEGORIES.forEach(category => {
        const amount = totals[category.id] || 0;
        if (amount <= 0) return;
        const percent = (amount / total) * 100;
        const deg = (amount / total) * 360;
        stops.push(`${category.color} ${degree}deg ${degree + deg}deg`);
        degree += deg;
        html += `
            <div class="legend-item">
                <span class="name"><span class="legend-dot" style="background:${category.color};"></span>${category.icon} ${escapeHtml(category.label)}</span>
                <span class="amt">฿${formatMoney(amount)} · ${percent.toFixed(0)}%</span>
            </div>
        `;
    });
    donut.style.background = `conic-gradient(${stops.join(',')})`;
    legend.innerHTML = html;
}

// ============================================================
// 12. CHART (daily / monthly)
// ============================================================
function initChartToggle() {
    const dailyBtn = document.getElementById('chartDailyBtn');
    const monthlyBtn = document.getElementById('chartMonthlyBtn');
    dailyBtn?.addEventListener('click', () => {
        chartMode = 'daily';
        dailyBtn.classList.add('active');
        monthlyBtn?.classList.remove('active');
        renderChart();
    });
    monthlyBtn?.addEventListener('click', () => {
        chartMode = 'monthly';
        monthlyBtn.classList.add('active');
        dailyBtn?.classList.remove('active');
        renderChart();
    });
}

function getChartData() {
    if (chartMode === 'daily') {
        const [year, month] = state.currentMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const labels = [];
        const income = [];
        const expense = [];
        const dailyIncome = Number(state.income[state.currentMonth] || 0) / daysInMonth;
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${state.currentMonth}-${String(day).padStart(2, '0')}`;
            const dayExpense = state.transactions
                .filter(tx => tx.date === dateStr)
                .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
            labels.push(String(day));
            income.push(dayExpense > 0 || day === daysInMonth ? dailyIncome : 0);
            expense.push(dayExpense);
        }
        return { labels, income, expense };
    }
    // monthly: last 6 months ending at currentMonth
    const [year, month] = state.currentMonth.split('-').map(Number);
    const labels = [];
    const income = [];
    const expense = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date(year, month - 1 - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        labels.push(THAI_MONTHS_SHORT[date.getMonth()]);
        income.push(Number(state.income[key] || 0));
        expense.push(state.transactions.filter(tx => String(tx.date || '').startsWith(key))
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0));
    }
    return { labels, income, expense };
}

function renderChart() {
    const canvas = document.getElementById('incomeExpenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const data = getChartData();
    const padding = { top: 10, right: 8, bottom: 20, left: 8 };
    const chartHeight = height - padding.top - padding.bottom;
    const chartWidth = width - padding.left - padding.right;
    const maxValue = Math.max(1, ...data.income, ...data.expense);
    const count = data.labels.length;
    const groupWidth = chartWidth / count;
    const barWidth = Math.max(2, Math.min(16, groupWidth * 0.32));

    for (let i = 0; i < count; i++) {
        const center = padding.left + groupWidth * i + groupWidth / 2;
        const incomeHeight = (data.income[i] / maxValue) * chartHeight;
        const expenseHeight = (data.expense[i] / maxValue) * chartHeight;

        ctx.fillStyle = '#1E5B47';
        ctx.fillRect(center - barWidth - 1, padding.top + chartHeight - incomeHeight, barWidth, Math.max(1, incomeHeight));

        ctx.fillStyle = '#A2382B';
        ctx.fillRect(center + 1, padding.top + chartHeight - expenseHeight, barWidth, Math.max(1, expenseHeight));

        const labelStep = Math.ceil(count / 12);
        if (i % labelStep === 0) {
            ctx.fillStyle = '#8B8171';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = '10px "IBM Plex Mono", monospace';
            ctx.fillText(data.labels[i], center, padding.top + chartHeight + 6);
        }
    }

    renderChartSummary(data);
}

function renderChartSummary(data) {
    const el = document.getElementById('chartSummary');
    if (!el) return;
    const income = data.income.reduce((sum, v) => sum + v, 0);
    const expense = data.expense.reduce((sum, v) => sum + v, 0);
    const remaining = income - expense;
    el.innerHTML = `
        <div class="chart-stat"><div class="lbl">รายรับ</div><div class="val" style="color:var(--pine-dark);">฿${formatMoney(income)}</div></div>
        <div class="chart-stat"><div class="lbl">รายจ่าย</div><div class="val" style="color:var(--red);">฿${formatMoney(expense)}</div></div>
        <div class="chart-stat"><div class="lbl">คงเหลือ</div><div class="val" style="color:${remaining >= 0 ? 'var(--pine-dark)' : 'var(--red)'};">฿${formatMoney(remaining)}</div></div>
    `;
}

// ============================================================
// 13. INCOME INPUT
// ============================================================
function initIncomeInput() {
    const incomeInput = document.getElementById('incomeInput');
    incomeInput?.addEventListener('change', async event => {
        const value = parseFloat(event.target.value) || 0;
        const oldValue = state.income[state.currentMonth] || 0;
        if (value !== oldValue) {
            state.income[state.currentMonth] = value;
            save();
            addLog('update_income', { month: state.currentMonth, amount: `฿${formatMoney(value)}` });
            renderAll();
            toast('บันทึกรายรับเรียบร้อย');
        }
    });
}

// ============================================================
// 14. MANUAL TRANSACTION
// ============================================================
function initManualForm() {
    const form = document.getElementById('entryForm');
    if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const date = document.getElementById('fDate')?.value || todayStr();
        const time = document.getElementById('fTime')?.value || '';
        const amount = parseFloat(document.getElementById('fAmount')?.value || 0);
        const type = document.querySelector('input[name="type"]:checked')?.value || 'cash';
        const sender = document.getElementById('fSender')?.value.trim() || '';
        const receiver = document.getElementById('fReceiver')?.value.trim() || '';
        const note = document.getElementById('fNote')?.value.trim() || '';

        if (!amount || amount <= 0) {
            await notifyWarning('จำนวนเงินไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินมากกว่า 0');
            return;
        }

        const category = CATEGORY_MAP[selectedCategory];
        const tx = {
            id: Date.now(),
            date, time, amount, category: selectedCategory, type, note,
            sender, receiver
        };
        state.transactions.push(tx);
        save();
        addLog('add_transaction', {
            date, amount: `฿${formatMoney(amount)}`, category: category?.label || selectedCategory,
            people: sender || receiver ? `${sender || '?'} → ${receiver || '?'}` : '', note
        });

        document.getElementById('fAmount').value = '';
        document.getElementById('fTime').value = '';
        document.getElementById('fSender').value = '';
        document.getElementById('fReceiver').value = '';
        document.getElementById('fNote').value = '';
        renderAll();
        await notifySuccess('บันทึกรายการเรียบร้อย', `฿${formatMoney(amount)}`);
    });
}

// ============================================================
// 15. TRANSACTIONS LIST — search, filter, grouping
// ============================================================
function initTxSearch() {
    const input = document.getElementById('txSearchInput');
    const clearBtn = document.getElementById('txSearchClear');
    const catFilter = document.getElementById('txCategoryFilter');

    if (catFilter) {
        catFilter.innerHTML = `<option value="">ทุกหมวดหมู่</option>` + buildCategoryOptions();
    }

    input?.addEventListener('input', () => {
        txSearchQuery = input.value;
        if (clearBtn) clearBtn.style.display = txSearchQuery ? 'flex' : 'none';
        renderTransactions();
    });

    clearBtn?.addEventListener('click', () => {
        if (input) input.value = '';
        txSearchQuery = '';
        clearBtn.style.display = 'none';
        renderTransactions();
        input?.focus();
    });

    catFilter?.addEventListener('change', () => {
        txCategoryFilter = catFilter.value;
        renderTransactions();
    });
}

function matchesTxSearch(tx, query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const category = CATEGORY_MAP[tx.category] || CATEGORY_MAP.other;
    const typeLabel = tx.type === 'cash' ? 'เงินสด' : 'โอน/บัตร';
    const haystack = [
        tx.note, tx.sender, tx.receiver, category.label, category.id,
        tx.date, formatThaiDate(tx.date), tx.time, typeLabel,
        formatMoney(tx.amount), String(tx.amount)
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
}

function getFilteredTransactions() {
    const query = txSearchQuery.trim();
    const searching = query.length > 0;

    let list = searching
        ? state.transactions.slice()
        : state.transactions.filter(tx => String(tx.date || '').startsWith(state.currentMonth));

    if (txCategoryFilter) list = list.filter(tx => tx.category === txCategoryFilter);
    if (searching) list = list.filter(tx => matchesTxSearch(tx, query));

    list.sort((a, b) => (String(b.date || '') + String(b.time || '')).localeCompare(String(a.date || '') + String(a.time || '')) || Number(b.id) - Number(a.id));
    return { list, searching };
}

function renderTransactions() {
    const list = document.getElementById('txList');
    const hint = document.getElementById('txSearchHint');
    if (!list) return;

    const { list: transactions, searching } = getFilteredTransactions();

    if (hint) {
        if (searching) {
            hint.style.display = 'block';
            hint.textContent = transactions.length
                ? `พบ ${transactions.length} รายการ · ค้นหาทุกเดือน`
                : `ไม่พบรายการที่ตรงกับ "${txSearchQuery.trim()}"`;
        } else {
            hint.style.display = 'none';
            hint.textContent = '';
        }
    }

    if (!transactions.length) {
        list.innerHTML = searching
            ? `<div class="empty-state"><span class="icon">🔎</span>ไม่พบรายการที่ตรงกับการค้นหา</div>`
            : `<div class="empty-state"><span class="icon">📖</span>ยังไม่มีรายการในเดือนนี้</div>`;
        return;
    }

    const grouped = {};
    transactions.forEach(tx => {
        (grouped[tx.date] ||= []).push(tx);
    });

    let html = '';
    Object.entries(grouped).forEach(([date, items]) => {
        html += `<div class="tx-group"><div class="tx-date-title">${formatThaiDate(date)}</div>`;
        items.forEach(tx => {
            const category = CATEGORY_MAP[tx.category] || CATEGORY_MAP.other;
            const people = tx.sender || tx.receiver
                ? `<div class="tx-people">${tx.sender ? `ผู้โอน: ${escapeHtml(tx.sender)}` : ''}${tx.sender && tx.receiver ? ' → ' : ''}${tx.receiver ? `ผู้รับ: ${escapeHtml(tx.receiver)}` : ''}</div>`
                : '';
            html += `
                <div class="tx-card" data-id="${tx.id}" onclick="openTxDetail(${Number(tx.id)})">
                    <div class="tx-icon">${category.icon}</div>
                    <div class="tx-info">
                        <div class="tx-title">${escapeHtml(tx.note || category.label)}</div>
                        <div class="tx-sub">${tx.type === 'cash' ? 'เงินสด' : 'โอน/บัตร'}${tx.time ? ` · ${escapeHtml(tx.time)}` : ''}</div>
                        ${people}
                    </div>
                    <div class="tx-amount-col">
                        <div class="tx-amount">-฿${formatMoney(tx.amount)}</div>
                        <button class="tx-delete" onclick="event.stopPropagation(); deleteTx(${Number(tx.id)})">ลบ</button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    });
    list.innerHTML = html;
}

// ============================================================
// 15b. TRANSACTION DETAIL / EDIT MODAL
// ============================================================
function initTxModal() {
    const overlay = document.getElementById('txModalOverlay');
    const txmCat = document.getElementById('txmCategory');
    if (txmCat) txmCat.innerHTML = buildCategoryOptions();

    document.getElementById('txModalCloseBtn')?.addEventListener('click', closeTxModal);
    document.getElementById('txmSaveBtn')?.addEventListener('click', saveTxDetail);
    document.getElementById('txmDeleteBtn')?.addEventListener('click', deleteTxFromModal);
    overlay?.addEventListener('click', event => {
        if (event.target === overlay) closeTxModal();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeTxModal();
    });
}

function openTxDetail(id) {
    const tx = state.transactions.find(t => Number(t.id) === Number(id));
    if (!tx) return;
    activeTxId = tx.id;

    const setVal = (elId, value) => { const el = document.getElementById(elId); if (el) el.value = value; };
    setVal('txmDate', tx.date || '');
    setVal('txmTime', tx.time || '');
    setVal('txmAmount', tx.amount ?? '');
    setVal('txmCategory', tx.category || 'other');
    setVal('txmSender', tx.sender || '');
    setVal('txmReceiver', tx.receiver || '');
    setVal('txmNote', tx.note || '');
    document.querySelectorAll('input[name="txmType"]').forEach(radio => {
        radio.checked = radio.value === (tx.type || 'cash');
    });

    const meta = document.getElementById('txModalMeta');
    if (meta) meta.textContent = `รหัสรายการ #${tx.id}`;

    document.getElementById('txModalOverlay')?.classList.add('show');
    document.body.classList.add('modal-open');
}

function closeTxModal() {
    document.getElementById('txModalOverlay')?.classList.remove('show');
    document.body.classList.remove('modal-open');
    activeTxId = null;
}

async function saveTxDetail() {
    if (activeTxId == null) return;
    const tx = state.transactions.find(t => Number(t.id) === Number(activeTxId));
    if (!tx) return;

    const date = document.getElementById('txmDate')?.value || tx.date;
    const time = document.getElementById('txmTime')?.value || '';
    const amount = parseFloat(document.getElementById('txmAmount')?.value || 0);
    const category = document.getElementById('txmCategory')?.value || 'other';
    const type = document.querySelector('input[name="txmType"]:checked')?.value || 'cash';
    const sender = document.getElementById('txmSender')?.value.trim() || '';
    const receiver = document.getElementById('txmReceiver')?.value.trim() || '';
    const note = document.getElementById('txmNote')?.value.trim() || '';

    if (!date) {
        await notifyWarning('ยังไม่ได้ระบุวันที่', 'กรุณาเลือกวันที่ของรายการ');
        return;
    }
    if (!amount || amount <= 0) {
        await notifyWarning('จำนวนเงินไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินมากกว่า 0');
        return;
    }

    Object.assign(tx, { date, time, amount, category, type, sender, receiver, note });
    save();
    addLog('edit_transaction', {
        date, amount: `฿${formatMoney(amount)}`,
        people: sender || receiver ? `${sender || '?'} → ${receiver || '?'}` : '', note
    });
    closeTxModal();
    renderAll();
    toast('บันทึกการแก้ไขเรียบร้อย');
}

async function deleteTxFromModal() {
    if (activeTxId == null) return;
    const id = activeTxId;
    closeTxModal();
    await deleteTx(id);
}

async function deleteTx(id) {
    const transaction = state.transactions.find(tx => Number(tx.id) === Number(id));
    if (!transaction) return;
    const category = CATEGORY_MAP[transaction.category];
    const confirmed = await confirmAction('ยืนยันการลบรายการ?',
        `฿${formatMoney(transaction.amount)} · ${transaction.note || category?.label || ''}\n\nการลบไม่สามารถย้อนกลับได้`, 'ลบรายการ');
    if (!confirmed) return;

    state.transactions = state.transactions.filter(tx => Number(tx.id) !== Number(id));
    save();
    addLog('delete_transaction', { amount: `฿${formatMoney(transaction.amount)}`, note: transaction.note || '' });
    renderAll();
    toast('ลบรายการเรียบร้อย');
}

// ============================================================
// 16. ANALYSIS (50/30/20)
// ============================================================
function renderAnalysis() {
    const income = Number(state.income[state.currentMonth] || 0);
    const transactions = state.transactions.filter(tx => String(tx.date || '').startsWith(state.currentMonth));
    const expense = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const needs = transactions.filter(tx => ['food', 'transport', 'bills'].includes(tx.category)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const wants = transactions.filter(tx => ['shopping', 'entertainment', 'other'].includes(tx.category)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const savings = Math.max(0, income - expense);

    const bars = document.getElementById('barRows');
    if (bars) {
        bars.innerHTML = [
            renderBar('ความจำเป็น (Needs) เป้า 50%', needs, income * 0.5),
            renderBar('ความต้องการ (Wants) เป้า 30%', wants, income * 0.3),
            renderBar('เงินออม/การลงทุน (Savings) เป้า 20%', savings, income * 0.2, true)
        ].join('');
    }

    const tips = document.getElementById('tipsList');
    if (!tips) return;
    const list = [];
    if (!income) {
        list.push('กรอกรายรับเดือนนี้ในหน้าภาพรวมเพื่อดูคำแนะนำที่แม่นยำขึ้น');
    } else {
        if (needs > income * 0.5) list.push('ค่าใช้จ่ายจำเป็นเกิน 50% ของรายได้');
        if (wants > income * 0.3) list.push('ค่าใช้จ่ายด้านความต้องการเกิน 30%');
        list.push(savings >= income * 0.2 ? 'ออมได้ถึงเป้า 20% แล้ว รักษาระดับนี้ไว้' : 'ลองเพิ่มเงินออมให้ถึง 20% ของรายรับ');
    }
    tips.innerHTML = list.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderBar(label, actual, target, isSavings = false) {
    const percent = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
    const over = !isSavings && target > 0 && actual > target;
    return `
        <div class="bar-row">
            <div class="bar-lbl">
                <span class="name">${label}</span>
                <span class="figures ${over ? 'over' : ''}">฿${formatMoney(actual)} / ฿${formatMoney(target)}</span>
            </div>
            <div class="bar-bg"><div class="bar-fill ${over ? 'over' : ''}" style="width:${percent}%;"></div></div>
        </div>
    `;
}

// ============================================================
// 17. TAX CALCULATOR
// ============================================================
function initTaxButton() {
    document.getElementById('taxCalcBtn')?.addEventListener('click', () => {
        const income = parseFloat(document.getElementById('taxIncome')?.value || 0);
        if (!income) {
            notifyWarning('ยังไม่ได้กรอกรายได้', 'กรุณากรอกรายได้ทั้งปีก่อน');
            return;
        }
        calculateTax();
    });
}

function calculateTax() {
    const income = parseFloat(document.getElementById('taxIncome')?.value || 0);
    const deduct = parseFloat(document.getElementById('taxDeduct')?.value || 0);
    const netIncome = Math.max(0, income - deduct);
    let tax = 0;
    if (netIncome > 750000) tax = 65000 + (netIncome - 750000) * 0.20;
    else if (netIncome > 500000) tax = 27500 + (netIncome - 500000) * 0.15;
    else if (netIncome > 300000) tax = 7500 + (netIncome - 300000) * 0.10;
    else if (netIncome > 150000) tax = (netIncome - 150000) * 0.05;

    const result = document.getElementById('taxResult');
    if (!result) return;
    result.innerHTML = `
        <div class="tax-result">
            <div class="row"><span>เงินได้สุทธิ</span><span class="val">฿${formatMoney(netIncome)}</span></div>
            <div class="headline"><span>ภาษีประเมิน</span><span class="val">฿${formatMoney(tax)}</span></div>
        </div>
        <div class="tax-note">ใช้เพื่อประมาณการเบื้องต้นเท่านั้น ไม่ใช่คำแนะนำด้านภาษี</div>
    `;
    addLog('tax_calculation', { income: `฿${formatMoney(income)}`, tax: `฿${formatMoney(tax)}` });
}

// ============================================================
// 18. ACTIVITY LOG
// ============================================================
const LOG_LABELS = {
    add_transaction: 'เพิ่มรายการ',
    edit_transaction: 'แก้ไขรายการ',
    delete_transaction: 'ลบรายการ',
    update_income: 'อัปเดตรายรับ',
    scan_receipt: 'บันทึกจากสลิป',
    tax_calculation: 'คำนวณภาษี',
    system_test: 'ทดสอบระบบ',
    export_csv: 'ส่งออก CSV',
    export_logs: 'ส่งออกประวัติ'
};

function addLog(action, details = {}) {
    state.logs.push({ timestamp: new Date().toISOString(), action, details });
    if (state.logs.length > 500) state.logs = state.logs.slice(-500);
    save();
}

function renderLogs() {
    const list = document.getElementById('logList');
    if (!list) return;
    if (!state.logs.length) {
        list.innerHTML = `<div class="empty-state"><span class="icon">🕓</span>ยังไม่มีประวัติการใช้งาน</div>`;
        return;
    }
    list.innerHTML = state.logs.slice(-30).reverse().map(log => {
        const time = new Date(log.timestamp);
        const timeStr = Number.isNaN(time.getTime()) ? '' : time.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const detail = Object.values(log.details || {}).filter(Boolean).join(' · ');
        return `
            <div class="log-item">
                <div>
                    <div class="label">${escapeHtml(LOG_LABELS[log.action] || log.action)}</div>
                    ${detail ? `<div class="detail">${escapeHtml(detail)}</div>` : ''}
                </div>
                <div class="time">${timeStr}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
// 19. DIAGNOSTICS
// ============================================================
function initDiagnostics() {
    document.getElementById('runTestBtn')?.addEventListener('click', runSystemDiagnostics);
}

function runSystemDiagnostics() {
    const results = document.getElementById('testResultsList');
    if (!results) return;

    const localStorageOK = (() => {
        try {
            localStorage.setItem('__finance_test__', '1');
            localStorage.removeItem('__finance_test__');
            return true;
        } catch (error) { return false; }
    })();
    const canvasOK = !!document.createElement('canvas').getContext;
    const tesseractOK = typeof Tesseract !== 'undefined';
    const sweetAlertOK = typeof Swal !== 'undefined';
    const checks = [
        ['LocalStorage', localStorageOK],
        ['Canvas', canvasOK],
        ['Tesseract.js OCR', tesseractOK],
        ['SweetAlert2', sweetAlertOK]
    ];
    const allOK = checks.every(c => c[1]);

    results.innerHTML = checks.map(([name, ok]) => `
        <div class="diag-row">
            <span>${escapeHtml(name)}</span>
            <span class="diag-status ${ok ? 'ok' : 'fail'}">${ok ? 'พร้อมใช้งาน' : 'ไม่พบ'}</span>
        </div>
    `).join('') + `<div class="diag-summary ${allOK ? 'ok' : 'fail'}">${allOK ? 'ระบบพื้นฐานพร้อมใช้งาน' : 'พบระบบบางส่วนที่ต้องตรวจสอบ'}</div>`;

    addLog('system_test', { result: allOK ? 'ผ่าน' : 'พบปัญหา' });
    toast('ทดสอบระบบเสร็จแล้ว');
}

// ============================================================
// 20. CSV EXPORT
// ============================================================
function initExportButtons() {
    document.getElementById('exportCsv')?.addEventListener('click', exportTransactionsCSV);
    document.getElementById('exportLogsBtn')?.addEventListener('click', exportLogsCSV);
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

function exportTransactionsCSV() {
    if (!state.transactions.length) {
        notifyInfo('ไม่มีข้อมูล', 'ไม่มีรายการสำหรับส่งออก CSV');
        return;
    }
    let csv = '\uFEFFID,Date,Time,Amount,Category,Type,Sender,Receiver,Note\n';
    state.transactions.forEach(tx => {
        csv += `"${csvEscape(tx.id)}","${csvEscape(tx.date)}","${csvEscape(tx.time || '')}","${csvEscape(tx.amount)}","${csvEscape(tx.category)}","${csvEscape(tx.type)}","${csvEscape(tx.sender || '')}","${csvEscape(tx.receiver || '')}","${csvEscape(tx.note || '')}"\n`;
    });
    downloadCSV(csv, `transactions_${state.currentMonth}.csv`);
    addLog('export_csv', { count: `${state.transactions.length} รายการ` });
    notifySuccess('ส่งออก CSV เรียบร้อย');
}

function exportLogsCSV() {
    if (!state.logs.length) {
        notifyInfo('ไม่มีข้อมูล', 'ไม่มีประวัติกิจกรรม');
        return;
    }
    let csv = '\uFEFFTimestamp,Action,Details\n';
    state.logs.forEach(log => {
        csv += `"${csvEscape(log.timestamp)}","${csvEscape(log.action)}","${csvEscape(JSON.stringify(log.details || {}))}"\n`;
    });
    downloadCSV(csv, 'activity_logs.csv');
    notifySuccess('ส่งออกประวัติเรียบร้อย');
}

// ============================================================
// 21. IMAGE HELPERS
// ============================================================
function compressImage(file, maxSide = 1600, quality = 0.9) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = event => {
            const image = new Image();
            image.onerror = reject;
            image.onload = () => {
                let width = image.width;
                let height = image.height;
                if (width > maxSide || height > maxSide) {
                    if (width > height) { height = Math.round(height * maxSide / width); width = maxSide; }
                    else { width = Math.round(width * maxSide / height); height = maxSide; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            image.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function enhanceSlipForOCR(base64) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
            try {
                const maxWidth = 1800;
                const scale = Math.min(1.5, maxWidth / image.width);
                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                const contrast = 1.45;
                const intercept = 128 * (1 - contrast);
                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    const adjusted = Math.max(0, Math.min(255, gray * contrast + intercept));
                    data[i] = data[i + 1] = data[i + 2] = adjusted;
                }
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } catch (error) { reject(error); }
        };
        image.src = base64;
    });
}

// ============================================================
// 22. OCR PARSING — bank detection, amount, date, time, people
// ============================================================
function detectBank(text) {
    const lower = String(text || '').toLowerCase();
    if (['kbank', 'kasikorn', 'กสิกร', 'k plus', 'k+', 'make by'].some(w => lower.includes(w))) return 'kbank';
    return 'unknown';
}

function extractBestAmount(text, bank = 'unknown') {
    const source = normalizeOCRText(text);
    const candidates = [];

    function addCandidate(raw, score) {
        if (!raw) return;
        let cleaned = String(raw).trim().replace(/฿/g, '').replace(/บาท/gi, '').replace(/[\s,]/g, '').replace(/[^\d.]/g, '');
        const dotCount = (cleaned.match(/\./g) || []).length;
        if (dotCount > 1) {
            const parts = cleaned.split('.');
            const decimal = parts.pop();
            cleaned = parts.join('') + '.' + decimal;
        }
        const value = Number(cleaned);
        if (!Number.isFinite(value) || value <= 0 || value >= 5000000) return;
        if (Number.isInteger(value) && !/[฿]|บาท|,\d{3}|\.\d{2}/.test(String(raw))) score -= 18;
        candidates.push({ value, score });
    }

    const lines = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (bank === 'kbank') {
        const amountLabels = ['จำนวนเงิน', 'จำนวน', 'ยอดเงิน', 'ยอดโอน', 'amount', 'total', 'โอนเงินสำเร็จ'];
        lines.forEach((line, index) => {
            if (!amountLabels.some(l => line.toLowerCase().includes(l))) return;
            (line.match(/(?:฿\s*)?[\d][\d,\s]*(?:\.\d{1,2})?/g) || []).forEach(raw => addCandidate(raw, 250));
            for (let offset = 1; offset <= 2; offset++) {
                const next = lines[index + offset] || '';
                if (!next || /เลขที่|เลขอ้างอิง|reference|ref|transaction|บัญชี|account|ค่าธรรมเนียม|fee|พร้อมเพย์|promptpay|วันที่|เวลา|date|time/i.test(next)) continue;
                (next.match(/(?:฿\s*)?[\d][\d,\s]*\.\d{1,2}/g) || []).forEach(raw => addCandidate(raw, offset === 1 ? 235 : 215));
            }
        });
    }

    const moneyRegex = /(?:฿\s*)?(\d{1,3}(?:[,\s]\d{3})*\.\d{2}|\d+\.\d{2})/g;
    for (const match of source.matchAll(moneyRegex)) {
        const before = source.slice(Math.max(0, match.index - 70), match.index).toLowerCase();
        const after = source.slice(match.index, match.index + 100).toLowerCase();
        let score = 55;
        if (/จำนวนเงิน|ยอดเงิน|ยอดโอน|amount|total|payment|ชำระ|บาท|baht|thb/.test(before + after)) score += 80;
        if (/ค่าธรรมเนียม|fee|เลขที่|reference|ref|บัญชี|account|promptpay|พร้อมเพย์/.test(before + after)) score -= 100;
        if (/วันที่|date|\b20\d{2}\b|\b25\d{2}\b|เวลา|time/.test(before + after)) score -= 90;
        addCandidate(match[1], score);
    }

    if (!candidates.length) return null;
    const unique = [];
    candidates.forEach(c => {
        const existing = unique.find(u => Math.abs(u.value - c.value) < 0.001);
        if (existing) existing.score = Math.max(existing.score, c.score);
        else unique.push({ ...c });
    });
    unique.sort((a, b) => b.score - a.score);
    return unique[0]?.value || null;
}

function extractDate(text) {
    const source = normalizeOCRText(text);
    const thaiMonths = {
        'ม.ค.': '01', 'มกราคม': '01', 'ก.พ.': '02', 'กุมภาพันธ์': '02', 'มี.ค.': '03', 'มีนาคม': '03',
        'เม.ย.': '04', 'เมษายน': '04', 'พ.ค.': '05', 'พฤษภาคม': '05', 'มิ.ย.': '06', 'มิถุนายน': '06',
        'ก.ค.': '07', 'กรกฎาคม': '07', 'ส.ค.': '08', 'สิงหาคม': '08', 'ก.ย.': '09', 'กันยายน': '09',
        'ต.ค.': '10', 'ตุลาคม': '10', 'พ.ย.': '11', 'พฤศจิกายน': '11', 'ธ.ค.': '12', 'ธันวาคม': '12'
    };
    const thaiDateRegex = /(\d{1,2})\s+(ม\.ค\.|มกราคม|ก\.พ\.|กุมภาพันธ์|มี\.ค\.|มีนาคม|เม\.ย\.|เมษายน|พ\.ค\.|พฤษภาคม|มิ\.ย\.|มิถุนายน|ก\.ค\.|กรกฎาคม|ส\.ค\.|สิงหาคม|ก\.ย\.|กันยายน|ต\.ค\.|ตุลาคม|พ\.ย\.|พฤศจิกายน|ธ\.ค\.|ธันวาคม)\s+(\d{4})/i;
    const thaiMatch = source.match(thaiDateRegex);
    if (thaiMatch) {
        const day = String(thaiMatch[1]).padStart(2, '0');
        const month = thaiMonths[thaiMatch[2]];
        let year = parseInt(thaiMatch[3], 10);
        if (year > 2500) year -= 543;
        const date = `${year}-${month}-${day}`;
        if (!Number.isNaN(new Date(date).getTime())) return date;
    }
    const patterns = [/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/, /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match) continue;
        const day = String(match[1]).padStart(2, '0');
        const month = String(match[2]).padStart(2, '0');
        let year = String(match[3]);
        if (year.length === 2) year = '20' + year;
        if (parseInt(year, 10) > 2500) year = String(parseInt(year, 10) - 543);
        const date = `${year}-${month}-${day}`;
        if (!Number.isNaN(new Date(date).getTime())) return date;
    }
    return '';
}

function extractTime(text) {
    const match = String(text || '').match(/\b([01]?\d|2[0-3])[:.][0-5]\d(?:[:.][0-5]\d)?\b/);
    if (!match) return '';
    const parts = match[0].replace('.', ':').split(':');
    return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
}

function normalizePersonName(name) {
    if (!name) return '';
    let value = String(name).replace(/\s+/g, ' ').trim();
    value = value.replace(/^(ผู้โอน|ผู้ส่ง|ผู้ชำระ|ผู้จ่าย|จาก|sender|from)\s*[:：\-]?\s*/i, '');
    value = value.replace(/^(ผู้รับ|ผู้รับเงิน|ผู้รับโอน|ถึง|receiver|to)\s*[:：\-]?\s*/i, '');
    if (/^[\d\s.,\-_/]+$/.test(value)) return '';
    const invalidWords = ['kbank', 'kasikorn', 'กสิกรไทย', 'promptpay', 'พร้อมเพย์', 'reference', 'transaction', 'เลขที่รายการ', 'บัญชี', 'account', 'ref'];
    const lower = value.toLowerCase();
    if (invalidWords.some(w => lower.includes(w))) return '';
    const letters = value.match(/[A-Za-zก-๙]/g);
    if (!letters || letters.length < 2) return '';
    return value.length > 80 ? value.slice(0, 80).trim() : value;
}

function scorePersonName(name) {
    let score = 0;
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 6) score += 3;
    if (/^(นาย|นาง|นางสาว|เด็กชาย|เด็กหญิง|mr\.?|mrs\.?|ms\.?)/i.test(name)) score += 3;
    if (/[ก-๙]/.test(name)) score += 2;
    if (name.length >= 4 && name.length <= 60) score += 2;
    const digitCount = (name.match(/\d/g) || []).length;
    score += digitCount === 0 ? 2 : -digitCount * 2;
    if (/\d{3,}/.test(name)) score -= 8;
    return score;
}

function chooseBetterPersonName(current, candidate) {
    const a = normalizePersonName(current);
    const b = normalizePersonName(candidate);
    if (!a) return b;
    if (!b) return a;
    if (a.toLowerCase().includes(b.toLowerCase()) && a.length >= b.length) return a;
    if (b.toLowerCase().includes(a.toLowerCase()) && b.length >= a.length) return b;
    const scoreA = scorePersonName(a);
    const scoreB = scorePersonName(b);
    if (scoreB > scoreA) return b;
    if (scoreA > scoreB) return a;
    return b.length > a.length ? b : a;
}

function extractPerson(text, labels) {
    const lines = normalizeOCRText(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const label of labels) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = line.match(new RegExp(`${escaped}\\s*[:：\\-]?\\s*(.+)$`, 'i'));
            if (match && match[1]) {
                const name = normalizePersonName(match[1]);
                if (name) candidates.push(name);
            }
            if (line.toLowerCase().includes(label.toLowerCase())) {
                const name = normalizePersonName(lines[i + 1] || '');
                if (name) candidates.push(name);
            }
        }
    }
    if (!candidates.length) return '';
    return candidates.reduce((best, c) => chooseBetterPersonName(best, c), '');
}

function extractPeople(text) {
    const lines = normalizeOCRText(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let sender = '';
    let receiver = '';
    const arrowIndexes = [];
    lines.forEach((line, i) => { if (/[↓→➜➡]/.test(line)) arrowIndexes.push(i); });
    for (const idx of arrowIndexes) {
        const parts = lines[idx].split(/[↓→➜➡]/);
        if (parts.length >= 2) {
            const left = normalizePersonName(parts[0]);
            const right = normalizePersonName(parts.slice(1).join(' '));
            if (left && !sender) sender = left;
            if (right && !receiver) receiver = right;
        }
    }
    for (let i = 0; i < lines.length; i++) {
        if (/^[↓→➜➡]$/.test(lines[i])) {
            const before = normalizePersonName(lines[i - 1] || '');
            const after = normalizePersonName(lines[i + 1] || '');
            if (before && !sender) sender = before;
            if (after && !receiver) receiver = after;
        }
    }
    if (!sender) sender = extractPerson(text, ['ผู้โอน', 'ผู้ส่ง', 'ผู้ชำระ', 'ผู้จ่าย', 'จาก', 'sender', 'from']);
    if (!receiver) receiver = extractPerson(text, ['ผู้รับ', 'ผู้รับเงิน', 'ผู้รับโอน', 'ถึง', 'receiver', 'to']);
    return { sender: normalizePersonName(sender), receiver: normalizePersonName(receiver) };
}

function detectCategory(text) {
    const lines = normalizeOCRText(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const meaningful = lines.filter(l => !/เลขที่รายการ|เลขที่อ้างอิง|reference|transaction|account|บัญชี|promptpay|พร้อมเพย์|xxx[-\s]|^\d{5,}$/i.test(l)).join(' ');
    const lower = meaningful.toLowerCase();
    if (['เซเว่น', '7-eleven', 'อาหาร', 'food', 'grab', 'lineman', 'ก๋วยเตี๋ยว', 'ร้านอาหาร', 'cafe', 'coffee', 'restaurant', 'mcdonald', 'kfc'].some(k => lower.includes(k))) {
        return { category: 'food', note: 'ค่าอาหาร/เครื่องดื่ม' };
    }
    if (['ptt', 'mrt', 'bts', 'น้ำมัน', 'ทางด่วน', 'ปตท', 'taxi', 'grabcar', 'bolt'].some(k => lower.includes(k))) {
        return { category: 'transport', note: 'ค่าเดินทาง/น้ำมัน' };
    }
    if (['pea', 'mea', 'ไฟฟ้า', 'ประปา', 'ais', 'true', 'dtac', 'ค่าไฟ', 'ค่าน้ำ', 'internet', 'โทรศัพท์'].some(k => lower.includes(k))) {
        return { category: 'bills', note: 'ชำระบิลค่าน้ำ/ค่าไฟ/เน็ต' };
    }
    if (['shopee', 'lazada', 'tiktok', 'mall', 'central', 'shopping'].some(k => lower.includes(k))) {
        return { category: 'shopping', note: 'ชอปปิงออนไลน์' };
    }
    return { category: 'other', note: 'โอนเงิน' };
}

function parseSlipOCRText(text) {
    const bank = detectBank(text);
    const { sender, receiver } = extractPeople(text);
    const { category, note } = detectCategory(text);
    return {
        bank,
        amount: extractBestAmount(text, bank),
        date: extractDate(text),
        time: extractTime(text),
        sender, receiver, category, note,
        rawText: text
    };
}

function mergeKBankParsedResults(results) {
    const valid = (results || []).filter(Boolean);
    if (!valid.length) return {};
    const amountCounts = new Map();
    valid.map(r => Number(r.amount || 0)).filter(v => v > 0).forEach(v => {
        const key = v.toFixed(2);
        amountCounts.set(key, (amountCounts.get(key) || 0) + 1);
    });
    const consensusAmount = [...amountCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const sender = valid.map(r => r.sender).filter(Boolean).reduce((best, n) => chooseBetterPersonName(best, n), '');
    const receiver = valid.map(r => r.receiver).filter(Boolean).reduce((best, n) => chooseBetterPersonName(best, n), '');
    const dates = valid.map(r => r.date).filter(Boolean);
    const times = valid.map(r => r.time).filter(Boolean);
    const best = valid.slice().sort((a, b) => {
        const score = r => (r.sender ? 4 : 0) + (r.receiver ? 4 : 0) + (r.amount ? 4 : 0) + (r.date ? 2 : 0) + (r.time ? 1 : 0);
        return score(b) - score(a);
    })[0];
    return {
        ...best,
        amount: consensusAmount ? Number(consensusAmount) : (best.amount || 0),
        sender, receiver,
        date: dates[0] || '',
        time: times[0] || ''
    };
}

// ============================================================
// 23. SINGLE SLIP SCAN
// ============================================================
function initSlipScanner() {
    const dropzone = document.getElementById('scanDropzone');
    const input = document.getElementById('scanFileInput');
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', event => {
        if (event.target === input) return;
        input.click();
    });
    dropzone.addEventListener('dragover', event => {
        event.preventDefault();
        dropzone.style.borderColor = 'var(--brass)';
    });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--pine)'; });
    dropzone.addEventListener('drop', async event => {
        event.preventDefault();
        dropzone.style.borderColor = 'var(--pine)';
        const files = Array.from(event.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
        await handleSelectedFiles(files);
    });
    input.addEventListener('change', async event => {
        const files = Array.from(event.target.files || []).filter(f => f.type.startsWith('image/'));
        await handleSelectedFiles(files);
        input.value = '';
    });

    document.getElementById('confirmSaveBtn')?.addEventListener('click', saveSingleScannedReceipt);
    document.getElementById('reScanBtn')?.addEventListener('click', async () => {
        const confirmed = await confirmAction('สแกนใหม่?', 'ข้อมูลที่อ่านได้ในใบนี้จะถูกล้าง', 'สแกนใหม่');
        if (confirmed) resetScanUI();
    });
}

async function handleSelectedFiles(files) {
    if (!files.length) return;
    if (files.length === 1) {
        await processSlipImage(files[0]);
    } else {
        await processMultipleSlipImages(files);
    }
}

async function processSlipImage(file) {
    if (!file || !file.type.startsWith('image/')) {
        await notifyError('ไฟล์ไม่ถูกต้อง', 'กรุณาอัปโหลดรูปสลิปเท่านั้น');
        return;
    }
    const preview = document.getElementById('scanPreviewImg');
    const dropzone = document.getElementById('scanDropzone');
    const previewBox = document.getElementById('scanPreviewBox');
    const resultCard = document.getElementById('scanResultCard');
    const progress = document.getElementById('scanProgressTxt');
    const scannerLine = document.getElementById('scannerLine');
    const scanStatus = document.getElementById('scanStatus');

    currentScannedImageBase64 = await compressImage(file, 1800, 0.94);
    if (preview) preview.src = currentScannedImageBase64;
    if (dropzone) dropzone.style.display = 'none';
    if (previewBox) previewBox.style.display = 'flex';
    if (resultCard) resultCard.style.display = 'none';
    if (scannerLine) scannerLine.style.display = 'block';
    if (scanStatus) scanStatus.style.display = 'flex';

    let worker = null;
    try {
        if (progress) progress.textContent = 'กำลังอ่านข้อความบนสลิป...';
        worker = await Tesseract.createWorker('tha+eng');

        const primaryResult = await worker.recognize(currentScannedImageBase64);
        const primaryText = primaryResult?.data?.text || '';
        let parsed = parseSlipOCRText(primaryText);

        if (parsed.bank === 'kbank') {
            if (progress) progress.textContent = 'กำลังตรวจสอบยอดและชื่อผู้โอน/ผู้รับ...';
            try {
                const enhancedImage = await enhanceSlipForOCR(currentScannedImageBase64);
                const enhancedResult = await worker.recognize(enhancedImage);
                const enhancedText = enhancedResult?.data?.text || '';
                parsed = mergeKBankParsedResults([parsed, parseSlipOCRText(enhancedText)]);
            } catch (error) {
                console.warn('Enhanced OCR pass failed:', error);
            }
        }

        await worker.terminate();
        worker = null;

        if (progress) progress.textContent = 'กำลังตรวจสอบข้อมูลก่อนแสดงผล...';
        fillSingleScanResult(parsed);
        if (scannerLine) scannerLine.style.display = 'none';
        if (scanStatus) scanStatus.style.display = 'none';
        if (resultCard) resultCard.style.display = 'block';

        const missing = [];
        if (!parsed.amount) missing.push('จำนวนเงิน');
        if (!parsed.sender) missing.push('ผู้โอน');
        if (!parsed.receiver) missing.push('ผู้รับ');
        if (missing.length) {
            await notifyWarning('อ่านสลิปแล้ว แต่ข้อมูลบางส่วนยังไม่ชัด', `กรุณาตรวจสอบ: ${missing.join(', ')} ก่อนบันทึก`);
        } else {
            await notifySuccess('อ่านและตรวจสอบสลิปสำเร็จ', `฿${formatMoney(parsed.amount)} · ${parsed.sender} → ${parsed.receiver}`);
        }
    } catch (error) {
        console.error('OCR Error:', error);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        await notifyError('อ่านสลิปไม่สำเร็จ', 'ลองใช้รูปที่คมชัดขึ้นหรือถ่ายให้เห็นสลิปทั้งใบ');
        resetScanUI();
    }
}

function fillSingleScanResult(data) {
    const setVal = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    setVal('resAmount', data.amount || '');
    setVal('resDate', data.date || todayStr());
    setVal('resTime', data.time || '');
    setVal('resCategory', data.category || 'other');
    setVal('resSender', data.sender || '');
    setVal('resReceiver', data.receiver || '');
    setVal('resNote', data.note || 'โอนผ่านสลิปธนาคาร');
}

async function saveSingleScannedReceipt() {
    const amount = parseFloat(document.getElementById('resAmount')?.value || 0);
    const date = document.getElementById('resDate')?.value || todayStr();
    const time = document.getElementById('resTime')?.value || '';
    const category = document.getElementById('resCategory')?.value || 'other';
    const sender = document.getElementById('resSender')?.value.trim() || '';
    const receiver = document.getElementById('resReceiver')?.value.trim() || '';
    const note = document.getElementById('resNote')?.value.trim() || 'โอนผ่านสลิปธนาคาร';

    if (!amount || amount <= 0) {
        await notifyWarning('ยังไม่มียอดเงิน', 'กรุณาตรวจสอบยอดเงินก่อนบันทึก');
        document.getElementById('resAmount')?.focus();
        return;
    }

    const tx = { id: Date.now(), date, time, amount, category, type: 'transfer', note, sender, receiver };
    state.transactions.push(tx);
    save();
    addLog('scan_receipt', {
        amount: `฿${formatMoney(amount)}`, date,
        people: sender || receiver ? `${sender} → ${receiver}` : ''
    });
    await notifySuccess('บันทึกสลิปเรียบร้อย', `฿${formatMoney(amount)}`);
    resetScanUI();
    renderAll();
}

function resetScanUI() {
    currentScannedImageBase64 = null;
    const set = (id, prop, value) => { const el = document.getElementById(id); if (el) el[prop] = value; };
    set('scanResultCard', 'style', 'display:none;');
    set('scanPreviewBox', 'style', 'display:none;');
    set('scanDropzone', 'style', 'display:block;');
    const preview = document.getElementById('scanPreviewImg');
    if (preview) preview.removeAttribute('src');
    set('scanProgressTxt', 'textContent', '');
    ['resAmount', 'resDate', 'resTime', 'resSender', 'resReceiver', 'resNote'].forEach(id => set(id, 'value', ''));
    set('resCategory', 'value', 'other');
}

// ============================================================
// 24. MULTI SLIP SCAN
// ============================================================
function initMultiScanActions() {
    document.getElementById('multiScanSelectBtn')?.addEventListener('click', () => {
        document.getElementById('scanFileInput')?.click();
    });
    document.getElementById('saveAllScansBtn')?.addEventListener('click', saveAllScannedReceipts);
    document.getElementById('clearAllScansBtn')?.addEventListener('click', clearMultiScanResultsConfirm);
}

async function processMultipleSlipImages(files) {
    multiSlipItems = files.map((file, i) => ({ id: `${Date.now()}_${i}`, file, base64: null, status: 'pending', parsed: null, error: null }));
    renderMultiScanResults();

    const progress = document.getElementById('multiScanProgress');
    let worker = null;
    try {
        worker = await Tesseract.createWorker('tha+eng');
        for (let i = 0; i < multiSlipItems.length; i++) {
            const item = multiSlipItems[i];
            if (progress) progress.textContent = `กำลังอ่านสลิป ${i + 1} / ${multiSlipItems.length}...`;
            try {
                item.base64 = await compressImage(item.file, 1800, 0.94);
                const result = await worker.recognize(item.base64);
                const text = result?.data?.text || '';
                let parsed = parseSlipOCRText(text);
                if (parsed.bank === 'kbank') {
                    try {
                        const enhanced = await enhanceSlipForOCR(item.base64);
                        const enhancedResult = await worker.recognize(enhanced);
                        parsed = mergeKBankParsedResults([parsed, parseSlipOCRText(enhancedResult?.data?.text || '')]);
                    } catch (_) { /* keep primary parse */ }
                }
                item.parsed = parsed;
                item.status = parsed.amount ? 'ok' : 'warn';
            } catch (error) {
                console.error('Multi-scan OCR error:', error);
                item.status = 'error';
                item.error = 'อ่านไม่สำเร็จ';
            }
            renderMultiScanResults();
        }
    } finally {
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        if (progress) progress.textContent = `อ่านเสร็จแล้ว ${multiSlipItems.length} รายการ ตรวจสอบก่อนบันทึก`;
    }
}

function renderMultiScanResults() {
    const container = document.getElementById('multiScanResults');
    const actions = document.getElementById('multiScanActions');
    if (!container) return;
    if (!multiSlipItems.length) {
        container.innerHTML = '';
        if (actions) actions.style.display = 'none';
        return;
    }
    container.innerHTML = multiSlipItems.map((item, index) => {
        const statusIcon = item.status === 'pending' ? '⏳' : item.status === 'ok' ? '✅' : item.status === 'warn' ? '⚠️' : '❌';
        const amountText = item.parsed?.amount ? `฿${formatMoney(item.parsed.amount)}` : (item.status === 'pending' ? 'กำลังอ่าน...' : 'ไม่พบยอดเงิน');
        const peopleText = item.parsed && (item.parsed.sender || item.parsed.receiver) ? ` · ${item.parsed.sender || '?'} → ${item.parsed.receiver || '?'}` : '';
        return `
            <div class="multi-scan-item ${item.status === 'error' ? 'error' : ''}">
                ${item.base64 ? `<img src="${item.base64}" alt="สลิป ${index + 1}">` : `<div class="tx-icon">🧾</div>`}
                <div class="info">
                    <div class="name">สลิป ${index + 1} · ${escapeHtml(item.file.name)}</div>
                    <div class="meta">${amountText}${peopleText}</div>
                </div>
                <div class="status">${statusIcon}</div>
            </div>
        `;
    }).join('');
    if (actions) actions.style.display = multiSlipItems.some(i => i.status === 'ok' || i.status === 'warn') ? 'flex' : 'none';
}

async function saveAllScannedReceipts() {
    const savable = multiSlipItems.filter(i => (i.status === 'ok' || i.status === 'warn') && i.parsed?.amount);
    if (!savable.length) {
        await notifyWarning('ยังไม่มีรายการที่บันทึกได้', 'ต้องมีอย่างน้อยหนึ่งใบที่อ่านยอดเงินได้');
        return;
    }
    const confirmed = await confirmAction('ยืนยันบันทึกทั้งหมด?', `จะบันทึก ${savable.length} รายการ`, 'บันทึกทั้งหมด');
    if (!confirmed) return;

    savable.forEach(item => {
        const p = item.parsed;
        state.transactions.push({
            id: Date.now() + Math.random(),
            date: p.date || todayStr(), time: p.time || '', amount: p.amount,
            category: p.category || 'other', type: 'transfer',
            note: p.note || 'โอนผ่านสลิปธนาคาร', sender: p.sender || '', receiver: p.receiver || ''
        });
    });
    save();
    addLog('scan_receipt', { count: `${savable.length} รายการจากการสแกนหลายใบ` });
    await notifySuccess('บันทึกทั้งหมดเรียบร้อย', `${savable.length} รายการ`);
    multiSlipItems = [];
    renderMultiScanResults();
    const progress = document.getElementById('multiScanProgress');
    if (progress) progress.textContent = '';
    renderAll();
}

async function clearMultiScanResultsConfirm() {
    if (!multiSlipItems.length) return;
    const confirmed = await confirmAction('ล้างผลลัพธ์การสแกน?', 'รายการที่อ่านไว้จะหายไปทั้งหมด', 'ล้างผลลัพธ์');
    if (!confirmed) return;
    multiSlipItems = [];
    renderMultiScanResults();
    const progress = document.getElementById('multiScanProgress');
    if (progress) progress.textContent = '';
}

// ============================================================
// END
// ============================================================
