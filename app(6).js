// ============================================================
// FINANCE MANAGER - FULL APP.JS
// ============================================================
// Features
// - LocalStorage
// - Dashboard
// - Income / Expense
// - Category donut
// - Daily / Monthly chart
// - Manual transaction
// - SweetAlert2 notifications
// - SweetAlert2 confirmations
// - Single slip OCR
// - Multi slip OCR
// - KBank OCR enhancement
// - Amount extraction enhancement
// - Date / Time / Sender / Receiver extraction
// - CSV export
// - Activity logs
// - 50/30/20 analysis
// - Tax calculator
// - Diagnostics
// ============================================================


// ============================================================
// 1. CONSTANTS
// ============================================================

const CATEGORIES = [
    {
        id: 'food',
        label: 'อาหาร/เครื่องดื่ม',
        icon: '🍲',
        color: '#FF7043'
    },
    {
        id: 'transport',
        label: 'เดินทาง/น้ำมัน',
        icon: '🚗',
        color: '#42A5F5'
    },
    {
        id: 'shopping',
        label: 'ชอปปิง',
        icon: '🛍️',
        color: '#AB47BC'
    },
    {
        id: 'bills',
        label: 'บิล/ค่าน้ำค่าไฟ',
        icon: '⚡',
        color: '#FFA726'
    },
    {
        id: 'entertainment',
        label: 'บันเทิง',
        icon: '🎬',
        color: '#26A69A'
    },
    {
        id: 'other',
        label: 'อื่นๆ',
        icon: '📦',
        color: '#78909C'
    }
];


let state = {
    currentMonth: new Date().toISOString().slice(0, 7),
    income: {},
    transactions: [],
    logs: []
};


let selectedCategory = 'food';

let manualReceiptBase64 = null;

let currentScannedImageBase64 = null;

let multiSlipResults = [];

let multiSlipWorker = null;

let incomeExpenseChart = null;

let chartMode = 'daily';


// ============================================================
// 2. INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    loadData();

    normalizeState();

    initUI();

    renderAll();

    initEnhancements();

});


// ============================================================
// 3. LOCAL STORAGE
// ============================================================

function normalizeState() {

    if (!state || typeof state !== 'object') {

        state = {
            currentMonth: new Date().toISOString().slice(0, 7),
            income: {},
            transactions: [],
            logs: []
        };

    }

    if (!state.income) {
        state.income = {};
    }

    if (!Array.isArray(state.transactions)) {
        state.transactions = [];
    }

    if (!Array.isArray(state.logs)) {
        state.logs = [];
    }

}


function loadData() {

    const saved = localStorage.getItem(
        'finance_app_data'
    );

    if (!saved) {
        return;
    }

    try {

        state = JSON.parse(saved);

    } catch (error) {

        console.error(
            'Data parsing error:',
            error
        );

        Swal.fire({
            icon: 'error',
            title: 'โหลดข้อมูลไม่สำเร็จ',
            text: 'ข้อมูลเดิมอาจเสียหาย ระบบจะเริ่มต้นข้อมูลใหม่'
        });

    }

}


function save() {

    try {

        localStorage.setItem(
            'finance_app_data',
            JSON.stringify(state)
        );

    } catch (error) {

        console.error(
            'LocalStorage error:',
            error
        );

        Swal.fire({
            icon: 'error',
            title: 'บันทึกข้อมูลไม่สำเร็จ',
            text: 'พื้นที่จัดเก็บข้อมูลของเบราว์เซอร์อาจเต็ม'
        });

    }

}


// ============================================================
// 4. DATE / NUMBER HELPERS
// ============================================================

function todayStr() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
        now.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
}


function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString(
            'th-TH',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}


function normalizeThaiDigits(text) {

    if (!text) return '';

    const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';

    return String(text)
        .replace(
            /[๐-๙]/g,
            digit =>
                String(
                    thaiDigits.indexOf(
                        digit
                    )
                )
        );

}


function cleanOCRText(text) {

    return normalizeThaiDigits(
        String(text || '')
    )
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

}


// ============================================================
// 5. UI INITIALIZATION
// ============================================================

function initUI() {

    const dateInput =
        document.getElementById('fDate');

    if (dateInput) {
        dateInput.value = todayStr();
    }


    const categoryGrid =
        document.getElementById('catGrid');

    if (categoryGrid) {

        categoryGrid.innerHTML =
            CATEGORIES
                .map(
                    category => `
                        <button
                            type="button"
                            class="category-btn ${
                                category.id === selectedCategory
                                    ? 'active'
                                    : ''
                            }"
                            data-category="${
                                category.id
                            }"
                            onclick="
                                selectCategory(
                                    '${category.id}'
                                )
                            "
                        >
                            <span class="category-icon">
                                ${category.icon}
                            </span>

                            <span>
                                ${category.label}
                            </span>
                        </button>
                    `
                )
                .join('');

    }


    const categorySelect =
        document.getElementById(
            'resCategory'
        );

    if (categorySelect) {

        categorySelect.innerHTML =
            CATEGORIES
                .map(
                    category => `
                        <option
                            value="${category.id}"
                        >
                            ${category.icon}
                            ${category.label}
                        </option>
                    `
                )
                .join('');

    }


    initTabs();

    initManualForm();

    initScanner();

    initMultiScanner();

}


// ============================================================
// 6. TABS
// ============================================================

function initTabs() {

    document
        .querySelectorAll(
            '[data-page]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    'click',
                    () => {

                        const page =
                            button.dataset.page;

                        showPage(page);

                    }
                );

            }
        );

}


function showPage(page) {

    document
        .querySelectorAll(
            '.page'
        )
        .forEach(
            section => {

                section.style.display =
                    section.id ===
                    `page-${page}`
                        ? 'block'
                        : 'none';

            }
        );


    document
        .querySelectorAll(
            '[data-page]'
        )
        .forEach(
            button => {

                button.classList.toggle(
                    'active',
                    button.dataset.page ===
                        page
                );

            }
        );

}


// ============================================================
// 7. CATEGORY
// ============================================================

function selectCategory(categoryId) {

    if (
        !CATEGORIES.some(
            category =>
                category.id ===
                categoryId
        )
    ) {
        return;
    }


    selectedCategory =
        categoryId;


    document
        .querySelectorAll(
            '.category-btn'
        )
        .forEach(
            button => {

                button.classList.toggle(
                    'active',
                    button.dataset.category ===
                        categoryId
                );

            }
        );


    const select =
        document.getElementById(
            'resCategory'
        );

    if (select) {
        select.value =
            categoryId;
    }

}


// ============================================================
// 8. MANUAL TRANSACTION
// ============================================================

function initManualForm() {

    const form =
        document.getElementById(
            'expenseForm'
        );

    if (!form) {
        return;
    }


    form.addEventListener(
        'submit',
        async event => {

            event.preventDefault();

            await saveManualTransaction();

        }
    );

}


async function saveManualTransaction() {

    const date =
        document.getElementById(
            'fDate'
        )?.value ||
        todayStr();


    const amount =
        parseFloat(
            document.getElementById(
                'fAmount'
            )?.value || 0
        );


    const type =
        document.getElementById(
            'fType'
        )?.value ||
        'cash';


    const note =
        document.getElementById(
            'fNote'
        )?.value
            ?.trim() ||
        '';


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        await notifyWarning(
            'จำนวนเงินไม่ถูกต้อง',
            'กรุณาระบุจำนวนเงินมากกว่า 0'
        );

        return;

    }


    const transaction = {

        id: Date.now(),

        date,

        time:
            new Date()
                .toTimeString()
                .slice(0, 5),

        amount,

        category:
            selectedCategory,

        type,

        sender: '',

        receiver: '',

        note,

        receipt:
            manualReceiptBase64

    };


    state.transactions.push(
        transaction
    );


    save();

    addLog(
        'add_transaction',
        transaction
    );


    await notifySuccess(
        'บันทึกรายการเรียบร้อย',
        `฿${formatMoney(amount)}`
    );


    const form =
        document.getElementById(
            'expenseForm'
        );

    if (form) {
        form.reset();
    }


    manualReceiptBase64 =
        null;


    renderAll();

}
    return `${year}-${month}-${day}`;

}


function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString(
            'th-TH',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}


function normalizeThaiDigits(text) {

    if (!text) return '';

    const thaiDigits = {
        '๐': '0',
        '๑': '1',
        '๒': '2',
        '๓': '3',
        '๔': '4',
        '๕': '5',
        '๖': '6',
        '๗': '7',
        '๘': '8',
        '๙': '9'
    };

    return String(text).replace(
        /[๐-๙]/g,
        d => thaiDigits[d]
    );

}


function normalizeOCRText(text) {

    let result = normalizeThaiDigits(
        text || ''
    );

    result = result
        .replace(/\u00A0/g, ' ')
        .replace(/[‐-‒–—]/g, '-')
        .replace(/[|]/g, 'I');

    return result;

}


// ============================================================
// 5. SWEETALERT2
// ============================================================

function swalDefault() {

    return {
        confirmButtonText: 'ตกลง',
        cancelButtonText: 'ยกเลิก'
    };

}


function notifySuccess(
    title,
    text = ''
) {

    return Swal.fire({
        icon: 'success',
        title,
        text,
        timer: 1800,
        showConfirmButton: false,
        timerProgressBar: true
    });

}


function notifyInfo(
    title,
    text = ''
) {

    return Swal.fire({
        icon: 'info',
        title,
        text,
        ...swalDefault()
    });

}


function notifyWarning(
    title,
    text = ''
) {

    return Swal.fire({
        icon: 'warning',
        title,
        text,
        ...swalDefault()
    });

}


function notifyError(
    title,
    text = ''
) {

    return Swal.fire({
        icon: 'error',
        title,
        text,
        ...swalDefault()
    });

}


async function confirmAction(
    title,
    text,
    confirmText = 'ยืนยัน'
) {

    const result = await Swal.fire({

        icon: 'question',

        title,

        text,

        showCancelButton: true,

        confirmButtonText: confirmText,

        cancelButtonText: 'ยกเลิก',

        reverseButtons: true,

        focusCancel: true

    });

    return result.isConfirmed;

}


// เดิมมี showNotification()
// คงชื่อเดิมไว้เพื่อไม่ให้ฟังก์ชันเก่าพัง
function showNotification(
    title,
    icon = 'success'
) {

    return Swal.fire({

        toast: true,

        position: 'top-end',

        icon,

        title,

        showConfirmButton: false,

        timer: 2200,

        timerProgressBar: true

    });

}


// ============================================================
// 6. UI INIT
// ============================================================

function initUI() {

    const fDate =
        document.getElementById('fDate');

    if (fDate) {
        fDate.value = todayStr();
    }


    // Category grid
    const catGrid =
        document.getElementById('catGrid');

    if (catGrid) {

        catGrid.innerHTML =
            CATEGORIES.map(
                category => `

                <div
                    class="cat-item ${
                        category.id === selectedCategory
                            ? 'active'
                            : ''
                    }"
                    data-id="${category.id}"
                >

                    <div style="font-size:18px;">
                        ${category.icon}
                    </div>

                    <div>
                        ${category.label}
                    </div>

                </div>

            `
            ).join('');


        catGrid
            .querySelectorAll('.cat-item')
            .forEach(element => {

                element.addEventListener(
                    'click',
                    () => {

                        catGrid
                            .querySelectorAll(
                                '.cat-item'
                            )
                            .forEach(item =>
                                item.classList.remove(
                                    'active'
                                )
                            );

                        element.classList.add(
                            'active'
                        );

                        selectedCategory =
                            element.dataset.id;

                    }
                );

            });

    }


    // Category dropdown
    const resCat =
        document.getElementById(
            'resCategory'
        );

    if (resCat) {

        resCat.innerHTML =
            CATEGORIES.map(
                category => `

                <option value="${category.id}">
                    ${category.icon}
                    ${category.label}
                </option>

            `
            ).join('');

    }


    initNavigation();

    initIncomeInput();

    initManualForm();

    initReceiptUpload();

    initExportButtons();

    initTaxButton();

    initDiagnostics();

    initSlipScanner();

}


// ============================================================
// 7. NAVIGATION
// ============================================================

function initNavigation() {

    const tabs =
        document.getElementById('tabs');

    const pages =
        document.querySelectorAll('.page');

    const underline =
        document.getElementById(
            'underline'
        );

    const dropdownMenu =
        document.getElementById(
            'dropdownMenu'
        );

    const dropdownBtn =
        document.getElementById(
            'dropdownBtn'
        );


    function updateUnderline(btn) {

        if (!btn || !underline || !tabs) {
            return;
        }

        const rect =
            btn.getBoundingClientRect();

        const parentRect =
            tabs.getBoundingClientRect();

        underline.style.width =
            `${rect.width}px`;

        underline.style.left =
            `${rect.left - parentRect.left}px`;

    }


    document
        .querySelectorAll('[data-page]')
        .forEach(btn => {

            btn.addEventListener(
                'click',
                () => {

                    const pageId =
                        btn.dataset.page;

                    pages.forEach(
                        page =>
                            page.classList.remove(
                                'active'
                            )
                    );

                    const page =
                        document.getElementById(
                            pageId
                        );

                    if (page) {
                        page.classList.add(
                            'active'
                        );
                    }


                    document
                        .querySelectorAll(
                            '#tabs button'
                        )
                        .forEach(
                            button =>
                                button.classList.remove(
                                    'active'
                                )
                        );


                    btn.classList.add(
                        'active'
                    );


                    if (
                        dropdownMenu &&
                        dropdownMenu.contains(btn)
                    ) {

                        dropdownBtn?.classList.add(
                            'active'
                        );

                    } else {

                        dropdownMenu?.classList.remove(
                            'show'
                        );

                    }


                    const underlineBtn =
                        dropdownMenu &&
                        dropdownMenu.contains(btn)
                            ? dropdownBtn
                            : btn;

                    updateUnderline(
                        underlineBtn
                    );

                    renderAll();

                }
            );

        });


    dropdownBtn?.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            dropdownMenu?.classList.toggle(
                'show'
            );

        }
    );


    document.addEventListener(
        'click',
        () => {

            dropdownMenu?.classList.remove(
                'show'
            );

        }
    );


    setTimeout(
        () => {

            updateUnderline(
                tabs?.querySelector(
                    'button.active'
                )
            );

        },
        100
    );

}


// ============================================================
// 8. INCOME
// ============================================================

function initIncomeInput() {

    const incomeInput =
        document.getElementById(
            'incomeInput'
        );

    incomeInput?.addEventListener(
        'change',
        async event => {

            const value =
                parseFloat(
                    event.target.value
                ) || 0;


            const oldValue =
                state.income[
                    state.currentMonth
                ] || 0;


            if (value !== oldValue) {

                const confirmed =
                    await confirmAction(
                        'ยืนยันรายรับ?',
                        `รายรับเดือนนี้ ฿${formatMoney(value)}`,
                        'บันทึกรายรับ'
                    );

                if (!confirmed) {

                    event.target.value =
                        oldValue || '';

                    return;

                }

            }


            state.income[
                state.currentMonth
            ] = value;

            save();

            addLog(
                'update_income',
                {
                    month:
                        state.currentMonth,
                    amount:
                        value
                }
            );

            renderAll();

            showNotification(
                'บันทึกรายรับเรียบร้อย',
                'success'
            );

        }
    );

}


// ============================================================
// 9. MANUAL TRANSACTION
// ============================================================

