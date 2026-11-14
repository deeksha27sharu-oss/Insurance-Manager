import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from "react";
import { apiPost } from "../api/client";
import { getTokenExpiryMs } from "../utils/jwt";

let lastActivityAt = Date.now();
let trackerInstalled = false;

function installActivityTracker() {
  if (trackerInstalled) return;
  trackerInstalled = true;

  const touch = () => { lastActivityAt = Date.now(); };
  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, touch, { passive: true })
  );
}

function getLastActivityAt() {
  return lastActivityAt;
}

const AuthContext = createContext(null);

const PROMPT_LEAD_MS = 60 * 1000;
const ACTIVE_WINDOW_MS = 10 * 60 * 1000; 
const PROMPT_TIMEOUT_MS = 5 * 60 * 1000; 

const CONFIRM_TEXT =
  "Your session has expired due to inactivity.\n" +
  "Click OK to stay signed in, Cancel to log out.";

export function AuthProvider({ children }) {
  const [role, setRole] = useState(sessionStorage.getItem("role") || null);
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const promptTimerRef = useRef(null);
  const promptOpenRef = useRef(false);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    installActivityTracker();
  }, []);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    try { await apiPost("/auth/logout", {}); } catch {}

    sessionStorage.clear();
    setRole(null);
    setUser(null);
    window.location.href = "/";
  }, []);

  const refreshAndReschedule = useCallback(() => {
    return apiPost("/auth/refresh", {})
      .then((data) => {
        if (!data?.token) throw new Error("No token returned");
        sessionStorage.setItem("token", data.token);
        if (data.customer) {
          const userData = {
            userId: data.customer._id,
            name: data.customer.name,
            username: data.customer.email,
          };
          sessionStorage.setItem("role", data.customer.role);
          sessionStorage.setItem("user", JSON.stringify(userData));
          setRole(data.customer.role);
          setUser(userData);
        }
        window.dispatchEvent(new Event("auth:token-refreshed"));
        scheduleExpiryPrompt(data.token);
        return data;
      })
      .catch((err) => {
        console.error("Token refresh failed:", err);
        logout();
        throw err;
      });
  }, [logout]); 

  const runExpiryPrompt = useCallback(() => {
    if (promptOpenRef.current) return;

    const sinceActivity = Date.now() - getLastActivityAt();
    const isActive = sinceActivity <= ACTIVE_WINDOW_MS;

    if (isActive) {
      refreshAndReschedule().catch(() => {  });
      return;
    }

    promptOpenRef.current = true;
    const openedAt = Date.now();
    const userSaysRefresh = window.confirm(CONFIRM_TEXT);
    const timeTaken = Date.now() - openedAt;
    promptOpenRef.current = false;

    if (timeTaken > PROMPT_TIMEOUT_MS) {
      logout();
      return;
    }
    if (!userSaysRefresh) {
      logout();
      return;
    }
    refreshAndReschedule().catch(() => {  });
  }, [logout, refreshAndReschedule]);

  const scheduleExpiryPrompt = useCallback((token) => {
    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    const expMs = getTokenExpiryMs(token);
    if (!expMs) {
      console.error("scheduleExpiryPrompt: token has no `exp` claim.");
      return;
    }

    const delay = expMs - Date.now() - PROMPT_LEAD_MS;
    if (delay <= 0) {
      promptTimerRef.current = setTimeout(() => runExpiryPrompt(), 0);
      return;
    }
    promptTimerRef.current = setTimeout(() => runExpiryPrompt(), delay);
  }, [runExpiryPrompt]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    scheduleExpiryPrompt(token);
    setIsLoading(false);
    return () => {
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }
    };
  }, [scheduleExpiryPrompt]);

  useEffect(() => {
    const onExpired = () => {
      if (promptOpenRef.current) return;
      runExpiryPrompt();
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [runExpiryPrompt]);

  const login = (newRole, userData, token) => {
    sessionStorage.setItem("role", newRole);
    sessionStorage.setItem("user", JSON.stringify(userData));
    sessionStorage.setItem("token", token);
    setRole(newRole);
    setUser(userData);
    scheduleExpiryPrompt(token);
  };

  return (
    <AuthContext.Provider
      value={{ role, user, isAuthenticated: !!role, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}