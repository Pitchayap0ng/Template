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
            1400,
            0.92
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


    try {

        if (progress) {

            progress.textContent =
                'กำลังเตรียม OCR ภาษาไทย + อังกฤษ...';

        }


        const worker =
            await Tesseract.createWorker(
                'tha+eng'
            );


        if (progress) {

            progress.textContent =
                'กำลังอ่านข้อความบนสลิป...';

        }


        const result =
            await worker.recognize(
                currentScannedImageBase64
            );


        const extractedText =
            result?.data?.text || '';


        await worker.terminate();


        if (progress) {

            progress.textContent =
                'กำลังวิเคราะห์ยอดเงิน วันที่ และข้อมูลผู้โอน...';

        }


        const parsed =
            parseSlipOCRText(
                extractedText
            );


        fillSingleScanResult(
            parsed
        );


        document.getElementById(
            'scannerLine'
        )?.style.setProperty(
            'display',
            'none'
        );


        document.getElementById(
            'scanStatus'
        )?.style.setProperty(
            'display',
            'none'
        );


        if (resultCard) {

            resultCard.style.display =
                'block';

        }


        if (!parsed.amount) {

            await notifyWarning(
                'อ่านสลิปแล้ว แต่ไม่พบยอดเงิน',
                'กรุณาตรวจสอบและกรอกยอดเงินด้วยตนเองก่อนบันทึก'
            );

        } else {

            await notifySuccess(
                'อ่านสลิปสำเร็จ',
                `พบยอดเงิน ฿${formatMoney(parsed.amount)}`
            );

        }

    } catch (error) {

        console.error(
            'OCR Error:',
            error
        );


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
        'add_transaction',
        {
            date,
            time,
            amount:
                `฿${formatMoney(amount)}`,
            category:
                CATEGORIES.find(
                    c =>
                        c.id === category
                )?.label || category,
            sender,
            receiver,
            note:
                `[สแกนสลิป] ${note}`
        }
    );


    resetScanUI();

    renderAll();


    document
        .querySelector(
            '[data-page="transactions"]'
        )
        ?.click();


    await notifySuccess(
        'บันทึกสลิปเรียบร้อย',
        `฿${formatMoney(amount)}`
    );

}


// ============================================================
// 16. RESET SINGLE SCANNER
// ============================================================

function resetScanUI() {

    const input =
        document.getElementById(
            'scanFileInput'
        );

    if (input) {
        input.value = '';
    }


    const dropzone =
        document.getElementById(
            'scanDropzone'
        );

    const preview =
        document.getElementById(
            'scanPreviewBox'
        );

    const result =
        document.getElementById(
            'scanResultCard'
        );

    const scanner =
        document.getElementById(
            'scannerLine'
        );

    const status =
        document.getElementById(
            'scanStatus'
        );


    if (dropzone) {
        dropzone.style.display =
            'block';
    }

    if (preview) {
        preview.style.display =
            'none';
    }

    if (result) {
        result.style.display =
            'none';
    }

    if (scanner) {
        scanner.style.display =
            'block';
    }

    if (status) {
        status.style.display =
            'flex';
    }


    currentScannedImageBase64 =
        null;


    const fields = [
        'resAmount',
        'resDate',
        'resTime',
        'resSender',
        'resReceiver',
        'resNote'
    ];


    fields.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.value = '';
        }

    });

}


// ============================================================
// 17. MULTI OCR
// ============================================================

