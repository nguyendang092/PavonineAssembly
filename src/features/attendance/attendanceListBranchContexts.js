import { createContext, useContext } from "react";

/** @type {React.Context<null | object>} */
export const AttendanceListToolbarBranchContext = createContext(null);

/** @type {React.Context<null | object>} */
export const AttendanceListContentBranchContext = createContext(null);

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
