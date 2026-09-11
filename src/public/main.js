import { supabase } from '../lib/supabaseClient.js';
import { tableHasColumn } from '../lib/schemaCapabilities.js';
/* =========================================================
   CONFIG — overwritten at runtime by site_settings (see applySiteSettings)
   ========================================================= */
const SITE_CONFIG = {
  phoneDisplay: '+1 (415) 555-0148',
  phoneHref: 'tel:+14155550148',
  emailDisplay: 'hello@eliteestates.com',
  whatsappNumber: '14155550148',
  socials: { instagram: '', linkedin: '', facebook: '', youtube: '' }
};
const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23E4F2F0'/%3E%3Cpath d='M200 90 L280 150 L265 150 L265 220 L215 220 L215 175 L185 175 L185 220 L135 220 L135 150 L120 150 Z' fill='%2312867C' opacity='0.5'/%3E%3C/svg%3E";
/* =========================================================
   UTILITIES
   ========================================================= */
function $(sel, ctx){ return (ctx||document).querySelector(sel); }
function $all(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }
function escapeHTML(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}
function formatPrice(p){
  return '$' + Number(p.price || 0).toLocaleString('en-US') + (p.priceUnit || '');
}
function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidPhone(phone){
  return /^[0-9+()\-\s]{7,20}$/.test(phone);
}
/* Global image fallback — keeps the page intact if an external/storage image fails to load */
document.addEventListener('error', function(e){
  const t = e.target;
  if(t && t.tagName === 'IMG' && !t.dataset.fallbackApplied){
    t.dataset.fallbackApplied = 'true';
    t.src = FALLBACK_IMG;
    t.classList.add('img-fallback');
  }
}, true);
/* =========================================================
   TOAST SYSTEM
   ========================================================= */
function showToast(message, type){
  const root = $('#toastRoot');
  const toast = document.createElement('div');
  toast.className = 'toast' + (type === 'error' ? ' error' : '');
  toast.innerHTML = '<i class="fa-solid ' + (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check') + '" aria-hidden="true"></i><span></span>';
  toast.querySelector('span').textContent = message;
  root.appendChild(toast);
  requestAnimationFrame(function(){ toast.classList.add('show'); });
  setTimeout(function(){
    toast.classList.remove('show');
    setTimeout(function(){ toast.remove(); }, 300);
  }, 4200);
}
function openWhatsApp(message){
  const url = 'https://wa.me/' + SITE_CONFIG.whatsappNumber + '?text=' + encodeURIComponent(message);
  window.open(url, '_blank', 'noopener');
}
/* =========================================================
   SITE SETTINGS — loaded from Supabase, applied to the DOM
   ========================================================= */
async function loadSiteSettings(){
  const { data, error } = await supabase.from('site_settings').select('*').limit(1).maybeSingle();
  if(error){ console.error('[main] could not load site_settings:', error.message); return null; }
  return data;
}
function applySiteSettings(s){
  if(!s) return;
  if(s.company_name){
    ['companyNameHeader','companyNameFooter'].forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.textContent = s.company_name;
    });
    document.title = document.title.replace('Elite Estates', s.company_name);
  }
  if(s.hero_title){ const el = document.getElementById('heroTitle'); if(el) el.textContent = s.hero_title; }
  if(s.hero_subtitle){ const el = document.getElementById('heroSubtitle'); if(el) el.textContent = s.hero_subtitle; }
  if(s.footer_text){ const el = document.getElementById('footerDescText'); if(el) el.textContent = s.footer_text; }
  if(s.about_text){ const el = document.getElementById('aboutText'); if(el) el.textContent = s.about_text; }
  if(s.phone){
    SITE_CONFIG.phoneDisplay = s.phone;
    SITE_CONFIG.phoneHref = 'tel:' + s.phone.replace(/[^\d+]/g, '');
    const link = document.getElementById('contactPhoneLink');
    const text = document.getElementById('contactPhoneText');
    if(link) link.href = SITE_CONFIG.phoneHref;
    if(text) text.textContent = s.phone;
  }
  if(s.email){
    SITE_CONFIG.emailDisplay = s.email;
    const link = document.getElementById('contactEmailLink');
    const text = document.getElementById('contactEmailText');
    if(link) link.href = 'mailto:' + s.email;
    if(text) text.textContent = s.email;
  }
  if(s.whatsapp_number){
    SITE_CONFIG.whatsappNumber = s.whatsapp_number.replace(/[^\d]/g, '');
  }
  if(s.office_address || s.city || s.country){
    const addressText = [s.office_address, s.city, s.country].filter(Boolean).join(', ');
    const el = document.getElementById('contactAddressText');
    if(el && addressText) el.textContent = addressText;
    const iframe = document.getElementById('officeMapIframe');
    if(iframe && !s.google_maps_url && addressText){
      iframe.src = 'https://www.google.com/maps?q=' + encodeURIComponent(addressText) + '&output=embed';
    }
  }
  if(s.google_maps_url){
    const iframe = document.getElementById('officeMapIframe');
    if(iframe) iframe.src = s.google_maps_url;
  }
  SITE_CONFIG.socials.instagram = s.instagram_url || '';
  SITE_CONFIG.socials.linkedin = s.linkedin_url || '';
  SITE_CONFIG.socials.facebook = s.facebook_url || '';
  SITE_CONFIG.socials.youtube = s.youtube_url || '';
  if(s.youtube_url){
    const btn = document.getElementById('youtubeSocialBtn');
    if(btn) btn.hidden = false;
  }
  if(s.logo_url){
    $all('.logo .mark, .footer-logo .mark').forEach(function(dot){
      const img = document.createElement('img');
      img.src = s.logo_url;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.style.cssText = 'width:22px;height:22px;border-radius:6px;object-fit:cover;';
      dot.replaceWith(img);
    });
  }
}
/* =========================================================
   PROPERTIES — loaded from Supabase (properties + property_images)
   ========================================================= */