async function processMultipleSlipImages(
    files
) {

    if (!Array.isArray(files)) {
        files = Array.from(files || []);
    }


    files =
        files.filter(
            file =>
                file.type.startsWith('image/')
        );


    if (!files.length) {
        return;
    }


    if (files.length > 30) {

        await notifyWarning(
            'เลือกได้สูงสุด 30 รูป',
            'ระบบจะใช้ 30 รูปแรก'
        );

        files =
            files.slice(0, 30);

    }


    multiSlipResults = [];


    const results =
        document.getElementById(
            'multiScanResults'
        );

    const progress =
        document.getElementById(
            'multiScanProgress'
        );

    const actions =
        document.getElementById(
            'multiScanActions'
        );


    if (results) {
        results.innerHTML = '';
    }

    if (actions) {
        actions.style.display =
            'none';
    }


    Swal.fire({

        title:
            'กำลังวิเคราะห์สลิป',

        html:
            `กำลังเตรียมอ่าน ${files.length} รูป`,

        allowOutsideClick: false,

        allowEscapeKey: false,

        didOpen: () => {
            Swal.showLoading();
        }

    });


    try {

        multiSlipWorker =
            await Tesseract.createWorker(
                'tha+eng'
            );


        for (
            let i = 0;
            i < files.length;
            i++
        ) {

            const file =
                files[i];


            if (progress) {

                progress.textContent =
                    `กำลังอ่านสลิป ${i + 1}/${files.length}: ${file.name}`;

            }


            Swal.update({

                html:
                    `กำลังอ่านสลิป <b>${i + 1}/${files.length}</b>
                    <br>${escapeHtml(file.name)}`

            });


            try {

                const image =
                    await compressImage(
                        file,
                        1400,
                        0.92
                    );


                const result =
                    await multiSlipWorker.recognize(
                        image
                    );


                // แก้ bug เดิม:
                // ต้องประกาศ extractedText จาก result.data.text
                const extractedText =
                    result?.data?.text || '';


                const parsed =
                    parseSlipOCRText(
                        extractedText
                    );


                multiSlipResults.push({

                    id:
                        `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,

                    fileName:
                        file.name,

                    image,

                    amount:
                        parsed.amount || 0,

                    date:
                        parsed.date ||
                        todayStr(),

                    time:
                        parsed.time || '',

                    category:
                        parsed.category ||
                        'other',

                    sender:
                        parsed.sender || '',

                    receiver:
                        parsed.receiver || '',

                    note:
                        parsed.note ||
                        'โอนผ่านสลิปธนาคาร',

                    selected:
                        Boolean(
                            parsed.amount &&
                            parsed.amount > 0
                        ),

                    rawText:
                        extractedText,

                    error:
                        false

                });

            } catch (error) {

                console.error(
                    'Multi OCR item error:',
                    error
                );


                multiSlipResults.push({

                    id:
                        `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,

                    fileName:
                        file.name,

                    image:
                        null,

                    amount:
                        0,

                    date:
                        todayStr(),

                    time:
                        '',

                    category:
                        'other',

                    sender:
                        '',

                    receiver:
                        '',

                    note:
                        'อ่านสลิปไม่สำเร็จ — กรุณาตรวจสอบ',

                    selected:
                        false,

                    rawText:
                        '',

                    error:
                        true

                });

            }

        }

    } finally {

        if (multiSlipWorker) {

            try {

                await multiSlipWorker.terminate();

            } catch (error) {

                console.warn(
                    error
                );

            }

            multiSlipWorker =
                null;

        }


        Swal.close();

    }


    renderMultiScanResults();


    const successCount =
        multiSlipResults.filter(
            item =>
                !item.error &&
                item.amount > 0
        ).length;


    if (
        successCount ===
        files.length
    ) {

        await notifySuccess(
            'วิเคราะห์สลิปครบแล้ว',
            `อ่านสำเร็จ ${successCount} ใบ กรุณาตรวจสอบก่อนบันทึก`
        );

    } else {

        await notifyWarning(
            'วิเคราะห์เสร็จแล้ว',
            `อ่านยอดสำเร็จ ${successCount}/${files.length} ใบ`
        );

    }

}


// ============================================================
// 18. MULTI RESULT UI
// ============================================================

