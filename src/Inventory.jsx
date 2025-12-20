import React, { useMemo, useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import ExportExcelButton from "./ExportExcelButton";

// Quarterly Inventory component
// - Quarter/year selector
// - Editable table matching your template
// - Export to Excel and Print
// - Bilingual headers per screenshot

const INV_HEADERS = [
  { key: "tag", label: "Tag #" },
  { key: "locationCode", label: "Location code\nVị trí để hàng" },
  { key: "locationName", label: "Location name\nTên vị trí để hàng" },
  { key: "type", label: "Type of inventory\nLoại hàng tồn kho" },
  { key: "erpCode", label: "ERP\nCode" },
  { key: "itemName", label: "Item name\nMục / Loại" },
  { key: "unit", label: "Unit\nĐơn vị tính" },
  { key: "qty", label: "Qty\nSố lượng" },
  { key: "remarks", label: "Remarks\nGhi chú" },
];

const ERP_MASTER = {
  ERP001: {
    locationCode: "LC01",
    locationName: "Kho thành phẩm",
    type: "Thành phẩm",
    itemName: "Khung nhôm",
    unit: "PCS",
  },
  ERP002: {
    locationCode: "LC02",
    locationName: "Kho NVL",
    type: "Nguyên vật liệu",
    itemName: "Nhôm tấm",
    unit: "KG",
  },
};

function Inventory() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(
    Math.ceil((new Date().getMonth() + 1) / 3)
  );
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [bulkCount, setBulkCount] = useState(5);
  const [printOpen, setPrintOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [uploadStatus, setUploadStatus] = useState("");
  const [firebaseUrl, setFirebaseUrl] = useState("");
  const tableRef = useRef(null);
  const [erpMaster, setErpMaster] = useState(() => {
    try {
      const stored = localStorage.getItem("erpMaster");
      if (stored) return JSON.parse(stored);
    } catch {}
    return ERP_MASTER;
  });

  useEffect(() => {
    if (!rows.length) {
      setRows([
        {
          id: crypto.randomUUID(),
          tag: "",
          locationCode: "",
          locationName: "",
          type: "",
          erpCode: "",
          itemName: "",
          unit: "",
          qty: "",
          remarks: "",
        },
      ]);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [rows, search]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        tag: "",
        locationCode: "",
        locationName: "",
        type: "",
        erpCode: "",
        itemName: "",
        unit: "",
        qty: "",
        remarks: "",
      },
    ]);
  };
  const addRows = (count) => {
    const n = Math.max(1, Math.min(200, Number(count) || 0));
    const newRows = Array.from({ length: n }, () => ({
      id: crypto.randomUUID(),
      tag: "",
      locationCode: "",
      locationName: "",
      type: "",
      erpCode: "",
      itemName: "",
      unit: "",
      qty: "",
      remarks: "",
    }));
    setRows((prev) => [...prev, ...newRows]);
  };
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));
  const updateCell = (id, key, val) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, [key]: val };
        if (key === "erpCode") {
          const code = String(val || "").trim();
          const m = erpMaster && erpMaster[code];
          if (m) {
            next.locationCode = m.locationCode ?? next.locationCode;
            next.locationName = m.locationName ?? next.locationName;
            next.type = m.type ?? next.type;
            next.itemName = m.itemName ?? next.itemName;
            next.unit = m.unit ?? next.unit;
          }
        }
        return next;
      })
    );
  const clearAll = () => setRows([]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllFiltered = (checked) => {
    if (checked) {
      const ids = filtered.map((r) => r.id);
      setSelected(new Set(ids));
    } else {
      setSelected(new Set());
    }
  };
  const deleteSelected = () => {
    if (selected.size === 0) return;
    setRows((prev) => prev.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
  };

  const handleUploadErpMaster = async (file) => {
    if (!file) return;
    setUploadStatus("Đang đọc file...");
    try {
      const data = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsArrayBuffer(file);
      });
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const norm = (s) =>
        String(s || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      const map = {};
      json.forEach((row) => {
        const rowNorm = {};
        Object.entries(row).forEach(([k, v]) => {
          rowNorm[norm(k)] = v;
        });
        const getVal = (...keys) => {
          for (const k of keys) {
            if (rowNorm[k] !== undefined && rowNorm[k] !== "")
              return rowNorm[k];
          }
          return "";
        };
        const code = String(
          getVal("erp code", "erp", "code", "mã erp", "ma erp")
        ).trim();
        if (!code) return;
        map[code] = {
          locationCode: getVal(
            "location code",
            "vị trí để hàng",
            "vi tri de hang",
            "location"
          ),
          locationName: getVal(
            "location name",
            "tên vị trí để hàng",
            "ten vi tri de hang",
            "ten vi tri"
          ),
          type: getVal(
            "type of inventory",
            "loại hàng tồn kho",
            "loai hang ton kho",
            "type"
          ),
          itemName: getVal(
            "item name",
            "mục / loại",
            "muc / loai",
            "muc",
            "loai"
          ),
          unit: getVal("unit", "đơn vị tính", "don vi tinh"),
        };
      });
      if (Object.keys(map).length === 0) {
        setUploadStatus("❌ Không tìm thấy dữ liệu ERP hợp lệ trong file.");
        return;
      }
      localStorage.setItem("erpMaster", JSON.stringify(map));
      setErpMaster(map);
      setUploadStatus(`✅ Đã nạp ${Object.keys(map).length} mã ERP.`);
    } catch (err) {
      console.error(err);
      setUploadStatus("❌ Lỗi khi đọc file ERP.");
    }
  };

  const handleLoadErpFromUrl = async (url) => {
    const u = String(url || "").trim();
    if (!u) return;
    setUploadStatus("Đang tải từ Firebase URL...");
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const norm = (s) =>
        String(s || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      const map = {};
      json.forEach((row) => {
        const rowNorm = {};
        Object.entries(row).forEach(([k, v]) => {
          rowNorm[norm(k)] = v;
        });
        const getVal = (...keys) => {
          for (const k of keys) {
            if (rowNorm[k] !== undefined && rowNorm[k] !== "")
              return rowNorm[k];
          }
          return "";
        };
        const code = String(
          getVal("erp code", "erp", "code", "mã erp", "ma erp")
        ).trim();
        if (!code) return;
        map[code] = {
          locationCode: getVal(
            "location code",
            "vị trí để hàng",
            "vi tri de hang",
            "location"
          ),
          locationName: getVal(
            "location name",
            "tên vị trí để hàng",
            "ten vi tri de hang",
            "ten vi tri"
          ),
          type: getVal(
            "type of inventory",
            "loại hàng tồn kho",
            "loai hang ton kho",
            "type"
          ),
          itemName: getVal(
            "item name",
            "mục / loại",
            "muc / loai",
            "muc",
            "loai"
          ),
          unit: getVal("unit", "đơn vị tính", "don vi tinh"),
        };
      });
      if (Object.keys(map).length === 0) {
        setUploadStatus("❌ Không tìm thấy dữ liệu ERP hợp lệ trong file.");
        return;
      }
      localStorage.setItem("erpMaster", JSON.stringify(map));
      setErpMaster(map);
      setUploadStatus(`✅ Đã nạp ${Object.keys(map).length} mã ERP từ URL.`);
    } catch (err) {
      console.error(err);
      setUploadStatus("❌ Lỗi khi tải/đọc file từ URL.");
    }
  };

  const title = `Quý ${quarter}/${year} - Báo cáo kiểm kê`;

  // Print: open a clean window with minimal margins
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const headersHtml = INV_HEADERS.map(
      (h) =>
        `<th class=\"px-2 py-2 text-xs border bg-gray-300\">${h.label.replace(
          /\n/g,
          "<br/>"
        )}</th>`
    ).join("");
    const rowsHtml = filtered
      .map(
        (r, idx) => `
      <tr>
        <td class=\"px-2 py-1 text-xs border\">${r.tag || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.locationCode || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.locationName || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.type || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.erpCode || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.itemName || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.unit || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.qty || ""}</td>
        <td class=\"px-2 py-1 text-xs border\">${r.remarks || ""}</td>
      </tr>
    `
      )
      .join("");

    printWindow.document
      .write(`<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; }
        table { width: 100%; border-collapse: collapse; }
        th { font-weight: 700; }
        th, td { border: 1px solid #000; }
        .header { padding: 8mm; }
      </style>
    </head><body>
      <div class=\"header\">
        <h2 style=\"margin:0;\">${title}</h2>
      </div>
      <table>
        <thead><tr>${headersHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>window.print();</script>
    </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h1 className="text-xl font-bold text-gray-800">Báo cáo kiểm kê quý</h1>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={1}>Quý 1</option>
            <option value={2}>Quý 2</option>
            <option value={3}>Quý 3</option>
            <option value={4}>Quý 4</option>
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm w-24"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Tìm kiếm"
            className="border rounded px-2 py-1 text-sm w-48"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={200}
              value={bulkCount}
              onChange={(e) => setBulkCount(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm w-24"
            />
            <button
              onClick={() => addRows(bulkCount)}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm"
            >
              ➕ Thêm {bulkCount} dòng
            </button>
          </div>
          <label className="px-3 py-1.5 bg-yellow-600 text-white rounded text-sm cursor-pointer">
            ⬆️ Upload ERP master
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.xlsb"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadErpMaster(f);
                e.target.value = ""; // reset
              }}
            />
          </label>
          {uploadStatus && (
            <span className="text-xs text-gray-700">{uploadStatus}</span>
          )}
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={firebaseUrl}
              onChange={(e) => setFirebaseUrl(e.target.value)}
              placeholder="https://firebasestorage.googleapis.com/..."
              className="border rounded px-2 py-1 text-sm w-[360px]"
            />
            <button
              onClick={() => handleLoadErpFromUrl(firebaseUrl)}
              className="px-3 py-1.5 bg-yellow-700 text-white rounded text-sm"
            >
              🔗 Load ERP từ URL
            </button>
          </div>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className={`px-3 py-1.5 rounded text-sm ${
              selected.size === 0
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-red-600 text-white"
            }`}
          >
            🗑️ Xóa dòng đã chọn ({selected.size})
          </button>
          <button
            onClick={addRow}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
          >
            ➕ Thêm dòng
          </button>
          <button
            onClick={() => {
              if (window.confirm("Bạn có chắc muốn xóa tất cả dòng?")) {
                clearAll();
                setSelected(new Set());
              }
            }}
            className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm"
          >
            🗑️ Xóa hết
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm"
          >
            🖨️ In
          </button>
          {/* Hidden export button leveraged via ref class for dropdowns elsewhere */}
          <div className="hidden">
            <ExportExcelButton
              data={filtered}
              selectedDate={`${year}-Q${quarter}`}
              title="📥 Xuất Excel"
              className="inventory-export-btn"
              onSuccess={() => {}}
              onError={() => {}}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-[1150px] w-full border-collapse">
          <thead>
            <tr className="bg-gray-300">
              <th className="px-2 py-2 text-xs font-bold text-gray-800 border">
                <input
                  type="checkbox"
                  onChange={(e) => selectAllFiltered(e.target.checked)}
                  checked={
                    filtered.length > 0 &&
                    filtered.every((r) => selected.has(r.id))
                  }
                />
              </th>
              {INV_HEADERS.map((h) => (
                <th
                  key={h.key}
                  className="px-2 py-2 text-xs font-bold text-gray-800 border"
                >
                  {h.label.split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </th>
              ))}
              <th className="px-2 py-2 text-xs font-bold text-gray-800 border">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="odd:bg-gray-50">
                <td className="px-2 py-1 text-xs border text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                  />
                </td>
                {INV_HEADERS.map((h) => (
                  <td key={h.key} className="px-2 py-1 text-xs border">
                    <input
                      value={r[h.key] || ""}
                      onChange={(e) => updateCell(r.id, h.key, e.target.value)}
                      className="w-full border rounded px-1 py-1 text-xs"
                    />
                  </td>
                ))}
                <td className="px-2 py-1 text-xs border text-center">
                  <button
                    onClick={() => removeRow(r.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Inventory;
