import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchProductsByIds,
  getGuestCollection,
  getUserCollectionItems,
  ensureUserCollection,
  removeGuestItem,
  removeItemFromUserCollection,
} from "@/lib/collection";
import { useAppSettings, waLink } from "@/lib/settings";
import { toast } from "sonner";
import { MessageCircle, Share2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/collection")({
  head: () => ({ meta: [{ title: "My Collection — Stoneworks" }] }),
  component: CollectionPage,
});

function CollectionPage() {
  const { user, loading } = useAuth();
  const { data: settings } = useAppSettings();
  const [items, setItems] = useState<{ product_id: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (user) {
        const { collection_id, items } = await getUserCollectionItems(user.id);
        setCollectionId(collection_id);
        setItems(items);
        setProducts(await fetchProductsByIds(items.map((i) => i.product_id)));
      } else {
        const guest = getGuestCollection();
        setItems(guest);
        setProducts(await fetchProductsByIds(guest.map((g) => g.product_id)));
        setCollectionId(null);
      }
    };
    if (!loading) load();
  }, [user, loading, refreshKey]);

  const remove = async (productId: string) => {
    if (user) await removeItemFromUserCollection(user.id, productId);
    else removeGuestItem(productId);
    setRefreshKey((k) => k + 1);
  };

  const pushToWhatsApp = async () => {
    if (!settings?.sales_whatsapp) {
      toast.error("Sales WhatsApp not configured");
      return;
    }
    let id = collectionId;
    if (!id && user) id = await ensureUserCollection(user.id);
    const shareUrl = id
      ? `${window.location.origin}/collection/${id}`
      : window.location.origin + "/collection";
    const lines = [
      "Hi! I'm interested in these products from Stoneworks:",
      ...products.map((p) => `• ${p.name} (Code: ${p.code})`),
      "",
      `View my full collection: ${shareUrl}`,
    ];
    const msg = lines.join("\n");
    window.open(waLink(settings.sales_whatsapp, msg), "_blank", "noopener,noreferrer");
  };

  const shareLink = async () => {
    let id = collectionId;
    if (!id && user) id = await ensureUserCollection(user.id);
    if (!id) {
      toast("Sign in to share your collection by link");
      return;
    }
    const url = `${window.location.origin}/collection/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="container-app py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">My Collection</h1>
          <p className="text-sm text-muted-foreground">
            {user ? "Synced to your account" : "Saved on this device — sign in to sync"}
          </p>
        </div>
        {!user && (
          <Link to="/auth" className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10">
            Sign in
          </Link>
        )}
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Your collection is empty.</p>
          <Link to="/" className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Browse products
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={pushToWhatsApp}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <MessageCircle className="h-4 w-4" /> Push to WhatsApp
            </button>
            <button
              onClick={shareLink}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-surface-2"
            >
              <Share2 className="h-4 w-4" /> Share link
            </button>
          </div>

          <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <Link to="/product/$slug" params={{ slug: p.slug }} className="block h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  <img src={p.generated_studio_image || p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to="/product/$slug" params={{ slug: p.slug }} className="block truncate font-medium hover:text-primary">
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">Code · {p.code}</p>
                </div>
                <div className="text-right text-sm font-semibold">${Number(p.price).toFixed(2)}</div>
                <button onClick={() => remove(p.id)} aria-label="Remove" className="rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