function renderMultiScanResults() {

    const results =
        document.getElementById(
            'multiScanResults'
        );

    const actions =
        document.getElementById(
            'multiScanActions'
        );


    if (!results || !actions) {
        return;
    }


    if (!multiSlipResults.length) {

        results.innerHTML = '';

        actions.style.display =
            'none';

        return;

    }


    results.innerHTML =
        multiSlipResults
            .map(
                (item, index) => `

                <div
                    style="
                        border:1px solid ${
                            item.error
                                ? '#F59E0B'
                                : '#E5E7EB'
                        };
                        border-radius:12px;
                        padding:10px;
                        background:#fff;
                    "
                >

                    <div
                        style="
                            display:flex;
                            gap:10px;
                            align-items:flex-start;
                        "
                    >

                        ${
                            item.image

                            ?

                            `
                            <img
                                src="${item.image}"
                                style="
                                    width:70px;
                                    height:100px;
                                    object-fit:cover;
                                    border-radius:8px;
                                    border:1px solid #eee;
                                "
                            >
                            `

                            :

                            `
                            <div
                                style="
                                    width:70px;
                                    height:100px;
                                    border-radius:8px;
                                    background:#FFF7ED;
                                    display:grid;
                                    place-items:center;
                                    font-size:26px;
                                "
                            >
                                ⚠️
                            </div>
                            `
                        }


                        <div
                            style="
                                flex:1;
                                min-width:0;
                            "
                        >

                            <div
                                style="
                                    display:flex;
                                    gap:8px;
                                    align-items:center;
                                "
                            >

                                <input
                                    type="checkbox"
                                    ${
                                        item.selected
                                            ? 'checked'
                                            : ''
                                    }
                                    onchange="
                                        toggleMultiScanSelection(
                                            ${index},
                                            this.checked
                                        )
                                    "
                                >

                                <strong
                                    style="
                                        font-size:13px;
                                        overflow:hidden;
                                        text-overflow:ellipsis;
                                        white-space:nowrap;
                                    "
                                >
                                    ${escapeHtml(
                                        item.fileName
                                    )}
                                </strong>

                            </div>


                            <div
                                style="
                                    display:grid;
                                    grid-template-columns:1fr 1fr;
                                    gap:7px;
                                    margin-top:8px;
                                "
                            >

                                <input
                                    type="number"
                                    step="0.01"
                                    value="${
                                        item.amount || ''
                                    }"
                                    placeholder="จำนวนเงิน"
                                    onchange="
                                        updateMultiScanField(
                                            ${index},
                                            'amount',
                                            this.value
                                        )
                                    "
                                >


                                <input
                                    type="date"
                                    value="${
                                        item.date || ''
                                    }"
                                    onchange="
                                        updateMultiScanField(
                                            ${index},
                                            'date',
                                            this.value
                                        )
                                    "
                                >


                                <input
                                    type="time"
                                    value="${
                                        item.time || ''
                                    }"
                                    onchange="
                                        updateMultiScanField(
                                            ${index},
                                            'time',
                                            this.value
                                        )
                                    "
                                >


                                <select
                                    onchange="
                                        updateMultiScanField(
                                            ${index},
                                            'category',
                                            this.value
                                        )
                                    "
                                >

                                    ${
                                        CATEGORIES
                                            .map(
                                                category => `

                                                <option
                                                    value="${category.id}"
                                                    ${
                                                        category.id ===
                                                        item.category
                                                            ? 'selected'
                                                            : ''
                                                    }
                                                >
                                                    ${category.icon}
                                                    ${category.label}
                                                </option>

                                            `
                                            )
                                            .join('')
                                    }

                                </select>


                                <input
                                    type="text"
                                    value="${escapeAttr(
                                        item.sender
                                    )}"
                                    placeholder="ผู้โอน"
                                    onchange="
                                        updateMultiScanField(
                                            ${index},
                                            'sender',
                                            this.value
                                        )
                                    "
                                >


                                <input
                                    type="text"
                                    value="${escapeAttr(
                                        item.receiver
                                    )}"
                                    placeholder="ผู้รับ"
                                    onchange="
                                        updateMultiScanField(
                                            ${index},
                                            'receiver',
                                            this.value
                                        )
                                    "
                                >


                                <input
                                    type="text"
                                    value="${escapeAttr(
                                        item.note
                                    )}"
                                    placeholder="รายละเอียด"
                                    onchange="
                                        updateMultiScanField(
                                            ${index},
                                            'note',
                                            this.value
                                        )
                                    "
                                    style="grid-column:1/-1;"
                                >

                            </div>


                            ${
                                item.error ||
                                !item.amount

                                ?

                                `
                                <div
                                    style="
                                        font-size:11px;
                                        color:#B45309;
                                        margin-top:6px;
                                    "
                                >
                                    ⚠️ ไม่พบยอดเงิน
                                    กรุณากรอกยอดเงินก่อนเลือกบันทึก
                                </div>
                                `

                                :

                                ''
                            }

                        </div>

                    </div>

                </div>

            `
            )
            .join('');


    actions.style.display =
        'flex';

}


// ============================================================
// 19. MULTI FIELD
// ============================================================

