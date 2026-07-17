import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, Trash2, X, AlertCircle } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

import { fetchAppSettings } from "@/lib/settings";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    try {
      const settings = await fetchAppSettings();
      return { settings };
    } catch {
      return { settings: null };
    }
  },
  head: ({ loaderData }) => {
    const settings = loaderData?.settings;
    const googleVerify = settings?.google_site_verification;
    const bingVerify = settings?.bing_site_verification;

    const meta = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#2f5240" },
      { title: "Enreach Concepts — Luxury Building Materials Showroom" },
      {
        name: "description",
        content: "Discover luxury tiles, security doors, plumbing, lighting and custom finishes. Curated premium building materials at Enreach Concepts Abuja.",
      },
      { property: "og:title", content: "Enreach Concepts — Luxury Building Materials Showroom" },
      {
        property: "og:description",
        content: "A curated catalogue of premium tiles, doors and finishes — built for professional builders and custom residential developments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Enreach Concepts — Luxury Building Materials Showroom" },
      { name: "twitter:description", content: "A curated catalogue of premium tiles, doors and finishes — built for professional builders." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ba69082-2120-4fe0-8bd9-30559a2bcb96/id-preview-5c7dab40--90df874f-a60f-4339-93a0-e225dd750696.lovable.app-1782681475617.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0ba69082-2120-4fe0-8bd9-30559a2bcb96/id-preview-5c7dab40--90df874f-a60f-4339-93a0-e225dd750696.lovable.app-1782681475617.png" },
    ];

    if (googleVerify) {
      meta.push({ name: "google-site-verification", content: googleVerify });
    }
    if (bingVerify) {
      meta.push({ name: "msvalidate.01", content: bingVerify });
    }

    return {
      meta,
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/icon-512.png" },
        { rel: "icon", href: "/icon-512.png", type: "image/png" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootAppWrapper />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootAppWrapper() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // 1. Log path tracking and register push device on load / transition
  useEffect(() => {
    if (!user?.id) return;

    // Track page views
    const trackView = async () => {
      await supabase.from("customer_activity").insert({
        user_id: user.id,
        activity_type: pathname === "/" ? "homepage_viewed" : "page_viewed",
        metadata: { path: pathname, timestamp: new Date().toISOString() }
      });
    };
    void trackView();

    // Register active PWA mock push device token for testing notifications
    const registerDevice = async () => {
      const mockToken = `web_pwa_token_${user.id.substring(0, 8)}_${navigator.userAgent.replace(/[^a-zA-Z0-9]/g, "").substring(0, 16)}`;
      await supabase.from("communication_devices").upsert({
        user_id: user.id,
        token: mockToken,
        device_type: "web_pwa",
        os_version: navigator.platform,
        browser: navigator.userAgent.includes("Chrome") ? "Chrome" : "Safari",
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "token" });
    };
    void registerDevice();
  }, [user?.id, pathname]);

  // 2. Fetch user push alerts for the notification center
  const loadNotifications = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("communication_queue")
      .select("*")
      .eq("user_id", user.id)
      .eq("channel_type", "push")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data);
    }
  };

  useEffect(() => {
    if (user?.id && showNotifications) {
      void loadNotifications();
    }
  }, [user?.id, showNotifications]);

  const clearNotification = async (id: string) => {
    await supabase.from("communication_queue").delete().eq("id", id);
    void loadNotifications();
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Centralized Global Header Notification Center Button */}
      {user && (
        <div className="fixed top-3 right-20 z-50">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-full p-2 bg-muted hover:bg-muted/80 text-foreground transition shadow border border-border"
          >
            <Bell className="h-4 w-4" />
            {notifications.filter(n => n.status === "PENDING").length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2.5 w-80 rounded-lg border border-border bg-card shadow-xl p-4 text-xs space-y-3 z-50">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-foreground">In-App Notifications</span>
                <button onClick={() => setShowNotifications(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-2 border border-border rounded bg-background flex gap-2 relative group">
                    <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{notif.subject || "Alert"}</div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{notif.body}</p>
                    </div>
                    <button 
                      onClick={() => clearNotification(notif.id)}
                      className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="text-muted-foreground italic text-center py-4">No notifications yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Outlet />
    </div>
  );
}
