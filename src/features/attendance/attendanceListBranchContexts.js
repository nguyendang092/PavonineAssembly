import { createContext, useContext } from "react";

/** @type {React.Context<null | object>} */
export const AttendanceListToolbarBranchContext = createContext(null);

/** @type {React.Context<null | object>} */
export const AttendanceListContentBranchContext = createContext(null);

/** Danh sách đã lọc — tách khỏi toolbar để gõ tìm kiếm không re-render filter menus. */
export const AttendanceListFilteredDataBranchContext = createContext(null);

/** Bảng + tóm tắt — tách khỏi combo/compare để busy so sánh không re-render bảng. */
export const AttendanceListTableBranchContext = createContext(null);

/** Modal thống kê combo + so sánh nhân viên. */
export const AttendanceListComboBranchContext = createContext(null);

/** Ô tìm kiếm — tách khỏi toolbar để gõ không re-render filter/action menus. */
export const AttendanceListSearchBranchContext = createContext(null);

export function useAttendanceListSearchBranch() {
  const v = useContext(AttendanceListSearchBranchContext);
  if (v == null) {
    throw new Error(
      "useAttendanceListSearchBranch must be used under AttendanceListSearchBranchContext.Provider",
    );
  }
  return v;
}

export function useAttendanceListToolbarBranch() {
  const v = useContext(AttendanceListToolbarBranchContext);
  if (v == null) {
    throw new Error(
      "useAttendanceListToolbarBranch must be used under AttendanceListToolbarBranchContext.Provider",
    );
  }
  return v;
}

export function useAttendanceListContentBranch() {
  const v = useContext(AttendanceListContentBranchContext);
  if (v == null) {
    throw new Error(
      "useAttendanceListContentBranch must be used under AttendanceListContentBranchContext.Provider",
    );
  }
  return v;
}

export function useAttendanceListFilteredDataBranch() {
  const v = useContext(AttendanceListFilteredDataBranchContext);
  if (v == null) {
    throw new Error(
      "useAttendanceListFilteredDataBranch must be used under AttendanceListFilteredDataBranchContext.Provider",
    );
  }
  return v;
}

export function useAttendanceListTableBranch() {
  const v = useContext(AttendanceListTableBranchContext);
  if (v == null) {
    throw new Error(
      "useAttendanceListTableBranch must be used under AttendanceListTableBranchContext.Provider",
    );
  }
  return v;
}

export function useAttendanceListComboBranch() {
  const v = useContext(AttendanceListComboBranchContext);
  if (v == null) {
    throw new Error(
      "useAttendanceListComboBranch must be used under AttendanceListComboBranchContext.Provider",
    );
  }
  return v;
}
