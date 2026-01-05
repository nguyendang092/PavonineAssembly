import { createContext, useContext } from "react";

export const UserContext = createContext({ user: null, setUser: () => {} });

export const useUser = () => useContext(UserContext);
