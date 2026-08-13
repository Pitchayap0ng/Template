const CATEGORIES = [
    { id: 'food', label: 'อาหาร', icon: '🍜', color: '#E4785A', group: 'need' },
    { id: 'transport', label: 'เดินทาง', icon: '🚌', color: '#4C93A8', group: 'need' },
    { id: 'bills', label: 'ค่าใช้จ่ายประจำ', icon: '💡', color: '#8C7AA9', group: 'need' },
    { id: 'health', label: 'สุขภาพ', icon: '💊', color: '#6FA986', group: 'need' },
    { id: 'shopping', label: 'ชอปปิง', icon: '🛍️', color: '#D98BB9', group: 'want' },
    { id: 'entertainment', label: 'บันเทิง', icon: '🎬', color: '#E0B84C', group: 'want' },
    { id: 'other', label: 'อื่นๆ', icon: '📦', color: '#9AA5AE', group: 'want' },
];

const state = { transactions: [], income: {}, activityLogs: [] };
let selectedCat = 'food';
let pendingReceipt = null;

// Activity logging
function addLog(action, details) {
    const log = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        action,
        details,
        dateDisplay: new Date().toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    state.activityLogs.unshift(log);
    if (state.activityLogs.length > 100) state.activityLogs.pop();
    localStorage.setItem('mf_activityLogs', JSON.stringify(state.activityLogs));
    return log;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
    position:fixed;top:16px;right:16px;background:${type === 'success' ? '#2E8B57' : type === 'error' ? '#C9553F' : '#d7b563'};
    color:#fff;padding:12px 16px;border-radius:8px;font-size:14px;z-index:9999;
    animation:slideIn .3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.15);
  `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut .3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function loadData() {
    try {
        const savedTx = JSON.parse(localStorage.getItem('mf_transactions') || '[]');
        state.transactions = Array.isArray(savedTx) ? savedTx.filter(Boolean) : [];
    } catch (err) {
        console.warn('Invalid transactions in localStorage:', err);
        state.transactions = [];
        localStorage.setItem('mf_transactions', JSON.stringify([]));
    }

    try {
        const savedIncome = JSON.parse(localStorage.getItem('mf_income') || '{}');
        if (savedIncome && typeof savedIncome === 'object') {
            state.income = {};
            Object.keys(savedIncome).forEach(k => {
                const v = Number(savedIncome[k]);
                if (Number.isFinite(v)) state.income[k] = v;
            });
        } else {
            state.income = {};
        }
    } catch (err) {
        console.warn('Invalid incomeData in localStorage:', err);
        state.income = {};
        localStorage.setItem('mf_income', JSON.stringify({}));
    }

    try {
        const savedLogs = JSON.parse(localStorage.getItem('mf_activityLogs') || '[]');
        state.activityLogs = Array.isArray(savedLogs) ? savedLogs : [];
    } catch (err) {
        console.warn('Invalid activity logs in localStorage:', err);
        state.activityLogs = [];
    }
}

function save() {
    try {
        localStorage.setItem('mf_transactions', JSON.stringify(state.transactions));
        localStorage.setItem('mf_income', JSON.stringify(state.income));
        localStorage.setItem('mf_activityLogs', JSON.stringify(state.activityLogs));
    } catch (err) {
        console.warn('Could not save data:', err);
    }
}
loadData();

const now = new Date();
let currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('th-TH'); }
function catInfo(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[0]; }

// ---------- Tabs & Dropdown ----------
const tabsEl = document.getElementById('tabs');
const underline = document.getElementById('underline');
const dropdownBtn = document.getElementById('dropdownBtn');
const dropdownMenu = document.getElementById('dropdownMenu');

tabsEl.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const parentDropdown = btn.closest('.dropdown-menu');
        if (parentDropdown && dropdownBtn) {
            dropdownBtn.classList.add('active');
        }

        dropdownMenu?.classList.remove('show');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(btn.dataset.page);
        if (targetPage) {
            targetPage.classList.add('active');
            gsap.from('#' + btn.dataset.page, { opacity: 0, y: 8, duration: 0.45 });
        }

        positionUnderline(btn.closest('.tab-dropdown') ? dropdownBtn : btn);
        renderAll();
    });
});

dropdownBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu?.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#tabDropdown')) {
        dropdownMenu?.classList.remove('show');
    }
});

function positionUnderline(btn) {
    if (!btn || !underline) return;
    underline.style.left = btn.offsetLeft + 'px';
    underline.style.width = btn.offsetWidth + 'px';
}
window.addEventListener('load', () => {
    const activeBtn = tabsEl.querySelector('button.active');
    if (activeBtn) positionUnderline(activeBtn);
});

// ---------- Category picker ----------
const catGrid = document.getElementById('catGrid');
CATEGORIES.forEach(c => {
    const div = document.createElement('div');
    div.className = 'cat-opt' + (c.id === selectedCat ? ' sel' : '');
    div.dataset.id = c.id;
    div.innerHTML = `<span class="ic">${c.icon}</span>${c.label}`;
    div.addEventListener('click', () => {
        selectedCat = c.id;
        catGrid.querySelectorAll('.cat-opt').forEach(o => o.classList.remove('sel'));
        div.classList.add('sel');
    });
    catGrid.appendChild(div);
});

document.querySelectorAll('.type-row input').forEach(r => {
    r.addEventListener('change', () => {
        document.querySelectorAll('.type-row label').forEach(l => l.classList.remove('sel'));
        r.closest('label').classList.add('sel');
    });
});
document.getElementById('typeCashLbl').classList.add('sel');
document.getElementById('fDate').value = todayStr();

// ---------- Receipt upload ----------
const uploadBox = document.getElementById('uploadBox');
const uploadTxt = document.getElementById('uploadTxt');
let fReceipt = document.getElementById('fReceipt');

function resetUploadBox() {
    uploadBox.innerHTML = `<span class="txt" id="uploadTxt">แตะเพื่อเลือกรูป — เก็บไว้เป็นหลักฐานส่วนตัว ไม่ได้อ่านตัวเลขให้อัตโนมัติ</span><input type="file" accept="image/*" id="fReceipt" style="display:none">`;
    fReceipt = document.getElementById('fReceipt');
    uploadBox.onclick = () => fReceipt.click();
    fReceipt.onchange = async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        pendingReceipt = await compressImage(file);
        uploadBox.innerHTML = `<img src="${pendingReceipt}"><span class="txt">แนบรูปแล้ว — แตะเพื่อเปลี่ยนรูป</span>`;
        uploadBox.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/*';
            input.onchange = async (e) => {
                const nextFile = e.target.files[0];
                if (!nextFile) return;
                pendingReceipt = await compressImage(nextFile);
                uploadBox.innerHTML = `<img src="${pendingReceipt}"><span class="txt">แนบรูปแล้ว — แตะเพื่อเปลี่ยนรูป</span>`;
                uploadBox.onclick = () => { input.click(); };
            };
            input.click();
        };
    };
}
resetUploadBox();

function compressImage(file, maxW = 700, quality = 0.7) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > maxW) { h = h * maxW / w; w = maxW; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ---------- Add transaction ----------
document.getElementById('entryForm').addEventListener('submit', e => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('fAmount').value);
    if (!amount || amount <= 0) return;
    const date = document.getElementById('fDate').value;
    const note = document.getElementById('fNote').value.trim();
    const tx = {
        id: Date.now(),
        date,
        amount,
        category: selectedCat,
        type: document.querySelector('.type-row input:checked').value,
        note,
        receipt: pendingReceipt
    };
    state.transactions.push(tx);
    save();
    addLog('add_transaction', {
        date,
        amount: `฿${amount}`,
        category: CATEGORIES.find(c => c.id === selectedCat)?.label || selectedCat,
        note: note || '-'
    });
    showNotification('บันทึกรายการแล้ว ✓', 'success');
    e.target.reset();
    document.getElementById('fDate').value = todayStr();
    pendingReceipt = null;
    resetUploadBox();
    tabsEl.querySelector('[data-page="transactions"]').click();
    Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', showConfirmButton: false, timer: 900 });
});

// ---------- Month navigation ----------
function shiftMonth(delta) {
    let [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    renderAll();
}
function monthLabelText() {
    const [y, m] = currentMonth.split('-').map(Number);
    const thMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${thMonths[m - 1]} ${y}`;
}

