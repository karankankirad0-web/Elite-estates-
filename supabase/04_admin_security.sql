-- ============================================
-- 04. ADMIN SECURITY (database-enforced admin authorization)
-- ============================================
-- Why this file exists: 01_schema.sql grants full read/write on every
-- admin table to ANY authenticated Supabase user
--   ( to authenticated using (true) with check (true) )
-- That is only safe if you never allow public sign-ups and only ever
-- create admin accounts by hand. This migration removes that assumption
-- and replaces it with real database-level authorization: a table of
-- admin user ids, a security-definer helper function, and RLS policies
-- that check it directly.
--
-- Safe to run after 01_schema.sql, 02_storage_policies.sql, and
-- 03_optional_deal_type.sql. Additive/idempotent — does not drop or
-- alter any table, column, or data. Only policies are replaced.
-- ============================================
-- 1. ADMIN USERS TABLE
-- ============================================
create table if not exists public.admin_users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique not null,
    created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- No public policies on admin_users at all: nothing here is readable or
-- writable by anon/authenticated. Only is_admin() (security definer,
-- below) can read it, and only the project owner via the Supabase
-- Dashboard / service_role can write to it.
-- ============================================
-- 2. ADMIN CHECK FUNCTION
-- ============================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.admin_users
        where id = auth.uid()
    );
$$;
-- Lock down execute rights, then grant only to authenticated. Every policy
-- that calls is_admin() is itself scoped "to authenticated" (see below), so
-- the anon role never needs to invoke this function at all.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
-- ============================================
-- 3. DROP THE OLD "ANY AUTHENTICATED USER" POLICIES
-- ============================================
-- These are the insecure `to authenticated using (true) with check (true)`
-- policies created in 01_schema.sql. Public read/insert policies from
-- 01_schema.sql are untouched and remain exactly as they were.
drop policy if exists "Authenticated users manage properties" on public.properties;
drop policy if exists "Authenticated users manage property images" on public.property_images;
drop policy if exists "Authenticated users manage inquiries" on public.inquiries;
drop policy if exists "Authenticated users manage appointments" on public.appointments;
drop policy if exists "Authenticated users manage newsletter" on public.newsletter_subscribers;
drop policy if exists "Authenticated users manage testimonials" on public.testimonials;
drop policy if exists "Authenticated users manage blog posts" on public.blog_posts;
drop policy if exists "Authenticated users manage site settings" on public.site_settings;
-- ============================================
-- 4. NEW ADMIN-ONLY POLICIES
-- ============================================
-- Public SELECT/INSERT policies from 01_schema.sql already cover the
-- public-facing behavior (active properties, published testimonials,
-- published blog posts, inserting inquiries/appointments/newsletter
-- signups, reading site settings). We only add the admin side here.
-- ---- properties ----
create policy "Admins manage properties"
on public.properties
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ---- property_images ----
create policy "Admins manage property images"
on public.property_images
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ---- inquiries ----
-- Public INSERT stays open (from 01_schema.sql). Only admins can read,
-- update, or delete inquiry data.
create policy "Admins manage inquiries"
on public.inquiries
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ---- appointments ----
create policy "Admins manage appointments"
on public.appointments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ---- newsletter_subscribers ----
create policy "Admins manage newsletter"
on public.newsletter_subscribers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ---- testimonials ----
create policy "Admins manage testimonials"
on public.testimonials
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ---- blog_posts ----
create policy "Admins manage blog posts"
on public.blog_posts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ---- site_settings ----
-- Public SELECT stays open (from 01_schema.sql, required so the public
-- website can render the logo, hero text, contact details, etc). Only
-- admins can insert/update/delete.
create policy "Admins manage site settings"
on public.site_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- ============================================
-- 5. STORAGE SECURITY
-- ============================================
-- 02_storage_policies.sql granted upload/update/delete on all four
-- buckets to ANY authenticated user. Replace those with admin-only
-- write access. Public read access is untouched.
drop policy if exists "Authenticated users upload bucket files" on storage.objects;
drop policy if exists "Authenticated users update bucket files" on storage.objects;
drop policy if exists "Authenticated users delete bucket files" on storage.objects;
create policy "Admins upload bucket files"
on storage.objects
for insert
to authenticated
with check (
    bucket_id in ('property-images','testimonial-images','blog-images','site-assets')
    and public.is_admin()
);
create policy "Admins update bucket files"
on storage.objects
for update
to authenticated
using (
    bucket_id in ('property-images','testimonial-images','blog-images','site-assets')
    and public.is_admin()
)
with check (
    bucket_id in ('property-images','testimonial-images','blog-images','site-assets')
    and public.is_admin()
);
create policy "Admins delete bucket files"
on storage.objects
for delete
to authenticated
using (
    bucket_id in ('property-images','testimonial-images','blog-images','site-assets')
    and public.is_admin()
);
-- "Public can read bucket files" (SELECT, anon+authenticated) from
-- 02_storage_policies.sql is untouched — public visitors still see
-- listed property/testimonial/blog images and site assets.
-- ============================================
-- 6. NEWSLETTER: PREVENT DUPLICATE SUBSCRIPTIONS
-- ============================================
-- newsletter_subscribers.email already has a UNIQUE constraint from
-- 01_schema.sql, so duplicate INSERTs already fail at the database
-- level. Nothing further required here; noted for the audit checklist.
-- ============================================
-- DONE
-- ============================================
-- After running this file:
--   * No table has a "to authenticated using (true)" admin policy left.
--   * Every admin CRUD path requires public.is_admin() = true.
--   * Every storage write path requires public.is_admin() = true.
--   * admin_users itself is unreadable/unwritable from the client.
--   * Public read/insert behavior from 01_schema.sql is unchanged.
--
-- Next step: see the "Creating your first admin user" section in
-- README.md to insert your own row into admin_users.
