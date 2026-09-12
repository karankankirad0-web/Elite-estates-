-- ============================================
-- 03. OPTIONAL: deal_type column (For Sale / For Rent)
-- ============================================
-- The exact schema you provided has no column for "for sale" vs "for rent",
-- but the Part 1 frontend has a Buy/Rent filter and a "For Sale"/"For Rent"
-- tag on every property card. Rather than silently changing your schema,
-- this is an OPTIONAL, additive migration:
--
--   • Run it  -> Buy/Rent filter and tags work against real data.
--   • Skip it -> the app still works. Every property just displays as
--                "For Sale" and the Rent filter returns no results.
--                (src/public/main.js and src/admin/admin-properties.js both
--                detect at runtime whether this column exists and adapt —
--                see the `hasDealType` capability check in
--                src/lib/schemaCapabilities.js.)

alter table public.properties
  add column if not exists deal_type text not null default 'sale'
  check (deal_type in ('sale', 'rent'));

create index if not exists idx_properties_deal_type on public.properties(deal_type);
