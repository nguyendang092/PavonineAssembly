import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const AttendanceStatisticsSidebarContext = createContext(null);

/** Đăng ký mở modal Thống kê từ AttendanceList — Production sidebar gọi khi đang ở trang điểm danh. */
export function AttendanceStatisticsSidebarProvider({ children }) {
  const [handler, setHandler] = useState(null);

  const register = useCallback((next) => {
    setHandler((prev) => {
      if (!next) return null;
      if (prev?.open === next.open && prev?.isOpen === next.isOpen) return prev;
      return next;
    });
  }, []);

  const unregister = useCallback(() => {
    setHandler(null);
  }, []);

  const value = useMemo(
    () => ({ handler, register, unregister }),
    [handler, register, unregister],
  );

  return (
    <AttendanceStatisticsSidebarContext.Provider value={value}>
      {children}
    </AttendanceStatisticsSidebarContext.Provider>
  );
}

export function useAttendanceStatisticsSidebar() {
  return useContext(AttendanceStatisticsSidebarContext);
}
