// 🌟 محرك سراج كاشير المركزي (النسخة الصافية الموحدة - V4 Clean)
// العمدان الخمسة: الأدوات والنوافذ | المخزن والدفعات | المحاسبة الصريحة | الخزينة الموحدة | التزامن السحابي والمايك الخفيف

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(e => console.error(e));
    });
}

const firebaseConfig = {
    apiKey: "AIzaSyASQurlODfgqRi812wwzcSGOTetYTaeUfQ",
    authDomain: "serajled.firebaseapp.com",
    databaseURL: "https://serajled-default-rtdb.firebaseio.com",
    projectId: "serajled",
    storageBucket: "serajled.firebasestorage.app",
    messagingSenderId: "586272473412",
    appId: "1:586272473412:web:a31487a74d9ea4ea96d711",
    measurementId: "G-6Q7K2H0XJJ"
};

let cloudReady = false;
let myDeviceName = localStorage.getItem('seraj_device_name');
if (!myDeviceName) {
    myDeviceName = prompt("مرحباً بك في سراج كاشير 🛠️\nبرجاء إدخال اسم مميز لهذا الجهاز:");
    if (!myDeviceName || myDeviceName.trim() === "") myDeviceName = "جهاز_1";
    localStorage.setItem('seraj_device_name', myDeviceName);
}

let currentStoreId = localStorage.getItem('seraj_store_id') || 'DemoStore';

function initCloud() {
    const startRealtimeDB = () => {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        window.dbCloud = firebase.database();
        cloudReady = true;
        showCloudStatus('⚡ متصل بالسحابي: ' + currentStoreId);
        processDeleteQueue();
        processSyncQueue();
        startSmartRadars();
        checkAndRunAutoCloudBackup();
    };

    const loadDatabaseSDK = () => {
        if (typeof firebase !== 'undefined' && typeof firebase.database === 'function') {
            startRealtimeDB();
        } else {
            let s2 = document.createElement('script');
            s2.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js";
            document.head.appendChild(s2);
            s2.onload = startRealtimeDB;
        }
    };

    if (typeof window.firebase !== 'undefined') {
        loadDatabaseSDK();
    } else {
        let s1 = document.createElement('script');
        s1.src = "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js";
        document.head.appendChild(s1);
        s1.onload = loadDatabaseSDK;
    }
}

function showCloudStatus(msg) {
    if (!document.body) return;
    let el = document.getElementById('cloud-sync-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'cloud-sync-status';
        el.style.cssText = 'position:fixed; bottom:15px; left:15px; background:rgba(10, 10, 10, 0.95); color:var(--neon-border, #00ff66); padding:8px 16px; border-radius:20px; font-size:14px; font-weight:bold; z-index:99999; border: 1px solid var(--neon-border, #00ff66); pointer-events: none; transition: all 0.3s ease;';
        document.body.appendChild(el);
    }
    el.style.opacity = '1';
    el.innerText = msg;
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 4000);
}

function safeParseJSON(str, fallback = []) {
    if (!str) return fallback;
    try {
        let parsed = JSON.parse(str);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

// =========================================================
// 1. العمود الأول: الأدوات المركزية، النوافذ، والصور (Utils & Modals & ImagesDB)
// =========================================================
const _buttonLocks = new WeakSet();
let _seqInitialized = false;

window.Utils = {
    formatCurrency: function(amount) {
        let num = parseFloat(amount);
        return isNaN(num) ? "0.00" : num.toFixed(2);
    },

    normalizeName: function(str) {
        if (!str) return "";
        return String(str)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase();
    },

    sanitizeHTML: function(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    },

    getSafeTime: function(dateVal) {
        if (!dateVal) return 0;
        if (typeof dateVal === 'number') return dateVal;
        let clean = String(dateVal)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
            .trim();
        let parsed = Date.parse(clean);
        if (!isNaN(parsed)) return parsed;
        let parts = clean.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
        if (parts) {
            let p1 = parseInt(parts[1]), p2 = parseInt(parts[2]), p3 = parseInt(parts[3]);
            if (p1 > 1000) return new Date(p1, p2 - 1, p3, 12, 0, 0).getTime() || 0;
            if (p3 > 1000) return new Date(p3, p2 - 1, p1, 12, 0, 0).getTime() || 0;
        }
        return 0;
    },

    formatDate: function(timestamp) {
        if (!timestamp) return "";
        let time = this.getSafeTime(timestamp) || timestamp;
        let d = new Date(time);
        if (isNaN(d.getTime())) return String(timestamp);
        return d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG');
    },

    generateInvoiceId: function() {
        return this.generateUniqueId();
    },

    // توليد أرقام تسلسلية قصيرة وسريعة دون إعادة قراءة الجداول في كل ضغطة
    generateUniqueId: function() {
        let lastSeq = parseInt(localStorage.getItem('seraj_short_seq_id') || '1000', 10);
        if (isNaN(lastSeq) || lastSeq < 1000) lastSeq = 1000;

        if (!_seqInitialized) {
            _seqInitialized = true;
            const scanMax = (key) => {
                let arr = safeParseJSON(localStorage.getItem(key), []);
                if (!Array.isArray(arr)) return;
                arr.forEach(item => {
                    let n = parseInt(String(item?.id || '').replace(/\D/g, ''), 10);
                    if (!isNaN(n) && n >= 1000 && n < 100000000 && n > lastSeq) lastSeq = n;
                    if (Array.isArray(item?.transactions)) {
                        item.transactions.forEach(tx => {
                            let tn = parseInt(String(tx?.id || '').replace(/\D/g, ''), 10);
                            if (!isNaN(tn) && tn >= 1000 && tn < 100000000 && tn > lastSeq) lastSeq = tn;
                        });
                    }
                });
            };
            ['seraj_sales_invoices', 'seraj_purchase_invoices', 'seraj_treasury_moves', 'seraj_customers', 'seraj_suppliers'].forEach(scanMax);
        }

        let nextSeq = lastSeq + 1;
        localStorage.setItem('seraj_short_seq_id', String(nextSeq));
        return String(nextSeq);
    },

    preventDoubleClick: function(btnOrEvent, actionFn = null, cooldownMs = 1500) {
        let btn = btnOrEvent && (btnOrEvent.currentTarget || btnOrEvent.target)
            ? (btnOrEvent.currentTarget || btnOrEvent.target)
            : btnOrEvent;

        if (btn && btn instanceof Element) {
            if (btn._isExecutingSync) {
                return typeof actionFn === 'function' ? actionFn() : true;
            }
            if (_buttonLocks.has(btn)) return false;

            _buttonLocks.add(btn);
            btn._isExecutingSync = true;
            let originalPointer = btn.style.pointerEvents;
            btn.style.pointerEvents = 'none';

            const unlock = () => {
                setTimeout(() => {
                    _buttonLocks.delete(btn);
                    btn.disabled = false;
                    btn.style.pointerEvents = originalPointer || '';
                }, cooldownMs);
            };

            if (typeof actionFn === 'function') {
                try {
                    let res = actionFn();
                    btn._isExecutingSync = false;
                    btn.disabled = true;
                    if (res && typeof res.finally === 'function') res.finally(unlock);
                    else unlock();
                    return res;
                } catch (err) {
                    btn._isExecutingSync = false;
                    unlock();
                    throw err;
                }
            } else {
                setTimeout(() => { btn._isExecutingSync = false; }, 50);
                unlock();
                return true;
            }
        }
        return typeof actionFn === 'function' ? actionFn() : true;
    },

    // دالة مركزية لتصدير وتنزيل ملف PDF حقيقي A4 في كل الصفحات بدون فتح نافذة الطباعة
    downloadRealPDF: async function(htmlString, fileName = 'document.pdf') {
        if (typeof html2pdf === 'undefined') {
            await new Promise((resolve, reject) => {
                let s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        let container = document.createElement('div');
        container.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; background:#ffffff; color:#000000; direction:rtl; padding:10px;';
        container.innerHTML = htmlString;
        document.body.appendChild(container);

        let safeName = String(fileName).endsWith('.pdf') ? fileName : (fileName + '.pdf');
        let opt = {
            margin: 8,
            filename: safeName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(container).save();
        } finally {
            if (container.parentNode) container.parentNode.removeChild(container);
        }
    }
};

window.getSafeTime = function(d) { return window.Utils.getSafeTime(d); };
window.generateUniqueId = function(p) { return window.Utils.generateUniqueId(p); };

if (!Number.prototype.split) {
    Object.defineProperty(Number.prototype, 'split', {
        value: function(sep, limit) {
            let ms = Number(this);
            let d = ms > 0 ? new Date(ms) : new Date();
            let str = (sep === 'T' || sep === '-') ? d.toISOString() : d.toLocaleString('ar-EG');
            return String(str).split(sep, limit);
        },
        configurable: true, writable: true
    });
}
if (!Number.prototype.trim) {
    Object.defineProperty(Number.prototype, 'trim', {
        value: function() { return String(this).trim(); },
        configurable: true, writable: true
    });
}
if (!Number.prototype.includes) {
    Object.defineProperty(Number.prototype, 'includes', {
        value: function(search, pos) {
            let ms = Number(this);
            let str = ms > 0 ? new Date(ms).toLocaleString('ar-EG') : String(this);
            return String(str).includes(search, pos);
        },
        configurable: true, writable: true
    });
}

// النوافذ الموحدة (SerajAlert & SerajConfirm)
window.SerajAlert = function(message, type = 'info', callback = null) {
    return new Promise((resolve) => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,10,0.92); z-index:100000; display:flex; justify-content:center; align-items:center;';
        let borderColor = type === 'error' ? 'var(--danger-color, #ff3333)' : (type === 'success' ? 'var(--success-color, #00ff66)' : 'var(--neon-border, #00e5ff)');
        let box = document.createElement('div');
        box.style.cssText = `background:var(--card-bg, #1a1a1a); padding:30px; border-radius:10px; border:2px solid ${borderColor}; color:var(--text-main, #ffffff); text-align:center; min-width:300px; max-width:85%; box-shadow: 0 0 20px rgba(0,0,0,0.8);`;
        box.innerHTML = `
            <h3 style="margin-top:0; color:${borderColor};">${type === 'error' ? '⚠️ تنبيه هام' : '✅ رسالة النظام'}</h3>
            <p style="font-size:18px; margin:20px 0; line-height:1.6;">${window.Utils.sanitizeHTML(String(message))}</p>
            <button id="alert-ok-btn" style="background:${borderColor}; color:#000; border:none; padding:10px 30px; font-weight:bold; border-radius:5px; cursor:pointer; font-size:16px;">موافق</button>
        `;
        modal.appendChild(box);
        document.body.appendChild(modal);
        let okBtn = modal.querySelector('#alert-ok-btn');
        if (okBtn) {
            okBtn.focus();
            okBtn.onclick = () => {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
                if (typeof callback === 'function') callback(true);
                resolve(true);
            };
        }
    });
};
window.SerajSerajAlert = window.SerajAlert;

window.SerajConfirm = function(message, callback = null) {
    return new Promise((resolve) => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,10,0.92); z-index:100000; display:flex; justify-content:center; align-items:center;';
        let warnColor = 'var(--warning-color, #ffcc00)';
        let box = document.createElement('div');
        box.style.cssText = `background:var(--card-bg, #1a1a1a); padding:30px; border-radius:10px; border:2px solid ${warnColor}; color:var(--text-main, #ffffff); text-align:center; min-width:300px; max-width:85%; box-shadow: 0 0 20px rgba(0,0,0,0.8);`;
        box.innerHTML = `
            <h3 style="margin-top:0; color:${warnColor};">❓ تأكيد إجراء</h3>
            <p style="font-size:18px; margin:20px 0; line-height:1.6;">${window.Utils.sanitizeHTML(String(message))}</p>
            <div style="display:flex; justify-content:center; gap:15px;">
                <button id="confirm-yes-btn" style="background:var(--success-color, #00ff66); color:#000; border:none; padding:10px 25px; font-weight:bold; border-radius:5px; cursor:pointer; font-size:15px;">نعم، متأكد</button>
                <button id="confirm-no-btn" style="background:var(--danger-color, #ff3333); color:#fff; border:none; padding:10px 25px; font-weight:bold; border-radius:5px; cursor:pointer; font-size:15px;">إلغاء</button>
            </div>
        `;
        modal.appendChild(box);
        document.body.appendChild(modal);
        let yesBtn = modal.querySelector('#confirm-yes-btn');
        let noBtn = modal.querySelector('#confirm-no-btn');
        if (yesBtn) {
            yesBtn.onclick = () => {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
                if (typeof callback === 'function') callback(true);
                resolve(true);
            };
        }
        if (noBtn) {
            noBtn.onclick = () => {
                if (modal.parentNode) modal.parentNode.removeChild(modal);
                if (typeof callback === 'function') callback(false);
                resolve(false);
            };
        }
    });
};
window.SerajSerajConfirm = window.SerajConfirm;

// محرك الصور المركزي الخفيف (ImagesDB)
const _nativeCreateObjectURL = URL.createObjectURL.bind(URL);
URL.createObjectURL = function(obj) {
    if (typeof obj === 'string') return obj;
    return _nativeCreateObjectURL(obj);
};

window.ImagesDB = {
    dbName: 'SerajImagesDB',
    storeName: 'productImages',
    _dbPromise: null,

    open: function() {
        if (this._dbPromise) return this._dbPromise;
        this._dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) return reject('IndexedDB not supported');
            let req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (e) => {
                let db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
        return this._dbPromise;
    },

    _prepareOutput: function(rawImg) {
        if (!rawImg) return null;
        if (rawImg instanceof Blob) {
            let objUrl = _nativeCreateObjectURL(rawImg);
            rawImg.toString = function() { return objUrl; };
            return rawImg;
        }
        return rawImg;
    },

    saveImage: function(productId, blobOrBase64) {
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let sName = db.objectStoreNames.contains(this.storeName) ? this.storeName : db.objectStoreNames[0];
                    let tx = db.transaction([sName], 'readwrite');
                    tx.objectStore(sName).put({ id: String(productId), imageBlob: blobOrBase64, updatedAt: Date.now() });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (err) { resolve(false); }
            });
        }).catch(() => false);
    },

    getImage: function(productId) {
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let sName = db.objectStoreNames.contains(this.storeName) ? this.storeName : db.objectStoreNames[0];
                    let store = db.transaction([sName], 'readonly').objectStore(sName);
                    let req = store.get(String(productId));
                    req.onsuccess = (e) => {
                        let rec = e.target.result;
                        if (rec && (rec.imageBlob || rec.image)) {
                            resolve(this._prepareOutput(rec.imageBlob || rec.image));
                        } else {
                            resolve(null);
                        }
                    };
                    req.onerror = () => resolve(null);
                } catch (err) { resolve(null); }
            });
        }).catch(() => null);
    },

    deleteImage: function(productId) {
        return this.open().then(db => {
            return new Promise((resolve) => {
                try {
                    let sName = db.objectStoreNames.contains(this.storeName) ? this.storeName : db.objectStoreNames[0];
                    let tx = db.transaction([sName], 'readwrite');
                    let store = tx.objectStore(sName);
                    store.delete(String(productId));
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (err) { resolve(false); }
            });
        }).catch(() => false);
    }
};
window.ImagesDB.open().catch(() => {});

