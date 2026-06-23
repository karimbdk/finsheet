/* ======================================
   FinSheet - App Logic + Firebase Sync
   ====================================== */

// ---- Firebase Configuration ----
const firebaseConfig = {
    apiKey: "AIzaSyBD6UCw3eCiME28Zy611yD5PPzYJUQ1aZo",
    authDomain: "finsheet-ko-2026.firebaseapp.com",
    databaseURL: "https://finsheet-ko-2026-default-rtdb.firebaseio.com",
    projectId: "finsheet-ko-2026",
    storageBucket: "finsheet-ko-2026.firebasestorage.app",
    messagingSenderId: "826762688710",
    appId: "1:826762688710:web:3baae3473a2a14e7483fc7"
};

let firebaseReady = false;
let dataRef = null;

try {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    dataRef = db.ref('finsheet');
    firebaseReady = true;
    console.log('✅ Firebase initialized');
} catch (e) {
    console.warn('⚠️ Firebase not configured, using localStorage only', e);
}

// ---- Data Store ----
const STORAGE_KEY = 'finsheet_data';

const defaultData = () => ({
    suppliers: [],
    products: [],
    ads: [],
    goods: [],
    packaging: [],
    employee: [],
    other: [],
    income: [],
    usd: [],
    orders: [],
    activityLog: []
});

let DATA = loadData();
let firebaseListenerActive = false;

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            const def = defaultData();
            for (const key in def) {
                if (!(key in parsed)) parsed[key] = def[key];
            }
            return parsed;
        }
    } catch (e) {
        console.error('Error loading data', e);
    }
    return defaultData();
}

function saveData() {
    // Always save to localStorage (instant cache)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
    // Sync to Firebase if available
    if (firebaseReady && dataRef) {
        dataRef.set(DATA).catch(err => {
            console.error('Firebase save error:', err);
            showToast('خطأ في حفظ البيانات في السحابة', 'error');
        });
    }
}

// Firebase real-time listener
function initFirebase() {
    if (!firebaseReady || !dataRef) {
        console.warn('Firebase not available, running in offline mode');
        refreshAll();
        return;
    }

    dataRef.on('value', (snapshot) => {
        const firebaseData = snapshot.val();
        if (firebaseData) {
            // Merge with defaults for safety
            const def = defaultData();
            for (const key in def) {
                if (!(key in firebaseData)) firebaseData[key] = def[key];
                // Convert Firebase objects back to arrays if needed
                if (Array.isArray(def[key]) && firebaseData[key] && !Array.isArray(firebaseData[key])) {
                    firebaseData[key] = Object.values(firebaseData[key]);
                }
            }
            DATA = firebaseData;
            // Cache locally
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
            refreshAll();
            if (!firebaseListenerActive) {
                firebaseListenerActive = true;
                console.log('🔄 Firebase real-time sync active');
                showToast('متصل بالسحابة ☁️', 'info');
            }
        } else {
            // No data in Firebase yet, push local data
            const localData = loadData();
            const hasData = Object.values(localData).some(v => Array.isArray(v) && v.length > 0);
            if (hasData) {
                dataRef.set(localData);
            }
            refreshAll();
        }
    }, (error) => {
        console.error('Firebase listener error:', error);
        showToast('خطأ في الاتصال بالسحابة', 'error');
        refreshAll();
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function formatMoney(n) {
    if (n === undefined || n === null || isNaN(n)) return '0 د.ج';
    return Number(n).toLocaleString('ar-DZ') + ' د.ج';
}

function formatUSD(n) {
    if (n === undefined || n === null || isNaN(n)) return '0 $';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
}

function formatPercent(n) {
    if (n === undefined || n === null || isNaN(n)) return '0%';
    return Number(n).toFixed(1) + '%';
}

function getMonthName(m) {
    const months = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return months[m] || '';
}

// ---- Activity Log ----
function logActivity(type, text) {
    const user = document.getElementById('currentUser').value;
    DATA.activityLog.unshift({
        id: generateId(),
        type,
        text,
        user,
        date: new Date().toISOString()
    });
    if (DATA.activityLog.length > 50) DATA.activityLog.length = 50;
    saveData();
}

// ---- Toast Notifications ----
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- Filtering ----
function getFilterMonth() {
    const v = document.getElementById('filterMonth').value;
    return v === '' ? null : parseInt(v);
}

function getFilterYear() {
    return parseInt(document.getElementById('filterYear').value);
}

function matchesFilter(dateStr) {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    const year = getFilterYear();
    const month = getFilterMonth();
    if (d.getFullYear() !== year) return false;
    if (month !== null && d.getMonth() !== month) return false;
    return true;
}

// ---- Navigation ----
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const topbarTitle = document.getElementById('topbarTitle');
    const titles = {
        dashboard: 'لوحة التحكم',
        products: 'إدارة المنتجات',
        expenses: 'المصاريف',
        income: 'المداخيل - تحصيل DHD',
        usd: 'سجل شراء الدولار',
        orders: 'الطلبيات',
        reports: 'التقارير'
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(tc => tc.classList.remove('active'));
            document.getElementById('tab-' + tab).classList.add('active');
            topbarTitle.textContent = titles[tab] || '';

            // Close sidebar on mobile
            document.getElementById('sidebar').classList.remove('open');

            // Refresh content
            if (tab === 'dashboard') refreshDashboard();
            if (tab === 'reports') refreshReports();
        });
    });

    // Sub-tabs (expenses)
    document.querySelectorAll('.sub-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('.tab-content');
            parent.querySelectorAll('.sub-tab').forEach(s => s.classList.remove('active'));
            parent.querySelectorAll('.sub-content').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('subtab-' + btn.dataset.subtab).classList.add('active');
        });
    });

    // Report tabs
    document.querySelectorAll('.report-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.report-tab').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.report-content').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('report-' + btn.dataset.report).classList.add('active');
            refreshReports();
        });
    });

    // Mobile menu
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    document.getElementById('sidebarClose').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
    });

    // User switcher avatar
    document.getElementById('currentUser').addEventListener('change', function () {
        const avatar = document.getElementById('currentUserAvatar');
        avatar.textContent = this.value === 'كريم' ? 'ك' : 'ع';
    });

    // Filter changes
    document.getElementById('filterMonth').addEventListener('change', refreshAll);
    document.getElementById('filterYear').addEventListener('change', refreshAll);
}

// ---- Modal Management ----
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function initModals() {
    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    // Click overlay to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
}

// ==============================
//  SUPPLIERS
// ==============================
function renderSuppliers() {
    const list = document.getElementById('suppliersList');
    list.innerHTML = DATA.suppliers.map(s =>
        `<span class="supplier-tag">${s.name} <i class="fas fa-times delete-supplier" data-id="${s.id}"></i></span>`
    ).join('');

    list.querySelectorAll('.delete-supplier').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('حذف هذا المورد؟')) {
                DATA.suppliers = DATA.suppliers.filter(s => s.id !== btn.dataset.id);
                saveData();
                renderSuppliers();
                populateSupplierDropdowns();
                showToast('تم حذف المورد', 'info');
            }
        });
    });

    populateSupplierDropdowns();
}

function populateSupplierDropdowns() {
    const selects = [document.getElementById('productSupplier'), document.getElementById('goodsSupplier')];
    selects.forEach(sel => {
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">اختر المورد</option>' +
            DATA.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if (current) sel.value = current;
    });
}

function initSuppliers() {
    document.getElementById('btnAddSupplier').addEventListener('click', () => {
        document.getElementById('formSupplier').reset();
        openModal('modalSupplier');
    });

    document.getElementById('formSupplier').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('supplierName').value.trim();
        const phone = document.getElementById('supplierPhone').value.trim();
        if (!name) return;
        DATA.suppliers.push({ id: generateId(), name, phone });
        saveData();
        renderSuppliers();
        closeModal('modalSupplier');
        showToast('تم إضافة المورد بنجاح');
    });
}

