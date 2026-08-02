// ============================================================
// BUP BCC — Executive dashboard logic (Supabase edition)
// Requires supabase-js and assets/js/supabase-config.js to be loaded first
// (see the <script> order in admin.html).
// ============================================================

const CATEGORIES = [
  { id: 'board', label: 'Executive Board' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'corporate', label: 'Corporate Relations' },
  { id: 'events', label: 'Event Management' },
  { id: 'hr', label: 'Human Resources' },
];

let members = [];
let editingId = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);

function showScreen(id) {
  ['loading-screen', 'auth-screen', 'dashboard-screen'].forEach((s) => {
    $(s).classList.toggle('hidden', s !== id);
  });
}

function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.toggle('border-red-500/40', isError);
  toast.classList.toggle('border-gold/30', !isError);
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function categoryLabel(id) {
  const c = CATEGORIES.find((c) => c.id === id);
  return c ? c.label : id;
}

// ---------------------------------------------------------------- photos

// Pulls the storage path back out of a public URL Supabase handed us, e.g.
// ".../object/public/team-photos/171-abc.jpg" -> "171-abc.jpg"
function storagePathFromUrl(url) {
  const marker = '/team-photos/';
  const idx = (url || '').indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

async function deleteStoragePhoto(photoUrl) {
  const path = storagePathFromUrl(photoUrl);
  if (!path) return;
  await supabaseClient.storage.from('team-photos').remove([path]);
}

async function uploadStoragePhoto(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabaseClient.storage.from('team-photos').upload(path, file);
  if (uploadError) throw uploadError;
  const { data } = supabaseClient.storage.from('team-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------- rendering

function renderMemberCard(m) {
  const avatar = m.photo_url
    ? `<img src="${escapeHtml(m.photo_url)}" alt="" class="w-14 h-14 rounded-full object-cover border-2 border-gold/40 shrink-0" />`
    : `<div class="w-14 h-14 rounded-full bg-neutral-800 border-2 border-gold/40 flex items-center justify-center text-gold font-display font-bold shrink-0">${escapeHtml(initials(m.name))}</div>`;

  return `
    <div class="bg-ink-secondary border border-white/10 rounded-xl p-5 flex gap-4 items-start ${m.active === false ? 'opacity-50' : ''}">
      ${avatar}
      <div class="flex-1 min-w-0">
        <p class="text-[11px] uppercase tracking-wide text-gold/80 truncate">${escapeHtml(categoryLabel(m.category))}${m.active === false ? ' · Hidden' : ''}</p>
        <p class="font-display font-bold text-white truncate">${escapeHtml(m.name)}</p>
        <p class="text-xs text-gray-400 truncate">${escapeHtml(m.title)}</p>
        <p class="text-[11px] text-gray-500 mt-1 truncate">${escapeHtml(m.batch || '')}</p>
        <button data-edit="${m.id}" class="text-xs text-gold hover:text-gold-dark mt-3">Edit</button>
      </div>
    </div>
  `;
}

function renderMembers() {
  const grid = $('members-grid');
  grid.innerHTML = members.map(renderMemberCard).join('');
  $('members-empty').classList.toggle('hidden', members.length !== 0);
  $('members-status').textContent = `${members.length} member${members.length === 1 ? '' : 's'} total`;
  grid.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openMemberModal(btn.dataset.edit)));
}

function populateCategorySelect() {
  $('member-category').innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
}

async function loadMembers() {
  const { data, error } = await supabaseClient.from('team_members').select('*').order('display_order');
  if (error) {
    showToast(error.message, true);
    return;
  }
  members = data || [];
  renderMembers();
}

// ---------------------------------------------------------------- member modal

function openMemberModal(id) {
  editingId = id || null;
  const m = id ? members.find((x) => x.id === id) : null;

  $('member-modal-title').textContent = m ? 'Edit Team Member' : 'Add Team Member';
  $('member-name').value = m?.name || '';
  $('member-position').value = m?.title || '';
  $('member-batch').value = m?.batch || '';
  $('member-department').value = m?.department || '';
  $('member-category').value = m?.category || CATEGORIES[0]?.id || '';
  $('member-order').value = m?.display_order ?? 99;
  $('member-active').checked = m ? m.active !== false : true;
  $('member-photo').value = '';
  $('member-remove-photo').checked = false;
  $('remove-photo-label').classList.toggle('hidden', !m?.photo_url);
  $('member-delete-btn').classList.toggle('hidden', !m);
  $('member-form-error').classList.add('hidden');
  $('member-modal').classList.remove('hidden');
  $('member-name').focus();
}

function closeMemberModal() {
  $('member-modal').classList.add('hidden');
  editingId = null;
}

async function handleMemberSubmit(e) {
  e.preventDefault();
  const errorEl = $('member-form-error');
  errorEl.classList.add('hidden');
  const saveBtn = $('member-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const name = $('member-name').value.trim();
    const title = $('member-position').value.trim();
    if (!name) throw new Error('Name is required');
    if (!title) throw new Error('Position is required');

    const payload = {
      name,
      title,
      batch: $('member-batch').value.trim(),
      department: $('member-department').value.trim(),
      category: $('member-category').value,
      display_order: Number($('member-order').value) || 99,
      active: $('member-active').checked,
    };

    const existing = editingId ? members.find((m) => m.id === editingId) : null;
    const file = $('member-photo').files[0];

    if ($('member-remove-photo').checked) {
      if (existing?.photo_url) await deleteStoragePhoto(existing.photo_url);
      payload.photo_url = null;
    } else if (file) {
      if (file.size > 3 * 1024 * 1024) throw new Error('Photo must be under 3MB');
      const newUrl = await uploadStoragePhoto(file);
      if (existing?.photo_url) await deleteStoragePhoto(existing.photo_url);
      payload.photo_url = newUrl;
    }

    if (editingId) {
      const { error } = await supabaseClient.from('team_members').update(payload).eq('id', editingId);
      if (error) throw error;
      showToast('Member updated');
    } else {
      const { error } = await supabaseClient.from('team_members').insert(payload);
      if (error) throw error;
      showToast('Member added');
    }
    closeMemberModal();
    await loadMembers();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function handleMemberDelete() {
  if (!editingId) return;
  if (!confirm('Remove this team member? This cannot be undone.')) return;
  try {
    const existing = members.find((m) => m.id === editingId);
    const { error } = await supabaseClient.from('team_members').delete().eq('id', editingId);
    if (error) throw error;
    if (existing?.photo_url) await deleteStoragePhoto(existing.photo_url);
    showToast('Member removed');
    closeMemberModal();
    await loadMembers();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------------------------------------------------------- auth

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errorEl = $('auth-error');
  errorEl.classList.add('hidden');
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
    return;
  }
  currentUser = data.user;
  await enterDashboard();
}

async function enterDashboard() {
  $('welcome-text').textContent = `Signed in as ${currentUser.email}`;
  showScreen('dashboard-screen');
  populateCategorySelect();
  await loadMembers();
}

async function logout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  $('auth-form').reset();
  showScreen('auth-screen');
}

// ---------------------------------------------------------------- init

async function init() {
  showScreen('loading-screen');
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    await enterDashboard();
  } else {
    showScreen('auth-screen');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  $('auth-form').addEventListener('submit', handleAuthSubmit);
  $('logout-btn').addEventListener('click', logout);
  $('add-member-btn').addEventListener('click', () => openMemberModal(null));
  $('member-form').addEventListener('submit', handleMemberSubmit);
  $('member-cancel-btn').addEventListener('click', closeMemberModal);
  $('member-modal-close').addEventListener('click', closeMemberModal);
  $('member-delete-btn').addEventListener('click', handleMemberDelete);
});