// =========================================================
// 2. العمود الخامس: التزامن اللحظي، الطابور الهادئ، ومطابقة التليفونات
// =========================================================
let _emitTimeouts = {};
function emitSerajUpdate(collectionName, source = 'local') {
    try {
        let lockKey = collectionName + '_' + source;
        if (_emitTimeouts[lockKey]) clearTimeout(_emitTimeouts[lockKey]);
        _emitTimeouts[lockKey] = setTimeout(() => {
            delete _emitTimeouts[lockKey];
            window.dispatchEvent(new CustomEvent('seraj:updated', {
                detail: { collection: collectionName, source: source, timestamp: Date.now() }
            }));
        }, 80);
    } catch (e) {}
}

let _syncTimer = null;
let _inFlightSyncKeys = new Set();
let localCollectionsCache = {};
let renderTimers = {};

// ذاكرة سريعة لطوابير المزامنة والحذف لمنع فك التشفير المتكرر (JSON.parse) مع الرادار
let _memSyncQueue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
let _memDelQueue = safeParseJSON(localStorage.getItem('seraj_delete_queue'), []);

function _saveSyncQueueToStorage() {
    localStorage.setItem('seraj_sync_queue', JSON.stringify(_memSyncQueue));
}
function _saveDelQueueToStorage() {
    localStorage.setItem('seraj_delete_queue', JSON.stringify(_memDelQueue));
}

function _stripRuntimeFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    let copy = Array.isArray(obj) ? [...obj] : { ...obj };
    delete copy._lastModified;
    delete copy.balance;
    delete copy.calculatedBalance;
    delete copy.netBalanceVal;
    delete copy.isNetDebt;
    delete copy.deferredInvoicesTotal;
    delete copy.displayCurrentBalance;
    delete copy.isCurrentBalDebt;
    delete copy.$$hashKey;
    delete copy._isEditing;
    return copy;
}

function getNewestItems(arr, count = 15) {
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) => {
        let tB = Number(b?._lastModified || b?.timestamp || 0);
        let tA = Number(a?._lastModified || a?.timestamp || 0);
        return tB - tA;
    }).slice(0, count);
}

function scheduleSyncQueue() {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
        processSyncQueue();
    }, 120);
}

function addToSyncQueue(colName, itemData) {
    if (!itemData || itemData.id === undefined || itemData.id === null) return;
    let idStr = String(itemData.id);
    if (!itemData._lastModified) itemData._lastModified = Date.now();
    let cleanItem = _stripRuntimeFields(itemData);
    cleanItem._lastModified = itemData._lastModified;

    _memSyncQueue = _memSyncQueue.filter(q => !(q.col === colName && String(q.data?.id) === idStr));
    _memSyncQueue.push({ col: colName, data: cleanItem });
    _saveSyncQueueToStorage();
    scheduleSyncQueue();
}

function addToDeleteQueue(colName, itemId) {
    if (itemId === undefined || itemId === null) return;
    let idStr = String(itemId);
    if (!_memDelQueue.some(q => q.col === colName && String(q.id) === idStr)) {
        _memDelQueue.push({ col: colName, id: idStr });
        _saveDelQueueToStorage();
    }
    _memSyncQueue = _memSyncQueue.filter(q => !(q.col === colName && String(q.data?.id) === idStr));
    _saveSyncQueueToStorage();
    processDeleteQueue();
}

