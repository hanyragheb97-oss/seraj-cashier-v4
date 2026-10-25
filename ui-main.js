/* ========================================================= */

/* 🚀 سراج كاشير - المدير العام لواجهة المستخدم (ui-main.js) */

/* ========================================================= */



console.log("✅ تم تشغيل ملف ui-main.js بنجاح.");



/*

-------------------------------------------------------------

1. النظام الذكي للتحكم في القوائم المنسدلة

-------------------------------------------------------------

*/

document.addEventListener('click', function(event) {

const clickedInsideMenu = event.target.closest('.dropdown-list, .dropdown-menu, .print-dropdown-menu');

// حددنا أي زرار بيفتح القوائم عشان القائمة متقفلش وإنت لسه بتفتحها

const clickedOnToggleButton = event.target.closest('.search-box, .bottom-print-btn, .bottom-bar-print-btn, .filter-btn, [onclick*="Menu"], [onclick*="toggle"]');

// هل داس على اختيار من جوه القائمة (زي تاريخ مخصص أو اسم عميل)؟

const clickedOnItem = event.target.closest('.dropdown-item, .dropdown-menu-item, .print-dropdown-item');



// لو اختار حاجة من القائمة (زي تاريخ مخصص)

if (clickedOnItem) {

// بنعمل تأخير 150 ملي ثانية.. ليه؟ عشان ندي فرصة لنافذة التاريخ إنها تفتح الأول قبل ما القائمة تختفي

setTimeout(() => {

if (typeof closeAllMenus === 'function') closeAllMenus();

document.querySelectorAll('.dropdown-list, .dropdown-menu, .print-dropdown-menu').forEach(m => m.style.display = 'none');

}, 150);

return;

}



// لو داس بصباعه في أي مكان فاضي في الشاشة

if (!clickedInsideMenu && !clickedOnToggleButton) {

if (typeof closeAllMenus === 'function') closeAllMenus();

document.querySelectorAll('.dropdown-list, .dropdown-menu, .print-dropdown-menu').forEach(m => m.style.display = 'none');

}

});





/*

-------------------------------------------------------------

2. ربط زرار الموبايل (Back Button) بالبرنامج بذكاء

-------------------------------------------------------------

*/

(function setupMobileBackButton() {

window.history.pushState("seraj_history", null, null);



window.onpopstate = function(event) {

window.history.pushState("seraj_history", null, null);

let actionTaken = false;



// أ) أولاً: لو في قائمة منسدلة مفتوحة، نقفلها

document.querySelectorAll('.dropdown-list, .dropdown-menu, .print-dropdown-menu').forEach(menu => {

if (menu.style.display === 'block' || menu.style.display === 'flex') {

menu.style.display = 'none';

actionTaken = true;

}

});

if (actionTaken) {

if (typeof closeAllMenus === 'function') closeAllMenus();

return; // نقف هنا ومنرجعش لورا

}



// ب) ثانياً: لو مفيش قائمة، بس في نافذة منبثقة (Modal) مفتوحة، نقفلها

document.querySelectorAll('.modal-overlay').forEach(modal => {

if (modal.style.display === 'flex' || modal.style.display === 'block') {

modal.style.display = 'none';

actionTaken = true;

}

});

if (actionTaken) return; // نقف هنا ومنرجعش لورا



// ج) ثالثاً: لو الشاشة فاضية، ندور على زرار الرجوع الأزرق بتاع البرنامج وندوس عليه

let backBtn = document.querySelector('.header-back-btn, .bottom-back-btn');

if (backBtn && backBtn.offsetParent !== null) {

backBtn.click();

} else {

// لو إنت في صفحة مفيهاش زرار رجوع أزرق، يرجع للرئيسية

if (!window.location.href.endsWith('index.html')) {

window.location.href = 'index.html';

}

}

};

})();