// 🌟 محرك سراج كاشير المركزي (النسخة المعمارية الموحدة النهائية - V3 Final)
// العمود الفقري الشامل لربط صفحات: المخزن، المبيعات، سجل المبيعات، المشتريات، سجل المشتريات، العملاء، الموردين، الخزينة، الصور، والمساعد الصوتي.

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
    myDeviceName = prompt("مرحباً بك في نسخة االأصليه (سراج كاشير) 🛠️\nبرجاء إدخال اسم مميز لهذا الجهاز:");
    if (!myDeviceName || myDeviceName.trim() === "") myDeviceName = "جهاز تجريبي";
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

    // فحص ذكي: إذا كانت الصفحة قد حمّلت firebase-app مسبقاً، لا نحمله مرة ثانية لمنع التحذير الأصفر
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

// ---------------------------------------------------------
// 1. Utilities (دوال المساعدة المركزية وبوابات الحماية)
// ---------------------------------------------------------
const _buttonLocks = new WeakSet();

window.Utils = {
    formatCurrency: function(amount) {
        let num = parseFloat(amount);
        if (isNaN(num)) return "0.00";
        return num.toFixed(2);
    },

    // دالة توحيد الأسماء العربية (توحيد الهمزات والتاء المربوطة والياء والمسافات لمنع التكرار)
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
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
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
        let prefix = (myDeviceName || 'DEV').substring(0, 3).toUpperCase();
        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 100);
    },

    generateUniqueId: function(prefix = '') {
        let lastSeq = parseInt(localStorage.getItem('seraj_short_seq_id') || '1000', 10);
        if (isNaN(lastSeq) || lastSeq < 1000) lastSeq = 1000;

        // فحص جميع الجداول لضمان أن الرقم الجديد أكبر من أي رقم قصير مسجل مسبقاً على أي جهاز
        try {
            const checkMax = (arr) => {
                if (!Array.isArray(arr)) return;
                arr.forEach(item => {
                    if (!item) return;
                    let numId = parseInt(String(item.id || '').replace(/\D/g, ''), 10);
                    if (!isNaN(numId) && numId >= 1000 && numId < 100000000 && numId > lastSeq) {
                        lastSeq = numId;
                    }
                    if (Array.isArray(item.transactions)) {
                        item.transactions.forEach(tx => {
                            let txNum = parseInt(String(tx?.id || '').replace(/\D/g, ''), 10);
                            if (!isNaN(txNum) && txNum >= 1000 && txNum < 100000000 && txNum > lastSeq) {
                                lastSeq = txNum;
                            }
                        });
                    }
                });
            };
            checkMax(safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_customers'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_suppliers'), []));
        } catch (e) {}

        let nextSeq = lastSeq + 1;
        localStorage.setItem('seraj_short_seq_id', String(nextSeq));
        return String(nextSeq);
    },

preventDoubleClick: function(btnOrEvent, actionFn = null, cooldownMs = 1500) {
        let btn = btnOrEvent && (btnOrEvent.currentTarget || btnOrEvent.target) 
            ? (btnOrEvent.currentTarget || btnOrEvent.target) 
            : btnOrEvent;

        if (btn && btn instanceof Element) {
            // إذا كان الزر قيد التنفيذ اللحظي حالياً (تم استدعاؤه من HTML ثم من داخل الدالة)، اسمح للدالة الداخلية بالمرور
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
                    if (res && typeof res.finally === 'function') {
                        res.finally(unlock);
                    } else {
                        unlock();
                    }
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
        } else {
            return typeof actionFn === 'function' ? actionFn() : true;
        }
    }
};

window.getSafeTime = function(d) { return window.Utils.getSafeTime(d); };
window.generateUniqueId = function(p) { return window.Utils.generateUniqueId(p); };

// جسر حماية ذكي: يمنع توقف الصفحات إذا استدعت .split() أو .trim() أو .includes() على رقم التاريخ الناتج من getSafeTime
if (!Number.prototype.split) {
    Object.defineProperty(Number.prototype, 'split', {
        value: function(sep, limit) {
            let ms = Number(this);
            let d = ms > 0 ? new Date(ms) : new Date();
            let str = (sep === 'T' || sep === '-') ? d.toISOString() : d.toLocaleString('ar-EG');
            return String(str).split(sep, limit);
        },
        configurable: true,
        writable: true
    });
}
if (!Number.prototype.trim) {
    Object.defineProperty(Number.prototype, 'trim', {
        value: function() { return String(this).trim(); },
        configurable: true,
        writable: true
    });
}
if (!Number.prototype.includes) {
    Object.defineProperty(Number.prototype, 'includes', {
        value: function(search, pos) {
            let ms = Number(this);
            let str = ms > 0 ? new Date(ms).toLocaleString('ar-EG') : String(this);
            return String(str).includes(search, pos);
        },
        configurable: true,
        writable: true
    });
}

// ---------------------------------------------------------
// 2. Global Modals (تدعم Callback وتدعم async/await Promise معاً)
// ---------------------------------------------------------
window.SerajAlert = function(message, type = 'info', callback = null) {
    return new Promise((resolve) => {
        let modal = document.createElement('div');
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,10,0.92); z-index:100000; display:flex; justify-content:center; align-items:center;';
        
        let box = document.createElement('div');
        let borderColor = type === 'error' ? 'var(--danger-color, #ff3333)' : (type === 'success' ? 'var(--success-color, #00ff66)' : 'var(--neon-border, #00e5ff)');
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
        
        let box = document.createElement('div');
        let warnColor = 'var(--warning-color, #ffcc00)';
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

// ---------------------------------------------------------
// 2.5. Central ImagesDB (محرك الصور المركزي الذكي - يدعم Blob و Base64 والـ ID الرقمي والنصي)
// ---------------------------------------------------------
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
                    let store = tx.objectStore(sName);
                    store.put({ id: String(productId), imageBlob: blobOrBase64, image: blobOrBase64, updatedAt: Date.now() });
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
                    let tx = db.transaction([sName], 'readonly');
                    let store = tx.objectStore(sName);
                    
                    let reqStr = store.get(String(productId));
                    reqStr.onsuccess = (e) => {
                        let rec = e.target.result;
                        if (rec && (rec.imageBlob || rec.image)) {
                            resolve(this._prepareOutput(rec.imageBlob || rec.image));
                        } else if (!isNaN(productId)) {
                            let reqNum = store.get(Number(productId));
                            reqNum.onsuccess = (ev) => {
                                let recNum = ev.target.result;
                                if (recNum && (recNum.imageBlob || recNum.image)) {
                                    resolve(this._prepareOutput(recNum.imageBlob || recNum.image));
                                } else {
                                    resolve(null);
                                }
                            };
                            reqNum.onerror = () => resolve(null);
                        } else {
                            resolve(null);
                        }
                    };
                    reqStr.onerror = () => resolve(null);
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
                    if (!isNaN(productId)) store.delete(Number(productId));
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (err) { resolve(false); }
            });
        }).catch(() => false);
    }
};
window.ImagesDB.open().catch(() => {});

// ---------------------------------------------------------
// 3. Sync Queue, Delete Queue & Smart Radars (نسخة التزامن اللحظي الكاملة)
// ---------------------------------------------------------
function safeParseJSON(str, fallback = []) {
    if (!str) return fallback;
    try {
        let parsed = JSON.parse(str);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return fallback;
    }
}

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
        }, 100);
    } catch (e) {}
}

let _syncTimer = null;
let _inFlightSyncKeys = new Set();

function scheduleSyncQueue() {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
        processSyncQueue();
    }, 100);
}

function addToSyncQueue(colName, itemData) {
    if (!itemData || itemData.id === undefined || itemData.id === null) return;
    let queue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    let idStr = String(itemData.id);
    queue = queue.filter(q => !(q.col === colName && String(q.data.id) === idStr)); 
    queue.push({ col: colName, data: itemData });
    localStorage.setItem('seraj_sync_queue', JSON.stringify(queue));
    scheduleSyncQueue();
}

function addToDeleteQueue(colName, itemId) {
    if (itemId === undefined || itemId === null) return;
    let delQueue = safeParseJSON(localStorage.getItem('seraj_delete_queue'), []);
    let idStr = String(itemId);
    if (!delQueue.some(q => q.col === colName && String(q.id) === idStr)) {
        delQueue.push({ col: colName, id: idStr });
        localStorage.setItem('seraj_delete_queue', JSON.stringify(delQueue));
    }
    let syncQueue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    syncQueue = syncQueue.filter(q => !(q.col === colName && String(q.data.id) === idStr));
    localStorage.setItem('seraj_sync_queue', JSON.stringify(syncQueue));
    processDeleteQueue();
}

