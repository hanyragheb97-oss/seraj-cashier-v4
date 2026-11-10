// =========================================================================
// 🌟 محرك سراج كاشير المركزي (النسخة المعمارية الموحدة النهائية - V4 Final)
// العمود الفقري الشامل لربط صفحات: المخزن، المبيعات، سجل المبيعات، المشتريات،
// سجل المشتريات، العملاء، الموردين، الخزينة، المحاسب الذكي، الصور، والمساعد الصوتي.
// =========================================================================
// ==================== [ بداية الجزء الأول 1/3 ] ====================

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
let myDevicePrefix = localStorage.getItem('seraj_device_prefix');

if (!myDeviceName || !myDevicePrefix) {
    while (!myDeviceName || myDeviceName.trim() === "") {
        myDeviceName = prompt("مرحباً بك في (سراج كاشير V4) 🛠️\n🛑 إجباري: أدخل اسم هذا المستخدم/الجهاز (مثال: هاني أو كاشير 1):");
        if (myDeviceName === null) myDeviceName = "كاشير 1";
    }
    while (!myDevicePrefix || !/^[a-zA-Z]$/.test(myDevicePrefix)) {
        myDevicePrefix = prompt("🛑 إجباري: أدخل حرف إنجليزي واحد مميز ليكون بادئة فواتير هذا الجهاز (مثال: A أو B أو C):");
        if (myDevicePrefix === null) myDevicePrefix = "A";
    }
    myDeviceName = myDeviceName.trim();
    myDevicePrefix = myDevicePrefix.toUpperCase();
    localStorage.setItem('seraj_device_name', myDeviceName);
    localStorage.setItem('seraj_device_prefix', myDevicePrefix);
}

// تثبيت معرف المتجر في الذاكرة المحلية مع طلب الرقم إجبارياً عند مسح البيانات
let currentStoreId = localStorage.getItem('seraj_store_id');
if (!currentStoreId) {
    while (!currentStoreId || currentStoreId.trim() === "") {
        currentStoreId = prompt("🛑 إجباري: أدخل رقم أو كود المحل (مثال: 1234):");
        if (currentStoreId === null) currentStoreId = "9999";
    }
    currentStoreId = currentStoreId.trim();
    localStorage.setItem('seraj_store_id', currentStoreId);
}
const _origSetItem = localStorage.setItem.bind(localStorage);
let _isInternalSetItem = false;

function _internalSetItem(key, value) {
    _isInternalSetItem = true;
    try {
        _origSetItem(key, value);
    } finally {
        _isInternalSetItem = false;
    }
}

function initCloud() {
    const startRealtimeDB = () => {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        window.dbCloud = firebase.database();
        cloudReady = true;
        showCloudStatus('⚡ متصل بالسحابي: ' + currentStoreId);
        scheduleSyncQueue(15000); // مزامنة هادئة بعد استقرار الاتصال بـ 15 ثانية عند فتح البرنامج
        startScheduledSyncTimer();
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

// ---------------------------------------------------------
// 1. Utilities (دوال المساعدة المركزية، البحث السريع، التواريخ المحلية لمصر، وبوابات الحماية)
// ---------------------------------------------------------
const _buttonLocks = new WeakSet();

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

// تجريد الكائن من الحقول المحسوبة المؤقتة قبل مقارنة التغييرات لمنع تضخم طابور المزامنة
function _stripComputedFieldsForDiff(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    let copy = { ...obj };
    delete copy.computedRemaining;
    delete copy.calculatedRemaining;
    delete copy._lastModified;
    delete copy.balance;
    delete copy.calculatedBalance;
    delete copy.netBalanceVal;
    delete copy.isNetDebt;
    delete copy.deferredInvoicesTotal;
    delete copy.displayCurrentBalance;
    delete copy.isCurrentBalDebt;
    delete copy.isZeroCustomer;
    delete copy.isZeroBalance;
    delete copy.isZeroIdle;
    delete copy.isIdleZero;
    return copy;
}

window.Utils = {
    formatCurrency: function(amount) {
        let num = parseFloat(amount);
        if (isNaN(num)) return "0.00";
        return num.toFixed(2);
    },

    // دالة Debounce مركزية لتخفيف الضغط ومنع تهنيج الكيبورد أثناء البحث والفلترة
    debounce: function(fn, delay = 220) {
        let timer = null;
        return function(...args) {
            const context = this;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                fn.apply(context, args);
            }, delay);
        };
    },

    // دالة توحيد الأسماء العربية (توحيد الهمزات والتاء المربوطة والياء والمسافات والأرقام لمنع التكرار)
    normalizeName: function(str) {
        if (!str) return "";
        return String(str)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase();
    },

    // محرك البحث والفلترة السريعة المفهرسة في الجداول والقوائم
    fastSearch: function(list, query, keys = ['name', 'phone', 'id', 'barcode', 'code', 'customer', 'supplier', 'notes'], limit = 0) {
        if (!Array.isArray(list)) return [];
        let normQ = this.normalizeName(query);
        if (!normQ) return limit > 0 ? list.slice(0, limit) : list;

        let tokens = normQ.split(' ').filter(Boolean);
        let results = [];

        for (let i = 0; i < list.length; i++) {
            let item = list[i];
            if (!item) continue;

            let hay = item._searchIndex;
            if (!hay || item._searchIndexMod !== item._lastModified) {
                let parts = [];
                for (let k = 0; k < keys.length; k++) {
                    let val = item[keys[k]];
                    if (val !== undefined && val !== null && val !== '') {
                        parts.push(this.normalizeName(val));
                    }
                }
                hay = parts.join(' ');
                try {
                    Object.defineProperty(item, '_searchIndex', { value: hay, writable: true, configurable: true, enumerable: false });
                    Object.defineProperty(item, '_searchIndexMod', { value: item._lastModified, writable: true, configurable: true, enumerable: false });
                } catch (e) {}
            }

            let matched = true;
            for (let t = 0; t < tokens.length; t++) {
                if (!hay.includes(tokens[t])) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                results.push(item);
                if (limit > 0 && results.length >= limit) break;
            }
        }
        return results;
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

    // استخراج التاريخ المحلي القياسي لمصر بصيغة YYYY-MM-DD (وليس UTC)
    getLocalDateString: function(dateInput = null) {
        let d;
        if (dateInput instanceof Date) {
            d = dateInput;
        } else if (typeof dateInput === 'number' && dateInput > 0) {
            d = new Date(dateInput);
        } else if (typeof dateInput === 'string' && dateInput.trim() !== '') {
            let clean = dateInput.replace(/[٠-٩]/g, x => "٠١٢٣٤٥٦٧٨٩".indexOf(x)).trim();
            let exactIso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (exactIso) return `${exactIso[1]}-${exactIso[2]}-${exactIso[3]}`;
            let ms = this.getSafeTime(clean);
            d = ms > 0 ? new Date(ms) : new Date();
        } else {
            d = new Date();
        }
        if (isNaN(d.getTime())) d = new Date();
        let y = d.getFullYear();
        let m = String(d.getMonth() + 1).padStart(2, '0');
        let day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    toLocalISODate: function(dateInput = null) {
        return this.getLocalDateString(dateInput);
    },

    // تطبيع أي حقل تاريخ إلى صيغة YYYY-MM-DD المحلية القياسية
    normalizeDateStr: function(dateVal, fallbackTs = null) {
        if (dateVal) {
            let clean = String(dateVal)
                .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
                .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
                .trim();
            let isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
            if (isoMatch && !clean.includes('T')) {
                let y = isoMatch[1];
                let m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
                let d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            let dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dmyMatch) {
                let d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
                let m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
                let y = dmyMatch[3];
                return `${y}-${m}-${d}`;
            }
            let ms = this.getSafeTime(clean);
            if (ms > 0) return this.getLocalDateString(ms);
        }
        if (fallbackTs) {
            let ms = this.getSafeTime(fallbackTs);
            if (ms > 0) return this.getLocalDateString(ms);
        }
        return this.getLocalDateString();
    },

    // مزامنة timestamp ليتوافق زمنياً مع اليوم المختار في حقل date
    alignTimestampWithDate: function(dateStr, currentTs = null) {
        let now = Date.now();
        let rawTs = Number(currentTs);
        let baseTs = (!isNaN(rawTs) && rawTs > 0) ? rawTs : now;
        let normalizedDate = this.normalizeDateStr(dateStr, baseTs);
        let baseDateStr = this.getLocalDateString(baseTs);

        if (normalizedDate === baseDateStr) {
            return baseTs;
        }

        let parts = normalizedDate.split('-');
        if (parts.length === 3) {
            let refDate = new Date(baseTs);
            if (isNaN(refDate.getTime())) refDate = new Date(now);
            let aligned = new Date(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10),
                refDate.getHours(),
                refDate.getMinutes(),
                refDate.getSeconds(),
                refDate.getMilliseconds()
            ).getTime();
            if (!isNaN(aligned) && aligned > 0) return aligned;
        }
        return baseTs;
    },

    syncDateAndTimestamp: function(dateInput, tsInput) {
        let normDate = this.normalizeDateStr(dateInput, tsInput);
        let alignedTs = this.alignTimestampWithDate(normDate, tsInput);
        return { date: normDate, timestamp: alignedTs };
    },

    getSafeTime: function(dateVal) {
        if (!dateVal) return 0;
        if (typeof dateVal === 'number') return isNaN(dateVal) ? 0 : dateVal;
        if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? 0 : dateVal.getTime();
        let clean = String(dateVal)
            .replace(/[\u200B-\u200F\u202A-\u202E\u061C\uFEFF]/g, '')
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
            .trim();
        if (!clean) return 0;

        let ymdOnly = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (ymdOnly) {
            return new Date(parseInt(ymdOnly[1], 10), parseInt(ymdOnly[2], 10) - 1, parseInt(ymdOnly[3], 10), 12, 0, 0).getTime() || 0;
        }

        let dmyOnly = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyOnly) {
            return new Date(parseInt(dmyOnly[3], 10), parseInt(dmyOnly[2], 10) - 1, parseInt(dmyOnly[1], 10), 12, 0, 0).getTime() || 0;
        }

        let parsed = Date.parse(clean);
        if (!isNaN(parsed)) return parsed;

        let parts = clean.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
        if (parts) {
            let p1 = parseInt(parts[1], 10), p2 = parseInt(parts[2], 10), p3 = parseInt(parts[3], 10);
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

    // استخراج الرقم التسلسلي للفاتورة أو العنصر حتى لو كان يحمل بادئة جهاز مثل A-105
    extractSerialNum: function(idVal) {
        if (idVal === undefined || idVal === null) return 0;
        if (typeof idVal === 'number') return isNaN(idVal) ? 0 : idVal;
        let str = String(idVal).trim();
        let n = Number(str);
        if (!isNaN(n)) return n;
        let parts = str.split('-');
        if (parts.length > 1) {
            let tail = parseInt(parts[parts.length - 1].replace(/\D/g, ''), 10);
            if (!isNaN(tail)) return tail;
        }
        let digits = parseInt(str.replace(/\D/g, ''), 10);
        return isNaN(digits) ? 0 : digits;
    },

    extractSerialNumber: function(idVal) {
        return this.extractSerialNum(idVal);
    },

    // تنظيف المعرفات العشرية (Float IDs الناتجة من Date.now() + Math.random() عند استيراد الإكسيل)
    sanitizeEntityId: function(rawId) {
        if (rawId === undefined || rawId === null || rawId === '') {
            return this.generateUniqueId();
        }
        let str = String(rawId).trim();
        if (str.includes('.')) {
            return str.replace(/\./g, '');
        }
        return str;
    },

    generateInvoiceId: function(type = 'sales') {
        let devPrefix = localStorage.getItem('seraj_device_prefix') || 'X';
        let invoices = [];
        try {
            invoices = type === 'sales'
                ? safeParseJSON(localStorage.getItem('seraj_sales_invoices'), [])
                : safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
        } catch (e) {
            invoices = [];
        }

        let deviceInvoices = invoices.filter(inv => {
            let invNo = String(inv?.invoiceNo || inv?.id || '');
            return invNo.startsWith(devPrefix + '-');
        });

        let maxNum = 99;
        if (deviceInvoices.length > 0) {
            deviceInvoices.forEach(inv => {
                let invNo = String(inv.invoiceNo || inv.id || '');
                let parts = invNo.split('-');
                if (parts.length > 1) {
                    let numPart = parseInt(parts[1], 10);
                    if (!isNaN(numPart) && numPart > maxNum) {
                        maxNum = numPart;
                    }
                }
            });
        }

        let nextNum = maxNum + 1;
        return `${devPrefix}-${nextNum}`;
    },

    generateUniqueId: function(prefix = '') {
        let lastSeq = parseInt(localStorage.getItem('seraj_short_seq_id') || '1000', 10);
        if (isNaN(lastSeq) || lastSeq < 1000) lastSeq = 1000;

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
            checkMax(safeParseJSON(localStorage.getItem('seraj_products'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_customers'), []));
            checkMax(safeParseJSON(localStorage.getItem('seraj_suppliers'), []));
        } catch (e) {}

        let nextSeq = lastSeq + 1;
        localStorage.setItem('seraj_short_seq_id', String(nextSeq));
        return prefix ? `${prefix}${nextSeq}` : String(nextSeq);
    },

    // دالة تصدير PDF حقيقية مركزية تدعم html2pdf والطباعة المباشرة كبديل أوفلاين
    downloadRealPDF: function(htmlOrElement, fileName = 'seraj_report.pdf') {
        return new Promise((resolve) => {
            let cleanFileName = String(fileName || 'seraj_report.pdf');
            if (!cleanFileName.toLowerCase().endsWith('.pdf')) cleanFileName += '.pdf';

            const runExport = () => {
                let container = null;
                let targetEl = null;

                if (typeof htmlOrElement === 'string') {
                    container = document.createElement('div');
                    container.style.cssText = 'position:fixed; left:-9999px; top:0; width:210mm; background:#fff; color:#000; padding:15px; direction:rtl; font-family:Cairo, sans-serif; z-index:-1;';
                    container.innerHTML = htmlOrElement;
                    document.body.appendChild(container);
                    targetEl = container;
                } else if (htmlOrElement instanceof Element) {
                    targetEl = htmlOrElement;
                } else {
                    targetEl = document.body;
                }

                if (typeof window.html2pdf === 'function') {
                    let opt = {
                        margin: [8, 8, 8, 8],
                        filename: cleanFileName,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, logging: false },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };
                    window.html2pdf().set(opt).from(targetEl).save().then(() => {
                        if (container && container.parentNode) container.parentNode.removeChild(container);
                        resolve(true);
                    }).catch(err => {
                        console.error("PDF Export Error:", err);
                        if (container && container.parentNode) container.parentNode.removeChild(container);
                        resolve(false);
                    });
                } else {
                    try {
                        let printWin = window.open('', '_blank', 'width=900,height=700');
                        if (printWin) {
                            let contentHtml = typeof htmlOrElement === 'string' ? htmlOrElement : targetEl.outerHTML;
                            printWin.document.open();
                            printWin.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${cleanFileName}</title><style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px;color:#000;background:#fff;}table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #333;padding:8px;text-align:center;}</style></head><body>${contentHtml}</body></html>`);
                            printWin.document.close();
                            setTimeout(() => {
                                printWin.focus();
                                printWin.print();
                                printWin.close();
                            }, 350);
                        }
                    } catch (e) {
                        console.error("Print Fallback Error:", e);
                    }
                    if (container && container.parentNode) container.parentNode.removeChild(container);
                    resolve(true);
                }
            };

            if (typeof window.html2pdf === 'function' || !navigator.onLine) {
                runExport();
            } else {
                let script = document.createElement('script');
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                script.onload = runExport;
                script.onerror = runExport;
                document.head.appendChild(script);
            }
        });
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
window.getLocalDateStr = function(d) { return window.Utils.getLocalDateString(d); };
window.debounce = window.Utils.debounce;
window.fastSearch = function(list, query, keys, limit) { return window.Utils.fastSearch(list, query, keys, limit); };

if (typeof window.exportToPDF !== 'function') {
    window.exportToPDF = function(targetElOrHtml, fileName = 'seraj_export.pdf') {
        let el = targetElOrHtml || document.querySelector('table') || document.body;
        return window.Utils.downloadRealPDF(el, fileName);
    };
}
if (typeof window.exportToExcel !== 'function') {
    window.exportToExcel = function(tableIdOrEl, fileName = 'seraj_export.xls') {
        try {
            let tableEl = typeof tableIdOrEl === 'string' ? document.getElementById(tableIdOrEl) : (tableIdOrEl || document.querySelector('table'));
            if (!tableEl) return false;
            let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" dir="rtl"><head><meta charset="UTF-8"></head><body>${tableEl.outerHTML}</body></html>`;
            let blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = String(fileName).endsWith('.xls') || String(fileName).endsWith('.xlsx') ? fileName : (fileName + '.xls');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return true;
        } catch (e) {
            console.error("Excel Export Error:", e);
            return false;
        }
    };
}

// جسر حماية ذكي: يُرجع التاريخ المحلي لمصر YYYY-MM-DD بدلاً من UTC عند استدعاء window.Utils.getSafeTime().split('T')[0]
if (!Number.prototype.split) {
    Object.defineProperty(Number.prototype, 'split', {
        value: function(sep, limit) {
            let ms = Number(this);
            let d = ms > 0 ? new Date(ms) : new Date();
            let localDate = window.Utils.getLocalDateString(d);
            let localTime = d.toTimeString().split(' ')[0] || '12:00:00';
            let str = (sep === 'T') ? `${localDate}T${localTime}` : ((sep === '-') ? localDate : d.toLocaleString('ar-EG'));
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
// 2.5. Central ImagesDB (محرك الصور المركزي الذكي - يدعم targetImgElementId مباشرة لشاشة المبيعات)
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

    _applyImageToDom: function(targetImgElementId, preparedImg) {
        if (!targetImgElementId || !preparedImg) return;
        try {
            let el = typeof targetImgElementId === 'string'
                ? document.getElementById(targetImgElementId)
                : targetImgElementId;
            if (el) {
                let srcUrl = (preparedImg instanceof Blob) ? String(preparedImg) : preparedImg;
                el.src = srcUrl;
                el.style.display = '';
            }
        } catch (e) {}
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

    getImage: function(productId, targetImgElementId = null) {
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
                            let out = this._prepareOutput(rec.imageBlob || rec.image);
                            this._applyImageToDom(targetImgElementId, out);
                            resolve(out);
                        } else if (!isNaN(productId)) {
                            let reqNum = store.get(Number(productId));
                            reqNum.onsuccess = (ev) => {
                                let recNum = ev.target.result;
                                if (recNum && (recNum.imageBlob || recNum.image)) {
                                    let outNum = this._prepareOutput(recNum.imageBlob || recNum.image);
                                    this._applyImageToDom(targetImgElementId, outNum);
                                    resolve(outNum);
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
// 3. Sync Queue, Delete Queue & Smart Radars (Offline-First Calm Sync Engine)
// ---------------------------------------------------------
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
let _scheduledSyncInterval = null;
let _inFlightSyncKeys = new Set();
const CALM_SYNC_DELAY_MS = 3000; // ⚡ 3 ثواني فقط بدلاً من 3 دقائق للرفع الهادئ السريع

function getSyncConfigInternal() {
    let saved = safeParseJSON(localStorage.getItem('seraj_sync_settings'), null);
    
    // لو المتصفح لسة محتفظ بالإعدادات القديمة (5 دقائق)، هنمسحها ونجبره على السرعة الجديدة
    if (!saved || saved.intervalMs >= 300000) {
        return {
            autoSync: true,
            intervalMs: 15000, // ⚡ 15 ثانية للفحص الدوري التلقائي
            syncOnSaveDelayMs: CALM_SYNC_DELAY_MS
        };
    }
    return saved;
}

function startScheduledSyncTimer() {
    if (_scheduledSyncInterval) clearInterval(_scheduledSyncInterval);
    let cfg = getSyncConfigInternal();
    if (cfg.autoSync !== false) {
        let ms = Math.max(15000, parseInt(cfg.intervalMs, 10) || 300000);
        _scheduledSyncInterval = setInterval(() => {
            if (cloudReady && navigator.onLine) {
                processDeleteQueue();
                processSyncQueue();
            }
        }, ms);
    }
}

let _syncTargetTime = 0;
function scheduleSyncQueue(customDelayMs = null) {
    let cfg = getSyncConfigInternal();
    if (cfg.autoSync === false && customDelayMs === null) return;
    let delay = customDelayMs !== null ? customDelayMs : (cfg.syncOnSaveDelayMs || CALM_SYNC_DELAY_MS);
    let newTarget = Date.now() + delay;
    if (_syncTimer && _syncTargetTime > Date.now() && newTarget >= _syncTargetTime) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTargetTime = newTarget;
    _syncTimer = setTimeout(() => {
        _syncTimer = null;
        _syncTargetTime = 0;
        processDeleteQueue();
        processSyncQueue();
    }, delay);
}

// إزالة أي عنصر من طابور الحذف فور إضافته أو تعديله في طابور المزامنة (منع Race Condition عند تعديل السندات)
function removeFromDeleteQueue(colName, idStr) {
    let rawDel = localStorage.getItem('seraj_delete_queue');
    if (!rawDel) return;
    let delQueue = safeParseJSON(rawDel, []);
    let filtered = delQueue.filter(q => !(q.col === colName && String(q.id) === String(idStr)));
    if (filtered.length !== delQueue.length) {
        _internalSetItem('seraj_delete_queue', JSON.stringify(filtered));
    }
}

function addToSyncQueue(colName, itemData, immediate = false) {
    if (!itemData || itemData.id === undefined || itemData.id === null) return;
    let idStr = String(itemData.id);
    removeFromDeleteQueue(colName, idStr);

    let queue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    queue = queue.filter(q => !(q.col === colName && String(q.data?.id) === idStr));
    queue.push({ col: colName, data: itemData });
    _internalSetItem('seraj_sync_queue', JSON.stringify(queue));
    if (immediate) {
        processSyncQueue();
    } else {
        scheduleSyncQueue();
    }
}

function addToDeleteQueue(colName, itemId, immediate = false) {
    if (itemId === undefined || itemId === null) return;
    let delQueue = safeParseJSON(localStorage.getItem('seraj_delete_queue'), []);
    let idStr = String(itemId);
    if (!delQueue.some(q => q.col === colName && String(q.id) === idStr)) {
        delQueue.push({ col: colName, id: idStr });
        _internalSetItem('seraj_delete_queue', JSON.stringify(delQueue));
    }
    let syncQueue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    syncQueue = syncQueue.filter(q => !(q.col === colName && String(q.data?.id) === idStr));
    _internalSetItem('seraj_sync_queue', JSON.stringify(syncQueue));
    if (immediate) {
        processDeleteQueue();
    } else {
        scheduleSyncQueue();
    }
}

// Polyfill آمن لصفحة الموردين (suppliers.html) لمنع ReferenceError عند استدعاء saveActionToQueueSafely
window.saveActionToQueueSafely = function(actionObj) {
    try {
        if (actionObj && actionObj.col && actionObj.data && actionObj.data.id !== undefined) {
            addToSyncQueue(actionObj.col, actionObj.data);
        } else {
            scheduleSyncQueue();
        }
    } catch (e) {}
    return true;
};

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
                _internalSetItem('seraj_delete_queue', JSON.stringify(currentDelQueue));
            }).catch(e => console.error("Delete Sync Error:", e));
    });
}

function processSyncQueue() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) return;
    let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    let queue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    if (queue.length === 0) return;

    showCloudStatus("⏳ جاري مزامنة التعديلات للسحابة...");

    let batch = queue.slice(0, 30);
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
                currentQueue = currentQueue.filter(item => !(item.col === q.col && String(item.data?.id) === String(q.data.id)));
                _internalSetItem('seraj_sync_queue', JSON.stringify(currentQueue));
                if (currentQueue.length > 0) {
                    setTimeout(() => processSyncQueue(), 250);
                }
            }).catch(e => {
                _inFlightSyncKeys.delete(lockKey);
                console.error("Sync Error", e);
            });
    });
}

window.addEventListener('online', () => {
    showCloudStatus("🌐 عاد الاتصال بالإنترنت! ستتم المزامنة الهادئة...");
    if (cloudReady) {
        _inFlightSyncKeys.clear();
        scheduleSyncQueue(5000);
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine && cloudReady && window.dbCloud) {
        _inFlightSyncKeys.clear();
        try {
            window.dbCloud.goOnline();
        } catch (e) {}
        scheduleSyncQueue(10000);
    }
});

let localCollectionsCache = {};
let renderTimers = {};
let _bgSaveTimers = {};

function saveArrayToQueueSafely(colName, newArray) {
    if (!Array.isArray(newArray)) newArray = [];
    localCollectionsCache[colName] = [...newArray];
    emitSerajUpdate(colName, 'local');

    if (_bgSaveTimers[colName]) clearTimeout(_bgSaveTimers[colName]);
    _bgSaveTimers[colName] = setTimeout(() => {
        try {
            let rawOldCache = localStorage.getItem('seraj_cloud_cache_' + colName);

            // إلغاء سقف الـ 25 عنصراً عند التزامن الأول لرفع جميع الأصناف عند استيراد إكسيل كامل أو تعديل شامل للأسعار
            if (!rawOldCache) {
                _internalSetItem('seraj_cloud_cache_' + colName, JSON.stringify(newArray));
                let queue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
                newArray.forEach(item => {
                    if (!item || item.id === undefined || item.id === null) return;
                    let idStr = String(item.id);
                    removeFromDeleteQueue(colName, idStr);
                    queue = queue.filter(q => !(q.col === colName && String(q.data?.id) === idStr));
                    queue.push({ col: colName, data: item });
                });
                _internalSetItem('seraj_sync_queue', JSON.stringify(queue));
                scheduleSyncQueue();
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
                if (!oldItem || JSON.stringify(_stripComputedFieldsForDiff(oldItem)) !== JSON.stringify(_stripComputedFieldsForDiff(newItem))) {
                    changedItems.push(newItem);
                }
            });

            if (changedItems.length > 0) {
                let queue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
                changedItems.forEach(item => {
                    let idStr = String(item.id);
                    removeFromDeleteQueue(colName, idStr);
                    queue = queue.filter(q => !(q.col === colName && String(q.data?.id) === idStr));
                    queue.push({ col: colName, data: item });
                });
                _internalSetItem('seraj_sync_queue', JSON.stringify(queue));
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

            _internalSetItem('seraj_cloud_cache_' + colName, JSON.stringify(newArray));
        } catch (e) {
            console.error("Queue Sync Error:", e);
        }
    }, 25);
}

function startSmartRadars() {
    if (!cloudReady || !window.dbCloud) return;
    currentStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    const collections = ['products', 'customers', 'sales_invoices', 'suppliers', 'purchase_invoices', 'treasury_moves', 'smart_notes'];

    collections.forEach(col => {
        let ref = window.dbCloud.ref('test_Stores/' + currentStoreId + '/' + col);
        ref.off();
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
            _internalSetItem('seraj_vaults_v2', incomingStr);
            emitSerajUpdate('vaults_v2', 'cloud');
            if (typeof updateTreasuryUI === 'function' && !window.DB._isSavingVaults) {
                window.DB._isSavingVaults = true;
                try { updateTreasuryUI(); } catch (e) {}
                setTimeout(() => { window.DB._isSavingVaults = false; }, 200);
            }
        }
    });

    // رادار بروفايلات الصوت الثلاثة المستقلة (sales / purchases / inventory) والقاموس والوحدات
    let voiceRef = window.dbCloud.ref('test_Stores/' + currentStoreId + '/voice_studio_v4');
    voiceRef.off();
    voiceRef.on('value', snapshot => {
        if (snapshot.exists() && window.DB && typeof window.DB._getVoiceStorageKey === 'function') {
            let vCfg = snapshot.val();
            if (vCfg.sales && vCfg.sales.settings) _internalSetItem(window.DB._getVoiceStorageKey('settings', 'sales'), JSON.stringify(vCfg.sales.settings));
            if (vCfg.purchases && vCfg.purchases.settings) _internalSetItem(window.DB._getVoiceStorageKey('settings', 'purchases'), JSON.stringify(vCfg.purchases.settings));
            if (vCfg.inventory && vCfg.inventory.settings) _internalSetItem(window.DB._getVoiceStorageKey('settings', 'inventory'), JSON.stringify(vCfg.inventory.settings));
            if (vCfg.units) _internalSetItem(window.DB._getVoiceStorageKey('units'), JSON.stringify(vCfg.units));
            if (vCfg.dictionary) _internalSetItem(window.DB._getVoiceStorageKey('dict'), JSON.stringify(vCfg.dictionary));
            if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
            emitSerajUpdate('voice_config', 'cloud');
        }
    });
}

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
    if (col === 'treasury_moves') {
        let mId = String(data.id || '');
        if (data._isInvoice === true || data._isMergedInvoice === true || mId.endsWith('_vouch') || mId.endsWith('_cash') || mId.endsWith('_inv_sale') || mId.endsWith('_inv_purch')) {
            return;
        }
    }
    if (col === 'smart_notes') {
        data.id = String(data.id);
    }

    let docId = String(data.id);

    let delQueue = safeParseJSON(localStorage.getItem('seraj_delete_queue'), []);
    if (delQueue.some(q => q.col === col && String(q.id) === docId)) return;

    let syncQueue = safeParseJSON(localStorage.getItem('seraj_sync_queue'), []);
    if (syncQueue.some(q => q.col === col && q.data && String(q.data.id) === docId)) return;

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
        if (JSON.stringify(_stripComputedFieldsForDiff(localItem)) === JSON.stringify(_stripComputedFieldsForDiff(data))) return;
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
    let cleanTarget = String(docId).replace(/_/g, '.');
    localCollectionsCache[col] = localCollectionsCache[col].filter(item => {
        let itemId = String(item?.id);
        return itemId !== String(docId) && itemId !== cleanTarget;
    });

    if (renderTimers[col]) clearTimeout(renderTimers[col]);
    renderTimers[col] = setTimeout(() => saveAndRenderLocal(col, localCollectionsCache[col]), 250);
}

