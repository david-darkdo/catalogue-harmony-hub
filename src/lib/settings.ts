import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  id: string;
  support_whatsapp: string | null;
  sales_whatsapp: string | null;
  company_email: string | null;
  company_address: string | null;
  map_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
};

export async function fetchAppSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AppSettings | null;
}

export const APP_SETTINGS_QUERY_KEY = ["app_settings"] as const;

export function useAppSettings() {
  return useQuery({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: fetchAppSettings,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function waLink(rawPhone: string | null | undefined, message?: string) {
  if (!rawPhone) return "#";
  const phone = rawPhone.replace(/[^\d]/g, "");
  const base = `https://wa.me/${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