function toggleMultiScanSelection(
    index,
    checked
) {

    if (
        multiSlipResults[index]
    ) {

        multiSlipResults[index]
            .selected = checked;

    }

}


function updateMultiScanField(
    index,
    field,
    value
) {

    if (
        !multiSlipResults[index]
    ) {
        return;
    }


    if (field === 'amount') {

        multiSlipResults[index][field] =
            parseFloat(value) || 0;


        if (
            multiSlipResults[index]
                .amount > 0
        ) {

            multiSlipResults[index]
                .error = false;

        }

    } else {

        multiSlipResults[index][field] =
            value;

    }

}


// ============================================================
// 20. SAVE MULTI OCR
// ============================================================

async function saveAllScannedReceipts() {

    const selected =
        multiSlipResults.filter(
            item =>
                item.selected
        );


    if (!selected.length) {

        await notifyWarning(
            'ยังไม่ได้เลือกสลิป',
            'เลือกอย่างน้อย 1 ใบก่อนบันทึก'
        );

        return;

    }


    const invalid =
        selected.filter(
            item =>
                !item.amount ||
                item.amount <= 0 ||
                !item.date
        );


    if (invalid.length) {

        await notifyWarning(
            'ข้อมูลยังไม่ครบ',
            `${invalid.length} ใบยังไม่มียอดเงินหรือวันที่`
        );

        return;

    }


    const total =
        selected.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.amount || 0
                ),
            0
        );


    const confirmed =
        await confirmAction(

            'ยืนยันบันทึกสลิปทั้งหมด?',

            `จำนวน ${selected.length} รายการ
ยอดรวม ฿${formatMoney(total)}

ระบบจะเพิ่มทั้งหมดลงในรายการรายจ่าย`,

            'ยืนยันบันทึกทั้งหมด'

        );


    if (!confirmed) {
        return;
    }


    const baseId =
        Date.now();


    selected.forEach(
        (item, index) => {

            const tx = {

                id:
                    baseId + index,

                date:
                    item.date,

                time:
                    item.time || '',

                amount:
                    Number(
                        item.amount
                    ),

                category:
                    item.category,

                type:
                    'transfer',

                note:
                    item.note ||
                    'โอนผ่านสลิปธนาคาร',

                sender:
                    item.sender || '',

                receiver:
                    item.receiver || '',

                receipt:
                    item.image

            };


            state.transactions.push(
                tx
            );


            addLog(
                'add_transaction',
                {
                    date:
                        tx.date,

                    time:
                        tx.time,

                    amount:
                        `฿${formatMoney(tx.amount)}`,

                    category:
                        CATEGORIES.find(
                            category =>
                                category.id ===
                                tx.category
                        )?.label ||
                        tx.category,

                    sender:
                        tx.sender,

                    receiver:
                        tx.receiver,

                    note:
                        `[สแกนหลายสลิป] ${tx.note}`
                }
            );

        }
    );


    save();

    renderAll();

    clearMultiScanResults();


    document
        .querySelector(
            '[data-page="transactions"]'
        )
        ?.click();


    await notifySuccess(
        'บันทึกสลิปเรียบร้อย',
        `${selected.length} รายการ รวม ฿${formatMoney(total)}`
    );

}


// ============================================================
// 21. CLEAR MULTI
// ============================================================

async function clearMultiScanResultsConfirm() {

    if (!multiSlipResults.length) {
        return;
    }


    const confirmed =
        await confirmAction(
            'ล้างผลการสแกนทั้งหมด?',
            'ข้อมูลที่ยังไม่ได้บันทึกจะหายทั้งหมด',
            'ล้างผลลัพธ์'
        );


    if (confirmed) {

        clearMultiScanResults();

        await notifySuccess(
            'ล้างผลลัพธ์แล้ว'
        );

    }

}


function clearMultiScanResults() {

    multiSlipResults = [];


    const results =
        document.getElementById(
            'multiScanResults'
        );

    const progress =
        document.getElementById(
            'multiScanProgress'
        );

    const actions =
        document.getElementById(
            'multiScanActions'
        );


    if (results) {
        results.innerHTML = '';
    }

    if (progress) {
        progress.textContent = '';
    }

    if (actions) {
        actions.style.display =
            'none';
    }

}


