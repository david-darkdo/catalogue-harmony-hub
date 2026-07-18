import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  addGuestItem,
  addItemToUserCollection,
  getGuestCollection,
  getUserCollectionItems,
  removeGuestItem,
  removeItemFromUserCollection,
} from "@/lib/collection";

export function AddToCollectionButton({
  productId,
  className,
  compact = false,
}: {
  productId: string;
  className?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (user) {
        const { items } = await getUserCollectionItems(user.id);
        if (!cancelled) setSaved(items.some((i) => i.product_id === productId));
      } else {
        setSaved(getGuestCollection().some((i) => i.product_id === productId));
      }
    };
    refresh();
    const onChange = () => refresh();
    window.addEventListener("collection:change", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("collection:change", onChange);
    };
  }, [productId, user]);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let currentCount = 0;
      if (user) {
        const { items } = await getUserCollectionItems(user.id);
        currentCount = items.length;
      } else {
        currentCount = getGuestCollection().length;
      }

      if (!user) {
        // Save guest item, then prompt login
        if (!saved) {
          addGuestItem(productId);
          setSaved(true);
          const nextCount = currentCount + 1;
          toast.success(`+${nextCount}`, {
            description: "Sign in to sync across devices.",
            action: { label: "Sign in", onClick: () => navigate({ to: "/auth" }) },
          });
        } else {
          removeGuestItem(productId);
          setSaved(false);
        }
      } else {
        if (!saved) {
          await addItemToUserCollection(user.id, productId);
          setSaved(true);
          window.dispatchEvent(new Event("collection:change"));
          const nextCount = currentCount + 1;
          toast.success(`+${nextCount}`);
        } else {
          await removeItemFromUserCollection(user.id, productId);
          setSaved(false);
          window.dispatchEvent(new Event("collection:change"));
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update collection");
    } finally {
      setBusy(false);
    }
  };

  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        className ??
        `flex flex-1 items-center justify-center gap-1 rounded-md border ${
          saved
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-surface-2 text-foreground hover:border-primary hover:text-primary"
        } px-2 py-1.5 text-[11px] font-medium transition`
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {compact ? (saved ? "Saved" : "Save") : saved ? "In Collection" : "Add to Collection"}
    </button>
  );
}
