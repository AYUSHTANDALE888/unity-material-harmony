"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface AuthAccount {
  email: string;
  password: string;
  name: string;
  role: string;
  employeeId: string;
  organisation: string;
}

/** Simulated enterprise directory — prototype only, no real credential store. */
export const ACCOUNTS: AuthAccount[] = [
  {
    email: "admin@numm.gov.in",
    password: "NUMM@123",
    name: "Rajesh Kumar",
    role: "National Administrator",
    employeeId: "EMP-40218",
    organisation: "NUMM Programme Office",
  },
  {
    email: "cpse.admin@numm.gov.in",
    password: "NUMM@123",
    name: "Ananya Sharma",
    role: "CPSE Administrator",
    employeeId: "EMP-51772",
    organisation: "ONGC",
  },
  {
    email: "engineer@numm.gov.in",
    password: "NUMM@123",
    name: "Vikram Iyer",
    role: "Material Engineer",
    employeeId: "EMP-33904",
    organisation: "NTPC",
  },
  {
    email: "procurement@numm.gov.in",
    password: "NUMM@123",
    name: "Sunita Deshmukh",
    role: "Procurement Officer",
    employeeId: "EMP-27641",
    organisation: "SAIL",
  },
  {
    email: "auditor@numm.gov.in",
    password: "NUMM@123",
    name: "Meera Nair",
    role: "Auditor",
    employeeId: "EMP-60155",
    organisation: "Office of the CAG (liaison)",
  },
];

export const DEMO_ACCOUNT = ACCOUNTS[0]!;

export const SSO_ORGANISATIONS = [
  "ONGC",
  "NTPC",
  "SAIL",
  "BHEL",
  "Coal India",
  "GAIL",
  "IOCL",
  "Power Grid",
] as const;

/** Module access matrix by role. "*" grants the full workspace. */
const ROLE_MODULES: Record<string, string[]> = {
  "National Administrator": ["*"],
  "Material Master Governance Officer": ["*"],
  "CPSE Administrator": ["*"],
  "Material Engineer": ["/", "/materials", "/harmonize", "/duplicates", "/standardization", "/classification"],
  "Procurement Officer": ["/", "/materials", "/mapping", "/national-codes", "/analytics"],
  Reviewer: ["/", "/materials", "/harmonize", "/duplicates", "/standardization", "/classification", "/analytics"],
  Auditor: ["/", "/materials", "/audit", "/governance", "/analytics"],
};

export function moduleAllowed(role: string, pathname: string) {
  const allowed = ROLE_MODULES[role] ?? ["*"];
  if (allowed.includes("*")) return true;
  if (pathname === "/") return true;
  return allowed.some((p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`)));
}

export function allowedModules(role: string) {
  return ROLE_MODULES[role] ?? ["*"];
}

export interface Session {
  user: Omit<AuthAccount, "password">;
  method: "password" | "sso";
  loginAt: string;
  sessionId: string;
  remember: boolean;
}

interface AuthContextValue {
  session: Session | null;
  isAuthenticated: boolean;
  ready: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
}

const STORAGE_KEY = "numm.session.v1";
const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readStored());
    setReady(true);
  }, []);

  const signIn = useCallback((next: Session) => {
    setSession(next);
    try {
      const store = next.remember ? window.localStorage : window.sessionStorage;
      store.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable in this environment */
    }
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: !!session, ready, signIn, signOut }),
    [session, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function newSessionId() {
  return `SES-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function authenticate(identifier: string, password: string) {
  const id = identifier.trim().toLowerCase();
  return (
    ACCOUNTS.find(
      (a) => (a.email === id || a.email.split("@")[0] === id) && a.password === password,
    ) ?? null
  );
}