function saveAndRenderLocal(col, localArray) {
    if (col.includes('invoices') || col === 'treasury_moves') {
        localArray.sort((a, b) => {
            let timeDiff = window.Utils.getSafeTime(b.timestamp || b.date) - window.Utils.getSafeTime(a.timestamp || a.date);
            if (timeDiff !== 0) return timeDiff;
            return window.Utils.extractSerialNum(b.id) - window.Utils.extractSerialNum(a.id);
        });
    }
    _internalSetItem('seraj_' + col, JSON.stringify(localArray));
    _internalSetItem('seraj_cloud_cache_' + col, JSON.stringify(localArray));

    let isEditingLocked = (typeof isEditingNow !== 'undefined' && Boolean(isEditingNow));

    emitSerajUpdate(col, 'cloud');

    try {
        if (!isEditingLocked) {
            if (col === 'products' && typeof renderInventoryTable === 'function') renderInventoryTable();
            if (col === 'sales_invoices' && typeof renderInvoicesHistory === 'function') renderInvoicesHistory();
            if (col === 'purchase_invoices') {
                if (typeof renderPurchasesHistory === 'function') renderPurchasesHistory();
                else if (typeof renderInvoicesHistory === 'function') renderInvoicesHistory();
            }
        }

        if (col === 'customers') {
            if (typeof renderCustomersList === 'function') renderCustomersList();
            if (typeof currentActiveCustomerId !== 'undefined' && currentActiveCustomerId) {
                try {
                    if (typeof updateAccountSummary === 'function') updateAccountSummary();
                    if (typeof renderAccountTransactions === 'function') renderAccountTransactions();
                    if (typeof renderStatementTable === 'function') renderStatementTable();
                } catch (e) {}
            }
        }

        if (col === 'suppliers') {
            if (typeof renderSuppliersList === 'function') renderSuppliersList();
            if (typeof currentActiveSupplierId !== 'undefined' && currentActiveSupplierId) {
                try {
                    if (typeof openSupplierAccount === 'function') openSupplierAccount(currentActiveSupplierId);
                } catch (e) {}
            }
            if (typeof populateSuppliers === 'function') populateSuppliers();
        }

        if (col === 'smart_notes' && typeof renderNotesList === 'function') renderNotesList();

        if (col === 'treasury_moves' || col === 'sales_invoices' || col === 'purchase_invoices') {
            if (window.DB && typeof window.DB.recalculateVaultBalances === 'function') {
                window.DB.recalculateVaultBalances(true);
            }
            if (col === 'treasury_moves') {
                if (typeof renderMovementsTable === 'function') renderMovementsTable();
                if (typeof updateTreasuryUI === 'function' && !window.DB._isSavingVaults) {
                    window.DB._isSavingVaults = true;
                    try { updateTreasuryUI(); } catch (e) {}
                    setTimeout(() => { window.DB._isSavingVaults = false; }, 200);
                }
            }
        }

        if (typeof calculateCollectedData === 'function') calculateCollectedData();
        if (typeof calculateOverviewStats === 'function') calculateOverviewStats();
        if (typeof runSmartInventory === 'function') {
            try {
                runSmartInventory('shortages');
                runSmartInventory('suppliers');
            } catch (e) {}
        }
    } catch (e) {}
}
// ==================== [ نهاية الجزء الأول 1/3 ] ====================

// ==================== [ بداية الجزء الثاني 2/3 ] ====================
// ---------------------------------------------------------
// 4. DB Master Object (العمود الفقري للعمليات والحسابات المحاسبية الدقيقة)
// ---------------------------------------------------------
window.DB = {
    _isCalculatingBalances: false,
    _hideZeroCustomersByDefault: false,
    _isSavingVaults: false,
    _isSavingSmartNotes: false,
    _isSavingTreasury: false,

    // إعدادات المزامنة الذكية والمرنة للقائمة الرئيسية
    getSyncSettings: function() {
        return getSyncConfigInternal();
    },

    saveSyncSettings: function(newSettings = {}) {
        let current = getSyncConfigInternal();
        let merged = {
            autoSync: newSettings.autoSync !== undefined ? Boolean(newSettings.autoSync) : current.autoSync,
            intervalMs: Math.max(15000, parseInt(newSettings.intervalMs ?? current.intervalMs, 10) || 300000),
            syncOnSaveDelayMs: Math.max(500, parseInt(newSettings.syncOnSaveDelayMs ?? current.syncOnSaveDelayMs, 10) || CALM_SYNC_DELAY_MS)
        };
        _internalSetItem('seraj_sync_settings', JSON.stringify(merged));
        startScheduledSyncTimer();
        emitSerajUpdate('sync_settings', 'local');
        return merged;
    },

    // دالة المزامنة الفورية اليدوية DB.syncNow() حسب الدستور المعماري
    syncNow: function() {
        return new Promise((resolve) => {
            if (_syncTimer) {
                clearTimeout(_syncTimer);
                _syncTimer = null;
            }
            if (!cloudReady || !navigator.onLine || !window.dbCloud) {
                showCloudStatus("⚠️ الجهاز يعمل محلياً (أوفلاين) - سيتم الرفع فور توفر الإنترنت");
                return resolve(false);
            }
            _inFlightSyncKeys.clear();
            processDeleteQueue();
            processSyncQueue();
            showCloudStatus("⚡ جاري تنفيذ المزامنة الفورية مع السحابة...");
            resolve(true);
        });
    },

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
                        let safeArray = (obj) => obj ? Object.values(obj) : [];

                        _internalSetItem('seraj_products', JSON.stringify(safeArray(data.products)));
                        _internalSetItem('seraj_cloud_cache_products', JSON.stringify(safeArray(data.products)));

                        _internalSetItem('seraj_customers', JSON.stringify(safeArray(data.customers)));
                        _internalSetItem('seraj_cloud_cache_customers', JSON.stringify(safeArray(data.customers)));

                        _internalSetItem('seraj_suppliers', JSON.stringify(safeArray(data.suppliers)));
                        _internalSetItem('seraj_cloud_cache_suppliers', JSON.stringify(safeArray(data.suppliers)));

                        _internalSetItem('seraj_sales_invoices', JSON.stringify(safeArray(data.sales_invoices)));
                        _internalSetItem('seraj_cloud_cache_sales_invoices', JSON.stringify(safeArray(data.sales_invoices)));

                        _internalSetItem('seraj_purchase_invoices', JSON.stringify(safeArray(data.purchase_invoices)));
                        _internalSetItem('seraj_cloud_cache_purchase_invoices', JSON.stringify(safeArray(data.purchase_invoices)));

                        let cleanCloudMoves = safeArray(data.treasury_moves).filter(m => {
                            if (!m) return false;
                            let mId = String(m.id || '');
                            return !(m._isInvoice === true || m._isMergedInvoice === true || mId.endsWith('_vouch') || mId.endsWith('_cash') || mId.endsWith('_inv_sale') || mId.endsWith('_inv_purch'));
                        });
                        _internalSetItem('seraj_treasury_moves', JSON.stringify(cleanCloudMoves));
                        _internalSetItem('seraj_cloud_cache_treasury_moves', JSON.stringify(cleanCloudMoves));

                        let cleanCloudNotes = safeArray(data.smart_notes).map(n => n ? ({ ...n, id: String(n.id) }) : null).filter(Boolean);
                        _internalSetItem('seraj_smart_notes', JSON.stringify(cleanCloudNotes));
                        _internalSetItem('seraj_cloud_cache_smart_notes', JSON.stringify(cleanCloudNotes));

                        if (data.vaults_v2) {
                            _internalSetItem('seraj_vaults_v2', JSON.stringify(data.vaults_v2));
                        }

                        _internalSetItem('seraj_sync_queue', '[]');
                        _internalSetItem('seraj_delete_queue', '[]');

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
        _internalSetItem(key, JSON.stringify(data));
        if (syncToCloud && Array.isArray(data)) {
            saveArrayToQueueSafely(cleanCol, data);
        } else {
            emitSerajUpdate(cleanCol, 'local');
        }
    },

