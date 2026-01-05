import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import { db } from '../../services/firebase';
import { ref, set, get } from "firebase/database";

// Định nghĩa mapping giữa tên cột Excel và key trong code
const COLUMN_MAP = {
  Line: "Line",
  "Công đoạn": "Công đoạn",
  "Phân Loại": "Phân Loại",
  Tháng: "Tháng",
  Năm: "Năm",
  "Khung giờ": "Khung giờ",
  "Sản lượng": "Sản lượng",
  "Sản lượng NG": "Sản lượng NG",
  "% Hiệu suất": "% Hiệu suất",
  Lỗi: "Lỗi",
};

function Metandeco() {
  const { t } = useTranslation();
  const location = useLocation();
  // Map route key to line name
  const lineKeyToName = {
    ap5mdff: "AP5 MD FF",
    ap5mdfz: "AP5 MD FZ",
    ap5mdfl: "AP5 MD FL",
    ap5ff: "AP5FF",
    ap5fz: "AP5FZ",
  };
  // Extract last segment from path
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  const selectedLine = lineKeyToName[lastSegment] || null;
  const [data, setData] = useState([]);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCongDoan, setFilterCongDoan] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const dbRef = ref(db, "AP5");
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          const rows = [];
          const ap5Obj = snapshot.val();
          Object.entries(ap5Obj).forEach(([ap5Value, arenas]) => {
            Object.entries(arenas).forEach(([congDoan, thangObj]) => {
              Object.entries(thangObj).forEach(([phanLoai, thangObj2]) => {
                Object.entries(thangObj2).forEach(([thang, namObj]) => {
                  Object.entries(namObj).forEach(([nam, khungGioObj]) => {
                    Object.entries(khungGioObj).forEach(
                      ([khungGio, payload]) => {
                        let loiObj =
                          payload["Lỗi"] && typeof payload["Lỗi"] === "object"
                            ? payload["Lỗi"]
                            : {};
                        // Đảm bảo luôn có trường 'Tháng Năm' cho cả dữ liệu cũ và mới
                        const thangNam =
                          payload["Tháng Năm"] || `${thang}/${nam}`;
                        rows.push({
                          [COLUMN_MAP["Line"]]: ap5Value,
                          [COLUMN_MAP["Công đoạn"]]: congDoan,
                          [COLUMN_MAP["Phân Loại"]]: phanLoai,
                          [COLUMN_MAP["Tháng"]]: thang,
                          [COLUMN_MAP["Năm"]]: nam,
                          [COLUMN_MAP["Khung giờ"]]: khungGio,
                          [COLUMN_MAP["Sản lượng"]]: payload["Sản lượng"] || 0,
                          [COLUMN_MAP["Sản lượng NG"]]:
                            payload["Sản lượng NG"] || 0,
                          [COLUMN_MAP["% Hiệu suất"]]:
                            payload["% Hiệu suất"] || "0%",
                          [COLUMN_MAP["Lỗi"]]: loiObj,
                          "Tháng Năm": thangNam,
                        });
                      }
                    );
                  });
                });
              });
            });
          });
          setData(rows);
        }
      } catch (err) {
        console.error("Lỗi fetch data:", err);
      }
    };
    fetchData();
  }, []);

  // Handle Excel file upload
  // Hàm chuẩn hóa key lỗi cho Firebase
  function normalizeKey(key) {
    return String(key)
      .replace(/[.#$\/[\]\n\r\t]+/g, "") // loại bỏ ký tự cấm và xuống dòng/tab
      .replace(/\s+/g, " ") // thay nhiều khoảng trắng bằng 1 dấu cách
      .trim();
  }

  // Hàm lấy tháng/năm từ cột Ngày
  function getMonthYear(ngay) {
    if (!ngay) return { thang: "Unknown", nam: "Unknown" };
    // Nếu là số (Excel date), chuyển sang chuỗi ngày
    if (typeof ngay === "number") {
      const date = XLSX.SSF.parse_date_code(ngay);
      if (date) return { thang: String(date.m), nam: String(date.y) };
    }
    // Nếu là chuỗi
    const parts = String(ngay).split("/");
    if (parts.length === 3) return { thang: parts[0], nam: parts[2] };
    return { thang: "Unknown", nam: "Unknown" };
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      // Xác định các cột cố định
      const fixedCols = [
        "Ngày",
        "Khung giờ",
        "Công đoạn",
        "Phân Loại",
        "Line",
        "Sản lượng",
      ];
      // Tìm các cột lỗi động (tất cả cột không thuộc fixedCols)
      const allKeys = rawData.length > 0 ? Object.keys(rawData[0]) : [];
      const errorKeys = allKeys.filter((k) => !fixedCols.includes(k));
      const jsonData = rawData.map((row) => {
        const newRow = {};
        // Map các cột cố định
        Object.entries(COLUMN_MAP).forEach(([excelKey, codeKey]) => {
          newRow[codeKey] = row[excelKey];
        });
        // Nếu thiếu Tháng/Năm thì lấy từ cột Ngày
        if (!newRow["Tháng"] || !newRow["Năm"]) {
          const { thang, nam } = getMonthYear(row["Ngày"]);
          newRow["Tháng"] = newRow["Tháng"] || thang;
          newRow["Năm"] = newRow["Năm"] || nam;
        }
        // Gom các cột lỗi động thành object 'Lỗi'
        const loiObj = {};
        errorKeys.forEach((k) => {
          const safeKey = normalizeKey(k);
          loiObj[safeKey] =
            row[k] !== undefined && row[k] !== "" ? Number(row[k]) : 0;
        });
        newRow["Lỗi"] = loiObj;
        // Xóa các key lỗi động dư thừa khỏi newRow
        errorKeys.forEach((k) => {
          delete newRow[k];
        });
        // Thêm trường Ngày nếu có
        if (row["Ngày"]) newRow["Ngày"] = row["Ngày"];
        return newRow;
      });
      setData(jsonData);
    };
    reader.readAsBinaryString(file);
  };

  // Upload to Firebase
  const uploadToFirebase = async () => {
    try {
      for (const row of data) {
        const line = row[COLUMN_MAP["Line"]] || "Unknown";
        const congDoan = row[COLUMN_MAP["Công đoạn"]] || "Unknown";
        const phanLoai = row[COLUMN_MAP["Phân Loại"]] || "Unknown";
        const thang = row[COLUMN_MAP["Tháng"]] || "Unknown";
        const nam = row[COLUMN_MAP["Năm"]] || "Unknown";
        const khungGio = row[COLUMN_MAP["Khung giờ"]] || "Unknown";

        const loiPayload = row[COLUMN_MAP["Lỗi"]] || {};
        const sanLuongNG = Object.values(loiPayload).reduce(
          (sum, val) => sum + val,
          0
        );
        const sanLuong = Number(row[COLUMN_MAP["Sản lượng"]] || 0);
        const total = sanLuong + sanLuongNG;
        const hieuSuat =
          total > 0 ? ((sanLuong / total) * 100).toFixed(2) + "%" : "0%";

        const payload = {
          "Sản lượng": sanLuong,
          "Sản lượng NG": sanLuongNG,
          "% Hiệu suất": hieuSuat,
          Lỗi: loiPayload,
          "Tháng Năm": `${thang}/${nam}`,
          Ngày: row["Ngày"] || "",
        };

        const dataRef = ref(
          db,
          `AP5/${line}/${congDoan}/${phanLoai}/${thang}/${nam}/${khungGio}/`
        );
        await set(dataRef, payload);
      }
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2500);
    } catch (err) {
      console.error("Lỗi upload:", err);
    }
  };

  // Static and dynamic keys
  // Các cột hiển thị cố định, dễ chỉnh sửa
  const staticKeys = [
    COLUMN_MAP["Line"],
    COLUMN_MAP["Công đoạn"],
    COLUMN_MAP["Phân Loại"],
    COLUMN_MAP["Tháng"],
    COLUMN_MAP["Năm"],
    COLUMN_MAP["Khung giờ"],
    COLUMN_MAP["Sản lượng"],
    COLUMN_MAP["Sản lượng NG"],
    COLUMN_MAP["% Hiệu suất"],
  ];
  const allLoiKeys = Array.from(
    data.reduce((set, row) => {
      if (row.Lỗi && typeof row.Lỗi === "object") {
        Object.keys(row.Lỗi).forEach((k) => set.add(k));
      }
      return set;
    }, new Set())
  );
  // Chuẩn hóa key lỗi khi tổng hợp dynamic keys
  const monthOptions = Array.from(
    new Set(data.map((row) => row["Tháng Năm"]).filter(Boolean))
  );
  const congDoanOptions = Array.from(
    new Set(data.map((row) => row[COLUMN_MAP["Công đoạn"]]).filter(Boolean))
  );
  const filteredData = data.filter((row) => {
    const matchLine = selectedLine
      ? row[COLUMN_MAP["Line"]] === selectedLine
      : true;
    return (
      matchLine &&
      (!filterMonth || row["Tháng Năm"] === filterMonth) &&
      (!filterCongDoan || row[COLUMN_MAP["Công đoạn"]] === filterCongDoan)
    );
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 280,
          background: "#000000cb",
          color: "#fff",
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          boxShadow: "2px 0 16px 0 rgba(30,41,59,0.08)",
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          minHeight: "100vh",
        }}
      >
        <h2
          style={{
            fontWeight: 700,
            fontSize: 22,
            marginBottom: 32,
            letterSpacing: 1,
          }}
        >
          {t("metandeco.dashboardTitle")}
        </h2>
        {/* Bộ lọc Tháng Năm */}
        <label
          style={{
            marginBottom: 6,
            fontWeight: 500,
            fontSize: 15,
            marginTop: 8,
          }}
        >
          {t("metandeco.filterMonth")}
        </label>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          style={{
            marginBottom: 14,
            width: "100%",
            padding: 7,
            borderRadius: 7,
            fontSize: 15,
            border: "none",
            color: "#1e293b",
          }}
        >
          <option value="">Tất cả</option>
          {monthOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {/* Bộ lọc Công đoạn */}
        <label style={{ marginBottom: 6, fontWeight: 500, fontSize: 15 }}>
          {t("metandeco.filterCongDoan")}
        </label>
        <select
          value={filterCongDoan}
          onChange={(e) => setFilterCongDoan(e.target.value)}
          style={{
            marginBottom: 18,
            width: "100%",
            padding: 7,
            borderRadius: 7,
            fontSize: 15,
            border: "none",
            color: "#1e293b",
          }}
        >
          <option value="">Tất cả</option>
          {congDoanOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }}></div>
        {/* Upload file và nút upload đặt dưới cùng sidebar */}
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.10)",
            borderRadius: 16,
            padding: "18px 16px 14px 16px",
            boxShadow: "0 2px 12px 0 rgba(30,41,59,0.10)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 0,
          }}
        >
          <label
            htmlFor="excel-upload"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              fontSize: 15,
              color: "#fff",
              marginBottom: 10,
              letterSpacing: 0.5,
              cursor: "pointer",
              userSelect: "none",
              borderRadius: 8,
              padding: "6px 12px",
              background: "linear-gradient(90deg, #64748b 0%, #1e293b 100%)",
              boxShadow: "0 1px 4px 0 rgba(30,41,59,0.10)",
            }}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
              <rect width="20" height="20" rx="4" fill="#0ea5e9" />
              <path
                d="M6.5 10.5l2.5 2.5 4.5-4.5"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("metandeco.chooseFile")}
          </label>
          <input
            id="excel-upload"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={uploadToFirebase}
            style={{
              background: "linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 0",
              width: "100%",
              fontWeight: 700,
              fontSize: 16,
              boxShadow: "0 2px 8px 0 rgba(30,41,59,0.13)",
              cursor: "pointer",
              marginTop: 8,
              marginBottom: 0,
              letterSpacing: 0.5,
              transition: "background 0.2s, box-shadow 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(90deg, #2563eb 0%, #0ea5e9 100%)";
              e.currentTarget.style.boxShadow =
                "0 4px 16px 0 rgba(30,41,59,0.18)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background =
                "linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px 0 rgba(30,41,59,0.13)";
            }}
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <svg
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 20 20"
                style={{ marginRight: 2 }}
              >
                <path
                  d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect x="3" y="15" width="14" height="2" rx="1" fill="#fff" />
              </svg>
              {t("metandeco.upload")}
            </span>
          </button>
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 16 }}>
          © {new Date().getFullYear()} PavoAssembly
        </div>
      </div>
      {/* Main content */}
      <div style={{ flex: 1, padding: "36px 32px 32px 32px" }}>
        {uploadSuccess && (
          <div
            style={{
              background: "#22c55e",
              color: "#fff",
              padding: 12,
              borderRadius: 8,
              marginBottom: 18,
              fontWeight: 600,
              fontSize: 16,
              textAlign: "center",
              boxShadow: "0 2px 8px 0 rgba(34,197,94,0.10)",
            }}
          >
            {t("metandeco.uploadSuccess")}
          </div>
        )}
        {/* Nút xuất Excel mới */}
        <button
          onClick={() => {
            if (!filteredData.length) return;
            // Lấy tất cả các key lỗi xuất hiện trong filteredData
            const allLoiKeys = Array.from(
              filteredData.reduce((set, row) => {
                if (row.Lỗi && typeof row.Lỗi === "object") {
                  Object.keys(row.Lỗi).forEach((k) => set.add(k));
                }
                return set;
              }, new Set())
            );
            // Tạo dữ liệu xuất với các cột lỗi riêng biệt
            const exportData = filteredData.map((row) => {
              const base = { ...row };
              // Xóa object Lỗi, thay bằng từng cột lỗi
              delete base.Lỗi;
              delete base["Tháng Năm"];
              allLoiKeys.forEach((loiKey) => {
                base[loiKey] =
                  row.Lỗi && row.Lỗi[loiKey] !== undefined
                    ? row.Lỗi[loiKey]
                    : 0;
              });
              return base;
            });
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ExportedData");
            XLSX.writeFile(wb, `Pavonine_AP5_${Date.now()}.xlsx`);
          }}
          style={{
            background: "linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "5px 12px",
            fontWeight: 600,
            fontSize: 13,
            boxShadow: "0 1px 4px 0 rgba(30,41,59,0.10)",
            cursor: "pointer",
            marginBottom: 8,
            marginRight: 6,
            float: "right",
            minWidth: 0,
            height: 32,
            lineHeight: "20px",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <svg
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 20 20"
            style={{ marginRight: 3 }}
          >
            <rect width="16" height="16" rx="3" fill="#0ea5e9" />
            <path
              d="M7 10l5 5m0 0l5-5m-5 5V4"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ whiteSpace: "nowrap" }}>Xuất Excel</span>
        </button>
        {filteredData.length > 0 && (
          <div
            style={{
              marginBottom: 24,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                fontSize: 12,
                tableLayout: "fixed",
                textTransform: "uppercase",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#232e3e",
                    color: "#e0e7ef",
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  <th style={{ padding: 2, width: 40 }}>
                    {t("metandeco.line")}
                  </th>
                  <th style={{ padding: 2, width: 40 }}>
                    {t("metandeco.congDoan")}
                  </th>
                  <th style={{ padding: 2, width: 40 }}>
                    {t("metandeco.phanLoai")}
                  </th>
                  <th style={{ padding: 2, width: 20 }}>
                    {t("metandeco.thang")}
                  </th>
                  <th style={{ padding: 2, width: 20 }}>
                    {t("metandeco.nam")}
                  </th>
                  <th style={{ padding: 2, width: 80 }}>
                    {t("metandeco.khungGio")}
                  </th>
                  <th style={{ padding: 2, width: 40 }}>
                    {t("metandeco.sanLuong")}
                  </th>
                  <th style={{ padding: 2, width: 40 }}>
                    {t("metandeco.hieuSuat")}
                  </th>
                  {allLoiKeys.map((loi) => (
                    <th
                      key={loi}
                      style={{
                        padding: 1,
                        background: "#232e3e",
                        color: "#e0e7ef",
                        whiteSpace: "pre-line",
                        fontSize: 10,
                        lineHeight: 1.3,
                        width: 25,
                        wordBreak: "break-word",
                        height: 38,
                        verticalAlign: "middle",
                        textTransform: "uppercase",
                      }}
                    >
                      {loi}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Hiển thị từng nhóm công đoạn và tổng kết ngay dưới */}
                {(() => {
                  // Gom dữ liệu theo từng cặp (Line, Công đoạn)
                  const lineCongDoanGroups = {};
                  filteredData.forEach((row) => {
                    const line = row[COLUMN_MAP["Line"]] || "";
                    const congDoan = row[COLUMN_MAP["Công đoạn"]] || "";
                    const key = `${line}__${congDoan}`;
                    if (!lineCongDoanGroups[key])
                      lineCongDoanGroups[key] = { line, congDoan, rows: [] };
                    lineCongDoanGroups[key].rows.push(row);
                  });
                  // Sử dụng flatMap để trả về mảng phẳng các phần tử React
                  return Object.values(lineCongDoanGroups).flatMap((group) => {
                    const { line, congDoan, rows } = group;
                    const rowEls = rows.map((row, idx) => {
                      const phanLoai = row[COLUMN_MAP["Phân Loại"]] || "";
                      const thang = row[COLUMN_MAP["Tháng"]] || "";
                      const nam = row[COLUMN_MAP["Năm"]] || "";
                      const khungGio = row[COLUMN_MAP["Khung giờ"]] || "";
                      return (
                        <tr
                          key={line + "-" + congDoan + "-" + idx}
                          style={{
                            background: idx % 2 === 0 ? "#e2e8f0" : "#f1f5f9",
                          }}
                        >
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 80,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {line}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 80,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {congDoan}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 80,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {phanLoai}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 40,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {thang}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 70,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {nam}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 120,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {khungGio}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 40,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {row["Sản lượng"]}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "center",
                              width: 80,
                              color: "#111827",
                              fontWeight: 700,
                            }}
                          >
                            {row["% Hiệu suất"]}
                          </td>
                          {allLoiKeys.map((loi) => (
                            <td
                              key={loi}
                              style={{
                                padding: 6,
                                textAlign: "center",
                                background:
                                  idx % 2 === 0 ? "#e2e8f0" : "#f1f5f9",
                                color: "#111827",
                                fontWeight: 700,
                                width: 60,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {row.Lỗi && row.Lỗi[loi] !== undefined
                                ? row.Lỗi[loi]
                                : 0}
                            </td>
                          ))}
                        </tr>
                      );
                    });
                    // Tổng kết ngay dưới nhóm (Line, Công đoạn)
                    const sumRow = (
                      <tr
                        key={"sum-" + line + "-" + congDoan}
                        style={{
                          background: "#232e3e",
                          color: "#e0e7ef",
                          fontWeight: 700,
                        }}
                      >
                        <td
                          style={{ textAlign: "right", padding: 6 }}
                          colSpan={1}
                        >
                          {t("metandeco.total")}
                        </td>
                        <td
                          style={{ textAlign: "center", padding: 6 }}
                          colSpan={1}
                        >
                          {congDoan}
                        </td>
                        <td
                          style={{ textAlign: "center", padding: 6 }}
                          colSpan={1}
                        >
                          {(() => {
                            const unique = Array.from(
                              new Set(
                                rows
                                  .map((r) => r[COLUMN_MAP["Phân Loại"]])
                                  .filter(Boolean)
                              )
                            );
                            if (unique.length === 1) return unique[0];
                            if (unique.length > 1) return "Tất cả";
                            return "";
                          })()}
                        </td>
                        <td
                          colSpan={3}
                          style={{ textAlign: "right", padding: 6 }}
                        ></td>
                        <td
                          style={{
                            padding: 6,
                            textAlign: "center",
                            color: "#e0e7ef",
                          }}
                        >
                          {rows.reduce(
                            (sum, r) => sum + Number(r["Sản lượng"] || 0),
                            0
                          )}
                        </td>
                        <td
                          style={{
                            padding: 6,
                            textAlign: "center",
                            color: "#e0e7ef",
                          }}
                        >
                          {(() => {
                            const valid = rows
                              .map((r) =>
                                parseFloat(
                                  (r["% Hiệu suất"] || "").replace("%", "")
                                )
                              )
                              .filter((v) => !isNaN(v));
                            return valid.length
                              ? (
                                  valid.reduce((a, b) => a + b, 0) /
                                  valid.length
                                ).toFixed(2) + "%"
                              : "-";
                          })()}
                        </td>
                        {allLoiKeys.map((loi) => (
                          <td
                            key={loi}
                            style={{
                              padding: 6,
                              textAlign: "center",
                              background: "#232e3e",
                              color: "#e0e7ef",
                            }}
                          >
                            {rows.reduce(
                              (sum, r) =>
                                r.Lỗi && r.Lỗi[loi]
                                  ? sum + Number(r.Lỗi[loi])
                                  : sum,
                              0
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                    return [...rowEls, sumRow];
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
export default Metandeco;
