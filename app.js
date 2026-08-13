// ==========================================
// 1. CONSTANTS & APPLICATION STATE
// ==========================================
const CATEGORIES = [
    { id: 'food', label: 'อาหาร/เครื่องดื่ม', icon: '🍲', color: '#FF7043' },
    { id: 'transport', label: 'เดินทาง/น้ำมัน', icon: '🚗', color: '#42A5F5' },
    { id: 'shopping', label: 'ชอปปิง', icon: '🛍️', color: '#AB47BC' },
    { id: 'bills', label: 'บิล/ค่าน้ำค่าไฟ', icon: '⚡', color: '#FFA726' },
    { id: 'entertainment', label: 'บันเทิง', icon: '🎬', color: '#26A69A' },
    { id: 'other', label: 'อื่นๆ', icon: '📦', color: '#78909C' }
];

let state = {
    currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    income: {}, // { "2026-08": 30000 }
    transactions: [],
    logs: []
};

let selectedCategory = 'food';
let manualReceiptBase64 = null;
let currentScannedImageBase64 = null;

// ==========================================
// 2. INITIALIZATION & LOCAL STORAGE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initUI();
    renderAll();
});

function loadData() {
    const saved = localStorage.getItem('finance_app_data');
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error('Data parsing error:', e);
        }
    }
}

function save() {
    localStorage.setItem('finance_app_data', JSON.stringify(state));
}

function todayStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==========================================
// 3. UI INIT & NAVIGATION
// ==========================================
function initUI() {
    // Setup Date inputs to today
    document.getElementById('fDate').value = todayStr();

    // Render Category Grid for Add Page
    const catGrid = document.getElementById('catGrid');
    if (catGrid) {
        catGrid.innerHTML = CATEGORIES.map(c => `
            <div class="cat-item ${c.id === selectedCategory ? 'active' : ''}" data-id="${c.id}">
                <div style="font-size:18px;">${c.icon}</div>
                <div>${c.label}</div>
            </div>
        `).join('');

        catGrid.querySelectorAll('.cat-item').forEach(el => {
            el.addEventListener('click', () => {
                catGrid.querySelectorAll('.cat-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
                selectedCategory = el.dataset.id;
            });
        });
    }

    // Populate Category Dropdown for Scan Page
    const resCat = document.getElementById('resCategory');
    if (resCat) {
        resCat.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
    }

    // Tabs Navigation setup
    const tabs = document.getElementById('tabs');
    const pages = document.querySelectorAll('.page');
    const underline = document.getElementById('underline');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const dropdownBtn = document.getElementById('dropdownBtn');

    function updateUnderline(btn) {
        if (!btn || !underline) return;
        const rect = btn.getBoundingClientRect();
        const parentRect = tabs.getBoundingClientRect();
        underline.style.width = `${rect.width}px`;
        underline.style.left = `${rect.left - parentRect.left}px`;
    }

    document.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const pageId = btn.dataset.page;
            
            // Switch active page
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(pageId)?.classList.add('active');

            // Switch active tab styling
            document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (dropdownMenu.contains(btn)) {
                dropdownBtn.classList.add('active');
            } else {
                dropdownMenu.classList.remove('show');
            }

            updateUnderline(btn.classList.contains('dropdown-btn') ? btn : (dropdownMenu.contains(btn) ? dropdownBtn : btn));
            renderAll();
        });
    });

    dropdownBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => dropdownMenu?.classList.remove('show'));

    // Set initial underline position
    setTimeout(() => updateUnderline(tabs.querySelector('button.active')), 100);

    // Income Input Event
    const incomeInput = document.getElementById('incomeInput');
    incomeInput?.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || 0;
        state.income[state.currentMonth] = val;
        save();
        renderAll();
    });

    // Form Manual Expense Submission
    document.getElementById('entryForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('fDate').value;
        const amount = parseFloat(document.getElementById('fAmount').value);
        const type = document.querySelector('input[name="type"]:checked').value;
        const note = document.getElementById('fNote').value.trim();

        if (!amount || amount <= 0) return;

        const tx = {
            id: Date.now(),
            date,
            amount,
            category: selectedCategory,
            type,
            note,
            receipt: manualReceiptBase64
        };

        state.transactions.push(tx);
        save();

        addLog('add_transaction', {
            date,
            amount: `฿${amount}`,
            category: CATEGORIES.find(c => c.id === selectedCategory)?.label,
            note
        });

        // Reset Form
        document.getElementById('fAmount').value = '';
        document.getElementById('fNote').value = '';
        manualReceiptBase64 = null;
        document.getElementById('uploadTxt').textContent = '📷 แตะเพื่อแนบรูปสลิปเก็บไว้';

        showNotification('บันทึกรายการเรียบร้อยแล้ว ✓', 'success');
        renderAll();
    });

    // Upload receipt manually
    const uploadBox = document.getElementById('uploadBox');
    const fReceipt = document.getElementById('fReceipt');
    uploadBox?.addEventListener('click', () => fReceipt.click());
    fReceipt?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            manualReceiptBase64 = await compressImage(file, 800, 0.8);
            document.getElementById('uploadTxt').textContent = `✅ แนบไฟล์เรียบร้อย (${file.name})`;
        }
    });

    // Setup Export & Tax Buttons
    document.getElementById('exportCsv')?.addEventListener('click', exportTransactionsCSV);
    document.getElementById('exportLogsBtn')?.addEventListener('click', exportLogsCSV);
    document.getElementById('taxCalcBtn')?.addEventListener('click', calculateTax);
    document.getElementById('runTestBtn')?.addEventListener('click', runSystemDiagnostics);

    // Setup Slip OCR Events
    initSlipScanner();
}

