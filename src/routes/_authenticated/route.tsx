import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw redirect({ to: "/auth" });
      }
      return { user: data.user };
    } catch (err) {
      // Safe Mode: any unexpected failure → redirect to sign-in instead of crashing.
      if (err && typeof err === "object" && "to" in (err as Record<string, unknown>)) {
        throw err;
      }
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
