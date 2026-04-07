import React, { useRef, useState, useEffect } from "react";
import AlertMessage from "./AlertMessage";
import QRCode from "qrcode";

function QRCodeGenerator() {
  const [qrValue, setQrValue] = useState("BN96-63323A DZ9M");
  const [qrSize, setQrSize] = useState(200);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [toast, setToast] = useState("");
  const ERROR_LEVEL = "H";
  const canvasRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Validate and fix hex color
  const validateHexColor = (color) => {
    // If empty, return default black
    if (!color) return "#000000";

    // Remove spaces
    color = color.trim();

    // If it doesn't start with #, add it
    if (!color.startsWith("#")) {
      color = "#" + color;
    }

    // Remove everything after # except hex chars
    const match = color.match(/#([0-9a-fA-F]*)/);
    if (!match || !match[1]) return "#000000";

    let hex = match[1].toUpperCase();

    // Handle shorthand (3 chars) and convert to full (6 chars)
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    // Ensure exactly 6 characters
    if (hex.length !== 6) {
      // Pad or truncate to 6
      hex = (hex + "000000").substring(0, 6);
    }

    return "#" + hex;
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!qrValue) {
      const ctx =
        canvasRef.current.getContext && canvasRef.current.getContext("2d");
      if (ctx)
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }

    const validFgColor = validateHexColor(fgColor);
    const validBgColor = validateHexColor(bgColor);

    QRCode.toCanvas(canvasRef.current, qrValue, {
      width: qrSize,
      margin: 2,
      color: { dark: validFgColor, light: validBgColor },
      errorCorrectionLevel: ERROR_LEVEL,
    }).catch((err) => console.error(err));
  }, [qrValue, qrSize, fgColor, bgColor]);

  const showToast = (msg = "", ms = 1800) => {
    setToast(msg);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    if (!msg) return;
    toastTimeoutRef.current = setTimeout(() => {
      setToast("");
      toastTimeoutRef.current = null;
    }, ms);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  const handleDownloadQR = async (format = "png") => {
    if (!canvasRef.current) return showToast("Không có QR để tải");
    try {
      const validFgColor = validateHexColor(fgColor);
      const validBgColor = validateHexColor(bgColor);

      if (format === "png") {
        const image = canvasRef.current.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `qrcode-${Date.now()}.png`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === "svg") {
        const svg = await QRCode.toString(qrValue, {
          width: qrSize,
          margin: 2,
          color: { dark: validFgColor, light: validBgColor },
          errorCorrectionLevel: ERROR_LEVEL,
          type: "image/svg+xml",
        });
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `qrcode-${Date.now()}.svg`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      showToast("Đã tải xuống");
    } catch (e) {
      console.error(e);
      showToast("Lỗi khi tải");
    }
  };

  const handlePrintQR = () => {
    if (!canvasRef.current) return showToast("Không có QR để in");
    try {
      const image = canvasRef.current.toDataURL("image/png");
      const w = window.open("", "_blank");
      if (!w) return showToast("Trình duyệt chặn popup");
      w.document.write(
        `<!doctype html><html><head><title>In QR</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}</style></head><body><img src="${image}" style="max-width:90%;height:auto" onload="window.print();setTimeout(()=>window.close(),200)"/></body></html>`,
      );
      w.document.close();
    } catch (e) {
      console.error(e);
      showToast("Lỗi in");
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrValue || "");
      showToast("Đã sao chép");
    } catch (e) {
      console.error(e);
      showToast("Không thể sao chép");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 px-4 py-8 dark:from-slate-950 dark:to-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-3xl">
              PAVONINE QR Code Creator
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tạo code xe dành cho bộ phận Assembly.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setQrValue("BN96-63323A DZ9M");
                showToast("Mẫu được đặt lại");
              }}
              className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              Mẫu nhanh
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Controls area (span 2 on large) */}
          <section className="rounded-2xl bg-white p-6 shadow dark:bg-slate-900 dark:ring-1 dark:ring-slate-700 lg:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nội dung
            </label>
            <textarea
              value={qrValue}
              onChange={(e) => setQrValue(e.target.value)}
              placeholder="Nhập URL, văn bản hoặc dữ liệu..."
              className="min-h-[140px] w-full resize-y rounded-lg border border-slate-200 p-4 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-500/40"
            />

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kích thước: <span className="font-semibold">{qrSize}px</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={qrSize}
                  onChange={(e) => setQrSize(Number(e.target.value))}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>50</span>
                  <span>200</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Màu
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Màu trước</div>
                    <div className="flex items-center">
                      <div className="flex items-center border rounded-md overflow-hidden w-full">
                        <input
                          type="color"
                          value={fgColor}
                          onChange={(e) =>
                            setFgColor(validateHexColor(e.target.value))
                          }
                          className="w-12 h-10 p-0 appearance-none border-0 bg-transparent"
                        />
                        <input
                          value={fgColor}
                          onChange={(e) =>
                            setFgColor(validateHexColor(e.target.value))
                          }
                          className="flex-1 px-3 py-2 h-10 border-0 font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Màu nền</div>
                    <div className="flex items-center">
                      <div className="flex items-center border rounded-md overflow-hidden w-full">
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) =>
                            setBgColor(validateHexColor(e.target.value))
                          }
                          className="w-12 h-10 p-0 appearance-none border-0 bg-transparent"
                        />
                        <input
                          value={bgColor}
                          onChange={(e) =>
                            setBgColor(validateHexColor(e.target.value))
                          }
                          className="flex-1 px-3 py-2 h-10 border-0 font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={copyToClipboard}
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white rounded-lg"
              >
                📋 Sao chép
              </button>
              <button
                onClick={() => handleDownloadQR("png")}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg"
              >
                ⬇ PNG
              </button>
              <button
                onClick={() => handleDownloadQR("svg")}
                className="w-full sm:w-auto px-4 py-2 bg-amber-500 text-white rounded-lg"
              >
                ⬇ SVG
              </button>
              <button
                onClick={handlePrintQR}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                🖨 In
              </button>
              <div className="ml-auto text-xs text-slate-500">
                Mã lỗi:{" "}
                <span className="font-medium text-slate-700">
                  {ERROR_LEVEL}
                </span>
              </div>
            </div>
          </section>

          {/* Preview sidebar */}
          <aside className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border bg-white flex items-center justify-center overflow-hidden p-0.5">
                  <div
                    className="w-full h-full rounded-full"
                    style={{ background: fgColor }}
                  />
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Màu QR
                </span>
                <div className="w-6 h-6 rounded-full border bg-white flex items-center justify-center ml-3 overflow-hidden p-0.5">
                  <div
                    className="w-full h-full rounded-full"
                    style={{ background: bgColor }}
                  />
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Nền
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {qrValue ? "Preview" : "Trống"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <div
                style={{
                  width: Math.min(qrSize, 320),
                  height: Math.min(qrSize, 320),
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            </div>

            <div className="w-full rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <div className="truncate font-mono text-xs">
                {qrValue || "Chưa có nội dung"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {qrSize} x {qrSize}px
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-6">
          <AlertMessage
            alert={{
              show: Boolean(toast),
              type: "info",
              message: toast,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default QRCodeGenerator;