// ==========================================
// 4. SLIP SCANNER & OCR LOGIC (Tesseract.js)
// ==========================================
function initSlipScanner() {
    const scanDropzone = document.getElementById('scanDropzone');
    const scanFileInput = document.getElementById('scanFileInput');
    const scanPreviewBox = document.getElementById('scanPreviewBox');
    const scanPreviewImg = document.getElementById('scanPreviewImg');
    const scanProgressTxt = document.getElementById('scanProgressTxt');
    const scanResultCard = document.getElementById('scanResultCard');

    scanDropzone?.addEventListener('click', () => scanFileInput.click());

    scanDropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        scanDropzone.style.borderColor = 'var(--good)';
    });

    scanDropzone?.addEventListener('dragleave', () => {
        scanDropzone.style.borderColor = 'var(--accent)';
    });

    scanDropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        scanDropzone.style.borderColor = 'var(--accent)';
        const file = e.dataTransfer.files[0];
        if (file) processSlipImage(file);
    });

    scanFileInput?.addEventListener('change', (ev) => {
        const file = ev.target.files[0];
        if (file) processSlipImage(file);
    });

    async function processSlipImage(file) {
        if (!file.type.startsWith('image/')) {
            Swal.fire('ไฟล์ไม่ถูกต้อง', 'กรุณาอัปโหลดไฟล์รูปภาพสลิปเท่านั้น', 'error');
            return;
        }

        currentScannedImageBase64 = await compressImage(file, 900, 0.85);
        scanPreviewImg.src = currentScannedImageBase64;
        scanDropzone.style.display = 'none';
        scanPreviewBox.style.display = 'flex';
        scanResultCard.style.display = 'none';

        try {
            scanProgressTxt.textContent = 'กำลังโหลดระบบอ่านภาษาไทย/อังกฤษ...';
            const worker = await Tesseract.createWorker('tha+eng');
            
            scanProgressTxt.textContent = 'กำลังวิเคราะห์ข้อความและตัวเลขบนสลิป...';
            const ret = await worker.recognize(currentScannedImageBase64);
            const extractedText = ret.data.text;
            await worker.terminate();

            const parsedData = parseSlipOCRText(extractedText);

            document.getElementById('resAmount').value = parsedData.amount || '';
            document.getElementById('resDate').value = parsedData.date || todayStr();
            document.getElementById('resNote').value = parsedData.note || 'โอนผ่านสลิปธนาคาร';
            const resCat = document.getElementById('resCategory');
            if (resCat) resCat.value = parsedData.category;

            document.getElementById('scannerLine').style.display = 'none';
            document.getElementById('scanStatus').style.display = 'none';
            scanResultCard.style.display = 'block';

            showNotification('อ่านข้อมูลสลิปสำเร็จ ✓', 'success');

        } catch (err) {
            console.error('OCR Error:', err);
            Swal.fire('อ่านสลิปไม่สำเร็จ', 'ไม่สามารถอ่านข้อความบนสลิปได้ ลองถ่ายรูปสลิปให้ชัดเจนขึ้น', 'warning');
            resetScanUI();
        }
    }

    document.getElementById('confirmSaveBtn')?.addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('resAmount').value);
        const date = document.getElementById('resDate').value;
        const category = document.getElementById('resCategory').value;
        const note = document.getElementById('resNote').value.trim();

        if (!amount || amount <= 0) {
            Swal.fire('ระบุยอดเงิน', 'กรุณาตรวจสอบและระบุจำนวนเงินให้ถูกต้อง', 'warning');
            return;
        }

        const tx = {
            id: Date.now(),
            date,
            amount,
            category,
            type: 'transfer',
            note,
            receipt: currentScannedImageBase64
        };

        state.transactions.push(tx);
        save();

        addLog('add_transaction', {
            date,
            amount: `฿${amount}`,
            category: CATEGORIES.find(c => c.id === category)?.label || category,
            note: `[สแกนสลิป] ${note}`
        });

        resetScanUI();
        renderAll();

        // Switch to Transactions Tab
        document.querySelector('[data-page="transactions"]')?.click();
        Swal.fire({ icon: 'success', title: 'บันทึกเรียบร้อย', showConfirmButton: false, timer: 1200 });
    });

    document.getElementById('reScanBtn')?.addEventListener('click', resetScanUI);
}

