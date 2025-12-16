import React, { useState, useEffect } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { logUserAction } from "./userLog";
import { useTranslation } from "react-i18next";
import "../public/css/auth.css";

export default function SignIn({ onSignIn, onClose }) {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);
  const [showReset, setShowReset] = useState(false);
  // Tách state cho từng form
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Auto login if session exists
  useEffect(() => {
    const loginData = localStorage.getItem("userLogin");
    if (loginData) {
      const { email, name, expire } = JSON.parse(loginData);
      if (Date.now() < expire) {
        if (onSignIn) onSignIn({ email, name });
        if (onClose) onClose();
        setTimeout(() => {
          localStorage.removeItem("userLogin");
          if (onClose) onClose();
        }, expire - Date.now());
      } else {
        localStorage.removeItem("userLogin");
      }
    }
  }, []);

  // Hide hamburger menu when SignIn is open
  useEffect(() => {
    document.body.classList.add("signin-open");
    return () => {
      document.body.classList.remove("signin-open");
    };
  }, []);

  // Đặt lại mật khẩu
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    setResetSuccess(false);
    setLoading(true);
    try {
      if (!resetEmail) {
        setError(t("signIn.requireEmailReset"));
        setLoading(false);
        return;
      }
      const auth = getAuth();
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess(true);
      setResetEmail("");
      setError("");
      setTimeout(() => {
        setShowReset(false);
        setResetSuccess(false);
      }, 3000);
    } catch (err) {
      setError(t("signIn.resetFail"));
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!signInEmail || !signInPassword) {
        setError(t("signIn.requireEmailPassword"));
        setLoading(false);
        return;
      }
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(
        auth,
        signInEmail,
        signInPassword
      );
      const user = userCredential.user;
      const name = user.displayName || user.email;
      await logUserAction(user.email, "login", t("signIn.loginSuccess"));
      if (onSignIn) onSignIn({ email: user.email, name });
      const expire = Date.now() + 300000;
      localStorage.setItem(
        "userLogin",
        JSON.stringify({ email: user.email, name, expire })
      );
      setTimeout(() => {
        localStorage.removeItem("userLogin");
        if (onClose) onClose();
      }, 300000);
      if (onClose) onClose();
    } catch (err) {
      setError(t("signIn.loginFail"));
    } finally {
      setLoading(false);
    }
  };

  // Đăng ký
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!signUpEmail || !signUpPassword || !signUpName) {
        setError(t("signIn.requireAllFields"));
        setLoading(false);
        return;
      }
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signUpEmail,
        signUpPassword
      );
      await updateProfile(userCredential.user, { displayName: signUpName });
      await logUserAction(
        userCredential.user.email,
        "signup",
        t("signIn.signupSuccess")
      );
      if (onSignIn)
        onSignIn({ email: userCredential.user.email, name: signUpName });
      setIsActive(false);
      setError("");
      setSignUpName("");
      setSignUpEmail("");
      setSignUpPassword("");
      if (onClose) onClose();
    } catch (err) {
      setError(t("signIn.signupFail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <button className="close-btn" onClick={onClose}>
        ×
      </button>
      <div className={`auth-wrapper ${isActive ? "active" : ""}`}>
        <div className="curved-shape"></div>
        <div className="curved-shape2"></div>

        {/* Login Form */}
        <div className="form-box Login">
          <h2 className="animation" style={{ "--D": 0, "--S": 21 }}>
            {t("signIn.login")}
          </h2>
          <form onSubmit={handleSignIn}>
            <div
              className="input-box animation"
              style={{ "--D": 1, "--S": 22 }}
            >
              <input
                type="email"
                required
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
              />
              <label>{t("signIn.email")}</label>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "18px",
                  color: "#000",
                }}
              >
                👤
              </span>
            </div>

            <div
              className="input-box animation"
              style={{ "--D": 2, "--S": 23 }}
            >
              <input
                type="password"
                required
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
              />
              <label>{t("signIn.password")}</label>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "18px",
                  color: "#000",
                }}
              >
                🔐
              </span>
            </div>

            {error && !isActive && (
              <div
                className="animation"
                style={{
                  "--D": 3,
                  "--S": 24,
                  color: "red",
                  fontSize: "14px",
                  marginBottom: "10px",
                }}
              >
                {error}
              </div>
            )}

            <div
              className="input-box animation"
              style={{ "--D": 3, "--S": 24 }}
            >
              <button className="btn" type="submit" disabled={loading}>
                {loading ? t("signIn.signingIn") : t("signIn.login")}
              </button>
            </div>

            <div
              className="regi-link animation"
              style={{ "--D": 4, "--S": 25 }}
            >
              <p>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowReset(true);
                    setError("");
                  }}
                  style={{ fontSize: "14px", color: "#007bff" }}
                >
                  {t("signIn.forgotPassword")}
                </a>
                <br />
                {t("signIn.noAccount")} <br />
                <a
                  href="#"
                  className="SignUpLink"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsActive(true);
                    setError("");
                  }}
                >
                  {t("signIn.signup")}
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Info Content for Login */}
        <div className="info-content Login">
          <h2 className="animation" style={{ "--D": 0, "--S": 20 }}>
            {t("signIn.overlayWelcomeBack")}
          </h2>
          <p className="animation" style={{ "--D": 1, "--S": 21 }}>
            {t("signIn.overlayDescBack")}
          </p>
        </div>

        {/* Register Form */}
        <div className="form-box Register">
          <h2 className="animation" style={{ "--li": 17, "--S": 0 }}>
            {t("signIn.signup")}
          </h2>
          <form onSubmit={handleSignUp}>
            <div
              className="input-box animation"
              style={{ "--li": 18, "--S": 1 }}
            >
              <input
                type="text"
                required
                value={signUpName}
                onChange={(e) => setSignUpName(e.target.value)}
              />
              <label>{t("signIn.displayName")}</label>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "18px",
                  color: "#000",
                }}
              >
                👤
              </span>
            </div>

            <div
              className="input-box animation"
              style={{ "--li": 19, "--S": 2 }}
            >
              <input
                type="email"
                required
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
              />
              <label>{t("signIn.email")}</label>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "18px",
                  color: "#000",
                }}
              >
                ✉️
              </span>
            </div>

            <div
              className="input-box animation"
              style={{ "--li": 19, "--S": 3 }}
            >
              <input
                type="password"
                required
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
              />
              <label>{t("signIn.password")}</label>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "18px",
                  color: "#000",
                }}
              >
                🔐
              </span>
            </div>

            {error && isActive && (
              <div
                className="animation"
                style={{
                  "--li": 20,
                  "--S": 4,
                  color: "red",
                  fontSize: "14px",
                  marginBottom: "10px",
                }}
              >
                {error}
              </div>
            )}

            <div
              className="input-box animation"
              style={{ "--li": 20, "--S": 4 }}
            >
              <button className="btn" type="submit" disabled={loading}>
                {loading ? t("signIn.signingUp") : t("signIn.signup")}
              </button>
            </div>

            <div
              className="regi-link animation"
              style={{ "--li": 21, "--S": 5 }}
            >
              <p>
                {t("signIn.haveAccount")} <br />
                <a
                  href="#"
                  className="SignInLink"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsActive(false);
                    setError("");
                  }}
                >
                  {t("signIn.login")}
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Info Content for Register */}
        <div className="info-content Register">
          <h2 className="animation" style={{ "--li": 17, "--S": 0 }}>
            {t("signIn.overlayHelloNew")}
          </h2>
          <p className="animation" style={{ "--li": 18, "--S": 1 }}>
            {t("signIn.overlayDescNew")}
          </p>
        </div>

        {/* Reset Password Modal */}
        {showReset && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => {
              setShowReset(false);
              setResetSuccess(false);
              setError("");
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "40px",
                borderRadius: "10px",
                boxShadow: "0 5px 15px rgba(0, 0, 0, 0.3)",
                maxWidth: "400px",
                width: "90%",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: "20px", textAlign: "center" }}>
                {t("signIn.sendReset")}
              </h2>
              {resetSuccess && (
                <div
                  style={{
                    backgroundColor: "#d4edda",
                    color: "#155724",
                    padding: "12px",
                    borderRadius: "5px",
                    marginBottom: "15px",
                    textAlign: "center",
                  }}
                >
                  {t("signIn.resetSent")}
                </div>
              )}
              <form onSubmit={handlePasswordReset}>
                <div style={{ marginBottom: "20px", position: "relative" }}>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={t("signIn.email")}
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontSize: "16px",
                      border: "1px solid #ccc",
                      borderRadius: "5px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                {error && !resetSuccess && (
                  <div
                    style={{
                      color: "red",
                      fontSize: "14px",
                      marginBottom: "15px",
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </div>
                )}
                <div
                  style={{ display: "flex", gap: "10px", marginTop: "25px" }}
                >
                  <button
                    type="submit"
                    disabled={loading || resetSuccess}
                    style={{
                      flex: 1,
                      padding: "10px",
                      backgroundColor: "#007bff",
                      color: "white",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "bold",
                    }}
                  >
                    {loading ? "Đang gửi..." : t("signIn.sendReset")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReset(false);
                      setResetSuccess(false);
                      setError("");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px",
                      backgroundColor: "#6c757d",
                      color: "white",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "bold",
                    }}
                  >
                    {t("signIn.cancel")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