let PROPERTIES = [];
let hasDealType = false;
let propertiesLoadError = null;
async function loadProperties(){
  hasDealType = await tableHasColumn('properties', 'deal_type');
  const selectCols = hasDealType
    ? '*, deal_type, property_images(id, image_url, sort_order)'
    : '*, property_images(id, image_url, sort_order)';
  const { data, error } = await supabase
    .from('properties')
    .select(selectCols)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if(error){
    propertiesLoadError = error.message;
    console.error('[main] could not load properties:', error.message);
    PROPERTIES = [];
    return;
  }
  PROPERTIES = (data || []).map(function(row){
    const images = (row.property_images || [])
      .slice()
      .sort(function(a, b){ return a.sort_order - b.sort_order; })
      .map(function(img){ return img.image_url; });
    const isRent = hasDealType && row.deal_type === 'rent';
    const location = [row.location, row.city].filter(Boolean).join(', ');
    return {
      id: row.id,
      title: row.title,
      location: location || row.city || row.location || 'Location on request',
      price: Number(row.price) || 0,
      priceUnit: isRent ? '/mo' : '',
      type: row.property_type || 'Property',
      status: isRent ? 'For Rent' : 'For Sale',
      beds: row.bedrooms || 0,
      baths: row.bathrooms || 0,
      area: Number(row.area) || 0,
      images: images.length ? images : [FALLBACK_IMG],
      description: row.description || '',
      amenities: Array.isArray(row.amenities) ? row.amenities : []
    };
  });
}
/* =========================================================
   FAVORITES (localStorage — customers have no accounts, by design)
   ========================================================= */
const FAVORITES_KEY = 'eliteEstatesFavorites';
function getFavorites(){
  try{ return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; }catch(e){ return []; }
}
function saveFavorites(arr){
  try{ localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr)); }catch(e){ /* storage unavailable */ }
}
function isFavorite(id){ return getFavorites().indexOf(id) > -1; }
function toggleFavorite(id){
  let favs = getFavorites();
  const idx = favs.indexOf(id);
  const prop = PROPERTIES.find(function(p){ return p.id === id; });
  if(idx > -1){
    favs.splice(idx, 1);
    showToast((prop ? prop.title : 'Property') + ' removed from favorites');
  } else {
    favs.push(id);
    showToast((prop ? prop.title : 'Property') + ' added to favorites');
  }
  saveFavorites(favs);
  refreshFavoriteUI();
}
function refreshFavoriteUI(){
  const favs = getFavorites();
  $all('.fav-btn').forEach(function(btn){
    const id = btn.getAttribute('data-fav-id');
    const active = favs.indexOf(id) > -1;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    const prop = PROPERTIES.find(function(p){ return p.id === id; });
    const name = prop ? prop.title : 'this property';
    btn.setAttribute('aria-label', (active ? 'Remove ' : 'Add ') + name + (active ? ' from favorites' : ' to favorites'));
    const icon = btn.querySelector('i');
    if(icon) icon.className = active ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  });
  const favCount = $('#favCount');
  const favCountStat = $('#favCountStat');
  if(favCount) favCount.textContent = String(favs.length);
  if(favCountStat) favCountStat.textContent = String(favs.length);
}
/* =========================================================
   PROPERTY CARD RENDERING, SEARCH & PAGINATION
   ========================================================= */