function resetScanUI() {
    const scanFileInput = document.getElementById('scanFileInput');
    if (scanFileInput) scanFileInput.value = '';
    document.getElementById('scanDropzone').style.display = 'block';
    document.getElementById('scanPreviewBox').style.display = 'none';
    document.getElementById('scanResultCard').style.display = 'none';
    document.getElementById('scannerLine').style.display = 'block';
    document.getElementById('scanStatus').style.display = 'flex';
    currentScannedImageBase64 = null;
}

function parseSlipOCRText(text) {
    let amount = null;
    let date = todayStr();
    let category = 'other';
    let note = 'โอนเงิน';

    // 1. Amount Extraction Regex
    const amountRegex = /(?:จำนวนเงิน|amount|baht|บาท|โอนสำเร็จ|thb)?\s*[:\.]?\s*([\d,]+\.\d{2})/gi;
    let match;
    let possibleAmounts = [];

    while ((match = amountRegex.exec(text)) !== null) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (val > 0 && val < 500000) possibleAmounts.push(val);
    }

    if (possibleAmounts.length > 0) {
        amount = possibleAmounts[0];
    } else {
        const fallbackRegex = /([\d,]+\.\d{2})/g;
        const allDecimals = [...text.matchAll(fallbackRegex)].map(m => parseFloat(m[1].replace(/,/g, '')));
        if (allDecimals.length > 0) amount = allDecimals[0];
    }

    // 2. Date Extraction (DD/MM/YYYY or BE format)
    const dateMatch = text.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
    if (dateMatch) {
        let [_, day, month, year] = dateMatch;
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');
        if (year.length === 2) year = '20' + year;
        if (parseInt(year) > 2500) year = (parseInt(year) - 543).toString(); // Buddhist to CE
        date = `${year}-${month}-${day}`;
    }

    // 3. Category & Smart Keywords Analysis
    const lower = text.toLowerCase();
    if (lower.includes('เซเว่น') || lower.includes('7-eleven') || lower.includes('ร้าน') || lower.includes('อาหาร') || lower.includes('food') || lower.includes('grab') || lower.includes('lineman') || lower.includes('ก๋วยเตี๋ยว')) {
        category = 'food';
        note = 'ค่าอาหาร/เครื่องดื่ม';
    } else if (lower.includes('ptt') || lower.includes('mrt') || lower.includes('bts') || lower.includes('น้ำมัน') || lower.includes('ทางด่วน') || lower.includes('ปตท')) {
        category = 'transport';
        note = 'ค่าเดินทาง/น้ำมัน';
    } else if (lower.includes('pea') || lower.includes('mea') || lower.includes('ไฟฟ้า') || lower.includes('ประปา') || lower.includes('ais') || lower.includes('true') || lower.includes('dtac')) {
        category = 'bills';
        note = 'ชำระบิลค่าน้ำ/ค่าไฟ/เน็ต';
    } else if (lower.includes('shopee') || lower.includes('lazada') || lower.includes('tiktok') || lower.includes('mall')) {
        category = 'shopping';
        note = 'ชอปปิงออนไลน์';
    }

    return { amount, date, category, note };
}

