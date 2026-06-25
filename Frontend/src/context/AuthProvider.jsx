import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext, STORAGE_KEYS } from "./AuthContext";

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setInitializing(false);
      return;
    }

    const loadAuthState = () => {
      const readFromStorage = (storage) => {
        if (!storage) {
          return null;
        }

        const storedToken = storage.getItem(STORAGE_KEYS.token);
        const storedUser = storage.getItem(STORAGE_KEYS.user);

        if (!storedToken || !storedUser) {
          return null;
        }

        try {
          const parsedUser = JSON.parse(storedUser);
          return { storedToken, parsedUser };
        } catch (error) {
          console.warn("Failed to parse stored user, clearing auth", error);
          storage.removeItem(STORAGE_KEYS.token);
          storage.removeItem(STORAGE_KEYS.user);
          return null;
        }
      };

      return readFromStorage(localStorage) || readFromStorage(sessionStorage);
    };

    const authState = loadAuthState();

    if (authState) {
      setToken(authState.storedToken);
      setUser(authState.parsedUser);
    } else {
      setToken(null);
      setUser(null);
    }

    setInitializing(false);
  }, []);

  const login = ({ token: nextToken, user: nextUser, rememberMe = false }) => {
    if (!nextToken || !nextUser) {
      throw new Error("login requires token and user payload");
    }

    setToken(nextToken);
    setUser(nextUser);

    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    sessionStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.user);

    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.token, nextToken);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    } else {
      sessionStorage.setItem(STORAGE_KEYS.token, nextToken);
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    sessionStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.user);
  };

  const persistUserState = useCallback((nextUser) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const serialized = nextUser ? JSON.stringify(nextUser) : null;
      const hasLocalToken = Boolean(localStorage.getItem(STORAGE_KEYS.token));
      const hasSessionToken = Boolean(
        sessionStorage.getItem(STORAGE_KEYS.token)
      );

      if (hasLocalToken) {
        if (serialized) {
          localStorage.setItem(STORAGE_KEYS.user, serialized);
        } else {
          localStorage.removeItem(STORAGE_KEYS.user);
        }
      }

      if (hasSessionToken) {
        if (serialized) {
          sessionStorage.setItem(STORAGE_KEYS.user, serialized);
        } else {
          sessionStorage.removeItem(STORAGE_KEYS.user);
        }
      }
    } catch (error) {
      console.warn("Failed to persist auth user", error);
    }
  }, []);

  const updateUser = useCallback(
    (nextUserOrUpdater) => {
      setUser((previousUser) => {
        const computedUser =
          typeof nextUserOrUpdater === "function"
            ? nextUserOrUpdater(previousUser)
            : nextUserOrUpdater ?? null;

        persistUserState(computedUser);

        return computedUser;
      });
    },
    [persistUserState]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(token && user),
      initializing,
      login,
      logout,
      updateUser,
    }),
    [token, user, initializing, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
