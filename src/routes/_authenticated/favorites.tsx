import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Heart, Trash2, ShoppingBag, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "My Favorites — Showroom" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const loadFavorites = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          product_id,
          product:products (
            id,
            name,
            slug,
            images,
            price,
            code,
            category
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (user?.id) void loadFavorites();
  }, [user?.id]);

  const removeFavorite = async (productId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (error) throw error;
      toast.success("Product removed from favorites");
      void loadFavorites();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading || busy) return <div className="container-app py-12 text-sm text-muted-foreground">Loading favorites…</div>;

  return (
    <div className="container-app py-8 space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary fill-primary" />
          My Favorites
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your curated shortlist of luxury finishes, designs, and architectural materials.</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl space-y-4">
          <Heart className="h-10 w-10 text-muted-foreground mx-auto" />
          <div>
            <h2 className="font-semibold text-foreground text-sm">No favorited items yet</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Explore our design collections and click the heart icon on products you love to save them here.</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition"
          >
            Browse Catalogue
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const prod = item.product;
            if (!prod) return null;
            const img = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : "/placeholder.png";

            return (
              <div key={prod.id} className="group relative rounded-lg border border-border bg-card overflow-hidden flex flex-col justify-between shadow-sm transition hover:shadow-md">
                <div className="relative aspect-square bg-muted overflow-hidden">
                  <img 
                    src={img} 
                    alt={prod.name} 
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105" 
                  />
                  <button 
                    onClick={() => removeFavorite(prod.id)}
                    className="absolute top-2 right-2 rounded-full p-2 bg-background/80 hover:bg-background text-destructive transition shadow"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider block">{prod.category}</span>
                    <Link to="/product/$slug" params={{ slug: prod.slug }} className="font-semibold text-foreground hover:underline text-sm block truncate mt-0.5">
                      {prod.name}
                    </Link>
                    <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">Code: {prod.code || "—"}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-border mt-3">
                    <span className="font-bold text-foreground text-sm">
                      {prod.price ? `$${Number(prod.price).toLocaleString()}` : "Price on Request"}
                    </span>
                    <Link 
                      to="/product/$slug" 
                      params={{ slug: prod.slug }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-wider hover:underline"
                    >
                      View Details
                      <ShoppingBag className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