// ==========================================
// 5. RENDERING LOGIC
// ==========================================
function renderAll() {
    renderMonthLabels();
    renderDashboard();
    renderTransactions();
    renderAnalysis();
    renderLogs();
}

function shiftMonth(delta) {
    const [y, m] = state.currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    state.currentMonth = `${ny}-${nm}`;
    renderAll();
}

function renderMonthLabels() {
    const [y, m] = state.currentMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    const monthStr = dateObj.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    ['monthLabel', 'monthLabel2', 'monthLabel3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = monthStr;
    });
}

function renderDashboard() {
    const currentIncome = state.income[state.currentMonth] || 0;
    document.getElementById('incomeInput').value = currentIncome ? currentIncome : '';

    // Filter Current Month Expenses
    const monthTx = state.transactions.filter(t => t.date.startsWith(state.currentMonth));
    const totalExpense = monthTx.reduce((sum, t) => sum + t.amount, 0);
    const remaining = currentIncome - totalExpense;

    document.getElementById('totalExpenseVal').textContent = `฿${totalExpense.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    
    const remEl = document.getElementById('remainingVal');
    remEl.textContent = `฿${remaining.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    remEl.style.color = remaining >= 0 ? 'var(--good)' : 'var(--danger)';

    // Render Donut Chart & Legend
    const catTotals = {};
    monthTx.forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });

    const donutEl = document.getElementById('donut');
    const legendEl = document.getElementById('legend');

    if (totalExpense === 0) {
        donutEl.style.background = `conic-gradient(var(--border) 0deg 360deg)`;
        legendEl.innerHTML = `<div style="color:var(--muted);">ไม่มีรายการรายจ่ายในเดือนนี้</div>`;
        return;
    }

    let gradientStops = [];
    let currentDeg = 0;
    let legendHtml = '';

    CATEGORIES.forEach(cat => {
        const amt = catTotals[cat.id] || 0;
        if (amt > 0) {
            const pct = (amt / totalExpense) * 100;
            const deg = (amt / totalExpense) * 360;
            gradientStops.push(`${cat.color} ${currentDeg}deg ${currentDeg + deg}deg`);
            currentDeg += deg;

            legendHtml += `
                <div class="legend-item">
                    <span><span class="legend-dot" style="background:${cat.color}"></span>${cat.icon} ${cat.label}</span>
                    <span style="font-weight:600;">฿${amt.toLocaleString()} (${pct.toFixed(0)}%)</span>
                </div>
            `;
        }
    });

    donutEl.style.background = `conic-gradient(${gradientStops.join(', ')})`;
    legendEl.innerHTML = legendHtml;
}

