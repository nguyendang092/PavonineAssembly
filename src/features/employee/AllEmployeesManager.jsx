import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useId,
} from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import {
  canEditAttendanceForEmployee,
  canAddAttendanceForDepartment,
  canDeleteEmployeeData,
  ROLES,
  inferRoleFromMapping,
} from "@/config/authRoles";
import { ATTENDANCE_GIO_VAO_TYPE_OPTIONS } from "@/features/attendance/attendanceGioVaoTypeOptions";
import {
  db,
  ref,
  onValue,
  remove,
  get,
  update,
  query,
  orderByKey,
  limitToFirst,
  limitToLast,
  startAfter,
} from "@/services/firebase";
import {
  EMPLOYEE_DEPT_CATALOG_PATH,
  EMPLOYEE_PROFILES_PATH,
  businessEmployeeCode,
  slugifyDepartmentKey,
  enrichEmployeeRow,
  inferDepartmentKey,
  buildEmployeeProfileDocument,
  employeeProfileStorageKeyFromMnv,
  legacyStatusFromCanonical,
  normalizeTrangThaiLamViec,
  normalizeEmployeeCode,
  buildPavoEmployeeId,
  normalizeMnvSuffix,
  extractMnvSuffixFromStoredId,
  normalizeDateForHtmlInput,
  isEmployeeResigned,
} from "@/utils/employeeRosterRecord";
import {
  EMPLOYEE_PROFILE_HISTORY_PATH,
  appendEmployeeProfileHistory,
  diffEmployeeProfileDocs,
} from "@/utils/employeeProfileHistory";
import {
  parseEmployeeRosterExcelArrayBuffer,
  resolveDepartmentFromCell,
  downloadEmployeeRosterTemplateXlsx,
} from "@/utils/employeeRosterExcel";
import { FiEye, FiEyeOff } from "react-icons/fi";
import {
  rosterUi,
  RosterButton,
  RosterField,
  RosterToast,
  RosterModal,
} from "./roster/RosterUiPrimitives";
import {
  EMPLOYEE_ROSTER_PAGE_SIZE_OPTIONS,
  readStoredEmployeeRosterPageSize,
  persistEmployeeRosterPageSize,
} from "@/config/employeeRosterPagination";

const normEmail = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

const emptyForm = () => ({
  stt: "",
  businessId: "",
  mnvCode: "",
  hoVaTen: "",
  departmentKey: "",
  chucVu: "",
  ngayVaoLam: "",
  trangThaiLamViec: "dang_lam",
  mvt: "",
  gioiTinh: "YES",
  ngayThangNamSinh: "",
  maBoPhan: "",
  sdt: "",
  chuyenCan: "",
  emailDangNhap: "",
  phanQuyen: "",
  gioVao: "",
  gioRa: "",
  caLamViec: "",
  pnTon: "",
  ngayNghiViec: "",
  hinhThucNghiViec: "",
  thaiSanTuNgay: "",
  thaiSanDenNgay: "",
});

function displayChucVu(emp) {
  const c = String(emp?.chucVu ?? "").trim();
  if (c) return c;
  return String(emp?.mvt ?? "").trim() || "—";
}

function workStatusPillClass(statusRaw) {
  const key = String(statusRaw ?? "")
    .trim()
    .toLowerCase();
  if (key === "nghi_viec" || key === "inactive") {
    return "bg-red-50 text-red-800 ring-1 ring-red-100";
  }
  if (key === "tam_nghi" || key === "leave") {
    return "bg-amber-50 text-amber-900 ring-1 ring-amber-100";
  }
  if (key === "thai_san") {
    return "bg-fuchsia-50 text-fuchsia-900 ring-1 ring-fuchsia-100";
  }
  if (key === "thu_viec" || key === "probation") {
    return "bg-sky-50 text-sky-900 ring-1 ring-sky-100";
  }
  return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100";
}

