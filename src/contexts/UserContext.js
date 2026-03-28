import { createContext, useContext } from "react";

export const UserContext = createContext({
  user: null,
  setUser: () => {},
  userDepartments: [],
});

export const useUser = () => useContext(UserContext);
