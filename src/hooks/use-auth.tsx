import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

async function fetchRoles(userId: string | null | undefined): Promise<AppRole[]> {
  if (!userId) return [];
  // Prefer the SECURITY DEFINER helper so RLS recursion can't hide rows.
  const { data, error } = await supabase.rpc("get_my_roles");
  if (!error && Array.isArray(data)) return (data as string[]).filter(Boolean) as AppRole[];
  // Fallback: direct read (RLS allows users to view their own roles)
  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return ((rows ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async (u: User | null) => {
    const r = await fetchRoles(u?.id);
    setRoles(r);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[auth] current_user_id =", u?.id ?? null, "current_user_role =", r);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const u = data.session?.user ?? null;
      setUser(u);
      await loadRoles(u);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      await loadRoles(u);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadRoles]);

  const refreshRoles = useCallback(async () => {
    await loadRoles(user);
  }, [user, loadRoles]);

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
