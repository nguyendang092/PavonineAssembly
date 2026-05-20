import React, { memo } from "react";
import { createPortal } from "react-dom";
import { isAdminAccess } from "@/config/authRoles";
import ExportExcelButton from "@/components/ui/ExportExcelButton";

function AttendanceListActionPrintMenus({
  user,
  userRole,
  tl,
  t,
  selectedDate,
  filteredEmployees,
  setAlert,
  navbarMobileMenuOpen,
  actionDropdownOpen,
  setActionDropdownOpen,
  actionDropdownRef,
  actionDropdownAnchorRef,
  actionDropdownPanelRef,
  actionDropdownPlacement,
  printDropdownOpen,
  setPrintDropdownOpen,
  printDropdownRef,
  printDropdownAnchorRef,
  printDropdownPanelRef,
  printDropdownPlacement,
  isUploadingExcel,
  handleUploadExcelWrapper,
  handleDownloadAttendanceExcelTemplate,
  setShowExportRangeModal,
  showRowModalActions,
  setEmployeeModalRecord,
  setShowEmployeeModal,
  handleDeleteAllData,
  handlePrintOvertimeList,
  handlePrintAttendanceList,
}) {
  return (
    <>
        {user && (
          <div
            ref={actionDropdownRef}
            className="relative action-dropdown shrink-0 hidden sm:block"
          >
            <button
              ref={actionDropdownAnchorRef}
              type="button"
              onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
              className="inline-flex h-8 w-auto max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-emerald-600 px-1 text-xs font-bold text-white shadow transition hover:bg-emerald-700 sm:text-sm"
            >
              ⚙️ {tl("actionsMenu", "Chức năng")}
              <span className="text-xs">
                {actionDropdownOpen ? "▲" : "▼"}
              </span>
            </button>
            {!navbarMobileMenuOpen &&
              actionDropdownOpen &&
              actionDropdownPlacement &&
              createPortal(
                <div
                  ref={actionDropdownPanelRef}
                  className="fixed max-w-[calc(100vw-2rem)] animate-fadeIn overflow-hidden rounded-lg border-2 border-emerald-200 bg-white shadow-2xl dark:border-emerald-800 dark:bg-slate-900 sm:w-64"
                  style={{
                    zIndex: "var(--z-modal-backdrop, 1200)",
                    top: actionDropdownPlacement.top,
                    left: actionDropdownPlacement.left,
                    width: actionDropdownPlacement.width,
                    maxHeight: actionDropdownPlacement.maxHeight,
                  }}
                >
                  <div className="min-h-0 max-h-full overflow-y-auto overflow-x-hidden overscroll-contain">
                    {isAdminAccess(user, userRole) && (
                      <label className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group cursor-pointer">
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          📤
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                            {isUploadingExcel
                              ? "Đang upload..."
                              : tl(
                                  "uploadExcelByDate",
                                  "Upload Excel theo ngày",
                                )}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            {tl(
                              "importDataForDate",
                              "Import dữ liệu cho ngày",
                            )}
                            :{" "}
                            <span className="font-bold text-blue-600">
                              {selectedDate}
                            </span>
                          </span>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          disabled={isUploadingExcel}
                          onChange={(e) => {
                            handleUploadExcelWrapper(e);
                            setActionDropdownOpen(false);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                    {isAdminAccess(user, userRole) && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleDownloadAttendanceExcelTemplate();
                          setActionDropdownOpen(false);
                        }}
                        className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          📄
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                            {tl(
                              "downloadExcelTemplate",
                              "Tải mẫu Excel (đồng bộ xuất)",
                            )}
                          </span>
                        </div>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const exportButton = document.querySelector(
                          '[title="Xuất Excel"]',
                        );
                        if (exportButton) exportButton.click();
                        setActionDropdownOpen(false);
                      }}
                      className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                        📥
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                          {t("attendanceList.export", {
                            defaultValue: "Xuất Excel",
                          })}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportRangeModal(true);
                        setActionDropdownOpen(false);
                      }}
                      className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                        📅
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                          {tl("exportExcelDateRange")}
                        </span>
                      </div>
                    </button>
                    {showRowModalActions && (
                      <>
                        <button
                          onClick={() => {
                            setEmployeeModalRecord(null);
                            setShowEmployeeModal(true);
                            setActionDropdownOpen(false);
                          }}
                          className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                        >
                          <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                            ➕
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition-colors">
                              {tl("addNew", "Thêm mới")}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              Add new employee
                            </span>
                          </div>
                        </button>
                      </>
                    )}
                    {user && isAdminAccess(user, userRole) && (
                      <button
                        onClick={() => {
                          handleDeleteAllData();
                          setActionDropdownOpen(false);
                        }}
                        className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 transition-all duration-200 flex items-center gap-3 group"
                      >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                          🗑️
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-red-600 text-sm group-hover:text-red-700 transition-colors">
                            {tl("deleteAllData", "Xóa toàn bộ dữ liệu")}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">
                            Delete all data for {selectedDate}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>,
                document.body,
              )}
            {/* Hidden ExportExcelButton for functionality */}
            <div className="hidden">
              <ExportExcelButton
                data={filteredEmployees}
                selectedDate={selectedDate}
                title="Xuất Excel"
                onSuccess={(msg) =>
                  setAlert({ show: true, type: "success", message: msg })
                }
                onError={(msg) =>
                  setAlert({ show: true, type: "error", message: msg })
                }
              />
            </div>
          </div>
        )}

        {/* Print Dropdown */}
        <div
          ref={printDropdownRef}
          className="print-dropdown-menu relative shrink-0 hidden sm:block"
        >
          <button
            ref={printDropdownAnchorRef}
            type="button"
            onClick={() => setPrintDropdownOpen(!printDropdownOpen)}
            className="inline-flex h-8 w-auto max-w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-blue-600 px-1 text-xs font-bold text-white shadow transition hover:bg-blue-700 sm:text-sm"
          >
            🖨️ {tl("print", "In")}
            <span className="text-xs">{printDropdownOpen ? "▲" : "▼"}</span>
          </button>
          {!navbarMobileMenuOpen &&
            printDropdownOpen &&
            printDropdownPlacement &&
            createPortal(
              <div
                ref={printDropdownPanelRef}
                className="fixed max-w-[calc(100vw-2rem)] animate-fadeIn overflow-hidden rounded-lg border-2 border-blue-200 bg-white shadow-2xl dark:border-blue-800 dark:bg-slate-900 sm:w-64"
                style={{
                  zIndex: "var(--z-modal-backdrop, 1200)",
                  top: printDropdownPlacement.top,
                  left: printDropdownPlacement.left,
                  width: printDropdownPlacement.width,
                  maxHeight: printDropdownPlacement.maxHeight,
                }}
              >
                <div className="min-h-0 max-h-full overflow-y-auto overflow-x-hidden overscroll-contain">
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintOvertimeList();
                      setPrintDropdownOpen(false);
                    }}
                    className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 flex items-center gap-3 border-b-2 border-gray-200 group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                      📋
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                        {tl(
                          "printOvertimeRegistration",
                          "In đăng ký tăng ca",
                        )}
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        Overtime registration form
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      handlePrintAttendanceList();
                      setPrintDropdownOpen(false);
                    }}
                    className="w-full px-5 py-3.5 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 flex items-center gap-3 group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                      📝
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                        {tl(
                          "printAttendanceList",
                          "In danh sách chấm công",
                        )}
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        Attendance list report
                      </span>
                    </div>
                  </button>
                </div>
              </div>,
              document.body,
            )}
        </div>
    </>
  );
}

export default memo(AttendanceListActionPrintMenus);