function processDeleteQueue() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return;
    let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    if (_memDelQueue.length === 0) return;

    let batch = _memDelQueue.slice(0, 15);
    batch.forEach(q => {
        let safeId = String(q.id).replace(/[.#$\[\]]/g, "_");
        let cloudRefName = 'Seraj_V4_Stores/' + activeStoreId + '/' + q.col + '/' + safeId;
        window.dbCloud.ref(cloudRefName).remove()
            .then(() => {
                _memDelQueue = _memDelQueue.filter(item => !(item.col === q.col && String(item.id) === String(q.id)));
                _saveDelQueueToStorage();
                if (_memDelQueue.length > 0) setTimeout(processDeleteQueue, 250);
            }).catch(e => console.error("Delete Sync Error:", e));
    });
}

function processSyncQueue() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return;
    let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    if (_memSyncQueue.length === 0) return;

    showCloudStatus("⏳ جاري مزامنة التعديلات (" + _memSyncQueue.length + ")...");

    // دفعات هادئة (15 عنصراً) لعدم تهنيج المتصفح أو السحابة
    let batch = _memSyncQueue.slice(0, 15);
    let completed = 0;

    batch.forEach(q => {
        if (!q.data || q.data.id === undefined) {
            completed++;
            return;
        }
        let lockKey = q.col + '_' + String(q.data.id);
        if (_inFlightSyncKeys.has(lockKey)) return;
        _inFlightSyncKeys.add(lockKey);

        let safeId = String(q.data.id).replace(/[.#$\[\]]/g, "_");
        let cloudRefName = 'Seraj_V4_Stores/' + activeStoreId + '/' + q.col + '/' + safeId;

        window.dbCloud.ref(cloudRefName).set(q.data)
            .then(() => {
                _inFlightSyncKeys.delete(lockKey);
                _memSyncQueue = _memSyncQueue.filter(item => !(item.col === q.col && String(item.data?.id) === String(q.data.id)));
                _saveSyncQueueToStorage();
                completed++;
                if (completed >= batch.length && _memSyncQueue.length > 0) {
                    if (_syncTimer) clearTimeout(_syncTimer);
                    _syncTimer = setTimeout(processSyncQueue, 300);
                } else if (_memSyncQueue.length === 0) {
                    showCloudStatus('⚡ متصل بالسحابي: ' + activeStoreId);
                }
            }).catch(e => {
                _inFlightSyncKeys.delete(lockKey);
                console.error("Sync Error:", e);
            });
    });
}

window.addEventListener('online', () => {
    showCloudStatus("🌐 عاد الاتصال بالإنترنت! جاري المزامنة...");
    if (cloudReady) {
        _inFlightSyncKeys.clear();
        processDeleteQueue();
        scheduleSyncQueue();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && cloudReady && window.dbCloud) {
        _inFlightSyncKeys.clear();
        try { window.dbCloud.goOnline(); } catch (e) {}
        processDeleteQueue();
        scheduleSyncQueue();
    }
});

// حفظ المصفوفة ومقارنتها بدقة مع الكاش لرفع العناصر المعدلة أو الجديدة فقط بختم وقت محدث
function saveArrayToQueueSafely(colName, newArray) {
    if (!Array.isArray(newArray)) newArray = [];
    localCollectionsCache[colName] = [...newArray];

    try {
        let rawOldCache = localStorage.getItem('seraj_cloud_cache_' + colName);
        let oldArray = rawOldCache ? safeParseJSON(rawOldCache, []) : [];
        let oldMap = new Map(oldArray.map(i => [String(i?.id), i]));
        let newMap = new Map(newArray.map(i => [String(i?.id), i]));
        let changedItems = [];
        let nowTs = Date.now();

        newArray.forEach(newItem => {
            if (!newItem || newItem.id === undefined) return;
            let id = String(newItem.id);
            let oldItem = oldMap.get(id);
            let cleanNew = _stripRuntimeFields(newItem);
            let cleanOld = oldItem ? _stripRuntimeFields(oldItem) : null;

            if (!cleanOld || JSON.stringify(cleanOld) !== JSON.stringify(cleanNew)) {
                newItem._lastModified = nowTs;
                let itemForCloud = { ...cleanNew, _lastModified: nowTs };
                changedItems.push(itemForCloud);
            }
        });

        if (changedItems.length > 0) {
            changedItems.forEach(item => {
                let idStr = String(item.id);
                _memSyncQueue = _memSyncQueue.filter(q => !(q.col === colName && String(q.data?.id) === idStr));
                _memSyncQueue.push({ col: colName, data: item });
            });
            _saveSyncQueueToStorage();
            scheduleSyncQueue();
        }

        if (colName === 'treasury_moves') {
            oldArray.forEach(oldItem => {
                if (!oldItem || oldItem.id === undefined) return;
                let id = String(oldItem.id);
                if (!newMap.has(id)) {
                    addToDeleteQueue(colName, id);
                }
            });
        }

        localStorage.setItem('seraj_cloud_cache_' + colName, JSON.stringify(newArray));
        emitSerajUpdate(colName, 'local');
    } catch (e) {
        console.error("Queue Sync Error:", e);
    }
}

// مطابقة ذكية عند فتح الصفحة لتوحيد كل التليفونات ومسح الحركات المحذوفة أثناء غلق التليفون
function reconcileCollectionWithCloud(col) {
    if (!cloudReady || !window.dbCloud || !navigator.onLine) return;
    let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    let ref = window.dbCloud.ref('Seraj_V4_Stores/' + activeStoreId + '/' + col);

    ref.once('value', snapshot => {
        let cloudObj = snapshot.val() || {};
        let cloudMap = new Map();
        Object.keys(cloudObj).forEach(k => {
            let item = cloudObj[k];
            if (item && item.id !== undefined) cloudMap.set(String(item.id), item);
        });

        let localArr = safeParseJSON(localStorage.getItem('seraj_' + col), []);
        let delSet = new Set(_memDelQueue.filter(q => q.col === col).map(q => String(q.id)));
        let syncSet = new Set(_memSyncQueue.filter(q => q.col === col && q.data).map(q => String(q.data.id)));

        let mergedMap = new Map();
        let needsSave = false;

        localArr.forEach(localItem => {
            if (!localItem || localItem.id === undefined) return;
            let idStr = String(localItem.id);
            if (delSet.has(idStr)) { needsSave = true; return; }

            if (cloudMap.has(idStr)) {
                let cloudItem = cloudMap.get(idStr);
                let lMod = Number(localItem._lastModified || 0);
                let cMod = Number(cloudItem._lastModified || 0);
                if (syncSet.has(idStr) || (lMod > 0 && cMod > 0 && lMod > cMod)) {
                    mergedMap.set(idStr, localItem);
                    if (!syncSet.has(idStr)) addToSyncQueue(col, localItem);
                } else {
                    mergedMap.set(idStr, cloudItem);
                    if (JSON.stringify(_stripRuntimeFields(localItem)) !== JSON.stringify(_stripRuntimeFields(cloudItem))) {
                        needsSave = true;
                    }
                }
            } else {
                if (col === 'treasury_moves') {
                    // في الخزينة: إذا لم تكن في طابور الرفع وغير موجودة في السحابة، فهي حركة حُذفت من تليفون آخر -> تمسح لتوحيد الخزينة
                    if (syncSet.has(idStr)) {
                        mergedMap.set(idStr, localItem);
                    } else {
                        needsSave = true;
                    }
                } else {
                    // في الفواتير والأصناف والعملاء: نرفع أي عنصر محلي لم يرفع بعد للسحابة
                    mergedMap.set(idStr, localItem);
                    if (!syncSet.has(idStr)) addToSyncQueue(col, localItem);
                }
            }
        });

        cloudMap.forEach((cloudItem, idStr) => {
            if (!delSet.has(idStr) && !mergedMap.has(idStr)) {
                mergedMap.set(idStr, cloudItem);
                needsSave = true;
            }
        });

        if (needsSave) {
            let finalArr = Array.from(mergedMap.values());
            localCollectionsCache[col] = finalArr;
            saveAndRenderLocal(col, finalArr);
            if (col === 'treasury_moves' && window.DB) {
                window.DB.recalculateVaultBalances(true);
            }
        }
    });
}

function startSmartRadars() {
    if (!cloudReady || !window.dbCloud) return;
    currentStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    const collections = ['products', 'customers', 'sales_invoices', 'suppliers', 'purchase_invoices', 'treasury_moves', 'smart_notes'];

    collections.forEach((col, idx) => {
        let ref = window.dbCloud.ref('Seraj_V4_Stores/' + currentStoreId + '/' + col);
        ref.off();
        ref.on('child_added', snap => updateLocalSingleItem(col, snap.val()));
        ref.on('child_changed', snap => updateLocalSingleItem(col, snap.val()));
        ref.on('child_removed', snap => removeLocalSingleItem(col, snap.key));

        setTimeout(() => reconcileCollectionWithCloud(col), (idx + 1) * 350);
    });

    let vaultsRef = window.dbCloud.ref('Seraj_V4_Stores/' + currentStoreId + '/vaults_v2');
    vaultsRef.off();
    vaultsRef.on('value', snapshot => {
        if (snapshot.exists()) {
            let incomingStr = JSON.stringify(snapshot.val());
            let currentStr = localStorage.getItem('seraj_vaults_v2');
            if (incomingStr === currentStr) return;
            localStorage.setItem('seraj_vaults_v2', incomingStr);
            emitSerajUpdate('vaults_v2', 'cloud');
            if (typeof updateTreasuryUI === 'function' && !window.DB._isSavingVaults) {
                window.DB._isSavingVaults = true;
                try { updateTreasuryUI(); } catch (e) {}
                setTimeout(() => { window.DB._isSavingVaults = false; }, 200);
            }
        }
    });
}

// إشعارات النوتة الذكية بين التليفونات
let _notifiedSmartNotes = {};
let myDeviceUid = sessionStorage.getItem('seraj_device_uid');
if (!myDeviceUid) {
    myDeviceUid = 'uid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('seraj_device_uid', myDeviceUid);
}

window.addEventListener('click', function _initNotePerms() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
    window.removeEventListener('click', _initNotePerms);
}, { once: true });

function playSmartNoteTone() {
    try {
        let AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        let ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const playBeep = (freq, startTime, duration) => {
            let osc = ctx.createOscillator();
            let gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        let now = ctx.currentTime;
        playBeep(587.33, now, 0.16);
        playBeep(880.00, now + 0.18, 0.30);
    } catch (e) {}
}

function triggerSmartNoteNotification(data) {
    let sender = data.updatedBy || data._lastModifiedBy || data._device || 'جهاز بالمحل';
    let noteTitle = data.title || data.name || data.text || 'قائمة نواقص / ملاحظة';
    let itemsCount = Array.isArray(data.items) ? data.items.length : 0;
    let notifTitle = `📝 نوتة جديدة من: ${sender}`;
    let notifBody = itemsCount > 0 ? `العنوان: ${noteTitle} - عدد الأصناف: ${itemsCount}` : `المحتوى: ${noteTitle}`;

    showCloudStatus(`${notifTitle} (${noteTitle})`);
    playSmartNoteTone();

    if ('Notification' in window && Notification.permission === 'granted') {
        let notifOptions = { body: notifBody, icon: '/icon.png', badge: '/icon.png', tag: 'seraj_note_' + data.id, renotify: true, vibrate: [200, 100, 200] };
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => reg.showNotification(notifTitle, notifOptions)).catch(() => {
                try { new Notification(notifTitle, notifOptions); } catch (e) {}
            });
        } else {
            try { new Notification(notifTitle, notifOptions); } catch (e) {}
        }
    }
}

