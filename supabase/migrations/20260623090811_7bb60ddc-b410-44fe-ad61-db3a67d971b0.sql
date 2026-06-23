
-- Product Types
INSERT INTO public.product_types (name, slug) VALUES
  ('Tiles','tiles'),('Doors','doors'),('Plumbing','plumbing'),('Stains','stains');

-- Categories
INSERT INTO public.categories (type_id, name, slug)
SELECT id,'Marble','marble' FROM public.product_types WHERE slug='tiles' UNION ALL
SELECT id,'Granite','granite' FROM public.product_types WHERE slug='tiles' UNION ALL
SELECT id,'Ceramics','ceramics' FROM public.product_types WHERE slug='tiles' UNION ALL
SELECT id,'Porcelain','porcelain' FROM public.product_types WHERE slug='tiles' UNION ALL
SELECT id,'Interior','interior-doors' FROM public.product_types WHERE slug='doors' UNION ALL
SELECT id,'Exterior','exterior-doors' FROM public.product_types WHERE slug='doors' UNION ALL
SELECT id,'Faucets','faucets' FROM public.product_types WHERE slug='plumbing' UNION ALL
SELECT id,'Sinks','sinks' FROM public.product_types WHERE slug='plumbing' UNION ALL
SELECT id,'Wood Stains','wood-stains' FROM public.product_types WHERE slug='stains';

-- Subcategories
INSERT INTO public.subcategories (category_id, name, slug)
SELECT id,'60x60 cm','60x60' FROM public.categories WHERE slug='marble' UNION ALL
SELECT id,'40x40 cm','40x40' FROM public.categories WHERE slug='marble' UNION ALL
SELECT id,'80x80 cm','80x80' FROM public.categories WHERE slug='granite' UNION ALL
SELECT id,'60x60 cm','60x60-ceramics' FROM public.categories WHERE slug='ceramics' UNION ALL
SELECT id,'Large Format','large' FROM public.categories WHERE slug='porcelain' UNION ALL
SELECT id,'Solid Wood','solid-wood' FROM public.categories WHERE slug='interior-doors' UNION ALL
SELECT id,'Steel','steel-exterior' FROM public.categories WHERE slug='exterior-doors' UNION ALL
SELECT id,'Kitchen','kitchen-faucets' FROM public.categories WHERE slug='faucets' UNION ALL
SELECT id,'Bathroom','bath-sinks' FROM public.categories WHERE slug='sinks' UNION ALL
SELECT id,'Oil-Based','oil-stains' FROM public.categories WHERE slug='wood-stains';

-- Family groups
INSERT INTO public.family_groups (subcategory_id, name, slug)
SELECT id,'Carrara Series','carrara-series' FROM public.subcategories WHERE slug='60x60' UNION ALL
SELECT id,'Calacatta Series','calacatta-series' FROM public.subcategories WHERE slug='60x60' UNION ALL
SELECT id,'Mosaic Collection','mosaic-collection' FROM public.subcategories WHERE slug='40x40' UNION ALL
SELECT id,'Imperial Granite','imperial-granite' FROM public.subcategories WHERE slug='80x80' UNION ALL
SELECT id,'Urban Ceramics','urban-ceramics' FROM public.subcategories WHERE slug='60x60-ceramics' UNION ALL
SELECT id,'Slab Porcelain','slab-porcelain' FROM public.subcategories WHERE slug='large' UNION ALL
SELECT id,'Heritage Oak','heritage-oak' FROM public.subcategories WHERE slug='solid-wood' UNION ALL
SELECT id,'Fortress Steel','fortress-steel' FROM public.subcategories WHERE slug='steel-exterior' UNION ALL
SELECT id,'Chrome Pro','chrome-pro' FROM public.subcategories WHERE slug='kitchen-faucets' UNION ALL
SELECT id,'Vessel Line','vessel-line' FROM public.subcategories WHERE slug='bath-sinks' UNION ALL
SELECT id,'Heritage Stain','heritage-stain' FROM public.subcategories WHERE slug='oil-stains';

-- Products
WITH t AS (SELECT id,slug FROM public.product_types),
     c AS (SELECT id,slug FROM public.categories),
     s AS (SELECT id,slug FROM public.subcategories),
     f AS (SELECT id,slug FROM public.family_groups)
