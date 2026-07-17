import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GUEST_KEY = "stoneworks.guest_collection";
const OFFLINE_ACTIONS_KEY = "stoneworks.offline_actions";
const CACHED_ITEMS_KEY_PREFIX = "stoneworks.cached_items_";

export type GuestItem = { product_id: string; added_at: string };

export type OfflineAction = {
  type: "add" | "remove";
  userId: string;
  productId: string;
  timestamp: string;
};

export function getGuestCollection(): GuestItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(GUEST_KEY) || "[]");
  } catch {
    return [];
  }
}

export function setGuestCollection(items: GuestItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("collection:change"));
}

export function addGuestItem(product_id: string) {
  const items = getGuestCollection();
  if (items.some((i) => i.product_id === product_id)) return items;
  const next = [...items, { product_id, added_at: new Date().toISOString() }];
  setGuestCollection(next);
  return next;
}

export function removeGuestItem(product_id: string) {
  const next = getGuestCollection().filter((i) => i.product_id !== product_id);
  setGuestCollection(next);
  return next;
}

// OFFLINE QUEUE UTILS
export function getOfflineActions(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(OFFLINE_ACTIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveOfflineActions(actions: OfflineAction[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_ACTIONS_KEY, JSON.stringify(actions));
}

export function queueOfflineAction(type: "add" | "remove", userId: string, productId: string) {
  const actions = getOfflineActions();
  const cleaned = actions.filter((a) => !(a.userId === userId && a.productId === productId));
  cleaned.push({
    type,
    userId,
    productId,
    timestamp: new Date().toISOString()
  });
  saveOfflineActions(cleaned);
}

export async function syncOfflineActions() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const actions = getOfflineActions();
  if (actions.length === 0) return;

  // Clear local outbox actions list so we do not double sync
  saveOfflineActions([]);

  for (const act of actions) {
    try {
      if (act.type === "add") {
        await addItemToUserCollection(act.userId, act.productId);
      } else {
        await removeItemFromUserCollection(act.userId, act.productId);
      }
    } catch (err) {
      console.error("Failed to sync offline collection action, re-queuing:", err);
      queueOfflineAction(act.type, act.userId, act.productId);
    }
  }

  window.dispatchEvent(new Event("collection:change"));
  toast.success("Synchronized offline collection changes!");
}

/** Get or create a "My Collection" for the signed-in user. */
export async function ensureUserCollection(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("collections")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: userId, name: "My Collection" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function addItemToUserCollection(userId: string, product_id: string) {
  const cacheKey = `${CACHED_ITEMS_KEY_PREFIX}${userId}`;
  
  if (typeof window !== "undefined" && !navigator.onLine) {
    queueOfflineAction("add", userId, product_id);
    try {
      const cached = JSON.parse(window.localStorage.getItem(cacheKey) || '{"items":[]}');
      if (!cached.items.some((i: any) => i.product_id === product_id)) {
        cached.items.push({ product_id, added_at: new Date().toISOString() });
        window.localStorage.setItem(cacheKey, JSON.stringify(cached));
      }
    } catch {}
    window.dispatchEvent(new Event("collection:change"));
    return "offline_col";
  }

  const collection_id = await ensureUserCollection(userId);
  await supabase
    .from("collection_items")
    .insert({ collection_id, product_id })
    .select()
    .maybeSingle();
  return collection_id;
}

export async function removeItemFromUserCollection(userId: string, product_id: string) {
  const cacheKey = `${CACHED_ITEMS_KEY_PREFIX}${userId}`;

  if (typeof window !== "undefined" && !navigator.onLine) {
    queueOfflineAction("remove", userId, product_id);
    try {
      const cached = JSON.parse(window.localStorage.getItem(cacheKey) || '{"items":[]}');
      cached.items = cached.items.filter((i: any) => i.product_id !== product_id);
      window.localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch {}
    window.dispatchEvent(new Event("collection:change"));
    return;
  }

  const collection_id = await ensureUserCollection(userId);
  await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collection_id)
    .eq("product_id", product_id);
}

export async function getUserCollectionItems(userId: string) {
  const cacheKey = `${CACHED_ITEMS_KEY_PREFIX}${userId}`;

  if (typeof window !== "undefined" && !navigator.onLine) {
    try {
      const cached = JSON.parse(window.localStorage.getItem(cacheKey) || "null");
      if (cached) return cached;
    } catch {}
  }

  const collection_id = await ensureUserCollection(userId);
  const { data, error } = await supabase
    .from("collection_items")
    .select("product_id, added_at, collection_id")
    .eq("collection_id", collection_id)
    .order("added_at", { ascending: false });
  if (error) throw error;
  
  const result = { collection_id, items: data ?? [] };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(cacheKey, JSON.stringify(result));
  }
  return result;
}

export async function mergeGuestIntoUser(userId: string) {
  const guest = getGuestCollection();
  if (!guest.length) return;
  const collection_id = await ensureUserCollection(userId);
  await supabase
    .from("collection_items")
    .upsert(
      guest.map((g) => ({ collection_id, product_id: g.product_id })),
      { onConflict: "collection_id,product_id", ignoreDuplicates: true },
    );
  setGuestCollection([]);
}

export async function fetchProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,name,code,price,brand,image_url,generated_studio_image,short_description"
    )
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}
