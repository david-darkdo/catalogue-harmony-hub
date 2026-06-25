import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAppSettings, waLink } from "@/lib/settings";
import { toast } from "sonner";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Compass,
  Bookmark,
} from "lucide-react";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Stoneworks — Premium Building Materials Showroom" },
      {
        name: "description",
        content:
          "Stoneworks is your curated showroom for tiles, doors, plumbing and finishes. Browse, save and chat with our team on WhatsApp.",
      },
      { property: "og:title", content: "Stoneworks — Building Materials Showroom" },
      {
        property: "og:description",
        content: "Curated tiles, doors, plumbing and finishes.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: s } = useAppSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s?.sales_whatsapp) {
      toast.error("Sales WhatsApp not configured yet");
      return;
    }
    setBusy(true);
    try {
      const msg = `Hi! My name is ${name}. Please reach me at ${phone}.`;
      window.open(waLink(s.sales_whatsapp, msg), "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp…");
      setName("");
      setPhone("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      {/* Hero */}
      <section className="container-app pt-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3 w-3" /> Curated Showroom
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Premium tiles, doors & finishes — chosen with care.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Browse the catalog, save what you love to a private collection, and send it
            straight to our sales team on WhatsApp.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/feed"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Compass className="h-4 w-4" /> Explore Feed <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/collection"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-primary hover:text-primary"
            >
              <Bookmark className="h-4 w-4" /> My Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Company / Contact section */}
      <section className="container-app mt-10">
        <h2 className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Get in touch
        </h2>
        <h3 className="mt-1 font-display text-2xl font-semibold">Visit our showroom</h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Talk to our specialists for samples, quotes, or design advice. We reply fast on
          WhatsApp during business hours.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {s?.support_whatsapp && (
              <a
                href={waLink(s.support_whatsapp, "Hi! I have a question.")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary"
              >
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Support WhatsApp
                  </div>
                  <div className="font-medium">{s.support_whatsapp}</div>
                </div>
              </a>
            )}
            {s?.sales_whatsapp && s.sales_whatsapp !== s.support_whatsapp && (
              <a
                href={waLink(s.sales_whatsapp, "Hi! I'd like to discuss a project.")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary"
              >
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Sales WhatsApp
                  </div>
                  <div className="font-medium">{s.sales_whatsapp}</div>
                </div>
              </a>
            )}
            {s?.company_email && (
              <a
                href={`mailto:${s.company_email}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary"
              >
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email
                  </div>
                  <div className="font-medium">{s.company_email}</div>
                </div>
              </a>
            )}
            {s?.company_address && (
              <a
                href={s.map_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary"
              >
                <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Showroom
                  </div>
                  <div className="font-medium">{s.company_address}</div>
                </div>
              </a>
            )}
            <div className="flex gap-3 pt-1">
              {s?.facebook_url && (
                <a
                  href={s.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-primary hover:text-primary"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              {s?.instagram_url && (
                <a
                  href={s.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-primary hover:text-primary"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {s?.tiktok_url && (
                <a
                  href={s.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border text-xs font-bold hover:border-primary hover:text-primary"
                >
                  TT
                </a>
              )}
            </div>
          </div>

          <form
            onSubmit={submit}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h3 className="font-display text-lg font-semibold">Request a callback</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We'll WhatsApp you back within business hours.
            </p>
            <div className="mt-4 space-y-3">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send request"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
