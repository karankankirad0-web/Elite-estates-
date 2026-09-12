# Elite Estates — Supabase-backed build

This is Part 1 (the public site you already reviewed) wired to a real Supabase
backend, plus an admin-only dashboard at `/admin`. **Nothing in this
environment can reach the internet**, so none of this has been run against a
live Supabase project or `npm install`ed — everything below is written code
that is ready to run, not something that's already been tested end-to-end.
Treat the checklist in "Testing" as your to-do list, not a report of results.

## 1. Project layout

```
index.html                 Public site (Part 1 design, unchanged) — now module-based
admin/login.html            Admin login page
admin/dashboard.html        Admin dashboard shell (sidebar + topbar)
src/lib/supabaseClient.js   Single shared Supabase client
src/lib/adminAuth.js        Admin-only auth helpers (no customer auth anywhere)
src/lib/schemaCapabilities.js  Runtime check for the optional deal_type column
src/public/main.js          Public site logic: loads data from Supabase, wires forms
src/admin/*.js              One module per dashboard section
src/styles/admin.css        Admin dashboard styles (same design tokens as the public site)
supabase/01_schema.sql      Your exact schema — used verbatim
supabase/02_storage_policies.sql   Required addition — see below
supabase/03_optional_deal_type.sql Optional addition — see below
supabase/04_admin_security.sql     Required addition — see below
```

## 2. Deviations from your exact SQL — all additive

Your schema is used **exactly as provided** in `01_schema.sql`. Three more
files exist alongside it:

- **`02_storage_policies.sql` (required).** Your schema creates the four
  storage buckets as `public = true`, which makes uploaded files readable by
  anyone — but it never grants permission to *upload/replace/delete* files.
  `storage.objects` has Row Level Security on by default in every Supabase
  project, so without this file every image upload in the admin dashboard
  fails with a permissions error. This file only adds `storage.objects`
  policies; it does not touch any table from `01_schema.sql`.

- **`03_optional_deal_type.sql` (optional).** Your schema has no column for
  "for sale" vs. "for rent," but the Part 1 frontend has a Buy/Rent filter
  and a "For Sale"/"For Rent" tag on every card. Run this file and that
  filter works against real data. Skip it and the app still works fine —
  every property just shows as "For Sale," and the Rent filter returns no
  results. The code checks at runtime (`src/lib/schemaCapabilities.js`)
  whether the column exists and adapts either way, so it's genuinely safe to
  skip.

- **`04_admin_security.sql` (required).** `01_schema.sql`'s admin policies
  grant full read/write on every admin table to **any** authenticated
  Supabase user (`to authenticated using (true)`). That's a real gap: if a
  second account ever gets an auth session — a mistaken invite, a future
  sign-up flow, a leaked password — it gets full admin access, including
  customer inquiries, appointments, and newsletter emails. This file adds a
  `public.admin_users` table and a `public.is_admin()` check, replaces those
  policies with ones that require `is_admin() = true`, and locks storage
  writes down the same way. It does not change any public-facing read/insert
  behavior — visitors, forms, and the public site work exactly as before.