function initManualForm() {

    const form =
        document.getElementById(
            'entryForm'
        );

    if (!form) return;


    form.addEventListener(
        'submit',
        async event => {

            event.preventDefault();


            const date =
                document.getElementById(
                    'fDate'
                )?.value || todayStr();


            const amount =
                parseFloat(
                    document.getElementById(
                        'fAmount'
                    )?.value || 0
                );


            const type =
                document.querySelector(
                    'input[name="type"]:checked'
                )?.value || 'cash';


            const note =
                document.getElementById(
                    'fNote'
                )?.value.trim() || '';


            if (!amount || amount <= 0) {

                await notifyWarning(
                    'จำนวนเงินไม่ถูกต้อง',
                    'กรุณาระบุจำนวนเงินมากกว่า 0'
                );

                return;

            }


            const category =
                CATEGORIES.find(
                    c =>
                        c.id ===
                        selectedCategory
                );


            const confirmed =
                await confirmAction(

                    'ยืนยันการบันทึกรายการ?',

                    `วันที่ ${date}
จำนวนเงิน ฿${formatMoney(amount)}
หมวดหมู่ ${category?.label || 'อื่นๆ'}
${note || 'ไม่มีรายละเอียด'}`,

                    'บันทึกรายการ'

                );


            if (!confirmed) {
                return;
            }


            const tx = {

                id: Date.now(),

                date,

                amount,

                category:
                    selectedCategory,

                type,

                note,

                receipt:
                    manualReceiptBase64

            };


            state.transactions.push(
                tx
            );


            save();


            addLog(
                'add_transaction',
                {
                    date,
                    amount:
                        `฿${formatMoney(amount)}`,
                    category:
                        category?.label ||
                        selectedCategory,
                    note
                }
            );


            document.getElementById(
                'fAmount'
            ).value = '';


            document.getElementById(
                'fNote'
            ).value = '';


            manualReceiptBase64 =
                null;


            const uploadTxt =
                document.getElementById(
                    'uploadTxt'
                );

            if (uploadTxt) {

                uploadTxt.textContent =
                    '📷 แตะเพื่อแนบรูปสลิปเก็บไว้';

            }


            renderAll();


            await notifySuccess(
                'บันทึกรายการเรียบร้อย',
                `฿${formatMoney(amount)}`
            );

        }
    );

}


// ============================================================
// 10. RECEIPT UPLOAD
// ============================================================

function initReceiptUpload() {

    const uploadBox =
        document.getElementById(
            'uploadBox'
        );

    const fReceipt =
        document.getElementById(
            'fReceipt'
        );


    uploadBox?.addEventListener(
        'click',
        () => fReceipt?.click()
    );


    fReceipt?.addEventListener(
        'change',
        async event => {

            const file =
                event.target.files?.[0];

            if (!file) return;


            if (
                !file.type.startsWith(
                    'image/'
                )
            ) {

                await notifyError(
                    'ไฟล์ไม่ถูกต้อง',
                    'กรุณาเลือกไฟล์รูปภาพ'
                );

                return;

            }


            manualReceiptBase64 =
                await compressImage(
                    file,
                    800,
                    0.8
                );


            const uploadTxt =
                document.getElementById(
                    'uploadTxt'
                );

            if (uploadTxt) {

                uploadTxt.textContent =
                    `✅ แนบไฟล์เรียบร้อย (${file.name})`;

            }

        }
    );

}


// ============================================================
// 11. EXPORT / TAX / TEST
// ============================================================

function initExportButtons() {

    document
        .getElementById('exportCsv')
        ?.addEventListener(
            'click',
            exportTransactionsCSV
        );


    document
        .getElementById('exportLogsBtn')
        ?.addEventListener(
            'click',
            exportLogsCSV
        );

}


function initTaxButton() {

    document
        .getElementById('taxCalcBtn')
        ?.addEventListener(
            'click',
            async () => {

                const income =
                    parseFloat(
                        document.getElementById(
                            'taxIncome'
                        )?.value || 0
                    );


                if (!income) {

                    await notifyWarning(
                        'ยังไม่ได้กรอกรายได้',
                        'กรุณากรอกรายได้ทั้งปีก่อน'
                    );

                    return;

                }


                const confirmed =
                    await confirmAction(
                        'ยืนยันการคำนวณภาษี?',
                        `รายได้ทั้งปี ฿${formatMoney(income)}`,
                        'คำนวณภาษี'
                    );


                if (confirmed) {
                    calculateTax();
                }

            }
        );

}


function initDiagnostics() {

    document
        .getElementById('runTestBtn')
        ?.addEventListener(
            'click',
            runSystemDiagnostics
        );

}


// ============================================================
// 12. SLIP SCANNER
// ============================================================

function initSlipScanner() {

    const dropzone =
        document.getElementById(
            'scanDropzone'
        );

    const input =
        document.getElementById(
            'scanFileInput'
        );


    if (!dropzone || !input) {
        return;
    }


    input.multiple = true;


    dropzone.addEventListener(
        'click',
        event => {

            if (
                event.target === input
            ) {
                return;
            }

            input.click();

        }
    );


    dropzone.addEventListener(
        'dragover',
        event => {

            event.preventDefault();

            dropzone.style.borderColor =
                'var(--good)';

        }
    );


    dropzone.addEventListener(
        'dragleave',
        () => {

            dropzone.style.borderColor =
                'var(--accent)';

        }
    );


    dropzone.addEventListener(
        'drop',
        async event => {

            event.preventDefault();

            dropzone.style.borderColor =
                'var(--accent)';

            const files =
                Array.from(
                    event.dataTransfer.files || []
                )
                .filter(
                    file =>
                        file.type.startsWith(
                            'image/'
                        )
                );


            if (!files.length) {

                await notifyWarning(
                    'ไม่พบรูปภาพ',
                    'กรุณาลากไฟล์รูปภาพสลิป'
                );

                return;

            }


            if (files.length === 1) {

                await processSlipImage(
                    files[0]
                );

            } else {

                await processMultipleSlipImages(
                    files
                );

            }

        }
    );


    input.addEventListener(
        'change',
        async event => {

            const files =
                Array.from(
                    event.target.files || []
                )
                .filter(
                    file =>
                        file.type.startsWith(
                            'image/'
                        )
                );


            if (!files.length) {
                return;
            }


            if (files.length === 1) {

                await processSlipImage(
                    files[0]
                );

            } else {

                await processMultipleSlipImages(
                    files
                );

            }


            input.value = '';

        }
    );


    document
        .getElementById(
            'confirmSaveBtn'
        )
        ?.addEventListener(
            'click',
            saveSingleScannedReceipt
        );


    document
        .getElementById(
            'reScanBtn'
        )
        ?.addEventListener(
            'click',
            async () => {

                const confirmed =
                    await confirmAction(
                        'สแกนใหม่?',
                        'ข้อมูลที่อ่านได้ในใบนี้จะถูกล้าง',
                        'สแกนใหม่'
                    );

                if (confirmed) {
                    resetScanUI();
                }

            }
        );

}


// ============================================================
// 13. SINGLE OCR
// ============================================================

async function enhanceSlipForOCR(
    base64
) {

    return new Promise(
        (resolve, reject) => {

            const image =
                new Image();

            image.onload =
                () => {

                    try {

                        const maxWidth =
                            1800;

                        const scale =
                            Math.min(
                                1.5,
                                maxWidth /
                                    image.width
                            );

                        const width =
                            Math.max(
                                1,
                                Math.round(
                                    image.width *
                                    scale
                                )
                            );

                        const height =
                            Math.max(
                                1,
                                Math.round(
                                    image.height *
                                    scale
                                )
                            );

                        const canvas =
                            document.createElement(
                                'canvas'
                            );

                        canvas.width =
                            width;

                        canvas.height =
                            height;

                        const ctx =
                            canvas.getContext(
                                '2d'
                            );

                        ctx.drawImage(
                            image,
                            0,
                            0,
                            width,
                            height
                        );

                        const imageData =
                            ctx.getImageData(
                                0,
                                0,
                                width,
                                height
                            );

                        const data =
                            imageData.data;

                        /*
                         * Grayscale + contrast:
                         * ช่วยตัวหนังสือสีเทา/จางบนพื้นสลิป
                         * โดยเฉพาะชื่อและยอดเงิน
                         */
                        const contrast =
                            1.45;

                        const intercept =
                            128 *
                            (1 - contrast);

                        for (
                            let i = 0;
                            i < data.length;
                            i += 4
                        ) {

                            const gray =
                                (
                                    0.299 *
                                    data[i]
                                ) +
                                (
                                    0.587 *
                                    data[i + 1]
                                ) +
                                (
                                    0.114 *
                                    data[i + 2]
                                );

                            const adjusted =
                                Math.max(
                                    0,
                                    Math.min(
                                        255,
                                        gray *
                                            contrast +
                                            intercept
                                    )
                                );

                            data[i] =
                                adjusted;

                            data[i + 1] =
                                adjusted;

                            data[i + 2] =
                                adjusted;

                        }

                        ctx.putImageData(
                            imageData,
                            0,
                            0
                        );

                        resolve(
                            canvas.toDataURL(
                                'image/jpeg',
                                0.95
                            )
                        );

                    } catch (error) {

                        reject(
                            error
                        );

                    }

                };

            image.onerror =
                reject;

            image.src =
                base64;

        }
    );

}


function mergeOCRTexts(
    primary,
    enhanced
) {

    const first =
        String(
            primary || ''
        ).trim();

    const second =
        String(
            enhanced || ''
        ).trim();

    if (!second) {
        return first;
    }

    if (!first) {
        return second;
    }

    return (
        first +
        '\\n' +
        second
    );

}


function mergeKBankParsedResults(results) {

    const valid = (results || []).filter(Boolean);
    if (!valid.length) return {};

    const base = valid[0] || {};

    const amountValues = valid
        .map(item => Number(item.amount || 0))
        .filter(value => Number.isFinite(value) && value > 0);

    // ยอดเงินต้องตรงกันอย่างน้อย 1 รอบ และให้ค่าที่มาจาก label จำนวนเงินเป็นหลัก
    const amountCounts = new Map();

    amountValues.forEach(value => {

        const key =
            value.toFixed(2);

        amountCounts.set(
            key,
            (
                amountCounts.get(key) ||
                0
            ) + 1
        );

    });

    const consensusAmount =
        [
            ...amountCounts.entries()
        ]
        .sort(
            (a, b) =>
                b[1] - a[1]
        )[0]?.[0];


    const namesSender =
        valid
            .map(
                item =>
                    item.sender
            )
            .filter(Boolean);


    const namesReceiver =
        valid
            .map(
                item =>
                    item.receiver
            )
            .filter(Boolean);


    const sender =
        namesSender.length
            ? namesSender.reduce(
                (
                    best,
                    name
                ) =>
                    chooseBetterPersonName(
                        best,
                        name,
                        'sender'
                    ),
                ''
            )
            : '';


    const receiver =
        namesReceiver.length
            ? namesReceiver.reduce(
                (
                    best,
                    name
                ) =>
                    chooseBetterPersonName(
                        best,
                        name,
                        'receiver'
                    ),
                ''
            )
            : '';


    const dates =
        valid
            .map(
                item =>
                    item.date
            )
            .filter(Boolean);


    const times =
        valid
            .map(
                item =>
                    item.time
            )
            .filter(Boolean);


    const date =
        dates.find(
            d =>
                dates.filter(
                    x => x === d
                ).length >= 2
        ) ||
        dates[0] ||
        '';


    const time =
        times.find(
            t =>
                times.filter(
                    x => x === t
                ).length >= 2
        ) ||
        times[0] ||
        '';


    const best =
        valid
            .slice()
            .sort(
                (a, b) => {

                    const score =
                        item =>

                            (item.sender ? 4 : 0) +

                            (item.receiver ? 4 : 0) +

                            (item.amount ? 4 : 0) +

                            (item.date ? 2 : 0) +

                            (item.time ? 1 : 0);


                    return score(b) -
                        score(a);

                }
            )[0] ||
        base;


    return {

        ...best,

        amount:
            consensusAmount
                ? Number(
                    consensusAmount
                )
                : (
                    best.amount ||
                    0
                ),

        sender,

        receiver,

        date,

        time

    };

}


async function processSlipImage(
    file
) {

    if (
        !file ||
        !file.type.startsWith('image/')
    ) {

        await notifyError(
            'ไฟล์ไม่ถูกต้อง',
            'กรุณาอัปโหลดรูปสลิปเท่านั้น'
        );

        return;

    }


    const preview =
        document.getElementById(
            'scanPreviewImg'
        );

    const dropzone =
        document.getElementById(
            'scanDropzone'
        );

    const previewBox =
        document.getElementById(
            'scanPreviewBox'
        );

    const resultCard =
        document.getElementById(
            'scanResultCard'
        );

    const progress =
        document.getElementById(
            'scanProgressTxt'
        );


    currentScannedImageBase64 =
        await compressImage(
            file,
            1800,
            0.94
        );


    if (preview) {
        preview.src =
            currentScannedImageBase64;
    }


    if (dropzone) {
        dropzone.style.display =
            'none';
    }


    if (previewBox) {
        previewBox.style.display =
            'flex';
    }


    if (resultCard) {
        resultCard.style.display =
            'none';
    }


    let worker = null;


    try {

        if (progress) {
            progress.textContent =
                'กำลังอ่านข้อความบนสลิป...';
        }


        worker =
            await Tesseract.createWorker(
                'tha+eng'
            );


        // รอบที่ 1: ภาพต้นฉบับคุณภาพสูง
        const primaryResult =
            await worker.recognize(
                currentScannedImageBase64
            );


        const primaryText =
            primaryResult?.data?.text ||
            '';


        const primaryParsed =
            parseSlipOCRText(
                primaryText
            );


        let parsed =
            primaryParsed;


        let allTexts =
            [primaryText];


        // KBank: อ่านซ้ำทุกครั้งที่ข้อมูลสำคัญยังไม่ครบ
        // และอ่านเฉพาะบริเวณชื่อเพื่อป้องกัน OCR ของเลขอ้างอิง/บัญชีมาปนกับชื่อ
        if (
            primaryParsed.bank ===
            'kbank'
        ) {

            const parsedResults =
                [primaryParsed];


            if (progress) {
                progress.textContent =
                    'กำลังตรวจสอบยอดและชื่อผู้โอน/ผู้รับ KBank...';
            }


            try {

                const enhancedImage =
                    await enhanceSlipForOCR(
                        currentScannedImageBase64
                    );


                const enhancedResult =
                    await worker.recognize(
                        enhancedImage
                    );


                const enhancedText =
                    enhancedResult?.data?.text ||
                    '';


                allTexts.push(
                    enhancedText
                );


                parsedResults.push(
                    parseSlipOCRText(
                        enhancedText
                    )
                );


            } catch (error) {

                console.warn(
                    'KBank enhanced OCR failed:',
                    error
                );

            }


            try {

                const personImage =
                    await createKBankPersonOCRImage(
                        currentScannedImageBase64
                    );


                const personResult =
                    await worker.recognize(
                        personImage
                    );


                const personText =
                    personResult?.data?.text ||
                    '';


                allTexts.push(
                    personText
                );


                parsedResults.push(
                    parseSlipOCRText(
                        personText
                    )
                );


            } catch (error) {

                console.warn(
                    'KBank person-region OCR failed:',
                    error
                );

            }


            // ใช้ consensus/คะแนน ไม่ใช่รอบล่าสุดทับรอบแรก
            parsed =
                mergeKBankParsedResults(
                    parsedResults
                );


            parsed.rawText =
                mergeOCRTexts(
                    primaryText,
                    allTexts
                        .slice(1)
                        .join('\n')
                );

        }


        if (worker) {

            await worker.terminate();

            worker = null;

        }


        if (progress) {
            progress.textContent =
                'กำลังตรวจสอบข้อมูลก่อนแสดงผล...';
        }


        fillSingleScanResult(
            parsed
        );


        document
            .getElementById(
                'scannerLine'
            )
            ?.style.setProperty(
                'display',
                'none'
            );


        document
            .getElementById(
                'scanStatus'
            )
            ?.style.setProperty(
                'display',
                'none'
            );


        if (resultCard) {
            resultCard.style.display =
                'block';
        }


        const missing = [];


        if (!parsed.amount) {
            missing.push(
                'จำนวนเงิน'
            );
        }


        if (!parsed.sender) {
            missing.push(
                'ผู้โอน'
            );
        }


        if (!parsed.receiver) {
            missing.push(
                'ผู้รับ'
            );
        }


        if (missing.length) {

            await notifyWarning(

                'อ่านสลิปแล้ว แต่ข้อมูลบางส่วนยังไม่ชัด',

                `กรุณาตรวจสอบ: ${missing.join(', ')} ก่อนบันทึก`

            );

        } else {

            await notifySuccess(

                'อ่านและตรวจสอบสลิปสำเร็จ',

                `฿${formatMoney(parsed.amount)} | ${parsed.sender} → ${parsed.receiver}`

            );

        }


    } catch (error) {

        console.error(
            'OCR Error:',
            error
        );


        if (worker) {

            try {
                await worker.terminate();
            } catch (_) {}

        }


        await notifyError(

            'อ่านสลิปไม่สำเร็จ',

            'ลองใช้รูปที่คมชัดขึ้นหรือถ่ายให้เห็นสลิปทั้งใบ'

        );


        resetScanUI();

    }

}


