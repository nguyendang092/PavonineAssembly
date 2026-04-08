import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

/**
 * Chỉ render children khi đã có phiên đăng nhập; không thì chuyển tới `/login`
 * kèm `state.from` để có thể quay lại sau khi đăng nhập.
 */
export default function ProtectedRoute({ children }) {
  const { user } = useUser();
  const location = useLocation();

  if (!user?.email) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