function phoneDigitsOnly(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

/** Chỉ dùng khi đã biết có ≥4 chữ số. */
function maskedPhoneLeadingThree(digits) {
  return `${digits.slice(0, 3)}***`;
}

/**
 * SĐT trong bảng: mặc định 3 số đầu + ***; bấm mắt để xem đủ (theo từng dòng).
 */
function RosterPhoneCell({ value, revealed, onToggle, labelShow, labelHide }) {
  const display = String(value ?? "").trim();
  const digits = phoneDigitsOnly(display);
  if (!display) {
    return <span className="text-gray-400">—</span>;
  }
  if (digits.length <= 3) {
    return <span className="tabular-nums">{display}</span>;
  }
  const showFull = revealed;
  return (
    <div className="inline-flex max-w-full min-w-0 items-center gap-1">
      <span
        className={`min-w-0 tabular-nums ${showFull ? "break-all" : ""}`}
        title={showFull ? undefined : labelShow}
      >
        {showFull ? display : maskedPhoneLeadingThree(digits)}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        aria-label={showFull ? labelHide : labelShow}
        aria-pressed={showFull}
      >
        {showFull ? (
          <FiEyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <FiEye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

/** Nội dung cuộn trong modal «Lịch sử hồ sơ». */
function EmployeeProfileEditHistoryPanel({
  rows,
  tr,
  workStatusLabel,
  hinhThucNghiLabel,
  i18n,
}) {
  if (!rows?.length) {
    return (
      <p className="px-5 py-4 text-sm text-gray-500 sm:px-6">
        {tr("editHistoryEmpty", "Chưa có bản ghi nào.")}
      </p>
    );
  }
  const locale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
  const slice = (s, max = 44) => {
    const x = String(s ?? "");
    return x.length <= max ? x : `${x.slice(0, max)}…`;
  };
  const fieldDef = {
    hoVaTen: "Tên",
    boPhan: "Bộ phận",
    chucVu: "Chức vụ",
    ngayVaoLam: "Ngày vào làm",
    ngayThangNamSinh: "Ngày sinh",
    sdt: "SĐT",
    trangThaiLamViec: "Trạng thái LV",
    thaiSanTuNgay: "Thai sản từ ngày",
    thaiSanDenNgay: "Thai sản đến ngày",
    chuyenCan: "Chuyên cần",
    phanQuyen: "Ghi chú PQ",
    emailDangNhap: "Email đăng nhập",
    ngayNghiViec: "Ngày nghỉ việc",
    hinhThucNghiViec: "Hình thức nghỉ",
  };
  return (
    <div className="space-y-3 px-5 py-4 sm:px-6">
      {rows.map((row) => {
        let when = "—";
        try {
          when = new Date(row.at).toLocaleString(locale, {
            dateStyle: "short",
            timeStyle: "short",
          });
        } catch {
          when = String(row.at ?? "");
        }
        const fmtVal = (k, v) => {
          if (k === "trangThaiLamViec") return workStatusLabel(v);
          if (k === "hinhThucNghiViec") return hinhThucNghiLabel(v);
          return slice(v || "—");
        };
        const act = String(row.action || "");
        const actionKey = act
          ? `historyAction${act.charAt(0).toUpperCase()}${act.slice(1)}`
          : "historyActionUnknown";
        const actionLabel = tr(
          actionKey,
          act === "create"
            ? "Thêm mới"
            : act === "update"
              ? "Cập nhật"
              : act === "delete"
                ? "Xóa"
                : act === "excel"
                  ? "Import Excel"
                  : act || "—",
        );
        const srcLabel = tr(
          row.source === "attendance"
            ? "historySourceAttendance"
            : "historySourceRoster",
          row.source === "attendance" ? "Điểm danh" : "Danh sách NV",
        );
        return (
          <article
            key={row.historyKey}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-gray-600">
              <time className="font-medium text-gray-800">{when}</time>
              <span>·</span>
              <span className="break-all">{slice(row.by, 36)}</span>
              <span>·</span>
              <span>{srcLabel}</span>
              <span>·</span>
              <span className="font-semibold text-gray-800">
                {actionLabel}
              </span>
            </div>
            {row.action !== "excel" ? (
              <p className="mt-1.5 font-medium text-gray-900">
                {slice(row.mnv, 24)} — {slice(row.hoVaTen, 40)}
              </p>
            ) : null}
            {row.action === "excel" && row.excel ? (
              <p className="mt-1.5 text-gray-700">
                {tr(
                  "historyExcelSummary",
                  "Thêm {{added}}, cập nhật {{updated}}, bỏ qua {{skipped}}.",
                  {
                    added: row.excel.added,
                    updated: row.excel.updated,
                    skipped: row.excel.skipped,
                  },
                )}
              </p>
            ) : null}
            {row.changes?.length ? (
              <ul className="mt-2 space-y-1 border-t border-gray-200 pt-2 text-xs text-gray-600">
                {row.changes.map((c, i) => (
                  <li key={`${row.historyKey}-${i}`}>
                    <span className="font-semibold text-gray-700">
                      {tr(`historyField_${c.k}`, fieldDef[c.k] || c.k)}
                    </span>
                    {": "}
                    <span className="text-gray-500 line-through decoration-gray-400">
                      {fmtVal(c.k, c.a)}
                    </span>
                    {" → "}
                    <span className="text-gray-800">{fmtVal(c.k, c.b)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function AllEmployeesManager({ resignedOnly = false }) {
  const { t, i18n } = useTranslation();
  const { user, userDepartments, userRole } = useUser();
  const todayKey = new Date().toISOString().slice(0, 10);
  const gioVaoTypeDatalistId = useId();

  /** Chỉ dùng cho link sang Điểm danh — không ảnh hưởng danh sách hồ sơ. */
  const [attendanceNavDate, setAttendanceNavDate] = useState(todayKey);
  const [deptCatalog, setDeptCatalog] = useState({});

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  /** Khoảng ngày lọc: tab đang làm = ngày vào làm; tab nghỉ việc = ngày nghỉ việc. */
  const [joinDateFrom, setJoinDateFrom] = useState("");
  /** Mặc định đến hôm nay; chỉ áp dụng lọc khi đã chọn “từ ngày”. */
  const [joinDateTo, setJoinDateTo] = useState(todayKey);
  /** Có tìm / lọc BP / hoặc đã chọn “từ ngày” (vào làm hoặc nghỉ việc tùy tab) → tải full, phân trang client. */
  const rosterFilterActive = useMemo(
    () => search.trim() !== "" || deptFilter !== "" || joinDateFrom !== "",
    [search, deptFilter, joinDateFrom],
  );

  const [showModal, setShowModal] = useState(false);
  const [editHistoryOpen, setEditHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [permissionByEmail, setPermissionByEmail] = useState({});
  const [excelUploading, setExcelUploading] = useState(false);
  /** firebaseKey → đang hiện full SĐT trong bảng */
  const [revealedSdtByKey, setRevealedSdtByKey] = useState({});
  const searchInputRef = useRef(null);
  const excelFileInputRef = useRef(null);

  const tr = useCallback(
    (key, defaultValue, options = {}) =>
      t(`employeeRoster.${key}`, { defaultValue, ...options }),
    [t],
  );

  const [profileHistory, setProfileHistory] = useState([]);

  const toggleSdtReveal = useCallback((firebaseKey) => {
    setRevealedSdtByKey((prev) => ({
      ...prev,
      [firebaseKey]: !prev[firebaseKey],
    }));
  }, []);

  useEffect(() => {
    if (!alert.show) return;
    const id = setTimeout(() => setAlert((a) => ({ ...a, show: false })), 3200);
    return () => clearTimeout(id);
  }, [alert.show]);

  useEffect(() => {
    const permRef = ref(db, "userDepartments");
    const unsub = onValue(permRef, (snapshot) => {
      const data = snapshot.val();
      const next = {};
      if (data && typeof data === "object") {
        Object.values(data).forEach((row) => {
          const em = normEmail(row?.email);
          if (em) next[em] = row;
        });
      }
      setPermissionByEmail(next);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const catRef = ref(db, EMPLOYEE_DEPT_CATALOG_PATH);
    const unsub = onValue(catRef, (snapshot) => {
      const v = snapshot.val();
      setDeptCatalog(v && typeof v === "object" ? v : {});
    });
    return () => unsub();
  }, []);

  const [profileByMnv, setProfileByMnv] = useState({});
  /** Số bản ghi mỗi trang (RTDB limit + slice khi lọc); mặc định từ localStorage. */
  const [rosterPageSize, setRosterPageSize] = useState(
    readStoredEmployeeRosterPageSize,
  );
  /** Trang hồ sơ (0-based) — mỗi trang tối đa `rosterPageSize` bản ghi theo key RTDB. */
  const [profilePageIndex, setProfilePageIndex] = useState(0);
  const [profilesHasNextPage, setProfilesHasNextPage] = useState(false);
  const [profilesPageRowCount, setProfilesPageRowCount] = useState(0);
  /** `endKeys[p]` = key cuối **đã đọc từ RTDB** ở trang p (startAfter cho trang p+1). */
  const profilePageEndKeysRef = useRef({});
  /**
   * Không lọc tìm/BP: đúng N firebaseKey/trang sau khi bỏ NV không thuộc tab (đang làm bỏ nghỉ,
   * nghỉ việc bỏ đang làm). null = đang tải full + slice client (có tìm/BP).
   */
  const [pagedRosterVisibleKeys, setPagedRosterVisibleKeys] = useState(null);

  useEffect(() => {
    setProfilePageIndex(0);
  }, [search, deptFilter, joinDateFrom, joinDateTo]);

  useEffect(() => {
    if (!rosterFilterActive) {
      profilePageEndKeysRef.current = {};
    }
  }, [rosterFilterActive]);

  useEffect(() => {
    const profRef = ref(db, EMPLOYEE_PROFILES_PATH);

    if (rosterFilterActive) {
      setPagedRosterVisibleKeys(null);
      const unsub = onValue(profRef, (snapshot) => {
        const v = snapshot.val();
        const next = v && typeof v === "object" ? v : {};
        setProfileByMnv(next);
      });
      return () => unsub();
    }

    const prevEnd =
      profilePageIndex > 0
        ? profilePageEndKeysRef.current[profilePageIndex - 1]
        : null;
    if (profilePageIndex > 0 && !prevEnd) {
      setProfilePageIndex(0);
      return;
    }

    /**
     * Đang làm: đủ N người chưa nghỉ. Nghỉ việc: đủ N người đã nghỉ.
     * Đọc nối tiếp theo key RTDB, bỏ bản ghi không khớp tab.
     */
    const wantResigned = resignedOnly;
    setPagedRosterVisibleKeys([]);
    let cancelled = false;
    const FETCH_CHUNK = Math.max(64, rosterPageSize * 2);
    /** Tránh quét cả DB nếu có quá nhiều bản ghi “lệch tab” liên tiếp theo key. */
    const maxRawKeysPerPage = Math.min(
      5000,
      Math.max(200, rosterPageSize * 100),
    );
    let cursor = prevEnd;

    (async () => {
      const merged = {};
      let lastServerKey = null;
      const matchedKeysInOrder = [];
      let rawKeyCount = 0;

      while (
        !cancelled &&
        matchedKeysInOrder.length < rosterPageSize &&
        rawKeyCount < maxRawKeysPerPage
      ) {
        const q =
          cursor == null
            ? query(profRef, orderByKey(), limitToFirst(FETCH_CHUNK))
            : query(
                profRef,
                orderByKey(),
                startAfter(cursor),
                limitToFirst(FETCH_CHUNK),
              );
        const snap = await get(q);
        if (cancelled) return;

        const batchKeys = [];
        snap.forEach((child) => {
          batchKeys.push(child.key);
          merged[child.key] = child.val();
        });

        if (batchKeys.length === 0) break;

        rawKeyCount += batchKeys.length;
        lastServerKey = batchKeys[batchKeys.length - 1];
        cursor = lastServerKey;

        for (const k of batchKeys) {
          const prof = merged[k];
          const emp = enrichEmployeeRow(
            {
              ...prof,
              firebaseKey: k,
              mnv: prof?.mnv || k,
            },
            deptCatalog,
          );
          const resigned = isEmployeeResigned(emp);
          const matchesTab = wantResigned ? resigned : !resigned;
          if (matchesTab) {
            matchedKeysInOrder.push(k);
            if (matchedKeysInOrder.length >= rosterPageSize) break;
          }
        }

        if (batchKeys.length < FETCH_CHUNK) break;
      }

      if (cancelled) return;

      if (lastServerKey) {
        profilePageEndKeysRef.current[profilePageIndex] = lastServerKey;
      } else {
        delete profilePageEndKeysRef.current[profilePageIndex];
      }

      let hasNext = false;
      if (lastServerKey) {
        const peekSnap = await get(
          query(
            profRef,
            orderByKey(),
            startAfter(lastServerKey),
            limitToFirst(1),
          ),
        );
        if (cancelled) return;
        peekSnap.forEach(() => {
          hasNext = true;
        });
      }

      setProfilesHasNextPage(hasNext);
      setProfilesPageRowCount(matchedKeysInOrder.length);
      setProfileByMnv(merged);
      setPagedRosterVisibleKeys(matchedKeysInOrder);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    rosterFilterActive,
    resignedOnly,
    profilePageIndex,
    rosterPageSize,
    deptCatalog,
  ]);

  /** Danh sách cố định: chỉ employeeProfiles — tách khỏi attendance/{ngày}. */
  const employees = useMemo(() => {
    const arr = Object.entries(profileByMnv).map(([firebaseKey, prof]) =>
      enrichEmployeeRow(
        {
          ...prof,
          firebaseKey,
          mnv: prof?.mnv || firebaseKey,
        },
        deptCatalog,
      ),
    );
    arr.sort((a, b) => {
      const sa = a.stt ?? 999999;
      const sb = b.stt ?? 999999;
      if (sa !== sb) return sa - sb;
      return String(a.hoVaTen || "").localeCompare(
        String(b.hoVaTen || ""),
        "vi",
      );
    });
    return arr;
  }, [profileByMnv, deptCatalog]);

  /** Đang làm / thử việc / tạm nghỉ vs chỉ nghỉ việc — tách hai trang. */
  const rosterEmployees = useMemo(
    () =>
      resignedOnly
        ? employees.filter((e) => isEmployeeResigned(e))
        : employees.filter((e) => !isEmployeeResigned(e)),
    [employees, resignedOnly],
  );

  const departmentSelectOptions = useMemo(() => {
    const cat = deptCatalog || {};
    const opts = Object.entries(cat).map(([key, v]) => ({
      key,
      label: String(v?.name ?? key),
    }));
    if (opts.length) {
      return opts.sort((a, b) => a.label.localeCompare(b.label, "vi"));
    }
    const names = new Set();
    employees.forEach((e) => {
      const n = String(e.boPhan ?? "").trim();
      if (n) names.add(n);
    });
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((name) => ({
        key: slugifyDepartmentKey(name),
        label: name,
      }));
  }, [deptCatalog, employees]);

  /** Khóa BP trên hồ sơ không có trong danh mục → <select> HTML5 coi là invalid và chặn submit. */
  const departmentKeyOrphan = useMemo(() => {
    const k = String(form.departmentKey ?? "").trim();
    if (!k) return null;
    if (departmentSelectOptions.some((o) => o.key === k)) return null;
    const fromCatalog = deptCatalog[k]?.name;
    const row =
      editing && employees.find((r) => r.firebaseKey === editing);
    const label = fromCatalog || row?.boPhan || k;
    return { key: k, label };
  }, [
    form.departmentKey,
    departmentSelectOptions,
    deptCatalog,
    editing,
    employees,
  ]);

  const canEditEmployee = useCallback(
    (employee) =>
      canEditAttendanceForEmployee({
        user,
        userRole,
        userDepartments,
        employee,
      }),
    [user, userRole, userDepartments],
  );

  const showRowActions = Boolean(user && userRole && userRole !== ROLES.STAFF);

  const canDeleteProfile = canDeleteEmployeeData(user, userRole);

  useEffect(() => {
    if (!showRowActions) {
      setProfileHistory([]);
      return;
    }
    const q = query(
      ref(db, EMPLOYEE_PROFILE_HISTORY_PATH),
      orderByKey(),
      limitToLast(80),
    );
    const unsub = onValue(q, (snap) => {
      const v = snap.val();
      if (!v || typeof v !== "object") {
        setProfileHistory([]);
        return;
      }
      const rows = Object.entries(v)
        .map(([historyKey, row]) => ({ historyKey, ...row }))
        .sort((a, b) => b.historyKey.localeCompare(a.historyKey));
      setProfileHistory(rows);
    });
    return () => unsub();
  }, [showRowActions]);

  const phanQuyenLabel = useCallback(
    (emp) => {
      const em = normEmail(emp.emailDangNhap || emp.emailCongTy || emp.email);
      const manual = String(emp.phanQuyen ?? "").trim();
      if (em && permissionByEmail[em]) {
        const rec = permissionByEmail[em];
        const role = inferRoleFromMapping(rec);
        const depts =
          rec.departments || (rec.department ? [rec.department] : []);
        const list = Array.isArray(depts) ? depts.filter(Boolean) : [];
        const roleVi =
          role === ROLES.ADMIN
            ? tr("roleAdmin", "Admin")
            : role === ROLES.MANAGER
              ? tr("roleManager", "Manager")
              : tr("roleStaff", "Staff");
        const deptStr = list.length ? ` · ${list.join(", ")}` : "";
        return `${roleVi}${deptStr}`;
      }
      if (em) return manual || tr("permUnset", "Chưa gán PQ");
      return manual || "—";
    },
    [permissionByEmail, tr],
  );

  const workStatusLabel = useCallback(
    (v) => {
      const key = String(v ?? "").trim();
      const map = {
        dang_lam: tr("wsDangLam", "Đang làm"),
        thu_viec: tr("wsThuViec", "Thử việc"),
        tam_nghi: tr("wsTamNghi", "Tạm nghỉ"),
        thai_san: tr("wsThaiSan", "Thai sản"),
        nghi_viec: tr("wsNghiViec", "Nghỉ việc"),
        active: tr("wsDangLam", "Đang làm"),
        probation: tr("wsThuViec", "Thử việc"),
        leave: tr("wsTamNghi", "Tạm nghỉ"),
        inactive: tr("wsNghiViec", "Nghỉ việc"),
      };
      return map[key] || (key ? key : "—");
    },
    [tr],
  );

  const hinhThucNghiLabel = useCallback(
    (v) => {
      const key = String(v ?? "").trim();
      if (key === "co_don") return tr("resignWithLetter", "Có đơn");
      if (key === "nghi_ngang") return tr("resignAbrupt", "Nghỉ ngang");
      return key || "—";
    },
    [tr],
  );

  const departments = useMemo(() => {
    const set = new Set();
    const cat = deptCatalog || {};
    Object.values(cat).forEach((v) => {
      const n = String(v?.name ?? "").trim();
      if (n) set.add(n);
    });
    rosterEmployees.forEach((e) => {
      if (e.boPhan) set.add(e.boPhan);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [deptCatalog, rosterEmployees]);

  const filteredByDate = useMemo(() => {
    const q = search.trim().toLowerCase();
    const joinFilterOn = joinDateFrom !== "";
    let effJoinFrom = joinDateFrom;
    let effJoinTo =
      joinDateTo !== "" ? joinDateTo : joinFilterOn ? todayKey : "";
    if (joinFilterOn && effJoinFrom && effJoinTo && effJoinFrom > effJoinTo) {
      [effJoinFrom, effJoinTo] = [effJoinTo, effJoinFrom];
    }
    return rosterEmployees.filter((emp) => {
      if (deptFilter && emp.boPhan !== deptFilter) return false;
      if (joinFilterOn) {
        const dateNorm = resignedOnly
          ? normalizeDateForHtmlInput(emp.ngayNghiViec)
          : normalizeDateForHtmlInput(emp.ngayVaoLam ?? emp.joinDate);
        if (!dateNorm) return false;
        if (effJoinFrom && dateNorm < effJoinFrom) return false;
        if (effJoinTo && dateNorm > effJoinTo) return false;
      }
      if (!q) return true;
      const blob = [
        emp.mnv,
        emp.mvt,
        emp.hoVaTen,
        emp.boPhan,
        emp.maBoPhan,
        emp.chucVu,
        emp.sdt,
        emp.emailDangNhap,
        emp.emailCongTy,
        emp.email,
        emp.chuyenCan,
        emp.trangThaiLamViec,
        emp.phanQuyen,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }, [
    rosterEmployees,
    resignedOnly,
    search,
    deptFilter,
    joinDateFrom,
    joinDateTo,
    todayKey,
  ]);

  const list = useMemo(() => {
    if (rosterFilterActive) {
      const start = profilePageIndex * rosterPageSize;
      return filteredByDate.slice(start, start + rosterPageSize);
    }
    if (pagedRosterVisibleKeys !== null) {
      const set = new Set(pagedRosterVisibleKeys);
      return filteredByDate.filter((e) => set.has(e.firebaseKey));
    }
    return filteredByDate;
  }, [
    rosterFilterActive,
    pagedRosterVisibleKeys,
    filteredByDate,
    profilePageIndex,
    rosterPageSize,
  ]);

  const rosterPagination = useMemo(() => {
    if (rosterFilterActive) {
      const total = filteredByDate.length;
      const start = profilePageIndex * rosterPageSize;
      const sliceLen = Math.min(rosterPageSize, Math.max(0, total - start));
      return {
        hasNext: start + rosterPageSize < total,
        rowCount: sliceLen,
        rangeFrom: total === 0 ? 0 : start + 1,
        rangeTo: start + sliceLen,
        clientSlice: true,
      };
    }
    return {
      hasNext: profilesHasNextPage,
      rowCount: profilesPageRowCount,
      rangeFrom:
        profilesPageRowCount === 0 ? 0 : profilePageIndex * rosterPageSize + 1,
      rangeTo: profilePageIndex * rosterPageSize + profilesPageRowCount,
      clientSlice: false,
    };
  }, [
    rosterFilterActive,
    filteredByDate,
    profilePageIndex,
    rosterPageSize,
    profilesHasNextPage,
    profilesPageRowCount,
  ]);

  const handleRosterPageSizeChange = useCallback((e) => {
    const n = Number(e.target.value);
    if (!EMPLOYEE_ROSTER_PAGE_SIZE_OPTIONS.includes(n)) return;
    persistEmployeeRosterPageSize(n);
    profilePageEndKeysRef.current = {};
    setProfilePageIndex(0);
    setRosterPageSize(n);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "trangThaiLamViec" && value !== "thai_san") {
        next.thaiSanTuNgay = "";
        next.thaiSanDenNgay = "";
      }
      return next;
    });
  };

  const openAdd = useCallback(() => {
    setForm(emptyForm());
    setEditing(null);
    setShowModal(true);
  }, []);

  const openEdit = (emp) => {
    if (!canEditEmployee(emp)) return;
    const storedCode = businessEmployeeCode(emp);
    setForm({
      stt: emp.stt ?? "",
      businessId: storedCode,
      mnvCode: extractMnvSuffixFromStoredId(storedCode),
      hoVaTen: String(emp.hoVaTen ?? emp.name ?? ""),
      departmentKey: inferDepartmentKey(emp, deptCatalog),
      chucVu: String(emp.chucVu ?? emp.position ?? ""),
      ngayVaoLam: normalizeDateForHtmlInput(emp.ngayVaoLam ?? emp.joinDate),
      trangThaiLamViec: normalizeTrangThaiLamViec(
        emp.trangThaiLamViec ?? legacyStatusFromCanonical(emp.status),
      ),
      mvt: emp.mvt ?? "",
      gioiTinh: emp.gioiTinh ?? "YES",
      ngayThangNamSinh: normalizeDateForHtmlInput(
        emp.ngayThangNamSinh ?? emp.birthDate,
      ),
      maBoPhan: emp.maBoPhan ?? "",
      sdt: emp.sdt ?? "",
      chuyenCan: emp.chuyenCan ?? "",
      emailDangNhap: emp.emailDangNhap ?? emp.emailCongTy ?? emp.email ?? "",
      phanQuyen: emp.phanQuyen ?? "",
      gioVao: emp.gioVao ?? "",
      gioRa: emp.gioRa ?? "",
      caLamViec: emp.caLamViec ?? "",
      pnTon: String(emp.pnTon ?? emp.phepNam ?? "").trim(),
      ngayNghiViec: normalizeDateForHtmlInput(emp.ngayNghiViec) || "",
      hinhThucNghiViec: String(emp.hinhThucNghiViec ?? "").trim(),
      thaiSanTuNgay: normalizeDateForHtmlInput(emp.thaiSanTuNgay) || "",
      thaiSanDenNgay: normalizeDateForHtmlInput(emp.thaiSanDenNgay) || "",
    });
    setEditing(emp.firebaseKey);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message: tr("pleaseLogin", "Vui lòng đăng nhập"),
      });
      return;
    }
    if (!String(form.hoVaTen ?? "").trim()) {
      setAlert({
        show: true,
        type: "error",
        message: tr("nameRequired", "Vui lòng nhập họ tên."),
      });
      return;
    }
    const deptKey = String(form.departmentKey ?? "").trim();
    const opt = departmentSelectOptions.find((o) => o.key === deptKey);
    const deptDisplayName =
      opt?.label || (deptKey && deptCatalog[deptKey]?.name) || deptKey;

    let effectiveBusinessId = "";
    if (editing) {
      const row = employees.find((r) => r.firebaseKey === editing);
      effectiveBusinessId =
        businessEmployeeCode(row) || String(form.businessId ?? "").trim();
    } else {
      const suffix = normalizeMnvSuffix(form.mnvCode);
      if (!suffix) {
        setAlert({
          show: true,
          type: "error",
          message: tr(
            "mnvRequired",
            "Nhập MNV — hệ thống tạo id dạng PAVO+MNV.",
          ),
        });
        return;
      }
      effectiveBusinessId = buildPavoEmployeeId(suffix);
      const profileKeyNew =
        employeeProfileStorageKeyFromMnv(effectiveBusinessId);
      if (profileKeyNew) {
        const dupSnap = await get(
          ref(db, `${EMPLOYEE_PROFILES_PATH}/${profileKeyNew}`),
        );
        if (dupSnap.exists()) {
          setAlert({
            show: true,
            type: "error",
            message: tr(
              "pavoIdDuplicate",
              "Đã tồn tại mã {{id}} (PAVO+MNV) trong danh sách dữ liệu.",
              { id: effectiveBusinessId },
            ),
          });
          return;
        }
      }
    }
    if (!effectiveBusinessId) {
      setAlert({
        show: true,
        type: "error",
        message: tr("idMissing", "Thiếu mã nhân viên."),
      });
      return;
    }

    const formForSave = { ...form, businessId: effectiveBusinessId };

    if (!deptKey) {
      setAlert({
        show: true,
        type: "error",
        message: tr("deptRequired", "Chọn bộ phận (danh mục)."),
      });
      return;
    }

    if (form.trangThaiLamViec === "thai_san") {
      const tu = String(form.thaiSanTuNgay ?? "").trim();
      const den = String(form.thaiSanDenNgay ?? "").trim();
      if (!tu || !den) {
        setAlert({
          show: true,
          type: "error",
          message: tr(
            "thaiSanDatesRequired",
            "Trạng thái Thai sản: vui lòng chọn đủ «từ ngày» và «đến ngày».",
          ),
        });
        return;
      }
      if (tu > den) {
        setAlert({
          show: true,
          type: "error",
          message: tr(
            "thaiSanDateOrder",
            "«Từ ngày» thai sản phải trước hoặc trùng «đến ngày».",
          ),
        });
        return;
      }
    }

    try {
      if (editing) {
        const existing = employees.find((x) => x.firebaseKey === editing);
        if (
          !existing ||
          !canEditAttendanceForEmployee({
            user,
            userRole,
            userDepartments,
            employee: existing,
          })
        ) {
          setAlert({
            show: true,
            type: "error",
            message: tr("noPermission", "Không có quyền."),
          });
          return;
        }
        /** Phải trùng path node trên RTDB (push id `-N…` hoặc khóa PAVO…). */
        const storageKey = String(editing);
        const profSnap = await get(
          ref(db, `${EMPLOYEE_PROFILES_PATH}/${storageKey}`),
        );
        const existingProfile = profSnap.val() || {};
        const profileDoc = buildEmployeeProfileDocument({
          form: formForSave,
          existingProfile,
          departmentDisplayName: deptDisplayName,
          departmentKey: deptKey,
        });
        const updates = {};
        if (deptKey && !deptCatalog[deptKey]) {
          updates[`${EMPLOYEE_DEPT_CATALOG_PATH}/${deptKey}`] = {
            name: deptDisplayName || deptKey,
          };
        }
        updates[`${EMPLOYEE_PROFILES_PATH}/${storageKey}`] = profileDoc;
        await update(ref(db), updates);
        const profileChanges = diffEmployeeProfileDocs(
          existingProfile,
          profileDoc,
        );
        if (profileChanges.length > 0) {
          void appendEmployeeProfileHistory({
            by: user?.email || "",
            action: "update",
            source: "roster",
            profileKey: storageKey,
            mnv: String(profileDoc.mnv || effectiveBusinessId || ""),
            hoVaTen: String(profileDoc.hoVaTen || existing?.hoVaTen || ""),
            changes: profileChanges,
          });
        }
        setAlert({
          show: true,
          type: "success",
          message: tr("saved", "Đã lưu"),
        });
      } else {
        if (
          !canAddAttendanceForDepartment({
            user,
            userRole,
            userDepartments,
            boPhan: deptDisplayName,
          })
        ) {
          setAlert({
            show: true,
            type: "error",
            message: tr("noPermission", "Không có quyền."),
          });
          return;
        }
        const profileKey =
          employeeProfileStorageKeyFromMnv(effectiveBusinessId);
        const profSnap = await get(
          ref(db, `${EMPLOYEE_PROFILES_PATH}/${profileKey}`),
        );
        const existingProfile = profSnap.val() || {};
        const profileDoc = buildEmployeeProfileDocument({
          form: formForSave,
          existingProfile,
          departmentDisplayName: deptDisplayName,
          departmentKey: deptKey,
        });
        const updates = {};
        if (!deptCatalog[deptKey]) {
          updates[`${EMPLOYEE_DEPT_CATALOG_PATH}/${deptKey}`] = {
            name: deptDisplayName || deptKey,
          };
        }
        updates[`${EMPLOYEE_PROFILES_PATH}/${profileKey}`] = profileDoc;
        await update(ref(db), updates);
        void appendEmployeeProfileHistory({
          by: user?.email || "",
          action: "create",
          source: "roster",
          profileKey,
          mnv: String(profileDoc.mnv || effectiveBusinessId || ""),
          hoVaTen: String(profileDoc.hoVaTen || ""),
        });
        setAlert({
          show: true,
          type: "success",
          message: tr("added", "Đã thêm"),
        });
      }
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm());
    } catch (err) {
      console.error(err);
      const detail =
        err?.code || err?.message
          ? String(err.code || err.message).slice(0, 120)
          : "";
      setAlert({
        show: true,
        type: "error",
        message:
          tr("saveError", "Lỗi khi lưu") + (detail ? ` (${detail})` : ""),
      });
    }
  };

  const handleDelete = async (id) => {
    const emp = employees.find((x) => x.firebaseKey === id);
    if (!user || !emp || !canDeleteEmployeeData(user, userRole)) {
      setAlert({
        show: true,
        type: "error",
        message: tr("noPermission", "Không có quyền."),
      });
      return;
    }
    if (
      !canEditAttendanceForEmployee({
        user,
        userRole,
        userDepartments,
        employee: emp,
      })
    ) {
      setAlert({
        show: true,
        type: "error",
        message: tr("noPermission", "Không có quyền."),
      });
      return;
    }
    if (
      !window.confirm(
        tr(
          "deleteProfileConfirm",
          "Xóa hồ sơ nhân viên này khỏi employeeProfiles? (Dữ liệu điểm danh theo ngày không bị xóa.)",
        ),
      )
    )
      return;
    try {
      await remove(ref(db, `${EMPLOYEE_PROFILES_PATH}/${id}`));
      void appendEmployeeProfileHistory({
        by: user?.email || "",
        action: "delete",
        source: "roster",
        profileKey: id,
        mnv: String(businessEmployeeCode(emp) || emp.mnv || ""),
        hoVaTen: String(emp.hoVaTen || ""),
      });
      setAlert({
        show: true,
        type: "success",
        message: tr("deleted", "Đã xóa"),
      });
    } catch (err) {
      console.error(err);
      setAlert({
        show: true,
        type: "error",
        message: tr("deleteError", "Xóa thất bại"),
      });
    }
  };

  const handleExcelImport = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (e.target) e.target.value = "";
      if (!file || !user) return;
      if (!showRowActions) {
        setAlert({
          show: true,
          type: "error",
          message: tr("noPermission", "Không có quyền."),
        });
        return;
      }

      setExcelUploading(true);
      try {
        const buf = await file.arrayBuffer();
        const { rows: parsedRows, warnings } =
          parseEmployeeRosterExcelArrayBuffer(buf);

        const lastByCode = new Map();
        parsedRows.forEach((r, idx) => {
          const key = String(r.businessId || "").trim() || `__new_row_${idx}`;
          lastByCode.set(key, r);
        });
        const rows = Array.from(lastByCode.values());

        if (rows.length === 0) {
          setAlert({
            show: true,
            type: "error",
            message: tr(
              "excelNoData",
              "File không có dòng hợp lệ (cần cột mnv hoặc id dạng PAVO…, kèm ho_va_ten + department).",
            ),
          });
          return;
        }

        const codeToFirebaseKey = new Map();
        employees.forEach((em) => {
          const c = businessEmployeeCode(em);
          if (c) codeToFirebaseKey.set(c, em.firebaseKey);
        });

        const claimedInBatch = new Set();
        const localWarnings = [...warnings];

        const allocCode = (prefRaw) => {
          const p = String(prefRaw ?? "").trim()
            ? normalizeEmployeeCode(prefRaw)
            : "";
          if (!p) return "";
          if (claimedInBatch.has(p)) {
            localWarnings.push(
              tr(
                "excelDupIdBatch",
                "Trùng id {{id}} trong cùng file — bỏ qua dòng sau.",
                { id: p },
              ),
            );
            return "";
          }
          claimedInBatch.add(p);
          return p;
        };

        const updates = {};
        const catalogSeen = { ...deptCatalog };
        let added = 0;
        let updated = 0;
        let skipped = 0;

        const profilesSnap = await get(ref(db, EMPLOYEE_PROFILES_PATH));
        const profilesCache =
          profilesSnap.val() && typeof profilesSnap.val() === "object"
            ? { ...profilesSnap.val() }
            : {};

        const applyChunkedUpdate = async (payload) => {
          const keys = Object.keys(payload);
          const CHUNK = 350;
          for (let i = 0; i < keys.length; i += CHUNK) {
            const batch = {};
            keys.slice(i, i + CHUNK).forEach((k) => {
              batch[k] = payload[k];
            });
            await update(ref(db), batch);
          }
        };

        for (const r of rows) {
          const code = allocCode(r.businessId);
          if (!code) {
            skipped += 1;
            if (!String(r.businessId ?? "").trim()) {
              localWarnings.push(
                tr("excelSkipNoMnv", "Bỏ qua dòng — thiếu MNV hoặc id PAVO…"),
              );
            }
            continue;
          }
          if (!r.departmentRaw) {
            skipped += 1;
            localWarnings.push(
              tr(
                "excelSkipNoDept",
                "Bỏ qua {{code}} — thiếu department/bộ phận.",
                { code },
              ),
            );
            continue;
          }

          const resolved = resolveDepartmentFromCell(
            r.departmentRaw,
            catalogSeen,
          );
          if (!resolved) {
            skipped += 1;
            continue;
          }
          const { key: deptKey, displayName: deptDisplayName } = resolved;

          if (!catalogSeen[deptKey]) {
            catalogSeen[deptKey] = { name: deptDisplayName };
            updates[`${EMPLOYEE_DEPT_CATALOG_PATH}/${deptKey}`] = {
              name: deptDisplayName,
            };
          }

          const existingKey = codeToFirebaseKey.get(code);
          if (!existingKey && !String(r.hoVaTen ?? "").trim()) {
            skipped += 1;
            localWarnings.push(
              tr(
                "excelSkipNoName",
                "Bỏ qua {{code}} — nhân viên mới cần có tên.",
                { code },
              ),
            );
            continue;
          }

          const formLike = {
            businessId: code,
            hoVaTen: String(r.hoVaTen ?? "").trim(),
            departmentKey: deptKey,
            chucVu: r.chucVu,
            ngayVaoLam: r.ngayVaoLam,
            ngayThangNamSinh: r.ngayThangNamSinh,
            ngayNghiViec: r.ngayNghiViec ?? "",
            hinhThucNghiViec: r.hinhThucNghiViec ?? "",
            stt: r.stt,
            sdt: r.sdt,
            chuyenCan: r.chuyenCan,
            phanQuyen: r.phanQuyen,
            emailDangNhap: r.emailDangNhap,
          };
          if (r.trangThaiLamViec !== undefined) {
            formLike.trangThaiLamViec = r.trangThaiLamViec;
          }
          if (r.thaiSanTuNgay !== undefined) {
            formLike.thaiSanTuNgay = r.thaiSanTuNgay;
          }
          if (r.thaiSanDenNgay !== undefined) {
            formLike.thaiSanDenNgay = r.thaiSanDenNgay;
          }

          const existingRaw = existingKey
            ? profilesCache[existingKey] || {}
            : {};

          const permissionRow = enrichEmployeeRow(
            {
              ...existingRaw,
              boPhan: deptDisplayName,
              mnv: code,
              department: deptKey,
            },
            catalogSeen,
          );

          if (existingKey) {
            if (
              !canEditAttendanceForEmployee({
                user,
                userRole,
                userDepartments,
                employee: permissionRow,
              })
            ) {
              skipped += 1;
              continue;
            }
          } else if (
            !canAddAttendanceForDepartment({
              user,
              userRole,
              userDepartments,
              boPhan: deptDisplayName,
            })
          ) {
            skipped += 1;
            continue;
          }

          const profileKey = employeeProfileStorageKeyFromMnv(code);
          const existingProfile = profilesCache[profileKey] || {};
          const profileDoc = buildEmployeeProfileDocument({
            form: formLike,
            existingProfile,
            departmentDisplayName: deptDisplayName,
            departmentKey: deptKey,
          });
          profilesCache[profileKey] = profileDoc;
          updates[`${EMPLOYEE_PROFILES_PATH}/${profileKey}`] = profileDoc;

          if (existingKey) {
            updated += 1;
          } else {
            added += 1;
          }
        }

        await applyChunkedUpdate(updates);

        if (added > 0 || updated > 0) {
          void appendEmployeeProfileHistory({
            by: user?.email || "",
            action: "excel",
            source: "roster",
            profileKey: "",
            mnv: "",
            hoVaTen: "",
            excel: { added, updated, skipped },
          });
        }

        const warnTail = localWarnings.length
          ? ` ${localWarnings.slice(0, 6).join(" ")}${localWarnings.length > 6 ? "…" : ""}`
          : "";

        setAlert({
          show: true,
          type: "success",
          message:
            tr(
              "excelImportOk",
              "Excel: thêm {{added}}, cập nhật {{updated}}, bỏ qua {{skipped}}.",
              { added, updated, skipped },
            ) + warnTail,
        });
      } catch (err) {
        console.error(err);
        const code = err?.message;
        let message = tr("excelImportError", "Lỗi đọc Excel: {{e}}", {
          e: err?.message || String(err),
        });
        if (code === "excelNoSheet") {
          message = tr("excelNoSheet", "File Excel không có sheet.");
        } else if (code === "excelEmpty") {
          message = tr("excelEmpty", "Sheet trống hoặc không có dữ liệu.");
        }
        setAlert({ show: true, type: "error", message });
      } finally {
        setExcelUploading(false);
      }
    },
    [
      user,
      showRowActions,
      employees,
      deptCatalog,
      userRole,
      userDepartments,
      tr,
    ],
  );

  const countLabel =
    rosterFilterActive && filteredByDate.length > list.length
      ? tr("countLabelFiltered", "{{visible}} / {{total}} người (đã lọc)", {
          visible: list.length,
          total: filteredByDate.length,
        })
      : tr("countLabel", "{{count}} người", { count: list.length });

  const inputFieldClass = rosterUi.input;

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm());
  }, []);

  const modalTitle = editing
    ? tr("modalEdit", "Cập nhật nhân viên")
    : tr("modalAdd", "Thêm nhân viên");

  return (
    <div className={rosterUi.page}>
      <RosterToast alert={alert} />

      <div className={rosterUi.containerFull}>
        <div className={rosterUi.card}>
          <header className="flex flex-col gap-4 border-b border-gray-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold uppercase tracking-wide text-[#1e293b] sm:text-3xl">
                {resignedOnly
                  ? tr("titleResigned", "Danh sách nhân viên nghỉ việc")
                  : tr("title", "Danh sách nhân viên")}
              </h1>
              <p className="mt-1.5 text-xs text-gray-500">
                <Link
                  to={
                    resignedOnly
                      ? "/employee-roster"
                      : "/employee-roster-resigned"
                  }
                  className="text-xs font-semibold uppercase text-blue-700 hover:text-blue-800 hover:underline"
                >
                  {resignedOnly
                    ? tr(
                        "linkToActiveRoster",
                        "← Danh sách nhân viên đang làm việc",
                      )
                    : tr(
                        "linkToResignedRoster",
                        "Danh sách nhân viên nghỉ việc →",
                      )}
                </Link>
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
              <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-end">
                <RosterField
                  label={tr("attendanceNavDate", "Ngày mở Điểm danh")}
                  className="min-w-0 sm:min-w-[10.5rem]"
                >
                  <input
                    type="date"
                    value={attendanceNavDate}
                    onChange={(e) => setAttendanceNavDate(e.target.value)}
                    className={rosterUi.input}
                  />
                </RosterField>
                <RosterButton
                  as={Link}
                  to={`/attendance-list?date=${encodeURIComponent(attendanceNavDate)}`}
                  variant="accent"
                  className="w-full sm:w-auto"
                >
                  {tr("openAttendance", "Mở Điểm danh")}
                </RosterButton>
              </div>
            </div>
          </header>

          <section
            id="roster-filters"
            className={`${rosterUi.sectionMuted} scroll-mt-20`}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
              <RosterField
                label={tr("search", "Tìm kiếm")}
                className={
                  resignedOnly
                    ? "md:col-span-12 lg:col-span-4"
                    : "md:col-span-12 lg:col-span-4"
                }
              >
                <input
                  ref={searchInputRef}
                  id="roster-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    resignedOnly
                      ? tr("searchPhResigned", "Tìm trong NV đã nghỉ việc")
                      : tr("searchPh", "MNV, tên, bộ phận…")
                  }
                  className={rosterUi.input}
                />
              </RosterField>
              <RosterField
                label={tr("dept", "Lọc bộ phận")}
                className={
                  resignedOnly
                    ? "md:col-span-6 lg:col-span-2"
                    : "md:col-span-6 lg:col-span-2"
                }
              >
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className={rosterUi.input}
                >
                  <option value="">{tr("allDepts", "Tất cả")}</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </RosterField>
              <RosterField
                label={
                  resignedOnly
                    ? tr("resignDateRange", "Ngày nghỉ việc (từ — đến)")
                    : tr("joinDateRange", "Ngày vào làm (từ — đến)")
                }
                htmlFor={
                  resignedOnly ? "roster-resign-from" : "roster-join-from"
                }
                className={
                  resignedOnly
                    ? "md:col-span-6 lg:col-span-3"
                    : "md:col-span-12 lg:col-span-3"
                }
              >
                <div className="flex max-w-[min(100%,18.5rem)] flex-wrap items-center gap-1.5">
                  <input
                    id={
                      resignedOnly ? "roster-resign-from" : "roster-join-from"
                    }
                    type="date"
                    value={joinDateFrom}
                    onChange={(e) => setJoinDateFrom(e.target.value)}
                    className={`${rosterUi.input} min-w-0 flex-1 basis-[8.5rem]`}
                    aria-label={
                      resignedOnly
                        ? tr("resignDateFrom", "Nghỉ việc từ ngày")
                        : tr("joinDateFrom", "Vào làm từ ngày")
                    }
                  />
                  <span className="shrink-0 text-xs text-gray-400" aria-hidden>
                    —
                  </span>
                  <input
                    id={resignedOnly ? "roster-resign-to" : "roster-join-to"}
                    type="date"
                    value={joinDateTo}
                    onChange={(e) => setJoinDateTo(e.target.value)}
                    className={`${rosterUi.input} min-w-0 flex-1 basis-[8.5rem]`}
                    aria-label={
                      resignedOnly
                        ? tr("resignDateTo", "Nghỉ việc đến ngày")
                        : tr("joinDateTo", "Vào làm đến ngày")
                    }
                  />
                </div>
              </RosterField>
              {!resignedOnly ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:col-span-12 lg:col-span-3 md:justify-end lg:justify-end">
                  <input
                    ref={excelFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    onChange={handleExcelImport}
                  />
                  <RosterButton
                    variant="secondary"
                    disabled={excelUploading || !showRowActions}
                    onClick={() => excelFileInputRef.current?.click()}
                    className="w-full sm:w-auto"
                  >
                    {excelUploading
                      ? tr("excelUploading", "Đang xử lý…")
                      : tr("uploadExcel", "Upload Excel")}
                  </RosterButton>
                  <RosterButton
                    variant="secondary"
                    onClick={() =>
                      downloadEmployeeRosterTemplateXlsx(
                        "mau_ds_nhan_vien.xlsx",
                      )
                    }
                    className="w-full sm:w-auto"
                  >
                    {tr("downloadRosterTemplate", "Template")}
                  </RosterButton>
                </div>
              ) : null}
            </div>
          </section>

          <section id="roster-table" className="scroll-mt-20">
            <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
              <h2 className="text-sm font-semibold text-gray-900 sm:text-base">
                {resignedOnly
                  ? tr(
                      "listSectionTitleResigned",
                      "Dữ liệu đã chuyển trạng thái nghỉ việc",
                    )
                  : tr("listSectionTitle", "Danh sách nhân viên")}
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {showRowActions && !resignedOnly ? (
                  <RosterButton
                    variant="primary"
                    onClick={openAdd}
                    className="w-full sm:w-auto"
                  >
                    {tr("featAdd", "Thêm nhân viên")}
                  </RosterButton>
                ) : null}
                {showRowActions ? (
                  <RosterButton
                    variant="secondary"
                    type="button"
                    onClick={() => setEditHistoryOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    {tr("editHistoryButton", "Lịch sử")}
                  </RosterButton>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold tabular-nums text-gray-700">
                  {countLabel}
                </span>
              </div>
            </div>

            <div className={rosterUi.tableWrapNoScroll}>
              <table className={rosterUi.tableFluid}>
                {showRowActions ? (
                  <colgroup>
                    <col className="w-[3%]" />
                    <col className="w-[6%]" />
                    <col className="w-[4%]" />
                    <col className="w-[15%]" />
                    <col className="w-[5%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[5%]" />
                    <col className="w-[8%]" />
                    <col className="w-[6%]" />
                    {resignedOnly ? (
                      <>
                        <col className="w-[4%]" />
                        <col className="w-[5%]" />
                      </>
                    ) : null}
                    <col className="w-[5%]" />
                    <col className="w-[7%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                ) : (
                  <colgroup>
                    <col className="w-[3%]" />
                    <col className="w-[6%]" />
                    <col className="w-[4%]" />
                    <col className="w-[15%]" />
                    <col className="w-[5%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[5%]" />
                    <col className="w-[8%]" />
                    <col className="w-[6%]" />
                    {resignedOnly ? (
                      <>
                        <col className="w-[5%]" />
                        <col className="w-[5%]" />
                      </>
                    ) : null}
                    <col className="w-[6%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                )}
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-700 to-blue-400 text-white">
                  <tr>
                    <th className={rosterUi.th}>{tr("colStt", "STT")}</th>
                    <th className={rosterUi.th}>{tr("colEmployeeId", "ID")}</th>
                    <th className={rosterUi.th}>{tr("colMnv", "MNV")}</th>
                    <th className={rosterUi.th}>{tr("colTen", "Tên")}</th>
                    <th className={rosterUi.th}>
                      {tr("colBirth", "Ngày sinh")}
                    </th>
                    <th className={rosterUi.th}>{tr("colDept", "Bộ phận")}</th>
                    <th className={rosterUi.th}>{tr("colTitle", "Chức vụ")}</th>
                    <th className={rosterUi.th}>
                      {tr("colJoin", "Ngày vào làm")}
                    </th>
                    <th className={rosterUi.th}>{tr("colPhone", "SĐT")}</th>
                    <th className={rosterUi.th}>
                      {tr("colStatus", "Trạng thái")}
                    </th>
                    {resignedOnly ? (
                      <>
                        <th className={rosterUi.th}>
                          {tr("colResignDate", "Ngày nghỉ việc")}
                        </th>
                        <th className={rosterUi.th}>
                          {tr("colResignType", "Hình thức nghỉ")}
                        </th>
                      </>
                    ) : null}
                    <th className={rosterUi.th}>
                      {tr("colDiligence", "Chuyên cần")}
                    </th>
                    <th className={rosterUi.th}>
                      {tr("colPerm", "Phân quyền")}
                    </th>
                    {showRowActions ? (
                      <th className={rosterUi.th}>
                        {tr("actions", "Thao tác")}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                  {list.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          (resignedOnly ? 14 : 12) + (showRowActions ? 1 : 0)
                        }
                        className="px-6 py-16 text-center text-sm text-gray-500"
                      >
                        {tr("noData", "Không có dữ liệu")}
                      </td>
                    </tr>
                  ) : (
                    list.map((emp, idx) => {
                      const statusVal =
                        emp.trangThaiLamViec ??
                        legacyStatusFromCanonical(emp.status);
                      const rowFullId = businessEmployeeCode(emp);
                      const rowMnvSuffix = rowFullId
                        ? extractMnvSuffixFromStoredId(rowFullId)
                        : extractMnvSuffixFromStoredId(
                            emp.mnv || emp.firebaseKey,
                          ) || "—";
                      return (
                        <tr
                          key={emp.firebaseKey}
                          className={`transition-colors hover:bg-blue-50 ${
                            idx % 2 === 0
                              ? "bg-gray-50 dark:bg-slate-800/60"
                              : "bg-white dark:bg-slate-900"
                          }`}
                        >
                          <td className={`${rosterUi.td} ${rosterUi.tdMono}`}>
                            {emp.stt ?? idx + 1}
                          </td>
                          <td
                            className={`${rosterUi.td} ${rosterUi.tdMono} font-medium text-gray-900`}
                          >
                            {rowFullId || "—"}
                          </td>
                          <td
                            className={`${rosterUi.td} font-medium text-gray-900`}
                          >
                            {rowMnvSuffix}
                          </td>
                          <td
                            className={`${rosterUi.td} font-medium text-gray-900`}
                          >
                            {emp.hoVaTen ?? "—"}
                          </td>
                          <td className={`${rosterUi.td} ${rosterUi.tdMono}`}>
                            {emp.ngayThangNamSinh ?? "—"}
                          </td>
                          <td className={rosterUi.td}>{emp.boPhan ?? "—"}</td>
                          <td className={rosterUi.td}>{displayChucVu(emp)}</td>
                          <td className={`${rosterUi.td} ${rosterUi.tdMono}`}>
                            {emp.ngayVaoLam ?? "—"}
                          </td>
                          <td className={`${rosterUi.td} ${rosterUi.tdMono}`}>
                            <RosterPhoneCell
                              value={emp.sdt}
                              revealed={Boolean(
                                revealedSdtByKey[emp.firebaseKey],
                              )}
                              onToggle={() => toggleSdtReveal(emp.firebaseKey)}
                              labelShow={tr(
                                "phoneReveal",
                                "Hiện số điện thoại",
                              )}
                              labelHide={tr("phoneHide", "Ẩn số điện thoại")}
                            />
                          </td>
                          <td className={rosterUi.td}>
                            <div className="flex min-w-0 flex-col items-center gap-0.5">
                              <span
                                className={`inline-flex max-w-full rounded-full px-2.5 py-0.5 text-xs font-medium ${workStatusPillClass(statusVal)}`}
                              >
                                {workStatusLabel(statusVal)}
                              </span>
                              {String(statusVal).trim() === "thai_san" &&
                              (emp.thaiSanTuNgay || emp.thaiSanDenNgay) ? (
                                <span
                                  className="max-w-full text-center text-[10px] leading-tight text-gray-500 tabular-nums"
                                  title={tr(
                                    "thaiSanRangeTitle",
                                    "Khoảng nghỉ thai sản",
                                  )}
                                >
                                  {normalizeDateForHtmlInput(emp.thaiSanTuNgay) ||
                                    String(emp.thaiSanTuNgay ?? "").trim() ||
                                    "—"}
                                  {" → "}
                                  {normalizeDateForHtmlInput(
                                    emp.thaiSanDenNgay,
                                  ) ||
                                    String(emp.thaiSanDenNgay ?? "").trim() ||
                                    "—"}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          {resignedOnly ? (
                            <>
                              <td
                                className={`${rosterUi.td} ${rosterUi.tdMono}`}
                              >
                                {normalizeDateForHtmlInput(emp.ngayNghiViec) ||
                                  String(emp.ngayNghiViec ?? "").trim() ||
                                  "—"}
                              </td>
                              <td className={rosterUi.td}>
                                {hinhThucNghiLabel(emp.hinhThucNghiViec)}
                              </td>
                            </>
                          ) : null}
                          <td className={rosterUi.td} title={emp.chuyenCan}>
                            <span className="line-clamp-3 text-center">
                              {String(emp.chuyenCan ?? "").trim() || "—"}
                            </span>
                          </td>
                          <td
                            className={rosterUi.td}
                            title={phanQuyenLabel(emp)}
                          >
                            <span className="line-clamp-3 text-center">
                              {phanQuyenLabel(emp)}
                            </span>
                          </td>
                          {showRowActions ? (
                            <td className={rosterUi.td}>
                              {canEditEmployee(emp) ? (
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  <RosterButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openEdit(emp)}
                                  >
                                    {tr("edit", "Sửa")}
                                  </RosterButton>
                                  {canDeleteProfile ? (
                                    <RosterButton
                                      variant="dangerGhost"
                                      size="sm"
                                      onClick={() =>
                                        handleDelete(emp.firebaseKey)
                                      }
                                    >
                                      {tr("delete", "Xóa")}
                                    </RosterButton>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {profilePageIndex > 0 ||
            rosterPagination.hasNext ||
            rosterPagination.rowCount > 0 ? (
              <div className="flex flex-col items-center gap-2.5 border-t border-gray-200 bg-gray-50 px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900 sm:gap-3 sm:px-6">
                <nav
                  className="flex flex-wrap items-center justify-center gap-2"
                  aria-label={tr(
                    "profilesPaginationNavLabel",
                    "Phân trang danh sách dữ liệu",
                  )}
                >
                  <RosterButton
                    variant="secondary"
                    size="sm"
                    disabled={profilePageIndex <= 0}
                    onClick={() =>
                      setProfilePageIndex((p) => Math.max(0, p - 1))
                    }
                  >
                    {tr("paginationPrev", "Trước")}
                  </RosterButton>
                  <span className="min-w-[6.5rem] text-center text-sm font-medium tabular-nums text-gray-800">
                    {tr("profilesPaginationPage", "Trang {{page}}", {
                      page: profilePageIndex + 1,
                    })}
                  </span>
                  <RosterButton
                    variant="secondary"
                    size="sm"
                    disabled={!rosterPagination.hasNext}
                    onClick={() => setProfilePageIndex((p) => p + 1)}
                  >
                    {tr("paginationNext", "Sau")}
                  </RosterButton>
                </nav>
                <div className="text-center text-xs text-gray-500">
                  {rosterPagination.rowCount > 0 ? (
                    <p className="tabular-nums">
                      {rosterPagination.clientSlice
                        ? tr(
                            "profilesPaginationRangeFiltered",
                            "Kết quả {{from}}–{{to}} (trong danh sách đã lọc)",
                            {
                              from: rosterPagination.rangeFrom,
                              to: rosterPagination.rangeTo,
                            },
                          )
                        : tr(
                            "profilesPaginationRange",
                            "Dữ liệu {{from}}–{{to}}",
                            {
                              from: rosterPagination.rangeFrom,
                              to: rosterPagination.rangeTo,
                            },
                          )}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {tr(
                      "profilesPaginationPerPage",
                      "{{n}} dữ liệu mỗi trang",
                      {
                        n: rosterPageSize,
                      },
                    )}
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <RosterModal
        open={editHistoryOpen}
        title={tr("editHistoryModalTitle", "Lịch sử / cập nhật hồ sơ")}
        onClose={() => setEditHistoryOpen(false)}
      >
        <EmployeeProfileEditHistoryPanel
          rows={profileHistory}
          tr={tr}
          workStatusLabel={workStatusLabel}
          hinhThucNghiLabel={hinhThucNghiLabel}
          i18n={i18n}
        />
      </RosterModal>

      <RosterModal open={showModal} title={modalTitle} onClose={closeModal}>
        <form
          noValidate
          onSubmit={handleSubmit}
          className="space-y-5 px-5 py-5 sm:px-6 sm:py-6"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("colStt", "STT")}
              </label>
              <input
                name="stt"
                type="number"
                value={form.stt}
                onChange={handleChange}
                className={inputFieldClass}
              />
            </div>
            <div>
              {editing ? (
                <>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                    {tr("colPavoId", "Mã nhân viên (id = PAVO+MNV)")}
                  </label>
                  <input
                    readOnly
                    value={form.businessId}
                    autoComplete="off"
                    title={form.businessId}
                    className={`${inputFieldClass} ${rosterUi.inputReadonly}`}
                  />
                </>
              ) : (
                <>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                    {tr("colMnvSuffix", "MNV")} *
                  </label>
                  <input
                    name="mnvCode"
                    required
                    value={form.mnvCode}
                    onChange={handleChange}
                    placeholder={tr("mnvPh", "VD: 001 hoặc 12A")}
                    autoComplete="off"
                    className={inputFieldClass}
                  />
                  <p className="mt-1 text-xs tabular-nums text-gray-600">
                    {tr("pavoIdPreview", "ID lưu: {{id}}", {
                      id: buildPavoEmployeeId(form.mnvCode) || "PAVO…",
                    })}
                  </p>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
              {tr("colTen", "Tên")} *
            </label>
            <input
              name="hoVaTen"
              required
              value={form.hoVaTen}
              onChange={handleChange}
              className={inputFieldClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
              {tr("colBirth", "Ngày sinh")}
            </label>
            <input
              name="ngayThangNamSinh"
              type="date"
              value={form.ngayThangNamSinh}
              onChange={handleChange}
              className={inputFieldClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
              {tr("colDept", "Bộ phận")} *
            </label>
            <select
              name="departmentKey"
              required
              value={form.departmentKey}
              onChange={handleChange}
              className={inputFieldClass}
            >
              <option value="">{tr("deptSelectPh", "— Chọn bộ phận —")}</option>
              {departmentKeyOrphan ? (
                <option value={departmentKeyOrphan.key}>
                  {departmentKeyOrphan.label}
                  {tr("deptOrphanSuffix", " (đang dùng trên hồ sơ)")}
                </option>
              ) : null}
              {departmentSelectOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("colTitle", "Chức vụ")}
              </label>
              <input
                name="chucVu"
                value={form.chucVu}
                onChange={handleChange}
                placeholder={tr("titlePh", "VD: Operator")}
                className={inputFieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("colJoin", "Ngày vào làm")}
              </label>
              <input
                name="ngayVaoLam"
                type="date"
                value={form.ngayVaoLam}
                onChange={handleChange}
                className={inputFieldClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("colPhone", "SĐT")}
              </label>
              <input
                name="sdt"
                type="tel"
                value={form.sdt}
                onChange={handleChange}
                className={inputFieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("colStatus", "Trạng thái làm việc")}
              </label>
              <select
                name="trangThaiLamViec"
                value={form.trangThaiLamViec}
                onChange={handleChange}
                className={inputFieldClass}
              >
                <option value="dang_lam">{tr("wsDangLam", "Đang làm")}</option>
                <option value="thu_viec">{tr("wsThuViec", "Thử việc")}</option>
                <option value="tam_nghi">{tr("wsTamNghi", "Tạm nghỉ")}</option>
                <option value="thai_san">{tr("wsThaiSan", "Thai sản")}</option>
                <option value="nghi_viec">
                  {tr("wsNghiViec", "Nghỉ việc")}
                </option>
              </select>
            </div>
          </div>
          {form.trangThaiLamViec === "thai_san" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  {tr("thaiSanFrom", "Thai sản — từ ngày")}
                </label>
                <input
                  name="thaiSanTuNgay"
                  type="date"
                  value={form.thaiSanTuNgay}
                  onChange={handleChange}
                  className={inputFieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  {tr("thaiSanTo", "Thai sản — đến ngày")}
                </label>
                <input
                  name="thaiSanDenNgay"
                  type="date"
                  value={form.thaiSanDenNgay}
                  onChange={handleChange}
                  className={inputFieldClass}
                />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("colResignDate", "Ngày nghỉ việc")}
              </label>
              <input
                name="ngayNghiViec"
                type="date"
                value={form.ngayNghiViec}
                onChange={handleChange}
                className={inputFieldClass}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                {tr(
                  "resignFieldsHint",
                  "Ghi khi trạng thái là nghỉ việc (tuỳ chọn).",
                )}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("colResignType", "Hình thức nghỉ việc")}
              </label>
              <select
                name="hinhThucNghiViec"
                value={form.hinhThucNghiViec}
                onChange={handleChange}
                className={inputFieldClass}
              >
                <option value="">
                  {tr("resignTypeUnset", "— Chưa chọn / không áp dụng —")}
                </option>
                <option value="co_don">
                  {tr("resignWithLetter", "Có đơn")}
                </option>
                <option value="nghi_ngang">
                  {tr("resignAbrupt", "Nghỉ ngang")}
                </option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
              {tr("colDiligence", "Chuyên cần")}
            </label>
            <input
              name="chuyenCan"
              value={form.chuyenCan}
              onChange={handleChange}
              placeholder={tr("diligencePh", "VD: Tốt / Ghi chú")}
              className={inputFieldClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("emailLogin", "Email đăng nhập (app)")}
              </label>
              <input
                name="emailDangNhap"
                type="email"
                value={form.emailDangNhap}
                onChange={handleChange}
                placeholder="user@company.com"
                className={inputFieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                {tr("permNote", "Ghi chú phân quyền (tuỳ chọn)")}
              </label>
              <input
                name="phanQuyen"
                value={form.phanQuyen}
                onChange={handleChange}
                placeholder={tr("permNotePh", "Khi không dùng email")}
                className={inputFieldClass}
              />
            </div>
          </div>

          <details className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-slate-600 dark:bg-slate-900/80">
            <summary className="cursor-pointer select-none text-sm font-medium text-gray-800">
              {tr("attendanceExtra", "Chấm công ngày & trường bổ sung")}
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  Giới tính
                </label>
                <select
                  name="gioiTinh"
                  value={form.gioiTinh}
                  onChange={handleChange}
                  className={inputFieldClass}
                >
                  <option value="YES">Nữ</option>
                  <option value="NO">Nam</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  MVT (legacy)
                </label>
                <input
                  name="mvt"
                  value={form.mvt}
                  onChange={handleChange}
                  className={inputFieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  Mã BP
                </label>
                <input
                  name="maBoPhan"
                  value={form.maBoPhan}
                  onChange={handleChange}
                  className={inputFieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  Giờ vào
                </label>
                <input
                  name="gioVao"
                  list={gioVaoTypeDatalistId}
                  value={form.gioVao}
                  onChange={handleChange}
                  placeholder={tr(
                    "gioVaoPh",
                    "VD: 08:00 hoặc Phép năm, PN, …",
                  )}
                  className={inputFieldClass}
                />
                <datalist id={gioVaoTypeDatalistId}>
                  {ATTENDANCE_GIO_VAO_TYPE_OPTIONS.map(({ value }) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  Giờ ra
                </label>
                <input
                  name="gioRa"
                  type="text"
                  value={form.gioRa}
                  onChange={handleChange}
                  placeholder={tr("gioRaPh", "VD: 17:30 hoặc theo ca")}
                  className={inputFieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  Ca làm việc
                </label>
                <input
                  name="caLamViec"
                  value={form.caLamViec}
                  onChange={handleChange}
                  className={inputFieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-600">
                  Phép năm (PN)
                </label>
                <input
                  name="pnTon"
                  value={form.pnTon}
                  onChange={handleChange}
                  className={inputFieldClass}
                />
              </div>
            </div>
          </details>

          <RosterButton type="submit" variant="primary" className="mt-2 w-full">
            {editing ? tr("save", "Lưu") : tr("add", "Thêm")}
          </RosterButton>
        </form>
      </RosterModal>
    </div>
  );
}

export default AllEmployeesManager;