// ============================================================
้            parsed.rawText = mergeOCRTexts(primaryText, allTexts.slice(1).join('\n'));
        }

        if (worker) {
            await worker.terminate();
            worker = null;
        }

        if (progress) progress.textContent = 'กำลังตรวจสอบข้อมูลก่อนแสดงผล...';

        fillSingleScanResult(parsed);

        document.getElementById('scannerLine')?.style.setProperty('display', 'none');
        document.getElementById('scanStatus')?.style.setProperty('display', 'none');
        if (resultCard) resultCard.style.display = 'block';

        const missing = [];
        if (!parsed.amount) missing.push('จำนวนเงิน');
        if (!parsed.sender) missing.push('ผู้โอน');
        if (!parsed.receiver) missing.push('ผู้รับ');

        if (missing.length) {
            await notifyWarning(
                'อ่านสลิปแล้ว แต่ข้อมูลบางส่วนยังไม่ชัด',
                `กรุณาตรวจสอบ: ${missing.join(', ')} ก่อนบันทึก`
            );
        } else {
            await notifySuccess(
                'อ่านและตรวจสอบสลิปสำเร็จ',
                `฿${formatMoney(parsed.amount)} | ${parsed.sender} → ${parsed.receiver}`
            );
        }

    } catch (error) {

        console.error('OCR Error:', error);

        if (worker) {
            try { await worker.terminate(); } catch (_) {}
        }

        await notifyError(
            'อ่านสลิปไม่สำเร็จ',
            'ลองใช้รูปที่คมชัดขึ้นหรือถ่ายให้เห็นสลิปทั้งใบ'
        );

        resetScanUI();
    }

}


// ============================================================
// 14. FILL SINGLE RESULT
// ============================================================

function fillSingleScanResult(
    data
) {

    const amount =
        document.getElementById(
            'resAmount'
        );

    const date =
        document.getElementById(
            'resDate'
        );

    const time =
        document.getElementById(
            'resTime'
        );

    const category =
        document.getElementById(
            'resCategory'
        );

    const sender =
        document.getElementById(
            'resSender'
        );

    const receiver =
        document.getElementById(
            'resReceiver'
        );

    const note =
        document.getElementById(
            'resNote'
        );


    if (amount) {
        amount.value =
            data.amount || '';
    }


    if (date) {
        date.value =
            data.date || todayStr();
    }


    if (time) {
        time.value =
            data.time || '';
    }


    if (category) {
        category.value =
            data.category || 'other';
    }


    if (sender) {
        sender.value =
            data.sender || '';
    }


    if (receiver) {
        receiver.value =
            data.receiver || '';
    }


    if (note) {
        note.value =
            data.note ||
            'โอนผ่านสลิปธนาคาร';
    }

}


// ============================================================
// 15. SAVE SINGLE OCR
// ============================================================

async function saveSingleScannedReceipt() {

    const amount =
        parseFloat(
            document.getElementById(
                'resAmount'
            )?.value || 0
        );


    const date =
        document.getElementById(
            'resDate'
        )?.value || todayStr();


    const time =
        document.getElementById(
            'resTime'
        )?.value || '';


    const category =
        document.getElementById(
            'resCategory'
        )?.value || 'other';


    const sender =
        document.getElementById(
            'resSender'
        )?.value.trim() || '';


    const receiver =
        document.getElementById(
            'resReceiver'
        )?.value.trim() || '';


    const note =
        document.getElementById(
            'resNote'
        )?.value.trim() ||
        'โอนผ่านสลิปธนาคาร';


    if (!amount || amount <= 0) {

        await notifyWarning(
            'ยังไม่มียอดเงิน',
            'กรุณาตรวจสอบยอดเงินก่อนบันทึก'
        );

        document.getElementById(
            'resAmount'
        )?.focus();

        return;

    }


    const confirmed =
        await confirmAction(

            'ยืนยันบันทึกสลิป?',

            `จำนวนเงิน ฿${formatMoney(amount)}
วันที่ ${date}
${time ? `เวลา ${time}` : ''}
${sender ? `ผู้โอน: ${sender}` : ''}
${receiver ? `ผู้รับ: ${receiver}` : ''}`,

            'บันทึกสลิป'

        );


    if (!confirmed) {
        return;
    }


    const tx = {

        id: Date.now(),

        date,

        time,

        amount,

        category,

        type: 'transfer',

        note,

        sender,

        receiver,

        receipt:
            currentScannedImageBase64

    };


    state.transactions.push(
        tx
    );


    save();


    addLog(
        'scan_receipt',
        {
            amount,
            date,
            time,
            category,
            sender,
            receiver
        }
    );


    await notifySuccess(
        'บันทึกสลิปเรียบร้อย',
        `฿${formatMoney(amount)}`
    );


    resetScanUI();

    renderAll();

}


// ============================================================
// 16. RESET SCANNER
// ============================================================

function resetScanUI() {

    currentScannedImageBase64 =
        null;


    const resultCard =
        document.getElementById(
            'scanResultCard'
        );

    if (resultCard) {
        resultCard.style.display =
            'none';
    }


    const previewBox =
        document.getElementById(
            'scanPreviewBox'
        );

    if (previewBox) {
        previewBox.style.display =
            'none';
    }


    const dropzone =
        document.getElementById(
            'scanDropzone'
        );

    if (dropzone) {
        dropzone.style.display =
            'flex';
    }


    const preview =
        document.getElementById(
            'scanPreviewImg'
        );

    if (preview) {
        preview.removeAttribute(
            'src'
        );
    }


    const progress =
        document.getElementById(
            'scanProgressTxt'
        );

    if (progress) {
        progress.textContent =
            '';
    }


    const fields = [
        'resAmount',
        'resDate',
        'resTime',
        'resSender',
        'resReceiver',
        'resNote'
    ];


    fields.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.value =
                    '';
            }

        }
    );


    const category =
        document.getElementById(
            'resCategory'
        );

    if (category) {
        category.value =
            'other';
    }

}


// ============================================================
// 17. IMAGE COMPRESSION
// ============================================================

function compressImage(
    file,
    maxWidth = 1600,
    quality = 0.9
) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                event => {

                    const image =
                        new Image();


                    image.onload =
                        () => {

                            let width =
                                image.width;

                            let height =
                                image.height;


                            if (
                                width >
                                maxWidth
                            ) {

                                const ratio =
                                    maxWidth /
                                    width;

                                width =
                                    Math.round(
                                        width *
                                        ratio
                                    );

                                height =
                                    Math.round(
                                        height *
                                        ratio
                                    );

                            }


                            const canvas =
                                document.createElement(
                                    'canvas'
                                );


                            canvas.width =
                                width;

                            canvas.height =
                                height;


                            const ctx =
                                canvas.getContext(
                                    '2d'
                                );


                            ctx.drawImage(
                                image,
                                0,
                                0,
                                width,
                                height
                            );


                            resolve(
                                canvas.toDataURL(
                                    'image/jpeg',
                                    quality
                                )
                            );

                        };


                    image.onerror =
                        reject;


                    image.src =
                        event.target.result;

                };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                file
            );

        }
    );

}


// ============================================================
// 18. KBank PERSON OCR IMAGE
// ============================================================

async function createKBankPersonOCRImage(
    base64
) {

    return new Promise(
        (resolve, reject) => {

            const img =
                new Image();


            img.onload =
                () => {

                    try {

                        const width =
                            img.width;

                        const height =
                            img.height;


                        /*
                         * K PLUS / MAKE มักวางข้อมูล
                         * ผู้โอนและผู้รับบริเวณกลางสลิป
                         *
                         * จึงตัดส่วนบน/ล่างที่มี
                         * QR, Reference, วันเวลา
                         * ออกก่อน OCR
                         */

                        const top =
                            Math.floor(
                                height *
                                0.18
                            );

                        const bottom =
                            Math.floor(
                                height *
                                0.82
                            );


                        const cropHeight =
                            Math.max(
                                1,
                                bottom - top
                            );


                        const canvas =
                            document.createElement(
                                'canvas'
                            );


                        canvas.width =
                            width;

                        canvas.height =
                            cropHeight;


                        const ctx =
                            canvas.getContext(
                                '2d'
                            );


                        ctx.drawImage(
                            img,
                            0,
                            top,
                            width,
                            cropHeight,
                            0,
                            0,
                            width,
                            cropHeight
                        );


                        const imageData =
                            ctx.getImageData(
                                0,
                                0,
                                width,
                                cropHeight
                            );


                        const data =
                            imageData.data;


                        /*
                         * เพิ่ม contrast เฉพาะส่วนชื่อ
                         */

                        const contrast =
                            1.6;

                        const intercept =
                            128 *
                            (1 - contrast);


                        for (
                            let i = 0;
                            i < data.length;
                            i += 4
                        ) {

                            const gray =
                                (
                                    data[i] *
                                    0.299
                                ) +
                                (
                                    data[i + 1] *
                                    0.587
                                ) +
                                (
                                    data[i + 2] *
                                    0.114
                                );


                            const value =
                                Math.max(
                                    0,
                                    Math.min(
                                        255,
                                        gray *
                                        contrast +
                                        intercept
                                    )
                                );


                            data[i] =
                                value;

                            data[i + 1] =
                                value;

                            data[i + 2] =
                                value;

                        }


                        ctx.putImageData(
                            imageData,
                            0,
                            0
                        );


                        resolve(
                            canvas.toDataURL(
                                'image/jpeg',
                                0.96
                            )
                        );


                    } catch (error) {

                        reject(
                            error
                        );

                    }

                };


            img.onerror =
                reject;


            img.src =
                base64;

        }
    );

}


// ============================================================
// 19. PERSON NAME VALIDATION
// ============================================================

function normalizePersonName(
    name
) {

    if (!name) {
        return '';
    }


    let value =
        String(name)
            .replace(
                /\s+/g,
                ' '
            )
            .trim();


    /*
     * ตัด label ที่ OCR เผลออ่านติดมาด้วย
     */

    value =
        value.replace(
            /^(ผู้โอน|ผู้ส่ง|ผู้ชำระ|ผู้จ่าย|จาก|sender)\s*[:：\-]?\s*/i,
            ''
        );


    value =
        value.replace(
            /^(ผู้รับ|ผู้รับเงิน|ผู้รับโอน|ถึง|receiver)\s*[:：\-]?\s*/i,
            ''
        );


    /*
     * ไม่รับชื่อที่เป็นเลขล้วน
     */

    if (
        /^[\d\s.,\-_/]+$/.test(
            value
        )
    ) {
        return '';
    }


    /*
     * ไม่รับข้อความที่ชัดเจนว่า
     * เป็นธนาคาร / reference / account
     */

    const invalidWords = [
        'kbank',
        'kasikorn',
        'กสิกรไทย',
        'ธนาคารกสิกรไทย',
        'promptpay',
        'พร้อมเพย์',
        'reference',
        'transaction',
        'หมายเลขรายการ',
        'เลขที่รายการ',
        'บัญชี',
        'account',
        'ref'
    ];


    const lower =
        value.toLowerCase();


    if (
        invalidWords.some(
            word =>
                lower.includes(
                    word
                )
        )
    ) {

        return '';

    }


    /*
     * ชื่อต้องมีตัวอักษรอย่างน้อย 2 ตัว
     */

    const letters =
        value.match(
            /[A-Za-zก-๙]/g
        );


    if (
        !letters ||
        letters.length < 2
    ) {
        return '';
    }


    /*
     * ไม่ให้ยาวเกินไป
     */

    if (
        value.length >
        100
    ) {

        value =
            value.slice(
                0,
                100
            ).trim();

    }


    return value;

}


// ============================================================
// 20. CHOOSE BETTER PERSON NAME
// ============================================================

function chooseBetterPersonName(
    current,
    candidate,
    role = ''
) {

    const a =
        normalizePersonName(
            current
        );

    const b =
        normalizePersonName(
            candidate
        );


    if (!a) return b;

    if (!b) return a;


    /*
     * ถ้าคนละชื่อ แต่มีคำหนึ่งเป็น
     * ส่วนหนึ่งของอีกคำหนึ่ง
     * ให้เลือกชื่อที่ยาวกว่า
     */

    const al =
        a.toLowerCase();

    const bl =
        b.toLowerCase();


    if (
        al.includes(bl) &&
        a.length >= b.length
    ) {
        return a;
    }


    if (
        bl.includes(al) &&
        b.length >= a.length
    ) {
        return b;
    }


    /*
     * คะแนนความน่าเชื่อถือ
     */

    function scoreName(
        name
    ) {

        let score = 0;


        /*
         * ชื่อไทยมักมี 2–5 คำ
         */

        const words =
            name.split(/\s+/)
                .filter(Boolean);


        if (
            words.length >= 2 &&
            words.length <= 6
        ) {

            score += 3;

        }


        /*
         * มีคำนำหน้าชื่อ
         */

        if (
            /^(นาย|นาง|นางสาว|เด็กชาย|เด็กหญิง|mr\.?|mrs\.?|ms\.?)/i
                .test(name)
        ) {

            score += 3;

        }


        /*
         * มีตัวอักษรไทย
         */

        if (
            /[ก-๙]/.test(name)
        ) {

            score += 2;

        }


        /*
         * ความยาวสมเหตุสมผล
         */

        if (
            name.length >= 4 &&
            name.length <= 60
        ) {

            score += 2;

        }


        /*
         * ห้ามมีเลขจำนวนมาก
         */

        const digitCount =
            (
                name.match(
                    /\d/g
                ) || []
            ).length;


        if (
            digitCount === 0
        ) {

            score += 2;

        } else {

            score -=
                digitCount * 2;

        }


        /*
         * ตัดชื่อที่ดูเหมือนเลขบัญชี
         */

        if (
            /\d{3,}/.test(
                name
            )
        ) {

            score -= 8;

        }


        return score;

    }


    const scoreA =
        scoreName(a);

    const scoreB =
        scoreName(b);


    if (
        scoreB >
        scoreA
    ) {

        return b;

    }


    if (
        scoreA >
        scoreB
    ) {

        return a;

    }


    /*
     * คะแนนเท่ากัน:
     * เลือกชื่อที่มีตัวอักษรมากกว่า
     */

    return b.length >
        a.length
        ? b
        : a;

}


// ============================================================
// 21. EXTRACT PERSON
// ============================================================

function extractPerson(
    text,
    labels
) {

    const normalized =
        normalizeOCRText(
            text
        );


    const lines =
        normalized
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    const candidates = [];


    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i];


        for (
            const label of labels
        ) {

            const escaped =
                label.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                );


            const regex =
                new RegExp(
                    `${escaped}\\s*[:：\\-]?\\s*(.+)$`,
                    'i'
                );


            const match =
                line.match(
                    regex
                );


            if (
                match &&
                match[1]
            ) {

                const name =
                    normalizePersonName(
                        match[1]
                    );


                if (name) {

                    candidates.push(
                        name
                    );

                }

            }


            /*
             * OCR บางครั้งแยก label กับชื่อ
             * เป็นคนละบรรทัด
             */

            if (
                line
                    .toLowerCase()
                    .includes(
                        label.toLowerCase()
                    )
            ) {

                const next =
                    lines[i + 1] ||
                    '';


                const name =
                    normalizePersonName(
                        next
                    );


                if (
                    name &&
                    !/\d{4,}/.test(
                        next
                    )
                ) {

                    candidates.push(
                        name
                    );

                }

            }

        }

    }


    if (!candidates.length) {
        return '';
    }


    return candidates.reduce(
        (
            best,
            candidate
        ) =>
            chooseBetterPersonName(
                best,
                candidate
            ),
        ''
    );

}


