import * as XLSX from "@e965/xlsx";
import {
  normalizeEmployeeCode,
  slugifyDepartmentKey,
  resolveExcelBusinessId,
  trangThaiLamViecFromExcelCell,
  hinhThucNghiViecFromExcelCell,
} from "./employeeRosterRecord";

function normalizeColKey(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function buildNormValueMap(row) {
  const m = {};
  for (const [k, v] of Object.entries(row)) {
    m[normalizeColKey(k)] = v;
  }
  return m;
}

function pick(m, ...aliases) {
  for (const a of aliases) {
    const k = normalizeColKey(a);
    if (m[k] === undefined || m[k] === null) continue;
    const s = String(m[k]).trim();
    if (s !== "") return m[k];
  }
  return "";
}

function parseExcelDate(value, workbook) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value, {
      date1904: workbook?.Workbook?.WBProps?.date1904 || false,
    });
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const str = String(value).trim();
  if (!str) return "";
  const iso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }
  return str;
}

function pickSheet(workbook) {
  const names = workbook.SheetNames || [];
  const byEmployees = names.find(
    (n) => String(n).trim().toLowerCase() === "employees",
  );
  if (byEmployees) return workbook.Sheets[byEmployees];
  return workbook.Sheets[names[0]];
}

/**
 * Sheet employees (hoặc sheet đầu): hàng 1 = tiêu đề VN/EN, các hàng sau = dữ liệu.
 */
export function parseEmployeeRosterExcelArrayBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: false,
  });
  if (!workbook.SheetNames?.length) {
    throw new Error("excelNoSheet");
  }
  const sheet = pickSheet(workbook);
  if (!sheet) {
    throw new Error("excelNoSheet");
  }
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("excelEmpty");
  }

  const out = [];
  const warnings = [];

  rows.forEach((sheetRow, idx) => {
    const m = buildNormValueMap(sheetRow);
    const idCell = pick(m, "id", "employee_id", "employeeid");
    const mnvCell = pick(m, "mnv", "manv", "ma_nv", "ma_so_nv");
    const businessId = resolveExcelBusinessId(idCell, mnvCell);
    const hoVaTen = String(
      pick(
        m,
        "ho_va_ten",
        "hovaten",
        "ho_ten",
        "ten",
        "name",
        "fullname",
      ) ?? "",
    ).trim();
    const departmentRaw = String(
      pick(
        m,
        "department",
        "bo_phan",
        "bophan",
        "bp",
        "dept",
        "phong_ban",
      ) ?? "",
    ).trim();

    if (!businessId && !hoVaTen && !departmentRaw) {
      return;
    }
    if (!businessId && (!hoVaTen || !departmentRaw)) {
      warnings.push(
        `Dòng ${idx + 2}: bỏ qua — thiếu MNV/id (PAVO+MNV): cần kèm tên + bộ phận, hoặc cột mnv/id.`,
      );
      return;
    }
    if (!businessId) {
      warnings.push(
        `Dòng ${idx + 2}: bỏ qua — thiếu MNV hoặc id đầy đủ PAVO….`,
      );
      return;
    }

    const chucVu = String(
      pick(m, "chuc_vu", "chucvu", "position", "title", "job") ?? "",
    ).trim();
    const joinRaw = pick(
      m,
      "ngay_vao_lam",
      "ngayvaolam",
      "joinDate",
      "join_date",
      "start_date",
    );
    const ngayVaoLam = parseExcelDate(joinRaw, workbook);
    const birthRaw = pick(
      m,
      "ngay_thang_nam_sinh",
      "ngaysinh",
      "ngay_sinh",
      "birth",
      "dob",
      "date_of_birth",
    );
    const ngayThangNamSinh = parseExcelDate(birthRaw, workbook);
    const trangThaiCell = pick(
      m,
      "trang_thai_lam_viec",
      "trangthailamviec",
      "trang_thai",
      "status",
    );
    const trangThaiLamViec =
      String(trangThaiCell ?? "").trim() === ""
        ? undefined
        : trangThaiLamViecFromExcelCell(trangThaiCell);
    const thaiSanTuRaw = pick(
      m,
      "thai_san_tu_ngay",
      "thaisantungay",
      "thai_san_tu",
      "maternity_from",
      "maternity_start",
    );
    const thaiSanDenRaw = pick(
      m,
      "thai_san_den_ngay",
      "thaisandenngay",
      "thai_san_den",
      "maternity_to",
      "maternity_end",
    );
    const thaiSanTuNgay =
      String(thaiSanTuRaw ?? "").trim() === ""
        ? undefined
        : parseExcelDate(thaiSanTuRaw, workbook);
    const thaiSanDenNgay =
      String(thaiSanDenRaw ?? "").trim() === ""
        ? undefined
        : parseExcelDate(thaiSanDenRaw, workbook);
    const leaveDateRaw = pick(
      m,
      "ngay_nghi_viec",
      "ngaynghiviec",
      "resignation_date",
      "ngay_thoi_viec",
      "ngay_roi_cong_ty",
    );
    const ngayNghiViec = parseExcelDate(leaveDateRaw, workbook);
    const hinhThucNghiViec = hinhThucNghiViecFromExcelCell(
      pick(
        m,
        "hinh_thuc_nghi_viec",
        "hinhthucnghiviec",
        "loai_nghi_viec",
        "resignation_type",
        "kieu_nghi_viec",
      ),
    );
    const sttRaw = pick(m, "stt", "no", "stt_", "ordinal");
    const sdt = String(pick(m, "sdt", "phone", "dien_thoai", "tel") ?? "").trim();
    const chuyenCan = String(
      pick(m, "chuyen_can", "chuyencan", "diligence") ?? "",
    ).trim();
    const phanQuyen = String(
      pick(m, "phan_quyen", "phanquyen", "perm", "permission") ?? "",
    ).trim();
    const emailDangNhap = String(
      pick(
        m,
        "email_dang_nhap",
        "emaildangnhap",
        "email",
        "email_login",
      ) ?? "",
    ).trim();

    const parsedRow = {
      businessId: normalizeEmployeeCode(businessId),
      hoVaTen,
      departmentRaw,
      chucVu,
      ngayVaoLam,
      ngayThangNamSinh,
      ngayNghiViec,
      hinhThucNghiViec,
      stt: sttRaw !== "" && sttRaw != null ? String(sttRaw).trim() : "",
      sdt,
      chuyenCan,
      phanQuyen,
      emailDangNhap,
    };
    if (trangThaiLamViec !== undefined)
      parsedRow.trangThaiLamViec = trangThaiLamViec;
    if (thaiSanTuNgay !== undefined) parsedRow.thaiSanTuNgay = thaiSanTuNgay;
    if (thaiSanDenNgay !== undefined)
      parsedRow.thaiSanDenNgay = thaiSanDenNgay;
    out.push(parsedRow);
  });

  return { rows: out, warnings };
}

