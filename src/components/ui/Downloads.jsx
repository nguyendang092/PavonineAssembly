import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { db, ref, onValue, update, set } from "@/services/firebase";

const Downloads = () => {
  const { t } = useTranslation();

  // Icon URL mặc định theo loại file
  const typeIconMap = {
    psd: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='18' fill='%231f6feb'/%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='42' font-weight='700' fill='white'%3EPS%3C/text%3E%3C/svg%3E",
  };

  // Danh sách tài liệu - URL trỏ đến thư mục public/downloads/
  const [files] = useState(
    [
      {
        name: "Mẫu thông báo kiểm kê",
        description: "Form mẫu dùng để thông báo kiểm kê hàng hóa hàng tháng",
        size: "13 KB",
        type: "Excel",
        icon: "📗",
        url: "/downloads/PAVONINE_FormThongBaoKiemKe_202511.xlsx",
      },
      {
        name: "Mẫu báo cáo hàng tiêu hao",
        description: "Form mẫu dùng để làm phê duyệt trừ tiêu hao mỗi tháng",
        size: "12 KB",
        type: "Excel",
        icon: "📗",
        url: "/downloads/PAVONINE_MauBaoCaoHangTieuHao.xlsx",
      },
      {
        name: "Mẫu báo cáo kiểm kê tồn kho theo quý",
        description: "Form mẫu dùng để báo cáo kiểm kê tồn kho theo quý",
        size: "499 KB",
        type: "Excel",
        icon: "📗",
        url: "/downloads/PAVONINE_Inventory Statement_122025.xlsx",
      },
      {
        name: "Mẫu giấy khen bản nằm ngang",
        description:
          "Form mẫu giấy khen cho nhân viên (bản nằm ngang) photoshop CS6",
        size: "12,252 KB",
        type: "PSD",
        url: "/downloads/PAVONINE_CertificateLandscape.psd",
      },
      {
        name: "Mẫu giấy khen bản nằm dọc",
        description:
          "Form mẫu giấy khen cho nhân viên (bản nằm dọc) photoshop CS6",
        size: "12,861 KB",
        type: "PSD",
        url: "/downloads/PAVONINE_CertificatePortrait.psd",
      },
      {
        name: "Mẫu giấy khen NVUTN & NVUT",
        description:
          "Form mẫu giấy khen cho nhân viên ưu tú nhất & nhân viên ưu tú photoshop CS6",
        size: "39,657 KB",
        type: "PSD",
        url: "/downloads/PAVONINE_Merit.psd",
      },
      {
        name: "Mẫu label cho vua đề án & hiệu quả cải tiến",
        description:
          "Form mẫu label cho vua đề án & hiệu quả cải tiến photoshop CS6",
        size: "53,527 KB",
        type: "PSD",
        url: "/downloads/PAVONINE_LabelCertificate_v2.psd",
      },
      {
        name: "Mẫu lael nhân viên ưu tú nhất & nhân viên ưu tú",
        description:
          "Form mẫu label cho nhân viên ưu tú nhất & nhân viên ưu tú photoshop CS6",
        size: "52,148 KB",
        type: "PSD",
        url: "/downloads/PAVONINE_LabelFull.psd",
      },
      {
        name: "Mẫu upload kế hoạch sản xuất mỗi tuần",
        description:
          "Form mẫu để upload kế hoạch sản xuất mỗi tuần để gửi cho bên Sales",
        size: "603 KB",
        type: "Excel",
        icon: "📗",
        url: "/downloads/PAVONINE_SamSungPlanUploadWeek.xlsx",
      },
      {
        name: "Mẫu file tổng hợp kiểm kê hàng tháng",
        description: "Form mẫu để tổng hợp kiểm kê hàng tháng",
        size: "24,260 KB",
        type: "Excel",
        icon: "📗",
        url: "/downloads/2025.11월말 재고실사_v3.xlsb",
      },
    ].map((file, index) => ({
      ...file,
      id: index + 1, // Tự động gán id từ 1 đến số lượng file
    }))
  );

  // State để đếm lượt tải xuống từ Firebase
  const [downloadCounts, setDownloadCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");

  // Load dữ liệu từ Firebase khi component mount
  useEffect(() => {
    const downloadsRef = ref(db, "downloads/stats");

    // Kiểm tra nếu chưa có dữ liệu, khởi tạo với 0
    onValue(downloadsRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Nếu chưa có dữ liệu, khởi tạo
        const initialCounts = {};
        files.forEach((file) => {
          initialCounts[file.id] = 0;
        });
        set(downloadsRef, initialCounts);
        setDownloadCounts(initialCounts);
      } else {
        // Nếu có dữ liệu, load lên
        const data = snapshot.val();
        setDownloadCounts(data);
      }
    });
  }, [files]);

  const handleDownload = async (file) => {
    try {
      // Lấy tên file từ URL (phần sau dấu "/" cuối cùng)
      const fileName = file.url.split("/").pop();

      // Fetch file và tạo blob để tải xuống
      const response = await fetch(file.url);
      const blob = await response.blob();

      // Tạo URL từ blob
      const blobUrl = window.URL.createObjectURL(blob);

      // Tạo link download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Giải phóng blob URL
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Lỗi tải file:", error);
      alert("Không thể tải file. Vui lòng thử lại!");
    }

    // Cập nhật lượt tải xuống vào Firebase
    const newCount = (downloadCounts[file.id] || 0) + 1;
    const downloadsRef = ref(db, `downloads/stats/${file.id}`);
    set(downloadsRef, newCount);
  };

  // Tính tổng lượt tải xuống
  const totalDownloads = Object.values(downloadCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  // Lọc file theo tìm kiếm và loại
  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      selectedType === "" ||
      file.type.toLowerCase() === selectedType.toLowerCase();
    return matchesSearch && matchesType;
  });

  // Sắp xếp ưu tiên Excel lên trên
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    const aExcel = a.type.toLowerCase() === "excel" ? 1 : 0;
    const bExcel = b.type.toLowerCase() === "excel" ? 1 : 0;
    if (aExcel !== bExcel) return bExcel - aExcel; // Excel trước
    return a.name.localeCompare(b.name); // sau đó theo tên
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">
              📥
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Tài liệu & Biểu mẫu
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Tài liệu, biểu mẫu và hướng dẫn sử dụng
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Tìm kiếm tài liệu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition"
            >
              <option value="">Tất cả loại file</option>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="psd">PSD</option>
            </select>
          </div>
        </div>

        {/* Files Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedFiles.length > 0 ? (
            sortedFiles.map((file) => {
              const resolvedIconUrl =
                file.iconUrl || typeIconMap[file.type?.toLowerCase?.()] || null;
              return (
                <div
                  key={file.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group h-full flex flex-col"
                >
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-center">
                    {resolvedIconUrl ? (
                      <img
                        src={resolvedIconUrl}
                        alt={`${file.type} icon`}
                        className="h-14 mx-auto mb-2 drop-shadow-md transform group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="text-6xl mb-2 transform group-hover:scale-110 transition-transform duration-300">
                        {file.icon}
                      </div>
                    )}
                    <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-semibold">
                      {file.type}
                    </span>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 uppercase">
                      {file.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {file.description}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs text-gray-500 font-medium">
                        📦 {file.size}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => handleDownload(file)}
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <span>⬇️</span>
                        <span>Tải xuống</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-lg text-gray-600 font-semibold mb-2">
                Không tìm thấy tài liệu
              </p>
              <p className="text-sm text-gray-500">
                Hãy thử thay đổi từ khóa hoặc bộ lọc
              </p>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {files.length}
              </div>
              <div className="text-sm text-gray-600">Tổng tài liệu</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {totalDownloads}
              </div>
              <div className="text-sm text-gray-600">Lượt tải xuống</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-pink-600 mb-1">
                {files
                  .reduce((acc, file) => {
                    // Chuyển đổi size thành MB
                    const sizeText = file.size.toLowerCase();
                    let sizeInMB = 0;

                    if (sizeText.includes("kb")) {
                      // KB -> MB
                      sizeInMB = parseFloat(sizeText) / 1024;
                    } else if (sizeText.includes("mb")) {
                      // MB
                      sizeInMB = parseFloat(sizeText);
                    } else if (sizeText.includes("gb")) {
                      // GB -> MB
                      sizeInMB = parseFloat(sizeText) * 1024;
                    }

                    return acc + sizeInMB;
                  }, 0)
                  .toFixed(2)}{" "}
                MB
              </div>
              <div className="text-sm text-gray-600">Tổng dung lượng</div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div>
              <h3 className="font-bold text-lg mb-2">Lưu ý</h3>
              <p className="text-sm text-blue-50">
                - Tất cả tài liệu đều được cập nhật thường xuyên
                <br />
                - Vui lòng kiểm tra phiên bản mới nhất trước khi sử dụng
                <br />- Liên hệ bộ phận IT nếu cần hỗ trợ
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Downloads;