Run them in order: `01` → `02` → `04` → (`03` if you want Buy/Rent; order
relative to `04` doesn't matter).

## 3. Setup

1. Create a Supabase project.
2. In the SQL editor, run `supabase/01_schema.sql`, then
   `supabase/02_storage_policies.sql`, then `supabase/04_admin_security.sql`,
   then optionally `supabase/03_optional_deal_type.sql`.
3. In **Authentication → Providers → Email**, turn **off** "Allow new users
   to sign up." This app never calls `signUp()`, and admin access is now
   enforced at the database level regardless — but disabling sign-ups
   removes the possibility of stray authenticated (non-admin) accounts
   entirely.
4. Create your admin account:
   - **Authentication → Users → Add user** (or invite by email). Use a real
     email you control.
   - Copy that user's **UUID** from the Users table.
   - In the SQL editor, run:
     ```sql
     insert into public.admin_users (id, email)
     values ('PASTE-THE-USER-UUID-HERE', 'admin@yourcompany.com');
     ```
     Replace both values with your real admin account's UUID and email.
     Until this row exists, that account can sign in but is treated as a
     non-admin everywhere in the app.
5. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Project Settings → API.
   - `VITE_ADMIN_EMAILS` — the email(s) from step 4, comma-separated. This is
     a UX nicety on top of the database check (see `src/lib/adminAuth.js`),
     not the security boundary itself — you can leave it blank.
6. `npm install`
7. `npm run dev` — the public site is at `/`, admin login at `/admin/login.html`.
8. `npm run build` — outputs `main`, `adminLogin`, and `adminDashboard` as
   separate HTML entry points (configured in `vite.config.js`).

**Adding a second admin later:** repeat step 4 for the new account — create
the Supabase Auth user, then insert their UUID/email into `admin_users`.
**Removing an admin:** delete their row from `admin_users` (or delete the
Auth user entirely); their existing session loses admin access on its next
`is_admin()` check.

## 4. What's demo content vs. real data

- **Properties, blog posts, testimonials** now come entirely from Supabase.
  There's no seed data — the site will show empty/loading states until you
  add some through `/admin`.
- **Team members and the Privacy/Terms modals** are still static placeholder
  content in `src/public/main.js` (`openTeamModal`, `openLegalModal`) — no
  table was requested for these, so they weren't wired up. Replace the
  hardcoded arrays there if/when you want them to be real.
- **Website Settings** (company name, hero copy, phone/email/WhatsApp,
  address, social links, about text, logo) all read from `site_settings` and
  are editable from `/admin` → Website Settings. The schema seeds one
  default row automatically.

## 5. Testing checklist

Run through this after step 7 above, against your real project:

**Auth**
- [ ] Log in at `/admin/login.html` with your admin account (the one in `admin_users`)
- [ ] Refresh the dashboard — session persists
- [ ] Log out — redirected to login, can't get back into `/admin/dashboard.html` without logging in again
- [ ] Create a second Supabase Auth user that is **not** in `admin_users` and
      try logging in with it — should be signed out immediately with "not
      authorized," and never see dashboard data

**Properties**
- [ ] Add a property, upload 2–3 images, reorder them, remove one
- [ ] Toggle Featured and Active/Inactive from the table
- [ ] Edit and delete a property (confirm the images disappear from Storage too)
- [ ] New property appears on the public site's Properties section
- [ ] Search/filter/Buy-Rent/min-max price/bedrooms all narrow the results
- [ ] "See More" loads additional cards without a page reload

**Inquiries / Appointments**
- [ ] Submit the public contact form — row appears in `/admin` → Inquiries
- [ ] Submit "Schedule Visit" from a property modal — row appears in Appointments
- [ ] Change statuses from the admin tables; confirm delete works

**Newsletter**
- [ ] Subscribe with a new email — success message, row in Newsletter
- [ ] Subscribe again with the same email — "already subscribed" message
- [ ] Export CSV from the admin Newsletter section

**Testimonials / Blog**
- [ ] Add + publish a testimonial — appears in the public slider
- [ ] Unpublish it — disappears from the public site
- [ ] Same for a blog post (Read More modal shows full content)

**Website Settings**
- [ ] Change phone/email/WhatsApp number, save, confirm the public site's
      contact links and WhatsApp buttons update
- [ ] Upload a logo — replaces the dot icon in the header/footer
- [ ] Set a YouTube URL — the footer YouTube icon appears (hidden otherwise)

**Security**
- [ ] Confirm `.env` is not committed (it's in `.gitignore`)
- [ ] In the browser devtools Network tab, confirm no `service_role` key
      appears anywhere in frontend requests (only the anon key should)
- [ ] From an incognito window (no session at all), confirm you can submit
      the contact/newsletter/appointment forms but cannot read `inquiries`,
      `appointments`, or `newsletter_subscribers` via the Supabase client
      (RLS should block it)
- [ ] Signed in as the **non-admin** account from the Auth checklist above,
      confirm direct `supabase.from('inquiries').select('*')`-style calls in
      the browser console return empty/error, not data — same for
      `appointments`, `newsletter_subscribers`, and writes to `properties`,
      `testimonials`, `blog_posts`, `site_settings`
- [ ] Signed in as that same non-admin account, confirm
      `supabase.storage.from('property-images').upload(...)` fails
- [ ] Confirm `admin_users` itself returns nothing to
      `supabase.from('admin_users').select('*')` from any client session,
      admin included (it's only ever read through `is_admin()`)

**General**
- [ ] No errors in the browser console on either the public site or `/admin`
- [ ] Mobile widths (375–414px) for both the public site and the admin dashboard
- [ ] 