// دالة تحديث عنصر مفرد (بنظام كاميرا المراقبة: تعكس الحركة القديمة بالثانية وتسجل الحركة المعدلة كسطر جديد)
updateItem: function(colName, id, updatedItem) {
    if (!updatedItem) return false;
    let cleanCol = colName.replace(/^seraj_/, '');
    let targetId = String(id ?? updatedItem.id);

    if (cleanCol === 'treasury_moves') {
        if (updatedItem._isInvoice === true || updatedItem._isMergedInvoice === true || targetId.endsWith('_vouch') || targetId.endsWith('_cash') || targetId.endsWith('_inv_sale') || targetId.endsWith('_inv_purch')) {
            return false;
        }
        let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        let idx = rawMoves.findIndex(m => m && (String(m.id) === targetId || String(m.rawTreasuryId || '') === targetId) && !m._isReversed);
        let now = Date.now();

        if (idx > -1) {
            let oldMove = rawMoves[idx];
            oldMove._isReversed = true;
            oldMove._lastModified = now;

            let oldAdd = Math.round((parseFloat(oldMove.amountAdd) || 0) * 100) / 100;
            let oldDed = Math.round((parseFloat(oldMove.amountDeduct) || 0) * 100) / 100;
            let oldAmt = Math.round((parseFloat(oldMove.amount) || oldAdd || oldDed || 0) * 100) / 100;
            let revDate = window.Utils.getLocalDateString(now);

            let revMove = {
                id: window.Utils.generateUniqueId('REV_'),
                type: 'correction',
                vault: oldMove.vault || oldMove.treasury || 'main',
                treasury: oldMove.vault || oldMove.treasury || 'main',
                amountAdd: oldDed,
                amountDeduct: oldAdd,
                amount: oldAmt,
                notes: `🔄 عكس لتعديل حركة: ${oldMove.notes || ('رقم ' + oldMove.id)}`,
                date: revDate,
                dateFormatted: new Date(now).toLocaleDateString('en-GB'),
                timestamp: now,
                invoiceNo: oldMove.invoiceNo || null,
                customerId: oldMove.customerId || null,
                customer: oldMove.customer || null,
                supplierId: oldMove.supplierId || null,
                supplier: oldMove.supplier || null,
                _device: myDeviceName,
                _lastModified: now,
                _lastModifiedBy: localStorage.getItem('cashier_name') || myDeviceName,
                _isReversal: true,
                _reversedMoveId: String(oldMove.id)
            };
            rawMoves.unshift(revMove);
        }

        let cleanMove = { ...updatedItem };
        delete cleanMove._isInvoice;
        delete cleanMove._isMergedInvoice;
        delete cleanMove._isReversed;
        cleanMove.rawTreasuryId = targetId;
        cleanMove.id = window.Utils.generateUniqueId('EDT_');
        cleanMove.date = window.Utils.normalizeDateStr(cleanMove.date, now + 1);
        cleanMove.timestamp = now + 1;
        cleanMove.dateFormatted = new Date(now + 1).toLocaleDateString('en-GB');
        cleanMove.notes = cleanMove.notes ? (String(cleanMove.notes).startsWith('✏️') ? cleanMove.notes : `✏️ بعد التعديل: ${cleanMove.notes}`) : '✏️ حركة معدلة';
        cleanMove._lastModified = now + 1;
        cleanMove._lastModifiedBy = localStorage.getItem('cashier_name') || myDeviceName;

        rawMoves.unshift(cleanMove);
        this.saveTreasuryMoves(rawMoves);
        return true;
    }

    let list = this.getCollection(cleanCol, []);
    let idx = list.findIndex(item => item && String(item.id) === targetId);
    updatedItem.id = updatedItem.id ?? id;
    updatedItem._lastModified = Date.now();
    updatedItem._lastModifiedBy = myDeviceName;

    if (idx > -1) {
        list[idx] = updatedItem;
    } else {
        list.push(updatedItem);
    }
    this.saveCollection(cleanCol, list, true);
    if (cleanCol.includes('invoices')) {
        this.recalculateVaultBalances();
    }
    return true;
},

