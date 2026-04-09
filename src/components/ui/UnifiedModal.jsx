// Component: UnifiedModal
// Chức năng: Component modal đồng nhất về màu sắc và design cho toàn bộ ứng dụng
import React, { useEffect } from "react";

/**
 * UnifiedModal - Component modal tái sử dụng với màu sắc đồng nhất
 *
 * @param {boolean} isOpen - Hiển thị hoặc ẩn modal
 * @param {function} onClose - Callback khi đóng modal
 * @param {string} variant - Loại modal: 'info' | 'warning' | 'success' | 'danger'
 * @param {string} title - Tiêu đề của modal
 * @param {string} message - Nội dung text (optional nếu có children)
 * @param {React.ReactNode} children - Nội dung tùy chỉnh của modal
 * @param {Array} actions - Mảng các action buttons: [{label, onClick, variant, disabled}]
 * @param {string} size - Kích thước modal: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 * @param {boolean} showCloseButton - Hiển thị nút X đóng góc phải
 * @param {string} icon - Icon hiển thị bên cạnh title (optional)
 */
const UnifiedModal = ({
  isOpen,
  onClose,
  variant = "info",
  title,
  message,
  children,
  actions = [],
  size = "lg",
  showCloseButton = true,
  icon,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Cấu hình màu sắc theo variant
  const variantStyles = {
    info: {
      header: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600",
      text: "text-indigo-700",
      icon: "ℹ️",
      buttonPrimary: "bg-gradient-to-r from-indigo-600 to-purple-600",
    },
    warning: {
      header: "bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400",
      text: "text-blue-700",
      icon: "⚠️",
      buttonPrimary: "bg-gradient-to-r from-amber-500 to-orange-500",
    },
    success: {
      header: "bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600",
      text: "text-green-700",
      icon: "✅",
      buttonPrimary: "bg-gradient-to-r from-green-500 to-emerald-600",
    },
    danger: {
      header: "bg-gradient-to-r from-red-600 via-pink-600 to-rose-700",
      text: "text-red-700",
      icon: "🚨",
      buttonPrimary: "bg-gradient-to-r from-red-600 to-pink-600",
    },
  };

  // Cấu hình kích thước
  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-5xl",
    "2xl": "max-w-7xl",
  };

  const currentVariant = variantStyles[variant] || variantStyles.info;
  const currentSize = sizeStyles[size] || sizeStyles.lg;
  const displayIcon = icon || currentVariant.icon;

  // Xử lý click backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div
        className={`rounded-2xl bg-white shadow-2xl overflow-hidden w-full dark:bg-slate-900 dark:ring-1 dark:ring-slate-700 ${currentSize} max-h-[90vh] flex flex-col animate-slideIn`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 ${currentVariant.header} px-4 py-2.5 flex items-center justify-between rounded-t-2xl shadow-lg z-10`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {displayIcon && (
              <span className="text-2xl shrink-0" role="img" aria-label={variant}>
                {displayIcon}
              </span>
            )}
            <h2 className="text-lg font-bold text-white leading-tight truncate">
              {title}
            </h2>
          </div>
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-1.5 shrink-0 transition-all duration-200 hover:scale-110"
              aria-label="Đóng"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 text-slate-800 dark:text-slate-200">
          {message && (
            <p
              className={`text-base leading-relaxed ${currentVariant.text} mb-4`}
            >
              {message}
            </p>
          )}
          {children}
        </div>

        {/* Footer with Actions */}
        {actions.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 flex flex-wrap gap-2 justify-end rounded-b-2xl border-t shadow-inner">
            {actions.map((action, idx) => {
              const actionVariant = action.variant || "secondary";
              const buttonClass =
                actionVariant === "primary"
                  ? `${currentVariant.buttonPrimary} text-white shadow-lg transform hover:scale-105`
                  : actionVariant === "danger"
                    ? "bg-gradient-to-r from-red-500 to-red-700 text-white shadow-lg transform hover:scale-105"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600";

              return (
                <button
                  key={idx}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`px-6 py-3 rounded-xl hover:shadow-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedModal;
