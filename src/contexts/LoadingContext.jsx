import React, { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
// Tạo context
const LoadingContext = createContext();

// Hook để dùng trong component
export const useLoading = () => useContext(LoadingContext);

// Provider bọc toàn app
export const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {loading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] dark:bg-slate-950/85">
          <svg className="animate-spin h-10 w-10 text-blue-600 mb-4 dark:text-blue-400" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">
            {t("loading.loading")}
          </p>
        </div>
      )}
      {children}
    </LoadingContext.Provider>
  );
};