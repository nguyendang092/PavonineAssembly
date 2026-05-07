import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * URL không khớp route nào — không redirect về home để người dùng thấy đúng địa chỉ họ gõ / bookmark.
 */
export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-5xl font-bold text-slate-300 dark:text-slate-600">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100">
        {t("common.pageNotFound")}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {t("common.pageNotFoundHint")}
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500"
      >
        {t("common.backToHome")}
      </Link>
    </div>
  );
}