function processDeleteQueue() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return;
    let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    let delQueue = safeParseJSON(localStorage.getItem('seraj_delete_queue'), []);
    if (delQueue.length === 0) return;

    delQueue.forEach(q => {
        let safeId = String(q.id).replace(/[.#$\[\]]/g, "_");
        let cloudRefName = 'test_Stores/' + activeStoreId + '/' + q.col + '/' + safeId;
        window.dbCloud.ref(cloudRefName).remove()
            .then(() => {
                let currentDelQueue = safeParseJSON(localStorage.getItem('seraj_delete_queue'), []);
                currentDelQueue = currentDelQueue.filter(item => !(item.col === q.col && String(item.id) === String(q.id)));
                localStorage.setItem('seraj_delete_queue', JSON.stringify(currentDelQueue));
            }).catch(e => console.error("Delete Sync Error:", e));
    });
}

function processSyncQueue() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return;
    let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    let queue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    if (queue.length === 0) return;

    showCloudStatus("⏳ جاري مزامنة التعديلات للسحابة...");

    let batch = queue.slice(0, 25);
    batch.forEach(q => {
        if (!q.data || q.data.id === undefined) return;
        let lockKey = q.col + '_' + String(q.data.id);
        if (_inFlightSyncKeys.has(lockKey)) return;
        _inFlightSyncKeys.add(lockKey);

        let safeId = String(q.data.id).replace(/[.#$\[\]]/g, "_");
        let cloudRefName = 'test_Stores/' + activeStoreId + '/' + q.col + '/' + safeId;
        
        window.dbCloud.ref(cloudRefName).set(q.data)
            .then(() => {
                _inFlightSyncKeys.delete(lockKey);
                let currentQueue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
                currentQueue = currentQueue.filter(item => !(item.col === q.col && String(item.data.id) === String(q.data.id)));
                localStorage.setItem('seraj_sync_queue', JSON.stringify(currentQueue));
                if (currentQueue.length > 0) scheduleSyncQueue();
            }).catch(e => {
                _inFlightSyncKeys.delete(lockKey);
                console.error("Sync Error", e);
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

// 🌟 إنعاش تلقائي للسحابة والطابور فور فتح شاشة التليفون أو العودة للمتصفح بعد خمول 🌟
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && cloudReady && window.dbCloud) {
        _inFlightSyncKeys.clear();
        try {
            window.dbCloud.goOnline();
        } catch (e) {}
        processDeleteQueue();
        scheduleSyncQueue();
    }
});

let localCollectionsCache = {};
let renderTimers = {};
let _bgSaveTimers = {};

function _stripRuntimeFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    let copy = { ...obj };
    delete copy._lastModified;
    delete copy.balance;
    delete copy.calculatedBalance;
    delete copy.netBalanceVal;
    delete copy.isNetDebt;
    delete copy.deferredInvoicesTotal;
    delete copy.displayCurrentBalance;
    delete copy.isCurrentBalDebt;
    return copy;
}

function saveArrayToQueueSafely(colName, newArray) {
    if (!Array.isArray(newArray)) newArray = [];
    localCollectionsCache[colName] = [...newArray];

    try {
        let rawOldCache = localStorage.getItem('seraj_cloud_cache_' + colName);
        
        if (!rawOldCache) {
            localStorage.setItem('seraj_cloud_cache_' + colName, JSON.stringify(newArray));
            let newest = getNewestItems(newArray, 25);
            newest.forEach(item => addToSyncQueue(colName, item));
            emitSerajUpdate(colName, 'local');
            return;
        }

        let oldArray = safeParseJSON(rawOldCache, []);
        let oldMap = new Map(oldArray.map(i => [String(i?.id), i]));
        let newMap = new Map(newArray.map(i => [String(i?.id), i]));
        let changedItems = [];
        
        newArray.forEach(newItem => {
            if (!newItem || newItem.id === undefined) return;
            let id = String(newItem.id);
            let oldItem = oldMap.get(id);
            if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                changedItems.push(newItem);
            }
        });

        // رفع جميع العناصر المتغيرة بدون إسقاط أي فاتورة بسبب حاجز الـ 30
        if (changedItems.length > 0) {
            let queue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
            changedItems.forEach(item => {
                let idStr = String(item.id);
                queue = queue.filter(q => !(q.col === colName && String(q.data.id) === idStr));
                queue.push({ col: colName, data: item });
            });
            localStorage.setItem('seraj_sync_queue', JSON.stringify(queue));
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

function startSmartRadars() {
    if (!cloudReady || !window.dbCloud) return;
    currentStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    const collections = ['products', 'customers', 'sales_invoices', 'suppliers', 'purchase_invoices', 'treasury_moves', 'smart_notes'];
    
    collections.forEach(col => {
        let ref = window.dbCloud.ref('test_Stores/' + currentStoreId + '/' + col);
        ref.off(); // منع تكرار المستمعات عند إعادة التهيئة
        ref.on('child_added', snap => updateLocalSingleItem(col, snap.val()));
        ref.on('child_changed', snap => updateLocalSingleItem(col, snap.val()));
        ref.on('child_removed', snap => removeLocalSingleItem(col, snap.key));
    });

    let vaultsRef = window.dbCloud.ref('test_Stores/' + currentStoreId + '/vaults_v2');
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

    let voiceRef = window.dbCloud.ref('test_Stores/' + currentStoreId + '/voice_config');
    voiceRef.off();
    voiceRef.on('value', snapshot => {
        if (snapshot.exists()) {
            let vCfg = snapshot.val();
            if (vCfg.settings) localStorage.setItem(window.DB._getVoiceStorageKey('settings'), JSON.stringify(vCfg.settings));
            if (vCfg.units) localStorage.setItem(window.DB._getVoiceStorageKey('units'), JSON.stringify(vCfg.units));
            if (vCfg.dictionary) localStorage.setItem(window.DB._getVoiceStorageKey('dict'), JSON.stringify(vCfg.dictionary));
            if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
            emitSerajUpdate('voice_config', 'cloud');
        }
    });
}

let _notifiedSmartNotes = {};

// بصمة فريدة لكل جهاز/متصفح لا تتأثر باستيراد النسخة الاحتياطية لضمان عمل الإشعار بين الأجهزة
let myDeviceUid = sessionStorage.getItem('seraj_device_uid');
if (!myDeviceUid) {
    myDeviceUid = 'uid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('seraj_device_uid', myDeviceUid);
}

// طلب إذن الإشعارات وتجهيز الصوت تلقائياً مع أول لمسة للمستخدم على الشاشة
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
        playBeep(587.33, now, 0.16);        // النغمة الأولى
        playBeep(880.00, now + 0.18, 0.30); // النغمة الثانية
    } catch (e) {
        console.warn("Audio Tone Error:", e);
    }
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
        let notifOptions = {
            body: notifBody,
            icon: '/icon.png',
            badge: '/icon.png',
            tag: 'seraj_note_' + data.id,
            renotify: true,
            vibrate: [200, 100, 200]
        };
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(notifTitle, notifOptions);
            }).catch(() => {
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

    let delQueue = safeParseJSON(localStorage.getItem('seraj_delete_queue'), []);
    if (delQueue.some(q => q.col === col && String(q.id) === docId)) return;

    // حماية التعديلات المحلية التي لم تترفع بعد من أن تدهسها نسخة قديمة من السحابة
    let syncQueue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    if (syncQueue.some(q => q.col === col && q.data && String(q.data.id) === docId)) return;

    if (!localCollectionsCache[col]) {
        localCollectionsCache[col] = safeParseJSON(localStorage.getItem('seraj_' + col), []);
    }
    let arr = localCollectionsCache[col];
    let existingIndex = arr.findIndex(item => String(item.id) === docId);
    
    let isChangedOrNew = false;
    if (existingIndex > -1) {
        let localItem = arr[existingIndex];
        let localMod = Number(localItem?._lastModified || 0);
        let cloudMod = Number(data?._lastModified || 0);
        if (localMod > 0 && cloudMod > 0 && localMod > cloudMod) return;
        if (JSON.stringify(localItem) === JSON.stringify(data)) return;
        arr[existingIndex] = data;
        isChangedOrNew = true;
    } else {
        arr.push(data);
        isChangedOrNew = true;
    }

    if (col === 'smart_notes' && isChangedOrNew) {
        let modTime = Number(data._lastModified || data.timestamp || 0);
        let isRecent = modTime > 0 && (Date.now() - modTime) < 120000;
        let isDifferentSession = data._senderUid ? (data._senderUid !== myDeviceUid) : (data.updatedBy !== myDeviceName);

        if (isRecent && isDifferentSession && _notifiedSmartNotes[docId] !== modTime) {
            _notifiedSmartNotes[docId] = modTime;
            triggerSmartNoteNotification(data);
        }
    }
    
    if (renderTimers[col]) clearTimeout(renderTimers[col]);
    renderTimers[col] = setTimeout(() => saveAndRenderLocal(col, localCollectionsCache[col]), 200);
}

function removeLocalSingleItem(col, docId) {
    if (!localCollectionsCache[col]) {
        localCollectionsCache[col] = safeParseJSON(localStorage.getItem('seraj_' + col), []);
    }
    localCollectionsCache[col] = localCollectionsCache[col].filter(item => String(item.id) !== String(docId));
    
    if (renderTimers[col]) clearTimeout(renderTimers[col]);
    renderTimers[col] = setTimeout(() => saveAndRenderLocal(col, localCollectionsCache[col]), 250);
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
// ---------------------------------------------------------
// 4. DB Master Object (العمود الفقري للعمليات والحسابات)
// ---------------------------------------------------------
window.DB = {
    // 🚀 دالة السحب الشامل لتهيئة تليفون جديد أو متصفح خفي
    syncFromCloud: function() {
        if (!cloudReady || !navigator.onLine || !window.dbCloud) {
            SerajAlert("يجب الاتصال بالإنترنت لسحب بيانات المحل من السحابة!", "error");
            return Promise.resolve(false);
        }
        
        return new Promise((resolve) => {
            SerajConfirm("سيتم مسح الذاكرة الحالية لهذا الجهاز وتحميل الداتا الموحدة من السحابة بالكامل. هل أنت متأكد؟", (confirm) => {
                if (!confirm) return resolve(false);

                showCloudStatus("⏳ جاري تحميل داتا المحل بالكامل من السحابة... برجاء الانتظار.");
                
                window.dbCloud.ref('test_Stores/' + currentStoreId).once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        let data = snapshot.val();
                        
                        // تحويل كائنات الفايربيز إلى مصفوفات ليفهمها البرنامج
                        let safeArray = (obj) => obj ? Object.values(obj) : [];

                        // 1. صب البيانات في الذاكرة المحلية (بدون ما نبعتها للطابور عشان مفيش تكرار)
                        localStorage.setItem('seraj_products', JSON.stringify(safeArray(data.products)));
                        localStorage.setItem('seraj_cloud_cache_products', JSON.stringify(safeArray(data.products)));

                        localStorage.setItem('seraj_customers', JSON.stringify(safeArray(data.customers)));
                        localStorage.setItem('seraj_cloud_cache_customers', JSON.stringify(safeArray(data.customers)));

                        localStorage.setItem('seraj_suppliers', JSON.stringify(safeArray(data.suppliers)));
                        localStorage.setItem('seraj_cloud_cache_suppliers', JSON.stringify(safeArray(data.suppliers)));

                        localStorage.setItem('seraj_sales_invoices', JSON.stringify(safeArray(data.sales_invoices)));
                        localStorage.setItem('seraj_cloud_cache_sales_invoices', JSON.stringify(safeArray(data.sales_invoices)));

                        localStorage.setItem('seraj_purchase_invoices', JSON.stringify(safeArray(data.purchase_invoices)));
                        localStorage.setItem('seraj_cloud_cache_purchase_invoices', JSON.stringify(safeArray(data.purchase_invoices)));

                        localStorage.setItem('seraj_treasury_moves', JSON.stringify(safeArray(data.treasury_moves)));
                        localStorage.setItem('seraj_cloud_cache_treasury_moves', JSON.stringify(safeArray(data.treasury_moves)));

                        if (data.vaults_v2) {
                            localStorage.setItem('seraj_vaults_v2', JSON.stringify(data.vaults_v2));
                        }

                        // 2. تنظيف طابور المزامنة القديم
                        localStorage.setItem('seraj_sync_queue', '[]');
                        localStorage.setItem('seraj_delete_queue', '[]');

                        SerajAlert("✅ تم تحميل بيانات المحل وتوحيدها بنجاح! سيتم إعادة تحديث الصفحة.", "success", () => {
                            window.location.reload();
                        });
                        resolve(true);
                    } else {
                        SerajAlert("⚠️ لا توجد أي بيانات سحابية مسجلة لهذا المحل (" + currentStoreId + ")!", "error");
                        resolve(false);
                    }
                }).catch(err => {
                    console.error(err);
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
            let filtered = list.filter(item => String(item.id) !== targetId);
            localStorage.setItem('seraj_' + cleanCol, JSON.stringify(filtered));
            localStorage.setItem('seraj_cloud_cache_' + cleanCol, JSON.stringify(filtered));
            localCollectionsCache[cleanCol] = filtered;
            addToDeleteQueue(cleanCol, targetId);
            if (cleanCol === 'treasury_moves') this.recalculateVaultBalances();
            emitSerajUpdate(cleanCol, 'delete');
            return true;
        } else {
            let updated = false;
list.forEach(item => {
                if (String(item.id) === targetId) {
                    if (cleanCol.includes('invoices')) {
                        item.isCanceled = true; // نكتفي بختم الإلغاء ونحافظ على نوع الفاتورة الأصلي
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

// دالة مساعدة لدمج العملاء أو الموردين المكررين في سجل واحد نظيف دون فقدان أي سند
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
                // وجدنا اسماً مكرراً: ندمج بياناته وسنداته في السجل الأساسي الأول ونحذف النسخة الزائدة
                let primary = normMap.get(norm);
                changed = true;
                if (String(item.id) !== String(primary.id)) {
                    idRedirectMap.set(String(item.id), primary.id);
                    addToDeleteQueue(colName, item.id);
                }
                if (!primary.phone && item.phone) primary.phone = item.phone;
                if (!primary.notes && item.notes) primary.notes = item.notes;
                if (item.lastActivityDate && (!primary.lastActivityDate || item.lastActivityDate > primary.lastActivityDate)) {
                    primary.lastActivityDate = item.lastActivityDate;
                }
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

        return { cleaned, idRedirectMap, normMap, changed };
    },

// دالة مساعدة لاستخراج المبلغ المسدد لفاتورة معينة من قائمة السندات بدقة بدون تداخل الأرقام المتشابهة
_getAppliedVoucherAmountForInvoice: function(inv, validTransactions, isSupplier = false) {
    let appliedAmount = 0;
    let invIdStr = String(inv.id);
    let escapedId = invIdStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let exactNoteRegex = new RegExp(`(?:\\(فاتورة\\s*${escapedId}\\)|سداد فواتير:[^\\n]*\\b${escapedId}\\b)`);

    validTransactions.forEach(t => {
        if (!t) return;
        let isTargetVoucher = isSupplier
            ? (t.type === 'payment' || t.type === 'purchase_payment')
            : (t.type === 'receipt');
        if (!isTargetVoucher) return;

        let inAllocated = Array.isArray(t.allocatedInvoices) && t.allocatedInvoices.find(a => String(a.id) === invIdStr);
        if (inAllocated) {
            appliedAmount += parseFloat(inAllocated.deducted) || 0;
        } else if (t.notes && exactNoteRegex.test(String(t.notes))) {
            appliedAmount += parseFloat(t.amount) || 0;
        }
    });
    return Math.round(appliedAmount * 100) / 100;
},

// دالة مساعدة لاسترجاع أي سند موجود في الخزينة وسقط من مصفوفة سندات العميل/المورد قبل الحساب
_collectUnifiedEntityTransactions: function(entity, allMoves, isSupplier = false) {
    let eIdStr = String(entity.id);
    let eNorm = window.Utils.normalizeName(entity.name || '');

    let validTransactions = Array.isArray(entity.transactions)
        ? entity.transactions.filter(t => t && t.type !== 'log' && !t.isCanceled && t.status !== 'deleted' && !t.isDeleted)
        : [];

    let recordedTxIds = new Set();
    validTransactions.forEach(t => {
        if (t.id !== undefined) recordedTxIds.add(String(t.id));
        if (t.invoiceNo !== undefined) recordedTxIds.add(String(t.invoiceNo));
    });

    allMoves.forEach(m => {
        if (!m || m.isCanceled || m.isDeleted || m.status === 'deleted') return;
        if (recordedTxIds.has(String(m.id)) || (m.invoiceNo && recordedTxIds.has(String(m.invoiceNo)))) return;

        if (isSupplier) {
            if (m.type !== 'suppliers' && m.type !== 'purchase_payment' && m.type !== 'supplier_receipt') return;
        } else {
            if (m.type !== 'customers' && m.type !== 'customer_receipt' && m.type !== 'customer_payment') return;
        }

        let mEntityNorm = window.Utils.normalizeName(isSupplier ? (m.supplier || m.supplierName || '') : (m.customer || m.customerName || ''));
        let mEntityId = isSupplier ? m.supplierId : m.customerId;
        let isMatch = (
            (mEntityId !== undefined && mEntityId !== null && String(mEntityId) === eIdStr) ||
            (eNorm !== '' && mEntityNorm === eNorm)
        );

        if (isMatch) {
            let add = parseFloat(m.amountAdd) || 0;
            let ded = parseFloat(m.amountDeduct) || 0;
            let amt = add || ded || (parseFloat(m.amount) || 0);
            if (amt <= 0) return;

            let mDateStr = String(m.date || '').split('T')[0].trim();
            let isDuplicate = validTransactions.some(t => {
                let tDateStr = String(t.date || '').split('T')[0].trim();
                return Math.abs((parseFloat(t.amount) || 0) - amt) < 0.01 && tDateStr === mDateStr;
            });

            if (!isDuplicate) {
                let cleanNotes = String(m.notes || '').replace(/^سند\s+(?:تحصيل|سحب|دفع|مورد)\s+رقم\s+[^:]+:\s*[^-]+-\s*/, '').trim();
                let txType = isSupplier
                    ? (ded > 0 || m.type === 'purchase_payment' ? 'payment' : 'receipt')
                    : (add > 0 || m.type === 'customer_receipt' ? 'receipt' : 'payment');

                validTransactions.push({
                    id: m.invoiceNo || m.id,
                    type: txType,
                    amount: amt,
                    notes: cleanNotes || m.notes || '',
                    treasury: m.vault || m.treasury || 'main',
                    date: m.date,
                    _device: m._device,
                    _lastModifiedBy: m._lastModifiedBy,
                    _restoredFromTreasury: true
                });
                recordedTxIds.add(String(m.id));
            }
        }
    });

    return validTransactions;
},

migrateOldData: function() {
    try {
        let rawCustomers = safeParseJSON(localStorage.getItem('seraj_customers'), []);
        let rawSuppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
        let products = safeParseJSON(localStorage.getItem('seraj_products'), []);
        let sales = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
        let purchases = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
        let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);

        // 1. دمج وتطهير الأسماء المكررة في العملاء والموردين
        let custDedup = this._deduplicateEntities(rawCustomers, 'customers');
        let customers = custDedup.cleaned;
        if (custDedup.changed) {
            localStorage.setItem('seraj_customers', JSON.stringify(customers));
            saveArrayToQueueSafely('customers', customers);
        }

        let suppDedup = this._deduplicateEntities(rawSuppliers, 'suppliers');
        let suppliers = suppDedup.cleaned;
        if (suppDedup.changed) {
            localStorage.setItem('seraj_suppliers', JSON.stringify(suppliers));
            saveArrayToQueueSafely('suppliers', suppliers);
        }

        let custMapByNorm = new Map();
        customers.forEach(c => {
            if (c && c.name && !c.isDeleted && !c.isArchived) {
                custMapByNorm.set(window.Utils.normalizeName(c.name), c);
            }
        });

        let suppMapByNorm = new Map();
        suppliers.forEach(s => {
            if (s && s.name && !s.isDeleted && !s.isArchived) {
                suppMapByNorm.set(window.Utils.normalizeName(s.name), s);
            }
        });

        // 2. دمج وتوحيد المنتجات المكررة بالاسم
        let prodChanged = false;
        let prodNormMap = new Map();
        let cleanedProducts = [];
        products.forEach(p => {
            if (!p) return;
            if (p.isDeleted === true && !p.isArchived) { p.isArchived = true; prodChanged = true; }
            if (p.isArchived === true && !p.isDeleted) { p.isDeleted = true; prodChanged = true; }
            
            if (p.isDeleted || p.isArchived) {
                cleanedProducts.push(p);
                return;
            }

            let normP = window.Utils.normalizeName(p.name);
            if (!normP || !prodNormMap.has(normP)) {
                if (Array.isArray(p.lots) && p.lots.length > 0) {
                    let calcStock = p.lots.reduce((sum, lot) => sum + (parseFloat(lot.stock) || 0), 0);
                    if (p.stock === undefined || p.stock === null || isNaN(parseFloat(p.stock))) {
                        p.stock = calcStock;
                        prodChanged = true;
                    }
                }
                if (normP) prodNormMap.set(normP, p);
                cleanedProducts.push(p);
            } else {
                let primaryP = prodNormMap.get(normP);
                prodChanged = true;
                if (String(p.id) !== String(primaryP.id)) {
                    addToDeleteQueue('products', p.id);
                }
                if (Array.isArray(p.lots) && p.lots.length > 0) {
                    if (!Array.isArray(primaryP.lots)) primaryP.lots = [];
                    primaryP.lots.push(...p.lots);
                    primaryP.stock = primaryP.lots.reduce((sum, lot) => sum + (parseFloat(lot.stock) || 0), 0);
                } else {
                    primaryP.stock = (parseFloat(primaryP.stock) || 0) + (parseFloat(p.stock) || 0);
                }
            }
        });
        if (prodChanged) localStorage.setItem('seraj_products', JSON.stringify(cleanedProducts));

        // 3. توحيد فواتير المبيعات وتوجيه الأرقام المكررة إلى الـ ID الأساسي للعميل
        let salesChanged = false;
        sales.forEach(inv => {
            if (!inv) return;
            if ((inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted === true) && !inv.isCanceled) {
                inv.isCanceled = true;
                salesChanged = true;
            }
            if (inv.customerId && custDedup.idRedirectMap.has(String(inv.customerId))) {
                inv.customerId = custDedup.idRedirectMap.get(String(inv.customerId));
                salesChanged = true;
            }
            let cNorm = window.Utils.normalizeName(inv.customer || inv.customerName || '');
            if (cNorm && custMapByNorm.has(cNorm)) {
                let matchedC = custMapByNorm.get(cNorm);
                if (String(inv.customerId) !== String(matchedC.id)) {
                    inv.customerId = matchedC.id;
                    salesChanged = true;
                }
                if (inv.customer !== matchedC.name) {
                    inv.customer = matchedC.name;
                    salesChanged = true;
                }
            }
        });
        if (salesChanged) localStorage.setItem('seraj_sales_invoices', JSON.stringify(sales));

        // 4. توحيد فواتير المشتريات وتوجيه الأرقام المكررة إلى الـ ID الأساسي للمورد
        let purchChanged = false;
        purchases.forEach(inv => {
            if (!inv) return;
            if ((inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted === true) && !inv.isCanceled) {
                inv.isCanceled = true;
                purchChanged = true;
            }
            if (inv.supplierId && suppDedup.idRedirectMap.has(String(inv.supplierId))) {
                inv.supplierId = suppDedup.idRedirectMap.get(String(inv.supplierId));
                purchChanged = true;
            }
            let sNorm = window.Utils.normalizeName(inv.supplier || inv.supplierName || '');
            if (sNorm && suppMapByNorm.has(sNorm)) {
                let matchedS = suppMapByNorm.get(sNorm);
                if (String(inv.supplierId) !== String(matchedS.id)) {
                    inv.supplierId = matchedS.id;
                    purchChanged = true;
                }
                if (inv.supplier !== matchedS.name) {
                    inv.supplier = matchedS.name;
                    purchChanged = true;
                }
            }
        });
        if (purchChanged) localStorage.setItem('seraj_purchase_invoices', JSON.stringify(purchases));

        // 5. توحيد حركات الخزينة
        let movesChanged = false;
        moves.forEach(m => {
            if (!m) return;
            if ((m.type === 'canceled' || m.type === 'cancelled' || m.status === 'deleted' || m.isDeleted === true) && !m.isCanceled) {
                m.isCanceled = true;
                movesChanged = true;
            }
            if (!m.vault && m.treasury) {
                let v = String(m.treasury).toLowerCase().trim();
                if (v.includes('insta') || v.includes('انستا') || v.includes('إنستا')) m.vault = 'insta';
                else if (v.includes('wallet') || v.includes('محفظ')) m.vault = 'wallet';
                else m.vault = 'main';
                movesChanged = true;
            } else if (!m.vault) {
                m.vault = 'main';
                movesChanged = true;
            }
            let add = parseFloat(m.amountAdd) || 0;
            let ded = parseFloat(m.amountDeduct) || 0;
            let rawAmt = parseFloat(m.amount) || 0;
            if (add === 0 && ded === 0 && rawAmt > 0) {
                let isOut = (m.direction === 'out' || m.type === 'payment' || m.type === 'purchase' || m.type === 'purchases' || m.type === 'purchase_payment' || m.type === 'expenses' || m.type === 'return_sale' || m.type === 'sales_return');
                if (isOut) m.amountDeduct = rawAmt;
                else m.amountAdd = rawAmt;
                movesChanged = true;
            }
            if (m.customerId && custDedup.idRedirectMap.has(String(m.customerId))) {
                m.customerId = custDedup.idRedirectMap.get(String(m.customerId));
                movesChanged = true;
            }
            let mcNorm = window.Utils.normalizeName(m.customer || m.customerName || '');
            if (!m.customerId && mcNorm && custMapByNorm.has(mcNorm)) {
                m.customerId = custMapByNorm.get(mcNorm).id;
                movesChanged = true;
            }
            if (m.supplierId && suppDedup.idRedirectMap.has(String(m.supplierId))) {
                m.supplierId = suppDedup.idRedirectMap.get(String(m.supplierId));
                movesChanged = true;
            }
            let msNorm = window.Utils.normalizeName(m.supplier || m.supplierName || '');
            if (!m.supplierId && msNorm && suppMapByNorm.has(msNorm)) {
                m.supplierId = suppMapByNorm.get(msNorm).id;
                movesChanged = true;
            }
        });
        if (movesChanged) localStorage.setItem('seraj_treasury_moves', JSON.stringify(moves));

        return true;
    } catch (err) {
        console.error("Migration Error:", err);
        return false;
    }
},

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
        // تم إزالة شرط (if (st < 0) lot.stock = 0) للسماح بتسجيل (سحب بالسالب / عجز) من شاشة المبيعات
        let norm = window.Utils.normalizeName(p.name);
        if (!norm || !normMap.has(norm)) {
            if (norm) normMap.set(norm, p);
            cleaned.push(p);
        } else {
            // منع تكرار الصنف: دمج الكميات والدفعات في الصنف الموجود مسبقاً
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

getCustomers: function(rawOnly = false) { 
    let customers = safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
    if (rawOnly) return customers;
    return this.calculateCustomerBalances(null, customers);
},

saveCustomers: function(data) { 
    if (!Array.isArray(data)) return;
    let dedup = this._deduplicateEntities(data, 'customers');

    if (dedup.changed && dedup.idRedirectMap.size > 0) {
        let sales = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
        let sChanged = false;
        sales.forEach(inv => {
            if (inv && inv.customerId && dedup.idRedirectMap.has(String(inv.customerId))) {
                inv.customerId = dedup.idRedirectMap.get(String(inv.customerId));
                sChanged = true;
            }
        });
        if (sChanged) this.saveSalesInvoices(sales);

        let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        let mChanged = false;
        moves.forEach(m => {
            if (m && m.customerId && dedup.idRedirectMap.has(String(m.customerId))) {
                m.customerId = dedup.idRedirectMap.get(String(m.customerId));
                mChanged = true;
            }
        });
        if (mChanged) this.saveTreasuryMoves(moves);
    }

    let dataToSave = dedup.cleaned.map(c => {
        let temp = { ...c };
        if (temp.name) temp.name = String(temp.name).trim();
        delete temp.balance;
        delete temp.calculatedBalance;
        delete temp.netBalanceVal;
        delete temp.isNetDebt;
        delete temp.deferredInvoicesTotal;
        delete temp.displayCurrentBalance;
        delete temp.isCurrentBalDebt;
        if (!temp._lastModified) temp._lastModified = Date.now();
        return temp;
    });
    localStorage.setItem('seraj_customers', JSON.stringify(dataToSave)); 
    saveArrayToQueueSafely('customers', dataToSave); 
},


getSuppliers: function(rawOnly = false) { 
    let suppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
    if (rawOnly) return suppliers;
    return this.calculateSupplierBalances(null, suppliers);
},

saveSuppliers: function(data) { 
    if (!Array.isArray(data)) return;
    let dedup = this._deduplicateEntities(data, 'suppliers');

    if (dedup.changed && dedup.idRedirectMap.size > 0) {
        let purchases = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
        let pChanged = false;
        purchases.forEach(inv => {
            if (inv && inv.supplierId && dedup.idRedirectMap.has(String(inv.supplierId))) {
                inv.supplierId = dedup.idRedirectMap.get(String(inv.supplierId));
                pChanged = true;
            }
        });
        if (pChanged) this.savePurchaseInvoices(purchases);

        let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        let mChanged = false;
        moves.forEach(m => {
            if (m && m.supplierId && dedup.idRedirectMap.has(String(m.supplierId))) {
                m.supplierId = dedup.idRedirectMap.get(String(m.supplierId));
                mChanged = true;
            }
        });
        if (mChanged) this.saveTreasuryMoves(moves);
    }

    let dataToSave = dedup.cleaned.map(s => {
        let temp = { ...s };
        if (temp.name) temp.name = String(temp.name).trim();
        delete temp.balance;
        delete temp.calculatedBalance;
        delete temp.netBalanceVal;
        delete temp.isNetDebt;
        delete temp.deferredInvoicesTotal;
        delete temp.displayCurrentBalance;
        delete temp.isCurrentBalDebt;
        if (!temp._lastModified) temp._lastModified = Date.now();
        return temp;
    });
    localStorage.setItem('seraj_suppliers', JSON.stringify(dataToSave)); 
    saveArrayToQueueSafely('suppliers', dataToSave); 
},

calculateCustomerBalances: function(targetCustomerId = null, preloadedCustomers = null) {
        let customers = preloadedCustomers || safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
        let invoices = this.getSalesInvoices(true);
        let allMoves = this.getTreasuryMoves(false);
        let invoicesNeedSave = false;
        
        customers.forEach(c => {
            let cIdStr = String(c.id);
            let cNorm = window.Utils.normalizeName(c.name || '');

            let cInvs = invoices.filter(inv => {
                if (!inv) return false;
                let invCustNorm = window.Utils.normalizeName(inv.customer || inv.customerName || '');
                let isMatch = (
                    (inv.customerId !== undefined && inv.customerId !== null && String(inv.customerId) === cIdStr) || 
                    (cNorm !== '' && invCustNorm === cNorm)
                );
                let isValid = (
                    inv.type !== 'canceled' && 
                    inv.isCanceled !== true && 
                    inv.type !== 'quotation' && 
                    inv.isDeleted !== true && 
                    inv.status !== 'deleted'
                );
                return isMatch && isValid;
            });

            // تمرير false في المعامل الثالث لأننا نتعامل مع عملاء وليس موردين
            let validTransactions = this._collectUnifiedEntityTransactions(c, allMoves, false);
            if (validTransactions.some(t => t._restoredFromTreasury)) {
                c.transactions = validTransactions.map(t => {
                    let cleanT = { ...t };
                    delete cleanT._restoredFromTreasury;
                    return cleanT;
                });
            }

            // ==========================================
            // الخطوة 1: عزل السدادات الموجهة للفواتير وتجهيز الأحداث
            // ==========================================
            let timeline = [];
            validTransactions.forEach(t => t._usedAsTargeted = false); 

            cInvs.forEach(inv => {
                let totalVal = parseFloat(inv.total) || 0;
                let discVal = parseFloat(inv.discount) || 0;
                let paidVal = parseFloat(inv.paid) || 0;
                let req = (Math.abs((paidVal + (parseFloat(inv.remaining)||0)) - totalVal) < 0.05 && discVal > 0) ? totalVal : (totalVal - discVal);
                if (req < 0) req = 0;
                
                let isReturn = (inv.type === 'return' || inv.type === 'sales_return' || inv.type === 'return_sale');

                // حصر السندات الموجهة (التي دفعها العميل خصيصاً لهذه الفاتورة)
                let invIdStr = String(inv.id);
                let idRegex = new RegExp('\\b' + invIdStr + '\\b');
                let targetedVouchersAmt = 0;
                
                validTransactions.forEach(t => {
                    // في العملاء السداد الموجه يكون (سند قبض/استلام نقدية)
                    if ((t.type === 'receipt' || t.type === 'customer_receipt' || t.type === 'catch_receipt') && !t._usedAsTargeted) {
                        let isTargeted = false;
                        if (String(t.invoiceNo) === invIdStr || (t.notes && idRegex.test(String(t.notes)))) {
                            isTargeted = true;
                        } else if (t.linkedInvoice && String(t.linkedInvoice) === invIdStr) {
                            isTargeted = true;
                        }
                        
                        if (isTargeted) {
                            targetedVouchersAmt += (parseFloat(t.amount) || 0);
                            t._usedAsTargeted = true; 
                        }
                    }
                });

                let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
                    ? Math.max(0, parseFloat(inv.initialPaid))
                    : Math.max(0, paidVal - targetedVouchersAmt);
                    
                let totalSpecificPaid = checkoutPaid + targetedVouchersAmt;
                let invDate = new Date(inv.date || 0).getTime();

                if (!isReturn) {
                    if (totalSpecificPaid >= req) {
                        // العميل دفع الفاتورة بالكامل أو بزيادة
                        let overpayment = totalSpecificPaid - req;
                        inv._fullyPaidPhase1 = true; 
                        inv._calculatedRem = 0;
                        
                        // الزيادة تتحول لسداد عام في خط الزمن
                        if (overpayment > 0) {
                            timeline.push({ type: 'payment_event', amount: overpayment, date: invDate });
                        }
                    } else {
                        // فاتورة مبيعات آجلة تدخل خط الزمن
                        let currentRem = req - totalSpecificPaid;
                        inv._calculatedRem = currentRem;
                        timeline.push({ type: 'invoice_event', ref: inv, amount: currentRem, date: invDate });
                    }
                } else {
                    // المرتجعات من العميل
                    // البضاعة المسترجعة (req) تعتبر كسداد من العميل لمديونيته
                    if (req > 0) timeline.push({ type: 'payment_event', amount: req, date: invDate });
                    // الكاش المسترد للعميل (totalSpecificPaid) يعتبر مديونية أُضيفت عليه
                    if (totalSpecificPaid > 0) timeline.push({ type: 'debt_event', amount: totalSpecificPaid, date: invDate });
                    
                    inv._fullyPaidPhase1 = true; 
                    inv._calculatedRem = 0;
                }
            });

            // ==========================================
            // الخطوة 2: استكمال خط الزمن بالسندات العامة
            // ==========================================
            // الرصيد الافتتاحي (موجب = العميل عليه فلوس، سالب = العميل له فلوس)
            let opBal = parseFloat(c.openingBalance) || 0;
            if (opBal > 0) timeline.push({ type: 'debt_event', amount: opBal, date: 0 }); 
            else if (opBal < 0) timeline.push({ type: 'payment_event', amount: Math.abs(opBal), date: 0 });

            validTransactions.forEach(t => {
                let amt = parseFloat(t.amount) || 0;
                let tDate = new Date(t.date || 0).getTime();
                
                // إضافة مديونية على العميل (نحن ندفع له أو نسجل عليه قيد)
                if (t.type === 'payment' || t.type === 'customer_payment') {
                    timeline.push({ type: 'debt_event', amount: amt, date: tDate });
                } 
                // العميل يسدد لنا (سند قبض عام)
                else if ((t.type === 'receipt' || t.type === 'customer_receipt' || t.type === 'catch_receipt') && !t._usedAsTargeted) {
                    timeline.push({ type: 'payment_event', amount: amt, date: tDate });
                }
            });

            // ترتيب خط الزمن بالتاريخ من الأقدم للأحدث
            timeline.sort((a, b) => a.date - b.date);

            // ==========================================
            // الخطوة 3: التشغيل الزمني الدقيق
            // ==========================================
            let currentBalance = 0; // الرصيد الحالي الأعمى (موجب = مديونية على العميل، سالب = العميل دافع مقدم)
            let deferredInvoicesQueue = [];

            timeline.forEach(ev => {
                if (ev.type === 'debt_event') {
                    // إضافة مديونية: تصب في الصندوق الأعمى للعميل
                    currentBalance += ev.amount;
                } 
                else if (ev.type === 'invoice_event') {
                    let invAmt = ev.amount;
                    // لو العميل كان دافع مقدم (رصيده سالب)، الفاتورة تسحب من المقدم الأول
                    if (currentBalance < 0) {
                        let availableCredit = Math.abs(currentBalance);
                        if (availableCredit >= invAmt) {
                            currentBalance += invAmt; 
                            invAmt = 0; 
                        } else {
                            invAmt -= availableCredit;
                            currentBalance = 0; 
                        }
                    }
                    if (invAmt > 0) {
                        deferredInvoicesQueue.push({ ref: ev.ref, rem: invAmt });
                    } else {
                        deferredInvoicesQueue.push({ ref: ev.ref, rem: 0 });
                    }
                } 
                else if (ev.type === 'payment_event') {
                    let payAmt = ev.amount;
                    
                    // السداد يهاجم الرصيد الأعمى أولاً (لو العميل عليه مديونية فيه)
                    if (currentBalance > 0) {
                        if (payAmt >= currentBalance) {
                            payAmt -= currentBalance;
                            currentBalance = 0;
                        } else {
                            currentBalance -= payAmt;
                            payAmt = 0;
                        }
                    }
                    
                    // لو اتبقى سداد، يطفي الفواتير الآجلة بالترتيب
                    if (payAmt > 0) {
                        for (let i = 0; i < deferredInvoicesQueue.length; i++) {
                            if (payAmt <= 0) break;
                            let oi = deferredInvoicesQueue[i];
                            if (oi.rem > 0) {
                                if (payAmt >= oi.rem) {
                                    payAmt -= oi.rem;
                                    oi.rem = 0;
                                } else {
                                    oi.rem -= payAmt;
                                    payAmt = 0;
                                }
                            }
                        }
                    }
                    
                    // لو العميل سدد أكتر من كل اللي عليه، يتحول لرصيد مقدم له (سالب)
                    if (payAmt > 0) {
                        currentBalance -= payAmt;
                    }
                }
            });

            // ==========================================
            // الخطوة 4: الحفظ النهائي وحساب الأرصدة
            // ==========================================
            let actualDeferred = 0;
            
            cInvs.forEach(inv => {
                if (!inv._fullyPaidPhase1 && inv.type !== 'return' && inv.type !== 'sales_return' && inv.type !== 'return_sale') {
                    let timelineInv = deferredInvoicesQueue.find(di => di.ref.id === inv.id);
                    let roundedRem = timelineInv ? Math.round(timelineInv.rem * 100) / 100 : 0;
                    
                    inv.calculatedRemaining = roundedRem;
                    
                    let oldRem = parseFloat(inv.remaining) || 0;
                    if (Math.abs(oldRem - roundedRem) > 0.001) {
                        inv.remaining = roundedRem;
                        invoicesNeedSave = true;
                    }
                    actualDeferred += roundedRem;
                } else if (inv._fullyPaidPhase1) {
                    inv.calculatedRemaining = 0;
                    if (parseFloat(inv.remaining) !== 0) {
                        inv.remaining = 0;
                        invoicesNeedSave = true;
                    }
                }
            });

            actualDeferred = Math.round(actualDeferred * 100) / 100;
            currentBalance = Math.round(currentBalance * 100) / 100;

            // إجمالي المديونية = الفواتير الآجلة + الرصيد الحالي الأعمى
            let netDebt = actualDeferred + currentBalance;
            netDebt = Math.round(netDebt * 100) / 100;

            // في العملاء: الموجب يعني العميل مديون لنا (عكس الموردين)
            c.balance = netDebt;              
            c.calculatedBalance = netDebt;    
            c.netBalanceVal = Math.abs(netDebt);
            c.isNetDebt = netDebt > 0; 

            c.deferredInvoicesTotal = actualDeferred; 
            
            c.displayCurrentBalance = Math.abs(currentBalance); 
            c.isCurrentBalDebt = currentBalance > 0; 
        });

        if (invoicesNeedSave && typeof this.saveSalesInvoices === 'function') {
            this.saveSalesInvoices(invoices);
        }

        if (targetCustomerId !== null && targetCustomerId !== undefined) {
            return customers.find(c => String(c.id) === String(targetCustomerId)) || null;
        }
        return customers;
    },

getSuppliers: function(rawOnly = false) { 
    let suppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
    if (rawOnly) return suppliers;
    return this.calculateSupplierBalances(null, suppliers);
},

saveSuppliers: function(data) { 
    if (!Array.isArray(data)) return;
    let dedup = this._deduplicateEntities(data, 'suppliers');

    if (dedup.changed && dedup.idRedirectMap.size > 0) {
        let purchases = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
        let pChanged = false;
        purchases.forEach(inv => {
            if (inv && inv.supplierId && dedup.idRedirectMap.has(String(inv.supplierId))) {
                inv.supplierId = dedup.idRedirectMap.get(String(inv.supplierId));
                pChanged = true;
            }
        });
        if (pChanged) this.savePurchaseInvoices(purchases);

        let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        let mChanged = false;
        moves.forEach(m => {
            if (m && m.supplierId && dedup.idRedirectMap.has(String(m.supplierId))) {
                m.supplierId = dedup.idRedirectMap.get(String(m.supplierId));
                mChanged = true;
            }
        });
        if (mChanged) this.saveTreasuryMoves(moves);
    }

    let dataToSave = dedup.cleaned.map(s => {
        let temp = { ...s };
        if (temp.name) temp.name = String(temp.name).trim();
        delete temp.balance;
        delete temp.calculatedBalance;
        delete temp.netBalanceVal;
        delete temp.isNetDebt;
        delete temp.deferredInvoicesTotal;
        delete temp.displayCurrentBalance;
        delete temp.isCurrentBalDebt;
        if (!temp._lastModified) temp._lastModified = Date.now();
        return temp;
    });
    localStorage.setItem('seraj_suppliers', JSON.stringify(dataToSave)); 
    saveArrayToQueueSafely('suppliers', dataToSave); 
},

calculateSupplierBalances: function(targetSupplierId = null, preloadedSuppliers = null) {
        let suppliers = preloadedSuppliers || safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
        let invoices = this.getPurchaseInvoices(true);
        let allMoves = this.getTreasuryMoves(false);
        let invoicesNeedSave = false;
        
        suppliers.forEach(s => {
            let sIdStr = String(s.id);
            let sNorm = window.Utils.normalizeName(s.name || '');

            let sInvs = invoices.filter(inv => {
                if (!inv) return false;
                let invSuppNorm = window.Utils.normalizeName(inv.supplier || inv.supplierName || '');
                let isMatch = (
                    (inv.supplierId !== undefined && inv.supplierId !== null && String(inv.supplierId) === sIdStr) || 
                    (sNorm !== '' && invSuppNorm === sNorm)
                );
                let isValid = (
                    inv.type !== 'canceled' && 
                    inv.isCanceled !== true && 
                    inv.type !== 'quotation' && 
                    inv.isDeleted !== true && 
                    inv.status !== 'deleted'
                );
                return isMatch && isValid;
            });

            let validTransactions = this._collectUnifiedEntityTransactions(s, allMoves, true);
            if (validTransactions.some(t => t._restoredFromTreasury)) {
                s.transactions = validTransactions.map(t => {
                    let cleanT = { ...t };
                    delete cleanT._restoredFromTreasury;
                    return cleanT;
                });
            }

            // ==========================================
            // الخطوة 1: عزل السدادات الموجهة للفواتير وتجهيز الأحداث
            // ==========================================
            let timeline = [];
            validTransactions.forEach(t => t._usedAsTargeted = false); // تصفير العلامة

            sInvs.forEach(inv => {
                let totalVal = parseFloat(inv.total) || 0;
                let discVal = parseFloat(inv.discount) || 0;
                let paidVal = parseFloat(inv.paid) || 0;
                let req = (Math.abs((paidVal + (parseFloat(inv.remaining)||0)) - totalVal) < 0.05 && discVal > 0) ? totalVal : (totalVal - discVal);
                if (req < 0) req = 0;
                
                let isReturn = (inv.type === 'return' || inv.type === 'purchase_return' || inv.type === 'return_purchase');

                // حصر كل السندات الموجهة (المربوطة برقم الفاتورة دي بالذات)
                let invIdStr = String(inv.id);
                let idRegex = new RegExp('\\b' + invIdStr + '\\b');
                let targetedVouchersAmt = 0;
                
                validTransactions.forEach(t => {
                    if ((t.type === 'payment' || t.type === 'purchase_payment') && !t._usedAsTargeted) {
                        let isTargeted = false;
                        if (String(t.invoiceNo) === invIdStr || (t.notes && idRegex.test(String(t.notes)))) {
                            isTargeted = true;
                        } else if (t.linkedInvoice && String(t.linkedInvoice) === invIdStr) {
                            isTargeted = true;
                        }
                        
                        if (isTargeted) {
                            targetedVouchersAmt += (parseFloat(t.amount) || 0);
                            t._usedAsTargeted = true; // تم استهلاكها للفاتورة ولن تدخل في السداد العام
                        }
                    }
                });

                // النقدية الإجمالية المخصصة حصرياً لهذه الفاتورة
                let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
                    ? Math.max(0, parseFloat(inv.initialPaid))
                    : Math.max(0, paidVal - targetedVouchersAmt);
                    
                let totalSpecificPaid = checkoutPaid + targetedVouchersAmt;
                let invDate = new Date(inv.date || 0).getTime();

                if (!isReturn) {
                    if (totalSpecificPaid >= req) {
                        // الفاتورة ادفعت بالكامل أو بزيادة
                        let overpayment = totalSpecificPaid - req;
                        inv._fullyPaidPhase1 = true; 
                        inv._calculatedRem = 0;
                        
                        // لو فيه زيادة، نرميها في الزمن كأنها سداد عام بنفس تاريخ الفاتورة
                        if (overpayment > 0) {
                            timeline.push({ type: 'payment', amount: overpayment, date: invDate });
                        }
                    } else {
                        // الفاتورة لسه عليها فلوس، تدخل الزمن كفاتورة آجلة بصافيها
                        let currentRem = req - totalSpecificPaid;
                        inv._calculatedRem = currentRem;
                        timeline.push({ type: 'invoice', ref: inv, amount: currentRem, date: invDate });
                    }
                } else {
                    // المرتجعات: البضاعة المسترجعة (req) تسدد مديونيتنا (payment)، الكاش المُسترد (totalSpecificPaid) يزود مديونيتنا (debt)
                    if (req > 0) timeline.push({ type: 'payment', amount: req, date: invDate });
                    if (totalSpecificPaid > 0) timeline.push({ type: 'debt', amount: totalSpecificPaid, date: invDate });
                    inv._fullyPaidPhase1 = true; 
                    inv._calculatedRem = 0;
                }
            });

            // ==========================================
            // الخطوة 2: استكمال خط الزمن بالسندات العامة
            // ==========================================
            // الرصيد الافتتاحي
            let opBal = parseFloat(s.openingBalance) || 0;
            if (opBal > 0) timeline.push({ type: 'debt', amount: opBal, date: 0 }); 
            else if (opBal < 0) timeline.push({ type: 'payment', amount: Math.abs(opBal), date: 0 });

            // حركات الخزينة (التي لم تستخدم كسداد موجه لفاتورة)
            validTransactions.forEach(t => {
                let amt = parseFloat(t.amount) || 0;
                let tDate = new Date(t.date || 0).getTime();
                
                if (t.type === 'receipt' || t.type === 'supplier_receipt') {
                    // إضافة مديونية (الصندوق الأعمى)
                    timeline.push({ type: 'debt', amount: amt, date: tDate });
                } else if ((t.type === 'payment' || t.type === 'purchase_payment') && !t._usedAsTargeted) {
                    // دفع نقدية عام
                    timeline.push({ type: 'payment', amount: amt, date: tDate });
                }
            });

            // ترتيب خط الزمن بالتاريخ
            timeline.sort((a, b) => a.date - b.date);

            // ==========================================
            // الخطوة 3: التشغيل الزمني الدقيق 
            // ==========================================
            let currentBalance = 0; // الرصيد الحالي الأعمى (موجب = مديونية علينا، سالب = رصيد لينا)
            let deferredInvoicesQueue = [];

            timeline.forEach(ev => {
                if (ev.type === 'debt') {
                    // إضافة مديونية: تصب في الصندوق الأعمى فقط
                    currentBalance += ev.amount;
                } 
                else if (ev.type === 'invoice') {
                    // نزول فاتورة آجلة جديدة
                    let invAmt = ev.amount;
                    // لو كنا دافعين دفعات مقدمة (الرصيد الحالي سالب)، الفاتورة تسحب منه الأول
                    if (currentBalance < 0) {
                        let availableCredit = Math.abs(currentBalance);
                        if (availableCredit >= invAmt) {
                            currentBalance += invAmt; // استهلاك الرصيد المقدم
                            invAmt = 0; 
                        } else {
                            invAmt -= availableCredit;
                            currentBalance = 0; // الرصيد المقدم خلص
                        }
                    }
                    // لو لسه الفاتورة عليها فلوس، تدخل طابور الآجل
                    if (invAmt > 0) {
                        deferredInvoicesQueue.push({ ref: ev.ref, rem: invAmt });
                    } else {
                        deferredInvoicesQueue.push({ ref: ev.ref, rem: 0 });
                    }
                } 
                else if (ev.type === 'payment') {
                    // سداد عام: يهاجم الرصيد الأعمى أولاً (لو علينا فلوس)، ثم الفواتير الآجلة
                    let payAmt = ev.amount;
                    
                    if (currentBalance > 0) {
                        if (payAmt >= currentBalance) {
                            payAmt -= currentBalance;
                            currentBalance = 0;
                        } else {
                            currentBalance -= payAmt;
                            payAmt = 0;
                        }
                    }
                    
                    if (payAmt > 0) {
                        for (let i = 0; i < deferredInvoicesQueue.length; i++) {
                            if (payAmt <= 0) break;
                            let oi = deferredInvoicesQueue[i];
                            if (oi.rem > 0) {
                                if (payAmt >= oi.rem) {
                                    payAmt -= oi.rem;
                                    oi.rem = 0;
                                } else {
                                    oi.rem -= payAmt;
                                    payAmt = 0;
                                }
                            }
                        }
                    }
                    
                    // لو اتبقى نقدية زيادة عن كل المديونيات، تنزل كرصيد مقدم لينا (بالسالب)
                    if (payAmt > 0) {
                        currentBalance -= payAmt;
                    }
                }
            });

            // ==========================================
            // الخطوة 4: الحفظ النهائي وحساب الأرصدة
            // ==========================================
            let actualDeferred = 0;
            
            sInvs.forEach(inv => {
                if (!inv._fullyPaidPhase1 && inv.type !== 'return' && inv.type !== 'purchase_return' && inv.type !== 'return_purchase') {
                    let timelineInv = deferredInvoicesQueue.find(di => di.ref.id === inv.id);
                    let roundedRem = timelineInv ? Math.round(timelineInv.rem * 100) / 100 : 0;
                    
                    inv.calculatedRemaining = roundedRem;
                    
                    let oldRem = parseFloat(inv.remaining) || 0;
                    if (Math.abs(oldRem - roundedRem) > 0.001) {
                        inv.remaining = roundedRem;
                        invoicesNeedSave = true;
                    }
                    actualDeferred += roundedRem;
                } else if (inv._fullyPaidPhase1) {
                    inv.calculatedRemaining = 0;
                    if (parseFloat(inv.remaining) !== 0) {
                        inv.remaining = 0;
                        invoicesNeedSave = true;
                    }
                }
            });

            actualDeferred = Math.round(actualDeferred * 100) / 100;
            currentBalance = Math.round(currentBalance * 100) / 100;

            let netDebt = actualDeferred + currentBalance;
            netDebt = Math.round(netDebt * 100) / 100;

            s.balance = -netDebt;              
            s.calculatedBalance = -netDebt;    
            s.netBalanceVal = Math.abs(netDebt);
            s.isNetDebt = netDebt > 0; 

            s.deferredInvoicesTotal = actualDeferred; 
            
            s.displayCurrentBalance = Math.abs(currentBalance); 
            s.isCurrentBalDebt = currentBalance > 0; 
        });

        if (invoicesNeedSave && typeof this.savePurchaseInvoices === 'function') {
            this.savePurchaseInvoices(invoices);
        }

        if (targetSupplierId !== null && targetSupplierId !== undefined) {
            return suppliers.find(s => String(s.id) === String(targetSupplierId)) || null;
        }
        return suppliers;
    },

// 🌟 المحرك المركزي لبناء كشف الحساب الموحد للعميل أو المورد (يضمن التطابق 100% مع الرصيد الخارجي) 🌟
_buildUnifiedStatement: function(entityId, isSupplier = false, duration = 'allTime', customStartDate = null, customEndDate = null) {
    let entity = isSupplier
        ? this.calculateSupplierBalances(entityId)
        : this.calculateCustomerBalances(entityId);
    if (!entity) return null;

    let allInvoices = isSupplier ? this.getPurchaseInvoices(true) : this.getSalesInvoices(true);
    let allMoves = this.getTreasuryMoves(false);
    let eIdStr = String(entity.id);
    let eNorm = window.Utils.normalizeName(entity.name || '');

    let entityInvoices = allInvoices.filter(inv => {
        if (!inv) return false;
        let invEntityNorm = window.Utils.normalizeName(isSupplier ? (inv.supplier || inv.supplierName || '') : (inv.customer || inv.customerName || ''));
        let invEntityId = isSupplier ? inv.supplierId : inv.customerId;
        let isMatch = (
            (invEntityId !== undefined && invEntityId !== null && String(invEntityId) === eIdStr) ||
            (eNorm !== '' && invEntityNorm === eNorm)
        );
        let isValid = (inv.type !== 'quotation' && !inv.isDeleted && inv.status !== 'deleted' && !inv.isCanceled && inv.type !== 'canceled');
        return isMatch && isValid;
    });

    let vouchers = this._collectUnifiedEntityTransactions(entity, allMoves, isSupplier);
    let allItems = [];

    // 1. الرصيد الافتتاحي إن وجد
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

    // 2. الفواتير والمرتجعات والمدفوع نقداً وقت الفاتورة فقط
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

        if (isReturn) {
            allItems.push({ date: inv.date, title: `${invoiceTypeLabel} رقم: ${inv.id}`, leh: finalReq, aleih: 0, id: inv.id, notes: inv.notes || '---' });
        } else {
            allItems.push({ date: inv.date, title: `${invoiceTypeLabel} رقم: ${inv.id}`, leh: 0, aleih: finalReq, id: inv.id, notes: inv.notes || '---' });
        }

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

    // 3. السندات (كل سند سطر واحد مستقل بمبلغه الكامل)
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

    // 4. فلترة الفترة الزمنية
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

getSalesInvoices: function(includeCanceled = true) { 
    let invs = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []); 
    return includeCanceled ? invs : invs.filter(inv => inv && !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
},

getSalesInvoices: function(includeCanceled = true) { 
    let invs = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []); 
    return includeCanceled ? invs : invs.filter(inv => inv && !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
},
saveSalesInvoices: function(data) { 
    if (!Array.isArray(data)) return;
    let oldCache = safeParseJSON(localStorage.getItem('seraj_cloud_cache_sales_invoices'), []);
    let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));
    let now = Date.now();

    // 🌟 تنظيف وتطهير شامل لضمان إزالة أي مراجع DOM أو شوائب من شاشة البيع
    let cleanData = data.map(inv => {
        if (!inv) return null;
        try {
            // تحويل الكائن لـ JSON ثم إعادته يزيل أي عوالق برمجية أو عناصر واجهة غير صالحة
            let cleanInv = JSON.parse(JSON.stringify(inv));
            if (!cleanInv.timestamp) cleanInv.timestamp = now;
            if (cleanInv.type === 'canceled' || cleanInv.status === 'deleted' || cleanInv.isDeleted) cleanInv.isCanceled = true;
            if (cleanInv.customer) cleanInv.customer = String(cleanInv.customer).trim();
            
            let oldInv = oldMap.get(String(cleanInv.id));
            if (!oldInv || JSON.stringify(oldInv) !== JSON.stringify(cleanInv)) {
                cleanInv._lastModified = now;
            }
            return cleanInv;
        } catch (err) {
            console.error("Sales JSON Clean Error:", err);
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
    let oldCache = safeParseJSON(localStorage.getItem('seraj_cloud_cache_purchase_invoices'), []);
    let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));
    let now = Date.now();

    data.forEach(inv => {
        if (!inv) return;
        if (!inv.timestamp) inv.timestamp = now;
        if (inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted) inv.isCanceled = true;
        if (inv.supplier) inv.supplier = String(inv.supplier).trim();
        let oldInv = oldMap.get(String(inv.id));
        if (!oldInv || JSON.stringify(oldInv) !== JSON.stringify(inv)) {
            inv._lastModified = now;
        }
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
        let purchasedNames = newInvoiceItems.map(item => String(item.name).trim().toLowerCase());

        for (let i = smartNotesDB.length - 1; i >= 0; i--) {
            let note = smartNotesDB[i];
            if (note.items && note.items.length > 0) {
                let originalCount = note.items.length;
                note.items = note.items.filter(noteItem => {
                    let noteItemName = String(noteItem.name || noteItem.text || '').replace(/<[^>]*>?/gm, '').replace(/\(مؤرشف\)/g, '').trim().toLowerCase();
                    return !purchasedNames.includes(noteItemName);
                });
                
                if (note.items.length !== originalCount) {
                    isModified = true;
                    // إذا أصبحت النوتة فارغة وليس لها عنوان مخصص، يتم حذفها بالكامل
                    if (note.items.length === 0 && (!note.title || note.title.includes('بدون اسم') || note.title.includes('نواقص'))) {
                        smartNotesDB.splice(i, 1);
                    }
                }
            }
        }

        if (isModified) {
            // نستخدم دالة الحفظ المركزية لضمان رفع التحديث للسحابة وإطلاق الرنة والإشعار فوراً!
            this.saveSmartNotes(smartNotesDB);
        }
    },
    
    getTreasuryMoves: function(includeCanceled = true) { 
        let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []); 
        return includeCanceled ? moves : moves.filter(m => m && !m.isCanceled && m.type !== 'canceled' && m.type !== 'cancelled' && !m.isDeleted && m.status !== 'deleted');
    },
    saveTreasuryMoves: function(data) { 
        if (!Array.isArray(data)) return;
        data.forEach(m => {
            if (!m) return;
            if (!m.vault && m.treasury) {
                let v = String(m.treasury).toLowerCase();
                m.vault = v.includes('insta') ? 'insta' : (v.includes('wallet') ? 'wallet' : 'main');
            } else if (!m.vault) {
                m.vault = 'main';
            }
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
                window.dbCloud.ref('test_Stores/' + currentStoreId + '/vaults_v2').set(cleanVaults); 
            }
            emitSerajUpdate('vaults_v2', 'local');
        } finally {
            setTimeout(() => { this._isSavingVaults = false; }, 150);
        }
    },

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
        let vaults = this.getVaults();

        let vKey = moveObj.vault || moveObj.treasury || 'main';
        if (vKey !== 'main' && vKey !== 'insta' && vKey !== 'wallet') {
            let low = String(vKey).toLowerCase();
            vKey = low.includes('insta') || low.includes('انستا') || low.includes('إنستا') ? 'insta' : (low.includes('wallet') || low.includes('محفظ') ? 'wallet' : 'main');
        }

        let amountAdd = parseFloat(moveObj.amountAdd) || 0;
        let amountDeduct = parseFloat(moveObj.amountDeduct) || 0;
        if (amountAdd === 0 && amountDeduct === 0 && moveObj.amount) {
            let rawAmt = parseFloat(moveObj.amount) || 0;
            if (moveObj.direction === 'out' || moveObj.type === 'payment' || moveObj.type === 'purchase' || moveObj.type === 'purchases' || moveObj.type === 'purchase_payment' || moveObj.type === 'expenses' || moveObj.type === 'return_sale' || moveObj.type === 'sales_return') {
                amountDeduct = rawAmt;
            } else {
                amountAdd = rawAmt;
            }
        }

        let moveId = moveObj.id || Date.now();
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
            _lastModifiedBy: moveObj._lastModifiedBy || localStorage.getItem('cashier_name') || myDeviceName
        };

        let existingIdx = moves.findIndex(m => String(m.id) === String(moveId));
        if (existingIdx > -1) {
            let oldMove = moves[existingIdx];
            let oldVault = oldMove.vault || 'main';
            vaults[oldVault] = (parseFloat(vaults[oldVault]) || 0) - (parseFloat(oldMove.amountAdd) || 0) + (parseFloat(oldMove.amountDeduct) || 0);
            moves[existingIdx] = newMove;
        } else {
            moves.unshift(newMove);
        }

        this.saveTreasuryMoves(moves);

        vaults[vKey] = (parseFloat(vaults[vKey]) || 0) + newMove.amountAdd - newMove.amountDeduct;
        this.saveVaults(vaults);

        return newMove;
    },

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

// --- النوتة الذكية وقوائم النواقص (Smart Notes) ---
_isSavingSmartNotes: false,

getSmartNotes: function() { 
    return safeParseJSON(localStorage.getItem('seraj_smart_notes'), []); 
},

saveSmartNotes: function(data) { 
    if (this._isSavingSmartNotes) return;
    if (!Array.isArray(data)) data = [];
    this._isSavingSmartNotes = true;

    try {
        // المقارنة مع الكاش السحابي لضمان اكتشاف أي تعديل حتى لو حفظت الصفحة في localStorage أولاً
        let oldNotes = safeParseJSON(localStorage.getItem('seraj_cloud_cache_smart_notes'), []);
        let oldMap = new Map(oldNotes.map(n => [String(n?.id), n]));
        let newIds = new Set();

        data.forEach((n, idx) => {
            if (!n) return;
            // ضمان وجود id لكل نوتة حتى يقبلها الفايربيز
            if (n.id === undefined || n.id === null) {
                n.id = n.noteId || n.timestamp || (Date.now() + idx);
            }
            let idStr = String(n.id);
            newIds.add(idStr);

            let oldN = oldMap.get(idStr);
            let oldCopy = oldN ? { ...oldN } : null;
            let newCopy = { ...n };
            if (oldCopy) { delete oldCopy._lastModified; delete oldCopy._senderUid; delete oldCopy.updatedBy; }
            delete newCopy._lastModified; delete newCopy._senderUid; delete newCopy.updatedBy;

            if (!oldCopy || JSON.stringify(oldCopy) !== JSON.stringify(newCopy)) {
                n._lastModified = Date.now();
                n.updatedBy = myDeviceName;
                n._senderUid = myDeviceUid;
                // رفع فوري ومباشر للنوتة المعدلة للسحابة
                addToSyncQueue('smart_notes', n);
            } else if (!n._lastModified) {
                n._lastModified = Date.now();
                n.updatedBy = myDeviceName;
                n._senderUid = myDeviceUid;
                addToSyncQueue('smart_notes', n);
            }
        });

        // حذف أي نوتة تم مسحها من السحابة
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
    }
};

// ---------------------------------------------------------
// 5. Cloud Backup (النسخ الاحتياطي السحابي التلقائي)
// ---------------------------------------------------------
function checkAndRunAutoCloudBackup() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return;
    
    let lastBackupTime = parseInt(localStorage.getItem('seraj_last_backup_timestamp') || '0');
    let now = Date.now();
    let oneDayMillis = 24 * 60 * 60 * 1000; 

    if ((now - lastBackupTime) > oneDayMillis) {
        let fullSystemSnapshot = {
            timestamp: now,
            dateFormatted: new Date().toLocaleString('ar-EG'),
            deviceName: myDeviceName,
            storeId: currentStoreId, 
            ...window.DB.getAggregatedData(),
            vaults: window.DB.getVaults()
        };

        let backupRef = window.dbCloud.ref('test_Stores/' + currentStoreId + '/system_backup/latest_snapshot');
        backupRef.set(fullSystemSnapshot)
            .then(() => {
                localStorage.setItem('seraj_last_backup_timestamp', now.toString());
                console.log("☁️ تم تحديث النسخة الاحتياطية السحابية بنجاح.");
            })
            .catch(err => console.error("Auto Cloud Backup Error:", err));
    }
}

// # =========================================================================
// # 🧠 القسم السادس: استوديو ومحرك المساعد الصوتي الديناميكي (SmartVoice V4)
// # يدعم: 3 بروفايلات مستقلة (البيع / المشتريات / المخزن) + 24 فلتر قابل للترتيب
// # والتشكيل والإيقاف + إنشاء قواعد جديدة بدون كود + بطاقات شرح علامة الاستفهام (؟)
// # =========================================================================

// # [أولاً]: غسالة الإكسيل وفك تشفير الحروف والرموز الخفية (متاحة عالمياً لكل الصفحات)
window.cleanExcelText = function(text) {
    if (!text) return "";
    let t = String(text);
    if (typeof t.normalize === 'function') {
        t = t.normalize('NFKC');
    }
    t = t.replace(/_x000d_/gi, ' ')
         .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
         .replace(/[\r\n]+/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
};

// # [ثانياً]: موسوعة الفلاتر القياسية الـ 24 (مع بطاقة الشرح الهندسي لعلامة الاستفهام ❓)
const MasterPipelineCatalog = [
    {
        id: "f_excel_clean",
        defaultOrder: 1,
        enabled: true,
        category: "مرحلة التنظيف وفك الالتصاق",
        title: "غسالة رموز الإكسيل واليونيكود",
        actionType: "system",
        targetPattern: "_x000d_",
        replacementVal: " ",
        helpTitle: "غسالة رموز الإكسيل وفك التشفير (NFKC)",
        helpDesc: "يقوم هذا الفلتر بمسح الرموز الخفية التي يتركها برنامج الإكسيل (مثل _x000d_)، ويفك تشفير الحروف العربية المكتوبة بخطوط قديمة لكي يراها محرك البحث حروفاً طبيعية.",
        helpExample: "ﻟﻤﺒﻪ ٨٢ ﻭﺍﺕ_x000d_ ⬅️ لمبه ٨٢ وات",
        helpAdvice: "الترتيب الافتراضي (رقم 1): يفضل دائماً بقاؤه في المركز الأول لتنظيف النص الخام قبل دخول أي فلتر آخر."
    },
    {
        id: "f_digits_unstick",
        defaultOrder: 2,
        enabled: true,
        category: "مرحلة التنظيف وفك الالتصاق",
        title: "توحيد الأرقام الهندية وفك التصاقها بالحروف",
        actionType: "system",
        targetPattern: "٠١٢٣٤٥٦٧٨٩",
        replacementVal: "0123456789",
        helpTitle: "توحيد الأرقام وفصل الرقم الملتصق بالكلمة",
        helpDesc: "يحول الأرقام الهندية (٩، ٣٦) إلى أرقام قياسية (9، 36)، ويفصل أي رقم ملتصق بالحروف العربية أو الإنجليزية حتى لا يعتبره الكمبيوتر كلمة مجهولة.",
        helpExample: "٩وات / 5لمبة / بروفيل1.7مم ⬅️ 9 وات / 5 لمبة / بروفيل 1.7 مم",
        helpAdvice: "الترتيب الافتراضي (رقم 2): يجب أن يسبق ماكينة تفكيك الكلمات ومقص الـ 10 حروف."
    },
    {
        id: "f_deglue_words",
        defaultOrder: 3,
        enabled: true,
        category: "مرحلة التنظيف وفك الالتصاق",
        title: "المشرط الذكي لتفكيك الكلمات والأرقام الملتصقة",
        actionType: "system",
        targetPattern: "5",
        replacementVal: " ",
        helpTitle: "المشرط الحرفي لتفكيك الكلمات الملتصقة",
        helpDesc: "يفحص الكلمة حرفاً بحرف من اليمين للشمال؛ فإذا وجد المايك قد ألصق رقماً في صنف أو ألصق صنفين ببعضهما، يقوم بفصلهما بمسافة اعتماداً على كلمات المخزن.",
        helpExample: "أربعةفيشة / علبةماجيك / فيشةذكر ⬅️ أربعة فيشة / علبة ماجيك / فيشة ذكر",
        helpAdvice: "الترتيب الافتراضي (رقم 3): ضروري جداً أن يكون قبل (مقص الـ 10 حروف) حتى ينقذ الكلمات الملتصقة قبل مسحها."
    },
    {
        id: "f_long_nonsense",
        defaultOrder: 4,
        enabled: true,
        category: "مرحلة التنظيف وفك الالتصاق",
        title: "مقص التخاريف الطويلة (حاجز الـ 10 حروف)",
        actionType: "delete",
        targetPattern: "10",
        replacementVal: "",
        helpTitle: "مقص التخاريف والكلمات العشوائية الطويلة",
        helpDesc: "يمسح أي كتلة حروف ملتصقة تتعدى الطول المحدد (افتراضياً 10 حروف) بشرط التأكد أولاً أنها ليست كلمة أصلية مسجلة في المخزن (مثل كونتاكتور أو إلكترونيات). يمكنك تغيير رقم 10 في خانة الهدف إلى أي طول تريده.",
        helpExample: "خرخشةمايكطويلةجدا لمبة ⬅️ لمبة",
        helpAdvice: "الترتيب الافتراضي (رقم 4): يأتي مباشرة بعد (المشرط الذكي) ليمسح فقط التخاريف الحقيقية التي لم تتفكك."
    },
    {
        id: "f_protect_compounds",
        defaultOrder: 5,
        enabled: true,
        category: "مرحلة الفواصل وتقطيع الطلبات",
        title: "قفل حماية المقاسات والأصناف المزدوجة (× / + / و)",
        actionType: "protect",
        targetPattern: "في, ابيض و ورم, مروحه و خلاط, مفتاح و بريزه",
        replacementVal: "×",
        helpTitle: "قفل حماية الأصناف المزدوجة من التقطيع",
        helpDesc: "يحول كلمة (في) بين رقمين إلى علامة المقاس (×)، ويحمي حرف (و) وعلامة (+) داخل الأصناف المزدوجة حتى لا تقوم السكينة بقطع الصنف الواحد إلى طلبين.",
        helpExample: "بواط 10 في 10 / اسبوت 3 و 5 وات ⬅️ بواط 10×10 / اسبوت 3 و 5 وات (طلب واحد)",
        helpAdvice: "الترتيب الافتراضي (رقم 5): يجب أن يوضع قبل فلاتر (السكينة والواو والنقطة) ليحمي هذه التراكيب قبل التقطيع."
    },
    {
        id: "f_waw_number_trap",
        defaultOrder: 6,
        enabled: true,
        category: "مرحلة الفواصل وتقطيع الطلبات",
        title: "مصيدة الواو الملتصقة برقم لبداية طلب جديد (و5 / وخمسه)",
        actionType: "split_plus",
        targetPattern: "و",
        replacementVal: "+",
        helpTitle: "مصيدة الواو اللازقة في رقم (و5 / واتنين)",
        helpDesc: "ترصد أي كلمة تبدأ بحرف (و) ملتصق فيه رقم حسابي أو لفظي (بشرط ألا يسبقه مئات مثل ميه و5 أو آحاد مثل واحد وعشرين)، وتفصلها كطلب جديد بكميته.",
        helpExample: "لمبة و5 مفتاح / فيشة واتنين شاسيه ⬅️ لمبة + 5 مفتاح / فيشة + 2 شاسيه",
        helpAdvice: "الترتيب الافتراضي (رقم 6): توضع قبل السكينة العامة لتجهيز الفواصل."
    },
    {
        id: "f_dots_punct",
        defaultOrder: 7,
        enabled: true,
        category: "مرحلة الفواصل وتقطيع الطلبات",
        title: "فلتر النقطة وعلامات الترقيم (. ، - ؟)",
        actionType: "split_plus",
        targetPattern: ". , ، ؛ - ! ؟ ? # @",
        replacementVal: "+",
        helpTitle: "التحكم في النقطة وعلامات الترقيم",
        helpDesc: "يتحكم في مصير النقطة (.) والفواصل التي يضعها المايك. يمكنك من القائمة أمامه اختيار (تحويل إلى فاصل طلبات +) أو (مسح وحذف نهائي) أو (تحويل لمسافة عادية).",
        helpExample: "لمبة 9 وات. مفتاح تكييف ⬅️ لمبة 9 وات + مفتاح تكييف",
        helpAdvice: "الترتيب الافتراضي (رقم 7): في مرحلة الفواصل وتقطيع الجملة."
    },
    {
        id: "f_sep_words",
        defaultOrder: 8,
        enabled: true,
        category: "مرحلة الفواصل وتقطيع الطلبات",
        title: "فلتر لزمات وفواصل الكلام (وعندك / وكمان / أو)",
        actionType: "split_plus",
        targetPattern: "وعندك, عندك, وكمان, ومعاك, كمان, وهات, وخد, وادي, واديني, زائد, غيره, بعده, أو, او",
        replacementVal: "+",
        helpTitle: "تحويل لزمات الكلام بين الأصناف إلى فاصل (+)",
        helpDesc: "يمسك الكلمات الدارجة التي يقولها الزبون للانتقال من صنف لآخر (مثل: وعندك، وكمان، أو) ويحولها إلى علامة (+) لفصل الطلبات، ويمكنك إضافة أي كلمة جديدة في خانته.",
        helpExample: "فيشة ماجيك وعندك مفتاح تكييف ⬅️ فيشة ماجيك + مفتاح تكييف",
        helpAdvice: "الترتيب الافتراضي (رقم 8): يعمل مع السكينة لتقطيع الجمل الطويلة."
    },
    {
        id: "f_standalone_waw",
        defaultOrder: 9,
        enabled: true,
        category: "مرحلة الفواصل وتقطيع الطلبات",
        title: "فلتر حرف الواو المستقل الفاصل بين الطلبات ( و )",
        actionType: "split_plus",
        targetPattern: "و",
        replacementVal: "+",
        helpTitle: "تحويل الواو المستقلة ( و ) إلى فاصل طلبات (+)",
        helpDesc: "يحول حرف العطف (و) المكتوب منفصلاً بين الجمل إلى علامة (+) لتقسيم الأصناف في الطابور. يمكنك إيقافه أو تحويله لمسافة إذا أردت عدم التقطيع بالواو.",
        helpExample: "5 لمبة و 3 فيشة ⬅️ 5 لمبة + 3 فيشة",
        helpAdvice: "الترتيب الافتراضي (رقم 9): يأتي بعد حماية الأصناف المزدوجة (مثل ابيض و ورم)."
    },
    {
        id: "f_ignore_welcome",
        defaultOrder: 10,
        enabled: true,
        category: "مرحلة التطبيع والغسيل اللغوي",
        title: "فلتر مسح كلمات الترحيب والحشو (عايز / هاتلي / لو سمحت)",
        actionType: "delete",
        targetPattern: "اديني, هاتلي, عايز, محتاج, لو سمحت, لو, سمحت, هات, ضيف, حط, يا",
        replacementVal: "",
        helpTitle: "مسح كلمات البداية والحشو غير المؤثرة",
        helpDesc: "يحذف الكلمات الترحيبية والطلبية (مثل: اديني، عايز، هاتلي) حتى لا تدخل ضمن اسم الصنف وتضعف نسبة البحث. يمكنك تعديل الكلمات أو تغيير وظيفته إلى (+) لو أردت.",
        helpExample: "لو سمحت اديني 3 لمبة ⬅️ 3 لمبة",
        helpAdvice: "الترتيب الافتراضي (رقم 10): يفضل بعد تقطيع الجملة لتنظيف بداية كل طلب."
    },
    {
        id: "f_dedup_chars",
        defaultOrder: 11,
        enabled: true,
        category: "مرحلة التطبيع والغسيل اللغوي",
        title: "فلتر منع تكرار الحروف الممدودة بالخطأ (لممبه ⬅️ لمبه)",
        actionType: "system",
        targetPattern: "3",
        replacementVal: "1",
        helpTitle: "إزالة المد والتكرار العشوائي للحروف",
        helpDesc: "يعالج أخطاء المايك أو الكيبورد عند تكرار نفس الحرف في الكلمة (مثل: فيييشه أو لمممبه) مع الحفاظ على الكلمات الأصلية مثل (مم) أو (قلاووظ).",
        helpExample: "فيييشه ماااجيك ⬅️ فيشه ماجيك",
        helpAdvice: "الترتيب الافتراضي (رقم 11): قبل المقشرة والقاموس لتنظيف بنية الكلمة."
    },
    {
        id: "f_dict_replace",
        defaultOrder: 12,
        enabled: true,
        category: "مرحلة التطبيع والغسيل اللغوي",
        title: "فلتر قاموس المرادفات والتعريب الثنائي (الإنجليزي والسوقي)",
        actionType: "replace",
        targetPattern: "قاموس المرادفات",
        replacementVal: "تلقائي",
        helpTitle: "تطبيق قاموس المرادفات والتعريب (الإنجليزي ولغة السوق)",
        helpDesc: "يطبق الكلمات المسجلة في نافذة القاموس (مثل: City ➔ سيتي، UF ➔ يو اف، شفشق ➔ شفشاء، قلاووظ ➔ كلاوز) لتوحيد نطق الزبون مع المكتوب في المخزن.",
        helpExample: "لمبة قلاووظ / شفشق خلاط ⬅️ لمبه كلاوز / شفشاء خلاط",
        helpAdvice: "الترتيب الافتراضي (رقم 12): يعمل في بداية التطبيع اللغوي."
    },
    {
        id: "f_phonetic_peeler",
        defaultOrder: 13,
        enabled: true,
        category: "مرحلة التطبيع والغسيل اللغوي",
        title: "المقشرة الصوتية وتوحيد الحروف المتشابهة (أ/إ/ة/ق/ص/ز) وحذف (ال)",
        actionType: "system",
        targetPattern: "أإآ->ا, ة->ه, ى->ي, صث->س, ط->ت, ظذ->ز, ق->ك, ض->د",
        replacementVal: "توحيد صوتي",
        helpTitle: "غسالة الحروف المتشابهة صوتياً وإزالة (ال) التعريف",
        helpDesc: "توحد الحروف التي يخلط المايك بينها في اللهجة المصرية (مثل القاف والكاف، الصاد والسين، التاء المربوطة والهاء، الهمزات) وتحذف (ال) من بداية الكلمات.",
        helpExample: "اللمبة القلاووظ ⬅️ لمبه كلاوز",
        helpAdvice: "الترتيب الافتراضي (رقم 13): حجر الأساس لتساوي كفتي المايك والمخزن."
    },
    {
        id: "f_anchor_tens",
        defaultOrder: 14,
        enabled: true,
        category: "مرحلة الأرقام والكميات والمثنى والجمع",
        title: "رادار الأوتاد لإنقاذ العشرات المشوهة (حد وخمسين ⬅️ 51)",
        actionType: "system",
        targetPattern: "عشرين, تلاتين, اربعين, خمسين, ستين, سبعين, تمانين, تسعين",
        replacementVal: "إنقاذ الآحاد",
        helpTitle: "رادار أوتاد العشرات لإنقاذ الرقم السابق لها",
        helpDesc: "يستخدم كلمات العشرات القوية كوتد ثابت، ويفحص الكلمة المشوهة التي قبلها (مثل: حد وخمسين، أو سلاسه وعشرين) ليصلحها ويجمعها في رقم حسابي واحد.",
        helpExample: "حد وخمسين لمبه ⬅️ 51 لمبه",
        helpAdvice: "الترتيب الافتراضي (رقم 14): يجب أن يوضع قبل (فلتر نزع الواو الزائدة) لأنه يعتمد على الواو في كلمة (وخمسين)."
    },
    {
        id: "f_anchor_hundreds",
        defaultOrder: 15,
        enabled: true,
        category: "مرحلة الأرقام والكميات والمثنى والجمع",
        title: "رادار الأوتاد لإنقاذ المئات المشوهة (ميه وسابعه ⬅️ 107)",
        actionType: "system",
        targetPattern: "ميه, متين, تلتوميه, ربعميه, خمسميه",
        replacementVal: "إنقاذ المئات",
        helpTitle: "رادار أوتاد المئات لإنقاذ الرقم التالي لها",
        helpDesc: "يرصد كلمات المئات (ميه، متين...) وينقذ الرقم المشوه الذي يليها مباشرة ويجمعهما معاً.",
        helpExample: "ميه وسابعه فيشه ⬅️ 107 فيشه",
        helpAdvice: "الترتيب الافتراضي (رقم 15): يوضع مع رادار العشرات قبل نزع الواو الزائدة."
    },
    {
        id: "f_strip_leading_waw",
        defaultOrder: 16,
        enabled: true,
        category: "مرحلة الأرقام والكميات والمثنى والجمع",
        title: "فلتر نزع أول حرف واو زائد من الكلمات (وتلاته ⬅️ تلاته)",
        actionType: "delete",
        targetPattern: "وات, واط, وش, وصله, وصلة, ورم, وارم, وان, واير, ولاعه, ودن, وسام",
        replacementVal: "",
        helpTitle: "قص حرف الواو الزائد من بداية أي كلمة",
        helpDesc: "يقص حرف (و) الزائد من أول الكلمات (مثل: وتلاته ➔ تلاته، ولمبه ➔ لمبه) مع حماية الكلمات التي تبدأ بواو أصلية والمسجلة في خانة الاستثناءات أمامه.",
        helpExample: "وتلاته ولمبه ⬅️ تلاته لمبه",
        helpAdvice: "الترتيب الافتراضي (رقم 16): يوضع بعد رادار الأوتاد مباشرة وقبل تعريب الأرقام الفردية."
    },
    {
        id: "f_words_to_numbers",
        defaultOrder: 17,
        enabled: true,
        category: "مرحلة الأرقام والكميات والمثنى والجمع",
        title: "فلتر تعريب الأرقام المنطوقة بالحروف في الجملة كلها (أولها ووسطها)",
        actionType: "system",
        targetPattern: "واحد..تسعتاشر, دسته=12, نص=0.5, ربع=0.25",
        replacementVal: "أرقام حسابية",
        helpTitle: "تحويل الأرقام اللفظية إلى حسابية في كامل الجملة",
        helpDesc: "يحول الأرقام المنطوقة بالحروف سواء جاءت في أول الجملة ككمية أو في وسطها كمواصفة (مثل: لمبة تسعة وات ➔ لمبة 9 وات)، وكذلك الألفاظ مثل دستة ونص وربع.",
        helpExample: "اثنين لمبة تسعة وات ⬅️ 2 لمبه 9 وات",
        helpAdvice: "الترتيب الافتراضي (رقم 17): بعد نزع الواو الزائدة ليتعرف على الأرقام بسهولة."
    },
    {
        id: "f_dual_catcher",
        defaultOrder: 18,
        enabled: true,
        category: "مرحلة الأرقام والكميات والمثنى والجمع",
        title: "فلتر صائد المثنى الذكي (لمبتين ⬅️ 2 لمبه / مفتاحين ⬅️ 2 مفتاح)",
        actionType: "system",
        targetPattern: "جوز, حتتين, قطعتين, حبتين, فرعين",
        replacementVal: "2",
        helpTitle: "تفكيك المثنى المؤنث والمذكر وألفاظ الزوج",
        helpDesc: "يلتقط الكلمات المنتهية بـ (ين / تين) ويردها لمفردها مع جعل الكمية (2)، وكذلك يلتقط كلمات (جوز، حتتين، قطعتين) في أول الطلب.",
        helpExample: "فيشتين ماجيك / مفتاحين تكييف ⬅️ الكمية: 2 | الصنف: فيشه ماجيك / مفتاح تكييف",
        helpAdvice: "الترتيب الافتراضي (رقم 18): قبل مرحلة عزل الكمية."
    },
    {
        id: "f_plural_to_singular",
        defaultOrder: 19,
        enabled: true,
        category: "مرحلة الأرقام والكميات والمثنى والجمع",
        title: "فلتر رد الجموع إلى المفرد (لمبات ⬅️ لمبه / مفاتيح ⬅️ مفتاح)",
        actionType: "system",
        targetPattern: "لمبات->لمبه, مفاتيح->مفتاح, فيش->فيشه, علب->علبه, بواطات->بواط, كشافات->كشاف, بريزات->بريزه, دوايات->دوايه, وصلات->وصله, شواحن->شاحن, مراوح->مروحه",
        replacementVal: "رد للمفرد",
        helpTitle: "تحويل جمع التكسير وجمع المؤنث السالم إلى مفرد",
        helpDesc: "الزبون غالباً ينطق الصنف بالجمع عندما يطلب كمية (مثل: 5 لمبات أو 3 مفاتيح أو 4 فيش)، بينما المخزن مسجل بالمفرد. هذا الفلتر يرد الكلمة لمفردها لتطابق المخزن.",
        helpExample: "5 لمبات 9 وات / 3 مفاتيح تكييف ⬅️ 5 لمبه 9 وات / 3 مفتاح تكييف",
        helpAdvice: "الترتيب الافتراضي (رقم 19): يمكنك إضافة أي جمع ومفرده في خانته بصيغة (الجمع->المفرد)."
    },
    {
        id: "f_protect_units",
        defaultOrder: 20,
        enabled: true,
        category: "مرحلة عزل الكميات (البيع مقابل المخزن)",
        title: "كلبشة وحماية وحدات القياس (منع سرقة 9 وات أو 63 أمبير ككمية)",
        actionType: "protect",
        targetPattern: "وحدات القياس المحمية",
        replacementVal: "حماية المواصفة",
        helpTitle: "حماية الرقم المتبوع بوحدة قياس من التحول لكمية",
        helpDesc: "إذا بدأ الزبون كلامه بـ (9 وات لمبة) أو (63 أمبير مفتاح)، يمنع هذا الفلتر سحب رقم 9 أو 63 في خانة الكمية لأنه متبوع بوحدة قياس من نافذة الوحدات.",
        helpExample: "لمبة 9 وات (أو 9 وات لمبة) ⬅️ الكمية: 1 | الصنف: لمبة 9 وات",
        helpAdvice: "الترتيب الافتراضي (رقم 20): يجب أن يوضع مباشرة قبل (فلتر سحب وعزل الكمية)."
    },
    {
        id: "f_extract_quantity",
        defaultOrder: 21,
        enabled: true,
        category: "مرحلة عزل الكميات (البيع مقابل المخزن)",
        title: "فلتر سحب وعزل الكمية من بداية الطلب (أغلقه في صفحة المخزن 🏭)",
        actionType: "system",
        targetPattern: "تجاهل_الكميات=لا",
        replacementVal: "1",
        helpTitle: "التحكم في سحب الكميات أو إيقافها تماماً (مهم لصفحة المخزن)",
        helpDesc: "يسحب الرقم الحر في بداية الطلب ليضعه في خانة (الكمية). إذا قمت بإيقاف هذا الفلتر (🔴) في بروفايل صفحة المخزن، فلن يسحب أي كميات وسيركز على اسم الصنف فقط، ولو كتبت في خانته (مسح_الرقم) سيمسح أي كمية منطوقة تماماً!",
        helpExample: "مفعل (للبيع): 5 فيشة ⬅️ كمية 5 | متوقف (للمخزن): فيشة (بدون كميات)",
        helpAdvice: "الترتيب الافتراضي (رقم 21): شغّله في بروفايل البيع والمشتريات، وأوقفه أو خصصه في بروفايل المخزن."
    },
    {
        id: "f_chitchat_expel",
        defaultOrder: 22,
        enabled: true,
        category: "مرحلة قاضي المطابقة وبوابة الفلترة النهائية",
        title: "فلتر طرد عبارات الدردشة والسلامات خارج الطابور",
        actionType: "delete",
        targetPattern: "الشغل, شغل, عامل, اخبارك, اخبار, معاك, خلينا, نشوفك, تغيبش, علينا, ياعم, عم, باشا, هندسه, حبيبي, الله, ينور, يسلم, سلام, ازيك, الحمد, لله, تمام, كده, بقي, بقولك, شوف",
        replacementVal: "",
        helpTitle: "بوابة طرد الكلام الجانبي والسلامات",
        helpDesc: "يستبعد أي جملة دردشة أو تحية يقولها الزبون وسط الطلبات (مثل: والشغل عامل إيه معاك، متغيبش علينا يا عم) فلا تدخل طابور الأصناف ولا تشغل زر التالي.",
        helpExample: "5 فيشة + والشغل عامل إيه معاك ⬅️ 5 فيشة فقط",
        helpAdvice: "الترتيب الافتراضي (رقم 22): قبل مطابقة المخزن مباشرة."
    },
    {
        id: "f_number_magnet",
        defaultOrder: 23,
        enabled: true,
        category: "مرحلة قاضي المطابقة وبوابة الفلترة النهائية",
        title: "فلتر مغناطيس الأرقام وتقريب المقاسات (مثل 32 وات ⬅️ 36 وات)",
        actionType: "system",
        targetPattern: "0.35",
        replacementVal: "تقريب المقاس",
        helpTitle: "قرينة الرقم المشترك وتقريب المقاسات غير الموجودة",
        helpDesc: "يرجح الأصناف التي تحتوي على نفس الرقم المنطوق (مثل 36 أو 63)، وإذا نطق الزبون مقاساً قريباً غير مسجل بالمخزن (مثل بنل 32 وات والمخزن فيه 36 وات) يقربه لأقرب مقاس متاح.",
        helpExample: "أربعة بنل 32 وات ⬅️ 4 بنل 36 وات",
        helpAdvice: "الترتيب الافتراضي (رقم 23): يعمل داخل قاضي المطابقة."
    },
    {
        id: "f_no_invent_trim",
        defaultOrder: 24,
        enabled: true,
        category: "مرحلة قاضي المطابقة وبوابة الفلترة النهائية",
        title: "فلتر منع تأليف باقي اسم الصنف (الكتابة على قد كلام الزبون فقط)",
        actionType: "system",
        targetPattern: "قص_الزيادات",
        replacementVal: "تحديد دقيق",
        helpTitle: "منع تأليف تفاصيل لم ينطقها الزبون عند تشابه الأصناف",
        helpDesc: "إذا قال الزبون (3 فيشة) أو (فيشة ماجيك) وكان بالمخزن عدة أنواع (شواب، الوسام...)، يمنع هذا الفلتر البرنامج من تأليف النوع من دماغه، ويكتب في مربع البحث (فيشة ماجيك) فقط لتختار أنت من القائمة المنسدلة.",
        helpExample: "3 فيشة ماجيك ⬅️ يكتب (فيشة ماجيك) فقط ولا يؤلف (فيشة ماجيك شواب)",
        helpAdvice: "الترتيب الافتراضي (رقم 24): إذا أوقفته سيعطيك البرنامج دائماً الاسم الكامل لأعلى صنف بالمخزن."
    },
    {
        id: "f_merge_duplicates",
        defaultOrder: 25,
        enabled: true,
        category: "مرحلة قاضي المطابقة وبوابة الفلترة النهائية",
        title: "ماكينة دمج وجمع الأصناف المكررة في نفس الفاتورة (4 + 7 = 11)",
        actionType: "system",
        targetPattern: "دمج_المكرر",
        replacementVal: "جمع",
        helpTitle: "جمع كميات الصنف الواحد إذا تكرر في نفس المكالمة",
        helpDesc: "إذا طلب الزبون صنفاً في أول الكلام ثم عاد وطلب نفس الصنف في آخر الكلام (أو نطقه بطريقتين تصبان في نفس الصنف)، يدمجهما في سطر واحد ويجمع الكميتين.",
        helpExample: "4 فيشة ماجيك ... و 7 فيشة ماجيك ⬅️ 11 فيشة ماجيك",
        helpAdvice: "الترتيب الافتراضي (رقم 25 - الأخير): يعمل كآخر محطة بعد اكتمال الطابور."
    }
];

// # [ثالثاً]: الإعدادات القياسية والقاموس الافتراضي
const DefaultVoiceConfig = {
    settings: {
        letterTolerance: 65,
        numberMagnet: 80,
        searchThreshold: 55,
        mergeDuplicates: true,
        ignoreQuantitiesMode: false, // # وضع تجاهل الكميات المخصص للمخزن
        firstWordBonus: 25
    },
    units: [
        "وات", "واط", "امبير", "فولت", "ملي", "مللي", "مم", "سم", "سنتي", "متر",
        "بوصه", "بوصة", "حصان", "فاز", "طرف", "خط", "مخرج", "عين", "ليد", "تكه",
        "ركبه", "حركه", "سرعه", "شمعه", "لتر", "كيلو", "جرام", "طن", "كيه", "وفولت", "يو"
    ],
    dictionary: {
        "city": "سيتي", "tiger": "تايجر", "joyroom": "جيروم", "uf": "يو اف",
        "mk": "ام كي", "kh": "كي اتش", "bm": "بي ام", "b.m": "بي ام",
        "dcl": "دي سي ال", "dc": "دي سي", "ac": "اي سي", "hp": "اتش بي",
        "jbl": "جي بي ال", "sky": "سكاي", "fast": "فاست", "fit": "فت",
        "t.c": "تيبسي", "tc": "تيبسي", "تايب سي": "تيبسي", "تيب سي": "تيبسي",
        "micro": "ميكرو", "mikro": "ميكرو", "naza": "نازا", "alngar": "النجار",
        "nagar": "النجار", "sadek": "صادق", "safty": "سيفتي", "smile": "سمايل",
        "top": "توب", "online": "اونلاين", "dinamo": "دينامو", "blue": "بلو",
        "4k": "4 كيه", "hd": "اتش دي", "hdmi": "اتش دي", "led": "ليد",
        "لد": "ليد", "ل ي د": "ليد", "ورم": "وارم", "warm": "وارم",
        "شفشق": "شفشاء", "قلاووظ": "كلاوز", "قلاوظ": "كلاوز", "قلوظ": "كلاوز",
        "بانل": "بنل", "بلن": "بنل", "اسبط": "اسبوت", "سبوت": "اسبوت",
        "موتور": "ماتور", "اتوماتيك": "توماتيك", "اوتوماتيك": "توماتيك",
        "اطار": "ايطار", "بإطار": "بايطار", "اب&دون": "اب وداون", "اب اند داون": "اب وداون",
        "ترانس": "ترنس", "ابليك": "ابلك", "شاسيه": "شسيه", "بريزة": "بريزه"
    }
};

// # [رابعاً]: دوال إدارة البروفايلات الـ 3 (sales / purchases / inventory) والفلاتر داخل كائن DB
Object.assign(DB, {
    _activeVoiceProfile: localStorage.getItem('seraj_active_voice_profile') || 'sales',

    _getVoiceStorageKey: function(subKey, profileName) {
        let storePrefix = (typeof currentStoreId !== 'undefined' && currentStoreId) ? currentStoreId : 'Default';
        let prof = profileName || this._activeVoiceProfile || 'sales';
        // # القاموس والوحدات مشتركة للمحل كله، بينما المؤشرات وترتيب الفلاتر مستقلة لكل صفحة (بيع / شراء / مخزن)
        if (subKey === 'dict' || subKey === 'units') {
            return `seraj_voice_${storePrefix}_${subKey}`;
        }
        return `seraj_voice_${storePrefix}_${prof}_${subKey}`;
    },

    // # تحديد أو قراءة البروفايل النشط حالياً (sales = البيع | purchases = المشتريات | inventory = المخزن)
    getActiveVoiceProfile: function() {
        return this._activeVoiceProfile || 'sales';
    },
    setActiveVoiceProfile: function(profileName) {
        if (['sales', 'purchases', 'inventory'].includes(profileName)) {
            this._activeVoiceProfile = profileName;
            localStorage.setItem('seraj_active_voice_profile', profileName);
        }
    },

    // # 1. قراءة وحفظ إعدادات المؤشرات لبروفايل محدد
    getVoiceSettings: function(profileName) {
        let prof = profileName || this._activeVoiceProfile || 'sales';
        let saved = localStorage.getItem(this._getVoiceStorageKey('settings', prof));
        let baseDefaults = { ...DefaultVoiceConfig.settings };
        // # في بروفايل المخزن نجعل تجاهل الكميات مفعلاً افتراضياً لأول مرة
        if (prof === 'inventory') {
            baseDefaults.ignoreQuantitiesMode = true;
            baseDefaults.mergeDuplicates = false;
        }
        if (saved) {
            try { return { ...baseDefaults, ...JSON.parse(saved) }; } catch (e) {}
        }
        return baseDefaults;
    },
    saveVoiceSettings: function(newSettings, profileName) {
        let prof = profileName || this._activeVoiceProfile || 'sales';
        let merged = { ...this.getVoiceSettings(prof), ...newSettings };
        localStorage.setItem(this._getVoiceStorageKey('settings', prof), JSON.stringify(merged));
        this._syncVoiceConfigToCloud();
    },

    // # 2. قراءة وحفظ قائمة الفلاتر وترتيبها ومفاتيحها لبروفايل محدد (بيع / شراء / مخزن)
    getVoicePipeline: function(profileName) {
        let prof = profileName || this._activeVoiceProfile || 'sales';
        let saved = localStorage.getItem(this._getVoiceStorageKey('pipeline', prof));
        let catalogCopy = JSON.parse(JSON.stringify(MasterPipelineCatalog));

        // # تخصيص افتراضي لبروفايل المخزن (إيقاف سحب الكميات افتراضياً)
        if (prof === 'inventory') {
            catalogCopy.forEach(f => {
                if (f.id === 'f_extract_quantity') {
                    f.enabled = false;
                    f.targetPattern = "مسح_الرقم";
                }
            });
        }

        if (saved) {
            try {
                let parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // # دمج الفلاتر المحفوظة مع أي فلاتر جديدة في الكتالوج + الفلاتر المخصصة التي أنشأها المستخدم
                    let savedMap = new Map(parsed.map(item => [item.id, item]));
                    let mergedList = catalogCopy.map(defItem => {
                        if (savedMap.has(defItem.id)) {
                            let sItem = savedMap.get(defItem.id);
                            savedMap.delete(defItem.id);
                            return { ...defItem, ...sItem, helpTitle: defItem.helpTitle, helpDesc: defItem.helpDesc, helpExample: defItem.helpExample, helpAdvice: defItem.helpAdvice };
                        }
                        return defItem;
                    });
                    // # إضافة الفلاتر المخصصة التي بناها المستخدم من الشاشة (custom_...)
                    savedMap.forEach(customItem => mergedList.push(customItem));
                    return mergedList.sort((a, b) => (Number(a.order ?? a.defaultOrder) || 99) - (Number(b.order ?? b.defaultOrder) || 99));
                }
            } catch (e) {}
        }

        return catalogCopy.map(f => ({ ...f, order: f.defaultOrder })).sort((a, b) => a.order - b.order);
    },

    saveVoicePipeline: function(pipelineArray, profileName) {
        let prof = profileName || this._activeVoiceProfile || 'sales';
        localStorage.setItem(this._getVoiceStorageKey('pipeline', prof), JSON.stringify(pipelineArray || []));
        this._syncVoiceConfigToCloud();
    },

    resetVoicePipelineToDefault: function(profileName) {
        let prof = profileName || this._activeVoiceProfile || 'sales';
        localStorage.removeItem(this._getVoiceStorageKey('pipeline', prof));
        localStorage.removeItem(this._getVoiceStorageKey('settings', prof));
        this._syncVoiceConfigToCloud();
        return this.getVoicePipeline(prof);
    },

    // # نسخ الإعدادات وترتيب الفلاتر من صفحة إلى أخرى (مثلاً من البيع إلى المشتريات)
    copyVoiceProfile: function(fromProfile, toProfile) {
        let settings = this.getVoiceSettings(fromProfile);
        let pipeline = this.getVoicePipeline(fromProfile);
        this.saveVoiceSettings(settings, toProfile);
        this.saveVoicePipeline(pipeline, toProfile);
    },

    // # 3. الحساسية السريعة
    getVoiceSensitivity: function(profileName) {
        let s = this.getVoiceSettings(profileName);
        return s.searchThreshold || 55;
    },
    saveVoiceSensitivity: function(val, profileName) {
        let num = parseInt(val) || 55;
        this.saveVoiceSettings({ searchThreshold: num }, profileName);
    },

    // # 4. وحدات القياس المحمية (تسمح بالحذف والإضافة الكاملة)
    getVoiceUnits: function() {
        let saved = localStorage.getItem(this._getVoiceStorageKey('units'));
        if (saved !== null) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [...DefaultVoiceConfig.units];
    },
    saveVoiceUnits: function(unitsArray) {
        let cleanArr = [...new Set((unitsArray || []).map(u => String(u).trim()).filter(Boolean))];
        localStorage.setItem(this._getVoiceStorageKey('units'), JSON.stringify(cleanArr));
        SmartVoice._invalidateShadowCache();
        this._syncVoiceConfigToCloud();
    },

    // # 5. قاموس المرادفات (يسمح بحذف أي كلمة نهائياً)
    getVoiceDictionary: function() {
        let saved = localStorage.getItem(this._getVoiceStorageKey('dict'));
        if (saved !== null) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return { ...DefaultVoiceConfig.dictionary };
    },
    saveVoiceDictionary: function(dictObj) {
        localStorage.setItem(this._getVoiceStorageKey('dict'), JSON.stringify(dictObj || {}));
        SmartVoice._invalidateShadowCache();
        this._syncVoiceConfigToCloud();
    },

    // # 6. الماسح الذاتي لاستنتاج الوحدات من مخزن أي محل
    autoLearnFromInventory: function() {
        let products = this.getProducts() || [];
        let learnedUnits = new Set(this.getVoiceUnits());
        let unitCandidates = {};

        products.forEach(p => {
            if (!p || !p.name) return;
            let clean = window.cleanExcelText(p.name)
                               .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
                               .replace(/(\d+)([^\d\s\.])/g, '$1 $2');
            let tokens = clean.split(/\s+/);
            for (let i = 0; i < tokens.length - 1; i++) {
                if (!isNaN(tokens[i]) && isNaN(tokens[i + 1]) && tokens[i + 1].length >= 2 && tokens[i + 1].length <= 6) {
                    let w = tokens[i + 1];
                    unitCandidates[w] = (unitCandidates[w] || 0) + 1;
                }
            }
        });

        let addedCount = 0;
        for (let u in unitCandidates) {
            if (unitCandidates[u] >= 3 && !learnedUnits.has(u)) {
                learnedUnits.add(u);
                addedCount++;
            }
        }
        let finalUnits = Array.from(learnedUnits);
        this.saveVoiceUnits(finalUnits);
        return { totalUnits: finalUnits.length, newlyLearned: addedCount };
    },

    _syncVoiceConfigToCloud: function() {
        if (typeof cloudReady !== 'undefined' && cloudReady && navigator.onLine && window.dbCloud) {
            let payload = {
                sales: { settings: this.getVoiceSettings('sales'), pipeline: this.getVoicePipeline('sales') },
                purchases: { settings: this.getVoiceSettings('purchases'), pipeline: this.getVoicePipeline('purchases') },
                inventory: { settings: this.getVoiceSettings('inventory'), pipeline: this.getVoicePipeline('inventory') },
                units: this.getVoiceUnits(),
                dictionary: this.getVoiceDictionary(),
                updatedAt: Date.now()
            };
            window.dbCloud.ref('test_Stores/' + currentStoreId + '/voice_studio_v4').set(payload).catch(e => console.error(e));
        }
    }
});

// # =========================================================================
// # [خامساً]: المحرك الديناميكي القابل للبرمجة والترتيب (SmartVoice V4)
// # =========================================================================
const SmartVoice = {
    _shadowCache: null,
    _shadowCacheCount: 0,
    _vocabSet: null,
    _vocabList: null,

    _invalidateShadowCache: function() {
        this._shadowCache = null;
        this._shadowCacheCount = 0;
        this._vocabSet = null;
        this._vocabList = null;
    },

    anchors: {
        tens: { "عشرين": 20, "عشرون": 20, "تلاتين": 30, "ثلاثين": 30, "اربعين": 40, "خمسين": 50, "ستين": 60, "سبعين": 70, "تمانين": 80, "تسعين": 90 },
        hundreds: { "ميه": 100, "مائه": 100, "مائة": 100, "متين": 200, "مائتين": 200, "تلتوميه": 300, "ربعميه": 400, "خمسميه": 500, "ستميه": 600, "سبعميه": 700, "تمنميه": 800, "تسعميه": 900 }
    },

    singles: {
        1: ["واحد", "واحده", "حد", "احد"],
        2: ["اتنين", "اثنين", "سنين", "تنين"],
        3: ["تلاته", "ثلاثه", "تلات", "ثلاث", "سلاسه"],
        4: ["اربعه", "اربعة", "اربع", "اربعا", "ارباعه"],
        5: ["خمسه", "خمسة", "خمس", "خمصه"],
        6: ["سته", "ستة", "ست"],
        7: ["سبعه", "سبعة", "سبع", "سابعه"],
        8: ["تمانيه", "ثمانيه", "تمان", "ثمان"],
        9: ["تسعه", "تسعة", "تسع", "تيسعه"],
        10: ["عشره", "عشرة", "عشر"]
    },

    specials: {
        "حداشر": 11, "احداشر": 11, "اتناشر": 12, "اثناشر": 12, "دسته": 12, "دستة": 12,
        "تلتاشر": 13, "اربعتاشر": 14, "خمستاشر": 15, "ستاشر": 16, "سبعتاشر": 17,
        "تمنتاشر": 18, "تسعتاشر": 19, "الف": 1000, "نص": 0.5, "نصف": 0.5, "ربع": 0.25
    },

    commonStoreWords: [
        "لمبه", "فيشه", "علبه", "مفتاح", "بريزه", "شاسيه", "وش", "لقمه", "سداد", "مشترك",
        "دوايه", "كشاف", "اسبوت", "بنل", "ترنس", "شاحن", "وصله", "مكثف", "ماتور", "خلاط",
        "شفشاء", "مروحه", "سخان", "غساله", "تلاجه", "شريط", "لحام", "مفك", "بنسه", "سلك",
        "كابل", "خرطوم", "بواط", "ماجيك", "شواب", "فينوس", "الوسام", "تكييف", "كلاوز",
        "مسمار", "شوكه", "بلحه", "ذكر", "نتايه", "داخل", "خارج", "ساده", "عادي", "اصلي"
    ],

    // # المقشرة الأساسية السريعة
    peeler: function(text, applyDict = true) {
        if (!text) return "";
        let t = window.cleanExcelText(text).toLowerCase();
        t = t.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
        t = t.replace(/(\d+(?:\.\d+)?)\s*w\b/gi, '$1 وات')
             .replace(/(\d+(?:\.\d+)?)\s*a\b/gi, '$1 امبير')
             .replace(/(\d+(?:\.\d+)?)\s*v\b/gi, '$1 فولت')
             .replace(/(\d+(?:\.\d+)?)\s*m\b/gi, '$1 متر');
        t = t.replace(/(\d+)\s*[\*×x]\s*(\d+)/gi, '$1×$2');
        t = t.replace(/(\d+(?:\.\d+)?)([^\d\s\.×\+\/])/g, '$1 $2')
             .replace(/([^\d\s\.×\+\/])(\d+(?:\.\d+)?)/g, '$1 $2');
        t = t.replace(/([\u0600-\u06FF])([a-zA-Z])/g, '$1 $2')
             .replace(/([a-zA-Z])([\u0600-\u06FF])/g, '$1 $2');

        if (applyDict) {
            let dict = (typeof DB !== 'undefined' && DB.getVoiceDictionary) ? DB.getVoiceDictionary() : DefaultVoiceConfig.dictionary;
            for (let key in dict) {
                let target = String(dict[key]);
                let escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                t = t.replace(new RegExp(`(^|\\s)${escapedKey}(?=\\s|$)`, 'gi'), `$1${target}`);
            }
        }

        t = t.replace(/[أإآءئؤ]/g, 'ا')
             .replace(/ة/g, 'ه')
             .replace(/ى/g, 'ي')
             .replace(/[صث]/g, 'س')
             .replace(/ط/g, 'ت')
             .replace(/[ظذ]/g, 'ز')
             .replace(/ق/g, 'ك')
             .replace(/ض/g, 'د');

        t = t.split(/\s+/).map(w => (w.startsWith("ال") && w.length > 4) ? w.substring(2) : w).join(" ");
        return t.replace(/\s+/g, ' ').trim();
    },

    fuzzyMatch: function(w1, w2) {
        if (!w1 || !w2) return 0;
        if (w1 === w2) return 100;
        if (w1.includes(w2) || w2.includes(w1)) {
            let ratio = Math.min(w1.length, w2.length) / Math.max(w1.length, w2.length);
            if (ratio >= 0.65) return Math.round(ratio * 100);
        }
        let matches = 0;
        let charArray = w2.split('');
        for (let char of w1) {
            let index = charArray.indexOf(char);
            if (index !== -1) { matches++; charArray.splice(index, 1); }
        }
        return (matches / Math.max(w1.length, w2.length)) * 100;
    },

    rescueNumber: function(word, threshold = 50) {
        if (!word) return null;
        let peeled = this.peeler(word, false);
        if (this.specials[peeled] !== undefined) return { number: this.specials[peeled], score: 100 };
        if (this.anchors.tens[peeled] !== undefined) return { number: this.anchors.tens[peeled], score: 100 };
        if (this.anchors.hundreds[peeled] !== undefined) return { number: this.anchors.hundreds[peeled], score: 100 };

        let bestMatch = null;
        let highestScore = 0;
        for (let num in this.singles) {
            this.singles[num].forEach(candidate => {
                let score = this.fuzzyMatch(peeled, this.peeler(candidate, false));
                if (score > highestScore) { highestScore = score; bestMatch = num; }
            });
        }
        if (highestScore >= threshold) return { number: parseFloat(bestMatch), score: highestScore };
        return null;
    },

    prepareInventoryShadow: function(inventoryDB) {
        if (!Array.isArray(inventoryDB)) inventoryDB = [];
        if (this._shadowCache && this._shadowCacheCount === inventoryDB.length && this._vocabSet) {
            return this._shadowCache;
        }

        let vocabSet = new Set(this.commonStoreWords.map(w => this.peeler(w)));
        this._shadowCache = inventoryDB.map(item => {
            let rawName = item.name || String(item);
            let cleanDisplay = window.cleanExcelText(rawName);
            let peeled = this.peeler(cleanDisplay);
            let words = peeled.split(" ").filter(Boolean);
            let numbers = words.filter(w => !isNaN(w)).map(Number);
            let textWords = words.filter(w => isNaN(w));
            textWords.forEach(tw => { if (tw.length >= 2) vocabSet.add(tw); });
            return {
                original: rawName,
                cleanDisplay: cleanDisplay,
                peeled: peeled,
                words: words,
                numbers: numbers,
                textWords: textWords
            };
        });

        this._vocabSet = vocabSet;
        this._vocabList = Array.from(vocabSet);
        this._shadowCacheCount = inventoryDB.length;
        return this._shadowCache;
    },

    // # دالة مساعدة لتنفيذ قرار المستخدم على أي قائمة كلمات أو رموز (تحويل لـ + / مسح / مسافة / استبدال)
    _applyDynamicRuleAction: function(text, filterObj) {
        let rawTargets = String(filterObj.targetPattern || "").split(/[,،]+/).map(s => s.trim()).filter(Boolean);
        if (rawTargets.length === 0) return text;

        let action = filterObj.actionType || "split_plus";
        let rep = " ";
        if (action === "split_plus") rep = " + ";
        else if (action === "delete") rep = " ";
        else if (action === "space") rep = " ";
        else if (action === "replace") rep = " " + (filterObj.replacementVal || "") + " ";
        else if (action === "protect") return text;

        let out = text;
        rawTargets.forEach(tok => {
            let escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // # إذا كان الرمز علامة ترقيم غير حرفية نستبدله مباشرة، وإذا كان كلمة نشترط حدود الكلمة
            if (/^[^\w\u0600-\u06FF]+$/.test(tok)) {
                out = out.replace(new RegExp(escaped, 'g'), rep);
            } else {
                out = out.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi'), rep);
            }
        });
        return out.replace(/\s+/g, ' ').trim();
    },

    // # المشرط الحرفي لتفكيك الملتصق (كبسولة مستقلة)
    _runDeglueCapsule: function(text, inventoryDB, addLog, stepOrder) {
        this.prepareInventoryShadow(inventoryDB);
        let unitsList = (typeof DB !== 'undefined' && DB.getVoiceUnits) ? DB.getVoiceUnits().map(u => this.peeler(u)) : DefaultVoiceConfig.units;

        const isNumberPiece = (str) => {
            let p = this.peeler(str, false);
            if (!p) return false;
            if (!isNaN(p)) return true;
            if (p.length >= 3 && this.rescueNumber(p, 75) !== null) return true;
            if (str.startsWith("و") && str.length >= 4 && this.rescueNumber(str.substring(1), 75) !== null) return true;
            return false;
        };

        const isInventoryPiece = (str, allowFuzzy = false) => {
            let p = this.peeler(str);
            if (!p || p.length < 2) return false;
            if (this._vocabSet.has(p) || unitsList.includes(p)) return true;
            if (allowFuzzy && p.length >= 4) {
                return this._vocabList.some(vw => Math.abs(vw.length - p.length) <= 1 && this.fuzzyMatch(p, vw) >= 82);
            }
            return false;
        };

        const trySplitGlued = (word, depth = 0) => {
            for (let k = 2; k <= word.length - 2; k++) {
                let left = word.substring(0, k);
                let right = word.substring(k);
                let leftValid = (k === 2)
                    ? (this._vocabSet.has(this.peeler(left)) && this.peeler(left).length === 2)
                    : (isNumberPiece(left) || isInventoryPiece(left, false) || (left.startsWith("و") && left.length >= 4 && isInventoryPiece(left.substring(1), false)));

                if (leftValid) {
                    if (isInventoryPiece(right, true) || isNumberPiece(right)) return [left, right];
                    if (depth < 2 && right.length >= 4) {
                        let sub = trySplitGlued(right, depth + 1);
                        if (sub) return [left, ...sub];
                    }
                }
            }
            return null;
        };

        let tokens = text.split(/\s+/).filter(Boolean);
        let outTokens = [];
        tokens.forEach(tok => {
            let cleanTok = tok.replace(/[!؟?#@،,؛\.]/g, "");
            if (!cleanTok || cleanTok === "+" || isInventoryPiece(cleanTok, false) || isNumberPiece(cleanTok)) {
                outTokens.push(tok);
                return;
            }
            if (cleanTok.length >= 5) {
                let splitRes = trySplitGlued(cleanTok, 0);
                if (splitRes && splitRes.length > 1) {
                    addLog("anchor", `[فلتر #${stepOrder}] المشرط الذكي لتفكيك الملتصق 🧩`, `تم تفكيك <mark>${cleanTok}</mark> ⬅️ <b>${splitRes.join(" + ")}</b>`);
                    outTokens.push(...splitRes);
                    return;
                }
            }
            outTokens.push(tok);
        });
        return outTokens.join(" ");
    },

    // # =====================================================================
    // # 🚀 المدير التنفيذي للاستوديو (يشغل الفلاتر حسب أرقام ترتيبها ومفاتيحها)
    // # =====================================================================
    analyzeFullText: function(rawText, customInventoryDB, profileOverride) {
        let logs = [];
        const addLog = (type, title, msg) => logs.push(`<div class="log-item log-${type}"><span class="step-title">${title}</span>${msg}</div>`);

        if (!rawText || !rawText.trim()) return { queue: [], logsHTML: "" };

        let activeProfile = profileOverride || ((typeof DB !== 'undefined' && DB.getActiveVoiceProfile) ? DB.getActiveVoiceProfile() : 'sales');
        let inventoryDB = customInventoryDB || ((typeof DB !== 'undefined' && DB.getProducts) ? DB.getProducts() : []);
        let cfg = (typeof DB !== 'undefined' && DB.getVoiceSettings) ? DB.getVoiceSettings(activeProfile) : DefaultVoiceConfig.settings;
        let pipeline = (typeof DB !== 'undefined' && DB.getVoicePipeline) ? DB.getVoicePipeline(activeProfile) : MasterPipelineCatalog;
        let unitsList = (typeof DB !== 'undefined' && DB.getVoiceUnits) ? DB.getVoiceUnits().map(u => this.peeler(u, false)) : DefaultVoiceConfig.units;

        this.prepareInventoryShadow(inventoryDB);

        // # فرز الفلاتر المفعلة فقط حسب رقم الترتيب الذي حدده المستخدم في الشاشة
        let activeFilters = pipeline
            .filter(f => f.enabled !== false)
            .sort((a, b) => (Number(a.order ?? a.defaultOrder) || 99) - (Number(b.order ?? b.defaultOrder) || 99));

        let filterMap = new Map(activeFilters.map(f => [f.id, f]));

        // # المرحلة الأولى: تمرير الجملة على فلاتر المستوى النصي والمفككات بالترتيب المحدد
        let workingText = String(rawText);

        activeFilters.forEach(filter => {
            let stepNum = filter.order ?? filter.defaultOrder;
            let beforeText = workingText;

            switch (filter.id) {
                case "f_excel_clean":
                    workingText = window.cleanExcelText(workingText);
                    break;

                case "f_digits_unstick":
                    workingText = workingText
                        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
                        .replace(/(\d+(?:\.\d+)?)([^\d\s\.×\+\/])/g, '$1 $2')
                        .replace(/([^\d\s\.×\+\/])(\d+(?:\.\d+)?)/g, '$1 $2')
                        .replace(/([\u0600-\u06FF])([a-zA-Z])/g, '$1 $2')
                        .replace(/([a-zA-Z])([\u0600-\u06FF])/g, '$1 $2');
                    if (beforeText !== workingText) {
                        addLog("peel", `[فلتر #${stepNum}] فك التصاق الأرقام والحروف`, `<mark>${workingText}</mark>`);
                    }
                    break;

                case "f_deglue_words":
                    workingText = this._runDeglueCapsule(workingText, inventoryDB, addLog, stepNum);
                    break;

                case "f_long_nonsense": {
                    let maxLen = parseInt(filter.targetPattern) || 10;
                    let wordsArr = workingText.split(/\s+/);
                    let removedLong = [];
                    wordsArr = wordsArr.filter(w => {
                        let cleanW = w.replace(/[!؟?#@،,؛\.]/g, "");
                        if (cleanW.length >= maxLen) {
                            let p = this.peeler(cleanW);
                            let inStore = this._vocabSet.has(p) || this._vocabList.some(vw => Math.abs(vw.length - p.length) <= 1 && this.fuzzyMatch(p, vw) >= 82);
                            if (!inStore) {
                                removedLong.push(cleanW);
                                return false;
                            }
                        }
                        return true;
                    });
                    workingText = wordsArr.join(" ");
                    if (removedLong.length > 0) {
                        addLog("peel", `[فلتر #${stepNum}] مقص التخاريف (${maxLen}+ حروف) ✂️`, `تم مسح: <span class="highlight-danger">${removedLong.join(" ، ")}</span>`);
                    }
                    break;
                }

                case "f_protect_compounds":
                    workingText = workingText
                        .replace(/(\d+)\s+في\s+(\d+)/g, '$1×$2')
                        .replace(/(\d+)\s*\+\s*(\d+)/g, '$1__PLUS__$2')
                        .replace(/(\d+)\s+و\s*(\d+)\s+(وات|واط|مم|ملي|سم|بوصه|امبير|فولت)/g, '$1__AND__$2 $3')
                        .replace(/(ابيض|احمر|اصفر|ازرق)\s+و\s*(ورم|وارم|احمر|ازرق|الوان)/g, '$1__AND__$2')
                        .replace(/(مروحه)\s+و\s*(خلاط)/g, '$1__AND__$2')
                        .replace(/(مفتاح)\s+و\s*(بريزه)/g, '$1__AND__$2');
                    break;

                case "f_waw_number_trap": {
                    let toks = workingText.split(/\s+/);
                    let repSymbol = filter.actionType === "delete" ? "" : (filter.actionType === "space" ? " " : "+ ");
                    for (let i = 0; i < toks.length; i++) {
                        let w = toks[i];
                        let prevPeeled = i > 0 ? this.peeler(toks[i - 1], false) : "";
                        let prevIsHundred = this.anchors.hundreds[prevPeeled] !== undefined || prevPeeled === "100" || prevPeeled === "200";
                        let prevIsSingle = !isNaN(prevPeeled) || this.rescueNumber(prevPeeled, 70) !== null;

                        if (/^و\d+$/.test(w) && !prevIsHundred) {
                            toks[i] = repSymbol + w.substring(1);
                            addLog("peel", `[فلتر #${stepNum}] مصيدة الواو والرقم`, `تحويل <mark>${w}</mark> ⬅️ <b>${toks[i]}</b>`);
                        } else if (w.startsWith("و") && w.length > 2 && !prevIsHundred && !prevIsSingle) {
                            let afterWaw = w.substring(1);
                            if (!this.anchors.tens[this.peeler(afterWaw, false)]) {
                                let checkSingle = this.rescueNumber(afterWaw, 75);
                                if (checkSingle) {
                                    toks[i] = repSymbol + checkSingle.number;
                                    addLog("peel", `[فلتر #${stepNum}] مصيدة الواو والرقم`, `تحويل <mark>${w}</mark> ⬅️ <b>${toks[i]}</b>`);
                                }
                            }
                        }
                    }
                    workingText = toks.join(" ");
                    break;
                }

                case "f_dots_punct": {
                    let rawChars = String(filter.targetPattern || ". , ، ؛ - ! ؟ ? # @").split(/\s+/).filter(Boolean);
                    let act = filter.actionType || "split_plus";
                    let rep = act === "split_plus" ? " + " : (act === "delete" ? "" : (act === "space" ? " " : ` ${filter.replacementVal || ""} `));
                    rawChars.forEach(ch => {
                        let esc = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        workingText = workingText.replace(new RegExp(esc, 'g'), rep);
                    });
                    if (beforeText !== workingText) {
                        addLog("peel", `[فلتر #${stepNum}] معالجة النقطة والترقيم`, `تحويل الرموز إلى (${act === 'split_plus' ? '+' : act}): <mark>${workingText}</mark>`);
                    }
                    break;
                }

                case "f_sep_words":
                    workingText = this._applyDynamicRuleAction(workingText, filter);
                    if (beforeText !== workingText) {
                        addLog("peel", `[فلتر #${stepNum}] فواصل الكلام ولزمات المحل`, `<mark>${workingText}</mark>`);
                    }
                    break;

                case "f_standalone_waw": {
                    let act = filter.actionType || "split_plus";
                    let rep = act === "split_plus" ? " + " : (act === "delete" ? " " : ` ${filter.replacementVal || " "} `);
                    workingText = workingText.replace(/\s+و\s+/g, rep);
                    break;
                }

                case "f_ignore_welcome":
                    workingText = this._applyDynamicRuleAction(workingText, filter);
                    break;

                default:
                    // # تنفيذ أي فلتر مخصص أنشأه المستخدم من الشاشة (custom_...) في مكانه وترتيبه بالظبط
                    if (String(filter.id).startsWith("custom_")) {
                        workingText = this._applyDynamicRuleAction(workingText, filter);
                        if (beforeText !== workingText) {
                            addLog("peel", `[فلتر مخصص #${stepNum}] ${filter.title}`, `النتيجة: <mark>${workingText}</mark>`);
                        }
                    }
                    break;
            }
        });

        // # تقطيع الجملة إلى طلبات بناءً على علامة (+) الناتجة من الفلاتر السابقة
        let chunks = workingText.split('+').map(c => c.trim()).filter(c => c.length > 0);
        let extractedQueue = [];

        // # المرحلة الثانية: تمرير كل طلب مقطوع على فلاتر الكلمات والأرقام والمثنى والجمع والكميات بالترتيب المحدد
        chunks.forEach((chunk, idx) => {
            chunk = chunk.replace(/__PLUS__/g, '+').replace(/__AND__/g, ' و ');
            let words = chunk.split(/\s+/).filter(Boolean);
            if (words.length === 0) return;

            let dualQtyFound = null;
            let extractedQty = 1;
            let quantityWasHandled = false;
            let protectedFirstNumber = false;

            activeFilters.forEach(filter => {
                let stepNum = filter.order ?? filter.defaultOrder;

                switch (filter.id) {
                    case "f_dedup_chars":
                        words = words.map(w => w.replace(/([^\d\sو])\1{2,}/g, '$1'));
                        break;

                    case "f_dict_replace": {
                        let dict = (typeof DB !== 'undefined' && DB.getVoiceDictionary) ? DB.getVoiceDictionary() : DefaultVoiceConfig.dictionary;
                        let joined = words.join(" ").toLowerCase();
                        for (let key in dict) {
                            let target = String(dict[key]);
                            let esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            joined = joined.replace(new RegExp(`(^|\\s)${esc}(?=\\s|$)`, 'gi'), `$1${target}`);
                        }
                        words = joined.split(/\s+/).filter(Boolean);
                        break;
                    }

                    case "f_phonetic_peeler":
                        words = words.map(w => this.peeler(w, false)).join(" ").split(/\s+/).filter(Boolean);
                        break;

                    case "f_anchor_tens":
                        for (let i = 0; i < words.length; i++) {
                            let w = words[i];
                            let pW = this.peeler(w, false);
                            if (pW.startsWith("و") && pW.length > 3) {
                                let tenWord = pW.substring(1);
                                if (this.anchors.tens[tenWord]) {
                                    let tenVal = this.anchors.tens[tenWord];
                                    let prevW = words[i - 1];
                                    if (prevW && isNaN(prevW)) {
                                        let rescue = this.rescueNumber(prevW, 40);
                                        if (rescue) {
                                            words[i - 1] = (rescue.number + tenVal).toString();
                                            words.splice(i, 1); i--;
                                            addLog("rescue", `[فلتر #${stepNum}] إنقاذ وتد العشرات`, `دمج <span class="highlight-danger">${prevW}</span> + <mark>${tenWord}</mark> ⬅️ <b>${words[i]}</b>`);
                                        }
                                    }
                                }
                            }
                        }
                        break;

                    case "f_anchor_hundreds":
                        for (let i = 0; i < words.length; i++) {
                            let pW = this.peeler(words[i], false);
                            if (this.anchors.hundreds[pW]) {
                                let hunVal = this.anchors.hundreds[pW];
                                let nextW = words[i + 1];
                                if (nextW && nextW.startsWith("و")) {
                                    let rescue = this.rescueNumber(nextW.substring(1), 40);
                                    if (rescue) {
                                        words[i] = (hunVal + rescue.number).toString();
                                        words.splice(i + 1, 1);
                                        addLog("rescue", `[فلتر #${stepNum}] إنقاذ وتد المئات`, `دمج <mark>${pW}</mark> + <span class="highlight-danger">${nextW}</span> ⬅️ <b>${words[i]}</b>`);
                                    }
                                } else {
                                    words[i] = hunVal.toString();
                                }
                            }
                        }
                        break;

                    case "f_strip_leading_waw": {
                        let protectedWawRoots = String(filter.targetPattern || "وات, واط, وش, وصله, وصلة, ورم, وارم, وان, واير, ولاعه, ودن, وسام")
                            .split(/[,،]+/).map(s => this.peeler(s.trim(), false)).filter(Boolean);
                        for (let i = 0; i < words.length; i++) {
                            let pW = this.peeler(words[i], false);
                            if (words[i].startsWith("و") && words[i].length > 2 && !protectedWawRoots.includes(pW)) {
                                let oldW = words[i];
                                words[i] = words[i].substring(1);
                                addLog("peel", `[فلتر #${stepNum}] نزع الواو الزائدة ✂️`, `<mark>${oldW}</mark> ⬅️ <b>${words[i]}</b>`);
                            }
                        }
                        break;
                    }

                    case "f_words_to_numbers":
                        for (let i = 0; i < words.length; i++) {
                            if (isNaN(words[i])) {
                                let tol = (i === 0) ? 65 : 78;
                                let numCheck = this.rescueNumber(words[i], tol);
                                if (numCheck) words[i] = numCheck.number.toString();
                            }
                        }
                        break;

                    case "f_dual_catcher": {
                        let dualPrefixes = String(filter.targetPattern || "جوز, حتتين, قطعتين, حبتين, فرعين")
                            .split(/[,،]+/).map(s => this.peeler(s.trim(), false)).filter(Boolean);
                        if (words.length > 1 && dualPrefixes.includes(this.peeler(words[0], false))) {
                            dualQtyFound = 2;
                            words.shift();
                        }
                        let protectedIn = ["عشرين", "تلاتين", "اربعين", "خمسين", "ستين", "سبعين", "تمانين", "تسعين", "اتنين", "اثنين", "بنزين", "يمين", "شربين", "مشتركين", "فلسطين"];
                        for (let i = 0; i < words.length; i++) {
                            let w = this.peeler(words[i], false);
                            if (w.length > 4 && w.endsWith("ين") && !protectedIn.includes(w)) {
                                dualQtyFound = 2;
                                words[i] = w.endsWith("تين") ? (w.slice(0, -3) + "ه") : w.slice(0, -2);
                                addLog("anchor", `[فلتر #${stepNum}] صائد المثنى الذكي`, `<mark>${w}</mark> ⬅️ الكمية: <b>2</b> | المفرد: <b>${words[i]}</b>`);
                                break;
                            }
                        }
                        break;
                    }

                    case "f_plural_to_singular": {
                        let pairs = String(filter.targetPattern || "").split(/[,،]+/).map(s => s.trim()).filter(Boolean);
                        let pluralMap = {};
                        pairs.forEach(p => {
                            let parts = p.split("->").map(x => this.peeler(x.trim(), false));
                            if (parts.length === 2 && parts[0] && parts[1]) pluralMap[parts[0]] = parts[1];
                        });
                        for (let i = 0; i < words.length; i++) {
                            let pW = this.peeler(words[i], false);
                            if (pluralMap[pW]) {
                                addLog("anchor", `[فلتر #${stepNum}] رد الجمع للمفرد`, `<mark>${words[i]}</mark> ⬅️ <b>${pluralMap[pW]}</b>`);
                                words[i] = pluralMap[pW];
                            } else if (pW.length >= 5 && pW.endsWith("ات") && !["ساعات", "شربات", "ثرموستات"].includes(pW)) {
                                // # قاعدة عامة لجمع المؤنث السالم إذا كان مفرده موجوداً في المخزن (مثل: لمبات -> لمبه / كشافات -> كشاف)
                                let stem = pW.slice(0, -2);
                                let femCandidate = stem + "ه";
                                if (this._vocabSet.has(femCandidate)) {
                                    words[i] = femCandidate;
                                    addLog("anchor", `[فلتر #${stepNum}] رد الجمع للمفرد`, `<mark>${pW}</mark> ⬅️ <b>${femCandidate}</b>`);
                                } else if (this._vocabSet.has(stem)) {
                                    words[i] = stem;
                                    addLog("anchor", `[فلتر #${stepNum}] رد الجمع للمفرد`, `<mark>${pW}</mark> ⬅️ <b>${stem}</b>`);
                                }
                            }
                        }
                        break;
                    }

                    case "f_protect_units":
                        if (words.length > 1 && !isNaN(words[0])) {
                            let nextW = this.peeler(words[1], false);
                            if (unitsList.includes(nextW)) {
                                protectedFirstNumber = true;
                                addLog("anchor", `[فلتر #${stepNum}] حماية الوحدات 🔒`, `حماية <mark>${words[0]} ${words[1]}</mark> كمواصفة للصنف.`);
                            }
                        }
                        break;

                    case "f_extract_quantity":
                        quantityWasHandled = true;
                        if (cfg.ignoreQuantitiesMode) {
                            // # في وضع المخزن (تجاهل الكميات): لا نسحب كمية، وإذا كان الرقم في البداية حر نحذفه ليظل اسم الصنف صافياً
                            extractedQty = "";
                            if (words.length > 0 && !isNaN(words[0]) && !protectedFirstNumber) {
                                words.shift();
                            }
                        } else {
                            extractedQty = dualQtyFound !== null ? dualQtyFound : 1;
                            if (words.length > 0 && !isNaN(words[0]) && !protectedFirstNumber) {
                                extractedQty = Number(words[0]);
                                words.shift();
                            }
                        }
                        break;
                }
            });

            // # إذا كان فلتر سحب الكميات متوقفاً تماماً (🔴) من لوحة الفلاتر أو في وضع المخزن
            if (!quantityWasHandled || cfg.ignoreQuantitiesMode) {
                if (cfg.ignoreQuantitiesMode || (filterMap.get("f_extract_quantity") === undefined)) {
                    let qFilterInCatalog = pipeline.find(f => f.id === "f_extract_quantity");
                    let shouldDropLeadingNum = cfg.ignoreQuantitiesMode || (qFilterInCatalog && String(qFilterInCatalog.targetPattern).includes("مسح"));
                    if (shouldDropLeadingNum && words.length > 1 && !isNaN(words[0]) && !protectedFirstNumber) {
                        words.shift();
                    }
                    extractedQty = cfg.ignoreQuantitiesMode ? "" : 1;
                }
            }

            let rawItemName = words.join(" ").trim();
            if (!rawItemName) return;

            // # المرحلة الثالثة: قاضي المطابقة وبوابة الفلترة النهائية (تخضع لفلاتر 22، 23، 24)
            let matchResult = this._evaluateCandidateWithStudio(rawItemName, inventoryDB, cfg, filterMap, addLog);
            if (matchResult.status === "matched" || matchResult.status === "no_db") {
                extractedQueue.push({
                    qty: extractedQty === "" ? 1 : extractedQty,
                    displayQty: extractedQty,
                    name: matchResult.matchedName,
                    cleanName: matchResult.cleanName || matchResult.matchedName,
                    score: matchResult.score
                });
            }
        });

        // # المحطة الأخيرة (فلتر 25): دمج وجمع الأصناف المكررة إذا كان الفلتر مفعلاً
        let finalQueue = [];
        let mergeFilterActive = filterMap.has("f_merge_duplicates") && cfg.mergeDuplicates !== false && !cfg.ignoreQuantitiesMode;

        if (mergeFilterActive) {
            let map = new Map();
            let stepNum = filterMap.get("f_merge_duplicates").order || 25;
            extractedQueue.forEach(item => {
                let key = item.name;
                if (map.has(key)) {
                    let existing = map.get(key);
                    let oldQty = existing.qty;
                    existing.qty += item.qty;
                    existing.displayQty = existing.qty;
                    addLog("anchor", `[فلتر #${stepNum}] دمج الأصناف المكررة 🔄`, `جمع تكرار <mark>${item.cleanName}</mark>: (${oldQty} + ${item.qty}) = <b>${existing.qty}</b>`);
                } else {
                    map.set(key, { ...item });
                    finalQueue.push(map.get(key));
                }
            });
        } else {
            finalQueue = extractedQueue;
        }

        return {
            queue: finalQueue,
            logsHTML: logs.join(""),
            activeProfile: activeProfile
        };
    },

    // # قاضي المطابقة المتصل بمفاتيح الاستوديو (الدردشة + المغناطيس + عدم تأليف باقي الصنف)
    _evaluateCandidateWithStudio: function(spokenItemName, inventoryDB, cfg, filterMap, addLog) {
        let shadowList = this.prepareInventoryShadow(inventoryDB);
        if (shadowList.length === 0) {
            return { matchedName: spokenItemName, cleanName: spokenItemName, score: 100, status: "no_db" };
        }

        let unitsList = (typeof DB !== 'undefined' && DB.getVoiceUnits) ? DB.getVoiceUnits().map(u => this.peeler(u, false)) : [];
        let peeledSpoken = this.peeler(spokenItemName);
        let spokenWords = peeledSpoken.split(" ").filter(Boolean);
        let spokenNumbers = spokenWords.filter(w => !isNaN(w)).map(Number);
        let spokenCoreWords = spokenWords.filter(w => isNaN(w) && !unitsList.includes(w));
        let spokenUnitWords = spokenWords.filter(w => isNaN(w) && unitsList.includes(w));

        // # فحص فلتر طرد الدردشة والسلامات (#22)
        if (filterMap.has("f_chitchat_expel")) {
            let chitFilter = filterMap.get("f_chitchat_expel");
            let chitWords = String(chitFilter.targetPattern || "").split(/[,،]+/).map(w => this.peeler(w.trim(), false)).filter(Boolean);
            let nonChit = spokenCoreWords.filter(w => !chitWords.includes(w));
            if (nonChit.length === 0 && spokenNumbers.length === 0) {
                if (addLog) addLog("peel", `[فلتر #${chitFilter.order || 22}] طرد الدردشة والسلامات 🧹`, `تم استبعاد العبارة الجانبية: <mark>${spokenItemName}</mark>`);
                return { matchedName: null, score: 0, status: "chitchat" };
            }
            spokenCoreWords = nonChit;
        }

        let magnetActive = filterMap.has("f_number_magnet");
        let noInventActive = filterMap.has("f_no_invent_trim");

        let bestCandidate = null;
        let highestFinalScore = 0;
        let bestApproximatedNum = null;
        let matchReason = "";

        shadowList.forEach(dbItem => {
            if (dbItem.peeled === peeledSpoken) {
                highestFinalScore = 100;
                bestCandidate = dbItem;
                bestApproximatedNum = null;
                matchReason = "تطابق تام 100%";
                return;
            }

            let matchedCoreScore = 0;
            spokenCoreWords.forEach(sw => {
                let bestW = 0;
                dbItem.textWords.forEach(dw => {
                    let s = this.fuzzyMatch(sw, dw);
                    if (s > bestW) bestW = s;
                });
                matchedCoreScore += bestW;
            });

            let avgCoreScore = spokenCoreWords.length > 0 ? (matchedCoreScore / spokenCoreWords.length) : 0;
            if (avgCoreScore < (100 - cfg.letterTolerance)) return;

            let firstWordBonus = 0;
            if (spokenCoreWords[0] && dbItem.textWords[0]) {
                let firstSim = this.fuzzyMatch(spokenCoreWords[0], dbItem.textWords[0]);
                if (firstSim >= 75) firstWordBonus = (cfg.firstWordBonus || 20) * (firstSim / 100);
            }

            let unitBonus = 0;
            if (spokenUnitWords.length > 0) {
                let hasSameUnit = spokenUnitWords.some(u => dbItem.textWords.includes(u));
                unitBonus = hasSameUnit ? 8 : -8;
            }

            let numberEffect = 0;
            let numNote = "";
            let candidateApproxNum = null;

            if (magnetActive && spokenNumbers.length > 0) {
                let magnetWeight = (cfg.numberMagnet || 80) / 100;
                if (dbItem.numbers.length > 0) {
                    let exactNumMatch = spokenNumbers.every(sn => dbItem.numbers.includes(sn));
                    if (exactNumMatch) {
                        numberEffect = 28 * magnetWeight;
                        numNote = "🎯 تطابق الرقم المشترك";
                    } else {
                        let sNum = spokenNumbers[0];
                        let closestDiffRatio = 999;
                        let closestDbNum = dbItem.numbers[0];
                        dbItem.numbers.forEach(dn => {
                            let diffRatio = Math.abs(sNum - dn) / Math.max(sNum, dn, 1);
                            if (diffRatio < closestDiffRatio) {
                                closestDiffRatio = diffRatio;
                                closestDbNum = dn;
                            }
                        });
                        if (closestDiffRatio <= 0.35 && avgCoreScore >= 75) {
                            numberEffect = (15 * (1 - closestDiffRatio)) * magnetWeight;
                            candidateApproxNum = closestDbNum;
                            numNote = `📏 تقريب المقاس (${sNum} ⬅️ ${closestDbNum})`;
                        } else {
                            numberEffect = -12 * magnetWeight;
                        }
                    }
                } else {
                    numberEffect = -5;
                }
            }

            let totalScore = (avgCoreScore * 0.78) + firstWordBonus + unitBonus + numberEffect;
            totalScore = Math.min(100, Math.max(0, totalScore));

            if (totalScore > highestFinalScore) {
                highestFinalScore = totalScore;
                bestCandidate = dbItem;
                bestApproximatedNum = candidateApproxNum;
                matchReason = numNote;
            }
        });

        highestFinalScore = Math.round(highestFinalScore);

        if (bestCandidate && highestFinalScore >= cfg.searchThreshold) {
            let finalOutputName = bestCandidate.cleanDisplay;

            // # تنفيذ فلتر عدم تأليف باقي اسم الصنف (#24) إذا كان مفعلاً
            if (noInventActive) {
                let displayTokens = bestCandidate.cleanDisplay
                    .replace(/(\d+(?:\.\d+)?)([^\d\s\.×\+\/])/g, '$1 $2')
                    .replace(/([^\d\s\.×\+\/])(\d+(?:\.\d+)?)/g, '$1 $2')
                    .split(/\s+/).filter(Boolean);

                let verifiedTokens = [];
                let minWordSim = Math.max(55, 100 - cfg.letterTolerance);

                displayTokens.forEach(dTok => {
                    let pTok = this.peeler(dTok);
                    if (!pTok) return;
                    if (!isNaN(pTok)) {
                        let numVal = Number(pTok);
                        if (spokenNumbers.includes(numVal) || (bestApproximatedNum !== null && numVal === bestApproximatedNum)) {
                            verifiedTokens.push(dTok);
                        }
                    } else {
                        let wasSpoken = spokenWords.some(sw => isNaN(sw) && this.fuzzyMatch(sw, pTok) >= minWordSim);
                        if (wasSpoken) verifiedTokens.push(dTok);
                    }
                });

                if (verifiedTokens.length > 0) {
                    finalOutputName = verifiedTokens.join(" ");
                }
            }

            if (addLog) {
                addLog("success", `قاضي المطابقة (${highestFinalScore}%) ✅`, `المنطوق: <mark>${spokenItemName}</mark> ⬅️ النتيجة المعتمدة: <b>${finalOutputName}</b> ${matchReason ? `<span style="color:#fde047;">(${matchReason})</span>` : ""}`);
            }

            return {
                matchedName: finalOutputName,
                cleanName: finalOutputName,
                score: highestFinalScore,
                status: "matched"
            };
        } else {
            if (addLog) {
                addLog("rescue", "بوابة الفلترة والعزل 🚫", `استبعاد <span class="highlight-danger">${spokenItemName}</span> (أعلى شبه: ${highestFinalScore}% أقل من المؤشر ${cfg.searchThreshold}%)`);
            }
            return { matchedName: null, score: highestFinalScore, status: "rejected" };
        }
    },

    parseCommand: function(rawChunk, inventoryDB, profileOverride) {
        let res = this.analyzeFullText(rawChunk, inventoryDB, profileOverride);
        return (res.queue && res.queue.length > 0) ? { name: res.queue[0].name, qty: res.queue[0].qty } : null;
    }
};

window.DB.migrateOldData();
window.DB.applySavedTheme();
initCloud();

// التقاط تلقائي لأي حفظ مباشر في seraj_smart_notes من داخل الصفحات ورفعه للسحابة فوراً
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