/**
 * Resolve department key + display name for Firebase catalog & boPhan.
 */
export function resolveDepartmentFromCell(raw, catalog) {
  const cell = String(raw ?? "").trim();
  if (!cell) return null;
  const cat = catalog && typeof catalog === "object" ? catalog : {};
  if (cat[cell]) {
    return { key: cell, displayName: String(cat[cell].name ?? cell).trim() };
  }
  const lower = cell.toLowerCase();
  const hit = Object.entries(cat).find(
    ([k, v]) =>
      k.toLowerCase() === lower ||
      String(v?.name ?? "")
        .trim()
        .toLowerCase() === lower,
  );
  if (hit) {
    return { key: hit[0], displayName: String(hit[1].name ?? hit[0]).trim() };
  }
  const key = slugifyDepartmentKey(cell);
  return { key, displayName: cell };
}

export function downloadEmployeeRosterTemplateXlsx(filename = "mau_ds_nhan_vien.xlsx") {
  const helpAoa = [
    ["Hướng dẫn nhập Excel — Danh sách nhân viên"],
    [""],
    [
      "• Nhân viên MỚI: để TRỐNG cột id. Chỉ cần cột mnv (vd: 001, 12A). Hệ thống tự lưu id = PAVO + mnv (vd: PAVO001).",
    ],
    [
      "• CẬP NHẬT người đã có trên ngày đó: điền id đầy đủ (PAVO…) hoặc cùng mnv như đã lưu.",
    ],
    [
      "• Bắt buộc mỗi dòng: ho_va_ten (tên), department (bộ phận). Các cột khác tùy chọn.",
    ],
    [
      "• Thứ tự cột khuyến nghị: stt, mnv, id, ho_va_ten, ngay_thang_nam_sinh, department, chuc_vu, ngay_vao_lam, ngay_nghi_viec, hinh_thuc_nghi_viec, sdt, trang_thai_lam_viec, thai_san_tu_ngay, thai_san_den_ngay, chuyen_can, phan_quyen, email_dang_nhap.",
    ],
    [
      "• trang_thai_lam_viec: dang_lam | thu_viec | tam_nghi | thai_san | nghi_viec (hoặc active/probation/leave/maternity/inactive). Ô trống = giữ nguyên trạng thái đang lưu (không ghi đè).",
    ],
    [
      "• thai_san_tu_ngay / thai_san_den_ngay: khoảng nghỉ thai sản (YYYY-MM-DD). Ô trống = giữ ngày đang lưu.",
    ],
    [
      "• ngay_nghi_viec: ngày nghỉ việc (YYYY-MM-DD). hinh_thuc_nghi_viec: co_don (có đơn) | nghi_ngang (nghỉ ngang) — áp dụng khi nghỉ việc.",
    ],
    [""],
    ["Sheet «employees» là bảng dữ liệu — app đọc sheet này; xóa dòng mẫu hoặc sửa theo thực tế."],
  ];
  const wsHelp = XLSX.utils.aoa_to_sheet(helpAoa);
  const colWidthsHelp = [{ wch: 92 }];
  wsHelp["!cols"] = colWidthsHelp;

  const aoa = [
    [
      "stt",
      "mnv",
      "id",
      "ho_va_ten",
      "ngay_thang_nam_sinh",
      "department",
      "chuc_vu",
      "ngay_vao_lam",
      "ngay_nghi_viec",
      "hinh_thuc_nghi_viec",
      "sdt",
      "trang_thai_lam_viec",
      "thai_san_tu_ngay",
      "thai_san_den_ngay",
      "chuyen_can",
      "phan_quyen",
      "email_dang_nhap",
    ],
    [
      "1",
      "001",
      "",
      "Nguyen Van A",
      "1990-05-15",
      "Assembly",
      "Operator",
      "2025-01-01",
      "",
      "",
      "",
      "dang_lam",
      "",
      "",
      "",
      "",
      "",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsHelp, "Huong_dan");
  XLSX.utils.book_append_sheet(wb, ws, "employees");
  XLSX.writeFile(wb, filename);
}
