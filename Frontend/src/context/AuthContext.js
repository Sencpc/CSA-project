import { createContext, useContext } from "react";

export const ROLE_REDIRECTS = {
  admin: "/admin/dashboard",
  customer: "/customer/dashboard",
};

export const STORAGE_KEYS = {
  token: "authToken",
  user: "authUser",
};

export const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
