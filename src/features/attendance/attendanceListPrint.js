/**
 * In danh sách điểm danh / tăng ca — tách từ AttendanceList (logic giữ nguyên).
 */
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypePrintStyleAttrForEmployee,
} from "./attendanceGioVaoTypeOptions";

export function openAttendanceOvertimePrintWindow({ filteredEmployees, selectedDate, displayLocale }) {

    if (filteredEmployees.length === 0) { return { ok: false, reason: "empty" }; }

    const overtimeDate = new Date(selectedDate).toLocaleDateString(
      displayLocale,
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return { ok: false, reason: "blocked" };
    }

    let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Danh sách tăng ca - ${overtimeDate}</title>
  <style>
    @media print {
      @page {
        size: A4 portrait;
        margin: 1;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
      html {
        margin: 0 !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
    }
    
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    html {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 9pt;
      line-height: 1.2;
      color: #000;
      background: white;
      margin: 0;
      padding: 5mm;
      width: 100%;
      max-width: 210mm;
      box-sizing: border-box;
    }
    
    .header {
      text-align: center;
      margin-bottom: 8px;
      margin-left: auto;
      margin-right: auto;
    }
    
    .header h1 {
      color: #c41e3a;
      font-size: 12pt;
      font-weight: bold;
      margin: 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .header .date {
      font-size: 9pt;
      font-weight: bold;
      margin: 2px 0;
      color: #000;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 5px;
      font-size: 7pt;
      table-layout: fixed;
      margin-left: auto;
      margin-right: auto;
    }
    th {
    border: 1px solid #000;
      padding: 0px 10px;
      text-align: center;
      vertical-align: middle;
      color: #000;
      word-wrap: break-word;
      overflow-wrap: break-word;
      line-height: 1.05;
    }
    td {
    height: 18px;
    vertical-align: middle;
  line-height: 1.1;
      border: 1px solid #000;
      padding: 3px 5px;
      text-align: center;
      vertical-align: middle;
      color: #000;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    th {
      background-color: #b0b0b0;
      font-weight: bold;
      font-size: 6pt;
    }
    
    .name-col, .dept-col {
      text-align: left;
      padding-left: 5px;
    }
    
    tbody tr:nth-child(even) {
      background-color: #e8f4f8;
    }
    
    .footer {
      margin-top: 8px;
      display: flex;
      justify-content: space-around;
    }
    
    .signature {
      text-align: center;
      width: 30%;
    }
    
    .signature-title {
      font-weight: bold;
      margin-bottom: 20px;
      font-size: 8pt;
    }
    
    .print-button {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 20px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      z-index: 1000;
    }
    
    .close-button {
      position: fixed;
      top: 10px;
      right: 85px;
      padding: 10px 20px;
      background-color: #f44336;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      z-index: 1000;
    }
  </style>
</head>
<body>
   <button class="print-button no-print" onclick="window.print()">🖨️ In</button>
  <button class="close-button no-print" onclick="window.close()">✕ Đóng</button>
  
  <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 12px; max-width: 210mm; margin-left: auto; margin-right: auto;">
    <!-- Bên trái: Header + bảng nhỏ -->
    <div style="flex: 1;">
      <h1 style="color: #c41e3a; font-size: 12pt; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">ĐĂNG KÝ LÀM THÊM GIỜ</h1>
      <div style="font-size: 9pt; margin: 3px 0; color: #000;">OVERTIME REGISTRATION</div>
      <div style="font-size: 8pt; font-weight: bold; margin-top: 5px;">Ngày/Date: ${overtimeDate}</div>
    </div>
    
    <!-- Bên phải: Bảng Pavonine + thỏa thuận + nguyên tắc -->
    <div style="flex: 1;">
      <div style="border: 1.5px solid #000; padding: 5px; margin: 0 0 5px 0; background: #fff;">
        <h2 style="margin: 0 0 3px 0; font-size: 9pt; font-weight: bold; text-align: center;">PAVONINE VINA CO.,LTD</h2>
        <h3 style="margin: 0 0 2px 0; font-size: 8pt; font-weight: bold; text-align: center;">VĂN BẢN THỎA THUẬN CỦA NGƯỜI LAO ĐỘNG LÀM THÊM GIỜ</h3>
        <p style="margin: 0 0 3px 0; font-size: 7pt; text-align: center;">DAILY ATTENDANCE & AGREEMENT FOR LABOR TO WORK OVER TIME (OT)</p>
        
        <table style="font-size: 6.5pt; width: 100%;">
          <tr>
            <td colspan="3" style="text-align: center; font-weight: bold;">TRƯỚC KHI TĂNG CA/ BEFORE OT</td>
            <td colspan="3" style="text-align: center; font-weight: bold;">SAU TĂNG CA/ AFTER OT</td>
          </tr>
          <tr>
            <td>Người lập</td>
            <td>Kiểm tra</td>
            <td>Phê duyệt</td>
            <td>Người lập</td>
            <td>Kiểm tra</td>
            <td>Phê duyệt</td>
          </tr>
          <tr>
            <td style="height: 50px;">&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        </table>
      </div>
    </div>
  </div>
  
  <div style="border: 1.5px solid #000; padding: 5px; margin: 12px auto; background: #f9f9f9; max-width: 210mm;">
    <h4 style="margin: 0 0 4px 0; text-align: center; font-size: 8pt; font-weight: bold;">NGUYÊN TẮC THỎA THUẬN LÀM THÊM GIỜ</h4>
    <ol style="margin: 0; padding-left: 15px; font-size: 7pt; line-height: 1.3;">
      <li>Người lao động ký tên bên dưới là đăng ký làm thêm giờ hoàn toàn tự nguyện không ép buộc.</li>
      <li>Thời gian tăng ca phải được chính xác rõ ràng.</li>
      <li>Thời gian tăng ca không được vượt quá 04 giờ/ngày.</li>
      <li>Trường hợp đã đăng ký làm thêm giờ mà có việc đột xuất phải báo cáo quản lý.</li>
    </ol>
  </div>
  
  <table>
    <thead>
      <tr style="height: 30px;">
        <th style="width: 3%;">STT</th>
        <th style="width: 5%;">MNV</th>
        <th style="width: 20%;">Họ và tên</th>
        <th style="width: 7%;">Ngày bắt đầu</th>
        <th style="width: 5%;">Mã BP</th>
        <th style="width: 7%;">Bộ phận</th>
        <th style="width: 10%;">Thời gian tăng ca<br/>Từ …h đến …h</th>
        <th style="width: 7%;">Số giờ tăng ca</th>
        <th style="width: 9%;">Chữ ký NLĐ</th>
        <th style="width: 5%;">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
`;

    filteredEmployees.forEach((emp, idx) => {
      htmlContent += `
      <tr>
        <td>${idx + 1}</td>
        <td>${emp.mnv || ""}</td>
        <td class="name-col">${emp.hoVaTen || ""}</td>
        <td>${emp.ngayVaoLam || ""}</td>
        <td>${emp.maBoPhan || ""}</td>
        <td class="dept-col">${emp.boPhan || ""}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      `;
    });

    htmlContent += `
    </tbody>
  </table>
  <script>
    window.onload = function() {
      document.querySelector('.print-button').focus();
    };
  </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    return { ok: true };
}

export function openAttendanceListPrintWindow({ filteredEmployees, selectedDate, displayLocale }) {

    if (filteredEmployees.length === 0) { return { ok: false, reason: "empty" }; }

    const dateStr = new Date(selectedDate).toLocaleDateString(displayLocale);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return { ok: false, reason: "blocked" };
    }

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Danh sách chấm công - ${dateStr}</title>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 5mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      body { margin: 0; padding: 0; }
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 9pt;
      line-height: 1.25;
      color: #000;
      background: #fff;
      margin: 0 auto;
      padding: 6mm;
      width: 100%;
      max-width: 210mm;
      box-sizing: border-box;
    }
    .top-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .company-header { 
      display: flex; 
      align-items: flex-start;
      flex: 1;
    }
    .company-logo { 
      width: 70px; 
      height: auto; 
      margin-right: 12px;
      flex-shrink: 0;
    }
    .company-info { 
      flex: 1; 
      text-align: left;
    }
    .company-info .company-name { 
      font-size: 10pt; 
      font-weight: bold; 
      margin: 0 0 3px 0;
      color: #000;
    }
    .company-info .company-address { 
      font-size: 7.5pt; 
      margin: 1px 0;
      line-height: 1.2;
      font-style: italic;
    }
    .approval-table {
      width: 280px;
      border-collapse: collapse;
      font-size: 7pt;
      margin-left: 15px;
    }
    .approval-table th {
      border: 1px solid #000;
      padding: 6px 5px;
      text-align: center;
      font-weight: bold;
      background: #fff;
    }
    .approval-table td {
      border: 1px solid #000;
      padding: 15px 3px;
      text-align: center;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6.5pt;
      margin-bottom: 8px;
      table-layout: fixed;
    }
    .detail-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      text-align: left;
    }
    .detail-table .label-col {
      width: 8%;
      font-weight: bold;
    }
    .detail-table .value-col {
      width: 2%;
      text-align: center;
    }
    .detail-table .desc-col {
      width: 18%;
    }
    .red-text {
      color: #c41e3a;
      font-weight: bold;
      font-size: 8.5pt;
      margin: 6px 0;
    }
    .header { text-align: center; margin-bottom: 8px; margin-top: 5px; }
    .header h1 { margin: 0; font-size: 12pt; font-weight: bold; color: #000; letter-spacing: .3px; text-transform: uppercase; }
    .header .subtitle { font-size: 10pt; font-weight: bold; margin: 2px 0; }
    .header .date { margin-top: 3px; font-weight: bold; font-size: 9pt; }
    table.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7pt; border: 1px solid #000; }
    table.data-table th, table.data-table td { border: 1px dashed rgba(0,0,0,0.5); padding: 3px 2px; text-align: center; vertical-align: middle; }
    table.data-table th { background: #b0b0b0; font-weight: bold; }
    table.data-table .name { text-align: left; padding-left: 4px; }
    table.data-table .dept { text-align: left; padding-left: 4px; }
    table.data-table tbody tr:nth-child(even) { background: #e8f4f8; }
    .print-button { position: fixed; top: 10px; right: 10px; padding: 8px 14px; background: #2196F3; color: #fff; border: none; border-radius: 5px; font-size: 12px; font-weight: bold; cursor: pointer; z-index: 1000; }
    .close-button { position: fixed; top: 10px; right: 72px; padding: 8px 14px; background: #f44336; color: #fff; border: none; border-radius: 5px; font-size: 12px; font-weight: bold; cursor: pointer; z-index: 1000; }
  </style>
  <script>
    function doPrint(){ window.print(); }
    function doClose(){ window.close(); }
  </script>
  </head>
  <body>
    <button class="print-button no-print" onclick="doPrint()">🖨️ In</button>
    <button class="close-button no-print" onclick="doClose()">✕ Đóng</button>
    
    <div class="top-section">
      <div class="company-header">
        <img src="/picture/logo/logo.png" alt="Pavonine Logo" class="company-logo" onerror="this.style.display='none'">
        <div class="company-info">
          <div class="company-name">CÔNG TY TNHH PAVONINE VINA</div>
          <div class="company-address">Lots VII-1, VII-2, and part of Lot VII-3, My Xuan B1 – Tien Hung</div>
          <div class="company-address">Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam</div>
        </div>
      </div>
      
      <table class="approval-table">
        <tr>
          <th>Người lập /<br/>Prepared by</th>
          <th>Kiểm tra /<br/>Reviewed by</th>
          <th>Phê duyệt /<br/>Approved by</th>
        </tr>
        <tr>
          <td style="height: 40px;"></td>
          <td style="height: 40px;"></td>
          <td style="height: 40px;"></td>
        </tr>
      </table>
    </div>

    <table class="detail-table">
      <tr>
        <td class="label-col">Ca ngày</td>
        <td class="value-col">S1</td>
        <td class="desc-col">1.Phép năm/Annual Leave</td>
        <td class="value-col">PN</td>
        <td class="desc-col">6.Không Lương/Unpaid Leave</td>
        <td class="value-col">KL</td>
      </tr>
      <tr>
        <td class="label-col">Ca đêm</td>
        <td class="value-col">S2</td>
        <td class="desc-col">2.1/2 ngày phép năm/1/2 day annual Leave</td>
        <td class="value-col">1/2 PN</td>
        <td class="desc-col">7.Không phép/Illegal Leave</td>
        <td class="value-col">KP</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">3.Nghỉ TNLĐ/Labor accident</td>
        <td class="value-col">TN</td>
        <td class="desc-col">8.Nghỉ ốm/Sick Leave</td>
        <td class="value-col">PO</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">4.Phép cưới/Wedding Leave</td>
        <td class="value-col">PC</td>
        <td class="desc-col">9.Thai sản/Maternity</td>
        <td class="value-col">TS</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">5.Phép tang/Funeral Leave</td>
        <td class="value-col">PT</td>
        <td class="desc-col">10.Dưỡng sức/Recovery health</td>
        <td class="value-col">DS</td>
      </tr>
      <tr>
        <td class="label-col"></td>
        <td class="value-col"></td>
        <td class="desc-col"></td>
        <td class="value-col"></td>
        <td class="desc-col">11.Nghỉ việc/Resignation</td>
        <td class="value-col">NV</td>
      </tr>
    </table>
    
    <div class="header">
      <h1>DANH SÁCH NHÂN VIÊN HIỆN DIỆN</h1>
      <div class="subtitle">List of Active Employees</div>
      <div class="date">Ngày/Date: ${dateStr}</div>
    </div>

    <div class="red-text">Số lượng cơm ca trưa:</div>
    
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:4%">STT</th>
          <th style="width:7%">MNV</th>
          <th style="width:7%">MVT</th>
          <th style="width:25%">Họ và tên</th>
          <th style="width:8%">Giới tính</th>
          <th style="width:7%">Mã BP</th>
          <th style="width:10%">Bộ phận</th>
          <th style="width:8%">Thời gian vào</th>
          <th style="width:8%">Thời gian ra</th>
          <th style="width:8%">Loại phép</th>
          <th style="width:8%">Ca làm việc</th>
        </tr>
      </thead>
      <tbody>`;

    filteredEmployees.forEach((emp, idx) => {
      const gioiTinh = emp.gioiTinh || "";
      html += `
        <tr>
          <td>${emp.stt || idx + 1}</td>
          <td>${emp.mnv || ""}</td>
          <td>${emp.mvt || ""}</td>
          <td class="name">${emp.hoVaTen || ""}</td>
            <td>${gioiTinh}</td>
            <td>${emp.maBoPhan || ""}</td>
            <td class="dept">${emp.boPhan || ""}</td>
            <td style="${
              formatAttendanceTimeInColumnDisplay(emp.gioVao)
                ? "color:#15803d;font-weight:bold;"
                : ""
            }">${formatAttendanceTimeInColumnDisplay(emp.gioVao || "")}</td>
            <td>${emp.gioRa || ""}</td>
            <td style="${getAttendanceLeaveTypePrintStyleAttrForEmployee(emp)}">${formatAttendanceLeaveTypeColumnForEmployee(emp)}</td>
            <td>${emp.caLamViec || ""}</td>
        </tr>`;
    });

    html += `
      </tbody>
    </table>
    <script>
      window.onload = function(){ document.querySelector('.print-button').focus(); };
    <\/script>
  </body>
  </html>`;

    printWindow.document.write(html);
    printWindow.document.close();

    return { ok: true };
}