// ==============================
//  PRODUCTS
// ==============================
function renderProducts() {
    const body = document.getElementById('productsBody');
    const empty = document.getElementById('productsEmpty');
    const products = DATA.products;

    if (products.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    body.innerHTML = products.map(p => {
        const supplier = DATA.suppliers.find(s => s.id === p.supplierId);
        const margin = p.sellPrice > 0 ? ((p.sellPrice - p.buyPrice - p.packagingCost) / p.sellPrice * 100) : 0;
        const marginClass = margin >= 30 ? 'margin-good' : margin >= 15 ? 'margin-ok' : 'margin-bad';
        return `<tr>
            <td><strong>${p.name}</strong></td>
            <td>${supplier ? supplier.name : '-'}</td>
            <td>${formatMoney(p.buyPrice)}</td>
            <td>${formatMoney(p.sellPrice)}</td>
            <td>${p.wholesalePrice ? formatMoney(p.wholesalePrice) : '-'}</td>
            <td>${formatMoney(p.packagingCost)}</td>
            <td><strong>${p.stock}</strong></td>
            <td><span class="${marginClass}">${formatPercent(margin)}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" data-id="${p.id}" data-type="product"><i class="fas fa-pen"></i></button>
                    <button class="btn-delete" data-id="${p.id}" data-type="product"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    attachTableActions(body);
}

function populateProductDropdowns() {
    const selects = [document.getElementById('goodsProduct'), document.getElementById('orderProduct')];
    selects.forEach(sel => {
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">اختر المنتج</option>' +
            DATA.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        if (current) sel.value = current;
    });
}

function initProducts() {
    document.getElementById('btnAddProduct').addEventListener('click', () => {
        document.getElementById('formProduct').reset();
        document.getElementById('productId').value = '';
        document.getElementById('modalProductTitle').textContent = 'إضافة منتج';
        openModal('modalProduct');
    });

    document.getElementById('formProduct').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const obj = {
            id: id || generateId(),
            name: document.getElementById('productName').value.trim(),
            supplierId: document.getElementById('productSupplier').value,
            buyPrice: parseFloat(document.getElementById('productBuyPrice').value) || 0,
            sellPrice: parseFloat(document.getElementById('productSellPrice').value) || 0,
            wholesalePrice: parseFloat(document.getElementById('productWholesalePrice').value) || 0,
            packagingCost: parseFloat(document.getElementById('productPackagingCost').value) || 0,
            stock: parseInt(document.getElementById('productStock').value) || 0
        };

        if (id) {
            const idx = DATA.products.findIndex(p => p.id === id);
            if (idx !== -1) DATA.products[idx] = obj;
            logActivity('order', `تعديل منتج: ${obj.name}`);
        } else {
            DATA.products.push(obj);
            logActivity('order', `إضافة منتج جديد: ${obj.name}`);
        }

        saveData();
        renderProducts();
        populateProductDropdowns();
        closeModal('modalProduct');
        showToast(id ? 'تم تعديل المنتج' : 'تم إضافة المنتج بنجاح');
    });
}

function editProduct(id) {
    const p = DATA.products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('productId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productSupplier').value = p.supplierId;
    document.getElementById('productBuyPrice').value = p.buyPrice;
    document.getElementById('productSellPrice').value = p.sellPrice;
    document.getElementById('productWholesalePrice').value = p.wholesalePrice || '';
    document.getElementById('productPackagingCost').value = p.packagingCost;
    document.getElementById('productStock').value = p.stock;
    document.getElementById('modalProductTitle').textContent = 'تعديل منتج';
    openModal('modalProduct');
}

// ==============================
//  ADS EXPENSES
// ==============================
function renderAds() {
    const body = document.getElementById('adsBody');
    const empty = document.getElementById('adsEmpty');
    const filtered = DATA.ads.filter(a => matchesFilter(a.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(a => {
            const dzd = a.amountUSD * a.exchangeRate;
            const platformClass = a.platform === 'Facebook' ? 'platform-facebook' : 'platform-tiktok';
            const platformIcon = a.platform === 'Facebook' ? 'fab fa-facebook' : 'fab fa-tiktok';
            return `<tr>
                <td>${a.date}</td>
                <td><span class="${platformClass}"><i class="${platformIcon}"></i> ${a.platform}</span></td>
                <td>${formatUSD(a.amountUSD)}</td>
                <td>${formatMoney(a.exchangeRate)}</td>
                <td>${formatMoney(dzd)}</td>
                <td>${a.notes || '-'}</td>
                <td>${a.user || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" data-id="${a.id}" data-type="ad"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete" data-id="${a.id}" data-type="ad"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        attachTableActions(body);
    }

    let totalDZD = 0, totalUSD = 0;
    filtered.forEach(a => { totalUSD += a.amountUSD; totalDZD += a.amountUSD * a.exchangeRate; });
    document.getElementById('adsTotalDZD').textContent = formatMoney(totalDZD);
    document.getElementById('adsTotalUSD').textContent = formatUSD(totalUSD);
}

function initAds() {
    document.getElementById('btnAddAd').addEventListener('click', () => {
        document.getElementById('formAd').reset();
        document.getElementById('adId').value = '';
        document.getElementById('adDate').value = today();
        document.getElementById('adAmountDZD').textContent = '0 د.ج';
        document.getElementById('modalAdTitle').textContent = 'إضافة مصروف إعلان';
        openModal('modalAd');
    });

    // Live calculate DZD
    const calcAdDZD = () => {
        const usd = parseFloat(document.getElementById('adAmountUSD').value) || 0;
        const rate = parseFloat(document.getElementById('adExchangeRate').value) || 0;
        document.getElementById('adAmountDZD').textContent = formatMoney(usd * rate);
    };
    document.getElementById('adAmountUSD').addEventListener('input', calcAdDZD);
    document.getElementById('adExchangeRate').addEventListener('input', calcAdDZD);

    document.getElementById('formAd').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('adId').value;
        const user = document.getElementById('currentUser').value;
        const obj = {
            id: id || generateId(),
            date: document.getElementById('adDate').value,
            platform: document.getElementById('adPlatform').value,
            amountUSD: parseFloat(document.getElementById('adAmountUSD').value) || 0,
            exchangeRate: parseFloat(document.getElementById('adExchangeRate').value) || 0,
            notes: document.getElementById('adNotes').value.trim(),
            user
        };

        if (id) {
            const idx = DATA.ads.findIndex(a => a.id === id);
            if (idx !== -1) DATA.ads[idx] = obj;
        } else {
            DATA.ads.push(obj);
            logActivity('expense', `مصروف إعلان ${obj.platform}: ${formatUSD(obj.amountUSD)}`);
        }

        saveData();
        renderAds();
        closeModal('modalAd');
        showToast(id ? 'تم التعديل' : 'تم إضافة مصروف الإعلان');
    });
}

function editAd(id) {
    const a = DATA.ads.find(x => x.id === id);
    if (!a) return;
    document.getElementById('adId').value = a.id;
    document.getElementById('adDate').value = a.date;
    document.getElementById('adPlatform').value = a.platform;
    document.getElementById('adAmountUSD').value = a.amountUSD;
    document.getElementById('adExchangeRate').value = a.exchangeRate;
    document.getElementById('adNotes').value = a.notes || '';
    document.getElementById('adAmountDZD').textContent = formatMoney(a.amountUSD * a.exchangeRate);
    document.getElementById('modalAdTitle').textContent = 'تعديل مصروف إعلان';
    openModal('modalAd');
}

// ==============================
//  GOODS EXPENSES
// ==============================
function renderGoods() {
    const body = document.getElementById('goodsBody');
    const empty = document.getElementById('goodsEmpty');
    const filtered = DATA.goods.filter(g => matchesFilter(g.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(g => {
            const supplier = DATA.suppliers.find(s => s.id === g.supplierId);
            const product = DATA.products.find(p => p.id === g.productId);
            const total = g.qty * g.unitPrice;
            return `<tr>
                <td>${g.date}</td>
                <td>${supplier ? supplier.name : '-'}</td>
                <td>${product ? product.name : g.productName || '-'}</td>
                <td>${g.qty}</td>
                <td>${formatMoney(g.unitPrice)}</td>
                <td><strong>${formatMoney(total)}</strong></td>
                <td>${g.user || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" data-id="${g.id}" data-type="goods"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete" data-id="${g.id}" data-type="goods"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        attachTableActions(body);
    }

    let total = 0;
    filtered.forEach(g => total += g.qty * g.unitPrice);
    document.getElementById('goodsTotal').textContent = formatMoney(total);
}

function initGoods() {
    document.getElementById('btnAddGoods').addEventListener('click', () => {
        document.getElementById('formGoods').reset();
        document.getElementById('goodsId').value = '';
        document.getElementById('goodsDate').value = today();
        document.getElementById('goodsTotalCalc').textContent = '0 د.ج';
        document.getElementById('modalGoodsTitle').textContent = 'إضافة شراء سلع';
        openModal('modalGoods');
    });

    const calcGoodsTotal = () => {
        const qty = parseFloat(document.getElementById('goodsQty').value) || 0;
        const price = parseFloat(document.getElementById('goodsUnitPrice').value) || 0;
        document.getElementById('goodsTotalCalc').textContent = formatMoney(qty * price);
    };
    document.getElementById('goodsQty').addEventListener('input', calcGoodsTotal);
    document.getElementById('goodsUnitPrice').addEventListener('input', calcGoodsTotal);

    document.getElementById('formGoods').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('goodsId').value;
        const user = document.getElementById('currentUser').value;
        const product = DATA.products.find(p => p.id === document.getElementById('goodsProduct').value);
        const obj = {
            id: id || generateId(),
            date: document.getElementById('goodsDate').value,
            supplierId: document.getElementById('goodsSupplier').value,
            productId: document.getElementById('goodsProduct').value,
            productName: product ? product.name : '',
            qty: parseInt(document.getElementById('goodsQty').value) || 0,
            unitPrice: parseFloat(document.getElementById('goodsUnitPrice').value) || 0,
            user
        };

        if (id) {
            const idx = DATA.goods.findIndex(g => g.id === id);
            if (idx !== -1) DATA.goods[idx] = obj;
        } else {
            DATA.goods.push(obj);
            // Update stock
            if (product) {
                product.stock = (product.stock || 0) + obj.qty;
                saveData();
            }
            logActivity('expense', `شراء سلع: ${obj.productName} × ${obj.qty}`);
        }

        saveData();
        renderGoods();
        renderProducts();
        closeModal('modalGoods');
        showToast(id ? 'تم التعديل' : 'تم إضافة عملية الشراء');
    });
}

function editGoods(id) {
    const g = DATA.goods.find(x => x.id === id);
    if (!g) return;
    document.getElementById('goodsId').value = g.id;
    document.getElementById('goodsDate').value = g.date;
    document.getElementById('goodsSupplier').value = g.supplierId;
    document.getElementById('goodsProduct').value = g.productId;
    document.getElementById('goodsQty').value = g.qty;
    document.getElementById('goodsUnitPrice').value = g.unitPrice;
    document.getElementById('goodsTotalCalc').textContent = formatMoney(g.qty * g.unitPrice);
    document.getElementById('modalGoodsTitle').textContent = 'تعديل شراء سلع';
    openModal('modalGoods');
}

// ==============================
//  PACKAGING EXPENSES
// ==============================
function renderPackaging() {
    const body = document.getElementById('packagingBody');
    const empty = document.getElementById('packagingEmpty');
    const filtered = DATA.packaging.filter(p => matchesFilter(p.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(p => `<tr>
            <td>${p.date}</td>
            <td>${p.type}</td>
            <td>${p.qty}</td>
            <td><strong>${formatMoney(p.amount)}</strong></td>
            <td>${p.user || '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" data-id="${p.id}" data-type="packaging"><i class="fas fa-pen"></i></button>
                    <button class="btn-delete" data-id="${p.id}" data-type="packaging"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
        attachTableActions(body);
    }

    let total = 0;
    filtered.forEach(p => total += p.amount);
    document.getElementById('packagingTotal').textContent = formatMoney(total);
}

function initPackaging() {
    document.getElementById('btnAddPackaging').addEventListener('click', () => {
        document.getElementById('formPackaging').reset();
        document.getElementById('packagingId').value = '';
        document.getElementById('packagingDate').value = today();
        document.getElementById('modalPackagingTitle').textContent = 'إضافة مصروف تغليف';
        openModal('modalPackaging');
    });

    document.getElementById('formPackaging').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('packagingId').value;
        const user = document.getElementById('currentUser').value;
        const obj = {
            id: id || generateId(),
            date: document.getElementById('packagingDate').value,
            type: document.getElementById('packagingType').value.trim(),
            qty: parseInt(document.getElementById('packagingQty').value) || 0,
            amount: parseFloat(document.getElementById('packagingAmount').value) || 0,
            user
        };

        if (id) {
            const idx = DATA.packaging.findIndex(p => p.id === id);
            if (idx !== -1) DATA.packaging[idx] = obj;
        } else {
            DATA.packaging.push(obj);
            logActivity('expense', `مصروف تغليف: ${formatMoney(obj.amount)}`);
        }

        saveData();
        renderPackaging();
        closeModal('modalPackaging');
        showToast(id ? 'تم التعديل' : 'تم إضافة مصروف التغليف');
    });
}

function editPackaging(id) {
    const p = DATA.packaging.find(x => x.id === id);
    if (!p) return;
    document.getElementById('packagingId').value = p.id;
    document.getElementById('packagingDate').value = p.date;
    document.getElementById('packagingType').value = p.type;
    document.getElementById('packagingQty').value = p.qty;
    document.getElementById('packagingAmount').value = p.amount;
    document.getElementById('modalPackagingTitle').textContent = 'تعديل مصروف تغليف';
    openModal('modalPackaging');
}

// ==============================
//  EMPLOYEE COMMISSION
// ==============================
function renderEmployee() {
    const body = document.getElementById('employeeBody');
    const empty = document.getElementById('employeeEmpty');
    const filtered = DATA.employee.filter(e => matchesFilter(e.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(e => {
            const total = e.orders * e.rate;
            return `<tr>
                <td>${e.date}</td>
                <td>${e.orders}</td>
                <td>${formatMoney(e.rate)}</td>
                <td><strong>${formatMoney(total)}</strong></td>
                <td>${e.user || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" data-id="${e.id}" data-type="employee"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete" data-id="${e.id}" data-type="employee"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        attachTableActions(body);
    }

    let total = 0;
    filtered.forEach(e => total += e.orders * e.rate);
    document.getElementById('employeeTotal').textContent = formatMoney(total);
}

function initEmployee() {
    document.getElementById('btnAddEmployee').addEventListener('click', () => {
        document.getElementById('formEmployee').reset();
        document.getElementById('employeeId').value = '';
        document.getElementById('employeeDate').value = today();
        document.getElementById('employeeTotalCalc').textContent = '0 د.ج';
        document.getElementById('modalEmployeeTitle').textContent = 'إضافة عمولة عامل';
        openModal('modalEmployee');
    });

    const calcEmpTotal = () => {
        const orders = parseFloat(document.getElementById('employeeOrders').value) || 0;
        const rate = parseFloat(document.getElementById('employeeRate').value) || 0;
        document.getElementById('employeeTotalCalc').textContent = formatMoney(orders * rate);
    };
    document.getElementById('employeeOrders').addEventListener('input', calcEmpTotal);
    document.getElementById('employeeRate').addEventListener('input', calcEmpTotal);

    document.getElementById('formEmployee').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('employeeId').value;
        const user = document.getElementById('currentUser').value;
        const obj = {
            id: id || generateId(),
            date: document.getElementById('employeeDate').value,
            orders: parseInt(document.getElementById('employeeOrders').value) || 0,
            rate: parseFloat(document.getElementById('employeeRate').value) || 0,
            user
        };

        if (id) {
            const idx = DATA.employee.findIndex(x => x.id === id);
            if (idx !== -1) DATA.employee[idx] = obj;
        } else {
            DATA.employee.push(obj);
            logActivity('expense', `عمولة عامل: ${obj.orders} طلب × ${formatMoney(obj.rate)}`);
        }

        saveData();
        renderEmployee();
        closeModal('modalEmployee');
        showToast(id ? 'تم التعديل' : 'تم إضافة العمولة');
    });
}

function editEmployee(id) {
    const e = DATA.employee.find(x => x.id === id);
    if (!e) return;
    document.getElementById('employeeId').value = e.id;
    document.getElementById('employeeDate').value = e.date;
    document.getElementById('employeeOrders').value = e.orders;
    document.getElementById('employeeRate').value = e.rate;
    document.getElementById('employeeTotalCalc').textContent = formatMoney(e.orders * e.rate);
    document.getElementById('modalEmployeeTitle').textContent = 'تعديل عمولة عامل';
    openModal('modalEmployee');
}

// ==============================
//  OTHER EXPENSES
// ==============================
function renderOther() {
    const body = document.getElementById('otherBody');
    const empty = document.getElementById('otherEmpty');
    const filtered = DATA.other.filter(o => matchesFilter(o.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(o => `<tr>
            <td>${o.date}</td>
            <td>${o.desc}</td>
            <td><strong>${formatMoney(o.amount)}</strong></td>
            <td>${o.user || '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" data-id="${o.id}" data-type="other"><i class="fas fa-pen"></i></button>
                    <button class="btn-delete" data-id="${o.id}" data-type="other"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
        attachTableActions(body);
    }

    let total = 0;
    filtered.forEach(o => total += o.amount);
    document.getElementById('otherTotal').textContent = formatMoney(total);
}

function initOther() {
    document.getElementById('btnAddOther').addEventListener('click', () => {
        document.getElementById('formOther').reset();
        document.getElementById('otherId').value = '';
        document.getElementById('otherDate').value = today();
        document.getElementById('modalOtherTitle').textContent = 'إضافة مصروف آخر';
        openModal('modalOther');
    });

    document.getElementById('formOther').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('otherId').value;
        const user = document.getElementById('currentUser').value;
        const obj = {
            id: id || generateId(),
            date: document.getElementById('otherDate').value,
            desc: document.getElementById('otherDesc').value.trim(),
            amount: parseFloat(document.getElementById('otherAmount').value) || 0,
            user
        };

        if (id) {
            const idx = DATA.other.findIndex(x => x.id === id);
            if (idx !== -1) DATA.other[idx] = obj;
        } else {
            DATA.other.push(obj);
            logActivity('expense', `مصروف آخر: ${obj.desc} - ${formatMoney(obj.amount)}`);
        }

        saveData();
        renderOther();
        closeModal('modalOther');
        showToast(id ? 'تم التعديل' : 'تم إضافة المصروف');
    });
}

function editOther(id) {
    const o = DATA.other.find(x => x.id === id);
    if (!o) return;
    document.getElementById('otherId').value = o.id;
    document.getElementById('otherDate').value = o.date;
    document.getElementById('otherDesc').value = o.desc;
    document.getElementById('otherAmount').value = o.amount;
    document.getElementById('modalOtherTitle').textContent = 'تعديل مصروف آخر';
    openModal('modalOther');
}

// ==============================
//  INCOME (DHD)
// ==============================
function renderIncome() {
    const body = document.getElementById('incomeBody');
    const empty = document.getElementById('incomeEmpty');
    const filtered = DATA.income.filter(i => matchesFilter(i.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(i => {
            const deliveryRate = i.delivered > 0 ? (i.delivered / (i.delivered + i.returned) * 100) : 0;
            return `<tr>
                <td>${i.date}</td>
                <td><strong>${formatMoney(i.amount)}</strong></td>
                <td>${i.delivered}</td>
                <td>${i.returned}</td>
                <td><span class="${deliveryRate >= 70 ? 'margin-good' : deliveryRate >= 50 ? 'margin-ok' : 'margin-bad'}">${formatPercent(deliveryRate)}</span></td>
                <td>${i.notes || '-'}</td>
                <td>${i.user || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" data-id="${i.id}" data-type="income"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete" data-id="${i.id}" data-type="income"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        attachTableActions(body);
    }

    let totalAmount = 0, totalParcels = 0;
    filtered.forEach(i => { totalAmount += i.amount; totalParcels += i.delivered; });
    document.getElementById('incomeTotal').textContent = formatMoney(totalAmount);
    document.getElementById('incomeParcels').textContent = totalParcels + ' طرد موصل';
}

function initIncome() {
    document.getElementById('btnAddIncome').addEventListener('click', () => {
        document.getElementById('formIncome').reset();
        document.getElementById('incomeId').value = '';
        document.getElementById('incomeDate').value = today();
        document.getElementById('modalIncomeTitle').textContent = 'إضافة تحصيل DHD';
        openModal('modalIncome');
    });

    document.getElementById('formIncome').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('incomeId').value;
        const user = document.getElementById('currentUser').value;
        const obj = {
            id: id || generateId(),
            date: document.getElementById('incomeDate').value,
            amount: parseFloat(document.getElementById('incomeAmount').value) || 0,
            delivered: parseInt(document.getElementById('incomeDelivered').value) || 0,
            returned: parseInt(document.getElementById('incomeReturned').value) || 0,
            notes: document.getElementById('incomeNotes').value.trim(),
            user
        };

        if (id) {
            const idx = DATA.income.findIndex(x => x.id === id);
            if (idx !== -1) DATA.income[idx] = obj;
        } else {
            DATA.income.push(obj);
            logActivity('income', `تحصيل DHD: ${formatMoney(obj.amount)} (${obj.delivered} طرد)`);
        }

        saveData();
        renderIncome();
        closeModal('modalIncome');
        showToast(id ? 'تم التعديل' : 'تم إضافة التحصيل');
    });
}

function editIncome(id) {
    const i = DATA.income.find(x => x.id === id);
    if (!i) return;
    document.getElementById('incomeId').value = i.id;
    document.getElementById('incomeDate').value = i.date;
    document.getElementById('incomeAmount').value = i.amount;
    document.getElementById('incomeDelivered').value = i.delivered;
    document.getElementById('incomeReturned').value = i.returned;
    document.getElementById('incomeNotes').value = i.notes || '';
    document.getElementById('modalIncomeTitle').textContent = 'تعديل تحصيل DHD';
    openModal('modalIncome');
}

// ==============================
//  USD PURCHASES
// ==============================
function renderUsd() {
    const body = document.getElementById('usdBody');
    const empty = document.getElementById('usdEmpty');
    const filtered = DATA.usd.filter(u => matchesFilter(u.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(u => {
            const rate = u.amountUSD > 0 ? (u.amountDZD / u.amountUSD) : 0;
            return `<tr>
                <td>${u.date}</td>
                <td>${formatMoney(u.amountDZD)}</td>
                <td>${formatUSD(u.amountUSD)}</td>
                <td>${formatMoney(rate)}</td>
                <td>${u.notes || '-'}</td>
                <td>${u.user || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" data-id="${u.id}" data-type="usd"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete" data-id="${u.id}" data-type="usd"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        attachTableActions(body);
    }

    let totalDZD = 0, totalUSD = 0;
    filtered.forEach(u => { totalDZD += u.amountDZD; totalUSD += u.amountUSD; });
    document.getElementById('usdTotalBought').textContent = formatUSD(totalUSD);
    document.getElementById('usdTotalPaidDZD').textContent = formatMoney(totalDZD);
    document.getElementById('usdAvgRate').textContent = totalUSD > 0 ? formatMoney(totalDZD / totalUSD) + '/$' : '0 د.ج/$';
}

function initUsd() {
    document.getElementById('btnAddUsd').addEventListener('click', () => {
        document.getElementById('formUsd').reset();
        document.getElementById('usdId').value = '';
        document.getElementById('usdDate').value = today();
        document.getElementById('usdRateCalc').textContent = '0 د.ج/$';
        document.getElementById('modalUsdTitle').textContent = 'إضافة عملية شراء دولار';
        openModal('modalUsd');
    });

    const calcUsdRate = () => {
        const dzd = parseFloat(document.getElementById('usdAmountDZD').value) || 0;
        const usd = parseFloat(document.getElementById('usdAmountUSD').value) || 0;
        const rate = usd > 0 ? dzd / usd : 0;
        document.getElementById('usdRateCalc').textContent = formatMoney(rate) + '/$';
    };
    document.getElementById('usdAmountDZD').addEventListener('input', calcUsdRate);
    document.getElementById('usdAmountUSD').addEventListener('input', calcUsdRate);

    document.getElementById('formUsd').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('usdId').value;
        const user = document.getElementById('currentUser').value;
        const obj = {
            id: id || generateId(),
            date: document.getElementById('usdDate').value,
            amountDZD: parseFloat(document.getElementById('usdAmountDZD').value) || 0,
            amountUSD: parseFloat(document.getElementById('usdAmountUSD').value) || 0,
            notes: document.getElementById('usdNotes').value.trim(),
            user
        };

        if (id) {
            const idx = DATA.usd.findIndex(x => x.id === id);
            if (idx !== -1) DATA.usd[idx] = obj;
        } else {
            DATA.usd.push(obj);
            logActivity('expense', `شراء دولار: ${formatUSD(obj.amountUSD)} بـ ${formatMoney(obj.amountDZD)}`);
        }

        saveData();
        renderUsd();
        closeModal('modalUsd');
        showToast(id ? 'تم التعديل' : 'تم إضافة عملية الشراء');
    });
}

function editUsd(id) {
    const u = DATA.usd.find(x => x.id === id);
    if (!u) return;
    document.getElementById('usdId').value = u.id;
    document.getElementById('usdDate').value = u.date;
    document.getElementById('usdAmountDZD').value = u.amountDZD;
    document.getElementById('usdAmountUSD').value = u.amountUSD;
    document.getElementById('usdNotes').value = u.notes || '';
    const rate = u.amountUSD > 0 ? u.amountDZD / u.amountUSD : 0;
    document.getElementById('usdRateCalc').textContent = formatMoney(rate) + '/$';
    document.getElementById('modalUsdTitle').textContent = 'تعديل عملية شراء دولار';
    openModal('modalUsd');
}

// ==============================
//  ORDERS
// ==============================
function renderOrders() {
    const body = document.getElementById('ordersBody');
    const empty = document.getElementById('ordersEmpty');
    const filtered = DATA.orders.filter(o => matchesFilter(o.date));

    if (filtered.length === 0) {
        body.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        body.innerHTML = filtered.map(o => {
            const product = DATA.products.find(p => p.id === o.productId);
            const total = o.qty * o.price;
            const statusMap = {
                'مؤكد': 'status-confirmed',
                'مشحون': 'status-shipped',
                'موصل': 'status-delivered',
                'مرجع': 'status-returned'
            };
            const saleClass = o.saleType === 'جملة' ? 'sale-wholesale' : 'sale-retail';
            return `<tr>
                <td>${o.date}</td>
                <td>${product ? product.name : o.productName || '-'}</td>
                <td>${o.qty}</td>
                <td><span class="${saleClass}">${o.saleType}</span></td>
                <td>${formatMoney(o.price)}</td>
                <td><strong>${formatMoney(total)}</strong></td>
                <td>${formatMoney(o.shipping)}</td>
                <td><span class="status-badge ${statusMap[o.status] || ''}">${o.status}</span></td>
                <td>${o.user || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-edit" data-id="${o.id}" data-type="order"><i class="fas fa-pen"></i></button>
                        <button class="btn-delete" data-id="${o.id}" data-type="order"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        attachTableActions(body);
    }

    // Order stats
    let confirmed = 0, shipped = 0, delivered = 0, returned = 0;
    filtered.forEach(o => {
        if (o.status === 'مؤكد') confirmed++;
        else if (o.status === 'مشحون') shipped++;
        else if (o.status === 'موصل') delivered++;
        else if (o.status === 'مرجع') returned++;
    });
    document.getElementById('ordersConfirmed').textContent = confirmed;
    document.getElementById('ordersShipped').textContent = shipped;
    document.getElementById('ordersDelivered').textContent = delivered;
    document.getElementById('ordersReturned').textContent = returned;
}

function initOrders() {
    document.getElementById('btnAddOrder').addEventListener('click', () => {
        document.getElementById('formOrder').reset();
        document.getElementById('orderId').value = '';
        document.getElementById('orderDate').value = today();
        document.getElementById('orderTotalCalc').textContent = '0 د.ج';
        document.getElementById('modalOrderTitle').textContent = 'إضافة طلبية';
        openModal('modalOrder');
    });

    // Auto-fill price based on product and sale type
    const autoFillPrice = () => {
        const productId = document.getElementById('orderProduct').value;
        const saleType = document.getElementById('orderType').value;
        const product = DATA.products.find(p => p.id === productId);
        if (product) {
            const price = saleType === 'جملة' && product.wholesalePrice ? product.wholesalePrice : product.sellPrice;
            document.getElementById('orderPrice').value = price;
            calcOrderTotal();
        }
    };
    document.getElementById('orderProduct').addEventListener('change', autoFillPrice);
    document.getElementById('orderType').addEventListener('change', autoFillPrice);

    const calcOrderTotal = () => {
        const qty = parseFloat(document.getElementById('orderQty').value) || 0;
        const price = parseFloat(document.getElementById('orderPrice').value) || 0;
        document.getElementById('orderTotalCalc').textContent = formatMoney(qty * price);
    };
    document.getElementById('orderQty').addEventListener('input', calcOrderTotal);
    document.getElementById('orderPrice').addEventListener('input', calcOrderTotal);

    document.getElementById('formOrder').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('orderId').value;
        const user = document.getElementById('currentUser').value;
        const product = DATA.products.find(p => p.id === document.getElementById('orderProduct').value);
        const obj = {
            id: id || generateId(),
            date: document.getElementById('orderDate').value,
            productId: document.getElementById('orderProduct').value,
            productName: product ? product.name : '',
            qty: parseInt(document.getElementById('orderQty').value) || 0,
            saleType: document.getElementById('orderType').value,
            price: parseFloat(document.getElementById('orderPrice').value) || 0,
            shipping: parseFloat(document.getElementById('orderShipping').value) || 0,
            status: document.getElementById('orderStatus').value,
            user
        };

        if (id) {
            const idx = DATA.orders.findIndex(x => x.id === id);
            if (idx !== -1) DATA.orders[idx] = obj;
        } else {
            DATA.orders.push(obj);
            // Decrease stock
            if (product) {
                product.stock = Math.max(0, (product.stock || 0) - obj.qty);
                saveData();
            }
            logActivity('order', `طلبية جديدة: ${obj.productName} × ${obj.qty} (${obj.saleType})`);
        }

        saveData();
        renderOrders();
        renderProducts();
        closeModal('modalOrder');
        showToast(id ? 'تم التعديل' : 'تم إضافة الطلبية');
    });
}

function editOrder(id) {
    const o = DATA.orders.find(x => x.id === id);
    if (!o) return;
    document.getElementById('orderId').value = o.id;
    document.getElementById('orderDate').value = o.date;
    document.getElementById('orderProduct').value = o.productId;
    document.getElementById('orderQty').value = o.qty;
    document.getElementById('orderType').value = o.saleType;
    document.getElementById('orderPrice').value = o.price;
    document.getElementById('orderShipping').value = o.shipping;
    document.getElementById('orderStatus').value = o.status;
    document.getElementById('orderTotalCalc').textContent = formatMoney(o.qty * o.price);
    document.getElementById('modalOrderTitle').textContent = 'تعديل طلبية';
    openModal('modalOrder');
}

// ==============================
//  DELETE HANDLER
// ==============================
let deleteTarget = null;

function initDelete() {
    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
        if (!deleteTarget) return;
        const { type, id } = deleteTarget;
        const dataMap = {
            product: 'products',
            ad: 'ads',
            goods: 'goods',
            packaging: 'packaging',
            employee: 'employee',
            other: 'other',
            income: 'income',
            usd: 'usd',
            order: 'orders'
        };
        const key = dataMap[type];
        if (key) {
            DATA[key] = DATA[key].filter(item => item.id !== id);
            saveData();
            refreshAll();
            showToast('تم الحذف بنجاح', 'info');
        }
        closeModal('modalDelete');
        deleteTarget = null;
    });
}

function attachTableActions(container) {
    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const { id, type } = btn.dataset;
            const editMap = {
                product: editProduct,
                ad: editAd,
                goods: editGoods,
                packaging: editPackaging,
                employee: editEmployee,
                other: editOther,
                income: editIncome,
                usd: editUsd,
                order: editOrder
            };
            if (editMap[type]) editMap[type](id);
        });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteTarget = { type: btn.dataset.type, id: btn.dataset.id };
            openModal('modalDelete');
        });
    });
}

// ==============================
//  DASHBOARD
// ==============================
let chartIncomeVsExpense = null;
let chartExpenseBreakdown = null;
let chartProductPerformance = null;
let chartDailyProfit = null;

function getExpenseTotals() {
    const filtered = {
        ads: DATA.ads.filter(a => matchesFilter(a.date)),
        goods: DATA.goods.filter(g => matchesFilter(g.date)),
        packaging: DATA.packaging.filter(p => matchesFilter(p.date)),
        employee: DATA.employee.filter(e => matchesFilter(e.date)),
        other: DATA.other.filter(o => matchesFilter(o.date))
    };

    let adsTotal = 0;
    filtered.ads.forEach(a => adsTotal += a.amountUSD * a.exchangeRate);

    let goodsTotal = 0;
    filtered.goods.forEach(g => goodsTotal += g.qty * g.unitPrice);

    let packagingTotal = 0;
    filtered.packaging.forEach(p => packagingTotal += p.amount);

    let employeeTotal = 0;
    filtered.employee.forEach(e => employeeTotal += e.orders * e.rate);

    let otherTotal = 0;
    filtered.other.forEach(o => otherTotal += o.amount);

    return { adsTotal, goodsTotal, packagingTotal, employeeTotal, otherTotal };
}

function refreshDashboard() {
    const expenses = getExpenseTotals();
    const totalExpenses = expenses.adsTotal + expenses.goodsTotal + expenses.packagingTotal + expenses.employeeTotal + expenses.otherTotal;

    const filteredIncome = DATA.income.filter(i => matchesFilter(i.date));
    let totalIncome = 0, totalDelivered = 0, totalReturned = 0;
    filteredIncome.forEach(i => {
        totalIncome += i.amount;
        totalDelivered += i.delivered;
        totalReturned += i.returned;
    });

    const netProfit = totalIncome - totalExpenses;
    const roas = expenses.adsTotal > 0 ? (totalIncome / expenses.adsTotal) : 0;
    const returnRate = (totalDelivered + totalReturned) > 0 ? (totalReturned / (totalDelivered + totalReturned) * 100) : 0;

    // Filtered shipped orders
    const filteredOrders = DATA.orders.filter(o => matchesFilter(o.date));
    const shippedOrders = filteredOrders.filter(o => o.status === 'مشحون' || o.status === 'موصل').length;

    // Update stat cards
    document.getElementById('statTotalIncome').textContent = formatMoney(totalIncome);
    document.getElementById('statTotalExpenses').textContent = formatMoney(totalExpenses);
    document.getElementById('statNetProfit').textContent = formatMoney(netProfit);
    document.getElementById('statNetProfit').style.color = netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    document.getElementById('statROAS').textContent = roas.toFixed(2) + 'x';
    document.getElementById('statShippedOrders').textContent = shippedOrders;
    document.getElementById('statReturnRate').textContent = formatPercent(returnRate);

    // Charts
    renderIncomeVsExpenseChart();
    renderExpenseBreakdownChart(expenses);
    renderProductPerformanceChart();
    renderDailyProfitChart();

    // Recent activity
    renderRecentActivity();
}

function renderIncomeVsExpenseChart() {
    const ctx = document.getElementById('chartIncomeVsExpense').getContext('2d');
    const year = getFilterYear();

    const monthlyIncome = new Array(12).fill(0);
    const monthlyExpense = new Array(12).fill(0);

    DATA.income.forEach(i => {
        const d = new Date(i.date);
        if (d.getFullYear() === year) monthlyIncome[d.getMonth()] += i.amount;
    });

    DATA.ads.forEach(a => {
        const d = new Date(a.date);
        if (d.getFullYear() === year) monthlyExpense[d.getMonth()] += a.amountUSD * a.exchangeRate;
    });
    DATA.goods.forEach(g => {
        const d = new Date(g.date);
        if (d.getFullYear() === year) monthlyExpense[d.getMonth()] += g.qty * g.unitPrice;
    });
    DATA.packaging.forEach(p => {
        const d = new Date(p.date);
        if (d.getFullYear() === year) monthlyExpense[d.getMonth()] += p.amount;
    });
    DATA.employee.forEach(e => {
        const d = new Date(e.date);
        if (d.getFullYear() === year) monthlyExpense[d.getMonth()] += e.orders * e.rate;
    });
    DATA.other.forEach(o => {
        const d = new Date(o.date);
        if (d.getFullYear() === year) monthlyExpense[d.getMonth()] += o.amount;
    });

    const labels = Array.from({ length: 12 }, (_, i) => getMonthName(i));

    if (chartIncomeVsExpense) chartIncomeVsExpense.destroy();
    chartIncomeVsExpense = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'المداخيل',
                    data: monthlyIncome,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'المصاريف',
                    data: monthlyExpense,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#8899b4', font: { family: 'Cairo' } } }
            },
            scales: {
                x: { ticks: { color: '#5a6a84', font: { family: 'Cairo' } }, grid: { color: 'rgba(42,53,80,0.5)' } },
                y: { ticks: { color: '#5a6a84', font: { family: 'Cairo' } }, grid: { color: 'rgba(42,53,80,0.5)' } }
            }
        }
    });
}

function renderExpenseBreakdownChart(expenses) {
    const ctx = document.getElementById('chartExpenseBreakdown').getContext('2d');

    if (chartExpenseBreakdown) chartExpenseBreakdown.destroy();
    chartExpenseBreakdown = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['إعلانات', 'سلع', 'تغليف', 'عمولة عامل', 'أخرى'],
            datasets: [{
                data: [expenses.adsTotal, expenses.goodsTotal, expenses.packagingTotal, expenses.employeeTotal, expenses.otherTotal],
                backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444'],
                borderColor: '#1a2235',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#8899b4', font: { family: 'Cairo' }, padding: 16 }
                }
            },
            cutout: '65%'
        }
    });
}

function renderProductPerformanceChart() {
    const ctx = document.getElementById('chartProductPerformance').getContext('2d');
    const filteredOrders = DATA.orders.filter(o => matchesFilter(o.date) && o.status !== 'مرجع');

    const productSales = {};
    filteredOrders.forEach(o => {
        const name = o.productName || 'غير محدد';
        if (!productSales[name]) productSales[name] = 0;
        productSales[name] += o.qty * o.price;
    });

    const labels = Object.keys(productSales);
    const data = Object.values(productSales);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

    if (chartProductPerformance) chartProductPerformance.destroy();
    chartProductPerformance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['لا توجد بيانات'],
            datasets: [{
                label: 'المبيعات (DZD)',
                data: data.length ? data : [0],
                backgroundColor: colors.slice(0, labels.length || 1),
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: '#5a6a84', font: { family: 'Cairo' } }, grid: { display: false } },
                y: { ticks: { color: '#5a6a84', font: { family: 'Cairo' } }, grid: { color: 'rgba(42,53,80,0.5)' } }
            }
        }
    });
}

function renderDailyProfitChart() {
    const ctx = document.getElementById('chartDailyProfit').getContext('2d');
    const year = getFilterYear();
    const month = getFilterMonth();

    // Gather daily data for the selected period
    const dailyData = {};

    DATA.income.forEach(i => {
        const d = new Date(i.date);
        if (d.getFullYear() !== year) return;
        if (month !== null && d.getMonth() !== month) return;
        const key = i.date;
        if (!dailyData[key]) dailyData[key] = { income: 0, expense: 0 };
        dailyData[key].income += i.amount;
    });

    const addExpense = (arr, getAmount) => {
        arr.forEach(item => {
            const d = new Date(item.date);
            if (d.getFullYear() !== year) return;
            if (month !== null && d.getMonth() !== month) return;
            const key = item.date;
            if (!dailyData[key]) dailyData[key] = { income: 0, expense: 0 };
            dailyData[key].expense += getAmount(item);
        });
    };

    addExpense(DATA.ads, a => a.amountUSD * a.exchangeRate);
    addExpense(DATA.goods, g => g.qty * g.unitPrice);
    addExpense(DATA.packaging, p => p.amount);
    addExpense(DATA.employee, e => e.orders * e.rate);
    addExpense(DATA.other, o => o.amount);

    const sortedDays = Object.keys(dailyData).sort();
    const profits = sortedDays.map(d => dailyData[d].income - dailyData[d].expense);

    if (chartDailyProfit) chartDailyProfit.destroy();
    chartDailyProfit = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedDays.length ? sortedDays : ['لا توجد بيانات'],
            datasets: [{
                label: 'الربح اليومي',
                data: profits.length ? profits : [0],
                backgroundColor: profits.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#5a6a84', font: { family: 'Cairo', size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#5a6a84', font: { family: 'Cairo' } }, grid: { color: 'rgba(42,53,80,0.5)' } }
            }
        }
    });
}

function renderRecentActivity() {
    const list = document.getElementById('recentActivityList');
    if (DATA.activityLog.length === 0) {
        list.innerHTML = '<p class="empty-state">لا توجد عمليات بعد</p>';
        return;
    }

    list.innerHTML = DATA.activityLog.slice(0, 15).map(a => {
        const iconClass = a.type === 'income' ? 'income' : a.type === 'expense' ? 'expense' : 'order';
        const iconMap = { income: 'fa-arrow-down', expense: 'fa-arrow-up', order: 'fa-shopping-cart' };
        const timeAgo = getTimeAgo(a.date);
        return `<div class="activity-item">
            <div class="activity-icon ${iconClass}"><i class="fas ${iconMap[a.type] || 'fa-circle'}"></i></div>
            <div class="activity-text">${a.text} <small style="color:var(--text-muted)">- ${a.user}</small></div>
            <span class="activity-date">${timeAgo}</span>
        </div>`;
    }).join('');
}

function getTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return Math.floor(diff / 60) + ' دقيقة';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ساعة';
    return Math.floor(diff / 86400) + ' يوم';
}

// ==============================
//  REPORTS
// ==============================
function refreshReports() {
    renderMonthlyReport();
    renderWeeklyReport();
    renderProductReport();
    renderBreakevenReport();
}

function renderMonthlyReport() {
    const grid = document.getElementById('monthlyReportGrid');
    const expenses = getExpenseTotals();
    const totalExpenses = expenses.adsTotal + expenses.goodsTotal + expenses.packagingTotal + expenses.employeeTotal + expenses.otherTotal;

    const filteredIncome = DATA.income.filter(i => matchesFilter(i.date));
    let totalIncome = 0, totalDelivered = 0, totalReturned = 0;
    filteredIncome.forEach(i => { totalIncome += i.amount; totalDelivered += i.delivered; totalReturned += i.returned; });

    const netProfit = totalIncome - totalExpenses;
    const roas = expenses.adsTotal > 0 ? totalIncome / expenses.adsTotal : 0;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome * 100) : 0;
    const returnRate = (totalDelivered + totalReturned) > 0 ? (totalReturned / (totalDelivered + totalReturned) * 100) : 0;

    // Facebook vs TikTok
    const filteredAds = DATA.ads.filter(a => matchesFilter(a.date));
    let fbTotal = 0, ttTotal = 0;
    filteredAds.forEach(a => {
        if (a.platform === 'Facebook') fbTotal += a.amountUSD * a.exchangeRate;
        else ttTotal += a.amountUSD * a.exchangeRate;
    });

    const fbROAS = fbTotal > 0 ? totalIncome / fbTotal : 0;
    const ttROAS = ttTotal > 0 ? totalIncome / ttTotal : 0;

    grid.innerHTML = `
        <div class="report-item">
            <span class="report-item-label">إجمالي المداخيل</span>
            <span class="report-item-value positive">${formatMoney(totalIncome)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">إجمالي المصاريف</span>
            <span class="report-item-value negative">${formatMoney(totalExpenses)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">الربح الصافي</span>
            <span class="report-item-value ${netProfit >= 0 ? 'positive' : 'negative'}">${formatMoney(netProfit)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">هامش الربح</span>
            <span class="report-item-value ${profitMargin >= 20 ? 'positive' : 'negative'}">${formatPercent(profitMargin)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">مصاريف الإعلانات</span>
            <span class="report-item-value negative">${formatMoney(expenses.adsTotal)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">مصاريف السلع</span>
            <span class="report-item-value negative">${formatMoney(expenses.goodsTotal)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">مصاريف التغليف</span>
            <span class="report-item-value negative">${formatMoney(expenses.packagingTotal)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">عمولة العامل</span>
            <span class="report-item-value negative">${formatMoney(expenses.employeeTotal)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">مصاريف أخرى</span>
            <span class="report-item-value negative">${formatMoney(expenses.otherTotal)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">ROAS إجمالي</span>
            <span class="report-item-value neutral">${roas.toFixed(2)}x</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">ROAS Facebook</span>
            <span class="report-item-value neutral">${fbROAS.toFixed(2)}x</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">ROAS TikTok</span>
            <span class="report-item-value neutral">${ttROAS.toFixed(2)}x</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">طرود موصلة</span>
            <span class="report-item-value positive">${totalDelivered}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">طرود مرجعة</span>
            <span class="report-item-value negative">${totalReturned}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">نسبة الرجوع</span>
            <span class="report-item-value ${returnRate <= 20 ? 'positive' : 'negative'}">${formatPercent(returnRate)}</span>
        </div>
    `;
}

function renderWeeklyReport() {
    const grid = document.getElementById('weeklyReportGrid');

    // Get current week data
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const inThisWeek = (dateStr) => {
        const d = new Date(dateStr);
        return d >= weekStart;
    };

    let weekIncome = 0, weekExpenses = 0;

    DATA.income.filter(i => inThisWeek(i.date)).forEach(i => weekIncome += i.amount);

    DATA.ads.filter(a => inThisWeek(a.date)).forEach(a => weekExpenses += a.amountUSD * a.exchangeRate);
    DATA.goods.filter(g => inThisWeek(g.date)).forEach(g => weekExpenses += g.qty * g.unitPrice);
    DATA.packaging.filter(p => inThisWeek(p.date)).forEach(p => weekExpenses += p.amount);
    DATA.employee.filter(e => inThisWeek(e.date)).forEach(e => weekExpenses += e.orders * e.rate);
    DATA.other.filter(o => inThisWeek(o.date)).forEach(o => weekExpenses += o.amount);

    const weekProfit = weekIncome - weekExpenses;
    const weekOrders = DATA.orders.filter(o => inThisWeek(o.date)).length;

    grid.innerHTML = `
        <div class="report-item">
            <span class="report-item-label">مداخيل هذا الأسبوع</span>
            <span class="report-item-value positive">${formatMoney(weekIncome)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">مصاريف هذا الأسبوع</span>
            <span class="report-item-value negative">${formatMoney(weekExpenses)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">ربح هذا الأسبوع</span>
            <span class="report-item-value ${weekProfit >= 0 ? 'positive' : 'negative'}">${formatMoney(weekProfit)}</span>
        </div>
        <div class="report-item">
            <span class="report-item-label">طلبيات هذا الأسبوع</span>
            <span class="report-item-value neutral">${weekOrders}</span>
        </div>
    `;
}

function renderProductReport() {
    const body = document.getElementById('productReportBody');
    const filteredOrders = DATA.orders.filter(o => matchesFilter(o.date) && o.status !== 'مرجع');

    const productData = {};
    filteredOrders.forEach(o => {
        const pid = o.productId || 'unknown';
        if (!productData[pid]) {
            productData[pid] = {
                name: o.productName || 'غير محدد',
                qtySold: 0,
                totalSales: 0,
                totalCost: 0
            };
        }
        productData[pid].qtySold += o.qty;
        productData[pid].totalSales += o.qty * o.price;

        // Get cost from product
        const product = DATA.products.find(p => p.id === pid);
        if (product) {
            productData[pid].totalCost += o.qty * (product.buyPrice + product.packagingCost);
        }
    });

    const rows = Object.values(productData);
    if (rows.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد بيانات مبيعات</td></tr>';
        return;
    }

    body.innerHTML = rows.map(r => {
        const profit = r.totalSales - r.totalCost;
        const margin = r.totalSales > 0 ? (profit / r.totalSales * 100) : 0;
        const marginClass = margin >= 30 ? 'margin-good' : margin >= 15 ? 'margin-ok' : 'margin-bad';
        return `<tr>
            <td><strong>${r.name}</strong></td>
            <td>${r.qtySold}</td>
            <td>${formatMoney(r.totalSales)}</td>
            <td>${formatMoney(r.totalCost)}</td>
            <td><strong style="color:${profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${formatMoney(profit)}</strong></td>
            <td><span class="${marginClass}">${formatPercent(margin)}</span></td>
        </tr>`;
    }).join('');
}

function renderBreakevenReport() {
    const container = document.getElementById('breakevenInfo');

    if (DATA.products.length === 0) {
        container.innerHTML = '<p class="empty-state">أضف منتجات لحساب نقطة التعادل</p>';
        return;
    }

    // Fixed costs for the period
    const expenses = getExpenseTotals();
    const fixedCosts = expenses.adsTotal + expenses.employeeTotal + expenses.otherTotal;

    container.innerHTML = DATA.products.map(p => {
        const variableCost = p.buyPrice + p.packagingCost;
        const contribution = p.sellPrice - variableCost;
        const breakeven = contribution > 0 ? Math.ceil(fixedCosts / contribution) : 0;

        // How many sold this period?
        const soldQty = DATA.orders
            .filter(o => o.productId === p.id && matchesFilter(o.date) && o.status !== 'مرجع')
            .reduce((sum, o) => sum + o.qty, 0);

        const reached = soldQty >= breakeven;

        return `<div class="breakeven-product">
            <h4><i class="fas fa-box"></i> ${p.name}</h4>
            <div class="breakeven-detail">
                <span>سعر البيع</span>
                <span>${formatMoney(p.sellPrice)}</span>
            </div>
            <div class="breakeven-detail">
                <span>التكلفة المتغيرة</span>
                <span>${formatMoney(variableCost)}</span>
            </div>
            <div class="breakeven-detail">
                <span>هامش المساهمة</span>
                <span style="color:${contribution > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${formatMoney(contribution)}</span>
            </div>
            <div class="breakeven-detail">
                <span>المصاريف الثابتة</span>
                <span>${formatMoney(fixedCosts)}</span>
            </div>
            <div class="breakeven-detail">
                <span><strong>نقطة التعادل</strong></span>
                <span><strong style="color:var(--accent-blue)">${breakeven > 0 ? breakeven + ' وحدة' : '∞'}</strong></span>
            </div>
            <div class="breakeven-detail">
                <span>الكمية المباعة</span>
                <span style="color:${reached ? 'var(--accent-green)' : 'var(--accent-orange)'}">${soldQty} وحدة ${reached ? '✅' : '⏳'}</span>
            </div>
        </div>`;
    }).join('');
}

// ==============================
//  EXPORT / IMPORT
// ==============================
function initExportImport() {
    document.getElementById('btnExportData').addEventListener('click', () => {
        const json = JSON.stringify(DATA, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finsheet_backup_${today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('تم تصدير النسخة الاحتياطية', 'success');
    });

    document.getElementById('btnImportData').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (confirm('هل أنت متأكد من استيراد هذه البيانات؟ ستحل محل البيانات الحالية.')) {
                    DATA = imported;
                    saveData();
                    refreshAll();
                    showToast('تم استيراد البيانات بنجاح', 'success');
                }
            } catch (err) {
                showToast('خطأ في قراءة الملف', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // CSV Export for reports
    document.getElementById('btnExportReport').addEventListener('click', exportCSV);
}

function exportCSV() {
    const expenses = getExpenseTotals();
    const totalExpenses = expenses.adsTotal + expenses.goodsTotal + expenses.packagingTotal + expenses.employeeTotal + expenses.otherTotal;
    const filteredIncome = DATA.income.filter(i => matchesFilter(i.date));
    let totalIncome = 0;
    filteredIncome.forEach(i => totalIncome += i.amount);

    let csv = '\uFEFF'; // BOM for Arabic
    csv += 'التقرير المالي\n';
    csv += `السنة,${getFilterYear()}\n`;
    const month = getFilterMonth();
    if (month !== null) csv += `الشهر,${getMonthName(month)}\n`;
    csv += '\n';

    csv += 'النوع,المبلغ (DZD)\n';
    csv += `إجمالي المداخيل,${totalIncome}\n`;
    csv += `مصاريف الإعلانات,${expenses.adsTotal}\n`;
    csv += `مصاريف السلع,${expenses.goodsTotal}\n`;
    csv += `مصاريف التغليف,${expenses.packagingTotal}\n`;
    csv += `عمولة العامل,${expenses.employeeTotal}\n`;
    csv += `مصاريف أخرى,${expenses.otherTotal}\n`;
    csv += `إجمالي المصاريف,${totalExpenses}\n`;
    csv += `الربح الصافي,${totalIncome - totalExpenses}\n`;

    csv += '\nتفاصيل الطلبيات\n';
    csv += 'التاريخ,المنتج,الكمية,نوع البيع,السعر,الإجمالي,الحالة\n';
    DATA.orders.filter(o => matchesFilter(o.date)).forEach(o => {
        csv += `${o.date},${o.productName},${o.qty},${o.saleType},${o.price},${o.qty * o.price},${o.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير التقرير كـ CSV', 'success');
}

// ==============================
//  REFRESH ALL
// ==============================
function refreshAll() {
    renderSuppliers();
    renderProducts();
    populateProductDropdowns();
    renderAds();
    renderGoods();
    renderPackaging();
    renderEmployee();
    renderOther();
    renderIncome();
    renderUsd();
    renderOrders();
    refreshDashboard();
    refreshReports();
}

// ==============================
//  INIT
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    // Set current year in filter
    const yearSelect = document.getElementById('filterYear');
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear; y >= currentYear - 3; y--) {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    }

    // Set current month
    const monthSelect = document.getElementById('filterMonth');
    monthSelect.value = new Date().getMonth().toString();

    initNavigation();
    initModals();
    initSuppliers();
    initProducts();
    initAds();
    initGoods();
    initPackaging();
    initEmployee();
    initOther();
    initIncome();
    initUsd();
    initOrders();
    initDelete();
    initExportImport();

    // Initialize Firebase real-time sync
    // (refreshAll will be called by Firebase listener)
    initFirebase();
});
