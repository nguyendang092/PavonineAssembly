import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SignIn from "../SignIn";
import { useUser } from "../contexts/UserContext";

function safeRedirectTarget(from) {
  if (!from || typeof from !== "string") return "/";
  const path = from.split("?")[0];
  if (path === "/login" || path === "/email/login" || path === "/normal")
    return "/";
  return from;
}

/**
 * Trang đăng nhập toàn màn hình (router mặc định khi chưa đăng nhập).
 */
export default function LoginRoute() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.email) return;
    const target = safeRedirectTarget(location.state?.from);
    navigate(target, { replace: true });
  }, [user?.email, navigate, location]);

  const handleSuccess = (userInfo) => {
    if (setUser) setUser(userInfo);
  };

  const handleClose = () => {
    navigate("/", { replace: true });
  };

  return <SignIn onSignIn={handleSuccess} onClose={handleClose} />;
}
