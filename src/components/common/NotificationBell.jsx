import React, { useState } from "react";
import ReactDOM from "react-dom";
import "./NotificationBell.css";

// NotificationBell: Hiển thị chuông thông báo nổi, có badge số lượng và popup nội dung tùy ý
export default function NotificationBell({
  count = 0,
  children,
  title = "DANH SÁCH NHÂN VIÊN BÙ CÔNG",
  onExport,
  exportLabel = "⬇ Xuất Excel",
}) {
  const [open, setOpen] = useState(false);

  // Bell button (fixed, floating)
  const bellButton = (
    <button
      className="birthday-cake-bell-btn birthday-cake-bell-shake"
      title={title}
      onClick={() => setOpen((o) => !o)}
      style={{
        position: "fixed",
        top: 182,
        right: 104,
        zIndex: 2147483647,
        background: "#fff",
        borderRadius: 32,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        padding: 8,
      }}
    >
      <span role="img" aria-label="bell" style={{ fontSize: 24 }}>
        🔔
      </span>
      {count > 0 && <span className="notification-bell-badge">{count}</span>}
    </button>
  );

  // Popup content (centered, modern, scrollable)
  const popup = (
    <>
      <div
        className="birthday-cake-bell-overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0,0,0,0.45)",
          zIndex: 2147483646,
        }}
        onClick={() => setOpen(false)}
      />
      <div
        className="notification-bell-list"
        style={{
          minWidth: 800,
          maxWidth: 800,
          width: "120vw",
          padding: 0,
          zIndex: 2147483647,
          position: "fixed",
          top: 160,
          left: "50%",
          transform: "translateX(-50%)",
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(25, 118, 210, 0.18)",
          border: "1.5px solid #bbdefb",
          display: "flex",
          flexDirection: "column",
          maxHeight: 800,
          textAlign: "center",
        }}
      >
        <div
          style={{
            padding: "18px 20px 10px 20px",
            borderBottom: "1px solid #e3eaf5",
            fontSize: 17,
            color: "#1976d2",
            fontWeight: 700,
            textAlign: "center",
            letterSpacing: 0.2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {title}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {onExport && (
              <button
                onClick={onExport}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.backgroundColor = "#0d47a1")
                }
                onMouseLeave={(e) =>
                  (e.target.style.backgroundColor = "#1976d2")
                }
              >
                {exportLabel}
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "4px 10px",
                backgroundColor: "#ff6b6b",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                transition: "background 0.2s",
                minWidth: "36px",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#ee5a52")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = "#ff6b6b")}
            >
              ✕
            </button>
          </div>
        </div>
        <div
          style={{
            padding: 0,
            margin: 0,
            overflowY: "auto",
            maxHeight: 600,
            minHeight: 600,
          }}
        >
          {children || (
            <div
              style={{
                textAlign: "center",
                color: "#888",
                fontSize: 15,
                padding: "32px 0 32px 0",
              }}
            >
              Không có thông báo
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div>
      {ReactDOM.createPortal(bellButton, document.body)}
      {open && ReactDOM.createPortal(popup, document.body)}
    </div>
  );
}