// ---------- Data helpers ----------
function txForMonth(month) { return state.transactions.filter(t => t && t.date && t.date.startsWith(month)); }
function summaryFor(month) {
    const txs = txForMonth(month);
    const byCategory = {};
    CATEGORIES.forEach(c => byCategory[c.id] = 0);
    txs.forEach(t => {
        const key = t && t.category ? t.category : 'other';
        if (!byCategory.hasOwnProperty(key)) byCategory[key] = 0;
        byCategory[key] += Number(t.amount) || 0;
    });
    const totalExpense = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const income = Number(state.income[month]) || 0;
    return { txs, byCategory, totalExpense, income };
}

// ---------- Donut Chart ----------
function drawDonut(el, dataArr) {
    const start = performance.now();
    function frame(now) {
        const t = Math.min((now - start) / 650, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        let acc = 0, stops = [];
        dataArr.forEach(d => {
            const val = d.pct * eased;
            stops.push(`${d.color} ${acc}% ${acc + val}%`);
            acc += val;
        });
        el.style.background = dataArr.length
            ? `conic-gradient(${stops.join(',')}, #EEEBE4 ${acc}% 100%)`
            : '#EEEBE4';
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ---------- Render Functions ----------
function renderDashboard() {
    document.getElementById('monthLabel').textContent = monthLabelText();
    const s = summaryFor(currentMonth);
    const incomeValue = Object.prototype.hasOwnProperty.call(state.income, currentMonth) ? state.income[currentMonth] : '';
    document.getElementById('incomeInput').value = incomeValue;
    document.getElementById('totalExpenseVal').textContent = fmt(s.totalExpense);
    const remaining = s.income - s.totalExpense;
    const remEl = document.getElementById('remainingVal');
    remEl.textContent = fmt(remaining);
    remEl.className = 'val ' + (remaining < 0 ? 'neg' : 'pos');

    const sorted = CATEGORIES.map(c => ({ ...c, amount: s.byCategory[c.id] }))
        .filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
    const dataArr = sorted.map(c => ({ color: c.color, pct: c.amount / s.totalExpense * 100 }));
    drawDonut(document.getElementById('donut'), s.totalExpense > 0 ? dataArr : []);

    const legend = document.getElementById('legend');
    legend.innerHTML = '';
    if (sorted.length === 0) {
        legend.innerHTML = '<div class="empty">ยังไม่มีรายจ่ายเดือนนี้</div>';
    } else {
        sorted.forEach(c => {
            const pct = (c.amount / s.totalExpense * 100).toFixed(0);
            legend.innerHTML += `<div class="legend-item">
        <span class="dot" style="background:${c.color}"></span>
        <span class="lname">${c.icon} ${c.label}</span>
        <span class="lval">${pct}%</span>
      </div>`;
        });
    }
}

document.getElementById('incomeInput').addEventListener('change', e => {
    const newIncome = parseFloat(e.target.value) || 0;
    const oldIncome = state.income[currentMonth] || 0;
    state.income[currentMonth] = newIncome;
    save();
    if (newIncome !== oldIncome) {
        addLog('update_income', {
            month: currentMonth,
            oldAmount: `฿${oldIncome}`,
            newAmount: `฿${newIncome}`
        });
        showNotification(`อัปเดตรายรับเป็น ฿${newIncome.toLocaleString('th-TH')} ✓`, 'success');
    }
    renderAll();
});

function renderTransactions() {
    document.getElementById('monthLabel2').textContent = monthLabelText();
    const txs = txForMonth(currentMonth).sort((a, b) => (b.date || '').localeCompare(a.date || '') || Number(b.id) - Number(a.id));
    const list = document.getElementById('txList');
    if (txs.length === 0) {
        list.innerHTML = '<div class="empty">ยังไม่มีรายการในเดือนนี้</div>';
        return;
    }
    const grouped = {};
    txs.forEach(t => { (grouped[t.date] = grouped[t.date] || []).push(t); });
    list.innerHTML = '';
    Object.keys(grouped).forEach(date => {
        const dObj = new Date(date);
        const dLabel = dObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', weekday: 'short' });
        let html = `<div class="tx-day"><div class="dhead">${dLabel}</div>`;
        grouped[date].forEach(t => {
            const c = catInfo(t.category);
            html += `<div class="tx-item">
        <span class="dot" style="background:${c.color}"></span>
        <span class="ic">${c.icon}</span>
        <div class="mid">
          <div class="cat">${c.label}</div>
          <div class="note">${t.note ? t.note : (t.type === 'cash' ? 'เงินสด' : 'โอน/บัตร')}</div>
        </div>
        ${t.receipt ? `<img class="thumb" src="${t.receipt}" onclick="window.open('${t.receipt}')">` : ''}
        <span class="amt">-${fmt(t.amount)}</span>
        <button class="del" onclick="editTx(${t.id})" title="แก้ไข">✎</button>
        <button class="del" onclick="deleteTx(${t.id})" title="ลบ">✕</button>
      </div>`;
        });
        html += `</div>`;
        list.innerHTML += html;
    });
}

function deleteTx(id) {
    Swal.fire({ title: 'ลบรายการนี้?', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก' }).then(r => {
        if (r.isConfirmed) {
            const tx = state.transactions.find(t => Number(t.id) === Number(id));
            if (tx) {
                const catLabel = CATEGORIES.find(c => c.id === tx.category)?.label || tx.category;
                addLog('delete_transaction', {
                    date: tx.date,
                    amount: `฿${tx.amount}`,
                    category: catLabel,
                    note: tx.note || '-'
                });
                showNotification('ลบรายการแล้ว ✓', 'success');
            }
            state.transactions = state.transactions.filter(t => Number(t.id) !== Number(id));
            save();
            renderAll();
            Swal.fire('ลบแล้ว', 'รายการถูกลบเรียบร้อย', 'success');
        }
    });
}

function renderAnalysis() {
    document.getElementById('monthLabel3').textContent = monthLabelText();
    const s = summaryFor(currentMonth);
    const needsTotal = CATEGORIES.filter(c => c.group === 'need').reduce((sum, c) => sum + s.byCategory[c.id], 0);
    const wantsTotal = CATEGORIES.filter(c => c.group === 'want').reduce((sum, c) => sum + s.byCategory[c.id], 0);

    const rows = document.getElementById('barRows');
    rows.innerHTML = '';
    if (s.income > 0) {
        const needsPct = needsTotal / s.income * 100;
        const wantsPct = wantsTotal / s.income * 100;
        const savingsPct = Math.max((s.income - s.totalExpense) / s.income * 100, 0);
        rows.innerHTML = renderBar('จำเป็น', needsPct, 50, needsPct <= 55) +
            renderBar('ความสุข/ไม่จำเป็น', wantsPct, 30, wantsPct <= 35) +
            renderBar('เงินออม', savingsPct, 20, savingsPct >= 15);
    } else {
        rows.innerHTML = '<div class="empty">กรอกรายรับเดือนนี้ในหน้าภาพรวมก่อน เพื่อเทียบสัดส่วน 50/30/20</div>';
    }
    setTimeout(() => {
        document.querySelectorAll('.bar-fill').forEach(el => {
            el.style.width = el.dataset.target + '%';
        });
    }, 30);

    document.getElementById('tipsList').innerHTML = generateInsights(s).map(t => `<li>${t}</li>`).join('');
}

function renderBar(name, actualPct, targetPct, good) {
    const color = good ? 'var(--good)' : 'var(--danger)';
    return `<div class="bar-row">
    <div class="top"><span class="name">${name}</span><span>${actualPct.toFixed(0)}% (เป้า ${targetPct}%)</span></div>
    <div class="bar-track">
      <div class="bar-fill" data-target="${Math.min(actualPct, 100)}" style="background:${color}"></div>
      <div class="bar-target" style="left:${targetPct}%"></div>
    </div>
  </div>`;
}

function generateInsights(s) {
    const tips = [];
    if (s.totalExpense === 0) {
        tips.push('ยังไม่มีรายการรายจ่ายในเดือนนี้ ลองเริ่มบันทึกเพื่อดูภาพรวมและคำแนะนำ');
        return tips;
    }
    const sorted = CATEGORIES.map(c => ({ ...c, amount: s.byCategory[c.id] }))
        .filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
    const top = sorted[0];
    const topPct = (top.amount / s.totalExpense * 100).toFixed(0);
    tips.push(`หมวด "${top.label}" ใช้จ่ายมากที่สุด คิดเป็น ${topPct}% ของรายจ่ายรวม (${fmt(top.amount)} บาท)`);

    if (s.income > 0) {
        const needsTotal = CATEGORIES.filter(c => c.group === 'need').reduce((sum, c) => sum + s.byCategory[c.id], 0);
        const wantsTotal = CATEGORIES.filter(c => c.group === 'want').reduce((sum, c) => sum + s.byCategory[c.id], 0);
        const needsPct = needsTotal / s.income * 100;
        const wantsPct = wantsTotal / s.income * 100;
        const savings = s.income - s.totalExpense;
        const savingsPct = savings / s.income * 100;

        if (needsPct > 55) tips.push(`ค่าใช้จ่ายจำเป็นอยู่ที่ ${needsPct.toFixed(0)}% ของรายรับ สูงกว่าเกณฑ์ 50% ลองดูว่ามีบิลประจำที่ลดได้บ้างไหม`);
        if (wantsPct > 35) tips.push(`ค่าใช้จ่ายเพื่อความสุขอยู่ที่ ${wantsPct.toFixed(0)}% ของรายรับ สูงกว่าเกณฑ์ 30% อาจพักหมวดนี้บางส่วนในเดือนหน้า`);
        if (savings < 0) {
            tips.push(`เดือนนี้ใช้จ่ายเกินรายรับไป ${fmt(Math.abs(savings))} บาท ควรทบทวนรายจ่ายที่ตัดได้ก่อนสิ้นเดือน`);
        } else if (savingsPct < 15) {
            tips.push(`เก็บออมได้ ${savingsPct.toFixed(0)}% ของรายรับ ต่ำกว่าเป้าหมาย 20% ลองกันเงินออมไว้ก่อนใช้ตั้งแต่ต้นเดือนหน้า`);
        } else {
            tips.push(`เก็บออมได้ ${savingsPct.toFixed(0)}% ของรายรับ อยู่ในเกณฑ์ดีตามหลัก 50/30/20`);
        }
    } else {
        tips.push('กรอกรายรับเดือนนี้ในหน้าภาพรวม เพื่อคำนวณสัดส่วนเทียบกับหลัก 50/30/20 และเงินออม');
    }

    const today = new Date();
    const isCurrentMonth = currentMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (isCurrentMonth) {
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const dailyAvg = s.totalExpense / dayOfMonth;
        const projected = dailyAvg * daysInMonth;
        tips.push(`เฉลี่ยใช้จ่ายวันละ ${fmt(dailyAvg)} บาท ถ้าใช้ในอัตรานี้ต่อไป คาดว่าสิ้นเดือนจะใช้จ่ายรวมประมาณ ${fmt(projected)} บาท`);
    }
    return tips;
}

function renderActivityLog() {
    const list = document.getElementById('logList');
    if (state.activityLogs.length === 0) {
        list.innerHTML = '<div class="empty">ยังไม่มีประวัติการกระทำ</div>';
        return;
    }
    list.innerHTML = '';
    const grouped = {};
    state.activityLogs.forEach(log => {
        const date = log.timestamp.split('T')[0];
        (grouped[date] = grouped[date] || []).push(log);
    });

    Object.keys(grouped).sort().reverse().forEach(date => {
        const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', weekday: 'short' });
        let html = `<div class="tx-day"><div class="dhead">${dateStr}</div>`;
        grouped[date].forEach(log => {
            const actionIcons = {
                'add_transaction': '➕',
                'delete_transaction': '🗑️',
                'edit_transaction': '✏️',
                'update_income': '💰'
            };
            const actionLabel = {
                'add_transaction': '➕ เพิ่มรายจ่าย',
                'delete_transaction': '🗑️ ลบรายจ่าย',
                'edit_transaction': '✏️ แก้ไขรายจ่าย',
                'update_income': '💰 อัปเดตรายรับ'
            }[log.action] || log.action;

            html += `<div class="tx-item">
        <span class="ic" style="font-size:18px;">${actionIcons[log.action] || '📝'}</span>
        <div class="mid">
          <div class="cat">${actionLabel}</div>
          <div class="note">${log.dateDisplay}</div>
        </div>
        <button class="del" onclick="showLogDetails(${log.id})" title="ดูรายละเอียด" style="margin-left:auto;">→</button>
      </div>`;
        });
        html += `</div>`;
        list.innerHTML += html;
    });
}

function showLogDetails(logId) {
    const log = state.activityLogs.find(l => l.id === logId);
    if (!log) return;
    const detailsHtml = Object.entries(log.details).map(([k, v]) => `<div style="margin:8px 0;"><strong>${k}:</strong> ${v}</div>`).join('');
    Swal.fire({
        title: `รายละเอียด: ${log.action}`,
        html: `<div style="text-align:left;">${detailsHtml}</div><div style="margin-top:12px;font-size:12px;color:#999;">${log.dateDisplay}</div>`,
        icon: 'info'
    });
}

function renderAll() {
    renderDashboard();
    renderTransactions();
    renderAnalysis();
    renderActivityLog();
}

try {
    const donutEl = document.getElementById('donut');
    if (donutEl && window.ResizeObserver) {
        const ro = new ResizeObserver(() => { try { renderDashboard(); } catch (e) { console.error(e); } });
        ro.observe(donutEl);
    }
} catch (e) { console.error(e); }

renderAll();

// ---------- Export Functions ----------
function exportCSV(month) {
    const txs = txForMonth(month);
    if (!txs.length) { Swal.fire('ไม่มีข้อมูลสำหรับเดือนนี้'); return; }
    const rows = [['id', 'date', 'amount', 'category', 'type', 'note']];
    txs.forEach(t => rows.push([t.id, t.date, Number(t.amount || 0), t.category, t.type, `"${(t.note || '').replace(/"/g, '""')}"`]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `transactions-${month}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

document.getElementById('exportCsv')?.addEventListener('click', () => exportCSV(currentMonth));

function exportLogs() {
    if (!state.activityLogs.length) { Swal.fire('ไม่มีข้อมูลประวัติการกระทำ'); return; }
    const rows = [['timestamp', 'action', 'details']];
    state.activityLogs.forEach(log => {
        const details = Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' | ');
        rows.push([log.dateDisplay, log.action, `"${details.replace(/"/g, '""')}"`]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showNotification('ส่งออก CSV สำเร็จ ✓', 'success');
}

document.getElementById('exportLogsBtn')?.addEventListener('click', exportLogs);

function editTx(id) {
    const t = state.transactions.find(x => Number(x.id) === Number(id)); if (!t) return;
    Swal.fire({
        title: 'แก้ไขรายการ',
        html: `<input id="eAmt" class="swal2-input" type="number" value="${t.amount}"><input id="eDate" class="swal2-input" type="date" value="${t.date}"><input id="eNote" class="swal2-input" placeholder="โน้ต" value="${(t.note || '')}">`,
        focusConfirm: false,
        preConfirm: () => ({ amount: parseFloat(document.getElementById('eAmt').value), date: document.getElementById('eDate').value, note: document.getElementById('eNote').value })
    }).then(res => {
        if (res.isConfirmed) {
            const oldAmount = t.amount;
            const oldDate = t.date;
            const oldNote = t.note;
            t.amount = res.value.amount;
            t.date = res.value.date;
            t.note = res.value.note;
            if (oldAmount !== t.amount || oldDate !== t.date || oldNote !== t.note) {
                addLog('edit_transaction', {
                    oldAmount: `฿${oldAmount}`,
                    newAmount: `฿${t.amount}`,
                    oldDate,
                    newDate: t.date,
                    note: t.note || '-'
                });
                showNotification('แก้ไขรายการแล้ว ✓', 'success');
            }
            save();
            renderAll();
            Swal.fire('บันทึกการแก้ไขแล้ว', '', 'success');
        }
    });
}

// ---------- TAX calculator ----------
function calcThaiTax(annualIncome, deductions) {
    const taxable = Math.max(0, annualIncome - deductions);
    const rates = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];
    const bands = [150000, 150000, 200000, 250000, 250000, 1000000, 3000000];
    let remain = taxable; let tax = 0; let i = 0;
    if (taxable <= 150000) return { tax: 0, taxable };
    remain = taxable - 150000;
    for (i = 0; i < bands.length; i++) {
        const slab = Math.min(remain, bands[i]);
        if (slab > 0) { tax += slab * rates[i]; remain -= slab; }
        if (remain <= 0) break;
    }
    if (remain > 0) tax += remain * 0.35;
    return { tax, taxable };
}

document.getElementById('taxCalcBtn')?.addEventListener('click', () => {
    const inc = parseFloat(document.getElementById('taxIncome').value) || 0;
    const ded = parseFloat(document.getElementById('taxDeduct').value) || 0;
    const res = calcThaiTax(inc, ded);
    const out = document.getElementById('taxResult');
    out.className = '';
    out.innerHTML = `<div>เงินได้เสียภาษี: ฿${res.taxable.toFixed(2)}</div><div style="margin-top:8px;font-weight:700">ภาษีที่ต้องจ่าย (โดยประมาณ): ฿${res.tax.toFixed(2)}</div>`;
    gsap.from(out, { opacity: 0, y: 8, duration: 0.45 });
    Swal.fire({ title: 'คำนวณภาษีแล้ว', html: `<div>เงินได้เสียภาษี: ฿${res.taxable.toFixed(2)}<br>ภาษีโดยประมาณ: ฿${res.tax.toFixed(2)}</div>`, icon: 'info' });
});

window.addEventListener('resize', () => positionUnderline(tabsEl.querySelector('button.active')));

// ---------- Online Status ----------
function updateOnlineStatus() {
    const badge = document.getElementById('net-status');
    if (badge) {
        if (navigator.onLine) {
            badge.innerText = 'Online';
            badge.classList.remove('offline');
        } else {
            badge.innerText = 'Offline Mode';
            badge.classList.add('offline');
            showNotification('อยู่ในโหมดออฟไลน์ (เน็ตหมดก็ใช้งานได้)', 'error');
        }
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ---------- Service Worker Registration ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('✓ Service Worker registered:', registration);
        }).catch(err => {
            console.log('✗ Service Worker registration failed:', err);
        });
    });
}

