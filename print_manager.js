// ==========================================
// 🖨️ وزير الطباعة المركزي (Print Manager)
// النظام: سراج كاشير - إدارة: م. هاني
// الوظيفة: التصدير (PDF/Excel)، المعاينة، كشوفات الحساب، وطباعة حرارية ذكية
// ==========================================

const PrintManager = {

    /**
     * 📊 الدالة الأولى: تصدير البيانات العامة إلى Excel (يتطلب مكتبة SheetJS)
     */
    exportToExcel: function(dataArray, filename = 'DataExport') {
        if (typeof showLoading === 'function') showLoading("جاري تصدير ملف الإكسيل...");

        if (typeof XLSX === 'undefined') {
            console.error("مكتبة SheetJS (XLSX) غير متوفرة في هذه الصفحة.");
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }

        try {
            const worksheet = XLSX.utils.json_to_sheet(dataArray);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            
            XLSX.writeFile(workbook, filename + '.xlsx');
        } catch (err) {
            console.error("خطأ أثناء بناء وتصدير الإكسيل:", err);
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    },

    /**
     * 📄 الدالة الثانية: تصدير الـ PDF مباشرة لأي عنصر (تنزيل بدون فتح معاينة)
     */
    exportToPDF: function(elementId, filename = 'Document') {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error("عنصر الطباعة غير موجود:", elementId);
            return;
        }

        if (typeof showLoading === 'function') showLoading("جاري تجهيز وتصدير الـ PDF...");

        const opt = {
            margin:       10,
            filename:     filename + '.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save().then(function() {
                if (typeof hideLoading === 'function') hideLoading();
            }).catch(err => {
                console.error("خطأ في تصدير الـ PDF:", err);
                if (typeof hideLoading === 'function') hideLoading();
            });
        } else {
            console.error("مكتبة html2pdf غير متوفرة في هذه الصفحة.");
            if (typeof hideLoading === 'function') hideLoading();
        }
    },

    /**
     * 📄 الدالة الثالثة: دالة معاينة PDF عامة في نافذة جديدة
     */
    previewPDF: function(elementId, fileName = 'Report') {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (typeof showLoading === 'function') showLoading("جاري تجهيز المعاينة...");

        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
            previewWindow.document.write('<html dir="rtl"><body style="font-family:Tahoma;text-align:center;margin-top:20%;"><h3>جاري تجهيز الملف، يرجى الانتظار...</h3></body></html>');
        }

        const opt = {
            margin: 10, filename: fileName + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).output('blob').then(function(blob) {
                if (typeof hideLoading === 'function') hideLoading();
                const url = URL.createObjectURL(blob);
                if (previewWindow) previewWindow.location.href = url; 
                else window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            }).catch(err => {
                if (typeof hideLoading === 'function') hideLoading();
                if (previewWindow) previewWindow.close();
            });
        }
    },

    /**
     * 🧾 الدالة الرابعة: الطباعة الحرارية المباشرة (RawBT / USB)
     */
    printThermalReceipt: async function(invoiceData) {
        let printMode = localStorage.getItem('seraj_auto_print_setting') || 'ask';
        let connType = localStorage.getItem('seraj_printer_type') || 'usb';
        let storeName = localStorage.getItem('seraj_store_name') || 'سراج كاشير';
        let storePhone = localStorage.getItem('seraj_store_phone') || '';
        let footerMsg = localStorage.getItem('seraj_receipt_footer') || 'شكراً لتعاملكم معنا!';
        let showBalance = localStorage.getItem('seraj_print_balance') || 'yes';

        if (printMode === 'none') return;
        
        if (printMode === 'ask') {
            if (typeof SerajConfirm === 'function') {
                let isConfirmed = await SerajConfirm("هل تريد طباعة هذه الفاتورة؟");
                if (!isConfirmed) return;
            } else {
                let isConfirmed = confirm("هل تريد طباعة هذه الفاتورة؟");
                if (!isConfirmed) return;
            }
        }

        const safe = (typeof sanitizeHTML === 'function') ? sanitizeHTML : (str) => str;
        const money = (typeof formatCurrency === 'function') ? formatCurrency : (num) => Number(num || 0).toFixed(2);
        
        let receiptTitle = 'فاتورة ضريبية مبسطة';
        let watermarkCSS = '';
        
        if (invoiceData.isCanceled) {
            receiptTitle = 'فاتورة ملغاة';
            watermarkCSS = `
                position: relative;
                color: #555;
            `;
        } else if (invoiceData.isQuotation || invoiceData.documentType === 'quotation') {
            receiptTitle = 'عرض سعر (مسودة)';
        }

        let receiptHTML = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    @media print {
                        @page { margin: 0; }
                        body { margin: 0; }
                    }
                    body {
                        font-family: 'Tahoma', sans-serif;
                        font-size: 14px;
                        color: #000;
                        background: #fff;
                        margin: 0;
                        padding: 5px;
                        width: 300px;
                        box-sizing: border-box;
                        ${watermarkCSS}
                    }
                    ${invoiceData.isCanceled ? `body::after {
                        content: "ملغـــاة";
                        position: absolute;
                        top: 30%;
                        left: 15%;
                        font-size: 50px;
                        font-weight: bold;
                        color: rgba(0,0,0,0.15);
                        transform: rotate(-45deg);
                        pointer-events: none;
                    }` : ''}
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 2px dashed #000; padding-bottom: 5px; }
                    .header h2 { margin: 0; font-size: 18px; font-weight: bold; }
                    .header p { margin: 3px 0; font-size: 12px; }
                    .details { margin-bottom: 10px; font-size: 13px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    th, td { padding: 4px 0; text-align: right; border-bottom: 1px dotted #000; }
                    th { font-size: 13px; font-weight: bold; border-bottom: 2px dashed #000; }
                    .totals { border-top: 2px dashed #000; padding-top: 5px; text-align: left; font-size: 14px; font-weight: bold; }
                    .balance-box { border: 1px solid #000; padding: 5px; margin-top: 10px; text-align: right; font-size: 13px; font-weight: bold; }
                    .footer { text-align: center; font-size: 13px; margin-top: 15px; border-top: 2px dashed #000; padding-top: 10px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>${safe(storeName)}</h2>
                    ${storePhone ? `<p>ت: ${safe(storePhone)}</p>` : ''}
                    <p>${receiptTitle}</p>
                </div>
                
                <div class="details">
                    <div>رقم: ${safe(invoiceData.invoiceNo || '')}</div>
                    <div>التاريخ: ${safe(invoiceData.date || new Date().toLocaleDateString('ar-EG'))}</div>
                    <div>العميل: ${safe(invoiceData.customerName || 'نقدي')}</div>
                </div>

                <table>
                    <thead>
                        <tr><th>الصنف</th><th style="text-align:center;">كمية</th><th style="text-align:left;">إجمالي</th></tr>
                    </thead>
                    <tbody>
        `;

        if (invoiceData.items && invoiceData.items.length > 0) {
            invoiceData.items.forEach(item => {
                let totalRow = item.total || (item.qty * item.price);
                receiptHTML += `<tr><td>${safe(item.name || 'صنف')}</td><td style="text-align:center;">${safe(item.qty || 1)}</td><td style="text-align:left;">${money(totalRow)}</td></tr>`;
            });
        }

        receiptHTML += `
                    </tbody>
                </table>
                <div class="totals">
                    <div>الإجمالي: ${money(invoiceData.totalAmount)}</div>
                    ${invoiceData.discount > 0 ? `<div>الخصم: ${money(invoiceData.discount)}</div>` : ''}
                    <div>المدفوع: ${money(invoiceData.paid)}</div>
                    <div>المتبقي: ${money(invoiceData.remaining)}</div>
                </div>
        `;

        let isCashCustomer = (!invoiceData.customerName || invoiceData.customerName === 'نقدي');
        if (showBalance === 'yes' && !isCashCustomer && invoiceData.documentType !== 'quotation' && !invoiceData.isCanceled) {
            let prevBal = invoiceData.customerPreviousBalance || 0;
            let currentRem = invoiceData.remaining || 0;
            let finalBal = Number(prevBal) + Number(currentRem);
            
            receiptHTML += `<div class="balance-box"><div>رصيد سابق: ${money(prevBal)}</div><div>إجمالي الحساب: ${money(finalBal)}</div></div>`;
        }

        receiptHTML += `<div class="footer"><div>${safe(footerMsg)}</div></div></body></html>`;

        if (connType === 'bluetooth') {
            try {
                let encodedHTML = btoa(unescape(encodeURIComponent(receiptHTML)));
                window.location.href = `intent:${encodedHTML}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
            } catch (err) {
                console.error("خطأ تشفير البلوتوث:", err);
                alert("تعذر الاتصال بتطبيق RawBT.");
            }
        } else {
            const printFrame = document.createElement('iframe');
            printFrame.style.display = 'none';
            document.body.appendChild(printFrame);
            printFrame.contentDocument.write(receiptHTML);
            printFrame.contentDocument.close();

            printFrame.onload = function() {
                try {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.onafterprint = () => document.body.removeChild(printFrame);
                    printFrame.contentWindow.print();
                } catch (e) {
                    console.error("خطأ طباعة:", e);
                    setTimeout(() => { if (document.body.contains(printFrame)) document.body.removeChild(printFrame); }, 5000); 
                }
            };
        }
    },

    // ==========================================
    // 📊 دوال كشف الحساب الموحدة (عميل / مورد)
    // ==========================================

    /**
     * 📄 الدالة الخامسة: تصدير كشف الحساب إلى PDF
     */
    exportStatementToPDF: function(person, durationText, tableBodyId, isSupplier = false) {
        if (typeof showLoading === 'function') showLoading("جاري تجهيز الـ PDF...");

        let tableRows = document.querySelectorAll('#' + tableBodyId + ' tr');
        let rowsHtml = '';
        let statementTitle = isSupplier ? 'كشف حساب مورد' : 'كشف حساب عميل';

        tableRows.forEach(tr => {
            let cells = tr.querySelectorAll('td');

            if (cells.length === 1) {
                rowsHtml += `<tr class="pdf-row-white"><td colspan="4" style="text-align: center; font-weight:bold; color: #000;">${cells[0].innerText.trim()}</td></tr>`;
            } else if (cells.length === 4) {
                let titleText = cells[0].querySelector('div:first-child') ? cells[0].querySelector('div:first-child').innerText.trim() : cells[0].innerText.split('\n')[0].trim();
                let dateText = cells[0].querySelector('div:nth-child(2)') ? cells[0].querySelector('div:nth-child(2)').innerText.trim() : '';
                let notesHtml = cells[1].innerText.trim();
                let aleihVal = cells[2].innerText.trim();
                let lehVal = cells[3].innerText.trim();

                rowsHtml += `
                <tr class="pdf-row-white">
                    <td style="text-align: right; width: 35%; color: #000;"><strong>${titleText}</strong><br><span style="font-size:12px; color:#555 !important;">${dateText}</span></td>
                    <td style="text-align: center; font-size: 13px; width: 35%; color: #000;">${notesHtml}</td>
                    <td style="text-align: center; font-weight: bold; font-size: 15px; width: 15%; color: #ff1a40 !important;">${aleihVal}</td>
                    <td style="text-align: center; font-weight: bold; font-size: 15px; width: 15%; color: #00aa00 !important;">${lehVal}</td>
                </tr>`;
            } else if (cells.length === 3) {
                let titleText = cells[0].innerText.trim();
                let aleihVal = cells[1].innerText.trim();
                let lehVal = cells[2].innerText.trim();

                rowsHtml += `
                <tr class="pdf-row-gray">
                    <td colspan="2" style="text-align: right; font-weight: bold; color: #000;">${titleText}</td>
                    <td style="text-align: center; font-weight: bold; font-size: 15px; color: #ff1a40 !important;">${aleihVal}</td>
                    <td style="text-align: center; font-weight: bold; font-size: 15px; color: #00aa00 !important;">${lehVal}</td>
                </tr>`;
            } else if (cells.length === 2) {
                let titleText = cells[0].innerText.trim();
                let netTextRaw = cells[1].innerText.trim();
                let finalColor = '#000000';
                if(netTextRaw.includes('عليه مديونية') || netTextRaw.includes('عليه')) finalColor = '#ff1a40';
                else if(netTextRaw.includes('له تسديد') || netTextRaw.includes('له')) finalColor = '#00aa00';

                rowsHtml += `
                <tr class="pdf-row-gray">
                    <td colspan="2" style="text-align: right; font-size: 16px; font-weight: bold; color: #000;">${titleText}</td>
                    <td colspan="2" style="text-align: center; font-size: 18px; font-weight: bold; color: ${finalColor} !important;">${netTextRaw}</td>
                </tr>`;
            }
        });

        let pdfContent = document.createElement('div');
        pdfContent.innerHTML = `
        <style>
            .pdf-wrapper { background: #ffffff !important; padding: 20px; font-family: Arial, sans-serif; direction: rtl; width: 100%; }
            .pdf-wrapper * { box-shadow: none !important; text-shadow: none !important; }
            .pdf-table { display: table !important; width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px; background-color: #fff !important; }
            .pdf-table thead { display: table-header-group !important; }
            .pdf-table tbody { display: table-row-group !important; }
            .pdf-table tr { display: table-row !important; page-break-inside: avoid !important; }
            .pdf-table th, .pdf-table td { display: table-cell !important; border: 2px solid #000 !important; padding: 10px !important; vertical-align: middle !important; }
            .pdf-table th { background-color: #e5e5e5 !important; font-weight: bold !important; font-size: 15px !important; color: #000 !important; }
            .pdf-row-gray td { background-color: #f3f4f6 !important; }
            .pdf-row-white td { background-color: #ffffff !important; }
            .pdf-header-box { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 15px; background: #fff !important; padding: 12px; border: 2px solid #000 !important; color: #000 !important; border-radius: 5px; }
        </style>

        <div class="pdf-wrapper">
            <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 32px; font-weight: bold; color: #000;">سراج كاشير</h1>
                <p style="margin: 5px 0 0 0; color: #000; font-size: 18px; font-weight: bold;">${statementTitle}</p>
            </div>
            <div class="pdf-header-box">
                <div>
                    <div style="margin-bottom: 8px;"><strong>الاسم:</strong> <span style="font-size: 18px; font-weight: bold;">${person.name}</span></div>
                    <div><strong>رقم الموبايل:</strong> <span dir="ltr">${person.phone || '---'}</span></div>
                </div>
                <div style="text-align: left;">
                    <div style="margin-bottom: 8px;"><strong>تاريخ الكشف:</strong> ${new Date().toISOString().split('T')[0]}</div>
                    <div><strong>الفترة الزمنية:</strong> ${durationText}</div>
                </div>
            </div>
            <table class="pdf-table">
                <thead>
                    <tr>
                        <th style="text-align: right; width: 35%;">البيان والتاريخ</th>
                        <th style="text-align: center; width: 35%;">الملاحظات</th>
                        <th style="width: 15%; color: #ff1a40 !important;">عليه (مديونية)</th>
                        <th style="width: 15%; color: #00aa00 !important;">له (تسديد)</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            <div style="text-align: center; margin-top: 30px; font-size: 14px; color: #000; border-top: 2px dashed #000; padding-top: 15px; font-weight:bold;">
                نظام إدارة الحسابات - سراج كاشير
            </div>
        </div>`;

        let fileName = 'Statement_' + person.name.replace(/\s+/g, '_');
        
        let opt = {
            margin: [15, 10, 15, 10],
            filename: fileName + '.pdf',
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(pdfContent).toPdf().get('pdf').then(function (pdf) {
                if (typeof hideLoading === 'function') hideLoading();
                let pdfBlob = pdf.output('blob');
                let file = new File([pdfBlob], opt.filename, { type: 'application/pdf' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: statementTitle + ' ' + person.name,
                        text: 'مرفق ' + statementTitle + ': ' + person.name
                    }).catch(err => {
                        window.open(URL.createObjectURL(pdfBlob), '_blank');
                    });
                } else {
                    window.open(URL.createObjectURL(pdfBlob), '_blank');
                }
            }).catch(err => {
                if (typeof hideLoading === 'function') hideLoading();
                console.error("خطأ في توليد PDF:", err);
            });
        } else {
            console.error("مكتبة html2pdf غير موجودة!");
            if (typeof hideLoading === 'function') hideLoading();
        }
    },

    /**
     * 📊 الدالة السادسة: تصدير كشف الحساب إلى Excel
     */
    exportStatementToExcel: function(person, durationText, tableBodyId, isSupplier = false) {
        if (typeof showLoading === 'function') showLoading("جاري تجهيز الإكسيل...");

        if (typeof XLSX === 'undefined') {
            console.error("مكتبة SheetJS (XLSX) غير متوفرة.");
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }

        let tableRows = document.querySelectorAll('#' + tableBodyId + ' tr');
        let statementTitle = isSupplier ? 'كشف حساب مورد' : 'كشف حساب عميل';
        
        let excelData = [];
        
        excelData.push(['سراج كاشير - ' + statementTitle]);
        excelData.push(['الاسم:', person.name, 'رقم الموبايل:', person.phone || '---']);
        excelData.push(['تاريخ الكشف:', new Date().toISOString().split('T')[0], 'الفترة الزمنية:', durationText]);
        excelData.push([]); 
        excelData.push(['البيان والتاريخ', 'الملاحظات', 'عليه (مديونية)', 'له (تسديد)']);

        tableRows.forEach(tr => {
            let cells = tr.querySelectorAll('td');

            if (cells.length === 1) {
                excelData.push([cells[0].innerText.trim(), '', '', '']); 
            } else if (cells.length === 4) {
                let titleText = cells[0].innerText.replace(/\n/g, ' - ').trim();
                let notes = cells[1].innerText.trim();
                let aleih = cells[2].innerText.trim();
                let leh = cells[3].innerText.trim();
                excelData.push([titleText, notes, aleih, leh]);
            } else if (cells.length === 3) {
                excelData.push([cells[0].innerText.trim(), '', cells[1].innerText.trim(), cells[2].innerText.trim()]); 
            } else if (cells.length === 2) {
                excelData.push([cells[0].innerText.trim(), '', cells[1].innerText.trim(), '']); 
            }
        });

        try {
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);
            
            if(!worksheet['!cols']) worksheet['!cols'] = [];
            worksheet['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
            worksheet['!dir'] = 'rtl';

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Statement");
            
            let fileName = 'Statement_' + person.name.replace(/\s+/g, '_') + '.xlsx';
            XLSX.writeFile(workbook, fileName);
            
        } catch (err) {
            console.error("خطأ أثناء بناء الإكسيل:", err);
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    }

};