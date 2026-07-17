import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useAppSettings, waLink } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
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
      { title: "Enreach Concepts — Premium Building Materials Showroom" },
      {
        name: "description",
        content:
          "Enreach Concepts is your curated showroom for tiles, security doors, plumbing and custom finishes. Browse, save and request project callback.",
      },
      { property: "og:title", content: "Enreach Concepts — Building Materials Showroom" },
      {
        property: "og:description",
        content: "Curated premium tiles, security doors and finishes.",
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

  // Hero Videos State
  const [heroVideos, setHeroVideos] = useState<any[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Swipe gesture hooks
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    const fetchVideos = async () => {
      const { data } = await supabase
        .from("hero_videos")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (data && data.length > 0) {
        setHeroVideos(data);
      } else {
        // Fallback default stock videos if none are registered
        setHeroVideos([
          { id: "1", url: "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-39908-large.mp4" },
          { id: "2", url: "https://assets.mixkit.co/videos/preview/mixkit-architectural-model-design-details-39909-large.mp4" },
          { id: "3", url: "https://assets.mixkit.co/videos/preview/mixkit-spinning-architectural-plans-39910-large.mp4" }
        ]);
      }
    };
    void fetchVideos();
  }, []);

  const handleVideoEnded = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % heroVideos.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      setCurrentVideoIndex((prev) => (prev + 1) % heroVideos.length);
    } else if (isRightSwipe) {
      setCurrentVideoIndex((prev) => (prev - 1 + heroVideos.length) % heroVideos.length);
    }
  };

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
      {/* Hero Video Carousel Banner */}
      <section
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative w-full h-[65vh] overflow-hidden bg-black"
      >
        {heroVideos.length > 0 && (
          <div className="absolute inset-0 w-full h-full">
            <video
              key={heroVideos[currentVideoIndex]?.id || currentVideoIndex}
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              className="w-full h-full object-cover transition-all duration-700 opacity-80"
              src={heroVideos[currentVideoIndex]?.url}
              preload="auto"
            />
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          </div>
        )}

        {/* Content Overlays */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 text-white">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary animate-pulse" /> Curated Luxury Showroom
            </span>

            <h1 className="font-display text-3xl font-extrabold sm:text-5xl leading-tight tracking-tight uppercase">
              Enreach Concepts
            </h1>
            <p className="font-display text-lg sm:text-xl text-primary font-semibold">
              Premium Tiles, Security Doors & Interior Finishes
            </p>
            <p className="text-xs text-gray-300 max-w-lg leading-relaxed">
              Explore custom building materials selected for professional builders and premium developments. Save your favorite designs and chat directly with our Abuja team.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-lg"
              >
                <Compass className="h-4 w-4" /> Discover Catalogue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/collection"
                className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/10 backdrop-blur px-5 py-3 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition"
              >
                <Bookmark className="h-4 w-4" /> Project Collections
              </Link>
            </div>
          </div>

          {/* Dots Indicator */}
          {heroVideos.length > 1 && (
            <div className="absolute bottom-4 right-6 sm:right-12 flex gap-1.5 z-10">
              {heroVideos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentVideoIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentVideoIndex === i ? "w-6 bg-primary" : "w-1.5 bg-white/40"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
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

        <div className="mt-6 grid gap-6 lg:grid-cols-2 pb-10">
          <div className="space-y-3">
            {s?.support_whatsapp && (
              <a
                href={waLink(s.support_whatsapp, "Hi! I have a question.")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary transition"
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
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary transition"
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
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary transition"
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
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary transition"
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
                  className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-primary hover:text-primary transition"
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
                  className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-primary hover:text-primary transition"
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
                  className="grid h-10 w-10 place-items-center rounded-full border border-border text-xs font-bold hover:border-primary hover:text-primary transition"
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
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition"
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
