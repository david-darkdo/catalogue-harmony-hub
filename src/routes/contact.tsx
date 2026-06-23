import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppSettings, waLink } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Stoneworks" },
      { name: "description", content: "Get in touch with our showroom team. WhatsApp, email, and visit details." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: s } = useAppSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Stub collection id is not required — but RLS requires non-null collection_id.
      // Create a one-off "inquiry collection" for the lead.
      const { data: col, error: e1 } = await supabase
        .from("collections")
        .insert({ user_id: "00000000-0000-0000-0000-000000000000", name: `Inquiry from ${name}` })
        .select("id")
        .maybeSingle();
      // If RLS blocks anon insert into collections, fall back to direct contact.
      if (e1 || !col) {
        const msg = `Hi! My name is ${name}. Please reach me at ${phone}.`;
        window.open(waLink(s?.sales_whatsapp, msg), "_blank", "noopener,noreferrer");
        return;
      }
      await supabase.from("whatsapp_inquiries").insert({
        collection_id: col.id,
        customer_name: name,
        customer_phone: phone,
        status: "new",
      });
      toast.success("Thanks — we'll be in touch shortly");
      setName(""); setPhone("");
    } catch (err) {
      toast.error("Couldn't submit — please WhatsApp us directly");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-app py-8">
      <h1 className="font-display text-3xl font-semibold">Contact</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visit our showroom or message us — we reply fast.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {s?.support_whatsapp && (
            <a href={waLink(s.support_whatsapp, "Hi! I have a question.")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary">
              <MessageCircle className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Support WhatsApp</div>
                <div className="font-medium">{s.support_whatsapp}</div>
              </div>
            </a>
          )}
          {s?.sales_whatsapp && s.sales_whatsapp !== s.support_whatsapp && (
            <a href={waLink(s.sales_whatsapp, "Hi! I'd like to discuss a project.")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Sales WhatsApp</div>
                <div className="font-medium">{s.sales_whatsapp}</div>
              </div>
            </a>
          )}
          {s?.company_email && (
            <a href={`mailto:${s.company_email}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Email</div>
                <div className="font-medium">{s.company_email}</div>
              </div>
            </a>
          )}
          {s?.company_address && (
            <a href={s.map_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Showroom</div>
                <div className="font-medium">{s.company_address}</div>
              </div>
            </a>
          )}
          <div className="flex gap-3 pt-2">
            {s?.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-primary hover:text-primary"><Facebook className="h-4 w-4" /></a>}
            {s?.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid h-10 w-10 place-items-center rounded-full border border-border hover:border-primary hover:text-primary"><Instagram className="h-4 w-4" /></a>}
            {s?.tiktok_url && <a href={s.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="grid h-10 w-10 place-items-center rounded-full border border-border text-xs font-bold hover:border-primary hover:text-primary">TT</a>}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Request a callback</h2>
          <p className="mt-1 text-xs text-muted-foreground">We'll WhatsApp you back within business hours.</p>
          <div className="mt-4 space-y-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <button disabled={busy} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