// ============================================================
// 22. OCR PARSER
// ============================================================

function parseSlipOCRText(
    originalText
) {

    const text =
        normalizeOCRText(
            originalText
        );


    let amount =
        extractBestAmount(
            text
        );


    const date =
        extractDate(
            text
        );


    const time =
        extractTime(
            text
        );


    const sender =
        extractPerson(
            text,
            [
                'ผู้โอน',
                'จาก',
                'sender',
                'from'
            ]
        );


    const receiver =
        extractPerson(
            text,
            [
                'ผู้รับ',
                'ถึง',
                'receiver',
                'to'
            ]
        );


    const categoryData =
        detectCategory(
            text
        );


    let note =
        categoryData.note ||
        'โอนเงิน';


    if (
        sender ||
        receiver
    ) {

        const people = [];

        if (sender) {
            people.push(
                `ผู้โอน: ${sender}`
            );
        }

        if (receiver) {
            people.push(
                `ผู้รับ: ${receiver}`
            );
        }

        note +=
            people.length
                ? ` | ${people.join(' | ')}`
                : '';

    }


    return {

        amount,

        date,

        time,

        sender,

        receiver,

        category:
            categoryData.category,

        note,

        rawText:
            text

    };

}


// ============================================================
// 23. AMOUNT EXTRACTION
// ============================================================

function extractBestAmount(
    text
) {

    const candidates = [];


    function addCandidate(
        raw,
        score,
        source
    ) {

        if (!raw) {
            return;
        }


        let cleaned =
            String(raw)
                .replace(/฿/g, '')
                .replace(/บาท/gi, '')
                .replace(/\s/g, '')
                .replace(/,/g, '');


        // OCR มักอ่าน comma/period ผิด
        cleaned =
            cleaned.replace(
                /[^\d.]/g,
                ''
            );


        const value =
            parseFloat(
                cleaned
            );


        if (
            !Number.isFinite(value) ||
            value <= 0 ||
            value >= 5000000
        ) {
            return;
        }


        candidates.push({

            value,

            score,

            source

        });

    }


    // รูปแบบหลัก
    const moneyRegex =
        /(?:฿\s*)?(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})|\d+\.\d{2})/g;


    for (
        const match of text.matchAll(
            moneyRegex
        )
    ) {

        const before =
            text.slice(
                Math.max(
                    0,
                    match.index - 50
                ),
                match.index
            ).toLowerCase();


        const after =
            text.slice(
                match.index,
                match.index + 80
            ).toLowerCase();


        let score = 10;


        if (
            /จำนวนเงิน|amount|ยอดเงิน|total|ยอดโอน|ชำระ|payment|baht|บาท|thb/
                .test(before + after)
        ) {

            score += 80;

        }


        if (
            /ค่าธรรมเนียม|fee|service/
                .test(before + after)
        ) {

            score -= 60;

        }


        if (
            /เลขที่|reference|ref|transaction|บัญชี|account/
                .test(before + after)
        ) {

            score -= 40;

        }


        if (
            /\.\d{2}$/.test(
                match[1]
            )
        ) {

            score += 20;

        }


        addCandidate(
            match[1],
            score,
            'money'
        );

    }


    // ตัวเลขที่ไม่มี decimal
    const integerRegex =
        /(?:฿\s*)?(\d{1,3}(?:[,\s]\d{3})+|\d{4,})/g;


    for (
        const match of text.matchAll(
            integerRegex
        )
    ) {

        const before =
            text.slice(
                Math.max(
                    0,
                    match.index - 50
                ),
                match.index
            ).toLowerCase();


        const after =
            text.slice(
                match.index,
                match.index + 60
            ).toLowerCase();


        let score = 3;


        if (
            /จำนวนเงิน|ยอดเงิน|amount|total|บาท|thb|โอน/
                .test(
                    before + after
                )
        ) {

            score += 50;

        }


        addCandidate(
            match[1],
            score,
            'integer'
        );

    }


    // KBank OCR มักมีรูปแบบ
    // Amount / จำนวนเงิน แล้วตามด้วยตัวเลขในบรรทัดถัดไป
    const lines =
        text
            .split(/\r?\n/)
            .map(
                line => line.trim()
            )
            .filter(Boolean);


    lines.forEach(
        (line, index) => {

            if (
                /จำนวนเงิน|ยอดเงิน|amount|total|โอนสำเร็จ|ชำระ/
                    .test(
                        line.toLowerCase()
                    )
            ) {

                const context =
                    [
                        line,
                        lines[index + 1] || '',
                        lines[index + 2] || ''
                    ].join(' ');


                const numbers =
                    context.match(
                        /(?:฿\s*)?\d[\d,\s]*(?:\.\d{1,2})?/g
                    ) || [];


                numbers.forEach(
                    number => {

                        addCandidate(
                            number,
                            120,
                            'label-context'
                        );

                    }
                );

            }

        }
    );


    if (!candidates.length) {
        return null;
    }


    // ลบ duplicate
    const unique =
        candidates.filter(
            (candidate, index, array) =>
                array.findIndex(
                    x =>
                        Math.abs(
                            x.value -
                            candidate.value
                        ) < 0.001
                ) === index
        );


    unique.sort(
        (a, b) =>
            b.score - a.score
    );


    return unique[0]?.value || null;

}


