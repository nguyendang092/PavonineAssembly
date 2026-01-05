import { createPortal } from "react-dom";

export default function CenterPortal({ children, onClose }) {
  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 9998,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxHeight: "80vh",
          maxWidth: "90vw",
          overflow: "auto",
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #ddd",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          zIndex: 9999,
        }}
      >
        {children}
      </div>
    </>,
    document.body // ⭐ QUAN TRỌNG: thoát khỏi transform của NotificationBell
  );
}
