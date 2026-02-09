import React, { useRef, useState, useEffect } from "react";
import QRCode from "qrcode";

function QRCodeGenerator() {
  const [qrValue, setQrValue] = useState("BN96-63323A DZ9M");
  const [qrSize, setQrSize] = useState(280);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [toast, setToast] = useState("");
  const ERROR_LEVEL = "H";
  const canvasRef = useRef();

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!qrValue) {
      const ctx =
        canvasRef.current.getContext && canvasRef.current.getContext("2d");
      if (ctx)
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      return;
    }

    QRCode.toCanvas(canvasRef.current, qrValue, {
      width: qrSize,
      margin: 2,
      color: { dark: fgColor, light: bgColor },
      errorCorrectionLevel: ERROR_LEVEL,
    }).catch((err) => console.error(err));
  }, [qrValue, qrSize, fgColor, bgColor]);

  const showToast = (msg = "", ms = 1800) => {
    setToast(msg);
    if (!msg) return;
    setTimeout(() => setToast(""), ms);
  };

  const handleDownloadQR = async (format = "png") => {
    if (!canvasRef.current) return showToast("Không có QR để tải");
    try {
      if (format === "png") {
        const image = canvasRef.current.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `qrcode-${Date.now()}.png`;
        link.click();
      } else if (format === "svg") {
        const svg = await QRCode.toString(qrValue, {
          width: qrSize,
          margin: 2,
          color: { dark: fgColor, light: bgColor },
          errorCorrectionLevel: ERROR_LEVEL,
          type: "image/svg+xml",
        });
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `qrcode-${Date.now()}.svg`;
        link.click();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              PAVONINE QR Code Creator
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Tạo tem code dành cho bộ phận Assembly
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setQrValue("BN96-63323A DZ9M");
                showToast("Mẫu được đặt lại");
              }}
              className="px-3 py-2 text-sm bg-white border rounded-lg shadow-sm"
            >
              Mẫu nhanh
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Controls area (span 2 on large) */}
          <section className="lg:col-span-2 bg-white rounded-2xl shadow p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nội dung
            </label>
            <textarea
              value={qrValue}
              onChange={(e) => setQrValue(e.target.value)}
              placeholder="Nhập URL, văn bản hoặc dữ liệu..."
              className="w-full min-h-[140px] p-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-200 font-mono text-sm resize-vertical"
            />

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
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
                <label className="text-sm font-medium text-slate-700">
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
                          onChange={(e) => setFgColor(e.target.value)}
                          className="w-12 h-10 p-0 appearance-none border-0 bg-transparent"
                        />
                        <input
                          value={fgColor}
                          onChange={(e) => setFgColor(e.target.value)}
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
                          onChange={(e) => setBgColor(e.target.value)}
                          className="w-12 h-10 p-0 appearance-none border-0 bg-transparent"
                        />
                        <input
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
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
          <aside className="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border bg-white flex items-center justify-center overflow-hidden p-0.5">
                  <div
                    className="w-full h-full rounded-full"
                    style={{ background: fgColor }}
                  />
                </div>
                <span className="text-sm text-slate-600">Màu QR</span>
                <div className="w-6 h-6 rounded-full border bg-white flex items-center justify-center ml-3 overflow-hidden p-0.5">
                  <div
                    className="w-full h-full rounded-full"
                    style={{ background: bgColor }}
                  />
                </div>
                <span className="text-sm text-slate-600">Nền</span>
              </div>
              <div className="text-xs text-slate-400">
                {qrValue ? "Preview" : "Trống"}
              </div>
            </div>

            <div className="rounded-xl bg-white p-4 border border-slate-100">
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

            <div className="w-full text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
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
          {toast && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm shadow">
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QRCodeGenerator;
