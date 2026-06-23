import { supabase } from "@/integrations/supabase/client";

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  code: string;
  price: number;
  brand: string | null;
  image_url: string | null;
  generated_studio_image: string | null;
  generated_installed_image: string | null;
  short_description: string | null;
  family_id: string | null;
  type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  color: string | null;
  material: string | null;
  finish: string | null;
  app_keywords: string[] | null;
};

export type TaxonomyNode = { id: string; name: string; slug: string };

export async function fetchTaxonomy() {
  const [types, categories, subcategories] = await Promise.all([
    supabase.from("product_types").select("id,name,slug").order("name"),
    supabase.from("categories").select("id,name,slug,type_id").order("name"),
    supabase.from("subcategories").select("id,name,slug,category_id").order("name"),
  ]);
  if (types.error) throw types.error;
  if (categories.error) throw categories.error;
  if (subcategories.error) throw subcategories.error;
  return {
    types: types.data ?? [],
    categories: categories.data ?? [],
    subcategories: subcategories.data ?? [],
  };
}

export type FeedFilters = {
  type?: string;
  category?: string;
  subcategory?: string;
  q?: string;
};

export async function fetchFeedProducts(filters: FeedFilters): Promise<ProductRow[]> {
  let query = supabase
    .from("products")
    .select(
      "id,slug,name,code,price,brand,image_url,generated_studio_image,generated_installed_image,short_description,family_id,type_id,category_id,subcategory_id,color,material,finish,app_keywords",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(60);

  if (filters.type) {
    const { data } = await supabase
      .from("product_types")
      .select("id")
      .eq("slug", filters.type)
      .maybeSingle();
    if (data?.id) query = query.eq("type_id", data.id);
  }
  if (filters.category) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.category)
      .maybeSingle();
    if (data?.id) query = query.eq("category_id", data.id);
  }
  if (filters.subcategory) {
    const { data } = await supabase
      .from("subcategories")
      .select("id")
      .eq("slug", filters.subcategory)
      .maybeSingle();
    if (data?.id) query = query.eq("subcategory_id", data.id);
  }
  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim();
    query = query.or(
      [
        `name.ilike.%${term}%`,
        `code.ilike.%${term}%`,
        `color.ilike.%${term}%`,
        `material.ilike.%${term}%`,
        `finish.ilike.%${term}%`,
        `short_description.ilike.%${term}%`,
      ].join(","),
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchProductBySlug(slug: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchRelatedProducts(familyId: string | null, excludeId: string) {
  if (!familyId) return [];
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,slug,name,code,price,brand,image_url,generated_studio_image,generated_installed_image,short_description,family_id,type_id,category_id,subcategory_id,color,material,finish,app_keywords",
    )
    .eq("is_published", true)
    .eq("family_id", familyId)
    .neq("id", excludeId)
    .limit(6);
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}