// ============================================================
// 22. KBank PERSON EXTRACTION
// ============================================================

function extractKBankPersons(
    text
) {

    const normalized =
        normalizeOCRText(
            text
        );


    const lines =
        normalized
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    let sender = '';

    let receiver = '';


    /*
     * วิธีที่ 1:
     * label ตรง ๆ
     */

    sender =
        extractPerson(
            normalized,
            [
                'ผู้โอน',
                'ผู้ส่ง',
                'ผู้ชำระ',
                'ผู้จ่าย',
                'จาก',
                'sender',
                'from'
            ]
        );


    receiver =
        extractPerson(
            normalized,
            [
                'ผู้รับ',
                'ผู้รับเงิน',
                'ผู้รับโอน',
                'ถึง',
                'receiver',
                'to'
            ]
        );


    /*
     * วิธีที่ 2:
     * KBank บางแบบไม่มี label ผู้โอน/ผู้รับ
     * แต่ชื่อจะอยู่ก่อน/หลังลูกศร
     */

    const arrowIndexes = [];


    lines.forEach(
        (
            line,
            index
        ) => {

            if (
                /[↓→➜➡]/.test(
                    line
                )
            ) {

                arrowIndexes.push(
                    index
                );

            }

        }
    );


    for (
        const index of arrowIndexes
    ) {

        const line =
            lines[index];


        const parts =
            line.split(
                /[↓→➜➡]/
            );


        if (
            parts.length >= 2
        ) {

            const left =
                normalizePersonName(
                    parts[0]
                );


            const right =
                normalizePersonName(
                    parts
                        .slice(1)
                        .join(' ')
                );


            if (
                left &&
                !sender
            ) {

                sender =
                    left;

            }


            if (
                right &&
                !receiver
            ) {

                receiver =
                    right;

            }

        }

    }


    /*
     * วิธีที่ 3:
     * ถ้า arrow แยกบรรทัด
     *
     * ชื่อ
     * ↓
     * ชื่อ
     */

    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        if (
            /^[↓→➜➡]$/.test(
                lines[i]
            )
        ) {

            const before =
                normalizePersonName(
                    lines[i - 1] ||
                    ''
                );


            const after =
                normalizePersonName(
                    lines[i + 1] ||
                    ''
                );


            if (
                before &&
                after
            ) {

                if (!sender) {
                    sender =
                        before;
                }

                if (!receiver) {
                    receiver =
                        after;
                }

            }

        }

    }


    return {

        sender:
            normalizePersonName(
                sender
            ),

        receiver:
            normalizePersonName(
                receiver
            )

    };

}


// ============================================================
// 23. BANK DETECTION
// ============================================================

function detectBank(
    text
) {

    const lower =
        String(
            text || ''
        ).toLowerCase();


    if (
        lower.includes(
            'kbank'
        ) ||
        lower.includes(
            'kasikorn'
        ) ||
        lower.includes(
            'กสิกร'
        ) ||
        lower.includes(
            'กสิกรไทย'
        ) ||
        lower.includes(
            'k plus'
        ) ||
        lower.includes(
            'k+'
        ) ||
        lower.includes(
            'make'
        )
    ) {

        return 'kbank';

    }


    return 'unknown';

}
function extractBestAmount(
    text,
    bank = 'unknown'
) {

    const source =
        normalizeOCRText(
            text
        );

    const candidates = [];

    function addCandidate(
        raw,
        score,
        sourceName
    ) {

        if (!raw) {
            return;
        }

        let cleaned =
            String(raw)
                .trim()
                .replace(/฿/g, '')
                .replace(/บาท/gi, '')
                .replace(/[\s,]/g, '');

        cleaned =
            cleaned.replace(
                /[^\d.]/g,
                ''
            );

        const dotCount =
            (cleaned.match(/\./g) || [])
                .length;

        if (dotCount > 1) {

            const parts =
                cleaned.split('.');

            const decimal =
                parts.pop();

            cleaned =
                parts.join('') +
                '.' +
                decimal;

        }

        const value =
            Number(
                cleaned
            );

        if (
            !Number.isFinite(value) ||
            value <= 0 ||
            value >= 5000000
        ) {
            return;
        }

        /*
         * เงินบนสลิปส่วนใหญ่มีทศนิยม 2 ตำแหน่ง
         * ถ้าเป็น integer ให้ลดคะแนนไว้ก่อน
         */
        if (
            Number.isInteger(value) &&
            !/[฿]|บาท|,\d{3}|\.\d{2}/.test(
                String(raw)
            )
        ) {
            score -= 18;
        }

        candidates.push({

            value,

            score,

            source:
                sourceName

        });

    }


    const lines =
        source
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    /*
     * ========================================================
     * KBank / K PLUS / MAKE
     * ========================================================
     *
     * ห้ามใช้ "จำนวนเงิน + 2 บรรทัดถัดไป" แบบเดิม
     * เพราะในสลิปจริงระหว่าง label กับยอดอาจมี
     * เลขบัญชี/ปี/ข้อมูลอื่น ทำให้เคยอ่าน 2569 แทน 8,000
     */
    if (bank === 'kbank') {

        const amountLabels = [
            'จำนวนเงิน',
            'จำนวน',
            'ยอดเงิน',
            'ยอดโอน',
            'amount',
            'total',
            'โอนเงินสำเร็จ'
        ];

        lines.forEach(
            (line, index) => {

                const lower =
                    line.toLowerCase();

                const hasAmountLabel =
                    amountLabels.some(
                        label =>
                            lower.includes(
                                label
                            )
                    );

                if (!hasAmountLabel) {
                    return;
                }

                /*
                 * 1) ตัวเลขในบรรทัดเดียวกับ label
                 */
                const sameLineMatches =
                    line.match(
                        /(?:฿\s*)?[\d][\d,\s]*(?:\.\d{1,2})?(?=\s*(?:บาท|baht|thb)?\b)/gi
                    ) || [];

                sameLineMatches.forEach(
                    raw =>
                        addCandidate(
                            raw,
                            250,
                            'kbank-label-same-line'
                        )
                );

                /*
                 * 2) บรรทัดถัดไปเท่านั้น
                 * แต่รับเฉพาะค่าที่มี decimal / comma / ฿ / บาท
                 * เพื่อไม่ให้ปี 2569 หรือเลขอ้างอิงหลุดมาเป็นยอด
                 */
                for (
                    let offset = 1;
                    offset <= 2;
                    offset++
                ) {

                    const next =
                        lines[index + offset] || '';

                    if (!next) {
                        continue;
                    }

                    /*
                     * ถ้าเจอคำที่เป็น field อื่นก่อน
                     * ไม่ควรข้ามไปหยิบเลขข้างล่าง
                     */
                    if (
                        /เลขที่|เลขอ้างอิง|reference|ref|transaction|บัญชี|account|ค่าธรรมเนียม|fee|พร้อมเพย์|promptpay|วันที่|เวลา|date|time/i
                            .test(next)
                    ) {
                        continue;
                    }

                    const moneyMatches =
                        next.match(
                            /(?:฿\s*)?[\d][\d,\s]*(?:\.\d{1,2})(?:\s*(?:บาท|baht|thb))?/gi
                        ) || [];

                    moneyMatches.forEach(
                        raw =>
                            addCandidate(
                                raw,
                                offset === 1
                                    ? 235
                                    : 215,
                                'kbank-label-next-line'
                            )
                    );

                    /*
                     * MAKE บางรูปแบบอาจไม่มี .00
                     * แต่มี comma เช่น 8,000
                     */
                    if (
                        !moneyMatches.length &&
                        /[฿,]|\bบาท\b|\bbaht\b|\bthb\b/i.test(
                            next
                        )
                    ) {

                        const integerMatches =
                            next.match(
                                /(?:฿\s*)?\d[\d,\s]*/g
                            ) || [];

                        integerMatches.forEach(
                            raw =>
                                addCandidate(
                                    raw,
                                    190,
                                    'kbank-label-integer'
                                )
                        );

                    }

                }

            }
        );

    }


    /*
     * ========================================================
     * Generic money extraction
     * ========================================================
     */

    const moneyRegex =
        /(?:฿\s*)?(\d{1,3}(?:[,\s]\d{3})*\.\d{2}|\d+\.\d{2})/g;


    for (
        const match of source.matchAll(
            moneyRegex
        )
    ) {

        const before =
            source.slice(
                Math.max(
                    0,
                    match.index - 70
                ),
                match.index
            ).toLowerCase();

        const after =
            source.slice(
                match.index,
                match.index + 100
            ).toLowerCase();

        let score = 30;

        if (
            /จำนวนเงิน|ยอดเงิน|ยอดโอน|amount|total|payment|ชำระ|บาท|baht|thb/
                .test(
                    before + after
                )
        ) {
            score += 80;
        }

        if (
            /ค่าธรรมเนียม|fee|service|commission/
                .test(
                    before + after
                )
        ) {
            score -= 100;
        }

        if (
            /เลขที่|เลขอ้างอิง|reference|ref|transaction|บัญชี|account|พร้อมเพย์|promptpay/
                .test(
                    before + after
                )
        ) {
            score -= 100;
        }

        /*
         * วัน/เดือน/ปี และเวลาไม่ใช่จำนวนเงิน
         */
        if (
            /วันที่|date|\b20\d{2}\b|\b25\d{2}\b|เวลา|time/
                .test(
                    before + after
                )
        ) {
            score -= 90;
        }

        score += 25;

        addCandidate(
            match[1],
            score,
            'generic-decimal'
        );

    }


    /*
     * Integer fallback:
     * ใช้เฉพาะเมื่อมีหลักฐานว่าเป็นเงินจริง
     */
    const integerRegex =
        /(?:฿\s*)?(\d{1,3}(?:[,\s]\d{3})+|\d{4,})/g;


    for (
        const match of source.matchAll(
            integerRegex
        )
    ) {

        const before =
            source.slice(
                Math.max(
                    0,
                    match.index - 70
                ),
                match.index
            ).toLowerCase();

        const after =
            source.slice(
                match.index,
                match.index + 70
            ).toLowerCase();

        let score = 5;

        if (
            /จำนวนเงิน|ยอดเงิน|ยอดโอน|amount|total|บาท|baht|thb|ชำระ|โอน/
                .test(
                    before + after
                )
        ) {
            score += 55;
        }

        if (
            /ค่าธรรมเนียม|fee|service|เลขที่|reference|ref|transaction|บัญชี|account|promptpay|พร้อมเพย์/
                .test(
                    before + after
                )
        ) {
            score -= 100;
        }

        if (
            /วันที่|date|เวลา|time|\b20\d{2}\b|\b25\d{2}\b/
                .test(
                    before + after
                )
        ) {
            score -= 100;
        }

        /*
         * สำหรับ KBank ไม่ยอมรับ integer ที่ไม่มี
         * เครื่องหมายเงิน/คำว่า บาท/ comma หากไม่มี label ใกล้ ๆ
         */
        if (
            bank === 'kbank' &&
            !/[฿,]|บาท|baht|thb/i.test(
                match[0] +
                before.slice(-30) +
                after.slice(0, 30)
            )
        ) {
            score -= 35;
        }

        addCandidate(
            match[1],
            score,
            'generic-integer'
        );

    }


    if (!candidates.length) {
        return null;
    }


    /*
     * รวมค่าซ้ำ แล้วเลือกคะแนนสูงสุด
     */
    const unique = [];

    candidates.forEach(
        candidate => {

            const existing =
                unique.find(
                    item =>
                        Math.abs(
                            item.value -
                            candidate.value
                        ) < 0.001
                );

            if (existing) {

                existing.score =
                    Math.max(
                        existing.score,
                        candidate.score
                    );

                existing.sources.push(
                    candidate.source
                );

            } else {

                unique.push({

                    value:
                        candidate.value,

                    score:
                        candidate.score,

                    sources: [
                        candidate.source
                    ]

                });

            }

        }
    );


    unique.sort(
        (a, b) =>
            b.score - a.score
    );


    /*
     * ถ้า KBank มี candidate จาก label โดยตรง
     * ให้ชนะ candidate generic เสมอ
     */
    if (bank === 'kbank') {

        const kbankCandidate =
            unique
                .filter(
                    candidate =>
                        candidate.sources.some(
                            source =>
                                source.startsWith(
                                    'kbank-label'
                                )
                        )
                )
                .sort(
                    (a, b) =>
                        b.score - a.score
                )[0];

        if (kbankCandidate) {
            return kbankCandidate.value;
        }

    }


    return unique[0]?.value || null;

}


// ============================================================
// 25. DATE
// ============================================================
// ============================================================
// 25. DATE
// ============================================================

function extractDate(
    text
) {

    const source =
        normalizeOCRText(
            text
        );

    /*
     * Thai month abbreviations/full names ที่พบบ่อยใน
     * K PLUS / MAKE by KBank เช่น
     * 21 ส.ค. 2569
     * 30 ก.ค. 2569
     */
    const thaiMonths = {

        'ม.ค.': '01',
        'มกราคม': '01',

        'ก.พ.': '02',
        'กุมภาพันธ์': '02',

        'มี.ค.': '03',
        'มีนาคม': '03',

        'เม.ย.': '04',
        'เมษายน': '04',

        'พ.ค.': '05',
        'พฤษภาคม': '05',

        'มิ.ย.': '06',
        'มิถุนายน': '06',

        'ก.ค.': '07',
        'กรกฎาคม': '07',

        'ส.ค.': '08',
        'สิงหาคม': '08',

        'ก.ย.': '09',
        'กันยายน': '09',

        'ต.ค.': '10',
        'ตุลาคม': '10',

        'พ.ย.': '11',
        'พฤศจิกายน': '11',

        'ธ.ค.': '12',
        'ธันวาคม': '12'

    };


    /*
     * 1) Thai month name
     */
    const thaiDateRegex =
        /(\d{1,2})\s+(ม\.ค\.|มกราคม|ก\.พ\.|กุมภาพันธ์|มี\.ค\.|มีนาคม|เม\.ย\.|เมษายน|พ\.ค\.|พฤษภาคม|มิ\.ย\.|มิถุนายน|ก\.ค\.|กรกฎาคม|ส\.ค\.|สิงหาคม|ก\.ย\.|กันยายน|ต\.ค\.|ตุลาคม|พ\.ย\.|พฤศจิกายน|ธ\.ค\.|ธันวาคม)\s+(\d{4})/i;


    const thaiMatch =
        source.match(
            thaiDateRegex
        );


    if (thaiMatch) {

        const day =
            String(
                thaiMatch[1]
            ).padStart(2, '0');


        const month =
            thaiMonths[
                thaiMatch[2]
            ];


        let year =
            parseInt(
                thaiMatch[3],
                10
            );


        if (
            year > 2500
        ) {

            year -= 543;

        }


        const date =
            `${year}-${month}-${day}`;


        const dateObject =
            new Date(date);


        if (
            !Number.isNaN(
                dateObject.getTime()
            )
        ) {

            return date;

        }

    }


    /*
     * 2) Numeric date
     */
    const patterns = [

        /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,

        /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})/

    ];


    for (
        const pattern of patterns
    ) {

        const match =
            source.match(
                pattern
            );


        if (!match) {
            continue;
        }


        let day =
            String(
                match[1]
            ).padStart(2, '0');


        let month =
            String(
                match[2]
            ).padStart(2, '0');


        let year =
            String(
                match[3]
            );


        if (
            year.length === 2
        ) {

            year =
                '20' + year;

        }


        if (
            parseInt(year, 10) >
            2500
        ) {

            year =
                String(
                    parseInt(
                        year,
                        10
                    ) - 543
                );

        }


        const date =
            `${year}-${month}-${day}`;


        const dateObject =
            new Date(date);


        if (
            !Number.isNaN(
                dateObject.getTime()
            )
        ) {

            return date;

        }

    }


    // ไม่เดาวันที่เป็นวันนี้ เพราะ OCR บางรอบอาจเป็นภาพ crop ที่ไม่มีวันที่
    return '';

}