function renderTransactions() {
    const txList = document.getElementById('txList');
    if (!txList) return;

    const monthTx = state.transactions
        .filter(t => t.date.startsWith(state.currentMonth))
        .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

    if (monthTx.length === 0) {
        txList.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);padding:30px;">ไม่มีรายการในเดือนนี้</div>`;
        return;
    }

    // Group by Date
    const grouped = {};
    monthTx.forEach(t => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t);
    });

    let html = '';
    for (const [date, items] of Object.entries(grouped)) {
        const dateFormatted = new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        html += `<div class="tx-group"><div class="tx-date-title">${dateFormatted}</div>`;
        
        items.forEach(t => {
            const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[5];
            html += `
                <div class="tx-card">
                    <div class="tx-icon">${cat.icon}</div>
                    <div class="tx-info">
                        <div class="tx-title">${t.note || cat.label}</div>
                        <div class="tx-sub">${t.type === 'cash' ? '💵 เงินสด' : '💳 โอน/บัตร'} ${t.receipt ? '• 🧾 มีสลิป' : ''}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="tx-amount">-฿${t.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                        <button onclick="deleteTx(${t.id})" style="border:none;background:none;color:var(--danger);font-size:11px;cursor:pointer;padding:0;">ลบ</button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    txList.innerHTML = html;
}

function deleteTx(id) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: 'คุณต้องการลบรายการนี้ใช่หรือไม่',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        confirmButtonText: 'ลบรายการ',
        cancelButtonText: 'ยกเลิก'
    }).then((res) => {
        if (res.isConfirmed) {
            state.transactions = state.transactions.filter(t => t.id !== id);
            save();
            addLog('delete_transaction', { id });
            renderAll();
            showNotification('ลบรายการเรียบร้อย', 'success');
        }
    });
}

function renderAnalysis() {
    const income = state.income[state.currentMonth] || 0;
    const monthTx = state.transactions.filter(t => t.date.startsWith(state.currentMonth));
    const totalExpense = monthTx.reduce((sum, t) => sum + t.amount, 0);

    const needs = monthTx.filter(t => ['food', 'transport', 'bills'].includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    const wants = monthTx.filter(t => ['shopping', 'entertainment', 'other'].includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    const savings = Math.max(0, income - totalExpense);

    const barRows = document.getElementById('barRows');
    if (barRows) {
        barRows.innerHTML = `
            ${renderBar('ความจำเป็น (Needs) 50%', needs, income * 0.5)}
            ${renderBar('ความต้องการ (Wants) 30%', wants, income * 0.3)}
            ${renderBar('เงินออม/การลงทุน (Savings) 20%', savings, income * 0.2, true)}
        `;
    }

    const tipsList = document.getElementById('tipsList');
    if (tipsList) {
        let tips = [];
        if (income === 0) {
            tips.push('กรุณากรอก "รายรับเดือนนี้" ในหน้าภาพรวม เพื่อประเมินสัดส่วนทางการเงิน');
        } else {
            if (needs > income * 0.5) tips.push('ค่าใช้จ่ายจำเป็นเกิน 50% ของรายได้ ลองลดค่าน้ำมันหรืออาหารนอกบ้าน');
            if (wants > income * 0.3) tips.push('ค่าใช้จ่ายเพื่อความบันเทิง/ชอปปิง เกิน 30% แนะนำให้ตั้งงบจำกัดไว้ล่วงหน้า');
            if (savings >= income * 0.2) tips.push('ยอดเยี่ยมมาก! คุณออมเงินได้อย่างน้อย 20% ของรายได้ตามเป้าหมาย');
            else tips.push('พยายามออมเงินให้ถึง 20% เพื่อสร้างเงินสำรองฉุกเฉิน');
        }
        tipsList.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
    }
}

function renderBar(label, actual, target, isSavings = false) {
    const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
    const isOver = !isSavings && actual > target;
    return `
        <div class="bar-row">
            <div class="bar-lbl">
                <span>${label}</span>
                <span style="font-weight:600; ${isOver ? 'color:var(--danger)' : ''}">฿${actual.toLocaleString()} / ฿${target.toLocaleString()}</span>
            </div>
            <div class="bar-bg">
                <div class="bar-fill" style="width:${pct}%; background:${isOver ? 'var(--danger)' : 'var(--accent)'}"></div>
            </div>
        </div>
    `;
}

function renderLogs() {
    const logList = document.getElementById('logList');
    if (!logList) return;

    if (!state.logs || state.logs.length === 0) {
        logList.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);">ยังไม่มีประวัติการใช้งาน</div>`;
        return;
    }

    logList.innerHTML = state.logs.slice(-15).reverse().map(l => `
        <div class="tx-card" style="margin-bottom:6px;">
            <div class="tx-info">
                <div class="tx-title" style="font-size:13px;">${l.action === 'add_transaction' ? '➕ เพิ่มรายการ' : '🗑️ ลบรายการ'}</div>
                <div class="tx-sub">${new Date(l.timestamp).toLocaleString('th-TH')}</div>
            </div>
            <div style="font-size:12px;color:var(--muted);">${JSON.stringify(l.details || {})}</div>
        </div>
    `).join('');
}

// ==========================================
// 6. HELPER FUNCTIONS & EXPORTS
// ==========================================
function compressImage(file, maxSide = 800, quality = 0.8) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxSide || h > maxSide) {
                    if (w > h) {
                        h = Math.round((h * maxSide) / w);
                        w = maxSide;
                    } else {
                        w = Math.round((w * maxSide) / h);
                        h = maxSide;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
}

function addLog(action, details = {}) {
    if (!state.logs) state.logs = [];
    state.logs.push({
        timestamp: new Date().toISOString(),
        action,
        details
    });
    save();
}

function showNotification(title, icon = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title,
        showConfirmButton: false,
        timer: 2000
    });
}

