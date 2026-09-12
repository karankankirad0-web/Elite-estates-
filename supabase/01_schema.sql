-- ============================================
-- ELITE ESTATES - SUPABASE DATABASE SCHEMA
-- ============================================
-- This file is used EXACTLY as provided. Do not edit table/column/policy
-- definitions here — additive, clearly-labeled files (02 and 03) handle the
-- two small gaps needed to make the app fully functional. See README.md.
create extension if not exists "pgcrypto";
-- ============================================
-- 1. SITE SETTINGS
-- ============================================
create table if not exists public.site_settings (
    id uuid primary key default gen_random_uuid(),
    company_name text not null default 'Elite Estates',
    logo_url text,
    owner_name text,
    phone text,
    email text,
    whatsapp_number text,
    office_address text,
    city text,
    country text default 'India',
    google_maps_url text,
    instagram_url text,
    facebook_url text,
    youtube_url text,
    linkedin_url text,
    about_text text,
    hero_title text,
    hero_subtitle text,
    footer_text text,
    updated_at timestamptz not null default now()
);
-- ============================================
-- 2. PROPERTIES
-- ============================================
create table if not exists public.properties (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    slug text unique not null,
    location text,
    city text,
    property_type text,
    price numeric(15,2),
    bedrooms integer default 0,
    bathrooms integer default 0,
    area numeric(12,2),
    description text,
    amenities jsonb default '[]'::jsonb,
    featured boolean not null default false,
    status text not null default 'active'
        check (status in ('active', 'inactive', 'sold', 'rented')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
-- ============================================
-- 3. PROPERTY IMAGES
-- ============================================
create table if not exists public.property_images (
    id uuid primary key default gen_random_uuid(),
    property_id uuid not null
        references public.properties(id)
        on delete cascade,
    image_url text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);
-- ============================================
-- 4. INQUIRIES
-- ============================================
create table if not exists public.inquiries (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text,
    phone text,
    property_id uuid
        references public.properties(id)
        on delete set null,
    message text,
    status text not null default 'New'
        check (status in ('New', 'Contacted', 'Closed')),
    created_at timestamptz not null default now()
);
-- ============================================
-- 5. APPOINTMENTS
-- ============================================
create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text,
    phone text,
    property_id uuid
        references public.properties(id)
        on delete set null,
    preferred_date date not null,
    preferred_time time not null,
    message text,
    status text not null default 'Pending'
        check (
            status in (
                'Pending',
                'Confirmed',
                'Completed',
                'Cancelled'
            )
        ),
    created_at timestamptz not null default now()
);
-- ============================================
-- 6. NEWSLETTER SUBSCRIBERS
-- ============================================
create table if not exists public.newsletter_subscribers (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    created_at timestamptz not null default now()
);
-- ============================================
-- 7. TESTIMONIALS
-- ============================================
create table if not exists public.testimonials (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    role text,
    message text not null,
    rating integer not null default 5
        check (rating between 1 and 5),
    image_url text,
    published boolean not null default false,
    created_at timestamptz not null default now()
);
-- ============================================
-- 8. BLOG POSTS
-- ============================================
create table if not exists public.blog_posts (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    slug text unique not null,
    excerpt text,
    content text,
    image_url text,
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_properties_status
on public.properties(status);
create index if not exists idx_properties_featured
on public.properties(featured);
create index if not exists idx_properties_city
on public.properties(city);
create index if not exists idx_properties_property_type
on public.properties(property_type);
create index if not exists idx_property_images_property_id
on public.property_images(property_id);
create index if not exists idx_inquiries_status
on public.inquiries(status);
create index if not exists idx_inquiries_created_at
on public.inquiries(created_at desc);
create index if not exists idx_appointments_status
on public.appointments(status);
create index if not exists idx_appointments_preferred_date
on public.appointments(preferred_date);
create index if not exists idx_testimonials_published
on public.testimonials(published);
create index if not exists idx_blog_posts_published
on public.blog_posts(published);
-- ============================================
-- UPDATED_AT FUNCTION
-- ============================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
drop trigger if exists properties_updated_at
on public.properties;
create trigger properties_updated_at
before update on public.properties
for each row
execute function public.set_updated_at();
drop trigger if exists blog_posts_updated_at
on public.blog_posts;
create trigger blog_posts_updated_at
before update on public.blog_posts
for each row
execute function public.set_updated_at();
drop trigger if exists site_settings_updated_at
on public.site_settings;
create trigger site_settings_updated_at
before update on public.site_settings
for each row
execute function public.set_updated_at();
-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
alter table public.site_settings enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.inquiries enable row level security;
alter table public.appointments enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.testimonials enable row level security;
alter table public.blog_posts enable row level security;
-- ============================================
-- PUBLIC READ POLICIES
-- ============================================
create policy "Public can view active properties"
on public.properties
for select
to anon, authenticated
using (status = 'active');
create policy "Public can view property images"
on public.property_images
for select
to anon, authenticated
using (
    exists (
        select 1
        from public.properties p
        where p.id = property_images.property_id
        and p.status = 'active'
    )
);
create policy "Public can view published testimonials"
on public.testimonials
for select
to anon, authenticated
using (published = true);
create policy "Public can view published blog posts"
on public.blog_posts
for select
to anon, authenticated
using (published = true);
create policy "Public can view site settings"
on public.site_settings
for select
to anon, authenticated
using (true);
-- ============================================
-- PUBLIC INSERT POLICIES
-- ============================================
create policy "Public can submit inquiries"
on public.inquiries
for insert
to anon, authenticated
with check (true);
create policy "Public can submit appointments"
on public.appointments
for insert
to anon, authenticated
with check (true);
create policy "Public can subscribe newsletter"
on public.newsletter_subscribers
for insert
to anon, authenticated
with check (true);
-- ============================================
-- ADMIN POLICIES
-- ============================================
-- Authenticated admins can manage properties
create policy "Authenticated users manage properties"
on public.properties
for all
to authenticated
using (true)
with check (true);
create policy "Authenticated users manage property images"
on public.property_images
for all
to authenticated
using (true)
with check (true);
create policy "Authenticated users manage inquiries"
on public.inquiries
for all
to authenticated
using (true)
with check (true);
create policy "Authenticated users manage appointments"
on public.appointments
for all
to authenticated
using (true)
with check (true);
create policy "Authenticated users manage newsletter"
on public.newsletter_subscribers
for all
to authenticated
using (true)
with check (true);
create policy "Authenticated users manage testimonials"
on public.testimonials
for all
to authenticated
using (true)
with check (true);
create policy "Authenticated users manage blog posts"
on public.blog_posts
for all
to authenticated
using (true)
with check (true);
create policy "Authenticated users manage site settings"
on public.site_settings
for all
to authenticated
using (true)
with check (true);
-- ============================================
-- DEFAULT SITE SETTINGS
-- ============================================

insert into public.site_settings (
    company_name,
    country,
    hero_title,
    hero_subtitle
)
select
    'Elite Estates',
    'India',
    'Find Your Dream Property',
    'Premium properties selected for you'
where not exists (
    select 1 from public.site_settings
);


-- ============================================
-- STORAGE BUCKETS
-- ============================================

insert into storage.buckets (id, name, public)
values
    ('property-images', 'property-images', true),
    ('testimonial-images', 'testimonial-images', true),
    ('blog-images', 'blog-images', true),
    ('site-assets', 'site-assets', true)
on conflict (id) do nothing;