// ============================================================
// 26. TIME
// ============================================================

function extractTime(
    text
) {

    const match =
        text.match(
            /\b([01]?\d|2[0-3])[:.][0-5]\d(?:[:.][0-5]\d)?\b/
        );


    if (!match) {
        return '';
    }


    const raw =
        match[0].replace(
            '.',
            ':'
        );


    const parts =
        raw.split(':');


    return (

        String(parts[0])
            .padStart(2, '0')

        +

        ':'

        +

        String(parts[1])
            .padStart(2, '0')

    );

}


// ============================================================
// 27. KBANK PERSON EXTRACTION
// ============================================================

function cleanOCRPersonName(
    value
) {

    if (!value) {
        return '';
    }


    let result =
        String(value)
            .replace(
                /[|{}[\]<>]/g,
                ' '
            )
            .replace(
                /\s+/g,
                ' '
            )
            .trim();


    /*
     * ตัดข้อมูลที่ไม่ใช่ชื่อออก
     */
    result =
        result.replace(
            /\b(?:promptpay|พร้อมเพย์|เลขที่รายการ|เลขที่อ้างอิง|reference|transaction|account|บัญชี)\b.*$/i,
            ''
        ).trim();


    /*
     * ไม่รับบรรทัดที่เป็นเลขล้วน/เบอร์โทร/บัญชี
     */
    const compact =
        result.replace(
            /[\s\-xX]/g,
            ''
        );


    if (
        !result ||
        compact.length < 2 ||
        /^\d+$/.test(compact) ||
        /^\d{5,}$/.test(compact)
    ) {

        return '';

    }


    /*
     * ชื่อบุคคลไม่ควรมีจำนวนเงิน/วันที่
     */
    if (
        /\b\d[\d,]*\.\d{2}\b/.test(
            result
        ) ||
        /\b(?:20|25)\d{2}\b/.test(
            result
        )
    ) {

        return '';

    }


    return result;

}


function isLikelyKBankAccountLine(
    line
) {

    const value =
        String(
            line || ''
        ).trim();


    if (!value) {
        return false;
    }


    const compact =
        value.replace(
            /[\s\-xX]/g,
            ''
        );


    return (

        /^\d{6,}$/.test(
            compact
        )

        ||

        /^x{2,}\d{2,}$/i.test(
            compact
        )

        ||

        /^\d{2,4}[-\s]x{2,}\d{2,}$/i.test(
            value
        )

        ||

        /*
         * K PLUS / MAKE มัก mask บัญชีเป็น
         * xxx-x-x0874-x หรือ xxx-x-x8348-x
         */
        /^(?:x{2,}|\d{1,4})[-\s]?(?:x{1,}|\d{1,4})[-\s]?(?:x{1,}|\d{1,6})[-\s]?(?:x{1,}|\d{1,4})$/i.test(
            value
        )

    );

}


function isLikelyPersonLine(
    line
) {

    const value =
        cleanOCRPersonName(
            line
        );


    if (!value) {
        return false;
    }


    if (
        isLikelyKBankAccountLine(
            value
        )
    ) {

        return false;

    }


    if (
        /^(โอนเงินสำเร็จ|สำเร็จ|จำนวนเงิน|จำนวน|ค่าธรรมเนียม|เลขที่รายการ|เลขที่อ้างอิง|promptpay|พร้อมเพย์|scan|ตรวจสอบ|วันที่|เวลา|amount|total)$/i
            .test(value)
    ) {

        return false;

    }


    /*
     * ห้ามเอาชื่อธนาคาร / ชื่อระบบมาเป็นชื่อบุคคล
     */
    if (
        /ธนาคาร|กสิกรไทย|kasikorn|kbank|make\s*by|promptpay|พร้อมเพย์/i
            .test(value)
    ) {

        return false;

    }


    if (
        /^(?:฿\s*)?[\d,\s.]+(?:บาท|baht|thb)?$/i
            .test(value)
    ) {

        return false;

    }


    /*
     * ชื่อควรมีตัวอักษรไทยหรืออังกฤษ
     */
    if (
        !/[ก-๙A-Za-z]/.test(
            value
        )
    ) {

        return false;

    }


    return (
        value.length >= 2 &&
        value.length <= 80
    );

}


function extractKBankPeople(
    text
) {

    const lines =
        normalizeOCRText(text)
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    let sender = '';

    let receiver = '';


    /*
     * K PLUS:
     *   ชื่อผู้โอน
     *   ธนาคาร
     *   xxx...
     *   ↓
     *   ชื่อผู้รับ
     *
     * MAKE:
     *   [logo] ชื่อผู้โอน
     *   xxx...
     *   ↓
     *   [logo] ชื่อผู้รับ
     *   xxx...
     *
     * ดังนั้นใช้ลูกศรเป็นตัวแบ่ง sender/receiver
     */

    const arrowIndexes = [];


    lines.forEach(
        (
            line,
            index
        ) => {

            if (
                /^(?:↓|▼|v|V|->|→|➜|➝)$/.test(
                    line
                ) ||
                /[↓→➜➝]/.test(
                    line
                )
            ) {

                arrowIndexes.push(
                    index
                );

            }

        }
    );


    /*
     * 1) พยายามหา "ชื่อที่อยู่ติดกับลูกศร"
     */
    if (
        arrowIndexes.length
    ) {

        const arrowIndex =
            arrowIndexes[0];


        /*
         * receiver มักอยู่หลังลูกศร 1-3 บรรทัด
         */
        for (
            let offset = 1;
            offset <= 3;
            offset++
        ) {

            const candidate =
                lines[
                    arrowIndex +
                    offset
                ];


            if (
                isLikelyPersonLine(
                    candidate
                )
            ) {

                receiver =
                    candidate;

                break;

            }

        }


        /*
         * sender มักอยู่ก่อนลูกศร
         * เลือกชื่อที่ใกล้ที่สุด แต่ข้ามธนาคาร/บัญชี
         */
        for (
            let i =
                arrowIndex - 1;

            i >= Math.max(
                0,
                arrowIndex - 5
            );

            i--
        ) {

            const candidate =
                lines[i];


            if (
                isLikelyPersonLine(
                    candidate
                )
            ) {

                sender =
                    candidate;

                break;

            }

        }

    }


    /*
     * 2) Fallback สำหรับ MAKE ที่ OCR อาจไม่อ่านลูกศร
     * หา "ชื่อ + บัญชี" เป็นคู่
     */
    if (
        !sender ||
        !receiver
    ) {

        const personCandidates = [];


        for (
            let i = 0;
            i < lines.length;
            i++
        ) {

            const line =
                lines[i];


            if (
                !isLikelyPersonLine(
                    line
                )
            ) {

                continue;

            }


            const next =
                lines[i + 1] || '';


            const previous =
                lines[i - 1] || '';


            /*
             * ถ้าถัดไปเป็นเลขบัญชี/เบอร์
             * มีโอกาสสูงว่า line นี้คือชื่อ
             */
            const hasAccountAfter =
                isLikelyKBankAccountLine(
                    next
                );


            const hasBankAfter =
                /กสิกร|kasikorn|kbank|make|promptpay|พร้อมเพย์/i
                    .test(
                        next
                    );


            const hasArrowBefore =
                /[↓→➜➝]/.test(
                    previous
                );


            let score = 0;


            if (
                hasAccountAfter
            ) {

                score += 80;

            }


            if (
                hasBankAfter
            ) {

                score += 30;

            }


            if (
                hasArrowBefore
            ) {

                score += 50;

            }


            /*
             * ชื่อที่อยู่ใกล้ส่วนหัว "โอนเงินสำเร็จ"
             * มักเป็น sender
             */
            if (
                i <= 8
            ) {

                score += 10;

            }


            personCandidates.push({

                name:
                    cleanOCRPersonName(
                        line
                    ),

                index: i,

                score

            });

        }


        personCandidates.sort(
            (a, b) =>
                b.score - a.score ||
                a.index - b.index
        );


        if (!sender) {

            sender =
                personCandidates
                    .find(
                        candidate =>
                            candidate.index <
                            (
                                arrowIndexes[0] ??
                                lines.length
                            )
                    )
                    ?.name || '';

        }


        if (!receiver) {

            receiver =
                personCandidates
                    .find(
                        candidate =>
                            candidate.name !==
                            sender &&
                            (
                                candidate.index >
                                (
                                    arrowIndexes[0] ??
                                    -1
                                )
                            )
                    )
                    ?.name || '';

        }

    }


    /*
     * 3) Fallback แบบ label ถ้า OCR อ่าน "ผู้โอน/ผู้รับ"
     */
    if (!sender) {

        sender =
            extractPerson(
                text,
                [
                    'ผู้โอน',
                    'จาก',
                    'sender',
                    'from'
                ]
            );

    }


    if (!receiver) {

        receiver =
            extractPerson(
                text,
                [
                    'ผู้รับ',
                    'ถึง',
                    'receiver',
                    'to'
                ]
            );

    }


    return {

        sender:
            cleanOCRPersonName(
                sender
            ),

        receiver:
            cleanOCRPersonName(
                receiver
            )

    };

}


// ============================================================
// 28. GENERIC PERSON EXTRACTION
// ============================================================

function extractPerson(
    text,
    labels
) {

    const lines =
        text
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i];


        for (
            const label of labels
        ) {

            const regex =
                new RegExp(
                    `${label}\\s*[:：]?\\s*(.+)`,
                    'i'
                );


            const match =
                line.match(
                    regex
                );


            if (
                match &&
                match[1]
            ) {

                const value =
                    cleanOCRPersonName(
                        match[1]
                    );


                if (
                    isLikelyPersonLine(
                        value
                    )
                ) {

                    return value;

                }

            }


            if (
                line.toLowerCase()
                    .includes(
                        label.toLowerCase()
                    )
            ) {

                const next =
                    lines[i + 1] || '';


                const value =
                    cleanOCRPersonName(
                        next
                    );


                if (
                    isLikelyPersonLine(
                        value
                    )
                ) {

                    return value;

                }

            }

        }

    }


    return '';

}


// ============================================================
// 29. CATEGORY DETECTION
// ============================================================

function detectCategory(
    text
) {

    /*
     * OCR ของสลิปมีเลข reference/account จำนวนมาก
     * จึงไม่ควรค้น keyword จาก raw text ทั้งก้อน
     * เช่น reference "....kfc..." อาจทำให้เข้าใจว่าเป็นร้าน KFC
     */

    const lines =
        normalizeOCRText(text)
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    const meaningfulLines =
        lines
            .filter(
                line =>
                    !/เลขที่รายการ|เลขที่อ้างอิง|reference|transaction|account|บัญชี|promptpay|พร้อมเพย์|xxx[-\s]|^\d{5,}$/i
                        .test(line)
            )
            .join(' ');


    const lower =
        meaningfulLines.toLowerCase();


    if (
        [
            'เซเว่น',
            '7-eleven',
            'อาหาร',
            'food',
            'grab',
            'lineman',
            'ก๋วยเตี๋ยว',
            'ร้านอาหาร',
            'cafe',
            'coffee',
            'restaurant',
            'mcdonald'
        ].some(
            keyword =>
                lower.includes(
                    keyword
                )
        ) ||
        /\bkfc\b/i.test(lower)
    ) {

        return {

            category:
                'food',

            note:
                'ค่าอาหาร/เครื่องดื่ม'

        };

    }


    if (
        [
            'ptt',
            'mrt',
            'bts',
            'น้ำมัน',
            'ทางด่วน',
            'ปตท',
            'taxi',
            'grabcar',
            'bolt'
        ].some(
            keyword =>
                lower.includes(
                    keyword
                )
        )
    ) {

        return {

            category:
                'transport',

            note:
                'ค่าเดินทาง/น้ำมัน'

        };

    }
            if (
                isLikelyPersonLine(
                    candidate
                )
            ) {

                sender =
                    candidate;

                break;

            }

        }

    }


    /*
     * 2) Fallback สำหรับ MAKE ที่ OCR อาจไม่อ่านลูกศร
     * หา "ชื่อ + บัญชี" เป็นคู่
     */
    if (
        !sender ||
        !receiver
    ) {

        const personCandidates = [];


        for (
            let i = 0;
            i < lines.length;
            i++
        ) {

            const line =
                lines[i];


            if (
                !isLikelyPersonLine(
                    line
                )
            ) {

                continue;

            }


            const next =
                lines[i + 1] || '';


            const previous =
                lines[i - 1] || '';


            /*
             * ถ้าถัดไปเป็นเลขบัญชี/เบอร์
             * มีโอกาสสูงว่า line นี้คือชื่อ
             */
            const hasAccountAfter =
                isLikelyKBankAccountLine(
                    next
                );


            const hasBankAfter =
                /กสิกร|kasikorn|kbank|make|promptpay|พร้อมเพย์/i
                    .test(
                        next
                    );


            const hasArrowBefore =
                /[↓→➜➝]/.test(
                    previous
                );


            let score = 0;


            if (
                hasAccountAfter
            ) {

                score += 80;

            }


            if (
                hasBankAfter
            ) {

                score += 30;

            }


            if (
                hasArrowBefore
            ) {

                score += 50;

            }


            /*
             * ชื่อที่อยู่ใกล้ส่วนหัว "โอนเงินสำเร็จ"
             * มักเป็น sender
             */
            if (
                i <= 8
            ) {

                score += 10;

            }


            personCandidates.push({

                name:
                    cleanOCRPersonName(
                        line
                    ),

                index: i,

                score

            });

        }


        personCandidates.sort(
            (a, b) =>
                b.score - a.score ||
                a.index - b.index
        );


        if (!sender) {

            sender =
                personCandidates
                    .find(
                        candidate =>
                            candidate.index <
                            (
                                arrowIndexes[0] ??
                                lines.length
                            )
                    )
                    ?.name || '';

        }


        if (!receiver) {

            receiver =
                personCandidates
                    .find(
                        candidate =>
                            candidate.name !==
                            sender &&
                            (
                                candidate.index >
                                (
                                    arrowIndexes[0] ??
                                    -1
                                )
                            )
                    )
                    ?.name || '';

        }

    }


    /*
     * 3) Fallback แบบ label ถ้า OCR อ่าน "ผู้โอน/ผู้รับ"
     */
    if (!sender) {

        sender =
            extractPerson(
                text,
                [
                    'ผู้โอน',
                    'จาก',
                    'sender',
                    'from'
                ]
            );

    }


    if (!receiver) {

        receiver =
            extractPerson(
                text,
                [
                    'ผู้รับ',
                    'ถึง',
                    'receiver',
                    'to'
                ]
            );

    }


    return {

        sender:
            cleanOCRPersonName(
                sender
            ),

        receiver:
            cleanOCRPersonName(
                receiver
            )

    };

}


// ============================================================
// 28. GENERIC PERSON EXTRACTION
// ============================================================

function extractPerson(
    text,
    labels
) {

    const lines =
        text
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    for (
        let i = 0;
        i < lines.length;
        i++
    ) {

        const line =
            lines[i];


        for (
            const label of labels
        ) {

            const regex =
                new RegExp(
                    `${label}\\s*[:：]?\\s*(.+)`,
                    'i'
                );


            const match =
                line.match(
                    regex
                );


            if (
                match &&
                match[1]
            ) {

                const value =
                    cleanOCRPersonName(
                        match[1]
                    );


                if (
                    isLikelyPersonLine(
                        value
                    )
                ) {

                    return value;

                }

            }


            if (
                line.toLowerCase()
                    .includes(
                        label.toLowerCase()
                    )
            ) {

                const next =
                    lines[i + 1] || '';


                const value =
                    cleanOCRPersonName(
                        next
                    );


                if (
                    isLikelyPersonLine(
                        value
                    )
                ) {

                    return value;

                }

            }

        }

    }


    return '';

}


// ============================================================
// 29. CATEGORY DETECTION
// ============================================================

