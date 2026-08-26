import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { push, remove, update } from "firebase/database";
import * as XLSX from "@e965/xlsx";
import AlertMessage from "@/components/ui/AlertMessage";
import { useUserIdentity } from "@/contexts/UserContext";
import { db, ref, set } from "@/services/firebase";
import { useFirebaseValue } from "@/hooks/useFirebaseValue";
import MoldFormModal from "./components/MoldFormModal";
import MoldDetailModal from "./components/MoldDetailModal";
import MoldImageLightbox from "./components/MoldImageLightbox";
import MoldDataTable from "./components/MoldDataTable";
import MoldFilterBar from "./components/MoldFilterBar";
import MoldKpiCards from "./components/MoldKpiCards";
import MoldSidebar from "./components/MoldSidebar";
import MoldTopBar from "./components/MoldTopBar";
import {
  MOLD_COLUMNS,
} from "./lib/moldConstants";
import { buildMoldKpiSummary, getMoldStatus } from "./lib/moldMetrics";
import {
  fromSafeKey,
  getColumnTranslationKey,
  getMoldFilterOptions,
  getPrevMonthLabel,
  normalizeMoldForSave,
} from "./lib/moldUtils";
import "./moldManager.css";

export default function MoldManagerPage() {
  const { t } = useTranslation();
  const { user } = useUserIdentity();

  const columns = MOLD_COLUMNS;
  const emptyForm = useMemo(
    () =>
      columns.reduce((acc, col) => {
        acc[col] = "";
        return acc;
      }, {}),
    [columns],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [subsidiaryFilter, setSubsidiaryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [activeNav, setActiveNav] = useState("list");

  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null });
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [imageZoom, setImageZoom] = useState({ show: false, src: "", alt: "" });
  const [failedImages, setFailedImages] = useState(new Set());
  const [detailModal, setDetailModal] = useState({ show: false, mold: null });

  const { data: moldsRaw } = useFirebaseValue("molds");

  const molds = useMemo(() => {
    if (!moldsRaw || typeof moldsRaw !== "object") return [];
    const arr = Object.entries(moldsRaw).map(([id, mold]) => {
      const obj = { id };
      Object.keys(mold).forEach((k) => {
        obj[fromSafeKey(k, columns)] = mold[k];
      });

      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth();
      if (month === 0) {
        year -= 1;
        month = 11;
      } else {
        month -= 1;
      }
      const prevKey = `${year}-${String(month + 1).padStart(2, "0")}`;
      let prevShots = "";
      if (mold.monthlyShots && typeof mold.monthlyShots === "object") {
        prevShots = mold.monthlyShots[prevKey] ?? "";
      }
      if (!prevShots && (mold.prev_month_shots || mold.prevMonthShots)) {
        prevShots = mold.prev_month_shots ?? mold.prevMonthShots ?? "";
      }
      obj[getPrevMonthLabel()] = prevShots;
      return obj;
    });
    arr.sort((a, b) => (a.No ?? 0) - (b.No ?? 0));
    return arr;
  }, [moldsRaw, columns]);

  const getTranslatedColumn = useCallback(
    (col) => {
      const key = getColumnTranslationKey(col);
      if (key === "prevShots") {
        const month = col.match(/\d+/)?.[0] || "";
        return `${t("moldManager.columns.prevShots")} (${month})`;
      }
      if (key === col) return col;
      const translationKey = `moldManager.columns.${key}`;
      const translated = t(translationKey);
      return translated === translationKey ? col : translated;
    },
    [t],
  );

  useEffect(() => {
    const root = document.getElementById("app-main-scroll");
    document.documentElement.classList.add("mold-page-active");
    root?.classList.add("mold-page-scroll-root");
    return () => {
      document.documentElement.classList.remove("mold-page-active");
      root?.classList.remove("mold-page-scroll-root");
    };
  }, []);

  const filterOptions = useMemo(
    () => ({
      subsidiary: getMoldFilterOptions(molds, "Subsidiary"),
      type: getMoldFilterOptions(molds, "Type"),
    }),
    [molds],
  );

  const filteredMolds = useMemo(() => {
    const q = deferredSearchTerm.trim().toLowerCase();
    return molds.filter((m) => {
      if (subsidiaryFilter && m.Subsidiary !== subsidiaryFilter) return false;
      if (typeFilter && m.Type !== typeFilter) return false;
      if (statusFilter && getMoldStatus(m) !== statusFilter) return false;
      if (!q) return true;
      return columns.some((col) => `${m[col] ?? ""}`.toLowerCase().includes(q));
    });
  }, [
    deferredSearchTerm,
    molds,
    subsidiaryFilter,
    typeFilter,
    statusFilter,
    columns,
  ]);

  const kpiSummary = useMemo(() => buildMoldKpiSummary(molds), [molds]);

  const topSubtitle = useMemo(() => {
    const branch = subsidiaryFilter || "PAVONINE";
    return t("moldManager.pageSubtitle", "{{branch}} · {{count}} bản ghi đang hoạt động", {
      branch,
      count: filteredMolds.length,
    });
  }, [filteredMolds.length, subsidiaryFilter, t]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearchTerm, subsidiaryFilter, typeFilter, statusFilter]);

  const handleNavSelect = useCallback((navId, filters = {}) => {
    setActiveNav(navId);
    if (navId === "list") {
      setSubsidiaryFilter("");
      setTypeFilter("");
      setStatusFilter("");
      return;
    }
    if (filters.subsidiary) {
      setSubsidiaryFilter(filters.subsidiary);
      setTypeFilter("");
    }
    if (filters.type) {
      setTypeFilter(filters.type);
      setSubsidiaryFilter("");
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchTerm("");
    setSubsidiaryFilter("");
    setTypeFilter("");
    setStatusFilter("");
    setActiveNav("list");
    setPage(1);
  }, []);

  const handleImageUpload = (columnName, file) => {
    if (!file) return;
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      setAlert({
        show: true,
        type: "error",
        message: t("moldManager.invalidImageType", "Chỉ chấp nhận file hình ảnh!"),
      });
      return;
    }
    const moldCode = form["Mold Code"] || `mold_${Date.now()}`;
    const fileExt = file.name.split(".").pop();
    let columnType = "process";
    if (columnName === "NamePlate") columnType = "nameplate";
    else if (columnName === "PM Image") columnType = "pm";
    const newFileName = `${moldCode}_${columnType}.${fileExt}`;
    setForm((prev) => ({ ...prev, [columnName]: newFileName }));
    setAlert({
      show: true,
      type: "success",
      message: t("moldManager.imageCopyHint", "Copy file vào: public/picture/molds/{{name}}", {
        name: newFileName,
      }),
    });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message: t("moldManager.loginRequired"),
      });
      return;
    }

    try {
      const moldCode = form["Mold Code"]?.trim();
      if (moldCode) {
        const duplicate = molds.find(
          (m) =>
            m.id !== editing &&
            m["Mold Code"]?.trim() === moldCode,
        );
        if (duplicate) {
          setAlert({
            show: true,
            type: "error",
            message: t("moldManager.duplicateMoldCode", { code: moldCode }),
          });
          return;
        }
      }

      if (editing !== null) {
        await set(
          ref(db, `molds/${editing}`),
          normalizeMoldForSave(form, editing, form.No, columns),
        );
        setEditing(null);
        setAlert({ show: true, type: "success", message: t("moldManager.updateSuccess") });
      } else {
        const newRef = push(ref(db, "molds"));
        const newNo = molds.length + 1;
        await set(
          newRef,
          normalizeMoldForSave(form, newRef.key, newNo, columns),
        );
        setAlert({ show: true, type: "success", message: t("moldManager.addSuccess") });
      }
      setForm({ ...emptyForm });
      setShowModal(false);
    } catch {
      setAlert({ show: true, type: "error", message: t("moldManager.errorOccurred") });
      setShowModal(false);
    }
  };

  const handleEdit = useCallback(
    (id) => {
      if (!user) {
        setAlert({ show: true, type: "error", message: t("moldManager.loginRequired") });
        return;
      }
      const mold = molds.find((m) => m.id === id);
      setForm({ ...emptyForm, ...mold });
      setEditing(id);
      setShowModal(true);
    },
    [emptyForm, molds, t, user],
  );

  const handleDelete = async (id) => {
    if (!user) {
      setAlert({ show: true, type: "error", message: t("moldManager.loginRequired") });
      setConfirmDelete({ show: false, id: null });
      return;
    }
    setConfirmDelete({ show: false, id: null });
    try {
      await remove(ref(db, `molds/${id}`));
      const newMolds = molds.filter((m) => m.id !== id);
      for (let i = 0; i < newMolds.length; i += 1) {
        await update(ref(db, `molds/${newMolds[i].id}`), { No: i + 1 });
      }
      setAlert({ show: true, type: "success", message: t("moldManager.deleteSuccess") });
    } catch {
      setAlert({ show: true, type: "error", message: t("moldManager.deleteFail") });
    }
  };

  const handleAddNew = useCallback(() => {
    if (!user) {
      setAlert({ show: true, type: "error", message: t("moldManager.loginRequired") });
      return;
    }
    setForm({ ...emptyForm });
    setEditing(null);
    setShowModal(true);
  }, [emptyForm, t, user]);

  const handleStatusChange = useCallback(
    async (id, statusValue) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: t("moldManager.loginRequired"),
        });
        return;
      }
      try {
        await update(ref(db, `molds/${id}`), { Status: statusValue });
      } catch {
        setAlert({
          show: true,
          type: "error",
          message: t("moldManager.errorOccurred"),
        });
      }
    },
    [t, user],
  );

  const handleExportExcel = () => {
    try {
      const dataRows = filteredMolds.map((m) => {
        const row = {};
        columns.forEach((col) => {
          row[getTranslatedColumn(col)] = m[col] ?? "";
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(dataRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Molds");
      XLSX.writeFile(wb, `molds_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setAlert({
        show: true,
        type: "success",
        message: `${t("moldManager.exportExcel")} ✅`,
      });
    } catch {
      setAlert({ show: true, type: "error", message: t("moldManager.errorOccurred") });
    }
  };

  const hasOpenPopup =
    showModal || confirmDelete.show || imageZoom.show || detailModal.show;

  useEffect(() => {
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    if (hasOpenPopup) {
      body.style.overflow = "hidden";
      documentElement.style.overflow = "hidden";
    }
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
    };
  }, [hasOpenPopup]);

  return (
    <div className="mold-dashboard">
      <MoldSidebar
        molds={molds}
        activeNav={activeNav}
        subsidiaryFilter={subsidiaryFilter}
        typeFilter={typeFilter}
        onNavSelect={handleNavSelect}
      />

      <div className="mold-main">
        <div className="mold-main-scroll">
          <MoldTopBar
            subtitle={topSubtitle}
            onExport={handleExportExcel}
            onAddNew={handleAddNew}
            showAddButton={Boolean(user)}
          />

          {alert.show ? (
            <AlertMessage
              alert={alert}
              onClose={() => setAlert((a) => ({ ...a, show: false }))}
            />
          ) : null}

          <MoldKpiCards summary={kpiSummary} />

          <MoldFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            subsidiaryFilter={subsidiaryFilter}
            onSubsidiaryChange={setSubsidiaryFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            subsidiaryOptions={filterOptions.subsidiary}
            typeOptions={filterOptions.type}
            onReset={handleResetFilters}
          />

          <MoldDataTable
            molds={filteredMolds}
            searchTerm={deferredSearchTerm}
            page={page}
            onPageChange={setPage}
            user={user}
            failedImages={failedImages}
            onImageZoom={setImageZoom}
            onImageError={(key) =>
              setFailedImages((prev) => new Set(prev).add(key))
            }
            onViewDetail={(mold) => setDetailModal({ show: true, mold })}
            onEdit={handleEdit}
            onRequestDelete={(id) => setConfirmDelete({ show: true, id })}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      {showModal ? (
        <MoldFormModal
          isEditing={editing !== null}
          form={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
          onImageUpload={handleImageUpload}
          getFieldLabel={getTranslatedColumn}
        />
      ) : null}

      {confirmDelete.show ? (
        <div className="mold-modal-backdrop">
          <div className="mold-modal p-5 w-80 max-w-full">
            <h3 className="mold-modal-title mb-4 text-center text-base">
              {t("moldManager.confirmDeleteMessage")}
            </h3>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="mold-btn mold-btn--ghost"
                onClick={() => setConfirmDelete({ show: false, id: null })}
              >
                {t("moldManager.cancel")}
              </button>
              <button
                type="button"
                className="mold-btn"
                style={{ background: "#c0392e", color: "#fff", borderColor: "#c0392e" }}
                onClick={() => handleDelete(confirmDelete.id)}
              >
                {t("moldManager.deleteLabel", "Xóa khuôn")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imageZoom.show ? (
        <MoldImageLightbox
          src={imageZoom.src}
          alt={imageZoom.alt}
          onClose={() => setImageZoom({ show: false, src: "", alt: "" })}
        />
      ) : null}

      {detailModal.show && detailModal.mold ? (
        <MoldDetailModal
          mold={detailModal.mold}
          onClose={() => setDetailModal({ show: false, mold: null })}
          onEdit={() => {
            const moldId = detailModal.mold.id;
            setDetailModal({ show: false, mold: null });
            handleEdit(moldId);
          }}
          canEdit={Boolean(user)}
          onImageZoom={setImageZoom}
        />
      ) : null}
    </div>
  );
}
