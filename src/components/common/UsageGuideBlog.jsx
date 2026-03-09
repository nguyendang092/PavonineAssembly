import React, { useEffect, useMemo, useState } from "react";
import { db, onValue, ref } from "../../services/firebase";
import { useTranslation } from "react-i18next";
import "./UsageGuideBlog.css";

const GUIDE_NODE = "usageGuides";

const sanitizeRichText = (html = "") => {
  if (!html) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((node) => {
    node.remove();
  });
  return doc.body.innerHTML;
};

export default function UsageGuideBlog() {
  const { t } = useTranslation();
  const [guides, setGuides] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("usageGuideDarkMode") === "true",
  );
  const [activeTab, setActiveTab] = useState("feature");

  useEffect(() => {
    const guidesRef = ref(db, GUIDE_NODE);
    const unsubscribe = onValue(guidesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, guide]) => ({
          id,
          ...guide,
        }));
        setGuides(arr);
      } else {
        setGuides([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("usageGuideDarkMode", darkMode);
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const filteredAndSorted = useMemo(() => {
    let result = guides.filter((guide) => {
      const query = searchQuery.toLowerCase();
      return (
        guide.menuName.toLowerCase().includes(query) ||
        guide.featureDescription?.toLowerCase().includes(query) ||
        guide.usageGuide?.toLowerCase().includes(query)
      );
    });

    if (sortBy === "name") {
      result.sort((a, b) =>
        (a.menuName || "").localeCompare(b.menuName || "", "vi"),
      );
    } else if (sortBy === "latest") {
      result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else if (sortBy === "oldest") {
      result.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    }

    return result;
  }, [guides, searchQuery, sortBy]);

  return (
    <div
      className={`min-h-[calc(100vh-140px)] transition-colors duration-300 ${
        darkMode
          ? "bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950"
          : "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50"
      } p-4 md:p-6`}
      style={
        !darkMode
          ? {
              backgroundImage:
                "linear-gradient(135deg, #eff6ff 0%, #faf5ff 50%, #fce7f3 100%)",
            }
          : {}
      }
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h1
              className={`mb-2 text-3xl font-bold transition-colors duration-200 md:text-4xl ${
                darkMode ? "text-white" : "text-slate-800"
              }`}
            >
              📖 Hướng dẫn Sử dụng
            </h1>
            <p
              className={`text-base transition-colors duration-200 md:text-lg ${
                darkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Khám phá cách sử dụng từng tính năng một cách chi tiết
            </p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`rounded-full p-3 transition-all duration-200 hover:scale-110 ${
              darkMode
                ? "bg-slate-700 text-yellow-400 hover:bg-slate-600"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
            title="Chuyển đổi chế độ tối"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Search & Filter */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative sm:col-span-1">
            <input
              type="text"
              placeholder="🔍 Tìm kiếm..."
              className={`w-full rounded-xl border-2 px-4 py-3 text-sm outline-none transition-all duration-200 ${
                darkMode
                  ? "border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  : "border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="sm:col-span-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`w-full rounded-xl border-2 px-4 py-3 text-sm outline-none transition-all duration-200 ${
                darkMode
                  ? "border-slate-600 bg-slate-700 text-white focus:border-blue-500"
                  : "border-slate-300 bg-white text-slate-900 focus:border-blue-500"
              }`}
            >
              <option value="name">📅 Sắp xếp theo tên</option>
              <option value="latest">🆕 Mới nhất</option>
              <option value="oldest">📦 Cũ nhất</option>
            </select>
          </div>
          <div
            className={`flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-200 sm:col-span-2 lg:col-span-1 ${
              darkMode
                ? "bg-slate-700 text-slate-200"
                : "bg-white text-slate-700 shadow-sm"
            }`}
          >
            📌 {filteredAndSorted.length} mục
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Sidebar - List */}
          <aside
            className={`space-y-2 rounded-2xl p-4 transition-colors duration-200 ${
              darkMode
                ? "bg-slate-800/50 backdrop-blur-sm"
                : "bg-white/50 backdrop-blur-sm shadow-lg"
            } lg:max-h-[70vh] lg:overflow-y-auto`}
          >
            <h3
              className={`mb-4 px-2 font-semibold transition-colors duration-200 ${
                darkMode ? "text-slate-200" : "text-slate-800"
              }`}
            >
              Các mục
            </h3>
            {filteredAndSorted.length > 0 ? (
              filteredAndSorted.map((guide, idx) => (
                <button
                  key={guide.id}
                  onClick={() => {
                    setSelectedGuide(guide);
                    setActiveTab("feature");
                  }}
                  className={`group relative block w-full overflow-hidden rounded-lg border-2 px-4 py-3 text-left transition-all duration-200 ${
                    selectedGuide?.id === guide.id
                      ? darkMode
                        ? "border-blue-500 bg-blue-950 shadow-lg shadow-blue-500/20"
                        : "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20"
                      : darkMode
                        ? "border-slate-600 bg-slate-700 hover:border-blue-400 hover:shadow-md"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`font-semibold transition-colors duration-200 ${
                      darkMode ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {idx + 1}. {guide.menuName}
                  </div>
                  {guide.path && (
                    <div
                      className={`truncate text-xs transition-colors duration-200 ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {guide.path}
                    </div>
                  )}
                  {guide.updatedAt && (
                    <div
                      className={`mt-1 text-xs transition-colors duration-200 ${
                        darkMode ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      📅 {new Date(guide.updatedAt).toLocaleDateString("vi-VN")}
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div
                className={`rounded-lg px-4 py-6 text-center text-sm transition-colors duration-200 ${
                  darkMode
                    ? "bg-slate-700 text-slate-400"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Không tìm thấy hướng dẫn nào
              </div>
            )}
          </aside>

          {/* Main - Detail */}
          <section>
            {selectedGuide ? (
              <div
                className={`space-y-6 rounded-2xl p-6 transition-all duration-300 md:p-8 ${
                  darkMode
                    ? "border border-slate-700 bg-slate-800/50 shadow-2xl shadow-black/50 backdrop-blur-sm"
                    : "bg-white shadow-2xl"
                }`}
              >
                {/* Title */}
                <div className="space-y-2 border-b border-slate-300 pb-6 dark:border-slate-600">
                  <h2
                    className={`text-2xl font-bold transition-colors duration-200 md:text-3xl ${
                      darkMode ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {selectedGuide.menuName}
                  </h2>
                  {selectedGuide.path && (
                    <p
                      className={`text-sm transition-colors duration-200 ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      🔗 Đường dẫn:{" "}
                      <code
                        className={`rounded px-2 py-1 transition-colors duration-200 ${
                          darkMode
                            ? "bg-slate-900 text-blue-300"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {selectedGuide.path}
                      </code>
                    </p>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 border-b border-slate-300 dark:border-slate-600">
                  {[
                    {
                      id: "feature",
                      label: "⚙️ Chức năng",
                      show: selectedGuide.featureDescription,
                    },
                    {
                      id: "usage",
                      label: "📝 Hướng dẫn",
                      show: selectedGuide.usageGuide,
                    },
                    {
                      id: "notes",
                      label: "⚠️ Lưu ý",
                      show: selectedGuide.notes,
                    },
                  ].map(
                    (tab) =>
                      tab.show && (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`border-b-2 px-4 py-3 font-medium transition-all duration-200 ${
                            activeTab === tab.id
                              ? darkMode
                                ? "border-blue-500 text-blue-400"
                                : "border-blue-500 text-blue-600"
                              : darkMode
                                ? "border-transparent text-slate-400 hover:text-slate-200"
                                : "border-transparent text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ),
                  )}
                </div>

                {/* Content Tabs */}
                <div className="min-h-[200px] animate-fadeIn">
                  {activeTab === "feature" &&
                    selectedGuide.featureDescription && (
                      <div className="space-y-3">
                        <div
                          className={`blog-content rounded-xl p-6 transition-colors duration-200 ${
                            darkMode
                              ? "bg-blue-950 text-blue-100"
                              : "bg-blue-50 text-slate-700"
                          }`}
                          dangerouslySetInnerHTML={{
                            __html: sanitizeRichText(
                              selectedGuide.featureDescription,
                            ),
                          }}
                        />
                      </div>
                    )}

                  {activeTab === "usage" && selectedGuide.usageGuide && (
                    <div className="space-y-3">
                      <div
                        className={`blog-content rounded-xl p-6 transition-colors duration-200 ${
                          darkMode
                            ? "bg-green-950 text-green-100"
                            : "bg-green-50 text-slate-700"
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeRichText(selectedGuide.usageGuide),
                        }}
                      />
                    </div>
                  )}

                  {activeTab === "notes" && selectedGuide.notes && (
                    <div className="space-y-3">
                      <div
                        className={`blog-content rounded-xl p-6 transition-colors duration-200 ${
                          darkMode
                            ? "bg-amber-950 text-amber-100"
                            : "bg-amber-50 text-slate-700"
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeRichText(selectedGuide.notes),
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div
                  className={`border-t border-slate-300 pt-4 transition-colors duration-200 dark:border-slate-600 ${
                    darkMode ? "" : ""
                  }`}
                >
                  <div
                    className={`space-y-1 text-xs transition-colors duration-200 ${
                      darkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <p>
                      ✏️ <strong>Cập nhật bởi:</strong>{" "}
                      {selectedGuide.updatedBy || "Admin"}
                    </p>
                    <p>
                      📅 <strong>Lần cuối:</strong>{" "}
                      {selectedGuide.updatedAt
                        ? new Date(selectedGuide.updatedAt).toLocaleString(
                            "vi-VN",
                          )
                        : "Chưa cập nhật"}
                    </p>
                  </div>
                </div>

                {/* Close Button - Mobile */}
                <button
                  onClick={() => setSelectedGuide(null)}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 lg:hidden ${
                    darkMode
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div
                className={`flex h-96 flex-col items-center justify-center rounded-2xl transition-all duration-300 ${
                  darkMode
                    ? "border border-slate-700 bg-slate-800/50 shadow-xl shadow-black/50 backdrop-blur-sm"
                    : "bg-white shadow-xl"
                }`}
              >
                <div className="text-5xl">📚</div>
                <p
                  className={`mt-2 text-lg font-semibold transition-colors duration-200 ${
                    darkMode ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  Chọn một hướng dẫn để xem chi tiết
                </p>
                <p
                  className={`text-sm transition-colors duration-200 ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Nhấp vào bất kỳ mục nào bên trái
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