function detectCategory(
    text
) {

    /*
     * OCR ของสลิปมีเลข reference/account จำนวนมาก
     * จึงไม่ควรค้น keyword จาก raw text ทั้งก้อน
     * เช่น reference "....kfc..." อาจทำให้เข้าใจว่าเป็นร้าน KFC
     */
    const lines =
        normalizeOCRText(text)
            .split(/\r?\n/)
            .map(
                line =>
                    line.trim()
            )
            .filter(Boolean);


    const meaningfulLines =
        lines
            .filter(
                line =>
                    !/เลขที่รายการ|เลขที่อ้างอิง|reference|transaction|account|บัญชี|promptpay|พร้อมเพย์|xxx[-\s]|^\d{5,}$/i
                        .test(line)
            )
            .join(' ');


    const lower =
        meaningfulLines.toLowerCase();


    if (
        [
            'เซเว่น',
            '7-eleven',
            'อาหาร',
            'food',
            'grab',
            'lineman',
            'ก๋วยเตี๋ยว',
            'ร้านอาหาร',
            'cafe',
            'coffee',
            'restaurant',
            'mcdonald'
        ].some(
            keyword =>
                lower.includes(
                    keyword
                )
        ) ||
        /\bkfc\b/i.test(lower)
    ) {

        return {

            category:
                'food',

            note:
                'ค่าอาหาร/เครื่องดื่ม'

        };

    }


    if (
        [
            'ptt',
            'mrt',
            'bts',
            'น้ำมัน',
            'ทางด่วน',
            'ปตท',
            'taxi',
            'grabcar',
            'bolt'
        ].some(
            keyword =>
                lower.includes(
                    keyword
                )
        )
    ) {

        return {

            category:
                'transport',

            note:
                'ค่าเดินทาง/น้ำมัน'

        };

    }


    if (
        [
            'pea',
            'mea',
            'ไฟฟ้า',
            'ประปา',
            'ais',
            'true',
            'dtac',
            'ค่าไฟ',
            'ค่าน้ำ',
            'internet',
            'โทรศัพท์'
        ].some(
            keyword =>
                lower.includes(
                    keyword
                )
        )
    ) {

        return {

            category:
                'bills',

            note:
                'ชำระบิลค่าน้ำ/ค่าไฟ/เน็ต'

        };

    }


    if (
        [
            'shopee',
            'lazada',
            'tiktok',
            'mall',
            'central',
            'shopping'
        ].some(
            keyword =>
                lower.includes(
                    keyword
                )
        )
    ) {

        return {

            category:
                'shopping',

            note:
                'ชอปปิงออนไลน์'

        };

    }


    return {

        category:
            'other',

        note:
            'โอนเงิน'

    };

}


// ============================================================
// 30. RENDER ALL
// ============================================================

function renderAll() {

    renderMonthLabels();

    renderDashboard();

    renderTransactions();

    renderAnalysis();

    renderLogs();

    renderIncomeExpenseChart();

}


// ============================================================
// 29. MONTH
// ============================================================

function shiftMonth(
    delta
) {

    const [
        year,
        month
    ] =
        state.currentMonth
            .split('-')
            .map(Number);


    const date =
        new Date(
            year,
            month - 1 + delta,
            1
        );


    state.currentMonth =
        `${date.getFullYear()}-${String(
            date.getMonth() + 1
        ).padStart(2, '0')}`;


    save();

    renderAll();

}


// ============================================================
// 30. MONTH LABELS
// ============================================================