function updateLocalSingleItem(col, data) {
    if (!data || data.id === undefined) return;
    let docId = String(data.id);

    // تحديث عداد الأرقام التسلسلية إذا وصل رقم أكبر من تليفون آخر لمنع التصادم
    let incomingNum = parseInt(docId.replace(/\D/g, ''), 10);
    if (!isNaN(incomingNum) && incomingNum >= 1000 && incomingNum < 100000000) {
        let curSeq = parseInt(localStorage.getItem('seraj_short_seq_id') || '1000', 10);
        if (incomingNum > curSeq) localStorage.setItem('seraj_short_seq_id', String(incomingNum));
    }

    if (_memDelQueue.some(q => q.col === col && String(q.id) === docId)) return;
    if (_memSyncQueue.some(q => q.col === col && q.data && String(q.data.id) === docId)) return;

    if (!localCollectionsCache[col]) {
        localCollectionsCache[col] = safeParseJSON(localStorage.getItem('seraj_' + col), []);
    }
    let arr = localCollectionsCache[col];
    let existingIndex = arr.findIndex(item => String(item?.id) === docId);

    let isChangedOrNew = false;
    if (existingIndex > -1) {
        let localItem = arr[existingIndex];
        let localMod = Number(localItem?._lastModified || 0);
        let cloudMod = Number(data?._lastModified || 0);
        if (localMod > 0 && cloudMod > 0 && localMod > cloudMod) return;
        if (JSON.stringify(_stripRuntimeFields(localItem)) === JSON.stringify(_stripRuntimeFields(data))) return;
        arr[existingIndex] = data;
        isChangedOrNew = true;
    } else {
        arr.push(data);
        isChangedOrNew = true;
    }

    if (!isChangedOrNew) return;

    if (col === 'smart_notes') {
        let modTime = Number(data._lastModified || data.timestamp || 0);
        let isRecent = modTime > 0 && (Date.now() - modTime) < 120000;
        let isDifferentSession = data._senderUid ? (data._senderUid !== myDeviceUid) : (data.updatedBy !== myDeviceName);
        if (isRecent && isDifferentSession && _notifiedSmartNotes[docId] !== modTime) {
            _notifiedSmartNotes[docId] = modTime;
            triggerSmartNoteNotification(data);
        }
    }

    if (renderTimers[col]) clearTimeout(renderTimers[col]);
    renderTimers[col] = setTimeout(() => {
        saveAndRenderLocal(col, localCollectionsCache[col]);
        if (col === 'treasury_moves' && window.DB) {
            window.DB.recalculateVaultBalances(true);
        }
    }, 150);
}

function removeLocalSingleItem(col, docId) {
    if (!localCollectionsCache[col]) {
        localCollectionsCache[col] = safeParseJSON(localStorage.getItem('seraj_' + col), []);
    }
    let beforeLen = localCollectionsCache[col].length;
    localCollectionsCache[col] = localCollectionsCache[col].filter(item => String(item?.id) !== String(docId));
    if (localCollectionsCache[col].length === beforeLen) return;

    if (renderTimers[col]) clearTimeout(renderTimers[col]);
    renderTimers[col] = setTimeout(() => {
        saveAndRenderLocal(col, localCollectionsCache[col]);
        if (col === 'treasury_moves' && window.DB) {
            window.DB.recalculateVaultBalances(true);
        }
    }, 150);
}

function saveAndRenderLocal(col, localArray) {
    if (col.includes('invoices') || col === 'treasury_moves') {
        localArray.sort((a, b) => window.Utils.getSafeTime(b.timestamp || b.date) - window.Utils.getSafeTime(a.timestamp || a.date) || String(b.id).localeCompare(String(a.id)));
    }
    localStorage.setItem('seraj_' + col, JSON.stringify(localArray));
    localStorage.setItem('seraj_cloud_cache_' + col, JSON.stringify(localArray));

    emitSerajUpdate(col, 'cloud');

    try {
        if (col === 'products' && typeof renderInventoryTable === 'function') renderInventoryTable();
        if (col === 'sales_invoices' && typeof renderInvoicesHistory === 'function') renderInvoicesHistory();
        if (col === 'customers' && typeof renderCustomersList === 'function') renderCustomersList();
        if (col === 'suppliers' && typeof renderSuppliersList === 'function') renderSuppliersList();
        if (col === 'purchase_invoices' && typeof renderPurchasesHistory === 'function') renderPurchasesHistory();
        if (col === 'smart_notes' && typeof renderNotesList === 'function') renderNotesList();
        if (col === 'treasury_moves') {
            if (typeof renderMovementsTable === 'function') renderMovementsTable();
            if (typeof updateTreasuryUI === 'function' && !window.DB._isSavingVaults) {
                window.DB._isSavingVaults = true;
                try { updateTreasuryUI(); } catch (e) {}
                setTimeout(() => { window.DB._isSavingVaults = false; }, 200);
            }
        }
        if (typeof calculateCollectedData === 'function') calculateCollectedData();
    } catch (e) {}
}

