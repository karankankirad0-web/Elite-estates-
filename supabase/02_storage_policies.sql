-- Storage policies for Elite Estates
-- Safe baseline: public read only. Admin write permissions are added by 04_admin_security.sql.

insert into storage.buckets (id, name, public)
values
  ('property-images', 'property-images', true),
  ('testimonial-images', 'testimonial-images', true),
  ('blog-images', 'blog-images', true),
  ('site-assets', 'site-assets', true)
on conflict (id) do update set public = excluded.public;

-- Public visitors may read public bucket files.
drop policy if exists "Public can read bucket files" on storage.objects;
create policy "Public can read bucket files"
on storage.objects
for select
to anon, authenticated
using (bucket_id in ('property-images','testimonial-images','blog-images','site-assets'));

-- Do NOT grant authenticated users write access here.
-- 04_admin_security.sql creates admin-only INSERT/UPDATE/DELETE policies.
