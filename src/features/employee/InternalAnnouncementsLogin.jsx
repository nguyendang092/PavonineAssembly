import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import SignIn from "@/auth/SignIn";

/**
 * Trang đăng nhập dành cho luồng Thông báo nội bộ: vào đây trước, sau khi đăng nhập chuyển sang /email.
 */
function InternalAnnouncementsLogin() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/email", { replace: true });
    }
  }, [user, navigate]);

  const handleSuccess = (userInfo) => {
    if (setUser) setUser(userInfo);
    navigate("/email", { replace: true });
  };

  const handleClose = () => {
    navigate("/", { replace: true });
  };

  return <SignIn onSignIn={handleSuccess} onClose={handleClose} />;
}

export default InternalAnnouncementsLogin;
