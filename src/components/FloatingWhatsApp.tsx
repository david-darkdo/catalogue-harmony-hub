import { useAppSettings, waLink } from "@/lib/settings";
import { MessageCircle } from "lucide-react";

export function FloatingWhatsApp() {
  const { data: settings } = useAppSettings();
  const phone = settings?.support_whatsapp;
  if (!phone) return null;
  return (
    <a
      href={waLink(phone, "Hi! I need help finding a product.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/15 transition hover:scale-105 hover:bg-primary/90"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