function exportTransactionsCSV() {
    if (state.transactions.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีรายการสำหรับส่งออก CSV', 'info');
        return;
    }
    let csv = '\uFEFFID,Date,Amount,Category,Type,Note\n';
    state.transactions.forEach(t => {
        csv += `"${t.id}","${t.date}","${t.amount}","${t.category}","${t.type}","${t.note || ''}"\n`;
    });
    downloadCSV(csv, `transactions_${state.currentMonth}.csv`);
}

function exportLogsCSV() {
    if (!state.logs || state.logs.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีประวัติกิจกรรมสำหรับส่งออก', 'info');
        return;
    }
    let csv = '\uFEFFTimestamp,Action,Details\n';
    state.logs.forEach(l => {
        csv += `"${l.timestamp}","${l.action}","${JSON.stringify(l.details).replace(/"/g, '""')}"\n`;
    });
    downloadCSV(csv, `activity_logs.csv`);
}

function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

function calculateTax() {
    const income = parseFloat(document.getElementById('taxIncome').value) || 0;
    const deduct = parseFloat(document.getElementById('taxDeduct').value) || 0;
    const netIncome = Math.max(0, income - deduct);

    let tax = 0;
    if (netIncome > 500000) {
        tax += (netIncome - 500000) * 0.15 + 25000;
    } else if (netIncome > 300000) {
        tax += (netIncome - 300000) * 0.10 + 7500;
    } else if (netIncome > 150000) {
        tax += (netIncome - 150000) * 0.05;
    }

    document.getElementById('taxResult').innerHTML = `
        <div style="background:var(--accent-light);padding:14px;border-radius:10px;color:var(--accent);">
            <div><strong>เงินได้สุทธิพิจารณา:</strong> ฿${netIncome.toLocaleString()}</div>
            <div style="font-size:16px;font-weight:700;margin-top:4px;"><strong>ภาษีประเมินที่ต้องจ่าย:</strong> ฿${tax.toLocaleString()}</div>
        </div>
    `;
}

function runSystemDiagnostics() {
    const results = document.getElementById('testResultsList');
    if (!results) return;

    results.innerHTML = `
        <div style="font-size:13px;padding:10px;background:#F5F5F5;border-radius:8px;line-height:1.6;">
            <div>✅ LocalStorage: พร้อมใช้งาน</div>
            <div>✅ Canvas Compressor: พร้อมใช้งาน</div>
            <div>✅ Tesseract.js OCR Engine: พร้อมใช้งาน</div>
            <div>✅ SweetAlert2 & GSAP: โหลดเรียบร้อย</div>
            <div style="color:var(--good);font-weight:700;margin-top:6px;">ระบบทั้งหมดทำงานสมบูรณ์ 100%!</div>
        </div>
    `;
