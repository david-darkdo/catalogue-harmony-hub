import { supabase } from "@/integrations/supabase/client";

const GUEST_KEY = "stoneworks.guest_collection";

export type GuestItem = { product_id: string; added_at: string };

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

/** Get or create a "My Collection" for the signed-in user. Returns collection id. */
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
  const collection_id = await ensureUserCollection(userId);
  await supabase
    .from("collection_items")
    .insert({ collection_id, product_id })
    .select()
    .maybeSingle();
  return collection_id;
}

export async function removeItemFromUserCollection(userId: string, product_id: string) {
  const collection_id = await ensureUserCollection(userId);
  await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collection_id)
    .eq("product_id", product_id);
}

export async function getUserCollectionItems(userId: string) {
  const collection_id = await ensureUserCollection(userId);
  const { data, error } = await supabase
    .from("collection_items")
    .select("product_id, added_at, collection_id")
    .eq("collection_id", collection_id)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return { collection_id, items: data ?? [] };
}

/** Merge any guest items into the user's collection on sign-in. */
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
      "id,slug,name,code,price,brand,image_url,generated_studio_image,short_description",
    )
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}