const propertyGrid = $('#propertyGrid');
const resultsCount = $('#resultsCount');
const noResultsMsg = $('#noResultsMsg');
const loadMoreBtn = $('#loadMoreBtn');
const PAGE_SIZE = 6;
let visibleCount = PAGE_SIZE;
let activeFilters = { location:'', type:'', minPrice:'', maxPrice:'', beds:'', keyword:'' };
function isFiltering(){
  return !!(activeFilters.location || activeFilters.type || activeFilters.minPrice || activeFilters.maxPrice || activeFilters.beds || activeFilters.keyword.trim());
}
function matchesFilters(p){
  if(activeFilters.location && p.location.toLowerCase().indexOf(activeFilters.location.toLowerCase()) === -1) return false;
  if(activeFilters.type && p.type !== activeFilters.type) return false;
  if(activeFilters.beds){
    const min = parseInt(activeFilters.beds, 10);
    if(p.beds < min) return false;
  }
  if(activeFilters.minPrice){
    const min = parseFloat(activeFilters.minPrice);
    if(!isNaN(min) && p.price < min) return false;
  }
  if(activeFilters.maxPrice){
    const max = parseFloat(activeFilters.maxPrice);
    if(!isNaN(max) && p.price > max) return false;
  }
  if(activeFilters.keyword.trim()){
    const kw = activeFilters.keyword.trim().toLowerCase();
    if(p.title.toLowerCase().indexOf(kw) === -1 && p.location.toLowerCase().indexOf(kw) === -1) return false;
  }
  return true;
}
function propertyCardHTML(p){
  const favActive = isFavorite(p.id);
  return (
    '<article class="prop-card">' +
      '<div class="prop-media">' +
        '<img src="' + p.images[0] + '" width="400" height="210" alt="' + escapeHTML(p.title) + ' in ' + escapeHTML(p.location) + '" loading="lazy">' +
        '<span class="prop-tag-simple">' + escapeHTML(p.status) + '</span>' +
        '<button type="button" class="fav-btn" data-fav-id="' + p.id + '" aria-pressed="' + favActive + '" aria-label="' + (favActive ? 'Remove ' : 'Add ') + escapeHTML(p.title) + (favActive ? ' from favorites' : ' to favorites') + '">' +
          '<i class="' + (favActive ? 'fa-solid' : 'fa-regular') + ' fa-heart" aria-hidden="true"></i>' +
        '</button>' +
      '</div>' +
      '<div class="prop-body">' +
        '<div class="prop-price">' + formatPrice(p) + '</div>' +
        '<h3 class="prop-name">' + escapeHTML(p.title) + '</h3>' +
        '<div class="prop-loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHTML(p.location) + '</div>' +
        '<div class="prop-specs">' +
          (p.beds ? '<span><i class="fa-solid fa-bed" aria-hidden="true"></i> ' + p.beds + ' Bed' + (p.beds > 1 ? 's' : '') + '</span>' : '<span><i class="fa-solid fa-building" aria-hidden="true"></i> Commercial</span>') +
          '<span><i class="fa-solid fa-bath" aria-hidden="true"></i> ' + p.baths + ' Bath' + (p.baths > 1 ? 's' : '') + '</span>' +
          '<span><i class="fa-solid fa-vector-square" aria-hidden="true"></i> ' + p.area.toLocaleString() + ' sqft</span>' +
        '</div>' +
        '<button type="button" class="btn-view-details" data-view-id="' + p.id + '">View Details</button>' +
      '</div>' +
    '</article>'
  );
}
function renderGrid(){
  if(propertiesLoadError){
    propertyGrid.innerHTML = '';
    noResultsMsg.hidden = false;
    noResultsMsg.textContent = 'Couldn\u2019t load listings right now. Check your Supabase connection and try again.';
    resultsCount.textContent = '';
    loadMoreBtn.hidden = true;
    return;
  }
  const filtered = PROPERTIES.filter(matchesFilters);
  const filtering = isFiltering();
  const list = filtering ? filtered : filtered.slice(0, visibleCount);
  propertyGrid.innerHTML = list.map(propertyCardHTML).join('');
  noResultsMsg.hidden = filtered.length !== 0;
  noResultsMsg.textContent = 'No properties match your search. Try adjusting your filters.';
  resultsCount.textContent = filtered.length === 0 ? '' :
    (filtering ? filtered.length + ' propert' + (filtered.length === 1 ? 'y' : 'ies') + ' found' :
    'Showing ' + list.length + ' of ' + filtered.length + ' properties');
  const hasMore = !filtering && visibleCount < filtered.length;
  loadMoreBtn.hidden = !hasMore;
  loadMoreBtn.disabled = false;
  loadMoreBtn.innerHTML = 'See More<span class="circ" aria-hidden="true"><i class="fa-solid fa-arrow-up-right"></i></span>';
}
$('#propertySearchForm').addEventListener('submit', function(e){
  e.preventDefault();
  const minVal = $('#searchMinPrice').value;
  const maxVal = $('#searchMaxPrice').value;
  if(minVal && maxVal && parseFloat(minVal) > parseFloat(maxVal)){
    showToast('Min price should not be greater than max price.', 'error');
    return;
  }
  activeFilters = {
    location: $('#searchLocation').value,
    type: $('#searchType').value,
    minPrice: minVal,
    maxPrice: maxVal,
    beds: $('#searchBeds').value,
    keyword: $('#searchKeyword').value
  };
  visibleCount = PAGE_SIZE;
  renderGrid();
  document.getElementById('properties').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#resetFiltersBtn').addEventListener('click', function(){
  $('#propertySearchForm').reset();
  activeFilters = { location:'', type:'', minPrice:'', maxPrice:'', beds:'', keyword:'' };
  visibleCount = PAGE_SIZE;
  renderGrid();
});
loadMoreBtn.addEventListener('click', function(){
  visibleCount += PAGE_SIZE;
  renderGrid();
});
function applyLocationFilter(locationTerm){
  $('#searchLocation').value = locationTerm;
  activeFilters.location = locationTerm;
  visibleCount = PAGE_SIZE;
  renderGrid();
  document.getElementById('properties').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function applyTypeFilter(typeTerm){
  $('#searchType').value = typeTerm;
  activeFilters.type = typeTerm;
  visibleCount = PAGE_SIZE;
  renderGrid();
  document.getElementById('properties').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$all('[data-filter-location]').forEach(function(el){
  el.addEventListener('click', function(){ applyLocationFilter(el.getAttribute('data-filter-location')); });
});
$all('[data-filter-type]').forEach(function(el){
  el.addEventListener('click', function(){ applyTypeFilter(el.getAttribute('data-filter-type')); });
});
/* =========================================================
   PROPERTY DETAILS MODAL
   ========================================================= */
function openPropertyModal(id){
  const p = PROPERTIES.find(function(x){ return x.id === id; });
  if(!p) return;
  const galleryThumbs = p.images.map(function(img, i){
    return '<button type="button" class="' + (i === 0 ? 'active' : '') + '" data-thumb-src="' + img + '"><img src="' + img + '" alt="View ' + (i+1) + ' of ' + escapeHTML(p.title) + '" loading="lazy"></button>';
  }).join('');
  const amenitiesHTML = p.amenities.length
    ? p.amenities.map(function(a){ return '<span>' + escapeHTML(a) + '</span>'; }).join('')
    : '<span style="color:var(--ink-soft);">No amenities listed yet.</span>';
  const waMsg = 'Hello, I am interested in ' + p.title + ' (' + p.location + ', ' + formatPrice(p) + '). Could you share more details?';
  const mailtoHref = 'mailto:' + SITE_CONFIG.emailDisplay + '?subject=' + encodeURIComponent('Inquiry: ' + p.title) + '&body=' + encodeURIComponent('Hello, I am interested in ' + p.title + ' (' + p.location + '). Please share more information.');
  const html =
    '<div class="modal-eyebrow">' + escapeHTML(p.status) + ' · ' + escapeHTML(p.type) + '</div>' +
    '<h2>' + escapeHTML(p.title) + '</h2>' +
    '<div class="pm-loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHTML(p.location) + '</div>' +
    '<div class="pm-gallery-main"><img id="pmMainImg" src="' + p.images[0] + '" alt="' + escapeHTML(p.title) + '"></div>' +
    '<div class="pm-gallery-thumbs">' + galleryThumbs + '</div>' +
    '<div class="pm-price">' + formatPrice(p) + '</div>' +
    '<div class="pm-specs-row">' +
      (p.beds ? '<span><i class="fa-solid fa-bed" aria-hidden="true"></i> ' + p.beds + ' Bedrooms</span>' : '<span><i class="fa-solid fa-building" aria-hidden="true"></i> Commercial space</span>') +
      '<span><i class="fa-solid fa-bath" aria-hidden="true"></i> ' + p.baths + ' Bathrooms</span>' +
      '<span><i class="fa-solid fa-vector-square" aria-hidden="true"></i> ' + p.area.toLocaleString() + ' sqft</span>' +
    '</div>' +
    '<p class="pm-desc">' + escapeHTML(p.description || 'No description provided yet.') + '</p>' +
    '<div class="pm-amenities">' + amenitiesHTML + '</div>' +
    '<div class="pm-actions">' +
      '<a class="pill pill-solid" href="' + mailtoHref + '">Contact Agent<span class="circ" aria-hidden="true"><i class="fa-solid fa-envelope"></i></span></a>' +
      '<button type="button" class="pill pill-outline" id="pmWhatsapp">WhatsApp<span class="circ" aria-hidden="true"><i class="fa-brands fa-whatsapp"></i></span></button>' +
      '<button type="button" class="pill pill-outline" id="pmSchedule">Schedule Visit<span class="circ" aria-hidden="true"><i class="fa-regular fa-calendar"></i></span></button>' +
    '</div>';
  openModal(html);
  $('#pmWhatsapp').addEventListener('click', function(){ openWhatsApp(waMsg); });
  $('#pmSchedule').addEventListener('click', function(){ openScheduleModal(p.id); });
  $all('.pm-gallery-thumbs button').forEach(function(btn){
    btn.addEventListener('click', function(){
      $('#pmMainImg').src = btn.getAttribute('data-thumb-src');
      $all('.pm-gallery-thumbs button').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
}
/* =========================================================
   SCHEDULE VISIT MODAL — inserts into Supabase `appointments`
   ========================================================= */
function openScheduleModal(preselectId){
  const options = PROPERTIES.map(function(p){
    return '<option value="' + p.id + '"' + (p.id === preselectId ? ' selected' : '') + '>' + escapeHTML(p.title) + '</option>';
  }).join('');
  const html =
    '<div class="modal-eyebrow">Book a Visit</div>' +
    '<h2>Schedule a Visit</h2>' +
    '<p style="font-size:13.5px;color:var(--ink-soft);margin-bottom:20px;">An advisor will confirm your requested time by phone or email.</p>' +
    '<form id="scheduleForm" novalidate>' +
      '<div class="form-row" style="grid-template-columns:1fr 1fr;">' +
        '<div class="field"><label for="sv-name">Full Name *</label><input type="text" id="sv-name" required></div>' +
        '<div class="field"><label for="sv-phone">Phone *</label><input type="tel" id="sv-phone" required></div>' +
      '</div>' +
      '<div class="form-row" style="grid-template-columns:1fr 1fr;">' +
        '<div class="field"><label for="sv-email">Email *</label><input type="email" id="sv-email" required></div>' +
        '<div class="field"><label for="sv-property">Property</label><select id="sv-property">' + options + '</select></div>' +
      '</div>' +
      '<div class="form-row" style="grid-template-columns:1fr 1fr;">' +
        '<div class="field"><label for="sv-date">Preferred Date *</label><input type="date" id="sv-date" required></div>' +
        '<div class="field"><label for="sv-time">Preferred Time *</label><input type="time" id="sv-time" required></div>' +
      '</div>' +
      '<div class="field" style="margin-bottom:18px;"><label for="sv-message">Message</label><textarea id="sv-message" placeholder="Anything we should know before the visit?"></textarea></div>' +
      '<div id="sv-error" role="alert" style="color:var(--danger);font-size:13px;margin-bottom:14px;display:none;"></div>' +
      '<button type="submit" class="pill pill-solid" id="sv-submit">Confirm Visit Request<span class="circ" aria-hidden="true"><i class="fa-solid fa-arrow-up-right"></i></span></button>' +
      '<div id="sv-success" class="form-success" hidden role="status"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span></span></div>' +
    '</form>';
  openModal(html);
  const form = $('#scheduleForm');
  let submitting = false;
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if(submitting) return;
    const name = $('#sv-name').value.trim();
    const phone = $('#sv-phone').value.trim();
    const email = $('#sv-email').value.trim();
    const date = $('#sv-date').value;
    const time = $('#sv-time').value;
    const errorBox = $('#sv-error');
    if(!name || !phone || !email || !date || !time || !isValidEmail(email) || !isValidPhone(phone)){
      errorBox.textContent = 'Please fill in your name, a valid phone and email, and a preferred date and time.';
      errorBox.style.display = 'block';
      return;
    }
    errorBox.style.display = 'none';
    submitting = true;
    const btn = $('#sv-submit');
    btn.disabled = true;
    btn.innerHTML = 'Sending request…';
    const propertyId = $('#sv-property').value || null;
    const propertyTitle = (PROPERTIES.find(function(p){ return p.id === propertyId; }) || {}).title || '';
    const { error } = await supabase.from('appointments').insert({
      name: name,
      email: email,
      phone: phone,
      property_id: propertyId,
      preferred_date: date,
      preferred_time: time,
      message: $('#sv-message').value.trim() || null
    });
    if(error){
      errorBox.textContent = 'Something went wrong submitting your request: ' + error.message;
      errorBox.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Confirm Visit Request<span class="circ" aria-hidden="true"><i class="fa-solid fa-arrow-up-right"></i></span>';
      submitting = false;
      return;
    }
    form.hidden = true;
    const success = $('#sv-success');
    success.hidden = false;
    success.querySelector('span').textContent = 'Thanks, ' + name + ' — your visit request for ' + (propertyTitle || 'the property') + ' on ' + date + ' at ' + time + ' has been received. An advisor will confirm shortly.';
    showToast('Visit request submitted');
  });
}
/* =========================================================
   BLOG — loaded from Supabase `blog_posts` (published = true)
   ========================================================= */
let BLOG_POSTS = [];
async function loadBlogPosts(){
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if(error){ console.error('[main] could not load blog posts:', error.message); BLOG_POSTS = []; return; }
  BLOG_POSTS = (data || []).map(function(row){
    return {
      id: row.id,
      date: new Date(row.created_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }),
      title: row.title,
      excerpt: row.excerpt || '',
      image: row.image_url || FALLBACK_IMG,
      body: row.content || ''
    };
  });
}
function renderBlog(){
  const grid = $('#blogGrid');
  if(BLOG_POSTS.length === 0){
    grid.innerHTML = '<p style="font-size:13.5px;color:var(--ink-soft);grid-column:1/-1;">No posts published yet — check back soon.</p>';
    return;
  }
  grid.innerHTML = BLOG_POSTS.map(function(post){
    return (
      '<article class="blog-card">' +
        '<img src="' + post.image + '" width="400" height="190" alt="' + escapeHTML(post.title) + '" loading="lazy">' +
        '<div class="blog-body">' +
          '<div class="blog-meta"><span>' + escapeHTML(post.date) + '</span></div>' +
          '<h3>' + escapeHTML(post.title) + '</h3>' +
          '<p>' + escapeHTML(post.excerpt) + '</p>' +
          '<button type="button" class="read-more" data-blog-id="' + post.id + '">Read More <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>' +
        '</div>' +
      '</article>'
    );
  }).join('');
}
function openBlogModal(id){
  const post = BLOG_POSTS.find(function(p){ return p.id === id; });
  if(!post) return;
  const html =
    '<div class="modal-eyebrow">' + escapeHTML(post.date) + '</div>' +
    '<h2>' + escapeHTML(post.title) + '</h2>' +
    '<div class="pm-gallery-main" style="margin-top:16px;"><img src="' + post.image + '" alt="' + escapeHTML(post.title) + '"></div>' +
    '<p class="pm-desc" style="margin-top:18px;white-space:pre-wrap;">' + escapeHTML(post.body) + '</p>';
  openModal(html);
}
/* =========================================================
   TEAM / LEGAL MODALS (unchanged demo content — no DB table requested for these)
   ========================================================= */
function openTeamModal(){
  const members = [
    { name:'Jordan Ames', role:'Principal Advisor', img:'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80' },
    { name:'Priya Nair', role:'Buyer Relations', img:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80' },
    { name:'Marcus Webb', role:'Commercial Lead', img:'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=300&q=80' },
    { name:'Ananya Rao', role:'Client Success', img:'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80' }
  ];
  const html =
    '<div class="modal-eyebrow">Demo Content</div>' +
    '<h2>Meet the Team</h2>' +
    '<p style="font-size:13.5px;color:var(--ink-soft);margin-bottom:6px;">Placeholder profiles for layout purposes — replace with real team bios.</p>' +
    '<div class="team-grid">' + members.map(function(m){
      return '<div class="team-member"><img src="' + m.img + '" alt="' + escapeHTML(m.name) + '" loading="lazy"><b>' + escapeHTML(m.name) + '</b><span>' + escapeHTML(m.role) + '</span></div>';
    }).join('') + '</div>';
  openModal(html);
}
function openLegalModal(kind){
  const isPrivacy = kind === 'privacy';
  const html =
    '<div class="modal-eyebrow">Demo Document</div>' +
    '<h2>' + (isPrivacy ? 'Privacy Policy' : 'Terms & Conditions') + '</h2>' +
    '<div class="legal-body">' +
      '<p>This is placeholder text included so the page has no dead links. It is not a real, binding ' + (isPrivacy ? 'privacy policy' : 'terms of service') + ' — replace it with content reviewed by qualified counsel before launch.</p>' +
      '<p>' + (isPrivacy
        ? 'A real policy would describe what information is collected through this site (such as contact form and newsletter submissions), how it is stored, who it is shared with, and how a visitor can request its deletion.'
        : 'Real terms would describe acceptable use of the site, the accuracy of listing information, and the limits of liability for a real estate advisory business.') + '</p>' +
    '</div>';
  openModal(html);
}
function openFavoritesModal(){
  const favs = getFavorites();
  const items = PROPERTIES.filter(function(p){ return favs.indexOf(p.id) > -1; });
  let body;
  if(items.length === 0){
    body = '<p style="font-size:13.5px;color:var(--ink-soft);">You haven\'t saved any properties yet. Tap the heart icon on a listing to save it here.</p>';
  } else {
    body = '<div style="display:flex;flex-direction:column;gap:12px;">' + items.map(function(p){
      return '<div style="display:flex;align-items:center;gap:14px;border:1px solid var(--hair);border-radius:14px;padding:10px;">' +
        '<img src="' + p.images[0] + '" alt="" width="64" height="64" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0;" loading="lazy">' +
        '<div style="flex:1;"><b style="display:block;font-size:14px;">' + escapeHTML(p.title) + '</b><span style="font-size:12px;color:var(--ink-soft);">' + escapeHTML(p.location) + ' · ' + formatPrice(p) + '</span></div>' +
        '<button type="button" class="pill pill-outline" data-view-id="' + p.id + '" style="padding:6px 6px 6px 16px;font-size:12.5px;">View<span class="circ" aria-hidden="true"><i class="fa-solid fa-arrow-up-right"></i></span></button>' +
      '</div>';
    }).join('') + '</div>';
  }
  openModal('<div class="modal-eyebrow">Saved Properties</div><h2>Your Favorites</h2><div style="margin-top:18px;">' + body + '</div>');
}
/* =========================================================
   MODAL SYSTEM
   ========================================================= */
const modalOverlay = $('#modalOverlay');
const modalContent = $('#modalContent');
let lastFocusedEl = null;
function openModal(html){
  lastFocusedEl = document.activeElement;
  modalContent.innerHTML = html;
  modalOverlay.hidden = false;
  requestAnimationFrame(function(){ modalOverlay.classList.add('open'); });
  document.body.classList.add('no-scroll');
  const heading = modalContent.querySelector('h2, h3');
  if(heading){
    if(!heading.id) heading.id = 'modalTitleLabel';
    modalOverlay.setAttribute('aria-labelledby', heading.id);
  }
  $('#modalCloseBtn').focus();
}
function closeModal(){
  modalOverlay.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(function(){
    modalOverlay.hidden = true;
    modalContent.innerHTML = '';
    if(lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
  }, 250);
}
$('#modalCloseBtn').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function(e){
  if(e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
});
modalOverlay.addEventListener('keydown', function(e){
  if(e.key !== 'Tab') return;
  const focusables = $all('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modalOverlay)
    .filter(function(el){ return !el.disabled && el.offsetParent !== null; });
  if(!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
function closeModalThenOpen(openFn){
  if(modalOverlay.classList.contains('open')){
    closeModal();
    setTimeout(openFn, 260);
  } else {
    openFn();
  }
}
/* =========================================================
   EVENT DELEGATION — property grid & modal-triggered actions
   ========================================================= */
document.addEventListener('click', function(e){
  const favBtn = e.target.closest('.fav-btn');
  if(favBtn){ toggleFavorite(favBtn.getAttribute('data-fav-id')); return; }
  const viewBtn = e.target.closest('[data-view-id]');
  if(viewBtn){ closeModalThenOpen(function(){ openPropertyModal(viewBtn.getAttribute('data-view-id')); }); return; }
  const blogBtn = e.target.closest('[data-blog-id]');
  if(blogBtn){ openBlogModal(blogBtn.getAttribute('data-blog-id')); return; }
  const teamBtn = e.target.closest('[data-open-team]');
  if(teamBtn){ openTeamModal(); return; }
  const legalBtn = e.target.closest('[data-open-legal]');
  if(legalBtn){ openLegalModal(legalBtn.getAttribute('data-open-legal')); return; }
  const socialBtn = e.target.closest('[data-social]');
  if(socialBtn){
    const key = socialBtn.getAttribute('data-social');
    const url = SITE_CONFIG.socials[key];
    if(url){ window.open(url, '_blank', 'noopener'); }
    else { showToast('This social profile isn\'t connected yet.'); }
    return;
  }
  const scrollBtn = e.target.closest('[data-scroll-to]');
  if(scrollBtn){
    const target = document.getElementById(scrollBtn.getAttribute('data-scroll-to'));
    if(target) target.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }
});
/* =========================================================
   CONTACT FORM — inserts into Supabase `inquiries`
   ========================================================= */
function populateContactSubjectOptions(){
  const subjectSelect = $('#cf-subject');
  while(subjectSelect.options.length > 1){ subjectSelect.remove(1); }
  PROPERTIES.forEach(function(p){
    const opt = document.createElement('option');
    opt.value = p.title;
    opt.dataset.propertyId = p.id;
    opt.textContent = p.title;
    subjectSelect.appendChild(opt);
  });
}
(function(){
  const form = $('#contactForm');
  let submitting = false;
  function setFieldError(fieldId, hasError){
    const field = $('#' + fieldId + '-field');
    if(field) field.classList.toggle('has-error', hasError);
  }
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if(submitting) return;
    const name = $('#cf-name').value.trim();
    const email = $('#cf-email').value.trim();
    const phone = $('#cf-phone').value.trim();
    const message = $('#cf-message').value.trim();
    const subjectSelect = $('#cf-subject');
    const subjectValue = subjectSelect.value;
    const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
    const propertyId = selectedOption ? selectedOption.dataset.propertyId || null : null;
    let valid = true;
    setFieldError('cf-name', !name); if(!name) valid = false;
    setFieldError('cf-email', !isValidEmail(email)); if(!isValidEmail(email)) valid = false;
    setFieldError('cf-message', message.length < 5); if(message.length < 5) valid = false;
    const phoneOk = phone === '' || isValidPhone(phone);
    setFieldError('cf-phone', !phoneOk); if(!phoneOk) valid = false;
    if(!valid){
      const firstError = form.querySelector('.has-error input, .has-error textarea, .has-error select');
      if(firstError) firstError.focus();
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }
    submitting = true;
    const btn = $('#cf-submit');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Sending…';
    const composedMessage = (!propertyId && subjectValue && subjectValue !== 'General enquiry')
      ? '[' + subjectValue + '] ' + message
      : message;
    const { error } = await supabase.from('inquiries').insert({
      name: name,
      email: email,
      phone: phone || null,
      property_id: propertyId,
      message: composedMessage
    });
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    submitting = false;
    if(error){
      showToast('Could not send your message: ' + error.message, 'error');
      return;
    }
    $('#cf-success').hidden = false;
    $('#cf-success').querySelector('span').textContent = 'Thanks, ' + name + ' — your message has been received. An advisor will reply within one business day.';
    showToast('Message sent');
    form.reset();
    ['cf-name','cf-email','cf-phone','cf-message'].forEach(function(id){ setFieldError(id, false); });
  });
  $('#whatsappGeneral').addEventListener('click', function(){
    openWhatsApp('Hello, I would like to get in touch with Elite Estates.');
  });
})();
/* =========================================================
   NEWSLETTER — inserts into Supabase `newsletter_subscribers`
   ========================================================= */
(function(){
  const form = $('#newsletterForm');
  const input = $('#newsletterEmail');
  const msg = $('#newsletterMsg');
  const btn = $('#newsletterSubmit');
  let submitting = false;
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if(submitting) return;
    const email = input.value.trim();
    msg.className = 'newsletter-msg show';
    if(!isValidEmail(email)){
      msg.textContent = 'Please enter a valid email address.';
      msg.classList.add('error');
      return;
    }
    submitting = true;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Joining…';
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: email });
    btn.disabled = false;
    btn.textContent = originalText;
    submitting = false;
    if(error){
      if(error.code === '23505'){
        msg.textContent = 'You\'re already subscribed with this email.';
      } else {
        msg.textContent = 'Could not subscribe right now: ' + error.message;
      }
      msg.classList.add('error');
      return;
    }
    msg.textContent = 'You\'re subscribed! Watch your inbox for new listings.';
    msg.classList.remove('error');
    msg.classList.add('success');
    showToast('Subscribed to the newsletter');
    form.reset();
  });
})();
/* =========================================================
   TESTIMONIALS SLIDER — loaded from Supabase `testimonials`
   ========================================================= */
let TESTIMONIALS = [];
async function loadTestimonials(){
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if(error){ console.error('[main] could not load testimonials:', error.message); TESTIMONIALS = []; return; }
  TESTIMONIALS = (data || []).map(function(row){
    return {
      quote: row.message,
      name: row.name,
      role: row.role || '',
      stars: row.rating || 5,
      img: row.image_url || FALLBACK_IMG
    };
  });
}
function initTestimonialsSlider(){
  const slide = $('#testSlide');
  const photo = $('#testPhoto');
  const section = document.getElementById('testimonials');
  const prevBtn = $('#testPrev');
  const nextBtn = $('#testNext');
  let idx = 0;
  let timer = null;
  if(TESTIMONIALS.length === 0){
    slide.querySelector('.quote').textContent = 'No testimonials published yet.';
    slide.querySelector('.stars').textContent = '';
    slide.querySelector('.test-name').textContent = '';
    photo.src = FALLBACK_IMG;
    photo.alt = '';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }
  function render(){
    const t = TESTIMONIALS[idx];
    slide.querySelector('.quote').textContent = t.quote;
    slide.querySelector('.stars').textContent = '★★★★★'.slice(0, t.stars) + '☆☆☆☆☆'.slice(0, 5 - t.stars);
    slide.querySelector('.test-name').textContent = t.name + (t.role ? ' — ' + t.role : '');
    photo.src = t.img;
    photo.alt = 'Portrait of ' + t.name;
  }
  function go(dir){
    idx = (idx + dir + TESTIMONIALS.length) % TESTIMONIALS.length;
    render();
  }
  function startAuto(){ stopAuto(); if(TESTIMONIALS.length > 1) timer = setInterval(function(){ go(1); }, 6500); }
  function stopAuto(){ if(timer){ clearInterval(timer); timer = null; } }
  prevBtn.addEventListener('click', function(){ go(-1); startAuto(); });
  nextBtn.addEventListener('click', function(){ go(1); startAuto(); });
  section.addEventListener('mouseenter', stopAuto);
  section.addEventListener('mouseleave', startAuto);
  section.addEventListener('focusin', stopAuto);
  section.addEventListener('focusout', startAuto);
  section.addEventListener('keydown', function(e){
    if(e.key === 'ArrowLeft'){ go(-1); startAuto(); }
    if(e.key === 'ArrowRight'){ go(1); startAuto(); }
  });
  let touchStartX = null;
  section.addEventListener('touchstart', function(e){ touchStartX = e.changedTouches[0].clientX; }, { passive:true });
  section.addEventListener('touchend', function(e){
    if(touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if(Math.abs(dx) > 50){ go(dx > 0 ? -1 : 1); startAuto(); }
    touchStartX = null;
  }, { passive:true });
  render();
  startAuto();
}
/* =========================================================
   HEADER / MOBILE NAV / ACTIVE NAV STATE
   ========================================================= */
(function(){
  const header = $('#siteHeader');
  window.addEventListener('scroll', function(){ header.classList.toggle('scrolled', window.scrollY > 20); });
  const mobileNav = $('#mobileNav');
  const navToggle = $('#navToggle');
  const mnavClose = $('#mnavClose');
  function openMobileNav(){
    mobileNav.classList.add('open');
    mobileNav.setAttribute('aria-hidden', 'false');
    navToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
    mnavClose.focus();
  }
  function closeMobileNav(){
    mobileNav.classList.remove('open');
    mobileNav.setAttribute('aria-hidden', 'true');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
    navToggle.focus();
  }
  navToggle.addEventListener('click', function(){
    if(mobileNav.classList.contains('open')) closeMobileNav(); else openMobileNav();
  });
  mnavClose.addEventListener('click', closeMobileNav);
  $all('#mobileNav a').forEach(function(a){ a.addEventListener('click', closeMobileNav); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && mobileNav.classList.contains('open')) closeMobileNav();
  });
  mobileNav.addEventListener('click', function(e){
    if(e.target === mobileNav) closeMobileNav();
  });
  document.addEventListener('click', function(e){
    if(!mobileNav.classList.contains('open')) return;
    if(mobileNav.contains(e.target) || navToggle.contains(e.target)) return;
    closeMobileNav();
  });
  const navLinks = $all('[data-nav-link]');
  const sections = ['home','properties','about','services','testimonials','blog','contact']
    .map(function(id){ return document.getElementById(id); })
    .filter(Boolean);
  if('IntersectionObserver' in window){
    const observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          const id = entry.target.id;
          navLinks.forEach(function(link){
            link.classList.toggle('active', link.getAttribute('data-nav-link') === id);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function(s){ observer.observe(s); });
  }

  $('#favNavBtn').addEventListener('click', openFavoritesModal);
})();

/* =========================================================
   INIT
   ========================================================= */
(async function init(){
  $('#footerYear').textContent = String(new Date().getFullYear());

  const settings = await loadSiteSettings();
  applySiteSettings(settings);

  await loadProperties();
  populateContactSubjectOptions();
  renderGrid();
  refreshFavoriteUI();
  await loadBlogPosts();
  renderBlog();
  await loadTestimonials();
  initTestimonialsSlider();
})();
