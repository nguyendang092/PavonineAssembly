import React, { useState, useEffect } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { logUserAction } from "./utils/userLog";
import { useTranslation } from "react-i18next";
import "../public/css/auth.css";

/** Ký tự placeholder “vô hình” để CSS dùng :not(:placeholder-shown) — nhãn nổi không phụ thuộc :valid (tránh đè chữ khi gõ email dở). */
const FLOAT_LABEL_PLACEHOLDER = "\u00a0";

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
    return () => {
      document.body.classList.remove("signin-open");
      document.documentElement.style.overflow = "auto";
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
      setError(t("signIn.requiredFields"));
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
      const TTL = 5 * 60 * 1000; // 5 minutes
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
      setError(t("signIn.signinfail"));
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
      setError(t("signIn.requiredFields"));
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
      <button className="close-btn" onClick={onClose}>
        ×
      </button>
      <div className={`auth-wrapper ${uiState.isActive ? "active" : ""}`}>
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
              <span className="input-icon">👤</span>
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
              <span className="input-icon">🔐</span>
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
              <button className="btn" type="submit" disabled={uiState.loading}>
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
                  onClick={(e) => {
                    e.preventDefault();
                    updateUI("showReset", true);
                    setError("");
                  }}
                  style={{ fontSize: "14px", color: "#007bff" }}
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
                autoComplete="name"
                placeholder={FLOAT_LABEL_PLACEHOLDER}
                value={formState.signUpName}
                onChange={(e) => updateForm("signUpName", e.target.value)}
              />
              <label>{t("signIn.displayName")}</label>
              <span className="input-icon">👤</span>
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
              <span className="input-icon">✉️</span>
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
              <span className="input-icon">🔐</span>
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
              <button className="btn" type="submit" disabled={uiState.loading}>
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

        {/* Reset Password Modal */}
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
    </div>
  );
}