deleteItem: function(colName, id, mode = 'soft') {
    let cleanCol = colName.replace(/^seraj_/, '');
    let list = this.getCollection(cleanCol, []);
    let targetId = String(id);

    if (cleanCol === 'treasury_moves') {
        // نظام كاميرا المراقبة للخزينة: لا نمسح الحركة من الجدول بل نتركها وننزل حركة عكسية بالثانية تلغي أثرها المالي
        let deletedMove = list.find(item => item && (String(item.id) === targetId || String(item.rawTreasuryId || '') === targetId) && !item._isReversed) || null;
        let now = Date.now();

        if (deletedMove && !deletedMove._isReversal) {
            deletedMove._isReversed = true;
            deletedMove._lastModified = now;

            let oldAdd = Math.round((parseFloat(deletedMove.amountAdd) || 0) * 100) / 100;
            let oldDed = Math.round((parseFloat(deletedMove.amountDeduct) || 0) * 100) / 100;
            let oldAmt = Math.round((parseFloat(deletedMove.amount) || oldAdd || oldDed || 0) * 100) / 100;
            let revDate = window.Utils.getLocalDateString(now);

            let revMove = {
                id: window.Utils.generateUniqueId('REV_'),
                type: 'correction',
                vault: deletedMove.vault || deletedMove.treasury || 'main',
                treasury: deletedMove.vault || deletedMove.treasury || 'main',
                amountAdd: oldDed,
                amountDeduct: oldAdd,
                amount: oldAmt,
                notes: `🗑️ عكس لحذف حركة/سند: ${deletedMove.notes || ('رقم ' + deletedMove.id)}`,
                date: revDate,
                dateFormatted: new Date(now).toLocaleDateString('en-GB'),
                timestamp: now,
                invoiceNo: deletedMove.invoiceNo || null,
                customerId: deletedMove.customerId || null,
                customer: deletedMove.customer || null,
                supplierId: deletedMove.supplierId || null,
                supplier: deletedMove.supplier || null,
                _device: myDeviceName,
                _lastModified: now,
                _lastModifiedBy: localStorage.getItem('cashier_name') || myDeviceName,
                _isReversal: true,
                _reversedMoveId: String(deletedMove.id)
            };
            list.unshift(revMove);
            this.saveTreasuryMoves(list);
        }

        // الحذف التبادلي للسندات من معاملات العميل أو المورد لضبط كشف حسابه وفواتيره
        let voucherLinkedIds = new Set([targetId]);
        if (targetId.length > 10) voucherLinkedIds.add(targetId.slice(-6));
        if (deletedMove) {
            voucherLinkedIds.add(String(deletedMove.id));
            if (deletedMove.rawTreasuryId) voucherLinkedIds.add(String(deletedMove.rawTreasuryId));
            if (deletedMove.invoiceNo) voucherLinkedIds.add(String(deletedMove.invoiceNo));
        }

        let rawCustomers = safeParseJSON(localStorage.getItem('seraj_customers'), []);
        let custModified = false;
        rawCustomers.forEach(c => {
            if (c && Array.isArray(c.transactions)) {
                let beforeLen = c.transactions.length;
                c.transactions = c.transactions.filter(t => {
                    if (!t) return false;
                    let tId = String(t.id ?? '');
                    let tRawId = String(t.rawTreasuryId ?? '');
                    let tInvNo = String(t.invoiceNo ?? '');
                    return !voucherLinkedIds.has(tId) && (!tRawId || !voucherLinkedIds.has(tRawId)) && (!tInvNo || !voucherLinkedIds.has(tInvNo));
                });
                if (c.transactions.length !== beforeLen) {
                    c._lastModified = now;
                    custModified = true;
                }
            }
        });
        if (custModified) {
            this.saveCustomers(rawCustomers);
            this.calculateCustomerBalances();
        }

        let rawSuppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
        let suppModified = false;
        rawSuppliers.forEach(s => {
            if (s && Array.isArray(s.transactions)) {
                let beforeLen = s.transactions.length;
                s.transactions = s.transactions.filter(t => {
                    if (!t) return false;
                    let tId = String(t.id ?? '');
                    let tRawId = String(t.rawTreasuryId ?? '');
                    let tInvNo = String(t.invoiceNo ?? '');
                    return !voucherLinkedIds.has(tId) && (!tRawId || !voucherLinkedIds.has(tRawId)) && (!tInvNo || !voucherLinkedIds.has(tInvNo));
                });
                if (s.transactions.length !== beforeLen) {
                    s._lastModified = now;
                    suppModified = true;
                }
            }
        });
        if (suppModified) {
            this.saveSuppliers(rawSuppliers);
            this.calculateSupplierBalances();
        }

        this.recalculateVaultBalances();
        emitSerajUpdate(cleanCol, 'delete');
        return true;
    }

    if (mode === 'hard') {
        let filtered = list.filter(item => item && String(item.id) !== targetId);
        _internalSetItem('seraj_' + cleanCol, JSON.stringify(filtered));
        _internalSetItem('seraj_cloud_cache_' + cleanCol, JSON.stringify(filtered));
        localCollectionsCache[cleanCol] = filtered;
        addToDeleteQueue(cleanCol, targetId);
        emitSerajUpdate(cleanCol, 'delete');
        return true;
    } else {
        let updated = false;
        let canceledInvoiceObj = null;
        list.forEach(item => {
            if (item && String(item.id) === targetId) {
                if (cleanCol.includes('invoices')) {
                    item.isCanceled = true;
                    canceledInvoiceObj = item;
                } else {
                    item.isArchived = true;
                    item.isDeleted = true;
                }
                item._lastModified = Date.now();
                item._lastModifiedBy = myDeviceName;
                updated = true;
            }
        });
        if (updated) {
            this.saveCollection(cleanCol, list, true);
            // إذا أُلغيت فاتورة ولم تكن الشاشة قد سجلت لها حركة عكسية للتو، نسجل حركة مرتجع/إلغاء في كاميرا الخزينة
            if (cleanCol.includes('invoices') && canceledInvoiceObj) {
                let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
                let invIdStr = String(canceledInvoiceObj.id);
                let shortId = invIdStr.length > 5 ? invIdStr.slice(-5) : invIdStr;
                let alreadyLoggedReversal = rawMoves.some(m => m && m.type === 'correction' && (Date.now() - Number(m.timestamp || 0) < 8000) && (String(m.invoiceNo || '') === invIdStr || String(m.invoiceNo || '') === shortId || String(m.notes || '').includes(invIdStr) || String(m.notes || '').includes(shortId)));

                if (!alreadyLoggedReversal) {
                    let isPurch = (cleanCol === 'purchase_invoices');
                    let isReturn = (canceledInvoiceObj.type === 'return' || canceledInvoiceObj.type === 'return_sale' || canceledInvoiceObj.type === 'sales_return' || canceledInvoiceObj.type === 'purchase_return' || canceledInvoiceObj.type === 'return_purchase');
                    let checkoutPaid = (canceledInvoiceObj.initialPaid !== undefined && canceledInvoiceObj.initialPaid !== null && !isNaN(parseFloat(canceledInvoiceObj.initialPaid)))
                        ? Math.max(0, parseFloat(canceledInvoiceObj.initialPaid))
                        : Math.max(0, parseFloat(canceledInvoiceObj.paid) || 0);
                    let addAmt = 0, dedAmt = 0;
                    if (checkoutPaid > 0) {
                        if (isPurch) {
                            addAmt = isReturn ? 0 : checkoutPaid;
                            dedAmt = isReturn ? checkoutPaid : 0;
                        } else {
                            addAmt = isReturn ? checkoutPaid : 0;
                            dedAmt = isReturn ? 0 : checkoutPaid;
                        }
                    }
                    this.recordTreasuryTransaction({
                        type: 'correction',
                        vault: canceledInvoiceObj.vault || canceledInvoiceObj.treasury || canceledInvoiceObj.paymentMethod || 'main',
                        amountAdd: addAmt,
                        amountDeduct: dedAmt,
                        amount: checkoutPaid,
                        invoiceNo: canceledInvoiceObj.id,
                        customerId: canceledInvoiceObj.customerId || null,
                        customer: canceledInvoiceObj.customer || null,
                        supplierId: canceledInvoiceObj.supplierId || null,
                        supplier: canceledInvoiceObj.supplier || null,
                        notes: `🗑️ إلغاء واسترداد ${isPurch ? 'فاتورة مشتريات' : 'فاتورة مبيعات'} رقم #${canceledInvoiceObj.id}`
                    });
                }
                this.recalculateVaultBalances();
            }
        }
        
            return updated;
        }
    },

    // دالة مساعدة لدمج العملاء أو الموردين المكررين وتنظيف المعرفات العشرية (Float IDs)
    _deduplicateEntities: function(list, colName) {
        if (!Array.isArray(list)) return { cleaned: [], idRedirectMap: new Map(), normMap: new Map(), changed: false };
        let normMap = new Map();
        let idRedirectMap = new Map();
        let cleaned = [];
        let changed = false;

        list.forEach(item => {
            if (!item || !item.name) return;

            let origIdStr = String(item.id ?? '');
            let cleanIdStr = window.Utils.sanitizeEntityId(origIdStr);
            if (origIdStr && origIdStr !== cleanIdStr) {
                idRedirectMap.set(origIdStr, cleanIdStr);
                addToDeleteQueue(colName, origIdStr);
                item.id = cleanIdStr;
                changed = true;
            }

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

    // استخراج المبلغ المسدد لفاتورة معينة من قائمة السندات بدقة (تدعم id/invoiceId و deducted/amount)
    _getAppliedVoucherAmountForInvoice: function(inv, validTransactions, isSupplier = false) {
        if (!inv || !Array.isArray(validTransactions)) return 0;
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

            let inAllocated = Array.isArray(t.allocatedInvoices) && t.allocatedInvoices.find(a => a && String(a.id ?? a.invoiceId) === invIdStr);
            if (inAllocated) {
                appliedAmount += parseFloat(inAllocated.deducted ?? inAllocated.amount) || 0;
            } else if (t.notes && exactNoteRegex.test(String(t.notes))) {
                appliedAmount += parseFloat(t.amount) || 0;
            }
        });
        return Math.round(appliedAmount * 100) / 100;
    },

    // استرجاع أي سند موجود في الخزينة وسقط من مصفوفة سندات العميل/المورد قبل الحساب (مع تهذيب المعرف الطويل)
    _collectUnifiedEntityTransactions: function(entity, allMoves, isSupplier = false) {
        let eIdStr = String(entity.id);
        let eNorm = window.Utils.normalizeName(entity.name || '');

        let validTransactions = Array.isArray(entity.transactions)
            ? entity.transactions.filter(t => t && t.type !== 'log' && !t.isCanceled && t.status !== 'deleted' && !t.isDeleted)
            : [];

        let recordedTxIds = new Set();
        validTransactions.forEach(t => {
            t.date = window.Utils.normalizeDateStr(t.date, t.timestamp);
            t.timestamp = window.Utils.alignTimestampWithDate(t.date, t.timestamp);
            if (t.id !== undefined) recordedTxIds.add(String(t.id));
            if (t.rawTreasuryId !== undefined) recordedTxIds.add(String(t.rawTreasuryId));
            if (t.invoiceNo !== undefined) recordedTxIds.add(String(t.invoiceNo));
        });

        allMoves.forEach(m => {
            if (!m || m._isInvoice || m._isMergedInvoice || m._isReversed || m._isReversal || m.type === 'correction' || m.isCanceled || m.isDeleted || m.status === 'deleted') return;
            let mIdStr = String(m.rawTreasuryId || m.id || '');
            let mShortId = mIdStr.length > 10 ? mIdStr.slice(-6) : mIdStr;
            if (recordedTxIds.has(mIdStr) || recordedTxIds.has(mShortId) || (m.invoiceNo && recordedTxIds.has(String(m.invoiceNo)))) return;

            if (isSupplier) {
                if (!['suppliers', 'purchase_payment', 'supplier_receipt', 'payment', 'receipt'].includes(m.type) || (!m.supplierId && !m.supplier && !m.supplierName)) return;
            } else {
                if (!['customers', 'customer_receipt', 'customer_payment', 'receipt', 'payment'].includes(m.type) || (!m.customerId && !m.customer && !m.customerName)) return;
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

                let mDateStr = window.Utils.normalizeDateStr(m.date, m.timestamp);
                let isDuplicate = validTransactions.some(t => {
                    let tDateStr = window.Utils.normalizeDateStr(t.date, t.timestamp);
                    return Math.abs((parseFloat(t.amount) || 0) - amt) < 0.01 && tDateStr === mDateStr;
                });

                if (!isDuplicate) {
                    let cleanNotes = String(m.notes || '').replace(/^سند\s+(?:تحصيل|سحب|دفع|مورد)\s+رقم\s+[^:]+:\s*[^-]+-\s*/, '').trim();
                    let txType = isSupplier
                        ? (ded > 0 || m.type === 'purchase_payment' ? 'payment' : 'receipt')
                        : (add > 0 || m.type === 'customer_receipt' ? 'receipt' : 'payment');
                    let voucherCleanId = m.invoiceNo || mShortId || mIdStr;

                    validTransactions.push({
                        id: voucherCleanId,
                        rawTreasuryId: mIdStr,
                        type: txType,
                        amount: amt,
                        notes: cleanNotes || m.notes || '',
                        treasury: m.vault || m.treasury || 'main',
                        date: mDateStr,
                        timestamp: window.Utils.alignTimestampWithDate(mDateStr, m.timestamp),
                        allocatedInvoices: Array.isArray(m.allocatedInvoices) ? m.allocatedInvoices : [],
                        _device: m._device,
                        _lastModifiedBy: m._lastModifiedBy,
                        _restoredFromTreasury: true
                    });
                    recordedTxIds.add(mIdStr);
                    recordedTxIds.add(String(voucherCleanId));
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
            let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);

            let custDedup = this._deduplicateEntities(rawCustomers, 'customers');
            let customers = custDedup.cleaned;
            if (custDedup.changed) {
                _internalSetItem('seraj_customers', JSON.stringify(customers));
                saveArrayToQueueSafely('customers', customers);
            }

            let suppDedup = this._deduplicateEntities(rawSuppliers, 'suppliers');
            let suppliers = suppDedup.cleaned;
            if (suppDedup.changed) {
                _internalSetItem('seraj_suppliers', JSON.stringify(suppliers));
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
            if (prodChanged) _internalSetItem('seraj_products', JSON.stringify(cleanedProducts));

            // ملاحظة هامة: لا ننسخ inv.paid إلى inv.initialPaid بشكل أعمى هنا حتى لا نضاعف خصم السندات القديمة، بل نترك calculateCustomerBalances تحسبها بعد طرح السندات
            let salesChanged = false;
            sales.forEach(inv => {
                if (!inv) return;
                if ((inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted === true) && !inv.isCanceled) {
                    inv.isCanceled = true;
                    salesChanged = true;
                }
                if (inv.type === 'return_sale' || inv.type === 'sales_return') {
                    inv.type = 'return';
                    salesChanged = true;
                }
                let normDate = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
                if (inv.date !== normDate) {
                    inv.date = normDate;
                    salesChanged = true;
                }
                let alignedTs = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
                if (inv.timestamp !== alignedTs) {
                    inv.timestamp = alignedTs;
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
            if (salesChanged) _internalSetItem('seraj_sales_invoices', JSON.stringify(sales));

            let purchChanged = false;
            purchases.forEach(inv => {
                if (!inv) return;
                if ((inv.type === 'canceled' || inv.status === 'deleted' || inv.isDeleted === true) && !inv.isCanceled) {
                    inv.isCanceled = true;
                    purchChanged = true;
                }
                let normDate = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
                if (inv.date !== normDate) {
                    inv.date = normDate;
                    purchChanged = true;
                }
                let alignedTs = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
                if (inv.timestamp !== alignedTs) {
                    inv.timestamp = alignedTs;
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
            if (purchChanged) _internalSetItem('seraj_purchase_invoices', JSON.stringify(purchases));

            let movesChanged = false;
            let moves = [];
            rawMoves.forEach(m => {
                if (!m) return;
                let mIdStr = String(m.id ?? '');
                if (m._isInvoice === true || m._isMergedInvoice === true || mIdStr.endsWith('_vouch') || mIdStr.endsWith('_cash') || mIdStr.endsWith('_inv_sale') || mIdStr.endsWith('_inv_purch')) {
                    if (mIdStr) addToDeleteQueue('treasury_moves', mIdStr);
                    movesChanged = true;
                    return;
                }
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
                let normDate = window.Utils.normalizeDateStr(m.date, m.timestamp);
                if (m.date !== normDate) {
                    m.date = normDate;
                    movesChanged = true;
                }
                let alignedTs = window.Utils.alignTimestampWithDate(m.date, m.timestamp);
                if (m.timestamp !== alignedTs) {
                    m.timestamp = alignedTs;
                    movesChanged = true;
                }
                let add = parseFloat(m.amountAdd) || 0;
                let ded = parseFloat(m.amountDeduct) || 0;
                let rawAmt = parseFloat(m.amount) || 0;
                if (add === 0 && ded === 0 && rawAmt > 0) {
                    let isOut = (m.direction === 'out' || m.type === 'payment' || m.type === 'purchase' || m.type === 'purchases' || m.type === 'purchase_payment' || m.type === 'expenses' || m.type === 'expense' || m.type === 'return_sale' || m.type === 'sales_return');
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
                moves.push(m);
            });
            if (movesChanged) _internalSetItem('seraj_treasury_moves', JSON.stringify(moves));

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

    // حماية الأصناف المؤرشفة عند استدعاء saveProducts(productsDB) من صفحة store.html
    saveProducts: function(data) {
        if (!Array.isArray(data)) return;
        let existingAll = safeParseJSON(localStorage.getItem('seraj_products'), []);
        let passedIds = new Set();
        let normMap = new Map();
        let cleaned = [];

        data.forEach(p => {
            if (!p) return;
            if (p.id === undefined || p.id === null) {
                p.id = window.Utils.generateUniqueId();
            }
            passedIds.add(String(p.id));

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

        existingAll.forEach(oldP => {
            if (!oldP || oldP.id === undefined) return;
            if ((oldP.isArchived || oldP.isDeleted) && !passedIds.has(String(oldP.id))) {
                oldP.isArchived = true;
                oldP.isDeleted = true;
                cleaned.push(oldP);
            }
        });

        _internalSetItem('seraj_products', JSON.stringify(cleaned));
        if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
        saveArrayToQueueSafely('products', cleaned);
    },

    // استرجاع العملاء مع دعم تمرير خيار إخفاء "عملاء الصفر" سواء كقيمة منطقية boolean أو كائن { hideZero: true/false }
    getCustomers: function(rawOnly = false, hideZeroOption = null) {
        let customers = safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
        if (rawOnly) return customers;
        let calculated = this.calculateCustomerBalances(null, customers);

        let shouldHideZero = false;
        if (typeof hideZeroOption === 'boolean') {
            shouldHideZero = hideZeroOption;
        } else if (hideZeroOption && typeof hideZeroOption === 'object' && 'hideZero' in hideZeroOption) {
            shouldHideZero = Boolean(hideZeroOption.hideZero);
        } else {
            shouldHideZero = Boolean(this._hideZeroCustomersByDefault || window.HIDE_ZERO_CUSTOMERS);
        }

        let result = shouldHideZero ? calculated.filter(c => !c.isZeroCustomer) : calculated;

        try {
            Object.defineProperty(result, 'allWithZero', { value: calculated, enumerable: false, configurable: true });
            Object.defineProperty(result, 'activeOnly', { value: calculated.filter(c => !c.isZeroCustomer), enumerable: false, configurable: true });
            Object.defineProperty(result, 'fastSearch', {
                value: (q) => window.Utils.fastSearch(calculated, q, ['name', 'phone', 'id', 'notes']),
                enumerable: false,
                configurable: true
            });
        } catch (e) {}

        return result;
    },

    searchCustomers: function(query) {
        let allCustomers = this.getCustomers(false, false);
        return window.Utils.fastSearch(allCustomers, query, ['name', 'phone', 'id', 'notes']);
    },

    setHideZeroCustomers: function(hide = true) {
        this._hideZeroCustomersByDefault = Boolean(hide);
        window.HIDE_ZERO_CUSTOMERS = Boolean(hide);
    },

    saveCustomers: function(data) {
        if (!Array.isArray(data)) return;
        let oldRawCustomers = safeParseJSON(localStorage.getItem('seraj_customers'), []);
        let oldNameById = new Map();
        oldRawCustomers.forEach(oc => {
            if (oc && oc.id !== undefined && oc.name) {
                oldNameById.set(String(oc.id), String(oc.name).trim());
            }
        });

        let dedup = this._deduplicateEntities(data, 'customers');

        let renamedMap = new Map();
        dedup.cleaned.forEach(c => {
            if (!c || c.id === undefined || !c.name) return;
            let newName = String(c.name).trim();
            let oldName = oldNameById.get(String(c.id));
            if (oldName && oldName !== newName) {
                renamedMap.set(String(c.id), { oldName, newName });
            }
        });

        if ((dedup.changed && dedup.idRedirectMap.size > 0) || renamedMap.size > 0) {
            let sales = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
            let sChanged = false;
            sales.forEach(inv => {
                if (!inv) return;
                if (inv.customerId && dedup.idRedirectMap.has(String(inv.customerId))) {
                    inv.customerId = dedup.idRedirectMap.get(String(inv.customerId));
                    sChanged = true;
                }
                if (inv.customerId && renamedMap.has(String(inv.customerId))) {
                    let newName = renamedMap.get(String(inv.customerId)).newName;
                    if (inv.customer !== newName) {
                        inv.customer = newName;
                        sChanged = true;
                    }
                }
            });
            if (sChanged) this.saveSalesInvoices(sales);

            let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            let mChanged = false;
            moves.forEach(m => {
                if (!m) return;
                if (m.customerId && dedup.idRedirectMap.has(String(m.customerId))) {
                    m.customerId = dedup.idRedirectMap.get(String(m.customerId));
                    mChanged = true;
                }
                if (m.customerId && renamedMap.has(String(m.customerId))) {
                    let newName = renamedMap.get(String(m.customerId)).newName;
                    if (m.customer !== newName) {
                        m.customer = newName;
                        mChanged = true;
                    }
                } else if (renamedMap.size > 0 && m.customer) {
                    renamedMap.forEach((info, cid) => {
                        if (window.Utils.normalizeName(m.customer) === window.Utils.normalizeName(info.oldName)) {
                            m.customer = info.newName;
                            if (!m.customerId) m.customerId = cid;
                            mChanged = true;
                        }
                    });
                }
            });
            if (mChanged) this.saveTreasuryMoves(moves);
        }

        // الاحتفاظ بأي عميل صفر خامل كان موجوداً في الذاكرة إذا قامت الصفحة بحفظ القائمة المفلترة فقط
        let passedIds = new Set(dedup.cleaned.map(c => String(c?.id)));
        oldRawCustomers.forEach(oldC => {
            if (!oldC || oldC.id === undefined) return;
            let oId = String(oldC.id);
            if (!passedIds.has(oId) && !dedup.idRedirectMap.has(oId)) {
                let normOld = window.Utils.normalizeName(oldC.name);
                if (normOld && !dedup.normMap.has(normOld)) {
                    dedup.cleaned.push(oldC);
                    passedIds.add(oId);
                }
            }
        });

        let dataToSave = dedup.cleaned.map(c => {
            let temp = _stripComputedFieldsForDiff(c);
            if (temp.name) temp.name = String(temp.name).trim();
            if (Array.isArray(temp.transactions)) {
                temp.transactions = temp.transactions.map(t => {
                    if (!t) return null;
                    let normDate = window.Utils.normalizeDateStr(t.date, t.timestamp);
                    return {
                        ...t,
                        date: normDate,
                        timestamp: window.Utils.alignTimestampWithDate(normDate, t.timestamp)
                    };
                }).filter(Boolean);
            }
            temp._lastModified = c._lastModified || Date.now();
            return temp;
        });
        _internalSetItem('seraj_customers', JSON.stringify(dataToSave));
        saveArrayToQueueSafely('customers', dataToSave);
    },

    getSuppliers: function(rawOnly = false, hideZeroOption = null) {
        let suppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
        if (rawOnly) return suppliers;
        let calculated = this.calculateSupplierBalances(null, suppliers);

        let shouldHideZero = false;
        if (typeof hideZeroOption === 'boolean') {
            shouldHideZero = hideZeroOption;
        } else if (hideZeroOption && typeof hideZeroOption === 'object' && 'hideZero' in hideZeroOption) {
            shouldHideZero = Boolean(hideZeroOption.hideZero);
        }

        let result = shouldHideZero ? calculated.filter(s => !s.isZeroBalance) : calculated;

        try {
            Object.defineProperty(result, 'allWithZero', { value: calculated, enumerable: false, configurable: true });
            Object.defineProperty(result, 'activeOnly', { value: calculated.filter(s => !s.isZeroBalance), enumerable: false, configurable: true });
            Object.defineProperty(result, 'fastSearch', {
                value: (q) => window.Utils.fastSearch(calculated, q, ['name', 'phone', 'id', 'notes']),
                enumerable: false,
                configurable: true
            });
        } catch (e) {}

        return result;
    },

    searchSuppliers: function(query) {
        let allSuppliers = this.getSuppliers(false, false);
        return window.Utils.fastSearch(allSuppliers, query, ['name', 'phone', 'id', 'notes']);
    },

    saveSuppliers: function(data) {
        if (!Array.isArray(data)) return;
        let oldRawSuppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
        let oldNameById = new Map();
        oldRawSuppliers.forEach(os => {
            if (os && os.id !== undefined && os.name) {
                oldNameById.set(String(os.id), String(os.name).trim());
            }
        });

        let dedup = this._deduplicateEntities(data, 'suppliers');

        let renamedMap = new Map();
        dedup.cleaned.forEach(s => {
            if (!s || s.id === undefined || !s.name) return;
            let newName = String(s.name).trim();
            let oldName = oldNameById.get(String(s.id));
            if (oldName && oldName !== newName) {
                renamedMap.set(String(s.id), { oldName, newName });
            }
        });

        if ((dedup.changed && dedup.idRedirectMap.size > 0) || renamedMap.size > 0) {
            let purchases = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
            let pChanged = false;
            purchases.forEach(inv => {
                if (!inv) return;
                if (inv.supplierId && dedup.idRedirectMap.has(String(inv.supplierId))) {
                    inv.supplierId = dedup.idRedirectMap.get(String(inv.supplierId));
                    pChanged = true;
                }
                if (inv.supplierId && renamedMap.has(String(inv.supplierId))) {
                    let newName = renamedMap.get(String(inv.supplierId)).newName;
                    if (inv.supplier !== newName) {
                        inv.supplier = newName;
                        pChanged = true;
                    }
                }
            });
            if (pChanged) this.savePurchaseInvoices(purchases);

            let moves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
            let mChanged = false;
            moves.forEach(m => {
                if (!m) return;
                if (m.supplierId && dedup.idRedirectMap.has(String(m.supplierId))) {
                    m.supplierId = dedup.idRedirectMap.get(String(m.supplierId));
                    mChanged = true;
                }
                if (m.supplierId && renamedMap.has(String(m.supplierId))) {
                    let newName = renamedMap.get(String(m.supplierId)).newName;
                    if (m.supplier !== newName) {
                        m.supplier = newName;
                        mChanged = true;
                    }
                } else if (renamedMap.size > 0 && m.supplier) {
                    renamedMap.forEach((info, sid) => {
                        if (window.Utils.normalizeName(m.supplier) === window.Utils.normalizeName(info.oldName)) {
                            m.supplier = info.newName;
                            if (!m.supplierId) m.supplierId = sid;
                            mChanged = true;
                        }
                    });
                }
            });
            if (mChanged) this.saveTreasuryMoves(moves);
        }

        let passedIds = new Set(dedup.cleaned.map(s => String(s?.id)));
        oldRawSuppliers.forEach(oldS => {
            if (!oldS || oldS.id === undefined) return;
            let oId = String(oldS.id);
            if (!passedIds.has(oId) && !dedup.idRedirectMap.has(oId)) {
                let normOld = window.Utils.normalizeName(oldS.name);
                if (normOld && !dedup.normMap.has(normOld)) {
                    dedup.cleaned.push(oldS);
                    passedIds.add(oId);
                }
            }
        });

        let dataToSave = dedup.cleaned.map(s => {
            let temp = _stripComputedFieldsForDiff(s);
            if (temp.name) temp.name = String(temp.name).trim();
            if (Array.isArray(temp.transactions)) {
                temp.transactions = temp.transactions.map(t => {
                    if (!t) return null;
                    let normDate = window.Utils.normalizeDateStr(t.date, t.timestamp);
                    return {
                        ...t,
                        date: normDate,
                        timestamp: window.Utils.alignTimestampWithDate(normDate, t.timestamp)
                    };
                }).filter(Boolean);
            }
            temp._lastModified = s._lastModified || Date.now();
            return temp;
        });
        _internalSetItem('seraj_suppliers', JSON.stringify(dataToSave));
        saveArrayToQueueSafely('suppliers', dataToSave);
    },

    calculateCustomerBalances: function(targetCustomerId = null, preloadedCustomers = null) {
        let customers = preloadedCustomers || safeParseJSON(localStorage.getItem('seraj_customers'), []).filter(c => c && !c.isArchived && !c.isDeleted);
        let invoices = this.getSalesInvoices(true);
        let allMoves = this.getTreasuryMoves(false, true);
        let invoicesNeedSave = false;

        const getDayStartMs = (dateVal, fallbackTs) => {
            let t = window.Utils.getSafeTime(dateVal) || window.Utils.getSafeTime(fallbackTs) || 0;
            if (!t) return 0;
            let d = new Date(t);
            if (isNaN(d.getTime())) return 0;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        };

        const getOrderSeq = (idVal, idx) => {
            let num = window.Utils.extractSerialNum(idVal);
            if (!num) return idx;
            return (num >= 100 && num < 100000000) ? (9000000000000 + num) : num;
        };

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

            let validTransactions = this._collectUnifiedEntityTransactions(c, allMoves, false);
            if (validTransactions.some(t => t._restoredFromTreasury)) {
                c.transactions = validTransactions.map(t => {
                    let cleanT = { ...t };
                    delete cleanT._restoredFromTreasury;
                    return cleanT;
                });
            }

            let cDebit = parseFloat(c.openingBalance) || 0;
            let cCredit = 0;
            let currentBal = parseFloat(c.openingBalance) || 0;
            let openInvoices = [];
            let timelineEvents = [];
            let latestActivityMs = c.lastActivityDate ? window.Utils.getSafeTime(c.lastActivityDate) : 0;

            const applyPaymentReduction = (amount, allocatedList = null) => {
                let rem = parseFloat(amount) || 0;
                if (rem <= 0) return;

                if (Array.isArray(allocatedList) && allocatedList.length > 0) {
                    allocatedList.forEach(alloc => {
                        if (!alloc || rem <= 0) return;
                        let targetInvId = String(alloc.id ?? alloc.invoiceId ?? '');
                        if (!targetInvId) return;
                        let targetEntry = openInvoices.find(oi => String(oi.invRef.id) === targetInvId && oi.currentRem > 0);
                        if (targetEntry) {
                            let allocAmt = parseFloat(alloc.deducted ?? alloc.amount) || rem;
                            let deduct = Math.min(targetEntry.currentRem, allocAmt, rem);
                            targetEntry.currentRem -= deduct;
                            rem -= deduct;
                        }
                    });
                }

                if (rem > 0 && currentBal > 0) {
                    let payCurr = Math.min(currentBal, rem);
                    currentBal -= payCurr;
                    rem -= payCurr;
                }

                if (rem > 0) {
                    for (let i = 0; i < openInvoices.length; i++) {
                        if (rem <= 0) break;
                        let oi = openInvoices[i];
                        if (oi.currentRem > 0) {
                            let deduct = Math.min(oi.currentRem, rem);
                            oi.currentRem -= deduct;
                            rem -= deduct;
                        }
                    }
                }

                if (rem > 0) {
                    currentBal -= rem;
                }
            };

            cInvs.forEach((inv, idx) => {
                inv.calculatedRemaining = 0;
                inv.computedRemaining = 0;
                let dMs = getDayStartMs(inv.date, inv.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({
                    kind: 'invoice',
                    priority: 1,
                    dayMs: dMs,
                    seq: getOrderSeq(inv.id, idx),
                    data: inv
                });
            });

            validTransactions.forEach((t, idx) => {
                let dMs = getDayStartMs(t.date, t.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({
                    kind: 'voucher',
                    priority: 2,
                    dayMs: dMs,
                    seq: getOrderSeq(t.id, idx),
                    data: t
                });
            });

            if (latestActivityMs > 0) {
                c.lastActivityDate = window.Utils.getLocalDateString(latestActivityMs);
            }

            timelineEvents.sort((a, b) => {
                if (a.dayMs !== b.dayMs) return a.dayMs - b.dayMs;
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.seq - b.seq;
            });

            timelineEvents.forEach(ev => {
                if (ev.kind === 'invoice') {
                    let inv = ev.data;
                    let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, validTransactions, false);
                    let paidVal = parseFloat(inv.paid) || 0;

                    // حساب initialPaid بعد طرح السندات المطبقة لمنع خصم السند مرتين
                    if (inv.initialPaid === undefined || inv.initialPaid === null || isNaN(parseFloat(inv.initialPaid))) {
                        inv.initialPaid = Math.max(0, Math.round((paidVal - appliedAmount) * 100) / 100);
                        invoicesNeedSave = true;
                    }
                    let checkoutPaid = Math.max(0, parseFloat(inv.initialPaid) || 0);

                    if (inv.initialRemaining === undefined || inv.initialRemaining === null || isNaN(parseFloat(inv.initialRemaining))) {
                        inv.initialRemaining = parseFloat(inv.remaining) || 0;
                        invoicesNeedSave = true;
                    }

                    let totalVal = parseFloat(inv.total) || 0;
                    let discVal = parseFloat(inv.discount) || 0;
                    let origRemVal = parseFloat(inv.initialRemaining) || 0;

                    let req = (Math.abs((checkoutPaid + origRemVal) - totalVal) < 0.05 && discVal > 0) ? totalVal : (totalVal - discVal);
                    if (req < 0) req = 0;

                    // التصحيح الذاتي لحقل inv.paid في حال حذف أو تعديل سند سابق
                    let expectedTotalPaid = Math.min(req, Math.round((checkoutPaid + appliedAmount) * 100) / 100);
                    if (Math.abs(paidVal - expectedTotalPaid) > 0.001) {
                        inv.paid = expectedTotalPaid;
                        invoicesNeedSave = true;
                    }

                    let isReturn = (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');

                    if (!isReturn) {
                        cDebit += req;
                        cCredit += checkoutPaid;
                        let postCheckoutRem = req - checkoutPaid;
                        if (postCheckoutRem > 0) {
                            let invEntry = { invRef: inv, currentRem: postCheckoutRem };
                            openInvoices.push(invEntry);
                            if (currentBal < 0) {
                                let useCredit = Math.min(-currentBal, invEntry.currentRem);
                                currentBal += useCredit;
                                invEntry.currentRem -= useCredit;
                            }
                        } else {
                            if ((parseFloat(inv.remaining) || 0) !== 0) {
                                inv.remaining = 0;
                                invoicesNeedSave = true;
                            }
                            if (postCheckoutRem < 0) {
                                applyPaymentReduction(Math.abs(postCheckoutRem));
                            }
                        }
                    } else {
                        cCredit += req;
                        cDebit += checkoutPaid;
                        let netReturnCredit = req - checkoutPaid;
                        if (netReturnCredit > 0) {
                            applyPaymentReduction(netReturnCredit);
                        } else if (netReturnCredit < 0) {
                            currentBal += Math.abs(netReturnCredit);
                        }
                    }
                } else {
                    let t = ev.data;
                    let amt = parseFloat(t.amount) || 0;
                    if (amt <= 0) return;

                    if (t.type === 'payment') {
                        cDebit += amt;
                        currentBal += amt;
                    } else if (t.type === 'receipt') {
                        cCredit += amt;
                        applyPaymentReduction(amt, t.allocatedInvoices);
                    }
                }
            });

            let netDebt = Math.round((cDebit - cCredit) * 100) / 100;

            let actualDeferred = 0;
            openInvoices.forEach(oi => {
                let roundedRem = Math.round(oi.currentRem * 100) / 100;
                oi.invRef.calculatedRemaining = roundedRem;
                oi.invRef.computedRemaining = roundedRem;

                let oldRem = parseFloat(oi.invRef.remaining) || 0;
                if (Math.abs(oldRem - roundedRem) > 0.001) {
                    oi.invRef.remaining = roundedRem;
                    invoicesNeedSave = true;
                }

                actualDeferred += roundedRem;
            });

            actualDeferred = Math.round(actualDeferred * 100) / 100;
            currentBal = Math.round((netDebt - actualDeferred) * 100) / 100;

            c.balance = -netDebt;
            c.calculatedBalance = -netDebt;
            c.netBalanceVal = Math.abs(netDebt);
            c.isNetDebt = netDebt > 0;
            c.deferredInvoicesTotal = actualDeferred;
            c.displayCurrentBalance = Math.abs(currentBal);
            c.isCurrentBalDebt = currentBal > 0;
            // دعم جميع مسميات فلترة عملاء الصفر
            let isZero = (Math.abs(netDebt) < 0.01 && actualDeferred < 0.01);
            c.isZeroCustomer = isZero;
            c.isZeroBalance = isZero;
            c.isZeroIdle = isZero;
            c.isIdleZero = isZero;
        });

        if (invoicesNeedSave && typeof this.saveSalesInvoices === 'function') {
            this._isCalculatingBalances = true;
            try {
                this.saveSalesInvoices(invoices);
            } finally {
                this._isCalculatingBalances = false;
            }
        }

        if (targetCustomerId !== null && targetCustomerId !== undefined) {
            return customers.find(c => String(c.id) === String(targetCustomerId)) || null;
        }
        return customers;
    },

    calculateSupplierBalances: function(targetSupplierId = null, preloadedSuppliers = null) {
        let suppliers = preloadedSuppliers || safeParseJSON(localStorage.getItem('seraj_suppliers'), []).filter(s => s && !s.isArchived && !s.isDeleted);
        let invoices = this.getPurchaseInvoices(true);
        let allMoves = this.getTreasuryMoves(false, true);
        let invoicesNeedSave = false;

        const getDayStartMs = (dateVal, fallbackTs) => {
            let t = window.Utils.getSafeTime(dateVal) || window.Utils.getSafeTime(fallbackTs) || 0;
            if (!t) return 0;
            let d = new Date(t);
            if (isNaN(d.getTime())) return 0;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        };

        const getOrderSeq = (idVal, idx) => {
            let num = window.Utils.extractSerialNum(idVal);
            if (!num) return idx;
            return (num >= 100 && num < 100000000) ? (9000000000000 + num) : num;
        };

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

            let sTotalReq = parseFloat(s.openingBalance) || 0;
            let sTotalPaid = 0;
            let currentBal = parseFloat(s.openingBalance) || 0;
            let openInvoices = [];
            let timelineEvents = [];
            let latestActivityMs = s.lastActivityDate ? window.Utils.getSafeTime(s.lastActivityDate) : 0;

            const applySupplierPaymentReduction = (amount, allocatedList = null) => {
                let rem = parseFloat(amount) || 0;
                if (rem <= 0) return;

                if (Array.isArray(allocatedList) && allocatedList.length > 0) {
                    allocatedList.forEach(alloc => {
                        if (!alloc || rem <= 0) return;
                        let targetInvId = String(alloc.id ?? alloc.invoiceId ?? '');
                        if (!targetInvId) return;
                        let targetEntry = openInvoices.find(oi => String(oi.invRef.id) === targetInvId && oi.currentRem > 0);
                        if (targetEntry) {
                            let allocAmt = parseFloat(alloc.deducted ?? alloc.amount) || rem;
                            let deduct = Math.min(targetEntry.currentRem, allocAmt, rem);
                            targetEntry.currentRem -= deduct;
                            rem -= deduct;
                        }
                    });
                }

                if (rem > 0 && currentBal > 0) {
                    let payCurr = Math.min(currentBal, rem);
                    currentBal -= payCurr;
                    rem -= payCurr;
                }

                if (rem > 0) {
                    for (let i = 0; i < openInvoices.length; i++) {
                        if (rem <= 0) break;
                        let oi = openInvoices[i];
                        if (oi.currentRem > 0) {
                            let deduct = Math.min(oi.currentRem, rem);
                            oi.currentRem -= deduct;
                            rem -= deduct;
                        }
                    }
                }

                if (rem > 0) {
                    currentBal -= rem;
                }
            };

            sInvs.forEach((inv, idx) => {
                inv.calculatedRemaining = 0;
                inv.computedRemaining = 0;
                let dMs = getDayStartMs(inv.date, inv.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({
                    kind: 'invoice',
                    priority: 1,
                    dayMs: dMs,
                    seq: getOrderSeq(inv.id, idx),
                    data: inv
                });
            });

            validTransactions.forEach((t, idx) => {
                let dMs = getDayStartMs(t.date, t.timestamp);
                if (dMs > latestActivityMs) latestActivityMs = dMs;
                timelineEvents.push({
                    kind: 'voucher',
                    priority: 2,
                    dayMs: dMs,
                    seq: getOrderSeq(t.id, idx),
                    data: t
                });
            });

            if (latestActivityMs > 0) {
                s.lastActivityDate = window.Utils.getLocalDateString(latestActivityMs);
            }

            timelineEvents.sort((a, b) => {
                if (a.dayMs !== b.dayMs) return a.dayMs - b.dayMs;
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.seq - b.seq;
            });

            timelineEvents.forEach(ev => {
                if (ev.kind === 'invoice') {
                    let inv = ev.data;
                    let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, validTransactions, true);
                    let paidVal = parseFloat(inv.paid) || 0;

                    if (inv.initialPaid === undefined || inv.initialPaid === null || isNaN(parseFloat(inv.initialPaid))) {
                        inv.initialPaid = Math.max(0, Math.round((paidVal - appliedAmount) * 100) / 100);
                        invoicesNeedSave = true;
                    }
                    let checkoutPaid = Math.max(0, parseFloat(inv.initialPaid) || 0);

                    if (inv.initialRemaining === undefined || inv.initialRemaining === null || isNaN(parseFloat(inv.initialRemaining))) {
                        inv.initialRemaining = parseFloat(inv.remaining) || 0;
                        invoicesNeedSave = true;
                    }

                    let totalVal = parseFloat(inv.total) || 0;
                    let discVal = parseFloat(inv.discount) || 0;
                    let origRemVal = parseFloat(inv.initialRemaining) || 0;

                    let req = (Math.abs((checkoutPaid + origRemVal) - totalVal) < 0.05 && discVal > 0) ? totalVal : (totalVal - discVal);
                    if (req < 0) req = 0;

                    // التصحيح الذاتي لحقل inv.paid للمشتريات
                    let expectedTotalPaid = Math.min(req, Math.round((checkoutPaid + appliedAmount) * 100) / 100);
                    if (Math.abs(paidVal - expectedTotalPaid) > 0.001) {
                        inv.paid = expectedTotalPaid;
                        invoicesNeedSave = true;
                    }

                    let isReturn = (inv.type === 'return' || inv.type === 'purchase_return' || inv.type === 'return_purchase');

                    if (!isReturn) {
                        sTotalReq += req;
                        sTotalPaid += checkoutPaid;
                        let postCheckoutRem = req - checkoutPaid;
                        if (postCheckoutRem > 0) {
                            let invEntry = { invRef: inv, currentRem: postCheckoutRem };
                            openInvoices.push(invEntry);
                            if (currentBal < 0) {
                                let useCredit = Math.min(-currentBal, invEntry.currentRem);
                                currentBal += useCredit;
                                invEntry.currentRem -= useCredit;
                            }
                        } else {
                            if ((parseFloat(inv.remaining) || 0) !== 0) {
                                inv.remaining = 0;
                                invoicesNeedSave = true;
                            }
                            if (postCheckoutRem < 0) {
                                applySupplierPaymentReduction(Math.abs(postCheckoutRem));
                            }
                        }
                    } else {
                        sTotalReq -= req;
                        sTotalPaid -= checkoutPaid;
                        let netReturnReduction = req - checkoutPaid;
                        if (netReturnReduction > 0) {
                            applySupplierPaymentReduction(netReturnReduction);
                        } else if (netReturnReduction < 0) {
                            currentBal += Math.abs(netReturnReduction);
                        }
                    }
                } else {
                    let t = ev.data;
                    let amt = parseFloat(t.amount) || 0;
                    if (amt <= 0) return;

                    if (t.type === 'receipt' || t.type === 'supplier_receipt') {
                        sTotalReq += amt;
                        currentBal += amt;
                    } else if (t.type === 'payment' || t.type === 'purchase_payment') {
                        sTotalPaid += amt;
                        applySupplierPaymentReduction(amt, t.allocatedInvoices);
                    }
                }
            });

            let netDebt = Math.round((sTotalReq - sTotalPaid) * 100) / 100;

            let actualDeferred = 0;
            openInvoices.forEach(oi => {
                let roundedRem = Math.round(oi.currentRem * 100) / 100;
                oi.invRef.calculatedRemaining = roundedRem;
                oi.invRef.computedRemaining = roundedRem;

                let oldRem = parseFloat(oi.invRef.remaining) || 0;
                if (Math.abs(oldRem - roundedRem) > 0.001) {
                    oi.invRef.remaining = roundedRem;
                    invoicesNeedSave = true;
                }

                actualDeferred += roundedRem;
            });

            actualDeferred = Math.round(actualDeferred * 100) / 100;
            currentBal = Math.round((netDebt - actualDeferred) * 100) / 100;

            s.balance = -netDebt;
            s.calculatedBalance = -netDebt;
            s.netBalanceVal = Math.abs(netDebt);
            s.isNetDebt = netDebt > 0;
            s.deferredInvoicesTotal = actualDeferred;
            s.displayCurrentBalance = Math.abs(currentBal);
            s.isCurrentBalDebt = currentBal > 0;
            let isZero = (Math.abs(netDebt) < 0.01 && actualDeferred < 0.01);
            s.isZeroCustomer = isZero;
            s.isZeroBalance = isZero;
            s.isZeroIdle = isZero;
            s.isIdleZero = isZero;
        });

        if (invoicesNeedSave && typeof this.savePurchaseInvoices === 'function') {
            this._isCalculatingBalances = true;
            try {
                this.savePurchaseInvoices(invoices);
            } finally {
                this._isCalculatingBalances = false;
            }
        }

        if (targetSupplierId !== null && targetSupplierId !== undefined) {
            return suppliers.find(s => String(s.id) === String(targetSupplierId)) || null;
        }
        return suppliers;
    },

    // 🌟 المحرك المركزي لبناء كشف الحساب الموحد للعميل أو المورد (مع حماية خصم الفاتورة من الطرح المزدوج) 🌟
    _buildUnifiedStatement: function(entityId, isSupplier = false, duration = 'allTime', customStartDate = null, customEndDate = null) {
        let entity = isSupplier
            ? this.calculateSupplierBalances(entityId)
            : this.calculateCustomerBalances(entityId);
        if (!entity) return null;

        let allInvoices = isSupplier ? this.getPurchaseInvoices(true) : this.getSalesInvoices(true);
        let allMoves = this.getTreasuryMoves(false, true);
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

        let openingDebt = parseFloat(entity.openingBalance) || 0;
        if (openingDebt !== 0) {
            allItems.push({
                date: window.Utils.normalizeDateStr(entity.createdAt || '2020-01-01'),
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
            let appliedAmount = this._getAppliedVoucherAmountForInvoice(inv, vouchers, isSupplier);
            let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null && !isNaN(parseFloat(inv.initialPaid)))
                ? Math.max(0, parseFloat(inv.initialPaid))
                : Math.max(0, invPaid - appliedAmount);
            let origRem = (inv.initialRemaining !== undefined && inv.initialRemaining !== null && !isNaN(parseFloat(inv.initialRemaining)))
                ? parseFloat(inv.initialRemaining)
                : (parseFloat(inv.remaining) || 0);

            let isDiscountAlreadySubtracted = (Math.abs((checkoutPaid + origRem) - invTot) < 0.05) || (Math.abs((invPaid + (parseFloat(inv.remaining) || 0)) - invTot) < 0.05);
            let finalReq = (isDiscountAlreadySubtracted && invDiscount > 0) ? invTot : (invTot - invDiscount);
            if (finalReq < 0) finalReq = 0;

            let isReturn = isSupplier
                ? (inv.type === 'return' || inv.type === 'return_purchase' || inv.type === 'purchase_return')
                : (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');

            let invoiceTypeLabel = isSupplier
                ? (isReturn ? '<span style="color:#ff1a40; font-weight:bold;">فاتورة مرتجع مشتريات</span>' : 'فاتورة مشتريات')
                : (isReturn ? '<span style="color:#ff1a40; font-weight:bold;">فاتورة مرتجع بيع</span>' : 'فاتورة بيع');

            let normInvDate = window.Utils.normalizeDateStr(inv.date, inv.timestamp);

            if (isReturn) {
                allItems.push({ date: normInvDate, title: `${invoiceTypeLabel} رقم: ${inv.id}`, leh: finalReq, aleih: 0, id: inv.id, notes: inv.notes || '---' });
            } else {
                allItems.push({ date: normInvDate, title: `${invoiceTypeLabel} رقم: ${inv.id}`, leh: 0, aleih: finalReq, id: inv.id, notes: inv.notes || '---' });
            }

            if (checkoutPaid > 0) {
                let receiptLabel = isSupplier
                    ? (isReturn ? 'استرداد نقدي أثناء المرتجع' : 'سداد نقدي أثناء الشراء')
                    : (isReturn ? 'رد نقدي أثناء المرتجع' : 'تحصيل نقدي أثناء البيع');
                allItems.push({
                    date: normInvDate,
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
                date: window.Utils.normalizeDateStr(t.date, t.timestamp),
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
            let itemDate = new Date(window.Utils.getSafeTime(item.date) || item.date);
            let includeInCurrent = false;

            if (duration === 'allTime') {
                includeInCurrent = true;
            } else if (duration === 'custom' && customStartDate && customEndDate) {
                let itemTime = itemDate.getTime();
                let startTime = window.Utils.getSafeTime(customStartDate) - 43200000;
                let endTime = window.Utils.getSafeTime(customEndDate) + 43200000;
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
                let d = new Date(now); d.setDate(now.getDate() - 7); d.setHours(0, 0, 0, 0);
                if (itemDate >= d) includeInCurrent = true;
                else { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === 'thisMonth') {
                let startM = new Date(now.getFullYear(), now.getMonth(), 1);
                if (itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()) includeInCurrent = true;
                else if (itemDate < startM) { prevLeh += item.leh; prevAleih += item.aleih; }
            } else if (duration === '30days') {
                let d = new Date(now); d.setDate(now.getDate() - 30); d.setHours(0, 0, 0, 0);
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
            return window.Utils.extractSerialNum(a.id) - window.Utils.extractSerialNum(b.id);
        });

        let totalLeh = 0, totalAleih = 0;
        combined.forEach(item => {
            totalLeh += item.leh;
            totalAleih += item.aleih;
        });

        let netDebt = -(entity.balance || 0);
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
// ==================== [ نهاية الجزء الثاني 2/3 ] ====================



// ==================== [ بداية الجزء الثالث 3/3 ] ====================

getSalesInvoices: function(includeCanceled = true) {
    let invs = safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []);
    let normalized = invs.map(inv => {
        if (!inv) return null;
        inv.date = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
        inv.timestamp = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
        if (inv.type === 'return_sale' || inv.type === 'sales_return') {
            inv.type = 'return';
        }
        let remVal = inv.calculatedRemaining !== undefined ? parseFloat(inv.calculatedRemaining) : (parseFloat(inv.remaining) || 0);
        inv.computedRemaining = isNaN(remVal) ? 0 : Math.round(remVal * 100) / 100;
        return inv;
    }).filter(Boolean);

    return includeCanceled ? normalized : normalized.filter(inv => !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
},

saveSalesInvoices: function(data) {
    if (!Array.isArray(data)) return;
    let oldCache = safeParseJSON(localStorage.getItem('seraj_cloud_cache_sales_invoices'), []);
    let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));
    let rawCustomers = safeParseJSON(localStorage.getItem('seraj_customers'), []);
    let allMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
    let now = Date.now();
    let newlyCreatedInvoices = [];

    let cleanData = data.map(inv => {
        if (!inv) return null;
        try {
            let cleanInv = JSON.parse(JSON.stringify(inv));
            cleanInv.date = window.Utils.normalizeDateStr(cleanInv.date, cleanInv.timestamp);
            cleanInv.timestamp = window.Utils.alignTimestampWithDate(cleanInv.date, cleanInv.timestamp || now);

            if (cleanInv.type === 'canceled' || cleanInv.status === 'deleted' || cleanInv.isDeleted) {
                cleanInv.isCanceled = true;
            }
            if (cleanInv.type === 'return_sale' || cleanInv.type === 'sales_return') {
                cleanInv.type = 'return';
            }
            if (cleanInv.customer) cleanInv.customer = String(cleanInv.customer).trim();

            let oldInv = oldMap.get(String(cleanInv.id));

            if (!oldInv) {
                if (cleanInv.initialPaid === undefined || cleanInv.initialPaid === null || isNaN(parseFloat(cleanInv.initialPaid))) {
                    cleanInv.initialPaid = parseFloat(cleanInv.paid) || 0;
                }
                if (cleanInv.initialRemaining === undefined || cleanInv.initialRemaining === null || isNaN(parseFloat(cleanInv.initialRemaining))) {
                    cleanInv.initialRemaining = parseFloat(cleanInv.remaining) || 0;
                }
                if (!cleanInv.isCanceled && cleanInv.type !== 'quotation') {
                    newlyCreatedInvoices.push(cleanInv);
                }
            } else if (!this._isCalculatingBalances) {
                let oldPaid = parseFloat(oldInv.paid) || 0;
                let newPaid = parseFloat(cleanInv.paid) || 0;
                let oldTotal = parseFloat(oldInv.total) || 0;
                let newTotal = parseFloat(cleanInv.total) || 0;
                let wasEditedInHistory = (cleanInv.initialPaid === undefined || Math.abs(newTotal - oldTotal) > 0.001 || (Math.abs(newPaid - oldPaid) > 0.001 && typeof confirmFinalEdit === 'function'));

                if (wasEditedInHistory) {
                    let appliedVouchers = 0;
                    let cNorm = window.Utils.normalizeName(cleanInv.customer || cleanInv.customerName || '');
                    let matchedCust = rawCustomers.find(c => c && (String(c.id) === String(cleanInv.customerId) || (cNorm && window.Utils.normalizeName(c.name) === cNorm)));
                    if (matchedCust) {
                        let validTxs = this._collectUnifiedEntityTransactions(matchedCust, allMoves, false);
                        appliedVouchers = this._getAppliedVoucherAmountForInvoice(cleanInv, validTxs, false);
                    }
                    cleanInv.initialPaid = Math.max(0, Math.round((newPaid - appliedVouchers) * 100) / 100);
                    let disc = parseFloat(cleanInv.discount) || 0;
                    let remNow = parseFloat(cleanInv.remaining) || 0;
                    let netReq = (Math.abs((newPaid + remNow) - newTotal) < 0.05 && disc > 0) ? newTotal : Math.max(0, newTotal - disc);
                    cleanInv.initialRemaining = Math.max(0, Math.round((netReq - cleanInv.initialPaid) * 100) / 100);
                } else {
                    if (cleanInv.initialPaid === undefined && oldInv.initialPaid !== undefined) cleanInv.initialPaid = oldInv.initialPaid;
                    if (cleanInv.initialRemaining === undefined && oldInv.initialRemaining !== undefined) cleanInv.initialRemaining = oldInv.initialRemaining;
                }
            }

            let remVal = cleanInv.calculatedRemaining !== undefined ? parseFloat(cleanInv.calculatedRemaining) : (parseFloat(cleanInv.remaining) || 0);
            cleanInv.computedRemaining = isNaN(remVal) ? 0 : Math.round(remVal * 100) / 100;

            if (!oldInv || JSON.stringify(_stripComputedFieldsForDiff(oldInv)) !== JSON.stringify(_stripComputedFieldsForDiff(cleanInv))) {
                cleanInv._lastModified = now;
            } else if (oldInv._lastModified) {
                cleanInv._lastModified = oldInv._lastModified;
            }
            return cleanInv;
        } catch (err) {
            console.error("Sales JSON Clean Error:", err);
            return inv;
        }
    }).filter(Boolean);

    _internalSetItem('seraj_sales_invoices', JSON.stringify(cleanData));
    saveArrayToQueueSafely('sales_invoices', cleanData);

    // نظام كاميرا الخزينة: تسجيل أي فاتورة بيع جديدة (حتى لو آجلة بصفر) في الخزينة إذا لم تكن الشاشة قد سجلتها
// نظام كاميرا الخزينة: تسجيل أي فاتورة بيع جديدة بعد 120ms لإعطاء الأولوية لحركة الشاشة ومنع التكرار
if (!this._isCalculatingBalances && newlyCreatedInvoices.length > 0) {
    setTimeout(() => {
        let currentMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        newlyCreatedInvoices.forEach(newInv => {
            if (!this._hasTreasuryMoveForInvoice(newInv, currentMoves)) {
                let isReturn = (newInv.type === 'return' || newInv.type === 'return_sale' || newInv.type === 'sales_return');
                let paidAmt = Math.max(0, parseFloat(newInv.initialPaid ?? newInv.paid) || 0);
                let totalAmt = parseFloat(newInv.total) || 0;
                this.recordTreasuryTransaction({
                    type: isReturn ? 'return_sale' : 'sales',
                    vault: newInv.vault || newInv.treasury || newInv.paymentMethod || 'main',
                    amountAdd: isReturn ? 0 : paidAmt,
                    amountDeduct: isReturn ? paidAmt : 0,
                    amount: paidAmt,
                    date: newInv.date,
                    timestamp: newInv.timestamp || Date.now(),
                    invoiceNo: newInv.id,
                    customerId: newInv.customerId || null,
                    customer: newInv.customer || null,
                    notes: `${isReturn ? 'فاتورة مرتجع بيع' : (paidAmt === 0 ? 'فاتورة مبيعات آجلة (مسدد 0)' : 'فاتورة مبيعات')} رقم #${newInv.id}${newInv.customer ? ' - ' + newInv.customer : ''} (إجمالي: ${totalAmt})`
                });
            }
        });
    }, 120);
}

    if (!this._isCalculatingBalances) {
        this.recalculateVaultBalances();
    }
},

getPurchaseInvoices: function(includeCanceled = true) {
    let invs = safeParseJSON(localStorage.getItem('seraj_purchase_invoices'), []);
    let normalized = invs.map(inv => {
        if (!inv) return null;
        inv.date = window.Utils.normalizeDateStr(inv.date, inv.timestamp);
        inv.timestamp = window.Utils.alignTimestampWithDate(inv.date, inv.timestamp);
        if (inv.type === 'purchase_return' || inv.type === 'return_purchase') {
            inv.type = 'return';
        }
        let remVal = inv.calculatedRemaining !== undefined ? parseFloat(inv.calculatedRemaining) : (parseFloat(inv.remaining) || 0);
        inv.computedRemaining = isNaN(remVal) ? 0 : Math.round(remVal * 100) / 100;
        return inv;
    }).filter(Boolean);

    return includeCanceled ? normalized : normalized.filter(inv => !inv.isCanceled && inv.type !== 'canceled' && !inv.isDeleted && inv.status !== 'deleted');
},

savePurchaseInvoices: function(data, newInvoiceItems = null) {
    if (!Array.isArray(data)) return;
    let oldCache = safeParseJSON(localStorage.getItem('seraj_cloud_cache_purchase_invoices'), []);
    let oldMap = new Map(oldCache.map(i => [String(i?.id), i]));
    let rawSuppliers = safeParseJSON(localStorage.getItem('seraj_suppliers'), []);
    let allMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
    let now = Date.now();
    let autoDetectedNewItems = [];
    let newlyCreatedInvoices = [];

    let cleanData = data.map(inv => {
        if (!inv) return null;
        try {
            let cleanInv = JSON.parse(JSON.stringify(inv));
            cleanInv.date = window.Utils.normalizeDateStr(cleanInv.date, cleanInv.timestamp);
            cleanInv.timestamp = window.Utils.alignTimestampWithDate(cleanInv.date, cleanInv.timestamp || now);

            if (cleanInv.type === 'canceled' || cleanInv.status === 'deleted' || cleanInv.isDeleted) {
                cleanInv.isCanceled = true;
            }
            if (cleanInv.type === 'purchase_return' || cleanInv.type === 'return_purchase') {
                cleanInv.type = 'return';
            }
            if (cleanInv.supplier) cleanInv.supplier = String(cleanInv.supplier).trim();

            let oldInv = oldMap.get(String(cleanInv.id));

            if (!oldInv && !cleanInv.isCanceled && cleanInv.type !== 'return' && Array.isArray(cleanInv.items)) {
                autoDetectedNewItems.push(...cleanInv.items);
            }

            if (!oldInv) {
                if (cleanInv.initialPaid === undefined || cleanInv.initialPaid === null || isNaN(parseFloat(cleanInv.initialPaid))) {
                    cleanInv.initialPaid = parseFloat(cleanInv.paid) || 0;
                }
                if (cleanInv.initialRemaining === undefined || cleanInv.initialRemaining === null || isNaN(parseFloat(cleanInv.initialRemaining))) {
                    cleanInv.initialRemaining = parseFloat(cleanInv.remaining) || 0;
                }
                if (!cleanInv.isCanceled && cleanInv.type !== 'quotation') {
                    newlyCreatedInvoices.push(cleanInv);
                }
            } else if (!this._isCalculatingBalances) {
                let oldPaid = parseFloat(oldInv.paid) || 0;
                let newPaid = parseFloat(cleanInv.paid) || 0;
                let oldTotal = parseFloat(oldInv.total) || 0;
                let newTotal = parseFloat(cleanInv.total) || 0;
                let wasEditedInHistory = (cleanInv.initialPaid === undefined || Math.abs(newTotal - oldTotal) > 0.001 || (Math.abs(newPaid - oldPaid) > 0.001 && typeof confirmFinalEdit === 'function'));

                if (wasEditedInHistory) {
                    let appliedVouchers = 0;
                    let sNorm = window.Utils.normalizeName(cleanInv.supplier || cleanInv.supplierName || '');
                    let matchedSupp = rawSuppliers.find(s => s && (String(s.id) === String(cleanInv.supplierId) || (sNorm && window.Utils.normalizeName(s.name) === sNorm)));
                    if (matchedSupp) {
                        let validTxs = this._collectUnifiedEntityTransactions(matchedSupp, allMoves, true);
                        appliedVouchers = this._getAppliedVoucherAmountForInvoice(cleanInv, validTxs, true);
                    }
                    cleanInv.initialPaid = Math.max(0, Math.round((newPaid - appliedVouchers) * 100) / 100);
                    let disc = parseFloat(cleanInv.discount) || 0;
                    let remNow = parseFloat(cleanInv.remaining) || 0;
                    let netReq = (Math.abs((newPaid + remNow) - newTotal) < 0.05 && disc > 0) ? newTotal : Math.max(0, newTotal - disc);
                    cleanInv.initialRemaining = Math.max(0, Math.round((netReq - cleanInv.initialPaid) * 100) / 100);
                } else {
                    if (cleanInv.initialPaid === undefined && oldInv.initialPaid !== undefined) cleanInv.initialPaid = oldInv.initialPaid;
                    if (cleanInv.initialRemaining === undefined && oldInv.initialRemaining !== undefined) cleanInv.initialRemaining = oldInv.initialRemaining;
                }
            }

            let remVal = cleanInv.calculatedRemaining !== undefined ? parseFloat(cleanInv.calculatedRemaining) : (parseFloat(cleanInv.remaining) || 0);
            cleanInv.computedRemaining = isNaN(remVal) ? 0 : Math.round(remVal * 100) / 100;

            if (!oldInv || JSON.stringify(_stripComputedFieldsForDiff(oldInv)) !== JSON.stringify(_stripComputedFieldsForDiff(cleanInv))) {
                cleanInv._lastModified = now;
            } else if (oldInv._lastModified) {
                cleanInv._lastModified = oldInv._lastModified;
            }
            return cleanInv;
        } catch (err) {
            console.error("Purchase JSON Clean Error:", err);
            return inv;
        }
    }).filter(Boolean);

    _internalSetItem('seraj_purchase_invoices', JSON.stringify(cleanData));
    saveArrayToQueueSafely('purchase_invoices', cleanData);

// نظام كاميرا الخزينة: تسجيل أي فاتورة شراء جديدة بعد 120ms لإعطاء الأولوية لحركة الشاشة ومنع التكرار
if (!this._isCalculatingBalances && newlyCreatedInvoices.length > 0) {
    setTimeout(() => {
        let currentMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);
        newlyCreatedInvoices.forEach(newInv => {
            if (!this._hasTreasuryMoveForInvoice(newInv, currentMoves)) {
                let isReturn = (newInv.type === 'return' || newInv.type === 'return_purchase' || newInv.type === 'purchase_return');
                let paidAmt = Math.max(0, parseFloat(newInv.initialPaid ?? newInv.paid) || 0);
                let totalAmt = parseFloat(newInv.total) || 0;
                this.recordTreasuryTransaction({
                    type: isReturn ? 'return_purchase' : 'purchase',
                    vault: newInv.vault || newInv.treasury || newInv.paymentMethod || 'main',
                    amountAdd: isReturn ? paidAmt : 0,
                    amountDeduct: isReturn ? 0 : paidAmt,
                    amount: paidAmt,
                    date: newInv.date,
                    timestamp: newInv.timestamp || Date.now(),
                    invoiceNo: newInv.id,
                    supplierId: newInv.supplierId || null,
                    supplier: newInv.supplier || null,
                    notes: `${isReturn ? 'فاتورة مرتجع مشتريات' : (paidAmt === 0 ? 'فاتورة مشتريات آجلة (مسدد 0)' : 'فاتورة مشتريات')} رقم #${newInv.id}${newInv.supplier ? ' - ' + newInv.supplier : ''} (إجمالي: ${totalAmt})`
                });
            }
        });
    }, 120);
}

    if (!this._isCalculatingBalances) {
        this.recalculateVaultBalances();
    }

    let itemsToClean = (Array.isArray(newInvoiceItems) && newInvoiceItems.length > 0) ? newInvoiceItems : autoDetectedNewItems;
    if (itemsToClean.length > 0) {
        this.cleanSmartNotesAfterPurchase(itemsToClean);
    }
},

cleanSmartNotesAfterPurchase: function(newInvoiceItems) {
    if (!newInvoiceItems || newInvoiceItems.length === 0) return;

    let smartNotesDB = this.getSmartNotes();
    let isModified = false;
    let purchasedNormNames = newInvoiceItems
        .map(item => window.Utils.normalizeName(item?.name || item?.text || ''))
        .filter(Boolean);

    if (purchasedNormNames.length === 0) return;

    for (let i = smartNotesDB.length - 1; i >= 0; i--) {
        let note = smartNotesDB[i];
        if (note && Array.isArray(note.items) && note.items.length > 0) {
            let originalCount = note.items.length;
            note.items = note.items.filter(noteItem => {
                let rawName = String(noteItem?.name || noteItem?.text || '').replace(/<[^>]*>?/gm, '').replace(/\(مؤرشف\)/g, '');
                let normNoteItem = window.Utils.normalizeName(rawName);
                return !purchasedNormNames.includes(normNoteItem);
            });

            if (note.items.length !== originalCount) {
                isModified = true;
                if (note.items.length === 0 && (!note.title || note.title.includes('بدون اسم') || note.title.includes('نواقص'))) {
                    smartNotesDB.splice(i, 1);
                }
            }
        }
    }

    if (isModified) {
        this.saveSmartNotes(smartNotesDB);
    }
},

// فحص ما إذا كانت الفاتورة مسجلة مسبقاً كحركة في seraj_treasury_moves (بالمعرف الكامل أو آخر 5 أرقام أو الملاحظات)
_hasTreasuryMoveForInvoice: function(inv, rawMoves) {
    if (!inv || !Array.isArray(rawMoves)) return false;
    let invIdStr = String(inv.id ?? inv.invoiceNo ?? '').trim();
    let invNoStr = String(inv.invoiceNo ?? invIdStr).trim();
    if (!invIdStr) return false;
    let shortId = invIdStr.length > 5 ? invIdStr.slice(-5) : invIdStr;

    return rawMoves.some(m => {
        if (!m) return false;
        let mInvNo = String(m.invoiceNo ?? '').trim();
        let mInvShort = mInvNo.length > 5 ? mInvNo.slice(-5) : mInvNo;
        let mId = String(m.id ?? '').trim();
        if (mInvNo && (mInvNo === invIdStr || mInvNo === invNoStr || (shortId && (mInvNo === shortId || mInvShort === shortId)))) return true;
        if (mId === invIdStr || mId === invNoStr) return true;
        if (m.notes) {
            let notesStr = String(m.notes);
            if (notesStr.includes(`#${invIdStr}`) || notesStr.includes(`فاتورة ${invIdStr}`) || notesStr.includes(`فاتورة رقم ${invIdStr}`)) return true;
            if (shortId && shortId.length >= 4 && (notesStr.includes(`#${shortId}`) || notesStr.includes(`فاتورة ${shortId}`) || notesStr.includes(`فاتورة رقم ${shortId}`))) return true;
        }
        return false;
    });
},

// محرك كاميرا الخزينة الصافي: يرجع حركات seraj_treasury_moves الحقيقية فقط بدون أي دمج وهمي للفواتير
getTreasuryMoves: function(includeCanceled = true, rawOnly = false) {
    let rawMoves = safeParseJSON(localStorage.getItem('seraj_treasury_moves'), []);

    let cleanedRaw = rawMoves.filter(m => {
        if (!m) return false;
        let mIdStr = String(m.id ?? '');
        return !(m._isInvoice === true || m._isMergedInvoice === true || mIdStr.endsWith('_vouch') || mIdStr.endsWith('_cash') || mIdStr.endsWith('_inv_sale') || mIdStr.endsWith('_inv_purch'));
    }).map(m => {
        let normDate = window.Utils.normalizeDateStr(m.date, m.timestamp);
        let alignedTs = window.Utils.alignTimestampWithDate(normDate, m.timestamp);
        let vKey = m.vault || m.treasury || 'main';
        if (vKey !== 'main' && vKey !== 'insta' && vKey !== 'wallet') {
            let low = String(vKey).toLowerCase();
            vKey = (low.includes('insta') || low.includes('انستا') || low.includes('إنستا')) ? 'insta' : ((low.includes('wallet') || low.includes('محفظ')) ? 'wallet' : 'main');
        }
        return {
            ...m,
            vault: vKey,
            treasury: vKey,
            date: normDate,
            timestamp: alignedTs
        };
    });

    return includeCanceled
        ? [...cleanedRaw]
        : cleanedRaw.filter(m => !m.isCanceled && m.type !== 'canceled' && m.type !== 'cancelled' && !m.isDeleted && m.status !== 'deleted');
},

// حفظ حركات الخزينة الصافية (تقبل الحركات الصفرية وحركات العكس والتعديل وتطرد أي عناصر مدمجة وهمية)
saveTreasuryMoves: function(data) {
    if (!Array.isArray(data) || this._isSavingTreasury) return;
    this._isSavingTreasury = true;
    try {
        let now = Date.now();
        let seenIds = new Set();

        let cleanedMoves = data.filter(m => {
            if (!m) return false;
            let mIdStr = String(m.id ?? '');
            if (m._isInvoice === true || m._isMergedInvoice === true || mIdStr.endsWith('_vouch') || mIdStr.endsWith('_cash') || mIdStr.endsWith('_inv_sale') || mIdStr.endsWith('_inv_purch')) {
                return false;
            }
            return true;
        }).map((m, idx) => {
            let cleanM = { ...m };
            delete cleanM._isInvoice;
            delete cleanM._isMergedInvoice;

            if (cleanM.id === undefined || cleanM.id === null || cleanM.id === '') {
                cleanM.id = window.Utils.generateUniqueId();
            } else if (String(cleanM.id).includes('.')) {
                cleanM.id = window.Utils.sanitizeEntityId(cleanM.id);
            }

            let idStr = String(cleanM.id);
            if (seenIds.has(idStr)) return null;
            seenIds.add(idStr);

            if (!cleanM.vault && cleanM.treasury) {
                let v = String(cleanM.treasury).toLowerCase();
                cleanM.vault = (v.includes('insta') || v.includes('انستا') || v.includes('إنستا')) ? 'insta' : ((v.includes('wallet') || v.includes('محفظ')) ? 'wallet' : 'main');
            } else if (!cleanM.vault) {
                cleanM.vault = 'main';
            }
            cleanM.treasury = cleanM.vault;

            let add = parseFloat(cleanM.amountAdd) || 0;
            let ded = parseFloat(cleanM.amountDeduct) || 0;
            let rawAmt = parseFloat(cleanM.amount) || 0;
            if (add === 0 && ded === 0 && rawAmt > 0) {
                let isOut = (cleanM.direction === 'out' || cleanM.type === 'payment' || cleanM.type === 'purchase' || cleanM.type === 'purchases' || cleanM.type === 'purchase_payment' || cleanM.type === 'expenses' || cleanM.type === 'expense' || cleanM.type === 'return_sale' || cleanM.type === 'sales_return');
                if (isOut) cleanM.amountDeduct = rawAmt;
                else cleanM.amountAdd = rawAmt;
            }
            cleanM.amountAdd = Math.round((parseFloat(cleanM.amountAdd) || 0) * 100) / 100;
            cleanM.amountDeduct = Math.round((parseFloat(cleanM.amountDeduct) || 0) * 100) / 100;
            cleanM.amount = Math.round((cleanM.amountAdd || cleanM.amountDeduct || rawAmt || 0) * 100) / 100;

            cleanM.date = window.Utils.normalizeDateStr(cleanM.date, cleanM.timestamp);
            cleanM.timestamp = window.Utils.alignTimestampWithDate(cleanM.date, cleanM.timestamp || (now + idx));
            if (!cleanM._lastModified) cleanM._lastModified = now;
            if (!cleanM._device) cleanM._device = myDeviceName;
            if (!cleanM._lastModifiedBy) cleanM._lastModifiedBy = myDeviceName;

            return cleanM;
        }).filter(Boolean);

        _internalSetItem('seraj_treasury_moves', JSON.stringify(cleanedMoves));
        saveArrayToQueueSafely('treasury_moves', cleanedMoves);

        this.recalculateVaultBalances();
    } finally {
        this._isSavingTreasury = false;
    }
},

// دالة استخراج المصروفات لصفحة المحاسب الذكي (smart_accountant.html)
getExpenses: function(includeCanceled = false) {
    let moves = this.getTreasuryMoves(includeCanceled, true);
    return moves.filter(m => {
        if (!m || (!includeCanceled && (m._isReversed || m._isReversal))) return false;
        let t = String(m.type || '').toLowerCase();
        return t === 'expenses' || t === 'expense';
    }).map(m => {
        let amt = parseFloat(m.amountDeduct) || parseFloat(m.amount) || parseFloat(m.amountAdd) || 0;
        let normDate = window.Utils.normalizeDateStr(m.date, m.timestamp);
        return {
            ...m,
            amount: Math.round(amt * 100) / 100,
            date: normDate,
            timestamp: window.Utils.alignTimestampWithDate(normDate, m.timestamp)
        };
    });
},

// دالة استرجاع مرتجعات المبيعات لصفحة المحاسب الذكي (منع ازدواجية الجمع مع sales_invoices)
getSalesReturns: function(includeCanceled = false) {
    let standaloneReturns = safeParseJSON(localStorage.getItem('seraj_sales_returns'), []);
    if (!Array.isArray(standaloneReturns) || standaloneReturns.length === 0) return [];
    let salesIds = new Set(safeParseJSON(localStorage.getItem('seraj_sales_invoices'), []).map(i => String(i?.id)));
    return standaloneReturns.filter(r => {
        if (!r) return false;
        if (!includeCanceled && (r.isCanceled || r.isDeleted || r.status === 'deleted')) return false;
        return !salesIds.has(String(r.id));
    }).map(r => ({
        ...r,
        date: window.Utils.normalizeDateStr(r.date, r.timestamp)
    }));
},

getVaults: function() {
    return safeParseJSON(localStorage.getItem('seraj_vaults_v2'), { main: 0, insta: 0, wallet: 0 });
},

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
        _internalSetItem('seraj_vaults_v2', newStr);
        if (cloudReady && navigator.onLine && window.dbCloud) {
            let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
            window.dbCloud.ref('test_Stores/' + activeStoreId + '/vaults_v2').set(cleanVaults);
        }
        emitSerajUpdate('vaults_v2', 'local');
    } finally {
        setTimeout(() => { this._isSavingVaults = false; }, 150);
    }
},

// إعادة حساب أرصدة الخزائن مباشرة من حركات seraj_treasury_moves المسجلة في الكاميرا
recalculateVaultBalances: function(autoSave = true) {
    let activeMoves = this.getTreasuryMoves(false, true);
    let vaults = { main: 0, insta: 0, wallet: 0 };
    activeMoves.forEach(m => {
        if (!m) return;
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

// تسجيل أي إقرار مالي أو حركة في الخزينة بالثانية (وإذا تم تعديل سند بنفس الـ ID يعكس القديم ويسجل الجديد كسطر مستقل)
recordTreasuryTransaction: function(moveObj) {
    if (!moveObj) return null;
    let moves = this.getTreasuryMoves(true, true);
    let now = Date.now();

    let vKey = moveObj.vault || moveObj.treasury || 'main';
    if (vKey !== 'main' && vKey !== 'insta' && vKey !== 'wallet') {
        let low = String(vKey).toLowerCase();
        vKey = (low.includes('insta') || low.includes('انستا') || low.includes('إنستا')) ? 'insta' : ((low.includes('wallet') || low.includes('محفظ')) ? 'wallet' : 'main');
    }

    let amountAdd = parseFloat(moveObj.amountAdd) || 0;
    let amountDeduct = parseFloat(moveObj.amountDeduct) || 0;
    if (amountAdd === 0 && amountDeduct === 0 && moveObj.amount) {
        let rawAmt = parseFloat(moveObj.amount) || 0;
        if (moveObj.direction === 'out' || moveObj.type === 'payment' || moveObj.type === 'purchase' || moveObj.type === 'purchases' || moveObj.type === 'purchase_payment' || moveObj.type === 'expenses' || moveObj.type === 'expense' || moveObj.type === 'return_sale' || moveObj.type === 'sales_return') {
            amountDeduct = rawAmt;
        } else {
            amountAdd = rawAmt;
        }
    }

    let normDate = window.Utils.normalizeDateStr(moveObj.date, moveObj.timestamp);
    let alignedTs = window.Utils.alignTimestampWithDate(normDate, moveObj.timestamp || now);
    let localDateStr = new Date(alignedTs).toLocaleDateString('en-GB');

    let requestedId = moveObj.id !== undefined && moveObj.id !== null && moveObj.id !== ''
        ? window.Utils.sanitizeEntityId(moveObj.id)
        : window.Utils.generateUniqueId();

    let existingIdx = moves.findIndex(m => m && (String(m.id) === String(requestedId) || String(m.rawTreasuryId || '') === String(requestedId)) && !m._isReversed);
    let finalMoveId = requestedId;

    // إذا كان هناك حركة سابقة بنفس المعرف ولم يتم عكسها بعد، نعكسها أولاً بسطر مستقل ثم نسجل الحركة الجديدة بسطر جديد
    if (existingIdx > -1) {
        let oldMove = moves[existingIdx];
        oldMove._isReversed = true;
        oldMove._lastModified = now;

        let oldAdd = Math.round((parseFloat(oldMove.amountAdd) || 0) * 100) / 100;
        let oldDed = Math.round((parseFloat(oldMove.amountDeduct) || 0) * 100) / 100;
        let oldAmt = Math.round((parseFloat(oldMove.amount) || oldAdd || oldDed || 0) * 100) / 100;
        let revDate = window.Utils.getLocalDateString(now);

        let revMove = {
            id: window.Utils.generateUniqueId('REV_'),
            type: 'correction',
            vault: oldMove.vault || oldMove.treasury || 'main',
            treasury: oldMove.vault || oldMove.treasury || 'main',
            amountAdd: oldDed,
            amountDeduct: oldAdd,
            amount: oldAmt,
            notes: `🔄 عكس لتعديل حركة/سند: ${oldMove.notes || ('رقم ' + oldMove.id)}`,
            date: revDate,
            dateFormatted: new Date(now).toLocaleDateString('en-GB'),
            timestamp: now,
            invoiceNo: oldMove.invoiceNo || null,
            customerId: oldMove.customerId || null,
            customer: oldMove.customer || null,
            supplierId: oldMove.supplierId || null,
            supplier: oldMove.supplier || null,
            _device: myDeviceName,
            _lastModified: now,
            _lastModifiedBy: localStorage.getItem('cashier_name') || myDeviceName,
            _isReversal: true,
            _reversedMoveId: String(oldMove.id)
        };
        moves.unshift(revMove);
        finalMoveId = window.Utils.generateUniqueId('TR_');
        alignedTs = now + 1;
    } else if (moves.some(m => m && String(m.id) === String(requestedId))) {
        // إذا كان المعرف القديم موجوداً وتم عكسه للتو عبر deleteItem (مثل saveEditedVoucher في العملاء)، نمنح الحركة الجديدة معرفاً فريداً لكي لا تدهس السطر القديم
        finalMoveId = window.Utils.generateUniqueId('TR_');
        alignedTs = now + 1;
    }

    let newMove = {
        id: finalMoveId,
        rawTreasuryId: String(requestedId),
        type: moveObj.type || 'direct',
        vault: vKey,
        treasury: vKey,
        amountAdd: Math.round(amountAdd * 100) / 100,
        amountDeduct: Math.round(amountDeduct * 100) / 100,
        amount: Math.round((amountAdd || amountDeduct || 0) * 100) / 100,
        notes: moveObj.notes || '',
        date: normDate,
        dateFormatted: localDateStr,
        timestamp: alignedTs,
        invoiceNo: moveObj.invoiceNo || null,
        allocatedInvoices: Array.isArray(moveObj.allocatedInvoices) ? moveObj.allocatedInvoices : [],
        customerId: moveObj.customerId || null,
        customer: moveObj.customer ? String(moveObj.customer).trim() : null,
        supplierId: moveObj.supplierId || null,
        supplier: moveObj.supplier ? String(moveObj.supplier).trim() : null,
        _device: moveObj._device || myDeviceName,
        _lastModified: moveObj._lastModified || alignedTs,
        _lastModifiedBy: moveObj._lastModifiedBy || localStorage.getItem('cashier_name') || myDeviceName
    };

    moves.unshift(newMove);
    this.saveTreasuryMoves(moves);
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
    _internalSetItem('seraj_store_settings', JSON.stringify(settings));
    emitSerajUpdate('store_settings', 'local');
},

// --- النوتة الذكية وقوائم النواقص (Smart Notes - مزامنة خلفية سريعة خلال ثانية واحدة لتشغيل الجرس اللحظي) ---
getSmartNotes: function() {
    let notes = safeParseJSON(localStorage.getItem('seraj_smart_notes'), []);
    return notes.map((n, idx) => {
        if (!n) return null;
        return {
            ...n,
            id: String(n.id ?? n.noteId ?? n.timestamp ?? idx),
            date: window.Utils.normalizeDateStr(n.date, n.timestamp)
        };
    }).filter(Boolean);
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
            if (n.id === undefined || n.id === null) {
                n.id = n.noteId || n.timestamp || (Date.now() + idx);
            }
            n.id = String(n.id);
            n.date = window.Utils.normalizeDateStr(n.date, n.timestamp);
            let idStr = n.id;
            newIds.add(idStr);

            let oldN = oldMap.get(idStr);
            let oldCopy = oldN ? { ...oldN, id: String(oldN.id) } : null;
            let newCopy = { ...n };
            if (oldCopy) { delete oldCopy._lastModified; delete oldCopy._senderUid; delete oldCopy.updatedBy; }
            delete newCopy._lastModified; delete newCopy._senderUid; delete newCopy.updatedBy;

            if (!oldCopy || JSON.stringify(oldCopy) !== JSON.stringify(newCopy)) {
                n._lastModified = Date.now();
                n.updatedBy = myDeviceName;
                n._senderUid = myDeviceUid;
                addToSyncQueue('smart_notes', n);
            } else if (!n._lastModified) {
                n._lastModified = Date.now();
                n.updatedBy = myDeviceName;
                n._senderUid = myDeviceUid;
                addToSyncQueue('smart_notes', n);
            }
        });

        oldNotes.forEach(oldN => {
            if (oldN && oldN.id !== undefined && !newIds.has(String(oldN.id))) {
                addToDeleteQueue('smart_notes', String(oldN.id));
            }
        });

        _internalSetItem('seraj_smart_notes', JSON.stringify(data));
        _internalSetItem('seraj_cloud_cache_smart_notes', JSON.stringify(data));
        localCollectionsCache['smart_notes'] = [...data];
        // رفع خلفي سريع خلال ثانية واحدة لتشغيل الجرس اللحظي بين أجهزة المحل
        scheduleSyncQueue(1000);
        emitSerajUpdate('smart_notes', 'local');
    } finally {
        this._isSavingSmartNotes = false;
    }
},

// =========================================================
// ☁️ محرك الأرشفة السحابية الذكي (Deep Archiving Engine)
// يحتفظ بآخر 50 فاتورة نقدية (طياري) أو فواتير آخر يومين ويرحّل الباقي والقديم (>90 يوماً) للسحابة
// =========================================================
archiveSmartData: async function() {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) {
        SerajAlert("يجب الاتصال بالإنترنت لإجراء الأرشفة السحابية!", "error");
        return false;
    }

    return new Promise((resolve) => {
        SerajConfirm("سيتم أرشفة فواتير الكاش (الطياري) القديمة مع الاحتفاظ بآخر 50 فاتورة نقدية (أو فواتير آخر يومين)، وأرشفة الفواتير والحركات الأقدم من 90 يوماً للسحابة مع تثبيت الأرصدة الافتتاحية. هل أنت متأكد؟", async (confirm) => {
            if (!confirm) return resolve(false);

            showCloudStatus("⏳ جاري أرشفة البيانات القديمة للسحابة... برجاء عدم إغلاق الصفحة.");

            let now = Date.now();
            let days2 = now - (2 * 24 * 60 * 60 * 1000);
            let days90 = now - (90 * 24 * 60 * 60 * 1000);

            let sales = this.getSalesInvoices(true);
            let purchases = this.getPurchaseInvoices(true);
            let moves = this.getTreasuryMoves(true, true);
            let customers = this.getCustomers(true);
            let suppliers = this.getSuppliers(true);

            let archivePayload = { sales: {}, purchases: {}, treasury_moves: {} };
            let newSales = [], newPurchases = [], newMoves = [];

            let sortedSales = [...sales].sort((a, b) => {
                let diff = window.Utils.getSafeTime(b.timestamp || b.date) - window.Utils.getSafeTime(a.timestamp || a.date);
                if (diff !== 0) return diff;
                return window.Utils.extractSerialNum(b.id) - window.Utils.extractSerialNum(a.id);
            });

            let cashSalesKeptCount = 0;

            sortedSales.forEach(inv => {
                if (!inv) return;
                let t = window.Utils.getSafeTime(inv.date || inv.timestamp);
                let remVal = inv.calculatedRemaining !== undefined ? parseFloat(inv.calculatedRemaining) : (parseFloat(inv.remaining) || 0);
                let isAnonymousOrCash = (!inv.customerId && (!inv.customer || inv.customer.includes('طيار') || inv.customer.includes('نقد'))) || (remVal <= 0.01 && (parseFloat(inv.initialRemaining) || 0) <= 0.01 && (!inv.customerId));

                if (isAnonymousOrCash) {
                    cashSalesKeptCount++;
                    if (cashSalesKeptCount <= 50 || t >= days2) {
                        newSales.push(inv);
                    } else {
                        archivePayload.sales[inv.id] = inv;
                    }
                } else if (t < days90 && remVal <= 0.01) {
                    archivePayload.sales[inv.id] = inv;
                } else {
                    newSales.push(inv);
                }
            });

            purchases.forEach(inv => {
                if (!inv) return;
                let t = window.Utils.getSafeTime(inv.date || inv.timestamp);
                let remVal = inv.calculatedRemaining !== undefined ? parseFloat(inv.calculatedRemaining) : (parseFloat(inv.remaining) || 0);
                if (t < days90 && remVal <= 0.01) archivePayload.purchases[inv.id] = inv;
                else newPurchases.push(inv);
            });

            let archivedVaultDelta = { main: 0, insta: 0, wallet: 0 };

            Object.values(archivePayload.sales).forEach(inv => {
                if (!inv || inv.isCanceled || inv.type === 'canceled' || inv.type === 'quotation' || inv.isDeleted) return;
                if (!this._hasTreasuryMoveForInvoice(inv, moves)) {
                    let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null) ? parseFloat(inv.initialPaid) : (parseFloat(inv.paid) || 0);
                    if (checkoutPaid > 0) {
                        let isReturn = (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');
                        let vKey = inv.vault || inv.treasury || 'main';
                        if (archivedVaultDelta[vKey] === undefined) vKey = 'main';
                        archivedVaultDelta[vKey] += isReturn ? -checkoutPaid : checkoutPaid;
                    }
                }
            });

            Object.values(archivePayload.purchases).forEach(inv => {
                if (!inv || inv.isCanceled || inv.type === 'canceled' || inv.type === 'quotation' || inv.isDeleted) return;
                if (!this._hasTreasuryMoveForInvoice(inv, moves)) {
                    let checkoutPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null) ? parseFloat(inv.initialPaid) : (parseFloat(inv.paid) || 0);
                    if (checkoutPaid > 0) {
                        let isReturn = (inv.type === 'return' || inv.type === 'return_purchase' || inv.type === 'purchase_return');
                        let vKey = inv.vault || inv.treasury || 'main';
                        if (archivedVaultDelta[vKey] === undefined) vKey = 'main';
                        archivedVaultDelta[vKey] += isReturn ? checkoutPaid : -checkoutPaid;
                    }
                }
            });

            moves.forEach(m => {
                if (!m) return;
                let t = window.Utils.getSafeTime(m.date || m.timestamp);
                if (t < days90 && !String(m.id).startsWith('arch_bal_')) {
                    archivePayload.treasury_moves[m.id] = m;
                    if (!m.isCanceled && m.type !== 'canceled' && m.type !== 'cancelled' && !m.isDeleted && m.status !== 'deleted') {
                        let vKey = m.vault || 'main';
                        if (archivedVaultDelta[vKey] === undefined) vKey = 'main';
                        archivedVaultDelta[vKey] += ((parseFloat(m.amountAdd) || 0) - (parseFloat(m.amountDeduct) || 0));
                    }
                } else {
                    newMoves.push(m);
                }
            });

            ['main', 'insta', 'wallet'].forEach(vKey => {
                let delta = Math.round(archivedVaultDelta[vKey] * 100) / 100;
                if (Math.abs(delta) < 0.01) return;
                let existingArchMove = newMoves.find(m => m && String(m.id) === `arch_bal_${vKey}`);
                if (existingArchMove) {
                    let netNow = ((parseFloat(existingArchMove.amountAdd) || 0) - (parseFloat(existingArchMove.amountDeduct) || 0)) + delta;
                    existingArchMove.amountAdd = netNow >= 0 ? Math.round(netNow * 100) / 100 : 0;
                    existingArchMove.amountDeduct = netNow < 0 ? Math.round(Math.abs(netNow) * 100) / 100 : 0;
                    existingArchMove.amount = Math.round(Math.abs(netNow) * 100) / 100;
                    existingArchMove._lastModified = now;
                } else {
                    newMoves.push({
                        id: `arch_bal_${vKey}`,
                        type: 'direct',
                        vault: vKey,
                        treasury: vKey,
                        amountAdd: delta >= 0 ? delta : 0,
                        amountDeduct: delta < 0 ? Math.abs(delta) : 0,
                        amount: Math.abs(delta),
                        notes: 'رصيد مرحل من الأرشيف السحابي',
                        date: window.Utils.getLocalDateString(days90),
                        timestamp: days90,
                        _device: myDeviceName,
                        _lastModified: now,
                        _lastModifiedBy: myDeviceName
                    });
                }
            });

            customers.forEach(c => {
                let oldAleih = 0; let oldLeh = 0;
                let cNorm = window.Utils.normalizeName(c.name || '');

                Object.values(archivePayload.sales).forEach(inv => {
                    let invNorm = window.Utils.normalizeName(inv.customer || '');
                    if (!inv.isCanceled && (String(inv.customerId) === String(c.id) || (cNorm && invNorm === cNorm))) {
                        let invTot = parseFloat(inv.total) || 0;
                        let invDisc = parseFloat(inv.discount) || 0;
                        let origPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null) ? parseFloat(inv.initialPaid) : (parseFloat(inv.paid) || 0);
                        let origRem = (inv.initialRemaining !== undefined && inv.initialRemaining !== null) ? parseFloat(inv.initialRemaining) : (parseFloat(inv.remaining) || 0);
                        let req = (Math.abs((origPaid + origRem) - invTot) < 0.05 && invDisc > 0) ? invTot : (invTot - invDisc);
                        if (req < 0) req = 0;

                        let isReturn = (inv.type === 'return' || inv.type === 'return_sale' || inv.type === 'sales_return');
                        let checkoutPaid = origPaid;

                        if (!isReturn) { oldAleih += req; oldLeh += checkoutPaid; }
                        else { oldLeh += req; oldAleih += checkoutPaid; }
                    }
                });

                Object.values(archivePayload.treasury_moves).forEach(m => {
                    let mNorm = window.Utils.normalizeName(m.customer || '');
                    if (!m.isCanceled && !m._isReversed && !m._isReversal && (String(m.customerId) === String(c.id) || (cNorm && mNorm === cNorm))) {
                        let amt = parseFloat(m.amount) || 0;
                        if (m.type === 'payment' || m.type === 'customer_payment') oldAleih += amt;
                        else if (m.type === 'receipt' || m.type === 'customer_receipt') oldLeh += amt;
                    }
                });

                if (Array.isArray(c.transactions)) {
                    c.transactions = c.transactions.filter(tx => !tx || !archivePayload.treasury_moves[tx.id]);
                }

                c.openingBalance = Math.round(((parseFloat(c.openingBalance) || 0) + (oldAleih - oldLeh)) * 100) / 100;
            });

            suppliers.forEach(s => {
                let sTotalReq = 0; let sTotalPaid = 0;
                let sNorm = window.Utils.normalizeName(s.name || '');

                Object.values(archivePayload.purchases).forEach(inv => {
                    let invNorm = window.Utils.normalizeName(inv.supplier || '');
                    if (!inv.isCanceled && (String(inv.supplierId) === String(s.id) || (sNorm && invNorm === sNorm))) {
                        let invTot = parseFloat(inv.total) || 0;
                        let invDisc = parseFloat(inv.discount) || 0;
                        let origPaid = (inv.initialPaid !== undefined && inv.initialPaid !== null) ? parseFloat(inv.initialPaid) : (parseFloat(inv.paid) || 0);
                        let origRem = (inv.initialRemaining !== undefined && inv.initialRemaining !== null) ? parseFloat(inv.initialRemaining) : (parseFloat(inv.remaining) || 0);
                        let req = (Math.abs((origPaid + origRem) - invTot) < 0.05 && invDisc > 0) ? invTot : (invTot - invDisc);
                        if (req < 0) req = 0;

                        let isReturn = (inv.type === 'return' || inv.type === 'purchase_return' || inv.type === 'return_purchase');
                        let checkoutPaid = origPaid;

                        if (!isReturn) { sTotalReq += req; sTotalPaid += checkoutPaid; }
                        else { sTotalReq -= req; sTotalPaid -= checkoutPaid; }
                    }
                });

                Object.values(archivePayload.treasury_moves).forEach(m => {
                    let mNorm = window.Utils.normalizeName(m.supplier || '');
                    if (!m.isCanceled && !m._isReversed && !m._isReversal && (String(m.supplierId) === String(s.id) || (sNorm && mNorm === sNorm))) {
                        let amt = parseFloat(m.amount) || 0;
                        if (m.type === 'receipt' || m.type === 'supplier_receipt') sTotalReq += amt;
                        else if (m.type === 'payment' || m.type === 'purchase_payment') sTotalPaid += amt;
                    }
                });

                if (Array.isArray(s.transactions)) {
                    s.transactions = s.transactions.filter(tx => !tx || !archivePayload.treasury_moves[tx.id]);
                }

                s.openingBalance = Math.round(((parseFloat(s.openingBalance) || 0) + (sTotalReq - sTotalPaid)) * 100) / 100;
            });

            try {
                let currentYear = new Date().getFullYear();
                let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
                let archiveRef = window.dbCloud.ref('test_Stores/' + activeStoreId + '/Archive_' + currentYear);
                await archiveRef.update(archivePayload);

                Object.keys(archivePayload.sales).forEach(id => addToDeleteQueue('sales_invoices', id));
                Object.keys(archivePayload.purchases).forEach(id => addToDeleteQueue('purchase_invoices', id));
                Object.keys(archivePayload.treasury_moves).forEach(id => addToDeleteQueue('treasury_moves', id));

                this.saveCustomers(customers);
                this.saveSuppliers(suppliers);

                _internalSetItem('seraj_sales_invoices', JSON.stringify(newSales));
                saveArrayToQueueSafely('sales_invoices', newSales);

                _internalSetItem('seraj_purchase_invoices', JSON.stringify(newPurchases));
                saveArrayToQueueSafely('purchase_invoices', newPurchases);

                this.saveTreasuryMoves(newMoves);
                await this.syncNow();

                SerajAlert("✅ تمت عملية الأرشفة الذكية بنجاح! تم الاحتفاظ بآخر 50 فاتورة نقدية وترحيل القديم للسحابة مع تثبيت الأرصدة.", "success", () => {
                    window.location.reload();
                });
                resolve(true);
            } catch (e) {
                console.error("Archive Error:", e);
                SerajAlert("❌ خطأ أثناء الرفع للسحابة، لم يتم مسح الداتا المحلية لحمايتها من الضياع.", "error");
                resolve(false);
            }
        });
    });
},

fetchArchivedData: async function(year = new Date().getFullYear()) {
    if (!cloudReady || !navigator.onLine || !window.dbCloud) {
        SerajAlert("يجب الاتصال بالإنترنت للبحث في الأرشيف!", "error");
        return null;
    }
    showCloudStatus("⏳ جاري سحب الأرشيف من السحابة... برجاء الانتظار.");
    try {
        let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
        let snap = await window.dbCloud.ref('test_Stores/' + activeStoreId + '/Archive_' + year).once('value');
        if (snap.exists()) {
            showCloudStatus("✅ تم جلب الأرشيف بنجاح.");
            return snap.val();
        } else {
            SerajAlert("لا توجد بيانات مؤرشفة مسجلة في هذا العام.", "error");
            return null;
        }
    } catch (e) {
        console.error(e);
        SerajAlert("حدث خطأ أثناء جلب الأرشيف.", "error");
        return null;
    }
},

getAggregatedData: function() {
    return {
        sales: this.getSalesInvoices(true),
        purchases: this.getPurchaseInvoices(true),
        products: this.getProducts(true),
        customers: this.getCustomers(false, false),
        suppliers: this.getSuppliers(false, false),
        treasuryMoves: this.getTreasuryMoves(true, true),
        expenses: this.getExpenses(false),
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

let lastBackupTime = parseInt(localStorage.getItem('seraj_last_backup_timestamp') || '0', 10);
let now = Date.now();
let oneDayMillis = 24 * 60 * 60 * 1000;

if ((now - lastBackupTime) > oneDayMillis) {
    let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
    let fullSystemSnapshot = {
        timestamp: now,
        dateFormatted: new Date().toLocaleString('ar-EG'),
        deviceName: myDeviceName,
        storeId: activeStoreId,
        ...window.DB.getAggregatedData(),
        vaults: window.DB.getVaults()
    };

    let backupRef = window.dbCloud.ref('test_Stores/' + activeStoreId + '/system_backup/latest_snapshot');
    backupRef.set(fullSystemSnapshot)
        .then(() => {
            _internalSetItem('seraj_last_backup_timestamp', now.toString());
            console.log("☁️ تم تحديث النسخة الاحتياطية السحابية بنجاح.");
        })
        .catch(err => console.error("Auto Cloud Backup Error:", err));
}
}

// =========================================================================
// 🎙️ القسم السادس: المحرك الصوتي الخفيف والصاروخي (Lightweight SmartVoice V4)
// خفيف جداً على رامات الموبايل + يفهم الأرقام اللفظية والمثنى والجمع ويحمي الوحدات
// ويدعم 3 بروفايلات مستقلة (sales / purchases / inventory) ويرجع كائن الصنف وأسعاره
// =========================================================================
window.cleanExcelText = function(text) {
if (!text) return "";
let t = String(text);
if (typeof t.normalize === 'function') t = t.normalize('NFKC');
return t.replace(/_x000d_/gi, ' ')
        .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const DefaultVoiceConfig = {
settings: {
    letterTolerance: 65,
    numberMagnet: 80,
    searchThreshold: 55,
    mergeDuplicates: true,
    ignoreQuantitiesMode: false,
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

Object.assign(window.DB, {
_activeVoiceProfile: localStorage.getItem('seraj_active_voice_profile') || 'sales',

_getVoiceStorageKey: function(subKey, profileName) {
    let storePrefix = currentStoreId || 'Default';
    let prof = profileName || this._activeVoiceProfile || 'sales';
    if (subKey === 'dict' || subKey === 'units') {
        return `seraj_voice_${storePrefix}_${subKey}`;
    }
    return `seraj_voice_${storePrefix}_${prof}_${subKey}`;
},

getActiveVoiceProfile: function() {
    return this._activeVoiceProfile || 'sales';
},

setActiveVoiceProfile: function(profileName) {
    if (['sales', 'purchases', 'inventory'].includes(profileName)) {
        this._activeVoiceProfile = profileName;
        _internalSetItem('seraj_active_voice_profile', profileName);
    }
},

getVoiceSettings: function(profileName) {
    let prof = profileName || this._activeVoiceProfile || 'sales';
    let saved = localStorage.getItem(this._getVoiceStorageKey('settings', prof));
    let baseDefaults = { ...DefaultVoiceConfig.settings };
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
    _internalSetItem(this._getVoiceStorageKey('settings', prof), JSON.stringify(merged));
    this._syncVoiceConfigToCloud();
},

getVoicePipeline: function(profileName) {
    let prof = profileName || this._activeVoiceProfile || 'sales';
    return safeParseJSON(localStorage.getItem(this._getVoiceStorageKey('pipeline', prof)), []);
},

saveVoicePipeline: function(pipelineArray, profileName) {
    let prof = profileName || this._activeVoiceProfile || 'sales';
    _internalSetItem(this._getVoiceStorageKey('pipeline', prof), JSON.stringify(pipelineArray || []));
},

resetVoicePipelineToDefault: function(profileName) {
    let prof = profileName || this._activeVoiceProfile || 'sales';
    localStorage.removeItem(this._getVoiceStorageKey('pipeline', prof));
    localStorage.removeItem(this._getVoiceStorageKey('settings', prof));
    return [];
},

copyVoiceProfile: function(fromProfile, toProfile) {
    this.saveVoiceSettings(this.getVoiceSettings(fromProfile), toProfile);
},

getVoiceSensitivity: function(profileName) {
    let s = this.getVoiceSettings(profileName);
    return s.searchThreshold || 55;
},

saveVoiceSensitivity: function(val, profileName) {
    this.saveVoiceSettings({ searchThreshold: parseInt(val, 10) || 55 }, profileName);
},

getVoiceUnits: function() {
    let saved = localStorage.getItem(this._getVoiceStorageKey('units'));
    if (saved !== null) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return [...DefaultVoiceConfig.units];
},

saveVoiceUnits: function(unitsArray) {
    let cleanArr = [...new Set((unitsArray || []).map(u => String(u).trim()).filter(Boolean))];
    _internalSetItem(this._getVoiceStorageKey('units'), JSON.stringify(cleanArr));
    if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
    this._syncVoiceConfigToCloud();
},

getVoiceDictionary: function() {
    let saved = localStorage.getItem(this._getVoiceStorageKey('dict'));
    if (saved !== null) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return { ...DefaultVoiceConfig.dictionary };
},

saveVoiceDictionary: function(dictObj) {
    _internalSetItem(this._getVoiceStorageKey('dict'), JSON.stringify(dictObj || {}));
    if (typeof SmartVoice !== 'undefined') SmartVoice._invalidateShadowCache();
    this._syncVoiceConfigToCloud();
},

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
    if (cloudReady && navigator.onLine && window.dbCloud) {
        let activeStoreId = localStorage.getItem('seraj_store_id') || currentStoreId || 'DemoStore';
        let payload = {
            sales: { settings: this.getVoiceSettings('sales') },
            purchases: { settings: this.getVoiceSettings('purchases') },
            inventory: { settings: this.getVoiceSettings('inventory') },
            units: this.getVoiceUnits(),
            dictionary: this.getVoiceDictionary(),
            updatedAt: Date.now()
        };
        window.dbCloud.ref('test_Stores/' + activeStoreId + '/voice_studio_v4').set(payload).catch(() => {});
    }
}
});

const SmartVoice = {
    _shadowCache: null,
    _shadowCacheCount: 0,

    _invalidateShadowCache: function() {
        this._shadowCache = null;
        this._shadowCacheCount = 0;
    },

    // دالة التقشير أصبحت وهمية (ترجع الكلام كما هو لحماية أي صفحة تستدعيها)
    peeler: function(text) {
        return text ? String(text).trim() : "";
    },

    // تحضير المخزن أصبح وهمياً لأننا لن نبحث فيه ولن نقارن الكلمات
    prepareInventoryShadow: function(inventoryDB) {
        return [];
    },

    // المايسترو الجديد (الكوبري): يأخذ الكلام كوبي بيست بدون أي اجتهاد أو تأليف
    analyzeFullText: function(rawText, customInventoryDB, profileOverride) {
        let activeProfile = profileOverride || (window.DB && typeof window.DB.getActiveVoiceProfile === 'function' ? window.DB.getActiveVoiceProfile() : 'sales');
        if (!rawText || !String(rawText).trim()) return { queue: [], logsHTML: "", activeProfile: activeProfile };

        // 1. تجهيز الفواصل: استبدال "زائد" والواو المستقلة بعلامة +
        // نستخدم \s+و\s+ لكي نفصل بالواو المستقلة فقط دون قص حرف الواو من بداية الكلمات
        let working = String(rawText)
            .replace(/(?:زائد|[\.،,؛\-!\?؟])/g, ' + ')
            .replace(/\s+و\s+/g, ' + ');

        let chunks = working.split('+').map(c => c.trim()).filter(Boolean);
        let extractedQueue = [];

        chunks.forEach(chunk => {
            let words = chunk.split(/\s+/).filter(Boolean);
            if (words.length === 0) return;

            let qty = 1;
            // نحول الأرقام الهندية لإنجليزية في "ذاكرة النظام فقط" لنعرف هل الكلمة الأولى رقم أم لا
            let firstWordNormalized = words[0].replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

            // إذا كانت الكلمة الأولى رقماً، نسحبها للكمية ونحذفها من اسم الصنف
            if (!isNaN(firstWordNormalized)) {
                qty = parseFloat(firstWordNormalized) || 1;
                words.shift(); 
            }

            // الصنف: باقي الكلام يتم تجميعه كما جاء تماماً (كوبي بيست)
            let spokenName = words.join(" ");
            if (!spokenName) return; 

            extractedQueue.push({
                id: null, // لا يوجد ID لأننا لم نربطه بالمخزن
                product: null,
                qty: qty,
                displayQty: activeProfile === 'inventory' ? "" : qty,
                name: spokenName, // الصنف ينزل صورة طبق الأصل
                cleanName: spokenName,
                price: 0,
                sellPrice: 0,
                purchasePrice: 0,
                score: 100 // نعطيه 100% دائماً لكي تقبله الفاتورة فوراً
            });
        });

        // إرجاع الطابور الجاهز للصفحة
        return { queue: extractedQueue, logsHTML: "", activeProfile: activeProfile };
    },

    parseCommand: function(rawChunk, inventoryDB, profileOverride) {
        let res = this.analyzeFullText(rawChunk, inventoryDB, profileOverride);
        return (res.queue && res.queue.length > 0) ? res.queue[0] : null;
    }
};

window.SmartVoice = SmartVoice;

// ---------------------------------------------------------
// 7. المراقب الذكي لـ localStorage وحارس الحقول الرقمية
// ---------------------------------------------------------
localStorage.setItem = function(key, value) {
if (_isInternalSetItem) {
    return _origSetItem(key, value);
}

if (key === 'seraj_smart_notes' && window.DB && !window.DB._isSavingSmartNotes) {
    _origSetItem(key, value);
    try {
        let parsed = JSON.parse(value);
        if (Array.isArray(parsed)) window.DB.saveSmartNotes(parsed);
    } catch (e) {}
    return;
}

if (key === 'seraj_treasury_moves' && window.DB && !window.DB._isSavingTreasury) {
    try {
        let parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            window.DB.saveTreasuryMoves(parsed);
            return;
        }
    } catch (e) {}
}

if (key === 'seraj_vaults_v2' && window.DB && !window.DB._isSavingVaults) {
    try {
        let parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
            window.DB.saveVaults(parsed);
            return;
        }
    } catch (e) {}
}

_origSetItem(key, value);
};

// 🛡️ حارس مركزي: منع إدخال الأرقام السالبة في أي حقل رقمي على مستوى البرنامج
document.addEventListener('keydown', (e) => {
if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
    if (e.key === '-' || e.key === 'Minus') {
        e.preventDefault();
    }
}
}, true);

document.addEventListener('input', (e) => {
if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
    if (e.target.value && String(e.target.value).includes('-')) {
        e.target.value = String(e.target.value).replace(/-/g, '');
    }
}
}, true);

window.DB.migrateOldData();
window.DB.applySavedTheme();
initCloud();
// ==================== [ نهاية الجزء الثالث 3/3 - اكتمل الملف ] ====================
