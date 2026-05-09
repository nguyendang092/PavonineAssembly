import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { isAdminAccess } from "@/config/authRoles";
import { PERMISSION_CATALOG } from "@/config/featurePermissions";

export default function PermissionCatalogPage() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [...PERMISSION_CATALOG];
    return PERMISSION_CATALOG.filter((r) => {
      const blob = [
        r.id,
        r.labelVi,
        r.quyTac,
        ...r.routes,
        ...r.modules,
        ...r.authRolesHelpers,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [q]);

  const allowed = Boolean(user && isAdminAccess(user, userRole));

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <p className="text-gray-600 dark:text-slate-300">
            {t(
              "permissionCatalog.pleaseLogin",
              "Vui lòng đăng nhập để tiếp tục.",
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
        <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-8 text-center shadow-lg dark:border-amber-800 dark:bg-amber-950/40 dark:ring-1 dark:ring-amber-900">
          <p className="text-amber-900 dark:text-amber-100">
            {t(
              "permissionCatalog.forbidden",
              "Chỉ tài khoản Admin hoặc HR mới xem được trang tra cứu phân quyền.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-10 dark:bg-slate-950">
      <div className="mx-auto max-w-[100rem]">
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-slate-100 md:text-3xl">
            {t(
              "permissionCatalog.title",
              "Tra cứu phân quyền & chức năng",
            )}
          </h1>
          <p className="mb-4 text-sm text-gray-600 dark:text-slate-400">
            {t(
              "permissionCatalog.subtitle",
              "Dữ liệu lấy từ PERMISSION_CATALOG (src/config/featurePermissions.js). Cập nhật catalog khi thêm màn hoặc đổi quyền.",
            )}
          </p>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">
            {t("permissionCatalog.filterLabel", "Lọc nhanh")}
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(
                "permissionCatalog.filterPlaceholder",
                "ID, đường dẫn, tên file, quy tắc…",
              )}
              className="mt-1 w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg bg-white shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-slate-700">
            <thead className="bg-gray-100 dark:bg-slate-800">
              <tr>
                <th
                  scope="col"
                  className="whitespace-nowrap px-3 py-3 font-semibold text-gray-700 dark:text-slate-200"
                >
                  {t("permissionCatalog.colId", "ID")}
                </th>
                <th
                  scope="col"
                  className="min-w-[12rem] px-3 py-3 font-semibold text-gray-700 dark:text-slate-200"
                >
                  {t("permissionCatalog.colFeature", "Chức năng")}
                </th>
                <th
                  scope="col"
                  className="min-w-[14rem] px-3 py-3 font-semibold text-gray-700 dark:text-slate-200"
                >
                  {t("permissionCatalog.colRule", "Quy tắc")}
                </th>
                <th
                  scope="col"
                  className="min-w-[8rem] px-3 py-3 font-semibold text-gray-700 dark:text-slate-200"
                >
                  {t("permissionCatalog.colRoutes", "Route")}
                </th>
                <th
                  scope="col"
                  className="min-w-[14rem] px-3 py-3 font-semibold text-gray-700 dark:text-slate-200"
                >
                  {t("permissionCatalog.colModules", "File / module")}
                </th>
                <th
                  scope="col"
                  className="min-w-[10rem] px-3 py-3 font-semibold text-gray-700 dark:text-slate-200"
                >
                  {t("permissionCatalog.colHelpers", "authRoles / helpers")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="align-top hover:bg-indigo-50/50 dark:hover:bg-slate-800/60"
                >
                  <td className="px-3 py-3 font-mono text-xs text-gray-800 dark:text-slate-200">
                    {r.id}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900 dark:text-slate-100">
                    {r.labelVi}
                  </td>
                  <td className="px-3 py-3 text-gray-700 dark:text-slate-300">
                    {r.quyTac}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600 dark:text-slate-400">
                    {r.routes.length ? r.routes.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600 dark:text-slate-400">
                    {r.modules.join(", ")}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600 dark:text-slate-400">
                    {r.authRolesHelpers.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500 dark:text-slate-500">
          {t("permissionCatalog.footerCount", "{{shown}} / {{total}} mục", {
            shown: rows.length,
            total: PERMISSION_CATALOG.length,
          })}
        </p>
      </div>
    </div>
  );
}
