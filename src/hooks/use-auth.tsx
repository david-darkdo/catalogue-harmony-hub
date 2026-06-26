import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "customer" | "admin" | "super_admin";

type AuthState = {
  user: User | null;
  loading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCustomer: boolean;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

// Resolve roles for a user. Safe Mode: if a signed-in user has no role row,
// try to backfill a `customer` row, and always fall back to ["customer"]
// in-memory so the UI never crashes on missing data.
async function fetchRoles(user: User | null | undefined): Promise<AppRole[]> {
  if (!user?.id) return [];
  try {
    const { data, error } = await supabase.rpc("get_my_roles");
    if (!error && Array.isArray(data) && data.length > 0) {
      return (data as string[]).filter(Boolean) as AppRole[];
    }
  } catch {
    /* ignore — fall through to direct read */
  }

  let rows: Array<{ role: AppRole }> | null = null;
  try {
    const res = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    rows = (res.data ?? null) as Array<{ role: AppRole }> | null;
  } catch {
    rows = null;
  }

  if (rows && rows.length > 0) return rows.map((r) => r.role);

  // No roles found → try to self-heal by inserting `customer`, but never
  // throw if RLS or the network blocks it.
  try {
    await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "customer" } as never);
  } catch {
    /* swallow */
  }
  return ["customer"];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const lastRoleUserId = useRef<string | null>(null);

  // Fire-and-forget role loader. Tracks the last user we resolved roles for
  // so a noisy stream of TOKEN_REFRESHED events does not re-fetch.
  const loadRolesFor = useCallback((u: User | null) => {
    if (!u) {
      lastRoleUserId.current = null;
      setRoles([]);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[auth] current_user_id =", null, "current_user_role =", []);
      }
      return;
    }
    if (lastRoleUserId.current === u.id) return;
    lastRoleUserId.current = u.id;
    void fetchRoles(u).then((r) => {
      setRoles(r);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[auth] current_user_id =", u.id, "current_user_role =", r);
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const u = data.session?.user ?? null;
        setUser(u);
        loadRolesFor(u);
      })
      .catch(() => {
        /* network/auth blip — proceed as anonymous */
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // IMPORTANT: do NOT await inside the auth state callback — it can deadlock
    // subsequent events (see auth race-condition guidance).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      loadRolesFor(u);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadRolesFor]);

  const refreshRoles = useCallback(async () => {
    lastRoleUserId.current = null;
    const r = await fetchRoles(user);
    setRoles(r);
  }, [user]);

  const value = useMemo<AuthState>(() => {
    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = isSuperAdmin || roles.includes("admin");
    return {
      user,
      loading,
      roles,
      isAdmin,
      isSuperAdmin,
      isCustomer: roles.includes("customer"),
      refreshRoles,
    };
  }, [user, loading, roles, refreshRoles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Safe default for callers outside provider (e.g. SSR initial render)
    return {
      user: null,
      loading: true,
      roles: [],
      isAdmin: false,
      isSuperAdmin: false,
      isCustomer: false,
      refreshRoles: async () => {},
    };
  }
  return ctx;
}