// ============================================================
// 24. DATE
// ============================================================

function extractDate(
    text
) {

    const patterns = [

        /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,

        /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})/

    ];


    for (
        const pattern of patterns
    ) {

        const match =
            text.match(pattern);


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


        if (year.length === 2) {
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


    return todayStr();

}


// ============================================================
// 25. TIME
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
        ':' +
        String(parts[1])
            .padStart(2, '0')
    );

}


// ============================================================
// 26. PERSON EXTRACTION
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
                line.match(regex);


            if (
                match &&
                match[1]
            ) {

                const value =
                    match[1]
                        .trim()
                        .replace(
                            /\s+/g,
                            ' '
                        );


                if (
                    value.length >= 2 &&
                    value.length <= 100
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


                if (
                    next &&
                    !/\d{4,}/.test(next)
                ) {

                    return next
                        .trim();

                }

            }

        }

    }


    return '';

}


// ============================================================
// 27. CATEGORY DETECTION
// ============================================================

function detectCategory(
    text
) {

    const lower =
        text.toLowerCase();


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
            'mcdonald',
            'kfc'
        ].some(
            keyword =>
                lower.includes(
                    keyword
                )
        )
    ) {

        return {
            category: 'food',
            note: 'ค่าอาหาร/เครื่องดื่ม'
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
            category: 'transport',
            note: 'ค่าเดินทาง/น้ำมัน'
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
            category: 'bills',
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
            category: 'shopping',
            note:
                'ชอปปิงออนไลน์'
        };

    }


    return {
        category: 'other',
        note: 'โอนเงิน'
    };

}