INSERT INTO public.products
  (family_id,type_id,category_id,subcategory_id,name,code,price,brand,stock_quantity,is_published,
   image_url,generated_studio_image,generated_installed_image,short_description,slug,
   app_keywords,color,material,finish)
VALUES
  ((SELECT id FROM f WHERE slug='carrara-series'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='marble'),(SELECT id FROM s WHERE slug='60x60'),
   'Carrara Gold Vein','CGV6060',125.00,'Stoneworks',120,true,
   'https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&q=80',
   'https://images.unsplash.com/photo-1615873968403-89e068629265?w=1200&q=80',
   'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
   'Luxurious Italian marble with warm gold veining on a cream base.','carrara-gold-vein',
   ARRAY['marble','tile','gold','cream','luxury'],'Cream','Marble','Polished'),

  ((SELECT id FROM f WHERE slug='calacatta-series'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='marble'),(SELECT id FROM s WHERE slug='60x60'),
   'Calacatta Nero','CN6060',145.00,'Stoneworks',80,true,
   'https://images.unsplash.com/photo-1604147706283-d7119b5b822c?w=800&q=80',
   'https://images.unsplash.com/photo-1604147706283-d7119b5b822c?w=1200&q=80',
   'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
   'Dramatic black marble with sweeping gold and white veining.','calacatta-nero',
   ARRAY['marble','tile','black','dramatic','luxury'],'Black','Marble','Polished'),

  ((SELECT id FROM f WHERE slug='mosaic-collection'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='marble'),(SELECT id FROM s WHERE slug='40x40'),
   'Mosaic Carrara','MC4040',85.00,'Stoneworks',200,true,
   'https://images.unsplash.com/photo-1556909114-4f5c4f5e8f55?w=800&q=80',
   'https://images.unsplash.com/photo-1556909114-4f5c4f5e8f55?w=1200&q=80',
   'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
   'White carrara mosaic, perfect for bathroom feature walls.','mosaic-carrara',
   ARRAY['mosaic','marble','white','bathroom'],'White','Marble','Matte'),

  ((SELECT id FROM f WHERE slug='mosaic-collection'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='marble'),(SELECT id FROM s WHERE slug='40x40'),
   'Geometric Inlay','GI4040',95.00,'Stoneworks',150,true,
   'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=800&q=80',
   'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=1200&q=80',
   'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c8?w=1200&q=80',
   'Hand-cut geometric marble inlay in classic black and white.','geometric-inlay',
   ARRAY['geometric','marble','inlay','classic'],'Multi','Marble','Honed'),

  ((SELECT id FROM f WHERE slug='imperial-granite'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='granite'),(SELECT id FROM s WHERE slug='80x80'),
   'Absolute Black Granite','ABG8080',98.00,'Stoneworks',90,true,
   'https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&q=80',
   'https://images.unsplash.com/photo-1615873968403-89e068629265?w=1200&q=80',
   'https://images.unsplash.com/photo-1600566753086-00f18fe6ba51?w=1200&q=80',
   'Deep, uniform black granite with a mirror polish.','absolute-black-granite',
   ARRAY['granite','black','polished'],'Black','Granite','Polished'),

  ((SELECT id FROM f WHERE slug='urban-ceramics'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='ceramics'),(SELECT id FROM s WHERE slug='60x60-ceramics'),
   'Urban Concrete Look','UCL6060',45.00,'CeramiCo',300,true,
   'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&q=80',
   'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=1200&q=80',
   'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
   'Modern industrial concrete-look ceramic tile.','urban-concrete-look',
   ARRAY['ceramic','concrete','industrial','grey'],'Grey','Ceramic','Matte'),

  ((SELECT id FROM f WHERE slug='slab-porcelain'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='porcelain'),(SELECT id FROM s WHERE slug='large'),
   'Statuario Slab','SS120',210.00,'Porcelano',40,true,
   'https://images.unsplash.com/photo-1600566753104-685f4f24cb4d?w=800&q=80',
   'https://images.unsplash.com/photo-1600566753104-685f4f24cb4d?w=1200&q=80',
   'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c8?w=1200&q=80',
   'Large-format porcelain slab with statuario marble look.','statuario-slab',
   ARRAY['porcelain','slab','large-format','marble-look'],'White','Porcelain','Polished'),

  ((SELECT id FROM f WHERE slug='heritage-oak'),(SELECT id FROM t WHERE slug='doors'),(SELECT id FROM c WHERE slug='interior-doors'),(SELECT id FROM s WHERE slug='solid-wood'),
   'Heritage Oak Door','HOD-01',520.00,'Woodcraft',25,true,
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
   'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80',
   'Solid European oak interior door with brass fittings.','heritage-oak-door',
   ARRAY['door','oak','wood','interior'],'Natural','Solid Oak','Satin'),

  ((SELECT id FROM f WHERE slug='fortress-steel'),(SELECT id FROM t WHERE slug='doors'),(SELECT id FROM c WHERE slug='exterior-doors'),(SELECT id FROM s WHERE slug='steel-exterior'),
   'Fortress Steel Entry','FSE-02',890.00,'IronGate',15,true,
   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80',
   'https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?w=1200&q=80',
   'Reinforced steel entry door with multi-point lock.','fortress-steel-entry',
   ARRAY['door','steel','exterior','security'],'Charcoal','Steel','Powder Coat'),

  ((SELECT id FROM f WHERE slug='chrome-pro'),(SELECT id FROM t WHERE slug='plumbing'),(SELECT id FROM c WHERE slug='kitchen-faucets'),(SELECT id FROM s WHERE slug='kitchen-faucets'),
   'Chrome Pro Pull-Down','CPP-K1',265.00,'AquaForm',60,true,
   'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80',
   'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&q=80',
   'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80',
   'High-arc kitchen faucet with magnetic pull-down spray.','chrome-pro-pull-down',
   ARRAY['faucet','kitchen','chrome','pull-down'],'Chrome','Stainless Steel','Polished'),

  ((SELECT id FROM f WHERE slug='vessel-line'),(SELECT id FROM t WHERE slug='plumbing'),(SELECT id FROM c WHERE slug='bath-sinks'),(SELECT id FROM s WHERE slug='bath-sinks'),
   'Vessel Stone Sink','VSS-B1',340.00,'AquaForm',35,true,
   'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80',
   'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80',
   'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&q=80',
   'Hand-carved stone vessel sink for statement bathrooms.','vessel-stone-sink',
   ARRAY['sink','bath','vessel','stone'],'Stone','Travertine','Honed'),

  ((SELECT id FROM f WHERE slug='heritage-stain'),(SELECT id FROM t WHERE slug='stains'),(SELECT id FROM c WHERE slug='wood-stains'),(SELECT id FROM s WHERE slug='oil-stains'),
   'Heritage Walnut Stain','HWS-1L',38.00,'ColorMaster',500,true,
   'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
   'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=80',
   'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80',
   'Deep walnut oil-based wood stain, 1L.','heritage-walnut-stain',
   ARRAY['stain','wood','walnut','oil'],'Walnut','Oil-Based','Satin'),

  ((SELECT id FROM f WHERE slug='heritage-stain'),(SELECT id FROM t WHERE slug='stains'),(SELECT id FROM c WHERE slug='wood-stains'),(SELECT id FROM s WHERE slug='oil-stains'),
   'Heritage Mahogany Stain','HMS-1L',38.00,'ColorMaster',420,true,
   'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80',
   'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=1200&q=80',
   'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80',
   'Rich mahogany oil-based wood stain, 1L.','heritage-mahogany-stain',
   ARRAY['stain','wood','mahogany','oil'],'Mahogany','Oil-Based','Satin'),

  ((SELECT id FROM f WHERE slug='carrara-series'),(SELECT id FROM t WHERE slug='tiles'),(SELECT id FROM c WHERE slug='marble'),(SELECT id FROM s WHERE slug='60x60'),
   'Carrara Bianco Classic','CBC6060',115.00,'Stoneworks',140,true,
   'https://images.unsplash.com/photo-1600566753086-00f18fe6ba51?w=800&q=80',
   'https://images.unsplash.com/photo-1600566753086-00f18fe6ba51?w=1200&q=80',
   'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
   'Classic white carrara marble with soft grey veining.','carrara-bianco-classic',
   ARRAY['marble','tile','white','classic'],'White','Marble','Polished');
