-- Public-site content managed from the CRM: the photo gallery (categories -> event albums -> images)
-- and blog posts. The marketing site reads published rows with the anon key (RLS below limits it to
-- published content); only staff with the 'site-gallery' module can write gallery content, and only
-- super admins can write blog posts. Additive: no existing table or policy is changed.

-- ───────── gallery ─────────
create table public.site_gallery_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.site_gallery_albums (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.site_gallery_categories(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  event_date date,
  is_published boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index site_gallery_albums_category_idx on public.site_gallery_albums (category_id);

create table public.site_gallery_images (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.site_gallery_albums(id) on delete cascade,
  full_path text not null,
  thumb_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  caption text not null default '',
  is_published boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index site_gallery_images_album_idx on public.site_gallery_images (album_id, created_at);

-- ───────── blog ─────────
create table public.site_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text not null default '',
  category text not null default 'General',
  author text not null default 'EGIRE Team',
  content_md text not null default '',
  cover_path text,
  read_minutes integer not null default 5 check (read_minutes between 1 and 120),
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── privileges: anon may only read; RLS does the rest ─────────
revoke all on public.site_gallery_categories, public.site_gallery_albums, public.site_gallery_images, public.site_blog_posts
  from anon, authenticated;
grant select on public.site_gallery_categories, public.site_gallery_albums, public.site_gallery_images, public.site_blog_posts
  to anon, authenticated;
grant insert, update, delete on public.site_gallery_categories, public.site_gallery_albums, public.site_gallery_images, public.site_blog_posts
  to authenticated;

-- ───────── RLS ─────────
alter table public.site_gallery_categories enable row level security;
alter table public.site_gallery_albums enable row level security;
alter table public.site_gallery_images enable row level security;
alter table public.site_blog_posts enable row level security;

-- categories: names are public; gallery staff manage them
create policy site_gallery_categories_read on public.site_gallery_categories
  for select to anon, authenticated using (true);
create policy site_gallery_categories_write on public.site_gallery_categories
  for all to authenticated
  using (public.has_module_access('site-gallery', 'write'))
  with check (public.has_module_access('site-gallery', 'write'));

-- albums: the public sees published ones; gallery staff (read or write) also see drafts
create policy site_gallery_albums_read on public.site_gallery_albums
  for select to anon, authenticated
  using (is_published or public.has_module_access('site-gallery', 'read'));
create policy site_gallery_albums_write on public.site_gallery_albums
  for all to authenticated
  using (public.has_module_access('site-gallery', 'write'))
  with check (public.has_module_access('site-gallery', 'write'));

-- images: public only when both the image and its album are published
create policy site_gallery_images_read on public.site_gallery_images
  for select to anon, authenticated
  using (
    public.has_module_access('site-gallery', 'read')
    or (is_published and exists (select 1 from public.site_gallery_albums a where a.id = album_id and a.is_published))
  );
create policy site_gallery_images_write on public.site_gallery_images
  for all to authenticated
  using (public.has_module_access('site-gallery', 'write'))
  with check (public.has_module_access('site-gallery', 'write'));

-- blog: public sees published posts; only super admins read drafts or write
create policy site_blog_posts_read on public.site_blog_posts
  for select to anon, authenticated using (is_published or public.is_super_admin());
create policy site_blog_posts_write on public.site_blog_posts
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ───────── storage: public-read bucket, writes gated by the same rules ─────────
-- path convention: site-media/gallery/<album_id>/<uuid>.webp  and  site-media/blog/<uuid>.webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "site-media read" on storage.objects
  for select using (bucket_id = 'site-media');
create policy "site-media write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'site-media'
    and (
      ((storage.foldername(name))[1] = 'gallery' and public.has_module_access('site-gallery', 'write'))
      or ((storage.foldername(name))[1] = 'blog' and public.is_super_admin())
    )
  );
create policy "site-media update" on storage.objects
  for update to authenticated using (
    bucket_id = 'site-media'
    and (
      ((storage.foldername(name))[1] = 'gallery' and public.has_module_access('site-gallery', 'write'))
      or ((storage.foldername(name))[1] = 'blog' and public.is_super_admin())
    )
  );
create policy "site-media delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'site-media'
    and (
      ((storage.foldername(name))[1] = 'gallery' and public.has_module_access('site-gallery', 'write'))
      or ((storage.foldername(name))[1] = 'blog' and public.is_super_admin())
    )
  );

-- ───────── seed ─────────
insert into public.site_gallery_categories (name, slug, sort_order) values
  ('Team', 'team', 1),
  ('Workshops', 'workshops', 2),
  ('Flying', 'flying', 3),
  ('Events', 'events', 4)
on conflict (slug) do nothing;

-- default access for the new section; super admins always have write
insert into public.role_module_access (role, module_key, access_level) values
  ('admin', 'site-gallery', 'write'),
  ('coordinator', 'site-gallery', 'read'),
  ('instructor', 'site-gallery', 'read')
on conflict (role, module_key) do nothing;

-- the four posts that were bundled in the website, now editable from the CRM
insert into public.site_blog_posts (slug, title, excerpt, category, author, content_md, read_minutes, is_published, published_at)
values
  ($md$fresher-doubt-resolution$md$, $md$Doubt Resolutions for Freshers$md$, $md$Breaking into FPV without breaking the bank or getting overwhelmed. Everything you need to know to take your first flight.$md$, $md$Beginners$md$, $md$EGIRE Team$md$, $md$# Breaking into FPV: A Fresher's Guide

Starting out in FPV can feel like learning a new language. You have to understand KV ratings, VTX bands, Betaflight configurations, and PID tuning before you even get off the ground.

## Common Doubts Resolved

**1. Is FPV too expensive to start?**
Not anymore. While premium racing rigs can cost thousands, you can start with a competent micro-drone (like a "Tiny Whoop") and an entry-level radio for under $200. We highly recommend starting with a simulator like our built-in Physics engine to build muscle memory without repair costs.

**2. Will I crash?**
Yes. Everyone crashes. It is part of the hobby. That is exactly why we teach you how to build your drone from scratch. If you know how to assemble it, you know how to fix it when it breaks.

**3. Do I need to know how to code?**
No coding is required! The flight controller software (Betaflight) has a visual interface. You just need to follow configuration steps, not write code.

**Our Advice:** Start small, use a simulator, and don't skip the basics of battery safety.$md$, 5, true, '2026-06-24T00:00:00Z'),
  ($md$experienced-professionals$md$, $md$Upskilling for Experienced Professionals$md$, $md$How engineers and tech professionals can leverage FPV drone building to master embedded systems and aerodynamics.$md$, $md$Advanced$md$, $md$Lead Engineer$md$, $md$# Beyond the Hobby: FPV for Professionals

If you are already an engineer, software developer, or hardware enthusiast, FPV drones represent the ultimate sandbox for your skills. 

## The Technical Deep Dive

Building an FPV drone from the frame up touches on several engineering disciplines:

**Embedded Systems & Firmware**
Flight controllers run sophisticated RTOS (Real-Time Operating Systems). Understanding how gyro loops communicate with ESCs (Electronic Speed Controllers) via DSHOT protocols gives you hands-on experience with high-frequency control loops.

**RF Engineering**
Navigating the 5.8GHz analog or digital video spectrum involves understanding antenna polarization, multipathing, and signal penetration. 

**Aerodynamics & Physics**
Tuning PID controllers (Proportional-Integral-Derivative) to achieve locked-in flight performance requires a deep understanding of resonance, thrust-to-weight ratios, and mechanical filtering.

Whether you want to transition into the commercial drone industry or just need a highly technical hobby that challenges you, FPV provides a unique, multidisciplinary engineering challenge.$md$, 8, true, '2026-06-02T00:00:00Z'),
  ($md$tactical-fpv-army$md$, $md$Tactical FPV for Defense Personnel$md$, $md$Military and army applications, rugged builds, and strategic FPV operations in modern environments.$md$, $md$Defense$md$, $md$Tactical Operations$md$, $md$# FPV in Modern Defense Operations

The landscape of tactical reconnaissance and situational awareness has been fundamentally altered by the advent of FPV (First Person View) technology. 

## Tactical Advantages of FPV

Unlike traditional GPS-guided automated drones, FPV provides unparalleled agility and responsiveness. 

**1. GPS-Denied Environments**
Standard drones rely heavily on GPS. FPV pilots fly entirely manually (Acro mode), allowing them to operate deep inside buildings, dense forests, or environments where GPS signals are jammed or unavailable.

**2. Speed and Interception**
A specialized 5-inch FPV drone can exceed speeds of 150 km/h in seconds. This allows for rapid deployment, target interception, and evasion capabilities that traditional quadcopters cannot match.

**3. Rugged and Field-Repairable**
A tactical requirement is field maintainability. Carbon fiber FPV frames can survive massive impacts, and because they are modular, a damaged motor or arm can be replaced by a soldier in the field in minutes using standard tools.

Our platform provides the foundational knowledge required to build, maintain, and pilot these highly agile systems under demanding conditions.$md$, 6, true, '2026-06-15T00:00:00Z'),
  ($md$kids-can-fly$md$, $md$Kids Can Fly Too!$md$, $md$Safe, beginner-friendly paths for children to learn robotics, electronics, and aerodynamics through micro drones.$md$, $md$Education$md$, $md$Education Team$md$, $md$# Nurturing Future Engineers

You might look at a 100mph racing drone and think, "That is definitely not for my 10-year-old." You'd be right. But FPV is a massive spectrum, and the entry point is perfect for kids!

## The Tiny Whoop Revolution

"Tiny Whoops" are micro-drones that fit in the palm of your hand. They weigh less than 40 grams and have fully enclosed propeller guards. 

**Why they are perfect for kids:**
- **Utterly Safe:** They bounce off walls, TVs, and people without causing any damage.
- **STEM Learning:** Kids learn about batteries, circuits, radio frequencies, and physics without even realizing they are studying.
- **Hand-Eye Coordination:** Flying FPV builds spatial awareness and fine motor skills.

**How to Start:**
1. Get a basic gamepad-style radio controller.
2. Let them practice on an FPV Simulator on the computer.
3. Once they can hover, graduate to an indoor Tiny Whoop.

It is the most fun way to trick your kids into learning applied physics and electronics!$md$, 4, true, '2026-06-05T00:00:00Z')
on conflict (slug) do nothing;

