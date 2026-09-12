import { supabase } from '../lib/supabaseClient.js';
import { $, escapeHTML, showToast, uploadImageToBucket, loadingStateHTML, errorStateHTML } from './admin-common.js';

const BUCKET = 'site-assets';

export async function render(container) {
  container.innerHTML = `<div class="panel" style="padding:24px;">${loadingStateHTML('Loading settings…')}</div>`;

  const { data, error } = await supabase.from('site_settings').select('*').limit(1).maybeSingle();
  if (error) {
    container.innerHTML = `<div class="panel" style="padding:24px;">${errorStateHTML('Could not load settings: ' + error.message)}</div>`;
    return;
  }
  // The schema seeds exactly one row on first migration; this is a safety net
  // in case that insert was skipped for some reason.
  const s = data || {
    company_name: 'Elite Estates', logo_url: '', owner_name: '', phone: '', email: '',
    whatsapp_number: '', office_address: '', city: '', country: 'India', google_maps_url: '',
    instagram_url: '', facebook_url: '', youtube_url: '', linkedin_url: '',
    about_text: '', hero_title: '', hero_subtitle: '', footer_text: ''
  };

  container.innerHTML = `
    <form id="settingsForm" novalidate>
      <div class="panel" style="padding:24px;margin-bottom:20px;">
        <h2 style="font-size:16px;margin-bottom:18px;">Branding</h2>
        <div class="form-grid">
          <div class="form-field"><label for="st-company">Company Name</label><input type="text" id="st-company" value="${escapeHTML(s.company_name || '')}"></div>
          <div class="form-field">
            <label>Logo</label>
            <div style="display:flex;align-items:center;gap:12px;">
              <img id="logoPreview" src="${s.logo_url || ''}" alt="" class="thumb" style="width:56px;height:56px;${s.logo_url ? '' : 'visibility:hidden;'}">
              <label class="upload-dropzone" style="flex:1;padding:10px;">
                <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Upload logo
                <input type="file" id="logoInput" accept="image/jpeg,image/png,image/webp">
              </label>
            </div>
          </div>
          <div class="form-field full"><label for="st-heroTitle">Hero Title</label><input type="text" id="st-heroTitle" value="${escapeHTML(s.hero_title || '')}"></div>
          <div class="form-field full"><label for="st-heroSubtitle">Hero Subtitle</label><input type="text" id="st-heroSubtitle" value="${escapeHTML(s.hero_subtitle || '')}"></div>
          <div class="form-field full"><label for="st-footerText">Footer Text</label><input type="text" id="st-footerText" value="${escapeHTML(s.footer_text || '')}"></div>
        </div>
      </div>

      <div class="panel" style="padding:24px;margin-bottom:20px;">
        <h2 style="font-size:16px;margin-bottom:18px;">Business Information</h2>
        <div class="form-grid">
          <div class="form-field"><label for="st-owner">Owner / Agent Name</label><input type="text" id="st-owner" value="${escapeHTML(s.owner_name || '')}"></div>
          <div class="form-field"><label for="st-phone">Phone</label><input type="tel" id="st-phone" value="${escapeHTML(s.phone || '')}"></div>
          <div class="form-field"><label for="st-email">Email</label><input type="email" id="st-email" value="${escapeHTML(s.email || '')}"></div>
          <div class="form-field"><label for="st-whatsapp">WhatsApp Number</label><input type="tel" id="st-whatsapp" value="${escapeHTML(s.whatsapp_number || '')}" placeholder="Digits only, e.g. 14155550148"></div>
          <div class="form-field full"><label for="st-address">Office Address</label><input type="text" id="st-address" value="${escapeHTML(s.office_address || '')}"></div>
          <div class="form-field"><label for="st-city">City</label><input type="text" id="st-city" value="${escapeHTML(s.city || '')}"></div>
          <div class="form-field"><label for="st-country">Country</label><input type="text" id="st-country" value="${escapeHTML(s.country || '')}"></div>
          <div class="form-field full"><label for="st-maps">Google Maps URL</label><input type="url" id="st-maps" value="${escapeHTML(s.google_maps_url || '')}"></div>
        </div>
      </div>

      <div class="panel" style="padding:24px;margin-bottom:20px;">
        <h2 style="font-size:16px;margin-bottom:18px;">Social Media</h2>
        <div class="form-grid">
          <div class="form-field"><label for="st-instagram">Instagram URL</label><input type="url" id="st-instagram" value="${escapeHTML(s.instagram_url || '')}"></div>
          <div class="form-field"><label for="st-facebook">Facebook URL</label><input type="url" id="st-facebook" value="${escapeHTML(s.facebook_url || '')}"></div>
          <div class="form-field"><label for="st-youtube">YouTube URL</label><input type="url" id="st-youtube" value="${escapeHTML(s.youtube_url || '')}"></div>
          <div class="form-field"><label for="st-linkedin">LinkedIn URL</label><input type="url" id="st-linkedin" value="${escapeHTML(s.linkedin_url || '')}"></div>
        </div>
      </div>

      <div class="panel" style="padding:24px;margin-bottom:20px;">
        <h2 style="font-size:16px;margin-bottom:18px;">About</h2>
        <div class="form-field full" style="margin-bottom:0;"><label for="st-about">About Us Text</label><textarea id="st-about" style="min-height:120px;">${escapeHTML(s.about_text || '')}</textarea></div>
      </div>

      <button type="submit" class="btn btn-primary" id="settingsSaveBtn"><i class="fa-solid fa-check" aria-hidden="true"></i> Save Settings</button>
    </form>
  `;

  let pendingLogoUrl = s.logo_url || '';
  $('#logoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { url } = await uploadImageToBucket(BUCKET, file);
      pendingLogoUrl = url;
      const preview = $('#logoPreview');
      preview.src = url;
      preview.style.visibility = 'visible';
      showToast('Logo uploaded.');
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  });

  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      company_name: $('#st-company').value.trim(),
      logo_url: pendingLogoUrl || null,
      hero_title: $('#st-heroTitle').value.trim(),
      hero_subtitle: $('#st-heroSubtitle').value.trim(),
      footer_text: $('#st-footerText').value.trim(),
      owner_name: $('#st-owner').value.trim(),
      phone: $('#st-phone').value.trim(),
      email: $('#st-email').value.trim(),
      whatsapp_number: $('#st-whatsapp').value.trim(),
      office_address: $('#st-address').value.trim(),
      city: $('#st-city').value.trim(),
      country: $('#st-country').value.trim(),
      google_maps_url: $('#st-maps').value.trim(),
      instagram_url: $('#st-instagram').value.trim(),
      facebook_url: $('#st-facebook').value.trim(),
      youtube_url: $('#st-youtube').value.trim(),
      linkedin_url: $('#st-linkedin').value.trim(),
      about_text: $('#st-about').value.trim()
    };

    const btn = $('#settingsSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner on-dark" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;"></span> Saving…';

    const query = s.id
      ? supabase.from('site_settings').update(payload).eq('id', s.id)
      : supabase.from('site_settings').insert(payload);
    const { error } = await query;

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Save Settings';
    if (error) { showToast('Save failed: ' + error.message, 'error'); return; }
    showToast('Settings saved. The public site will pick these up on next load.');
    render(container); // refresh with saved values / new row id
  });
}
