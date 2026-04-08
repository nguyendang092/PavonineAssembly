import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAuth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { logUserAction } from "@/utils/userLog";

export default function ChangePasswordModal({ onClose }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t("changePassword.requireAll"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("changePassword.mismatch"));
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email)
        throw new Error(t("changePassword.userNotFound"));
      // Re-authenticate
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setSuccess(t("changePassword.success"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Ghi log đổi mật khẩu thành công
      await logUserAction(
        user.email,
        "change_password",
        "Đổi mật khẩu thành công",
      );
    } catch (err) {
      setError(t("changePassword.fail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xs rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
        <button
          onClick={onClose}
          className="absolute right-2 top-2 text-xl text-gray-400 hover:text-gray-700 dark:hover:text-slate-200"
          aria-label="Đóng"
        >
          ×
        </button>
        <h2 className="mb-4 text-center text-xl font-bold text-slate-900 dark:text-slate-100">
          Đổi mật khẩu
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("changePassword.currentPassword")}
            </label>
            <input
              type="password"
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("changePassword.newPassword")}
            </label>
            <input
              type="password"
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("changePassword.confirmPassword")}
            </label>
            <input
              type="password"
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
          )}
          {success && (
            <div className="text-sm text-green-600 dark:text-green-400">
              {success}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
            disabled={loading}
          >
            {loading
              ? t("changePassword.changing")
              : t("changePassword.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
