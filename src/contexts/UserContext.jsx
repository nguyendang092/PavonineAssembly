import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { db, onValue, ref } from "@/services/firebase";
import {
  departmentsArrayEqual,
  resolveUserPermissionFromDepartmentsData,
  userPermissionStateEqual,
} from "@/contexts/userPermissionFromSnapshot";

export const UserIdentityContext = createContext({
  user: null,
  setUser: () => {},
});

export const UserPermissionContext = createContext({
  userDepartments: [],
  /** Resolved: admin | hr | manager | staff (null when logged out) */
  userRole: null,
});

/** @deprecated Dùng UserIdentityContext / UserPermissionContext — giữ cho tương thích import cũ. */
export const UserContext = UserIdentityContext;

export function useUserIdentity() {
  return useContext(UserIdentityContext);
}

export function useUserPermissions() {
  return useContext(UserPermissionContext);
}

/** Gộp identity + permission — component chỉ cần user nên dùng useUserIdentity(). */
export function useUser() {
  return { ...useUserIdentity(), ...useUserPermissions() };
}

function readSessionUser() {
  try {
    const loginData = localStorage.getItem("userLogin");
    if (!loginData) return null;
    const { email, name, expire } = JSON.parse(loginData);
    if (
      email &&
      typeof expire === "number" &&
      Number.isFinite(expire) &&
      Date.now() < expire
    ) {
      return { email, name };
    }
    localStorage.removeItem("userLogin");
  } catch {
    localStorage.removeItem("userLogin");
  }
  return null;
}

function clearSessionAndRedirectToLogin(setUser) {
  localStorage.removeItem("userLogin");
  setUser(null);
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

function applyUserPermissionPatch(setter, nextState) {
  setter((prev) => {
    const prevState = {
      userDepartments: prev.userDepartments,
      userRole: prev.userRole,
    };
    if (userPermissionStateEqual(prevState, nextState)) return prev;
    return nextState;
  });
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => readSessionUser());
  const [permissionState, setPermissionState] = useState({
    userDepartments: [],
    userRole: null,
  });

  const identityValue = useMemo(() => ({ user, setUser }), [user]);
  const permissionValue = useMemo(
    () => ({
      userDepartments: permissionState.userDepartments,
      userRole: permissionState.userRole,
    }),
    [permissionState.userDepartments, permissionState.userRole],
  );

  useEffect(() => {
    setUser(readSessionUser());
  }, []);

  useEffect(() => {
    if (!user?.email) return undefined;

    let timerId;
    try {
      const loginData = localStorage.getItem("userLogin");
      if (!loginData) {
        setUser(null);
        return undefined;
      }
      const { expire } = JSON.parse(loginData);
      if (typeof expire !== "number" || !Number.isFinite(expire)) {
        clearSessionAndRedirectToLogin(setUser);
        return undefined;
      }
      if (Date.now() >= expire) {
        clearSessionAndRedirectToLogin(setUser);
        return undefined;
      }
      timerId = window.setTimeout(() => {
        clearSessionAndRedirectToLogin(setUser);
      }, expire - Date.now());
    } catch {
      clearSessionAndRedirectToLogin(setUser);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [user]);

  const syncPermissionFromSnapshot = useCallback(
    (data) => {
      if (!user?.email) {
        applyUserPermissionPatch(setPermissionState, {
          userDepartments: [],
          userRole: null,
        });
        return;
      }
      applyUserPermissionPatch(
        setPermissionState,
        resolveUserPermissionFromDepartmentsData(data, user),
      );
    },
    [user],
  );

  useEffect(() => {
    if (!user?.email) {
      applyUserPermissionPatch(setPermissionState, {
        userDepartments: [],
        userRole: null,
      });
      return undefined;
    }

    const userDeptsRef = ref(db, "userDepartments");
    const unsubscribe = onValue(userDeptsRef, (snapshot) => {
      syncPermissionFromSnapshot(snapshot.val());
    });
    return () => unsubscribe();
  }, [user, syncPermissionFromSnapshot]);

  return (
    <UserIdentityContext.Provider value={identityValue}>
      <UserPermissionContext.Provider value={permissionValue}>
        {children}
      </UserPermissionContext.Provider>
    </UserIdentityContext.Provider>
  );
}

export { departmentsArrayEqual, readSessionUser };
