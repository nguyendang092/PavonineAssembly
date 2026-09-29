import * as XLSX from "@e965/xlsx";

/** Đúng thứ tự / tên cột file kiểm kê gốc. */
export const WAREHOUSE_INVENTORY_TEMPLATE_HEADERS = [
  "Month",
  "No.",
  "구분",
  "WAREHOUSE",
  "ITEM",
  "SPEC",
  "MODEL",
  "UNIT",
  "창고(Mã kh)",
  "STATUS",
  "CODE",
  "THỰC TẾ",
  "LYDO",
  "전산수량",
  "현재고량",
  "Gap",
  "Gap(ABS)",
  "Check",
  "CHECK IN",
  "2차확인",
  "실사구분(실사)",
  "단가",
  "재고금액",
  "재고금액(실사)",
  "재고금액(ERP)",
];

export const WAREHOUSE_INVENTORY_TEMPLATE_SAMPLE_ROW = [
  "03-2026",
  1,
  "원자재",
  "Raw Material",
  "SAMPLE-ITEM",
  "SPEC-01",
  "MODEL-A",
  "EA",
  "WH010",
  "hàng tồn",
  "SAMPLE-001",
  10,
  "",
  10,
  10,
  0,
  0,
  "",
  "TRUE",
  "",
  "실사",
  1000,
  10000,
  10000,
  10000,
];

export function downloadWarehouseInventoryTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    WAREHOUSE_INVENTORY_TEMPLATE_HEADERS,
    WAREHOUSE_INVENTORY_TEMPLATE_SAMPLE_ROW,
  ]);
  ws["!cols"] = WAREHOUSE_INVENTORY_TEMPLATE_HEADERS.map((h) => ({
    wch: Math.max(12, String(h).length + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "KIEMKE");
  XLSX.writeFile(wb, "KIEMKE_Template.xlsx");
}
