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

// Social icon component (FontAwesome or react-icons)
const SocialIcons = () => (
  <div className="flex justify-center gap-3 mb-2">
    <a href="#" className="text-blue-600 text-xl">
      <i className="fab fa-facebook-f"></i>
    </a>
    <a href="#" className="text-red-500 text-xl">
      <i className="fab fa-google-plus-g"></i>
    </a>
    <a href="#" className="text-blue-700 text-xl">
      <i className="fab fa-linkedin-in"></i>
    </a>
  </div>
);

export default function SignIn({ onSignIn, onClose }) {
  const { t } = useTranslation();
  // Tách state cho từng form
  const [mode, setMode] = useState("signIn"); // signIn | signUp | reset
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

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
      setMode("signIn");
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

  // Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg("");
    setError("");
    if (!signInEmail) {
      setError(t("signIn.requireEmailReset"));
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, signInEmail);
  setResetMsg(t("signIn.resetSent"));
    } catch (err) {
  setError(t("signIn.resetFail"));
    } finally {
      setLoading(false);
    }
  };

  // Overlay content
  // overlayContent không còn dùng, đã chuyển sang JSX trực tiếp với t()

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-white min-h-screen z-50">
      <div className="relative w-full max-w-2xl min-h-[500px] flex items-center justify-center rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-0 right-2 text-black hover:text-gray-700 text-4xl z-10"
          aria-label="Đóng"
        >
          ×
        </button>
        {/* Overlay luôn nằm giữa, thêm hiệu ứng translate-x chuyển động mượt mà */}
        <div
          className={`absolute inset-0 flex items-center z-20 pointer-events-none transition-transform duration-700 ${
            mode === "signUp" ? "-translate-x-0" : "translate-x-1/2"
          }`}
        >
          {/* Overlay panel trái (cho đăng ký) */}
          <div
            className={`w-1/2 h-full flex flex-col items-center justify-center text-center px-8 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-l-2xl transition-opacity duration-500 ${
              mode === "signUp" ? "opacity-100" : "opacity-0"
            }`}
          >
            <h1 className="text-3xl font-bold mb-2">{t("signIn.overlayWelcomeBack")}</h1>
            <p className="mb-6">{t("signIn.overlayDescBack")}</p>
            <button
              className="ghost bg-transparent border border-white px-6 py-2 rounded-full font-bold text-white hover:bg-white hover:text-blue-700 transition pointer-events-auto"
              onClick={() => setMode("signIn")}
            >
              {t("signIn.login")}
            </button>
          </div>
          {/* Overlay panel phải (cho đăng nhập) */}
          <div
            className={`w-1/2 h-full flex flex-col items-center justify-center text-center px-8 bg-gradient-to-l from-purple-600 to-blue-600 text-white rounded-r-2xl transition-opacity duration-500 ${
              mode === "signIn" ? "opacity-100" : "opacity-0"
            }`}
          >
            <h1 className="text-3xl font-bold mb-2">{t("signIn.overlayHelloNew")}</h1>
            <p className="mb-6">{t("signIn.overlayDescNew")}</p>
            <button
              className="ghost bg-transparent border border-white px-6 py-2 rounded-full font-bold text-white hover:bg-white hover:text-purple-700 transition pointer-events-auto"
              onClick={() => setMode("signUp")}
            >
              {t("signIn.signup")}
            </button>
          </div>
        </div>
        {/* Forms */}
        <div
          className={`relative flex w-full h-full transition-transform duration-700 z-30`}
          style={{
            transform: mode === "signUp" ? "translate-x-1/2" : "translate-x-0",
          }}
        >
          {/* Sign Up */}
          <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8 rounded-l-2xl shadow-lg">
            <form
              onSubmit={handleSignUp}
              className={`w-full max-w-xs space-y-4 ${
                mode !== "signUp"
                  ? "pointer-events-none opacity-0"
                  : "opacity-100"
              } transition-opacity duration-500`}
            >
              <h1 className="text-2xl font-bold text-purple-700 mb-2 text-center">
                {t("signIn.signup")}
              </h1>
              <SocialIcons />
              <span className="block text-xs text-gray-500 text-center">
                {t("signIn.orSignupWithEmail")}
              </span>
              <input
                type="text"
                placeholder={t("signIn.displayName")}
                className="w-full border rounded px-3 py-2"
                value={signUpName}
                onChange={(e) => setSignUpName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder={t("signIn.email")}
                className="w-full border rounded px-3 py-2"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder={t("signIn.password")}
                className="w-full border rounded px-3 py-2"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                required
              />
              {error && mode === "signUp" && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-2 rounded-lg font-semibold shadow hover:from-purple-600 hover:to-blue-600 transition"
              >
                {loading ? t("signIn.signingUp") : t("signIn.signup")}
              </button>
              <div className="text-center mt-2">
                <button
                  type="button"
                  className="text-blue-600 text-xs hover:underline"
                  onClick={() => {
                    setMode("signIn");
                    setError("");
                  }}
                >
                  {t("signIn.haveAccount")}
                </button>
              </div>
            </form>
          </div>
          {/* Sign In */}
          <div className="w-1/2 flex flex-col items-center justify-center bg-white p-8 rounded-r-2xl shadow-lg">
            <form
              onSubmit={handleSignIn}
              className={`w-full max-w-xs space-y-4 ${
                mode !== "signIn"
                  ? "pointer-events-none opacity-0"
                  : "opacity-100"
              } transition-opacity duration-500`}
            >
              <h1 className="text-2xl font-bold text-blue-700 mb-2 text-center">
                {t("signIn.login")}
              </h1>
              <SocialIcons />
              <span className="block text-xs text-gray-500 text-center">
                {t("signIn.orLoginWithEmail")}
              </span>
              <input
                type="email"
                placeholder={t("signIn.email")}
                className="w-full border rounded px-3 py-2"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder={t("signIn.password")}
                className="w-full border rounded px-3 py-2"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                required
              />
              <a
                href="#"
                className="text-xs text-blue-600 hover:underline block text-right"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("reset");
                  setError("");
                  setResetMsg("");
                }}
              >
                {t("signIn.forgotPassword")}
              </a>
              {error && mode === "signIn" && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-lg font-semibold shadow hover:from-blue-600 hover:to-purple-600 transition"
              >
                {loading ? t("signIn.signingIn") : t("signIn.login")}
              </button>
              <div className="text-center mt-2">
                <button
                  type="button"
                  className="text-purple-600 text-xs hover:underline"
                  onClick={() => {
                    setMode("signUp");
                    setError("");
                  }}
                >
                  {t("signIn.noAccount")}
                </button>
              </div>
            </form>
            {/* Reset password */}
            {mode === "reset" && (
              <form
                onSubmit={handleResetPassword}
                className="w-full max-w-xs space-y-4 mt-4 bg-gray-50 p-4 rounded-lg"
              >
                <label className="block text-sm font-medium mb-1">
                  {t("signIn.enterEmailReset")}
                </label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  required
                />
                {resetMsg && (
                  <div className="text-green-600 text-sm">{resetMsg}</div>
                )}
                {error && <div className="text-red-500 text-sm">{error}</div>}
                <button
                  type="submit"
                  className="w-full bg-blue-500 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
                >
                  {loading ? t("signIn.sending") : t("signIn.sendReset")}
                </button>
                <button
                  type="button"
                  className="text-blue-600 text-xs hover:underline mt-2"
                  onClick={() => {
                    setMode("signIn");
                    setResetMsg("");
                    setError("");
                  }}
                >
                  {t("signIn.backToLogin")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