function renderMonthLabels() {

    const label =
        document.getElementById(
            'currentMonthLabel'
        );


    if (!label) {
        return;
    }


    const [
        year,
        month
    ] =
        state.currentMonth
            .split('-')
            .map(Number);


    const date =
        new Date(
            year,
            month - 1,
            1
        );


    const thaiMonths = [
        'มกราคม',
        'กุมภาพันธ์',
        'มีนาคม',
        'เมษายน',
        'พฤษภาคม',
        'มิถุนายน',
        'กรกฎาคม',
        'สิงหาคม',
        'กันยายน',
        'ตุลาคม',
        'พฤศจิกายน',
        'ธันวาคม'
    ];


    label.textContent =
        `${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;

}


// ============================================================
// 31. DASHBOARD
// ============================================================

function renderDashboard() {

    const income =
        Number(
            state.income[
                state.currentMonth
            ] || 0
        );


    const monthTransactions =
        state.transactions
            .filter(
                tx =>
                    String(
                        tx.date || ''
                    ).startsWith(
                        state.currentMonth
                    )
            );


    const totalExpense =
        monthTransactions.reduce(
            (
                sum,
                tx
            ) =>
                sum +
                Number(
                    tx.amount || 0
                ),
            0
        );


    const remaining =
        income -
        totalExpense;


    const incomeEl =
        document.getElementById(
            'totalIncome'
        );


    const expenseEl =
        document.getElementById(
            'totalExpense'
        );


    const remainingEl =
        document.getElementById(
            'remainingBalance'
        );


    if (incomeEl) {

        incomeEl.textContent =
            `฿${formatMoney(income)}`;

    }


    if (expenseEl) {

        expenseEl.textContent =
            `฿${formatMoney(totalExpense)}`;

    }


    if (remainingEl) {

        remainingEl.textContent =
            `฿${formatMoney(remaining)}`;

    }


    /*
     * จำนวนรายการ
     */
    const countEl =
        document.getElementById(
            'transactionCount'
        );


    if (countEl) {

        countEl.textContent =
            String(
                monthTransactions.length
            );

    }

}


// ============================================================
// 32. TRANSACTIONS
// ============================================================

function renderTransactions() {

    const container =
        document.getElementById(
            'transactionList'
        );


    if (!container) {
        return;
    }


    const monthTransactions =
        state.transactions
            .filter(
                tx =>
                    String(
                        tx.date || ''
                    ).startsWith(
                        state.currentMonth
                    )
            )
            .sort(
                (a, b) =>
                    (
                        String(
                            b.date || ''
                        ) +
                        String(
                            b.time || ''
                        )
                    ).localeCompare(
                        String(
                            a.date || ''
                        ) +
                        String(
                            a.time || ''
                        )
                    )
            );


    if (!monthTransactions.length) {

        container.innerHTML = `
            <div class="text-center text-muted py-5">
                ยังไม่มีรายการในเดือนนี้
            </div>
        `;

        return;

    }


    container.innerHTML =
        monthTransactions
            .map(
                tx => {

                    const category =
                        CATEGORIES[
                            tx.category
                        ] ||
                        CATEGORIES.other;


                    const sender =
                        tx.sender ||
                        '';


                    const receiver =
                        tx.receiver ||
                        '';


                    const people =
                        sender ||
                        receiver
                            ? `
                                <div class="small text-muted mt-1">
                                    ${sender
                                        ? `ผู้โอน: ${escapeHtml(sender)}`
                                        : ''}
                                    ${sender && receiver
                                        ? ' → '
                                        : ''}
                                    ${receiver
                                        ? `ผู้รับ: ${escapeHtml(receiver)}`
                                        : ''}
                                </div>
                            `
                            : '';


                    return `
                        <div class="transaction-item"
                             data-id="${tx.id}">

                            <div class="transaction-icon">
                                ${category.icon}
                            </div>

                            <div class="transaction-info">

                                <div class="transaction-title">
                                    ${escapeHtml(
                                        tx.note ||
                                        category.label
                                    )}
                                </div>

                                <div class="transaction-meta">

                                    ${formatThaiDate(
                                        tx.date
                                    )}

                                    ${tx.time
                                        ? ` • ${escapeHtml(tx.time)}`
                                        : ''}

                                    • ${tx.type === 'transfer'
                                        ? 'โอน'
                                        : 'เงินสด'}

                                </div>

                                ${people}

                                ${
                                    tx.receipt
                                        ? `
                                            <div class="small text-success mt-1">
                                                📎 มีสลิป
                                            </div>
                                          `
                                        : ''
                                }

                            </div>

                            <div class="transaction-amount">
                                -฿${formatMoney(
                                    tx.amount
                                )}
                            </div>

                        </div>
                    `;

                }
            )
            .join('');

}


// ============================================================
// 33. ANALYSIS
// ============================================================

function renderAnalysis() {

    const monthTransactions =
        state.transactions
            .filter(
                tx =>
                    String(
                        tx.date || ''
                    ).startsWith(
                        state.currentMonth
                    )
            );


    const totals = {};


    monthTransactions.forEach(
        tx => {

            const category =
                tx.category ||
                'other';


            totals[category] =
                (
                    totals[category] ||
                    0
                ) +
                Number(
                    tx.amount || 0
                );

        }
    );


    const total =
        Object.values(
            totals
        ).reduce(
            (
                sum,
                value
            ) =>
                sum + value,
            0
        );


    const container =
        document.getElementById(
            'analysisList'
        );


    if (!container) {
        return;
    }


    if (!total) {

        container.innerHTML = `
            <div class="text-muted text-center py-4">
                ยังไม่มีข้อมูลวิเคราะห์
            </div>
        `;

        return;

    }


    const entries =
        Object.entries(
            totals
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    b[1] - a[1]
            );


    container.innerHTML =
        entries
            .map(
                (
                    [
                        key,
                        value
                    ]
                ) => {

                    const category =
                        CATEGORIES[key] ||
                        CATEGORIES.other;


                    const percent =
                        total > 0
                            ? (
                                value /
                                total *
                                100
                            )
                            : 0;


                    return `
                        <div class="analysis-row">

                            <div class="analysis-name">
                                <span>
                                    ${category.icon}
                                </span>
                                ${escapeHtml(
                                    category.label
                                )}
                            </div>

                            <div class="analysis-bar-wrap">

                                <div
                                    class="analysis-bar"
                                    style="width:${percent.toFixed(1)}%"
                                ></div>

                            </div>

                            <div class="analysis-value">
                                ฿${formatMoney(value)}
                            </div>

                        </div>
                    `;

                }
            )
            .join('');

}


// ============================================================
// 34. INCOME / EXPENSE CHART
// ============================================================

function renderIncomeExpenseChart() {

    const canvas =
        document.getElementById(
            'incomeExpenseChart'
        );


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            '2d'
        );


    if (!ctx) {
        return;
    }


    const income =
        Number(
            state.income[
                state.currentMonth
            ] || 0
        );


    const expense =
        state.transactions
            .filter(
                tx =>
                    String(
                        tx.date || ''
                    ).startsWith(
                        state.currentMonth
                    )
            )
            .reduce(
                (
                    sum,
                    tx
                ) =>
                    sum +
                    Number(
                        tx.amount || 0
                    ),
                0
            );


    /*
     * ล้าง canvas ก่อนวาดใหม่
     */
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    const width =
        canvas.width;


    const height =
        canvas.height;


    const padding = 40;


    const maxValue =
        Math.max(
            income,
            expense,
            1
        );


    const chartHeight =
        height -
        padding * 2;


    const barWidth =
        Math.min(
            80,
            width / 4
        );


    const values = [
        {
            label: 'รายรับ',
            value: income
        },
        {
            label: 'รายจ่าย',
            value: expense
        }
    ];


    values.forEach(
        (
            item,
            index
        ) => {

            const x =
                width / 2 -
                barWidth -
                10 +
                index *
                (
                    barWidth +
                    20
                );


            const barHeight =
                (
                    item.value /
                    maxValue
                ) *
                chartHeight;


            const y =
                height -
                padding -
                barHeight;


            ctx.fillStyle =
                index === 0
                    ? '#16a34a'
                    : '#ef4444';


            ctx.fillRect(
                x,
                y,
                barWidth,
                barHeight
            );


            ctx.fillStyle =
                '#333';


            ctx.textAlign =
                'center';


            ctx.font =
                '14px sans-serif';


            ctx.fillText(
                item.label,
                x +
                barWidth / 2,
                height -
                12
            );


            ctx.fillText(
                `฿${formatMoney(
                    item.value
                )}`,
                x +
                barWidth / 2,
                Math.max(
                    18,
                    y - 8
                )
            );

        }
    );

}
            year,
            month - 1 + delta,
            1
        );


    const newYear =
        date.getFullYear();


    const newMonth =
        String(
            date.getMonth() + 1
        ).padStart(2, '0');


    state.currentMonth =
        `${newYear}-${newMonth}`;


    renderAll();

}


// ============================================================
// 30. MONTH LABEL
// ============================================================

function renderMonthLabels() {

    const [
        year,
        month
    ] =
        state.currentMonth
            .split('-')
            .map(Number);


    const date =
        new Date(
            year,
            month - 1,
            1
        );


    const text =
        date.toLocaleDateString(
            'th-TH',
            {
                month: 'long',
                year: 'numeric'
            }
        );


    [
        'monthLabel',
        'monthLabel2',
        'monthLabel3'
    ]
    .forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );

            if (element) {
                element.textContent =
                    text;
            }

        }
    );

}


// ============================================================
// 31. DASHBOARD
// ============================================================

function renderDashboard() {

    const income =
        Number(
            state.income[
                state.currentMonth
            ] || 0
        );


    const incomeInput =
        document.getElementById(
            'incomeInput'
        );


    if (incomeInput) {
        incomeInput.value =
            income || '';
    }


    const monthTx =
        state.transactions.filter(
            tx =>
                String(
                    tx.date || ''
                ).startsWith(
                    state.currentMonth
                )
        );


    const expense =
        monthTx.reduce(
            (sum, tx) =>
                sum +
                Number(
                    tx.amount || 0
                ),
            0
        );


    const remaining =
        income - expense;


    const expenseElement =
        document.getElementById(
            'totalExpenseVal'
        );


    const remainingElement =
        document.getElementById(
            'remainingVal'
        );


    if (expenseElement) {

        expenseElement.textContent =
            `฿${formatMoney(expense)}`;

    }


    if (remainingElement) {

        remainingElement.textContent =
            `฿${formatMoney(remaining)}`;

        remainingElement.style.color =
            remaining >= 0
                ? 'var(--good)'
                : 'var(--danger)';

    }


    renderDonut(
        monthTx,
        expense
    );

}


// ============================================================
// 32. DONUT
// ============================================================

function renderDonut(
    transactions,
    total
) {

    const donut =
        document.getElementById(
            'donut'
        );


    const legend =
        document.getElementById(
            'legend'
        );


    if (!donut || !legend) {
        return;
    }


    if (total <= 0) {

        donut.style.background =
            'conic-gradient(var(--border) 0deg 360deg)';

        legend.innerHTML =
            `
            <div style="color:var(--muted);">
                ไม่มีรายการรายจ่ายในเดือนนี้
            </div>
            `;

        return;

    }


    const totals = {};


    transactions.forEach(
        tx => {

            totals[tx.category] =
                (
                    totals[
                        tx.category
                    ] || 0
                ) +
                Number(
                    tx.amount || 0
                );

        }
    );


    let degree = 0;

    const stops = [];

    let html = '';


    CATEGORIES.forEach(
        category => {

            const amount =
                totals[
                    category.id
                ] || 0;


            if (amount <= 0) {
                return;
            }


            const percent =
                amount /
                total *
                100;


            const deg =
                amount /
                total *
                360;


            stops.push(
                `${category.color} ${degree}deg ${degree + deg}deg`
            );


            degree += deg;


            html += `

                <div class="legend-item">

                    <span>

                        <span
                            class="legend-dot"
                            style="
                                background:${category.color};
                            "
                        ></span>

                        ${category.icon}
                        ${category.label}

                    </span>

                    <span
                        style="font-weight:600;"
                    >
                        ฿${formatMoney(amount)}
                        (${percent.toFixed(0)}%)
                    </span>

                </div>

            `;

        }
    );


    donut.style.background =
        `conic-gradient(${stops.join(',')})`;


    legend.innerHTML =
        html;

}


// ============================================================
// 33. TRANSACTIONS
// ============================================================

function renderTransactions() {

    const list =
        document.getElementById(
            'txList'
        );


    if (!list) {
        return;
    }


    const transactions =
        state.transactions
            .filter(
                tx =>
                    String(
                        tx.date || ''
                    ).startsWith(
                        state.currentMonth
                    )
            )
            .sort(
                (a, b) =>
                    new Date(
                        b.date
                    ) -
                    new Date(
                        a.date
                    ) ||
                    Number(b.id) -
                    Number(a.id)
            );


    if (!transactions.length) {

        list.innerHTML = `

            <div
                class="card"
                style="
                    text-align:center;
                    color:var(--muted);
                    padding:30px;
                "
            >
                ไม่มีรายการในเดือนนี้
            </div>

        `;

        return;

    }


    const grouped = {};


    transactions.forEach(
        tx => {

            if (!grouped[tx.date]) {
                grouped[tx.date] = [];
            }

            grouped[tx.date].push(
                tx
            );

        }
    );


    let html = '';


    Object.entries(grouped)
        .forEach(
            ([date, items]) => {

                const formatted =
                    new Date(
                        date
                    ).toLocaleDateString(
                        'th-TH',
                        {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        }
                    );


                html += `

                    <div class="tx-group">

                        <div class="tx-date-title">
                            ${formatted}
                        </div>

                `;


                items.forEach(
                    tx => {

                        const category =
                            CATEGORIES.find(
                                c =>
                                    c.id ===
                                    tx.category
                            ) ||
                            CATEGORIES[
                                CATEGORIES.length - 1
                            ];


                        html += `

                            <div class="tx-card">

                                <div class="tx-icon">
                                    ${category.icon}
                                </div>


                                <div class="tx-info">

                                    <div class="tx-title">
                                        ${
                                            escapeHtml(
                                                tx.note ||
                                                category.label
                                            )
                                        }
                                    </div>


                                    <div class="tx-sub">

                                        ${
                                            tx.type === 'cash'
                                                ? '💵 เงินสด'
                                                : '💳 โอน/บัตร'
                                        }

                                        ${
                                            tx.receipt
                                                ? ' • 🧾 มีสลิป'
                                                : ''
                                        }

                                        ${
                                            tx.time
                                                ? ` • ${escapeHtml(tx.time)}`
                                                : ''
                                        }

                                    </div>

                                </div>


                                <div style="text-align:right;">

                                    <div class="tx-amount">
                                        -฿${formatMoney(tx.amount)}
                                    </div>

                                    <button
                                        onclick="deleteTx(${Number(tx.id)})"
                                        style="
                                            border:none;
                                            background:none;
                                            color:var(--danger);
                                            font-size:11px;
                                            cursor:pointer;
                                            padding:0;
                                        "
                                    >
                                        ลบ
                                    </button>

                                </div>

                            </div>

                        `;

                    }
                );


                html += `
                    </div>
                `;

            }
        );


    list.innerHTML =
        html;

}


// ============================================================
// 34. DELETE
// ============================================================

async function deleteTx(
    id
) {

    const transaction =
        state.transactions.find(
            tx =>
                Number(tx.id) ===
                Number(id)
        );


    if (!transaction) {
        return;
    }


    const confirmed =
        await confirmAction(

            'ยืนยันการลบรายการ?',

            `จำนวนเงิน ฿${formatMoney(transaction.amount)}
${transaction.note || ''}

การลบรายการไม่สามารถย้อนกลับได้`,

            'ลบรายการ'

        );


    if (!confirmed) {
        return;
    }


    state.transactions =
        state.transactions.filter(
            tx =>
                Number(tx.id) !==
                Number(id)
        );


    save();


    addLog(
        'delete_transaction',
        {
            id,
            amount:
                transaction.amount,
            note:
                transaction.note
        }
    );


    renderAll();


    await notifySuccess(
        'ลบรายการเรียบร้อย'
    );

}


// ============================================================
// 35. ANALYSIS
// ============================================================

function renderAnalysis() {

    const income =
        Number(
            state.income[
                state.currentMonth
            ] || 0
        );


    const transactions =
        state.transactions.filter(
            tx =>
                String(
                    tx.date || ''
                ).startsWith(
                    state.currentMonth
                )
        );


    const expense =
        transactions.reduce(
            (sum, tx) =>
                sum +
                Number(
                    tx.amount || 0
                ),
            0
        );


    const needs =
        transactions
            .filter(
                tx =>
                    [
                        'food',
                        'transport',
                        'bills'
                    ].includes(
                        tx.category
                    )
            )
            .reduce(
                (sum, tx) =>
                    sum +
                    Number(
                        tx.amount || 0
                    ),
                0
            );


    const wants =
        transactions
            .filter(
                tx =>
                    [
                        'shopping',
                        'entertainment',
                        'other'
                    ].includes(
                        tx.category
                    )
            )
            .reduce(
                (sum, tx) =>
                    sum +
                    Number(
                        tx.amount || 0
                    ),
                0
            );


    const savings =
        Math.max(
            0,
            income - expense
        );


    const bars =
        document.getElementById(
            'barRows'
        );


    if (bars) {

        bars.innerHTML = `

            ${renderBar(
                'ความจำเป็น (Needs) 50%',
                needs,
                income * 0.5
            )}

            ${renderBar(
                'ความต้องการ (Wants) 30%',
                wants,
                income * 0.3
            )}

            ${renderBar(
                'เงินออม/การลงทุน (Savings) 20%',
                savings,
                income * 0.2,
                true
            )}

        `;

    }


    const tips =
        document.getElementById(
            'tipsList'
        );


    if (!tips) {
        return;
    }


    const list = [];


    if (!income) {

        list.push(
            'กรุณากรอกรายรับเดือนนี้ในหน้าภาพรวม'
        );

    } else {

        if (
            needs >
            income * 0.5
        ) {

            list.push(
                'ค่าใช้จ่ายจำเป็นเกิน 50% ของรายได้'
            );

        }


        if (
            wants >
            income * 0.3
        ) {

            list.push(
                'ค่าใช้จ่ายด้านความต้องการเกิน 30%'
            );

        }


        if (
            savings >=
            income * 0.2
        ) {

            list.push(
                'ยอดเยี่ยม! ออมได้อย่างน้อย 20%'
            );

        } else {

            list.push(
                'พยายามเพิ่มเงินออมให้ถึง 20%'
            );

        }

    }


    tips.innerHTML =
        list
            .map(
                item =>
                    `<li>${escapeHtml(item)}</li>`
            )
            .join('');

}


// ============================================================
// 36. BAR
// ============================================================

function renderBar(
    label,
    actual,
    target,
    savings = false
) {

    const percent =
        target > 0
            ? Math.min(
                100,
                actual /
                target *
                100
            )
            : 0;


    const over =
        !savings &&
        actual > target;


    return `

        <div class="bar-row">

            <div class="bar-lbl">

                <span>
                    ${label}
                </span>

                <span
                    style="
                        font-weight:600;
                        ${
                            over
                                ? 'color:var(--danger);'
                                : ''
                        }
                    "
                >
                    ฿${formatMoney(actual)}
                    /
                    ฿${formatMoney(target)}
                </span>

            </div>


            <div class="bar-bg">

                <div
                    class="bar-fill"
                    style="
                        width:${percent}%;
                        background:${
                            over
                                ? 'var(--danger)'
                                : 'var(--accent)'
                        };
                    "
                ></div>

            </div>

        </div>

    `;

}


// ============================================================
// 37. LOGS
// ============================================================

function addLog(
    action,
    details = {}
) {

    if (!Array.isArray(state.logs)) {
        state.logs = [];
    }


    state.logs.push({

        timestamp:
            new Date().toISOString(),

        action,

        details

    });


    // จำกัดไม่ให้ LocalStorage โตเกินไป
    if (
        state.logs.length >
        1000
    ) {

        state.logs =
            state.logs.slice(-1000);

    }


    save();

}


function renderLogs() {

    const list =
        document.getElementById(
            'logList'
        );


    if (!list) {
        return;
    }


    if (!state.logs.length) {

        list.innerHTML = `

            <div
                class="card"
                style="
                    text-align:center;
                    color:var(--muted);
                "
            >
                ยังไม่มีประวัติการใช้งาน
            </div>

        `;

        return;

    }


    list.innerHTML =
        state.logs
            .slice(-15)
            .reverse()
            .map(
                log => `

                    <div
                        class="tx-card"
                        style="margin-bottom:6px;"
                    >

                        <div class="tx-info">

                            <div
                                class="tx-title"
                                style="font-size:13px;"
                            >
                                ${
                                    log.action ===
                                    'add_transaction'
                                        ? '➕ เพิ่มรายการ'
                                        : log.action ===
                                          'delete_transaction'
                                            ? '🗑️ ลบรายการ'
                                            : '⚙️ ' +
                                              escapeHtml(
                                                  log.action
                                              )
                                }
                            </div>

                            <div class="tx-sub">
                                ${
                                    new Date(
                                        log.timestamp
                                                      const center =
                    padding.left +
                    groupWidth *
                    i +
                    groupWidth / 2;


                const incomeHeight =
                    data.income[i] /
                    maxValue *
                    chartHeight;


                const expenseHeight =
                    data.expense[i] /
                    maxValue *
                    chartHeight;


                const incomeX =
                    center -
                    barWidth -
                    2;


                const expenseX =
                    center +
                    2;


                /*
                 * รายรับ
                 */
                ctx.fillStyle =
                    '#22C55E';


                ctx.fillRect(
                    incomeX,
                    padding.top +
                    chartHeight -
                    incomeHeight,
                    barWidth,
                    incomeHeight
                );


                /*
                 * รายจ่าย
                 */
                ctx.fillStyle =
                    '#EF4444';


                ctx.fillRect(
                    expenseX,
                    padding.top +
                    chartHeight -
                    expenseHeight,
                    barWidth,
                    expenseHeight
                );


                /*
                 * label ด้านล่าง
                 */
                ctx.fillStyle =
                    '#6B7280';


                ctx.textAlign =
                    'center';


                ctx.textBaseline =
                    'top';


                ctx.font =
                    '10px Sarabun, sans-serif';


                ctx.fillText(
                    data.labels[i],
                    center,
                    height -
                    padding.bottom +
                    8
                );

            }


            /*
             * Legend
             */
            const legendY =
                height - 10;


            ctx.font =
                '11px Sarabun, sans-serif';


            ctx.textBaseline =
                'middle';


            ctx.textAlign =
                'left';


            ctx.fillStyle =
                '#22C55E';


            ctx.fillRect(
                padding.left,
                legendY - 5,
                10,
                10
            );


            ctx.fillStyle =
                '#374151';


            ctx.fillText(
                'รายรับ',
                padding.left + 16,
                legendY
            );


            const secondLegendX =
                padding.left + 75;


            ctx.fillStyle =
                '#EF4444';


            ctx.fillRect(
                secondLegendX,
                legendY - 5,
                10,
                10
            );


            ctx.fillStyle =
                '#374151';


            ctx.fillText(
                'รายจ่าย',
                secondLegendX + 16,
                legendY
            );

}


// ============================================================
// 40. CHART SUMMARY
// ============================================================

function renderChartSummary(
    data
) {

    const income =
        data.income.reduce(
            (
                sum,
                value
            ) =>
                sum +
                Number(value || 0),
            0
        );


    const expense =
        data.expense.reduce(
            (
                sum,
                value
            ) =>
                sum +
                Number(value || 0),
            0
        );


    const balance =
        income -
        expense;


    const incomeEl =
        document.getElementById(
            'chartIncome'
        );


    const expenseEl =
        document.getElementById(
            'chartExpense'
        );


    const balanceEl =
        document.getElementById(
            'chartBalance'
        );


    if (incomeEl) {

        incomeEl.textContent =
            `฿${formatMoney(income)}`;

    }


    if (expenseEl) {

        expenseEl.textContent =
            `฿${formatMoney(expense)}`;

    }


    if (balanceEl) {

        balanceEl.textContent =
            `฿${formatMoney(balance)}`;

        balanceEl.style.color =
            balance >= 0
                ? 'var(--good)'
                : 'var(--danger)';

    }

}


// ============================================================
// 41. CSV EXPORT
// ============================================================

function exportCSV() {

    const transactions =
        state.transactions
            .slice()
            .sort(
                (a, b) =>
                    String(
                        a.date || ''
                    ).localeCompare(
                        String(
                            b.date || ''
                        )
                    )
            );


    if (!transactions.length) {

        notifyWarning(
            'ยังไม่มีรายการให้ส่งออก'
        );

        return;

    }


    const header = [
        'วันที่',
        'เวลา',
        'จำนวนเงิน',
        'หมวดหมู่',
        'รายละเอียด',
        'ประเภท',
        'ผู้โอน',
        'ผู้รับ',
        'มีสลิป'
    ];


    const rows =
        transactions.map(
            tx => {

                const category =
                    CATEGORIES.find(
                        c =>
                            c.id ===
                            tx.category
                    );


                return [

                    tx.date || '',

                    tx.time || '',

                    Number(
                        tx.amount || 0
                    ).toFixed(2),

                    category
                        ? category.label
                        : 'อื่นๆ',

                    tx.note || '',

                    tx.type === 'cash'
                        ? 'เงินสด'
                        : 'โอน/บัตร',

                    tx.sender || '',

                    tx.receiver || '',

                    tx.receipt
                        ? 'มี'
                        : 'ไม่มี'

                ];

            }
        );


    const csv =
        [
            header,
            ...rows
        ]
            .map(
                row =>
                    row
                        .map(
                            value =>
                                `"${String(
                                    value ?? ''
                                )
                                    .replace(
                                        /"/g,
                                        '""'
                                    )}"`
                        )
                        .join(',')
            )
            .join('\r\n');


    const blob =
        new Blob(
            [
                '\uFEFF' +
                csv
            ],
            {
                type:
                    'text/csv;charset=utf-8;'
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const a =
        document.createElement(
            'a'
        );


    a.href = url;


    a.download =
        `finance-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;


    document.body.appendChild(
        a
    );


    a.click();


    a.remove();


    URL.revokeObjectURL(
        url
    );


    addLog(
        'export_csv',
        {
            count:
                transactions.length
        }
    );


    notifySuccess(
        'ส่งออก CSV เรียบร้อย'
    );

}


// ============================================================
// 42. LOG CSV EXPORT
// ============================================================

function exportLogsCSV() {

    if (
        !state.logs ||
        !state.logs.length
    ) {

        notifyWarning(
            'ยังไม่มีประวัติให้ส่งออก'
        );

        return;

    }


    const header = [
        'Timestamp',
        'Action',
        'Details'
    ];


    const rows =
        state.logs.map(
            log => [

                log.timestamp || '',

                log.action || '',

                JSON.stringify(
                    log.details || {}
                )

            ]
        );


    const csv =
        [
            header,
            ...rows
        ]
            .map(
                row =>
                    row
                        .map(
                            value =>
                                `"${String(
                                    value ?? ''
                                )
                                    .replace(
                                        /"/g,
                                        '""'
                                    )}"`
                        )
                        .join(',')
            )
            .join('\r\n');


    const blob =
        new Blob(
            [
                '\uFEFF' +
                csv
            ],
            {
                type:
                    'text/csv;charset=utf-8;'
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const a =
        document.createElement(
            'a'
        );


    a.href = url;


    a.download =
        `finance-logs-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;


    document.body.appendChild(
        a
    );


    a.click();


    a.remove();


    URL.revokeObjectURL(
        url
    );


    notifySuccess(
        'ส่งออก Logs เรียบร้อย'
    );

}


// ============================================================
// 43. TAX CALCULATOR
// ============================================================

function openTaxCalculator() {

    const totalIncome =
        Object.values(
            state.income
        ).reduce(
            (
                sum,
                value
            ) =>
                sum +
                Number(
                    value || 0
                ),
            0
        );


    const totalExpense =
        state.transactions.reduce(
            (
                sum,
                tx
            ) =>
                sum +
                Number(
                    tx.amount || 0
                ),
            0
        );


    const taxableBase =
        Math.max(
            0,
            totalIncome -
            totalExpense
        );


    /*
     * คำนวณแบบประมาณการอย่างง่าย
     */
    const deduction =
        100000;


    const netIncome =
        Math.max(
            0,
            taxableBase -
            deduction
        );


    let tax = 0;


    if (
        netIncome <=
        150000
    ) {

        tax = 0;

    } else if (
        netIncome <=
        300000
    ) {

        tax =
            (
                netIncome -
                150000
            ) *
            0.05;

    } else if (
        netIncome <=
        500000
    ) {

        tax =
            7500 +
            (
                netIncome -
                300000
            ) *
            0.10;

    } else if (
        netIncome <=
        750000
    ) {

        tax =
            27500 +
            (
                netIncome -
                500000
            ) *
            0.15;

    } else if (
        netIncome <=
        1000000
    ) {

        tax =
            65000 +
            (
                netIncome -
                750000
            ) *
            0.20;

    } else {

        tax =
            115000 +
            (
                netIncome -
                1000000
            ) *
            0.25;

    }


    Swal.fire({

        title:
            'ประมาณการภาษี',

        html: `

            <div
                style="
                    text-align:left;
                    line-height:1.8;
                "
            >

                <div>
                    รายรับรวม:
                    <b>
                        ฿${formatMoney(
                            totalIncome
                        )}
                    </b>
                </div>

                <div>
                    รายจ่ายรวม:
                    <b>
                        ฿${formatMoney(
                            totalExpense
                        )}
                    </b>
                </div>

                <div>
                    ฐานหลังหักรายจ่าย:
                    <b>
                        ฿${formatMoney(
                            taxableBase
                        )}
                    </b>
                </div>

                <div>
                    ค่าลดหย่อนประมาณการ:
                    <b>
                        ฿${formatMoney(
                            deduction
                        )}
                    </b>
                </div>

                <hr>

                <div>
                    เงินได้สุทธิ:
                    <b>
                        ฿${formatMoney(
                            netIncome
                        )}
                    </b>
                </div>

                <div
                    style="
                        font-size:22px;
                        font-weight:700;
                        margin-top:10px;
                    "
                >
                    ภาษีประมาณ:
                    ฿${formatMoney(
                        tax
                    )}
                </div>

                <div
                    style="
                        font-size:12px;
                        color:#777;
                        margin-top:10px;
                    "
                >
                    * ใช้เพื่อประมาณการเท่านั้น
                    ไม่ใช่คำแนะนำด้านภาษี
                </div>

            </div>

        `,

        confirmButtonText:
            'ปิด'

    });


    addLog(
        'tax_calculation',
        {
            totalIncome,
            totalExpense,
            taxableBase,
            netIncome,
            tax
        }
    );

}


// ============================================================
// 44. SYSTEM TEST
// ============================================================

async function runSystemTest() {

    const results = [];


    /*
     * LocalStorage
     */
    try {

        const testKey =
            '__finance_test__';


        localStorage.setItem(
            testKey,
            'ok'
        );


        const value =
            localStorage.getItem(
                testKey
            );


        localStorage.removeItem(
            testKey
        );


        results.push({

            name:
                'LocalStorage',

            status:
                value === 'ok'
                    ? 'ผ่าน'
                    : 'ไม่ผ่าน'

        });

    } catch (error) {

        results.push({

            name:
                'LocalStorage',

            status:
                'ไม่ผ่าน'

        });

    }


    /*
     * OCR
     */
    results.push({

        name:
            'Tesseract.js',

        status:
            typeof Tesseract !==
            'undefined'
                ? 'พร้อมใช้งาน'
                : 'ไม่พบ'

    });


    /*
     * SweetAlert
     */
    results.push({

        name:
            'SweetAlert2',

        status:
            typeof Swal !==
            'undefined'
                ? 'พร้อมใช้งาน'
                : 'ไม่พบ'

    });


    /*
     * DOM สำคัญ
     */
    const requiredIds = [
        'fDate',
        'fAmount',
        'fNote',
        'catGrid',
        'txList',
        'incomeInput'
    ];


    const missing =
        requiredIds.filter(
            id =>
                !document.getElementById(
                    id
                )
        );


    results.push({

        name:
            'DOM',

        status:
            missing.length
                ? `ขาด ${missing.join(', ')}`
                : 'ครบ'

    });


    const html =
        results
            .map(
                result => `

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            padding:8px 0;
                            border-bottom:1px solid #eee;
                        "
                    >

                        <span>
                            ${escapeHtml(
                                result.name
                            )}
                        </span>

                        <b>
                            ${escapeHtml(
                                result.status
                            )}
                        </b>

                    </div>

                `
            )
            .join('');


    await Swal.fire({

        title:
            'System Test',

        html,

        confirmButtonText:
            'ปิด'

    });


    addLog(
        'system_test',
        {
            results
        }
    );

}
// ============================================================
// 39. CHART DRAW
// ============================================================

        // Income
        ctx.fillStyle =
            '#43A047';

        ctx.fillRect(
            center -
            barWidth -
            1,
            padding.top +
            chartHeight -
            incomeHeight,
            barWidth,
            Math.max(
                1,
                incomeHeight
            )
        );


        // Expense
        ctx.fillStyle =
            '#E53935';

        ctx.fillRect(
            center + 1,

            padding.top +
            chartHeight -
            expenseHeight,

            barWidth,

            Math.max(
                1,
                expenseHeight
            )
        );


        // labels
        if (
            count <= 31 ||
            i % Math.ceil(
                count / 12
            ) === 0
        ) {

            ctx.fillStyle =
                '#374151';

            ctx.textAlign =
                'center';

            ctx.textBaseline =
                'top';

            ctx.font =
                '10px Sarabun, sans-serif';

            ctx.fillText(
                data.labels[i],
                center,
                padding.top +
                chartHeight +
                8
            );

        }

    }


    // Legend
    ctx.font =
        '12px Sarabun, sans-serif';

    ctx.textAlign =
        'left';

    ctx.fillStyle =
        '#43A047';

    ctx.fillRect(
        padding.left,
        5,
        10,
        10
    );

    ctx.fillStyle =
        '#374151';

    ctx.fillText(
        'รายรับ',
        padding.left + 15,
        14
    );

    ctx.fillStyle =
        '#E53935';

    ctx.fillRect(
        padding.left + 70,
        5,
        10,
        10
    );

    ctx.fillStyle =
        '#374151';

    ctx.fillText(
        'รายจ่าย',
        padding.left + 85,
        14
    );

}


// ============================================================
// 40. CHART SUMMARY
// ============================================================

function renderChartSummary(
    data
) {

    const element =
        document.getElementById(
            'chartSummary'
        );

    if (!element) {
        return;
    }

    const income =
        data.income.reduce(
            (sum, value) =>
                sum + value,
            0
        );

    const expense =
        data.expense.reduce(
            (sum, value) =>
                sum + value,
            0
        );

    const remaining =
        income - expense;


    element.innerHTML = `

        <div
            style="
                padding:9px;
                border-radius:10px;
                background:#F7F7F7;
                text-align:center;
            "
        >
            <div
                style="
                    font-size:11px;
                    color:#6B7280;
                "
            >
                รายรับ
            </div>

            <div
                style="
                    font-size:14px;
                    font-weight:700;
                    color:#2E7D32;
                "
            >
                ฿${formatMoney(income)}
            </div>
        </div>


        <div
            style="
                padding:9px;
                border-radius:10px;
                background:#F7F7F7;
                text-align:center;
            "
        >
            <div
                style="
                    font-size:11px;
                    color:#6B7280;
                "
            >
                รายจ่าย
            </div>

            <div
                style="
                    font-size:14px;
                    font-weight:700;
                    color:#C62828;
                "
            >
                ฿${formatMoney(expense)}
            </div>
        </div>


        <div
            style="
                padding:9px;
                border-radius:10px;
                background:#F7F7F7;
                text-align:center;
            "
        >
            <div
                style="
                    font-size:11px;
                    color:#6B7280;
                "
            >
                คงเหลือ
            </div>

            <div
                style="
                    font-size:14px;
                    font-weight:700;
                    color:${
                        remaining >= 0
                            ? '#2E7D32'
                            : '#C62828'
                    };
                "
            >
                ฿${formatMoney(remaining)}
            </div>
        </div>

    `;

}


// ============================================================
// 40. IMAGE COMPRESS
// ============================================================

function compressImage(
    file,
    maxSide = 1400,
    quality = 0.92
) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onerror =
                reject;


            reader.onload =
                event => {

                    const image =
                        new Image();

                    image.onerror =
                        reject;


                    image.onload =
                        () => {

                            let width =
                                image.width;

                            let height =
                                image.height;


                            if (
                                width >
                                    maxSide ||
                                height >
                                    maxSide
                            ) {

                                if (
                                    width >
                                    height
                                ) {

                                    height =
                                        Math.round(
                                            height *
                                            maxSide /
                                            width
                                        );

                                    width =
                                        maxSide;

                                } else {

                                    width =
                                        Math.round(
                                            width *
                                            maxSide /
                                            height
                                        );

                                    height =
                                        maxSide;

                                }

                            }


                            const canvas =
                                document.createElement(
                                    'canvas'
                                );


                            canvas.width =
                                width;

                            canvas.height =
                                height;


                            const context =
                                canvas.getContext(
                                    '2d'
                                );


                            context.drawImage(
                                image,
                                0,
                                0,
                                width,
                                height
                            );


                            resolve(
                                canvas.toDataURL(
                                    'image/jpeg',
                                    quality
                                )
                            );

                        };


                    image.src =
                        event.target.result;

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


// ============================================================
// 41. CSV
// ============================================================

function exportTransactionsCSV() {

    if (!state.transactions.length) {

        notifyInfo(
            'ไม่มีข้อมูล',
            'ไม่มีรายการสำหรับส่งออก CSV'
        );

        return;
    }


    let csv =
        '\uFEFFID,Date,Time,Amount,Category,Type,Sender,Receiver,Note\n';


    state.transactions.forEach(
        tx => {

            csv +=
                `"${csvEscape(tx.id)}",` +
                `"${csvEscape(tx.date)}",` +
                `"${csvEscape(tx.time || '')}",` +
                `"${csvEscape(tx.amount)}",` +
                `"${csvEscape(tx.category)}",` +
                `"${csvEscape(tx.type)}",` +
                `"${csvEscape(tx.sender || '')}",` +
                `"${csvEscape(tx.receiver || '')}",` +
                `"${csvEscape(tx.note || '')}"\n`;

        }
    );


    downloadCSV(
        csv,
        `transactions_${state.currentMonth}.csv`
    );


    notifySuccess(
        'ส่งออก CSV เรียบร้อย'
    );

}


function exportLogsCSV() {

    if (
        !state.logs ||
        !state.logs.length
    ) {

        notifyInfo(
            'ไม่มีข้อมูล',
            'ไม่มีประวัติกิจกรรม'
        );

        return;
    }


    let csv =
        '\uFEFFTimestamp,Action,Details\n';


    state.logs.forEach(
        log => {

            csv +=
                `"${csvEscape(log.timestamp)}",` +
                `"${csvEscape(log.action)}",` +
                `"${csvEscape(
                    JSON.stringify(
                        log.details || {}
                    )
                )}"\n`;

        }
    );


    downloadCSV(
        csv,
        'activity_logs.csv'
    );


    notifySuccess(
        'ส่งออกประวัติเรียบร้อย'
    );

}