// ---------- SYSTEM DIAGNOSTICS ----------
async function runSystemTests() {
    const testResultsContainer = document.getElementById('testResultsList');
    testResultsContainer.innerHTML = '<div style="text-align:center;padding:12px;color:var(--muted);">กำลังทำการทดสอบระบบ...</div>';

    const tests = [
        {
            name: "ระบบบันทึกความจำ LocalStorage",
            test: () => {
                const testKey = '__test_localstorage__';
                localStorage.setItem(testKey, '1');
                const val = localStorage.getItem(testKey);
                localStorage.removeItem(testKey);
                if (val !== '1') throw new Error("ไม่สามารถอ่าน-เขียนข้อมูล LocalStorage ได้");
            }
        },
        {
            name: "ความถูกต้องของโครงสร้างข้อมูล (Data Integrity)",
            test: () => {
                if (!Array.isArray(state.transactions)) throw new Error("ข้อมูล Transactions ผิดพลาด (ไม่ใช่ Array)");
                if (!Array.isArray(state.activityLogs)) throw new Error("ข้อมูล Activity Logs ผิดพลาด (ไม่ใช่ Array)");
                if (typeof state.income !== 'object') throw new Error("ข้อมูล Income ผิดพลาด (ไม่ใช่ Object)");
            }
        },
        {
            name: "ไลบรารีภายนอก (SweetAlert2 & GSAP)",
            test: () => {
                if (typeof Swal !== 'function') throw new Error("ไม่พบไลบรารี SweetAlert2");
                if (typeof gsap === 'undefined') throw new Error("ไม่พบไลบรารี GSAP Animation");
            }
        },
        {
            name: "ระบบประมวลผลรูปภาพ (Canvas & Compression API)",
            test: () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับ 2D Canvas สำหรับบีบอัดสลิป");
            }
        },
        {
            name: "ระบบรองรับการทำงานแบบออฟไลน์ (Service Worker API)",
            test: () => {
                if (!('serviceWorker' in navigator)) throw new Error("เบราว์เซอร์นี้ไม่รองรับ Service Worker (ออฟไลน์)");
            }
        }
    ];

    let passedCount = 0;
    let failedErrors = [];
    let htmlOutput = '';

    for (let t of tests) {
        try {
            await t.test();
            passedCount++;
            htmlOutput += `
                <div class="test-item pass">
                    <span>✅ ${t.name}</span>
                    <span class="test-badge pass">ปกติ (PASS)</span>
                </div>`;
        } catch (err) {
            failedErrors.push({ name: t.name, error: err.message });
            htmlOutput += `
                <div class="test-item fail">
                    <span>❌ ${t.name}</span>
                    <span class="test-badge fail">ผิดพลาด (FAIL)</span>
                </div>`;
        }
    }

    testResultsContainer.innerHTML = htmlOutput;

    if (failedErrors.length > 0) {
        const errorDetails = failedErrors.map(e => `<li style="margin-bottom:6px;"><strong>${e.name}:</strong><br><span style="color:#C9553F;">${e.error}</span></li>`).join('');
        Swal.fire({
            icon: 'error',
            title: 'ตรวจพบข้อผิดพลาดในระบบ!',
            html: `<div style="text-align:left;font-size:13px;"><p>พบปัญหา ${failedErrors.length} จุดที่ต้องแก้ไข:</p><ul>${errorDetails}</ul></div>`,
            confirmButtonText: 'รับทราบ'
        });
    } else {
        Swal.fire({
            icon: 'success',
            title: 'ระบบทั้งหมดทำงานปกติ!',
            text: `ผ่านการทดสอบทั้ง ${passedCount} รายการเรียบร้อยดี`,
            timer: 1500,
            showConfirmButton: false
        });
    }
}

document.getElementById('runTestBtn')?.addEventListener('click', runSystemTests);