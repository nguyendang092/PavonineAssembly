import React, { useEffect, useRef } from "react";

/**
 * Sidebar component - Thành phần thanh bên thống nhất
 * Lấy tiêu chuẩn từ TemperatureMonitor
 *
 * @param {Object} props - Props của component
 * @param {React.ReactNode} props.children - Nội dung bên trong sidebar
 * @param {boolean} props.isOpen - Trạng thái mở/đóng (cho mobile)
 * @param {function} props.onClose - Hàm gọi khi đóng sidebar
 * @param {string} props.className - CSS classes bổ sung (có thể override styles mặc định)
 *
 * @example
 * <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
 *   <h2>Menu Title</h2>
 *   <p>Content here</p>
 * </Sidebar>
 *
 * Style standards từ TemperatureMonitor:
 * - Width: w-72 (288px)
 * - Background: #000000cb (black with 80% opacity)
 * - Text: text-white
 * - Padding: p-6 (24px)
 * - Spacing between sections: space-y-6
 * - Fixed positioning: left-0, top 64px, height calc(100vh - 64px)
 * - Z-index: z-20
 * - Mobile: -translate-x-full when closed, translate-x-0 when open
 */
export default function Sidebar({
  children,
  isOpen = true,
  onClose,
  className = "",
}) {
  const inactivityTimer = useRef(null);
  const containerRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // keep latest onClose without retriggering effect
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Auto-close after 10s of no interaction when sidebar is open
  useEffect(() => {
    if (!isOpen || !onCloseRef.current) return;

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        onCloseRef.current?.();
      }, 5000);
    };

    const node = containerRef.current;
    if (!node) return undefined;

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
    ];
    events.forEach((evt) => node.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach((evt) => node.removeEventListener(evt, resetTimer));
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`w-72 fixed left-0 text-white p-6 shadow z-20 overflow-y-auto isolate space-y-6 transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } ${className}`}
      style={{
        top: "64px",
        height: "calc(100vh - 64px)",
        backgroundColor: "#000000cb",
      }}
    >
      {children}
    </div>
  );
}