function csvEscape(
    value
) {

    return String(
        value ?? ''
    ).replace(
        /"/g,
        '""'
    );

}


function downloadCSV(
    content,
    filename
) {

    const blob =
        new Blob(
            [content],
            {
                type:
                    'text/csv;charset=utf-8;'
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            'a'
        );


    link.href =
        url;


    link.download =
        filename;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    setTimeout(
        () =>
            URL.revokeObjectURL(
                url
            ),
        100
    );

}


// ============================================================
// 42. TAX
// ============================================================

function calculateTax() {

    const income =
        parseFloat(
            document.getElementById(
                'taxIncome'
            )?.value || 0
        );


    const deduct =
        parseFloat(
            document.getElementById(
                'taxDeduct'
            )?.value || 0
        );


    const netIncome =
        Math.max(
            0,
            income - deduct
        );


    let tax = 0;


    if (
        netIncome > 500000
    ) {

        tax +=
            (
                netIncome -
                500000
            ) *
            0.15 +
            25000;

    } else if (
        netIncome > 300000
    ) {

        tax +=
            (
                netIncome -
                300000
            ) *
            0.10 +
            7500;

    } else if (
        netIncome > 150000
    ) {

        tax +=
            (
                netIncome -
                150000
            ) *
            0.05;

    }


    const result =
        document.getElementById(
            'taxResult'
        );


    if (!result) {
        return;
    }


    result.innerHTML = `

        <div
            style="
                background:var(--accent-light);
                padding:14px;
                border-radius:10px;
                color:var(--accent);
            "
        >

            <div>
                <strong>
                    เงินได้สุทธิ:
                </strong>

                ฿${formatMoney(netIncome)}
            </div>


            <div
                style="
                    font-size:16px;
                    font-weight:700;
                    margin-top:4px;
                "
            >

                <strong>
                    ภาษีประเมิน:
                </strong>

                ฿${formatMoney(tax)}

            </div>

        </div>

    `;

}


// ============================================================
// 43. DIAGNOSTICS
// ============================================================

function runSystemDiagnostics() {

    const results =
        document.getElementById(
            'testResultsList'
        );


    if (!results) {
        return;
    }


    const localStorageOK =
        (() => {

            try {

                const key =
                    '__finance_test__';


                localStorage.setItem(
                    key,
                    '1'
                );


                localStorage.removeItem(
                    key
                );


                return true;

            } catch (error) {

                return false;

            }

        })();


    const canvasOK =
        !!document.createElement(
            'canvas'
        ).getContext;


    const tesseractOK =
        typeof Tesseract !==
        'undefined';


    const sweetAlertOK =
        typeof Swal !==
        'undefined';


    results.innerHTML = `

        <div
            style="
                font-size:13px;
                padding:10px;
                background:#F5F5F5;
                border-radius:8px;
                line-height:1.8;
            "
        >

            <div>
                ${
                    localStorageOK
                        ? '✅'
                        : '❌'
                }
                LocalStorage
            </div>


            <div>
                ${
                    canvasOK
                        ? '✅'
                        : '❌'
                }
                Canvas
            </div>


            <div>
                ${
                    tesseractOK
                        ? '✅'
                        : '❌'
                }
                Tesseract.js OCR
            </div>


            <div>
                ${
                    sweetAlertOK
                        ? '✅'
                        : '❌'
                }
                SweetAlert2
            </div>


            <div
                style="
                    color:var(--good);
                    font-weight:700;
                    margin-top:6px;
                "
            >
                ${
                    localStorageOK &&
                    canvasOK &&
                    tesseractOK &&
                    sweetAlertOK
                        ? 'ระบบพื้นฐานพร้อมใช้งาน'
                        : 'พบระบบบางส่วนที่ต้องตรวจสอบ'
                }
            </div>

        </div>

    `;


    notifySuccess(
        'ทดสอบระบบเสร็จแล้ว'
    );

}


// ============================================================
// 44. ESCAPE HTML
// ============================================================

function escapeHtml(
    value
) {

    return String(
        value ?? ''
    ).replace(
        /[&<>'"]/g,
        character => ({

            '&':
                '&amp;',

            '<':
                '&lt;',

            '>':
                '&gt;',

            "'":
                '&#39;',

            '"':
                '&quot;'

        }[character])
    );

}


function escapeAttr(
    value
) {

    return escapeHtml(
        value
    );

}


// ============================================================
// 45. ENHANCEMENTS INIT
// ============================================================

function initEnhancements() {

    initChartControls();


    window.addEventListener(
        'resize',
        () => {

            clearTimeout(
                window.__financeResizeTimer
            );


            window.__financeResizeTimer =
                setTimeout(
                    () =>
                        renderIncomeExpenseChart(),
                    150
                );

        }
    );


    const saveAll =
        document.getElementById(
            'saveAllScansBtn'
        );


    saveAll?.addEventListener(
        'click',
        saveAllScannedReceipts
    );


    const clearAll =
        document.getElementById(
            'clearAllScansBtn'
        );


    clearAll?.addEventListener(
        'click',
        clearMultiScanResultsConfirm
    );


    const multiSelect =
        document.getElementById(
            'multiScanSelectBtn'
        );


    multiSelect?.addEventListener(
        'click',
        () => {

            document
                .getElementById(
                    'scanFileInput'
                )
                ?.click();

        }
    );

}
                )
                ?.click();

        }
    );

}


// ============================================================
// END
// ============================================================