// =========================================================
// 3. العمود الثاني والثالث والرابع: المخزن، المحاسبة الصريحة، والخزينة الموحدة (window.DB)
// =========================================================
window.DB = {
    syncFromCloud: function() {
        if (!cloudReady || !navigator.onLine || !window.dbCloud) {
            SerajAlert("يجب الاتصال بالإنترنت لسحب بيانات المحل من السحابة!", "error");
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            SerajConfirm("سيتم مسح الذاكرة الحالية لهذا الجهاز وتحميل الداتا الموحدة من السحابة بالكامل. هل أنت متأكد؟", (confirm) => {
                if (!confirm) return resolve(false);

                showCloudStatus("⏳ جاري تحميل داتا المحل بالكامل من السحابة...");
                window.dbCloud.ref('Seraj_V4_Stores/' + currentStoreId).once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        let data = snapshot.val();
                        let safeArray = (obj) => obj ? Object.values(obj) : [];

                        const cols = ['products', 'customers', 'suppliers', 'sales_invoices', 'purchase_invoices', 'treasury_moves', 'smart_notes'];
                        cols.forEach(c => {
                            let arr = safeArray(data[c]);
                            localStorage.setItem('seraj_' + c, JSON.stringify(arr));
                            localStorage.setItem('seraj_cloud_cache_' + c, JSON.stringify(arr));
                            localCollectionsCache[c] = arr;
                        });

                        _memSyncQueue = [];
                        _memDelQueue = [];
                        _saveSyncQueueToStorage();
                        _saveDelQueueToStorage();
                        _seqInitialized = false;

                        this.recalculateVaultBalances(true);

                        SerajAlert("✅ تم تحميل بيانات المحل وتوحيدها بنجاح! سيتم إعادة تحديث الصفحة.", "success", () => {
                            window.location.reload();
                        });
                        resolve(true);
                    } else {
                        SerajAlert("⚠️ لا توجد أي بيانات سحابية مسجلة لهذا المحل (" + currentStoreId + ")!", "error");
                        resolve(false);
                    }
                }).catch(err => {
                    SerajAlert("خطأ في الاتصال بالسحابة: " + err.message, "error");
                    resolve(false);
                });
            });
        });
    },

    getCollection: function(colName, defaultVal = []) {
        let key = colName.startsWith('seraj_') ? colName : 'seraj_' + colName;
        return safeParseJSON(localStorage.getItem(key), defaultVal);
    },

    saveCollection: function(colName, data, syncToCloud = true) {
        let cleanCol = colName.replace(/^seraj_/, '');
        let key = 'seraj_' + cleanCol;
        localStorage.setItem(key, JSON.stringify(data));
        if (syncToCloud && Array.isArray(data)) {
            saveArrayToQueueSafely(cleanCol, data);
        } else {
            emitSerajUpdate(cleanCol, 'local');
        }
    },

    deleteItem: function(colName, id, mode = 'soft') {
        let cleanCol = colName.replace(/^seraj_/, '');
        let list = this.getCollection(cleanCol, []);
        let targetId = String(id);

        if (mode === 'hard' || cleanCol === 'treasury_moves') {
            let filtered = list.filter(item => String(item?.id) !== targetId);
            localStorage.setItem('seraj_' + cleanCol, JSON.stringify(filtered));
            localStorage.setItem('seraj_cloud_cache_' + cleanCol, JSON.stringify(filtered));
            localCollectionsCache[cleanCol] = filtered;
            addToDeleteQueue(cleanCol, targetId);
            if (cleanCol === 'treasury_moves') this.recalculateVaultBalances(true);
            emitSerajUpdate(cleanCol, 'delete');
            return true;
        } else {
            let updated = false;
            list.forEach(item => {
                if (item && String(item.id) === targetId) {
                    if (cleanCol.includes('invoices')) {
                        item.isCanceled = true;
                    } else {
                        item.isArchived = true;
                        item.isDeleted = true;
                    }
                    item._lastModified = Date.now();
                    item._lastModifiedBy = myDeviceName;
                    updated = true;
                }
            });
            if (updated) this.saveCollection(cleanCol, list, true);
            return updated;
        }
    },

    // --- المخزن والدفعات (Products & FIFO) ---
    getProducts: function(includeArchived = false) {
        let products = safeParseJSON(localStorage.getItem('seraj_products'), []);
        return includeArchived ? products : products.filter(p => p && !p.isArchived && !p.isDeleted);
    },

    saveProducts: function(data) {
        if (!Array.isArray(data)) return;
        let normMap = new Map();
        let cleaned = [];

        data.forEach(p => {
            if (!p) return;
            if (p.isDeleted || p.isArchived) {
                p.isArchived = true;
                p.isDeleted = true;
                cleaned.push(p);
                return;
            }
            let norm = window.Utils.normalizeName(p.name);
            if (!norm || !normMap.has(norm)) {
                if (norm) normMap.set(norm, p);
                cleaned.push(p);
            } else {
                let existing = normMap.get(norm);
                if (String(p.id) !== String(existing.id)) {
                    addToDeleteQueue('products', p.id);
                }
                if (Array.isArray(p.lots) && p.lots.length > 0) {
                    if (!Array.isArray(existing.lots)) existing.lots = [];
                    existing.lots.push(...p.lots);
                    existing.stock = existing.lots.reduce((sum, lot) => sum + (parseFloat(lot.stock) || 0), 0);
                } else {
                    existing.stock = (parseFloat(existing.stock) || 0) + (parseFloat(p.stock) || 0);
                }
            }
        });
        localStorage.setItem('seraj_products', JSON.stringify(cleaned));
        saveArrayToQueueSafely('products', cleaned);
    },

    // --- دمج الأسماء المكررة وحساب السندات المخصصة للفواتير ---
    _deduplicateEntities: function(list, colName) {
        if (!Array.isArray(list)) return { cleaned: [], idRedirectMap: new Map(), changed: false };
        let normMap = new Map();
        let idRedirectMap = new Map();
        let cleaned = [];
        let changed = false;

        list.forEach(item => {
            if (!item || !item.name) return;
            if (item.isDeleted || item.isArchived) {
                cleaned.push(item);
                return;
            }
            let norm = window.Utils.normalizeName(item.name);
            if (!norm) return;

            if (!normMap.has(norm)) {
                item.name = String(item.name).trim();
                if (!Array.isArray(item.transactions)) item.transactions = [];
                normMap.set(norm, item);
                cleaned.push(item);
            } else {
                let primary = normMap.get(norm);
                changed = true;
                if (String(item.id) !== String(primary.id)) {
                    idRedirectMap.set(String(item.id), primary.id);
                    addToDeleteQueue(colName, item.id);
                }
                if (!primary.phone && item.phone) primary.phone = item.phone;
                if (!primary.notes && item.notes) primary.notes = item.notes;
                if (Array.isArray(item.transactions) && item.transactions.length > 0) {
                    let existingTxIds = new Set(primary.transactions.map(t => String(t?.id)));
                    item.transactions.forEach(tx => {
                        if (tx && !existingTxIds.has(String(tx.id))) {
                            primary.transactions.push(tx);
                            existingTxIds.add(String(tx.id));
                        }
                    });
                }
            }
        });
        return { cleaned, idRedirectMap, changed };
    },

    _getAppliedVoucherAmountForInvoice: function(inv, validTransactions, isSupplier = false) {
        let appliedAmount = 0;
        let invIdStr = String(inv.id);

        validTransactions.forEach(t => {
            if (!t) return;
            let isTargetVoucher = isSupplier
                ? (t.type === 'payment' || t.type === 'purchase_payment')
                : (t.type === 'receipt');
            if (!isTargetVoucher) return;

            if (Array.isArray(t.allocatedInvoices)) {
                let alloc = t.allocatedInvoices.find(a => String(a.id) === invIdStr);
                if (alloc) appliedAmount += parseFloat(alloc.deducted) || 0;
            }
        });
        return Math.round(appliedAmount * 100) / 100;
    },

    // --- العملاء (Customers) ---
    getCustomers: function(rawOnly = false) {
        let customers = safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
        return rawOnly ? customers : this.calculateCustomerBalances(null, customers);
    },

    saveCustomers: function(data) {
        if (!Array.isArray(data)) return;
        let dedup = this._deduplicateEntities(data, 'customers');
        let dataToSave = dedup.cleaned.map(c => {
            let cleanC = _stripRuntimeFields(c);
            if (cleanC.name) cleanC.name = String(cleanC.name).trim();
            return cleanC;
        });
        localStorage.setItem('seraj_customers', JSON.stringify(dataToSave));
        saveArrayToQueueSafely('customers', dataToSave);
    },

    calculateCustomerBalances: function(targetCustomerId = null, preloadedCustomers = null) {
        let customers = preloadedCustomers || safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
        let invoices = this.getSalesInvoices(false);

        customers.forEach(c => {
            let cIdStr = String(c.id);
            let cNorm = window.Utils.normalizeName(c.name || '');

            let totalInvoicesReq = 0;
            let totalCheckoutPaid = 0;
            let deferredTotal = 0;

            let validTransactions = Array.isArray(c.transactions)
                ? c.transactions.filter(t => t && t.type !== 'log' && !t.isCanceled && t.status !== 'deleted' && !t.isDeleted)
                : [];

            let cInvs = invoices.filter(inv => {
                if (!inv || inv.type === 'quotation') return false;
                let invCustNorm = window.Utils.normalizeName(inv.customer || '');
                return (inv.customerId !== undefined && inv.customerId !== null && String(inv.customerId) === cIdStr) ||
                       (cNorm !== '' && invCustNorm === cNorm);
            });

            cInvs.forEach(inv => {
                let totalVal = parseFloat(inv.total) || 0;
                let discVal = parseFloat(inv.discount) || 0;
                let paidVal = parseFloat(inv.paid) || 0;
                let remVal = parseFloat(inv.remaining) || 0;
                let req = (Math.abs((paidVal + remVal) - totalVal) < 0.05 && discVal > 0) ? totalVal : (totalVal - discVal);
                if (req < 0) req = 0;

                let isReturn = (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');

                if (!isReturn) {
                    deferredTotal += remVal;
                    totalInvoicesReq += req;
                } else {
                    totalInvoicesReq -= req;
                }

                let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, validTransactions, false);
                let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
                    ? Math.max(0, parseFloat(inv.initialPaid))
                    : Math.max(0, paidVal - appliedAmount);

                if (checkoutPaid > 0) {
                    if (isReturn) totalCheckoutPaid -= checkoutPaid;
                    else totalCheckoutPaid += checkoutPaid;
                }
            });

            let totalVoucherDebt = 0;
            let totalVoucherReceipt = 0;
            validTransactions.forEach(t => {
                if (t.type === 'payment') totalVoucherDebt += (parseFloat(t.amount) || 0);
                if (t.type === 'receipt') totalVoucherReceipt += (parseFloat(t.amount) || 0);
            });

            let openingDebt = parseFloat(c.openingBalance) || 0;
            let netDebt = (totalInvoicesReq + totalVoucherDebt + openingDebt) - (totalCheckoutPaid + totalVoucherReceipt);
            netDebt = Math.round(netDebt * 100) / 100;
            deferredTotal = Math.round(deferredTotal * 100) / 100;

            c.balance = -netDebt;
            c.calculatedBalance = -netDebt;
            c.netBalanceVal = Math.abs(netDebt);
            c.isNetDebt = netDebt > 0;
            c.deferredInvoicesTotal = deferredTotal;

            let currentBal = netDebt - deferredTotal;
            c.displayCurrentBalance = Math.abs(Math.round(currentBal * 100) / 100);
            c.isCurrentBalDebt = currentBal > 0;
        });

        if (targetCustomerId !== null && targetCustomerId !== undefined) {
            return customers.find(c => String(c.id) === String(targetCustomerId)) || null;
        }
        return customers;
    },

    // --- الموردين (Suppliers) ---
    getSuppliers: function(rawOnly = false) {
        let suppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
        return rawOnly ? suppliers : this.calculateSupplierBalances(null, suppliers);
    },

    saveSuppliers: function(data) {
        if (!Array.isArray(data)) return;
        let dedup = this._deduplicateEntities(data, 'suppliers');
        let dataToSave = dedup.cleaned.map(s => {
            let cleanS = _stripRuntimeFields(s);
            if (cleanS.name) cleanS.name = String(cleanS.name).trim();
            return cleanS;
        });
        localStorage.setItem('seraj_suppliers', JSON.stringify(dataToSave));
        saveArrayToQueueSafely('suppliers', dataToSave);
    },

    calculateSupplierBalances: function(targetSupplierId = null, preloadedSuppliers = null) {
        let suppliers = preloadedSuppliers || safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
        let invoices = this.getPurchaseInvoices(false);

        suppliers.forEach(s => {
            let sIdStr = String(s.id);
            let sNorm = window.Utils.normalizeName(s.name || '');

            let totalInvoicesReq = 0;
            let totalCheckoutPaid = 0;
            let deferredTotal = 0;

            let validTransactions = Array.isArray(s.transactions)
                ? s.transactions.filter(t => t && t.type !== 'log' && !t.isCanceled && t.status !== 'deleted' && !t.isDeleted)
                : [];

            let sInvs = invoices.filter(inv => {
                if (!inv || inv.type === 'quotation') return false;
                let invSuppNorm = window.Utils.normalizeName(inv.supplier || '');
                return (inv.supplierId !== undefined && inv.supplierId !== null && String(inv.supplierId) === sIdStr) ||
                       (sNorm !== '' && invSuppNorm === sNorm);
            });

            sInvs.forEach(inv => {
                let totalVal = parseFloat(inv.total) || 0;
                let discVal = parseFloat(inv.discount) || 0;
                let paidVal = parseFloat(inv.paid) || 0;
                let remVal = parseFloat(inv.remaining) || 0;
                let req = (Math.abs((paidVal + remVal) - totalVal) < 0.05 && discVal > 0) ? totalVal : (totalVal - discVal);
                if (req < 0) req = 0;

                let isReturn = (inv.type === 'return' || inv.type === 'return_purchase' || inv.type === 'purchase_return');

                if (!isReturn) {
                    deferredTotal += remVal;
                    totalInvoicesReq += req;
                } else {
                    totalInvoicesReq -= req;
                }

                let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, validTransactions, true);
                let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
                    ? Math.max(0, parseFloat(inv.initialPaid))
                    : Math.max(0, paidVal - appliedAmount);

                if (checkoutPaid > 0) {
                    if (isReturn) totalCheckoutPaid -= checkoutPaid;
                    else totalCheckoutPaid += checkoutPaid;
                }
            });

            let totalVoucherPayment = 0;
            let totalVoucherReceipt = 0;
            validTransactions.forEach(t => {
                if (t.type === 'payment' || t.type === 'purchase_payment') totalVoucherPayment += (parseFloat(t.amount) || 0);
                if (t.type === 'receipt' || t.type === 'supplier_receipt') totalVoucherReceipt += (parseFloat(t.amount) || 0);
            });

            let openingDebt = parseFloat(s.openingBalance) || 0;
            let netDebtToSupplier = (totalInvoicesReq + totalVoucherReceipt + openingDebt) - (totalCheckoutPaid + totalVoucherPayment);
            netDebtToSupplier = Math.round(netDebtToSupplier * 100) / 100;
            deferredTotal = Math.round(deferredTotal * 100) / 100;

            s.balance = netDebtToSupplier;
            s.calculatedBalance = netDebtToSupplier;
            s.netBalanceVal = Math.abs(netDebtToSupplier);
            s.isNetDebt = netDebtToSupplier > 0;
            s.deferredInvoicesTotal = deferredTotal;

            let currentBal = netDebtToSupplier - deferredTotal;
            s.displayCurrentBalance = Math.abs(Math.round(currentBal * 100) / 100);
            s.isCurrentBalDebt = currentBal > 0;
        });

        if (targetSupplierId !== null && targetSupplierId !== undefined) {
            return suppliers.find(s => String(s.id) === String(targetSupplierId)) || null;
        }
        return suppliers;
    },

    // --- كشف الحساب الموحد (Customer & Supplier Statement) ---
    _buildUnifiedStatement: function(entityId, isSupplier = false, duration = 'allTime', customStartDate = null, customEndDate = null) {
        let entity = isSupplier ? this.calculateSupplierBalances(entityId) : this.calculateCustomerBalances(entityId);
        if (!entity) return null;

        let allInvoices = isSupplier ? this.getPurchaseInvoices(false) : this.getSalesInvoices(false);
        let eIdStr = String(entity.id);
        let eNorm = window.Utils.normalizeName(entity.name || '');

        let entityInvoices = allInvoices.filter(inv => {
            if (!inv || inv.type === 'quotation') return false;
            let invEntityNorm = window.Utils.normalizeName(isSupplier ? (inv.supplier || '') : (inv.customer || ''));
            let invEntityId = isSupplier ? inv.supplierId : inv.customerId;
            return (invEntityId !== undefined && invEntityId !== null && String(invEntityId) === eIdStr) ||
                   (eNorm !== '' && invEntityNorm === eNorm);
        });

        let vouchers = Array.isArray(entity.transactions)
            ? entity.transactions.filter(t => t && t.type !== 'log' && !t.isCanceled && t.status !== 'deleted' && !t.isDeleted)
            : [];

        let allItems = [];

        let openingDebt = parseFloat(entity.openingBalance) || 0;
        if (openingDebt !== 0) {
            allItems.push({
                date: entity.createdAt || '2020-01-01',
                title: 'رصيد افتتاحي',
                leh: openingDebt < 0 ? Math.abs(openingDebt) : 0,
                aleih: openingDebt > 0 ? openingDebt : 0,
                id: 0,
                notes: 'رصيد أول المدة'
            });
        }

        entityInvoices.forEach(inv => {
            let invTot = parseFloat(inv.total) || 0;
            let invDiscount = parseFloat(inv.discount) || 0;
            let invPaid = parseFloat(inv.paid) || 0;
            let invRem = parseFloat(inv.remaining) || 0;
            let finalReq = (Math.abs((invPaid + invRem) - invTot) < 0.05 && invDiscount > 0) ? invTot : (invTot - invDiscount);
            if (finalReq < 0) finalReq = 0;

            let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, vouchers, isSupplier);
            let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
                ? Math.max(0, parseFloat(inv.initialPaid))
                : Math.max(0, invPaid - appliedAmount);

            let isReturn = isSupplier
                ? (inv.type === 'return' || inv.type === 'return_purchase' || inv.type === 'purchase_return')
                : (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');

            let invoiceTypeLabel = isSupplier
                ? (isReturn ? '<span style="color:#ff1a40; font-weight:bold;">فاتورة مرتجع مشتريات</span>' : 'فاتورة مشتريات')
                : (isReturn ? '<span style="color:#ff1a40; font-weight:bold;">فاتورة مرتجع بيع</span>' : 'فاتورة بيع');

            allItems.push({
                date: inv.date,
                title: `${invoiceTypeLabel} رقم: ${inv.id}`,
                leh: isReturn ? finalReq : 0,
                aleih: isReturn ? 0 : finalReq,
                id: inv.id,
                notes: inv.notes || '---'
            });

            if (checkoutPaid > 0) {
                let receiptLabel = isSupplier
                    ? (isReturn ? 'استرداد نقدي أثناء المرتجع' : 'سداد نقدي أثناء الشراء')
                    : (isReturn ? 'رد نقدي أثناء المرتجع' : 'تحصيل نقدي أثناء البيع');
                allItems.push({
                    date: inv.date,
                    title: `${receiptLabel} (فاتورة ${inv.id})`,
                    leh: isReturn ? 0 : checkoutPaid,
                    aleih: isReturn ? checkoutPaid : 0,
                    id: String(inv.id) + '_cash',
                    notes: '---'
                });
            }
        });

        vouchers.forEach(t => {
            let isPaymentReduceDebt = isSupplier
                ? (t.type === 'payment' || t.type === 'purchase_payment')
                : (t.type === 'receipt');
            let titleText = isSupplier
                ? (isPaymentReduceDebt ? `سند سداد لمورد رقم ${t.id}` : `سند استلام من مورد رقم ${t.id}`)
                : (isPaymentReduceDebt ? `سند تحصيل نقدية رقم ${t.id}` : `سند مديونية رقم ${t.id}`);

            let editTag = (t._lastModifiedBy && t._device && t._lastModifiedBy !== t._device) ? `✏️ تعديل: ${t._lastModifiedBy}` : '';
            let devName = t._device ? `<br><span style="font-size:11px; color:#38bdf8;">💻 سُجل بواسطة: ${t._device} ${editTag}</span>` : '';

            allItems.push({
                date: t.date,
                title: `${titleText} ${devName}`,
                leh: isPaymentReduceDebt ? (parseFloat(t.amount) || 0) : 0,
                aleih: !isPaymentReduceDebt ? (parseFloat(t.amount) || 0) : 0,
                id: t.id,
                notes: t.notes || '---'
            });
        });

        let now = new Date();
        let prevLeh = 0, prevAleih = 0;
        let combined = [];

        allItems.forEach(item => {
            if (!item.date) { combined.push(item); return; }
            let itemDate = new Date(item.date);
            let includeInCurrent = false;

            if (duration === 'allTime') {
                includeInCurrent = true;
            } else if (duration === 'custom' && customStartDate && customEndDate) {
                let itemTime = itemDate.getTime();
                let startTime = new Date(customStartDate).getTime();
                let endTime = new Date(customEndDate).getTime() + 86399999;
                if (itemTime >= startTime && itemTime <= endTime) includeInCurrent = true;
                else if (itemTime < startTime) { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === 'today') {
                if (itemDate.toDateString() === now.toDateString()) includeInCurrent = true;
                else if (itemDate < now) { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === 'yesterday') {
                let yest = new Date(now); yest.setDate(now.getDate() - 1);
                if (itemDate.toDateString() === yest.toDateString()) includeInCurrent = true;
                else if (itemDate < yest) { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === '7days') {
                let d = new Date(now); d.setDate(now.getDate() - 7); d.setHours(0,0,0,0);
                if (itemDate >= d) includeInCurrent = true;
                else { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === 'thisMonth') {
                let startM = new Date(now.getFullYear(), now.getMonth(), 1);
                if (itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()) includeInCurrent = true;
                else if (itemDate < startM) { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === '30days') {
                let d = new Date(now); d.setDate(now.getDate() - 30); d.setHours(0,0,0,0);
                if (itemDate >= d) includeInCurrent = true;
                else { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === 'lastMonth') {
                let lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                if (itemDate.getMonth() === lm.getMonth() && itemDate.getFullYear() === lm.getFullYear()) includeInCurrent = true;
                else if (itemDate < lm) { prevLeh += item.leh; prevAleih += item.aleih; }
            } else {
                includeInCurrent = true;
            }
            if (includeInCurrent) combined.push(item);
        });

        combined.sort((a, b) => {
            let dateDiff = window.Utils.getSafeTime(a.date) - window.Utils.getSafeTime(b.date);
            if (dateDiff !== 0) return dateDiff;
            return String(a.id).localeCompare(String(b.id));
        });

        let totalLeh = 0, totalAleih = 0;
        combined.forEach(item => {
            totalLeh += item.leh;
            totalAleih += item.aleih;
        });

        let netDebt = isSupplier ? (entity.balance || 0) : -(entity.balance || 0);
        return {
            entity: entity,
            rows: combined,
            prevAleih: Math.round(prevAleih * 100) / 100,
            prevLeh: Math.round(prevLeh * 100) / 100,
            totalAleih: Math.round(totalAleih * 100) / 100,
            totalLeh: Math.round(totalLeh * 100) / 100,
            netDebt: Math.round(netDebt * 100) / 100,
            isNetDebt: netDebt > 0
        };
    },

    getCustomerStatement: function(customerId, duration = 'allTime', customStartDate = null, customEndDate = null) {
        return this._buildUnifiedStatement(customerId, false, duration, customStartDate, customEndDate);
    },

    getSupplierStatement: function(supplierId, duration = 'allTime', customStartDate = null, customEndDate = null) {
        return this._buildUnifiedStatement(supplierId, true, duration, customStartDate, customEndDate);
    },

    // --- فواتير المبيعات والمشتريات والنواقص ---
    getSalesInvoices: function(includeCanceled = true) {
        let invs = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
        return includeCanceled ? invs : invs.filter(inv => inv && !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
    },

    saveSalesInvoices: function(data) {
        if (!Array.isArray(data)) return;
        let now = Date.now();
        let cleanData = data.map(inv => {
            if (!inv) return null;
            try {
                let cleanInv = JSON.parse(JSON.stringify(inv));
                if (!cleanInv.timestamp) cleanInv.timestamp = now;
                if (cleanInv.type === 'canceled' || cleanInv.status === 'deleted' || cleanInv.isDeleted) cleanInv.isCanceled = true;
                if (cleanInv.customer) cleanInv.customer = String(cleanInv.customer).trim();
                return cleanInv;
            } catch (err) {
                return inv;
            }
        }).filter(Boolean);

        localStorage.setItem('seraj_sales_invoices', JSON.stringify(cleanData));
        saveArrayToQueueSafely('sales_invoices', cleanData);
    },

    getPurchaseInvoices: function(includeCanceled = true) {
        let invs = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
        return includeCanceled ? invs : invs.filter(inv => inv && !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
    },

    savePurchaseInvoices: function(data, newInvoiceItems = null) {
        if (!Array.isArray(data)) return;
        let now = Date.now();
        data.forEach(inv => {
            if (!inv) return;
            if (!inv.timestamp) inv.timestamp = now;
            if (inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted) inv.isCanceled = true;
            if (inv.supplier) inv.supplier = String(inv.supplier).trim();
        });
        localStorage.setItem('seraj_purchase_invoices', JSON.stringify(data));
        saveArrayToQueueSafely('purchase_invoices', data);

        if (newInvoiceItems && newInvoiceItems.length > 0) {
            this.cleanSmartNotesAfterPurchase(newInvoiceItems);
        }
    },

    cleanSmartNotesAfterPurchase: function(newInvoiceItems) {
        if (!newInvoiceItems || newInvoiceItems.length === 0) return;
        let smartNotesDB = this.getSmartNotes();
        let isModified = false;
        let purchasedNorms = newInvoiceItems.map(item => window.Utils.normalizeName(item.name)).filter(Boolean);

        for (let i = smartNotesDB.length - 1; i >= 0; i--) {
            let note = smartNotesDB[i];
            if (note && Array.isArray(note.items) && note.items.length > 0) {
                let originalCount = note.items.length;
                note.items = note.items.filter(noteItem => {
                    let rawName = String(noteItem.name || noteItem.text || '').replace(/<[^>]*>?/gm, '').replace(/\(مؤرشف\)/g, '');
                    let normNoteItem = window.Utils.normalizeName(rawName);
                    return !purchasedNorms.includes(normNoteItem);
                });
                if (note.items.length !== originalCount) {
                    isModified = true;
                    if (note.items.length === 0 && (!note.title || note.title.includes('بدون اسم') || note.title.includes('نواقص'))) {
                        smartNotesDB.splice(i, 1);
                    }
                }
            }
        }
        if (isModified) this.saveSmartNotes(smartNotesDB);
    },

    // --- الخزينة الموحدة (Treasury & Vaults) ---
    getTreasuryMoves: function(includeCanceled = true) {
        let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        return includeCanceled ? moves : moves.filter(m => m && !m.isCanceled && m.type !== 'canceled' && !m.isDeleted && m.status !== 'deleted');
    },

    saveTreasuryMoves: function(data) {
        if (!Array.isArray(data)) return;
        data.forEach(m => {
            if (!m) return;
            if (!m.vault) m.vault = m.treasury || 'main';
        });
        localStorage.setItem('seraj_treasury_moves', JSON.stringify(data));
        saveArrayToQueueSafely('treasury_moves', data);
    },

    getVaults: function() {
        return safeParseJSON(localStorage.getItem('seraj_vaults_v2'), { main: 0, insta: 0, wallet: 0 });
    },

    _isSavingVaults: false,

    saveVaults: function(data) {
        if (this._isSavingVaults) return;
        let cleanVaults = {
            main: Math.round((parseFloat(data?.main) || 0) * 100) / 100,
            insta: Math.round((parseFloat(data?.insta) || 0) * 100) / 100,
            wallet: Math.round((parseFloat(data?.wallet) || 0) * 100) / 100
        };
        let newStr = JSON.stringify(cleanVaults);
        let oldStr = localStorage.getItem('seraj_vaults_v2');
        if (newStr === oldStr) return;

        this._isSavingVaults = true;
        try {
            localStorage.setItem('seraj_vaults_v2', newStr);
            if (cloudReady && navigator.onLine && window.dbCloud) {
                window.dbCloud.ref('Seraj_V4_Stores/' + currentStoreId + '/vaults_v2').set(cleanVaults);
            }
            emitSerajUpdate('vaults_v2', 'local');
        } finally {
            setTimeout(() => { this._isSavingVaults = false; }, 150);
        }
    },

    // المصدر الوحيد لحساب الخزائن في كل التليفونات لمنع أي اختلاف بين الأجهزة
    recalculateVaultBalances: function(autoSave = true) {
        let moves = this.getTreasuryMoves(false);
        let vaults = { main: 0, insta: 0, wallet: 0 };
        moves.forEach(m => {
            let vKey = m.vault || 'main';
            if (vaults[vKey] === undefined) vKey = 'main';
            let add = parseFloat(m.amountAdd) || 0;
            let ded = parseFloat(m.amountDeduct) || 0;
            vaults[vKey] += (add - ded);
        });
        vaults.main = Math.round(vaults.main * 100) / 100;
        vaults.insta = Math.round(vaults.insta * 100) / 100;
        vaults.wallet = Math.round(vaults.wallet * 100) / 100;
        if (autoSave && !this._isSavingVaults) {
            this.saveVaults(vaults);
        }
        return vaults;
    },

    recordTreasuryTransaction: function(moveObj) {
        if (!moveObj) return null;
        let moves = this.getTreasuryMoves(true);

        let vKey = moveObj.vault || moveObj.treasury || 'main';
        if (vKey !== 'main' && vKey !== 'insta' && vKey !== 'wallet') {
            let low = String(vKey).toLowerCase();
            vKey = (low.includes('insta') || low.includes('انستا') || low.includes('إنستا')) ? 'insta' : ((low.includes('wallet') || low.includes('محفظ')) ? 'wallet' : 'main');
        }

        let amountAdd = parseFloat(moveObj.amountAdd) || 0;
        let amountDeduct = parseFloat(moveObj.amountDeduct) || 0;
        if (amountAdd === 0 && amountDeduct === 0 && moveObj.amount) {
            let rawAmt = parseFloat(moveObj.amount) || 0;
            let isOut = (moveObj.direction === 'out' || moveObj.type === 'payment' || moveObj.type === 'purchase' || moveObj.type === 'purchases' || moveObj.type === 'purchase_payment' || moveObj.type === 'expenses' || moveObj.type === 'return_sale' || moveObj.type === 'sales_return');
            if (isOut) amountDeduct = rawAmt;
            else amountAdd = rawAmt;
        }

        let moveId = moveObj.id || window.Utils.generateUniqueId();
        let newMove = {
            id: moveId,
            type: moveObj.type || 'direct',
            vault: vKey,
            treasury: vKey,
            amountAdd: Math.round(amountAdd * 100) / 100,
            amountDeduct: Math.round(amountDeduct * 100) / 100,
            amount: Math.round((amountAdd || amountDeduct) * 100) / 100,
            notes: moveObj.notes || '',
            date: moveObj.date || new Date().toISOString().split('T')[0],
            timestamp: moveObj.timestamp || Date.now(),
            invoiceNo: moveObj.invoiceNo || null,
            customerId: moveObj.customerId || null,
            customer: moveObj.customer ? String(moveObj.customer).trim() : null,
            supplierId: moveObj.supplierId || null,
            supplier: moveObj.supplier ? String(moveObj.supplier).trim() : null,
            _device: moveObj._device || myDeviceName,
            _lastModifiedBy: moveObj._lastModifiedBy || localStorage.getItem('cashier_name') || myDeviceName,
            _lastModified: Date.now()
        };

        let existingIdx = moves.findIndex(m => String(m?.id) === String(moveId));
        if (existingIdx > -1) moves[existingIdx] = newMove;
        else moves.unshift(newMove);

        this.saveTreasuryMoves(moves);
        this.recalculateVaultBalances(true);

        return newMove;
    },

    // --- الإعدادات والنوتة الذكية والسمات ---
    getStoreSettings: function() {
        return safeParseJSON(localStorage.getItem('seraj_store_settings'), {
            shopName: "سراج كاشير",
            shopPhone: "",
            footerNote: "شكراً لزيارتكم",
            deviceId: myDeviceName
        });
    },
    saveStoreSettings: function(settings) {
        localStorage.setItem('seraj_store_settings', JSON.stringify(settings));
        emitSerajUpdate('store_settings', 'local');
    },

    _isSavingSmartNotes: false,
    getSmartNotes: function() {
        return safeParseJSON(localStorage.getItem('seraj_smart_notes'), []);
    },
    saveSmartNotes: function(data) {
        if (this._isSavingSmartNotes) return;
        if (!Array.isArray(data)) data = [];
        this._isSavingSmartNotes = true;
        try {
            let oldNotes = safeParseJSON(localStorage.getItem('seraj_cloud_cache_smart_notes'), []);
            let oldMap = new Map(oldNotes.map(n => [String(n?.id), n]));
            let newIds = new Set();

            data.forEach((n, idx) => {
                if (!n) return;
                if (n.id === undefined || n.id === null) n.id = n.noteId || n.timestamp || (Date.now() + idx);
                let idStr = String(n.id);
                newIds.add(idStr);

                let oldN = oldMap.get(idStr);
                let oldCopy = oldN ? { ...oldN } : null;
                let newCopy = { ...n };
                if (oldCopy) { delete oldCopy._lastModified; delete oldCopy._senderUid; delete oldCopy.updatedBy; }
                delete newCopy._lastModified; delete newCopy._senderUid; delete newCopy.updatedBy;

                if (!oldCopy || JSON.stringify(oldCopy) !== JSON.stringify(newCopy) || !n._lastModified) {
                    n._lastModified = Date.now();
                    n.updatedBy = myDeviceName;
                    n._senderUid = myDeviceUid;
                    addToSyncQueue('smart_notes', n);
                }
            });

            oldNotes.forEach(oldN => {
                if (oldN && oldN.id !== undefined && !newIds.has(String(oldN.id))) {
                    addToDeleteQueue('smart_notes', oldN.id);
                }
            });

            localStorage.setItem('seraj_smart_notes', JSON.stringify(data));
            localStorage.setItem('seraj_cloud_cache_smart_notes', JSON.stringify(data));
            localCollectionsCache['smart_notes'] = [...data];
            processSyncQueue();
            emitSerajUpdate('smart_notes', 'local');
        } finally {
            this._isSavingSmartNotes = false;
        }
    },

    getAggregatedData: function() {
        return {
            sales: this.getSalesInvoices(true),
            purchases: this.getPurchaseInvoices(true),
            products: this.getProducts(true),
            customers: this.getCustomers(false),
            suppliers: this.getSuppliers(false),
            treasuryMoves: this.getTreasuryMoves(true),
            smartNotes: this.getSmartNotes()
        };
    },

    applySavedTheme: function() {
        let b = localStorage.getItem('seraj_theme_border');
        let g = localStorage.getItem('seraj_theme_glow');
        let bg1 = localStorage.getItem('seraj_theme_bg1');
        let bg2 = localStorage.getItem('seraj_theme_bg2');
        let card = localStorage.getItem('seraj_theme_card');
        let text = localStorage.getItem('seraj_theme_text');
        if (b && g) {
            document.documentElement.style.setProperty('--neon-border', b);
            document.documentElement.style.setProperty('--neon-glow', g);
            if (bg1) document.documentElement.style.setProperty('--bg-dark-1', bg1);
            if (bg2) document.documentElement.style.setProperty('--bg-dark-2', bg2);
            if (card) document.documentElement.style.setProperty('--card-bg', card);
            if (text) document.documentElement.style.setProperty('--text-main', text);
        }
    },

    // دوال توافق خفيفة جداً حتى لا يتعطل أي استدعاء في الصفحات قبل تنظيفها
    getActiveVoiceProfile: function() { return 'sales'; },
    setActiveVoiceProfile: function() {},
    getVoiceSettings: function() { return { searchThreshold: 55 }; },
    saveVoiceSettings: function() {},
    getVoiceSensitivity: function() { return 55; },
    saveVoiceSensitivity: function() {},
    getVoiceUnits: function() { return ["وات", "واط", "امبير", "فولت", "ملي", "مم", "سم", "متر", "بوصه", "حصان"]; },
    saveVoiceUnits: function() {},
    getVoiceDictionary: function() { return {}; },
    saveVoiceDictionary: function() {}
};

// =========================================================
// 4. النسخ الاحتياطي السحابي التلقائي
// =========================================================
function checkAndRunAutoCloudBackup() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return;
    let lastBackupTime = parseInt(localStorage.getItem('seraj_last_backup_timestamp') || '0', 10);
    let now = Date.now();
    if ((now - lastBackupTime) > 86400000) {
        let fullSystemSnapshot = {
            timestamp: now,
            dateFormatted: new Date().toLocaleString('ar-EG'),
            deviceName: myDeviceName,
            storeId: currentStoreId,
            ...window.DB.getAggregatedData(),
            vaults: window.DB.getVaults()
        };
        window.dbCloud.ref('Seraj_V4_Stores/' + currentStoreId + '/system_backup/latest_snapshot')
            .set(fullSystemSnapshot)
            .then(() => localStorage.setItem('seraj_last_backup_timestamp', String(now)))
            .catch(() => {});
    }
}

// =========================================================
// 5. محرك المايك الخفيف والمباشر (SmartVoice Lite)
// ينظف علامات الترقيم، يحول الأرقام المنطوقة، ويفصل الطلبات بـ (+) أو (زائد)
// =========================================================
window.cleanExcelText = function(text) {
    if (!text) return "";
    let t = String(text);
    if (typeof t.normalize === 'function') t = t.normalize('NFKC');
    return t.replace(/_x000d_/gi, ' ')
            .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\r\n]+/g, ' ')
            .replace(/\s+/g, ' ').trim();
};

const _spokenNumbersMap = {
    "واحد": 1, "واحده": 1, "واحدة": 1,
    "اتنين": 2, "اثنين": 2, "جوز": 2,
    "تلاته": 3, "تلاتة": 3, "ثلاثه": 3, "ثلاثة": 3, "تلات": 3, "ثلاث": 3,
    "اربعه": 4, "اربعة": 4, "اربع": 4,
    "خمسه": 5, "خمسة": 5, "خمس": 5,
    "سته": 6, "ستة": 6, "ست": 6,
    "سبعه": 7, "سبعة": 7, "سبع": 7,
    "تمانيه": 8, "تمانية": 8, "ثمانيه": 8, "ثمانية": 8, "تمن": 8,
    "تسعه": 9, "تسعة": 9, "تسع": 9,
    "عشره": 10, "عشرة": 10, "عشر": 10,
    "حداشر": 11, "اتناشر": 12, "دسته": 12, "دستة": 12,
    "عشرين": 20, "تلاتين": 30, "ثلاثين": 30, "اربعين": 40, "خمسين": 50,
    "ميه": 100, "مائة": 100, "متين": 200, "نص": 0.5, "نصف": 0.5, "ربع": 0.25
};

const _protectedUnits = new Set(["وات", "واط", "امبير", "فولت", "ملي", "مم", "سم", "متر", "بوصه", "بوصة", "حصان", "فاز", "خط", "طرف"]);

const SmartVoice = {
    _invalidateShadowCache: function() {},

    peeler: function(text) {
        if (!text) return "";
        return window.Utils.normalizeName(window.cleanExcelText(text))
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
            .replace(/(\d+(?:\.\d+)?)([^\d\s\.×\+\/])/g, '$1 $2')
            .replace(/([^\d\s\.×\+\/])(\d+(?:\.\d+)?)/g, '$1 $2')
            .replace(/\s+/g, ' ').trim();
    },

    analyzeFullText: function(rawText, customInventoryDB, profileOverride) {
        if (!rawText || !String(rawText).trim()) return { queue: [], logsHTML: "" };

        let activeProfile = profileOverride || 'sales';
        let cleaned = window.cleanExcelText(rawText)
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
            .replace(/(\d+(?:\.\d+)?)([^\d\s\.×\+\/])/g, '$1 $2')
            .replace(/([^\d\s\.×\+\/])(\d+(?:\.\d+)?)/g, '$1 $2')
            // تحويل النقط والفواصل وكلمة (زائد) إلى فاصل طلبات (+)
            .replace(/[\.،,؛\-!؟\?]+/g, ' + ')
            .replace(/(^|\s)(?:زائد|و\s*كمان|وكمان)(?=\s|$)/g, ' + ');

        let chunks = cleaned.split('+').map(c => c.trim()).filter(Boolean);
        let queue = [];

        chunks.forEach(chunk => {
            let words = chunk.split(/\s+/).filter(Boolean);
            if (words.length === 0) return;

            // تحويل الكلمات الرقمية إلى أرقام حسابية
            words = words.map(w => {
                let normW = window.Utils.normalizeName(w);
                return _spokenNumbersMap[normW] !== undefined ? String(_spokenNumbersMap[normW]) : w;
            });

            let qty = 1;
            let firstNum = parseFloat(words[0]);

            // إذا كان أول الكلام رقماً ولم يتبعه وحدة قياس (مثل 9 وات)، يسحب ككمية في البيع والمشتريات
            if (!isNaN(firstNum) && words.length > 1) {
                let secondNorm = window.Utils.normalizeName(words[1]);
                if (!_protectedUnits.has(secondNorm)) {
                    qty = firstNum;
                    words.shift();
                }
            }

            let itemName = words.join(' ').trim();
            if (!itemName) return;

            queue.push({
                qty: activeProfile === 'inventory' ? 1 : qty,
                displayQty: activeProfile === 'inventory' ? '' : qty,
                name: itemName,
                cleanName: itemName,
                score: 100
            });
        });

        return { queue: queue, logsHTML: "", activeProfile: activeProfile };
    },

    parseCommand: function(rawChunk, inventoryDB, profileOverride) {
        let res = this.analyzeFullText(rawChunk, inventoryDB, profileOverride);
        return (res.queue && res.queue.length > 0) ? { name: res.queue[0].name, qty: res.queue[0].qty } : null;
    }
};
window.SmartVoice = SmartVoice;

// تشغيل القالب المحفوظ والاتصال بالسحابة فور التحميل
window.DB.applySavedTheme();
initCloud();

// التقاط تلقائي لأي حفظ مباشر في النوتة الذكية ورفعه للسحابة
const _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (key === 'seraj_smart_notes' && window.DB && !window.DB._isSavingSmartNotes) {
        try {
            let parsed = JSON.parse(value);
            if (Array.isArray(parsed)) window.DB.saveSmartNotes(parsed);
        } catch (e) {}
    }
};