import { Link } from "@tanstack/react-router";
import { useAppSettings } from "@/lib/settings";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";

export function SiteFooter() {
  const { data: s } = useAppSettings();
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="container-app grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="font-display text-lg font-semibold">Stoneworks</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Curated building materials for serious projects.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Explore</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/" className="hover:text-primary">Feed</Link></li>
            <li><Link to="/search" search={{ q: "" }} className="hover:text-primary">Search</Link></li>
            <li><Link to="/collection" className="hover:text-primary">My Collection</Link></li>
            <li><Link to="/" className="hover:text-primary">Contact</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</div>
          <ul className="mt-3 space-y-2 text-sm">
            {s?.company_email && (
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><a href={`mailto:${s.company_email}`}>{s.company_email}</a></li>
            )}
            {s?.support_whatsapp && (
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />{s.support_whatsapp}</li>
            )}
            {s?.company_address && (
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-primary" /><span>{s.company_address}</span></li>
            )}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Social</div>
          <ul className="mt-3 flex gap-3">
            {s?.facebook_url && <li><a href={s.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-muted-foreground hover:text-primary"><Facebook className="h-5 w-5" /></a></li>}
            {s?.instagram_url && <li><a href={s.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-muted-foreground hover:text-primary"><Instagram className="h-5 w-5" /></a></li>}
            {s?.tiktok_url && <li><a href={s.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-muted-foreground hover:text-primary text-sm font-bold">TT</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Stoneworks. All rights reserved.
      </div>
    </footer>
  );
}
