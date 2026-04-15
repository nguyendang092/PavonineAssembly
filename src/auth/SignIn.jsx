import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { logUserAction } from "@/utils/userLog";
import { useTranslation } from "react-i18next";
import "../../public/css/auth.css";

/** Ký tự placeholder “vô hình” để CSS dùng :not(:placeholder-shown) — nhãn nổi không phụ thuộc :valid (tránh đè chữ khi gõ email dở). */
const FLOAT_LABEL_PLACEHOLDER = "\u00a0";

/** Icon SVG thống nhất (stroke) — không dùng emoji để giao diện đồng bộ. */
function AuthFieldIcon({ variant }) {
  return (
    <span className="input-icon">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={true}
      >
        {variant === "user" && (
          <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20.5v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
          </>
        )}
        {variant === "mail" && (
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </>
        )}
        {variant === "lock" && (
          <>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </>
        )}
      </svg>
    </span>
  );
}

export default function SignIn({ onSignIn, onClose }) {
  const { t } = useTranslation();

  // Consolidated form state - reduces from 6 setters to 1
  const [formState, setFormState] = useState({
    signInEmail: "",
    signInPassword: "",
    signUpName: "",
    signUpEmail: "",
    signUpPassword: "",
    resetEmail: "",
  });

  // Consolidated UI state - reduces from 3 setters to 1
  const [uiState, setUiState] = useState({
    isActive: false,
    showReset: false,
    loading: false,
  });

  const [error, setError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  /** Desktop/tablet: scale card 750×450 vừa viewport. Mobile: không scale (CSS stack) — tránh dải cực hẹp. */
  const authWrapperRef = useRef(null);
  const [authShell, setAuthShell] = useState({ scale: 1, w: 750, h: 450 });
  const [isMobileLayout, setIsMobileLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const updateAuthScale = useCallback(() => {
    const el = authWrapperRef.current;
    if (!el) return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setAuthShell({ scale: 1, w: 750, h: 450 });
      return;
    }
    const pad = 16;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w < 4 || h < 4) return;
    const availW = window.innerWidth - pad * 2;
    const availH = window.innerHeight - pad * 2;
    const raw = Math.min(1, availW / w, availH / h);
    const MIN_SCALE = 0.38;
    const s = Math.max(MIN_SCALE, raw);
    setAuthShell({ scale: s, w, h });
  }, []);

  useLayoutEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => updateAuthScale());
    };
    schedule();
    const el = authWrapperRef.current;
    const ro = new ResizeObserver(() => schedule());
    if (el) ro.observe(el);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [updateAuthScale, uiState.isActive]);

  // Helper to update form fields efficiently
  const updateForm = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to update UI state
  const updateUI = (field, value) => {
    setUiState((prev) => ({ ...prev, [field]: value }));
  };

  // Helper to clear entire form on successful submit
  const clearForm = () => {
    setFormState((prev) => ({
      ...prev,
      signInEmail: "",
      signInPassword: "",
      signUpName: "",
      signUpEmail: "",
      signUpPassword: "",
      resetEmail: "",
    }));
  };

  // Auto login if session exists
  useEffect(() => {
    try {
      const loginData = localStorage.getItem("userLogin");
      if (loginData) {
        const { email, name, expire } = JSON.parse(loginData);
        if (
          email &&
          typeof expire === "number" &&
          Number.isFinite(expire) &&
          Date.now() < expire
        ) {
          if (onSignIn) onSignIn({ email, name });
          if (onClose) onClose();
        } else {
          localStorage.removeItem("userLogin");
        }
      }
    } catch {
      localStorage.removeItem("userLogin");
    }
  }, []);

  // Hide hamburger menu when SignIn is open / manage body scroll
  useEffect(() => {
    document.body.classList.add("signin-open");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("signin-open");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // Auto-hide reset success message after 3 seconds
  useEffect(() => {
    if (resetSuccess) {
      const timer = setTimeout(() => setResetSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [resetSuccess]);

  // Password Reset Handler
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    updateUI("loading", true);

    if (!formState.resetEmail) {
      setError(t("signIn.requireEmailReset"));
      updateUI("loading", false);
      return;
    }

    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, formState.resetEmail);
      setResetSuccess(true);
      updateForm("resetEmail", "");
      logUserAction("password_reset_sent", { email: formState.resetEmail });
    } catch (err) {
      setError(t("signIn.resetFail"));
    } finally {
      updateUI("loading", false);
    }
  };

  // Sign In Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    updateUI("loading", true);

    if (!formState.signInEmail || !formState.signInPassword) {
      setError(t("signIn.requireEmailPassword"));
      updateUI("loading", false);
      return;
    }

    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formState.signInEmail,
        formState.signInPassword,
      );
      const TTL = 10 * 60 * 1000; // 10 minutes
      localStorage.setItem(
        "userLogin",
        JSON.stringify({
          email: userCredential.user.email,
          name: userCredential.user.displayName,
          expire: Date.now() + TTL,
        }),
      );
      logUserAction("sign_in", { email: formState.signInEmail });
      if (onSignIn) onSignIn({ email: formState.signInEmail });
      clearForm();
      if (onClose) onClose();
    } catch (err) {
      setError(t("signIn.loginFail"));
    } finally {
      updateUI("loading", false);
    }
  };

  // Sign Up Handler
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    updateUI("loading", true);

    if (
      !formState.signUpEmail ||
      !formState.signUpPassword ||
      !formState.signUpName
    ) {
      setError(t("signIn.requireAllFields"));
      updateUI("loading", false);
      return;
    }

    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formState.signUpEmail,
        formState.signUpPassword,
      );
      await updateProfile(userCredential.user, {
        displayName: formState.signUpName,
      });
      logUserAction("sign_up", { email: formState.signUpEmail });

      const TTL = 5 * 60 * 1000; // 5 minutes
      localStorage.setItem(
        "userLogin",
        JSON.stringify({
          email: userCredential.user.email,
          name: formState.signUpName,
          expire: Date.now() + TTL,
        }),
      );
      clearForm();
      if (onSignIn)
        onSignIn({
          email: userCredential.user.email,
          name: formState.signUpName,
        });
      if (onClose) onClose();
    } catch (err) {
      setError(t("signIn.signupFail"));
    } finally {
      updateUI("loading", false);
    }
  };

  return (
    <div className="auth-container">
      <div
        className="auth-scale-shell"
        style={
          isMobileLayout
            ? {
                width: "100%",
                maxWidth: "min(440px, calc(100vw - 2rem))",
                height: "auto",
                overflow: "visible",
                flexShrink: 1,
              }
            : {
                width: authShell.w * authShell.scale,
                height: authShell.h * authShell.scale,
                overflow: "hidden",
                flexShrink: 0,
              }
        }
      >
        <div
          ref={authWrapperRef}
          className={`auth-wrapper ${uiState.isActive ? "active" : ""}`}
          style={
            isMobileLayout
              ? undefined
              : {
                  transform: `scale(${authShell.scale})`,
                  transformOrigin: "top left",
                }
          }
        >
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
                  autoComplete="email"
                  placeholder={FLOAT_LABEL_PLACEHOLDER}
                  value={formState.signInEmail}
                  onChange={(e) => updateForm("signInEmail", e.target.value)}
                />
                <label>{t("signIn.email")}</label>
                <AuthFieldIcon variant="mail" />
              </div>

              <div
                className="input-box animation"
                style={{ "--D": 2, "--S": 23 }}
              >
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder={FLOAT_LABEL_PLACEHOLDER}
                  value={formState.signInPassword}
                  onChange={(e) => updateForm("signInPassword", e.target.value)}
                />
                <label>{t("signIn.password")}</label>
                <AuthFieldIcon variant="lock" />
              </div>

              {error && !uiState.isActive && (
                <div
                  className="animation error-message"
                  style={{ "--D": 3, "--S": 24 }}
                >
                  {error}
                </div>
              )}

              <div
                className="input-box animation"
                style={{ "--D": 3, "--S": 24 }}
              >
                <button
                  className="btn"
                  type="submit"
                  disabled={uiState.loading}
                >
                  {uiState.loading ? t("signIn.signingIn") : t("signIn.login")}
                </button>
              </div>

              <div
                className="regi-link animation"
                style={{ "--D": 4, "--S": 25 }}
              >
                <p>
                  <a
                    href="#"
                    className="auth-forgot-link"
                    onClick={(e) => {
                      e.preventDefault();
                      updateUI("showReset", true);
                      setError("");
                    }}
                  >
                    {t("signIn.forgotPassword")}
                  </a>
                  <br />
                  <br />
                  {t("signIn.noAccount")} <br />
                  <a
                    href="#"
                    className="SignUpLink"
                    onClick={(e) => {
                      e.preventDefault();
                      updateUI("isActive", true);
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
          <div className="info-content Login text-center">
            <h2
              className="animation text-center"
              style={{ "--D": 0, "--S": 20 }}
            >
              {t("signIn.overlayWelcomeBack")}
            </h2>
            <p
              className="animation text-center"
              style={{ "--D": 1, "--S": 21 }}
            >
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
                  autoComplete="name"
                  placeholder={FLOAT_LABEL_PLACEHOLDER}
                  value={formState.signUpName}
                  onChange={(e) => updateForm("signUpName", e.target.value)}
                />
                <label>{t("signIn.displayName")}</label>
                <AuthFieldIcon variant="user" />
              </div>

              <div
                className="input-box animation"
                style={{ "--li": 19, "--S": 2 }}
              >
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={FLOAT_LABEL_PLACEHOLDER}
                  value={formState.signUpEmail}
                  onChange={(e) => updateForm("signUpEmail", e.target.value)}
                />
                <label>{t("signIn.email")}</label>
                <AuthFieldIcon variant="mail" />
              </div>

              <div
                className="input-box animation"
                style={{ "--li": 19, "--S": 3 }}
              >
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder={FLOAT_LABEL_PLACEHOLDER}
                  value={formState.signUpPassword}
                  onChange={(e) => updateForm("signUpPassword", e.target.value)}
                />
                <label>{t("signIn.password")}</label>
                <AuthFieldIcon variant="lock" />
              </div>

              {error && uiState.isActive && (
                <div
                  className="animation error-message"
                  style={{ "--li": 20, "--S": 4 }}
                >
                  {error}
                </div>
              )}

              <div
                className="input-box animation"
                style={{ "--li": 20, "--S": 4 }}
              >
                <button
                  className="btn"
                  type="submit"
                  disabled={uiState.loading}
                >
                  {uiState.loading ? t("signIn.signingUp") : t("signIn.signup")}
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
                      updateUI("isActive", false);
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
        </div>
      </div>

      {/* Reset — ngoài vùng scale để overlay fullscreen đúng */}
      {uiState.showReset && (
        <div
          className="reset-modal-overlay"
          onClick={() => {
            updateUI("showReset", false);
            setResetSuccess(false);
            setError("");
          }}
        >
          <div
            className="reset-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="reset-modal-title">{t("signIn.sendReset")}</h2>
            {resetSuccess && (
              <div className="reset-success-message">
                {t("signIn.resetSent")}
              </div>
            )}
            <form onSubmit={handlePasswordReset}>
              <div className="reset-input-wrapper">
                <input
                  type="email"
                  required
                  value={formState.resetEmail}
                  onChange={(e) => updateForm("resetEmail", e.target.value)}
                  placeholder={t("signIn.email")}
                  className="reset-email-input"
                />
              </div>
              {error && !resetSuccess && (
                <div className="reset-error-message">{error}</div>
              )}
              <div className="reset-button-group">
                <button
                  type="submit"
                  disabled={uiState.loading || resetSuccess}
                  className="reset-submit-btn"
                >
                  {uiState.loading
                    ? t("signIn.sending")
                    : t("signIn.sendReset")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateUI("showReset", false);
                    setResetSuccess(false);
                    setError("");
                  }}
                  className="reset-cancel-btn"
                >
                  {t("signIn.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
