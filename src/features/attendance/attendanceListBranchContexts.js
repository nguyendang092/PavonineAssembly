import { createContext, useContext } from "react";

/** @type {React.Context<null | object>} */
export const AttendanceListToolbarBranchContext = createContext(null);

/** @type {React.Context<null | object>} */
export const AttendanceListContentBranchContext = createContext(null);

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
