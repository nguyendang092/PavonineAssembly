import React, { useState } from "react";
import ReactDOM from "react-dom";
import "./NotificationBell.css";

// NotificationBell: Hiển thị chuông thông báo nổi, có badge số lượng và popup nội dung tùy ý
export default function NotificationBell({
  count = 0,
  children,
  title = "DANH SÁCH NHÂN VIÊN BÙ CÔNG",
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
          }}
        >
          {title}
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
        <button
          onClick={() => setOpen(false)}
          style={{
            margin: "10px auto 12px auto",
            padding: "6px 24px",
            borderRadius: 8,
            background: "#1976d2",
            color: "#fff",
            fontWeight: 600,
            border: "none",
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 1px 4px rgba(25,118,210,0.08)",
            transition: "background 0.2s",
          }}
        >
          Đóng
        </button>
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