// ============================================================
// 28. RENDER ALL
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
                                    ).toLocaleString(
                                        'th-TH'
                                    )
                                }
                            </div>

                        </div>


                        <div
                            style="
                                font-size:12px;
                                color:var(--muted);
                            "
                        >
                            ${escapeHtml(
                                JSON.stringify(
                                    log.details || {}
                                )
                            )}
                        </div>

                    </div>

                `
            )
            .join('');

}


// ============================================================
// 38. CHART
// ============================================================

function initChartControls() {

    const daily =
        document.getElementById(
            'chartDailyBtn'
        );

    const monthly =
        document.getElementById(
            'chartMonthlyBtn'
        );


    daily?.addEventListener(
        'click',
        () => {

            chartMode =
                'daily';

            renderIncomeExpenseChart();

        }
    );


    monthly?.addEventListener(
        'click',
        () => {

            chartMode =
                'monthly';

            renderIncomeExpenseChart();

        }
    );

}


function renderIncomeExpenseChart() {

    const canvas =
        document.getElementById(
            'incomeExpenseChart'
        );


    if (!canvas) {
        return;
    }


    const parent =
        canvas.parentElement;


    if (!parent) {
        return;
    }


    const width =
        Math.max(
            320,
            parent.clientWidth
        );


    const height =
        Math.max(
            240,
            parent.clientHeight
        );


    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        width * dpr;


    canvas.height =
        height * dpr;


    canvas.style.width =
        width + 'px';


    canvas.style.height =
        height + 'px';


    const ctx =
        canvas.getContext(
            '2d'
        );


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const data =
        chartMode === 'daily'
            ? getDailyChartData()
            : getMonthlyChartData();


    drawChart(
        ctx,
        width,
        height,
        data
    );


    renderChartSummary(
        data
    );

}


function getDailyChartData() {

    const [
        year,
        month
    ] =
        state.currentMonth
            .split('-')
            .map(Number);


    const days =
        new Date(
            year,
            month,
            0
        ).getDate();


    const labels = [];

    const income = [];

    const expense = [];


    const monthIncome =
        Number(
            state.income[
                state.currentMonth
            ] || 0
        );


    for (
        let day = 1;
        day <= days;
        day++
    ) {

        const date =
            `${state.currentMonth}-${String(day).padStart(2, '0')}`;


        labels.push(
            String(day)
        );


        // รายรับเดิมเป็นรายเดือน
        // จะแสดงรายรับในวันแรกของเดือน
        income.push(
            day === 1
                ? monthIncome
                : 0
        );


        const dayExpense =
            state.transactions
                .filter(
                    tx =>
                        tx.date ===
                        date
                )
                .reduce(
                    (sum, tx) =>
                        sum +
                        Number(
                            tx.amount || 0
                        ),
                    0
                );


        expense.push(
            dayExpense
        );

    }


    return {
        labels,
        income,
        expense
    };

}


function getMonthlyChartData() {

    const labels = [];

    const income = [];

    const expense = [];


    const [
        currentYear
    ] =
        state.currentMonth
            .split('-')
            .map(Number);


    for (
        let month = 1;
        month <= 12;
        month++
    ) {

        const monthKey =
            `${currentYear}-${String(month).padStart(2, '0')}`;


        labels.push(
            new Date(
                currentYear,
                month - 1,
                1
            ).toLocaleDateString(
                'th-TH',
                {
                    month: 'short'
                }
            )
        );


        income.push(
            Number(
                state.income[
                    monthKey
                ] || 0
            )
        );


        expense.push(

            state.transactions
                .filter(
                    tx =>
                        String(
                            tx.date || ''
                        ).startsWith(
                            monthKey
                        )
                )
                .reduce(
                    (sum, tx) =>
                        sum +
                        Number(
                            tx.amount || 0
                        ),
                    0
                )

        );

    }


    return {
        labels,
        income,
        expense
    };

}


// ============================================================
// 39. DRAW CHART
// ============================================================

function drawChart(
    ctx,
    width,
    height,
    data
) {

    const padding = {

        top: 25,

        right: 20,

        bottom: 45,

        left: 55

    };


    const chartWidth =
        width -
        padding.left -
        padding.right;


    const chartHeight =
        height -
        padding.top -
        padding.bottom;


    const maxValue =
        Math.max(
            1,
            ...data.income,
            ...data.expense
        );


    // Grid
    ctx.font =
        '11px Sarabun, sans-serif';


    ctx.textAlign =
        'right';


    ctx.textBaseline =
        'middle';


    for (
        let i = 0;
        i <= 4;
        i++
    ) {

        const y =
            padding.top +
            chartHeight -
            (
                chartHeight *
                i /
                4
            );


        ctx.strokeStyle =
            '#E5E7EB';


        ctx.lineWidth = 1;


        ctx.beginPath();

        ctx.moveTo(
            padding.left,
            y
        );

        ctx.lineTo(
            width -
            padding.right,
            y
        );

        ctx.stroke();


        const value =
            maxValue *
            i /
            4;


        ctx.fillStyle =
            '#6B7280';


        ctx.fillText(
            `฿${Math.round(value).toLocaleString('th-TH')}`,
            padding.left - 8,
            y
        );

    }


    const count =
        data.labels.length;


    const groupWidth =
        chartWidth /
        Math.max(
            1,
            count
        );


    const barWidth =
        Math.max(
            2,
            Math.min(
                16,
                groupWidth /
                3
            )
        );


    for (
        let i = 0;
        i < count;
        i++
    ) {

        const center =
            padding.left +
            groupWidth *
            i +
            groupWidth /
            2;


        const incomeHeight =
            (
                data.income[i] /
                maxValue
            ) *
            chartHeight;


        const expenseHeight =
            (
                data.expense[i] /
                maxValue
            ) *
            chartHeight;


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


// ============================================================
// END
// ============================================================