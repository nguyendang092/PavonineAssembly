import { useRef, useState, useEffect } from "react";

export default function CertificateGenerator1() {
  const canvasRef = useRef(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [stt, setStt] = useState(0); // Số thứ tự bản tạo ra
  const backgroundRef = useRef(null);
  // Kích thước thực tế
  const baseWidth = 2480;
  const baseHeight = 3508;

  // Tăng độ nét canvas theo devicePixelRatio, font hỗ trợ tiếng Việt
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width = baseWidth * dpr;
    canvas.height = baseHeight * dpr;
    canvas.style.width = "100%";
    canvas.style.maxWidth = "700px";
    canvas.style.height = "auto";
    canvas.style.maxHeight = "80vh";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform trước khi scale
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const img = new Image();
    img.src = "/certificate2.png";
    img.onload = () => {
      backgroundRef.current = img;
      drawCertificate(name, dpr, stt);
    };
    // eslint-disable-next-line
  }, []);

  // Hàm viết hoa chữ cái đầu mỗi từ (kể cả tiếng Việt)
  function toTitleCase(str) {
    return str
      .toLowerCase()
      .replace(/(?:^|\s)([a-zà-ỹ])/g, (m) => m.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Hàm vẽ bằng khen
  const drawCertificate = (text, dpr = window.devicePixelRatio || 1, sttNum = 1) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform trước khi scale
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(backgroundRef.current, 0, 0, baseWidth, baseHeight);

    // Dòng quý và năm nằm trên tên người khen thưởng
    const nowSub = new Date();
    const month = nowSub.getMonth(); // 0-11
    const quarter = Math.floor(month / 3) + 1;
    const year = nowSub.getFullYear();
    const topText = `QUÝ ${quarter} NĂM ${year}`;
    ctx.font = `bold ${70 * dpr}px 'Arial', 'Cambria', 'serif'`;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(topText, baseWidth / 2, 1040);

    // Tên người được khen (dòng chính) - tự động giảm font nếu quá dài, viết hoa chữ cái đầu mỗi từ
    const displayName = toTitleCase(text);
    let nameFontSize = 190 * dpr;
    ctx.font = `bold ${nameFontSize}px 'TDF_cut-putroe-navisha-kyokm3', 'Arial', 'Times New Roman', 'serif'`;
    let maxNameWidth = baseWidth * 0.9; // chỉ chiếm 90% chiều rộng
    while (ctx.measureText(displayName).width > maxNameWidth && nameFontSize > 40 * dpr) {
      nameFontSize -= 4 * dpr;
      ctx.font = `bold ${nameFontSize}px 'TDF_cut-putroe-navisha-kyokm3', 'Arial', 'Times New Roman', 'serif'`;
    }
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayName, baseWidth / 2, 1450);

    // Bộ phận (nếu có) nằm dưới tên
    let offsetDept = 0;
    if (department && department.trim() !== "") {
      ctx.font = `italic ${75 * dpr}px 'Arial', 'Cambria', 'serif'`;
      ctx.fillStyle = "#222";
      ctx.fillText(`Bộ phận: ${department}`, baseWidth / 2, 1550 + 90);
      offsetDept = 90;
    }

    // Dòng phụ bên dưới tên (hoặc bộ phận)
    const offsetSub = 470; // nếu có bộ phận thì đẩy xuống thêm
    ctx.font = `${70 * dpr}px 'Cabin', 'serif'`;
    ctx.fillStyle = "#000";
    // Tự động lấy quý hiện tại và năm hiện tại
    const nowSub2 = new Date();
    const month2 = nowSub2.getMonth(); // 0-11
    const quarter2 = Math.floor(month2 / 3) + 1;
    const year2 = nowSub2.getFullYear();
    const subText = `nhân viên ưu tú quý ${quarter2} năm ${year2}.`;
    ctx.fillText(subText, baseWidth / 2, 1900 + offsetSub);

    // Ngày tháng năm bên trái dưới
    const dateFontSize = 50;   // chỉnh font size tại đây
    const paddingLeft = 1320;   // khoảng cách từ lề trái
    const paddingBottom = 840; // tăng khoảng cách từ đáy lên để chữ cao hơn

    ctx.font = `italic ${dateFontSize * dpr}px 'Arial', 'Times New Roman', 'serif'`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    // Luôn lấy ngày hiện tại khi vẽ, bất kể input
    const now = new Date();
    const d = now.getDate().toString().padStart(2, "0");
    const m = (now.getMonth() + 1).toString().padStart(2, "0");
    const y = now.getFullYear();
    const todayStr = `Ngày ${d} Tháng ${m} Năm ${y}`;
    ctx.fillText(`Phú Mỹ, ${todayStr}`, paddingLeft, baseHeight - paddingBottom);

    // Dòng số ký hiệu nằm giữa cạnh dưới cùng của bằng khen
    const soKyHieu = `SỐ: ${m}/${y}-${sttNum.toString().padStart(2, "0")}`;
    ctx.font = `bold ${55 * dpr}px 'Arial', 'Times New Roman', 'serif'`;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(soKyHieu, baseWidth / 2, baseHeight - 160);
  };

  const handleGenerate = () => {
    if (!name.trim()) {
      alert("Vui lòng nhập tên!");
      return;
    }
    setStt(prev => {
      const next = prev + 1;
      drawCertificate(name, window.devicePixelRatio || 1, next);
      return next;
    });
  };

  const handleDownload = () => {
    // Xử lý tên file: bỏ dấu, viết liền, lowercase, thay khoảng trắng bằng _
    function removeVietnameseTones(str) {
      return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    }
    let fileName = name.trim() ? name.trim() : 'bang-khen';
    fileName = removeVietnameseTones(fileName)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toLowerCase();
    if (!fileName) fileName = 'bang-khen';
    const link = document.createElement("a");
    link.download = `${fileName}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div style={{ display: "flex", height: "90vh", background: "#f7f7fa", borderRadius: 12, boxShadow: "0 2px 8px #0001", overflow: "hidden" }}>
      {/* Sidebar nhập liệu */}
      <div style={{ width: 340, background: "#fff", padding: 32, display: "flex", flexDirection: "column", alignItems: "center", borderRight: "1px solid #eee", boxShadow: "2px 0 8px #0001" }}>
        <h2 style={{ fontWeight: 700, fontSize: 30, marginBottom: 32, fontFamily: "Cambria, sans-serif",textTransform: "uppercase", letterSpacing: "2px" }}>Tạo Bằng Khen</h2>
        <input
          type="text"
          placeholder="Nhập tên người được khen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: "12px 16px", fontSize: 18, borderRadius: 8, border: "1px solid #ccc", marginBottom: 24, width: "100%" }}
        />
        <input
          type="text"
          placeholder="Nhập bộ phận"
          value={department}
          onChange={e => setDepartment(e.target.value)}
          style={{ padding: "12px 16px", fontSize: 16, borderRadius: 8, border: "1px solid #ccc", marginBottom: 24, width: "100%" }}
        />
        <button onClick={handleGenerate} style={{ marginBottom: 16, padding: "12px 0", width: "100%", fontWeight: 600, fontSize: 16, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Tạo
        </button>
        <button onClick={handleDownload} style={{ padding: "12px 0", width: "100%", fontWeight: 600, fontSize: 16, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Tải về
        </button>
      </div>
      {/* Preview bên phải */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7fa" }}>
        <canvas
          ref={canvasRef}
          style={{
            border: "1px solid #ccc",
            background: "#fff",
            width: "100%",
            maxWidth: 700,
            height: "auto",
            maxHeight: "80vh",
            boxShadow: "0 2px 8px #0002",
            display: "block"
          }}
        />
      </div>
    </div>
  );
}
