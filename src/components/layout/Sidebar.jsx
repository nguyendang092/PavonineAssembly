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

  // Close sidebar when SignIn modal is opened
  useEffect(() => {
    if (!isOpen || !onCloseRef.current) return;

    const closeIfSignInOpen = () => {
      if (document.body.classList.contains("signin-open")) {
        onCloseRef.current?.();
      }
    };

    closeIfSignInOpen();

    const observer = new MutationObserver(closeIfSignInOpen);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`app-sidebar isolate space-y-6 p-4 text-white transition-all duration-200 ease-out sm:p-5 md:fixed md:left-0 md:z-20 md:h-[calc(100vh-64px)] md:w-80 md:overflow-y-auto md:p-6 md:shadow ${
        isOpen
          ? "translate-x-0 opacity-100"
          : "-translate-x-full opacity-0 pointer-events-none"
      } bg-black/80 md:top-16 ${className}`}
    >
      {children}
    </div>
  );
}
