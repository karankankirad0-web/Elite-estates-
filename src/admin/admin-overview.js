import { supabase } from '../lib/supabaseClient.js';
import { errorStateHTML } from './admin-common.js';

async function countRows(table, applyFilter) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (applyFilter) query = applyFilter(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function render(container) {
  container.innerHTML = `
    <div class="stat-grid" id="statGrid">
      ${statCardSkeleton('fa-house', 'Total Properties')}
      ${statCardSkeleton('fa-star', 'Featured Properties')}
      ${statCardSkeleton('fa-envelope', 'New Inquiries')}
      ${statCardSkeleton('fa-calendar-check', 'Pending Appointments')}
      ${statCardSkeleton('fa-at', 'Newsletter Subscribers')}
      ${statCardSkeleton('fa-quote-left', 'Published Testimonials')}
      ${statCardSkeleton('fa-newspaper', 'Published Posts')}
    </div>
    <div class="panel" style="padding:24px;">
      <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.7;">
        Use the sidebar to manage properties, respond to inquiries and appointment requests,
        curate testimonials and blog posts, and review newsletter subscribers.
      </p>
    </div>
  `;

  try {
    const [total, featured, newInquiries, pendingAppts, subscribers, publishedTestimonials, publishedPosts] = await Promise.all([
      countRows('properties'),
      countRows('properties', (q) => q.eq('featured', true)),
      countRows('inquiries', (q) => q.eq('status', 'New')),
      countRows('appointments', (q) => q.eq('status', 'Pending')),
      countRows('newsletter_subscribers'),
      countRows('testimonials', (q) => q.eq('published', true)),
      countRows('blog_posts', (q) => q.eq('published', true))
    ]);

    const values = [total, featured, newInquiries, pendingAppts, subscribers, publishedTestimonials, publishedPosts];
    container.querySelectorAll('.stat-value').forEach((el, i) => { el.textContent = values[i]; });
  } catch (err) {
    console.error('[admin-overview] failed to load stats:', err.message);
    document.getElementById('statGrid').innerHTML = errorStateHTML(
      'Could not load dashboard stats. Confirm your Supabase project is reachable and RLS policies are applied.'
    );
  }
}

function statCardSkeleton(icon, label) {
  return `
    <div class="stat-card">
      <div class="stat-label"><span class="stat-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>${label}</div>
      <div class="stat-value">—</div>
    </div>`;
}
