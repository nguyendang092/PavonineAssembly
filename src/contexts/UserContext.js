import { createContext, useContext } from "react";

export const UserContext = createContext({
  user: null,
  setUser: () => {},
  userDepartments: [],
  /** Resolved: admin | manager | staff (null when logged out) */
  userRole: null,
});

export const useUser = () => useContext(UserContext);
