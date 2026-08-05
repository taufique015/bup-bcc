// ============================================================
// BUP BCC — Executive dashboard (Team Roster + Hall of Fame)
// Requires supabase-js and assets/js/supabase-config.js loaded first.
// ============================================================

// ---------------------------------------------------------------- shared state

const CATEGORIES = [
  { id: 'executive-panel', label: 'Executive Panel' },
  { id: 'sub-executive-panel', label: 'Sub-Executive Panel' },
  { id: 'executive-members', label: 'Executive Members' },
  { id: 'general-members', label: 'General Members' },
];

let members = [];
let alumni = [];
let editingMemberId = null;
let editingAlumniId = null;
let currentUser = null;
let activeTab = 'roster';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- utilities

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

// ---------------------------------------------------------------- tabs

function switchTab(tab) {
  activeTab = tab;
  const isRoster = tab === 'roster';

  $('tab-roster').classList.toggle('hidden', !isRoster);
  $('tab-hof').classList.toggle('hidden', isRoster);

  const activeClasses = ['border-gold', 'bg-gold', 'text-ink'];
  const inactiveClasses = ['border-white/20', 'text-gray-300', 'hover:border-gold', 'hover:text-gold'];

  const rosterBtn = $('tab-roster-btn');
  const hofBtn = $('tab-hof-btn');

  if (isRoster) {
    activeClasses.forEach((c) => rosterBtn.classList.add(c));
    inactiveClasses.forEach((c) => rosterBtn.classList.remove(c));
    inactiveClasses.forEach((c) => hofBtn.classList.add(c));
    activeClasses.forEach((c) => hofBtn.classList.remove(c));
    $('view-public-link').href = 'team.html';
    $('view-public-link').textContent = 'View public page';
  } else {
    activeClasses.forEach((c) => hofBtn.classList.add(c));
    inactiveClasses.forEach((c) => hofBtn.classList.remove(c));
    inactiveClasses.forEach((c) => rosterBtn.classList.add(c));
    activeClasses.forEach((c) => rosterBtn.classList.remove(c));
    $('view-public-link').href = 'hall-of-fame.html';
    $('view-public-link').textContent = 'View public page';
  }
}

// ---------------------------------------------------------------- team photos

function memberStoragePath(url) {
  const marker = '/team-photos/';
  const idx = (url || '').indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

async function deleteMemberPhoto(photoUrl) {
  const path = memberStoragePath(photoUrl);
  if (!path) return;
  await supabaseClient.storage.from('team-photos').remove([path]);
}

async function uploadMemberPhoto(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseClient.storage.from('team-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabaseClient.storage.from('team-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------- alumni photos

function alumniStoragePath(url) {
  const marker = '/alumni-photos/';
  const idx = (url || '').indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

async function deleteAlumniPhoto(photoUrl) {
  const path = alumniStoragePath(photoUrl);
  if (!path) return;
  await supabaseClient.storage.from('alumni-photos').remove([path]);
}

async function uploadAlumniPhoto(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseClient.storage.from('alumni-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabaseClient.storage.from('alumni-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------- team rendering

function categoryLabel(id) {
  const c = CATEGORIES.find((c) => c.id === id);
  return c ? c.label : id;
}

function renderMemberCard(m) {
  const avatar = m.photo_url
    ? `<img src="${escapeHtml(m.photo_url)}" alt="" class="w-14 h-14 rounded-full object-cover border-2 border-gold/40 shrink-0" />`
    : `<div class="w-14 h-14 rounded-full bg-neutral-800 border-2 border-gold/40 flex items-center justify-center text-gold font-display font-bold shrink-0">${escapeHtml(initials(m.name))}</div>`;

  return `
    <div class="member-card bg-ink-secondary border border-white/10 border-t-2 border-t-gold/50 rounded-2xl shadow-lg p-5 flex gap-4 items-start ${m.active === false ? 'opacity-50' : ''}">
      ${avatar}
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-display font-semibold uppercase tracking-wider text-gold/80 truncate">${escapeHtml(categoryLabel(m.category))}${m.active === false ? ' · Hidden' : ''}</p>
        <p class="font-display font-bold text-white truncate mt-0.5">${escapeHtml(m.name)}</p>
        <p class="text-xs text-gray-400 truncate">${escapeHtml(m.title)}</p>
        <p class="text-[11px] text-gray-500 mt-1 truncate">${escapeHtml(m.batch || '')}</p>
        <button data-edit="${m.id}" class="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold hover:gap-2.5 transition-all mt-3">
          Edit
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>
        </button>
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
  if (error) { showToast(error.message, true); return; }
  members = data || [];
  renderMembers();
}

// ---------------------------------------------------------------- team modal

function openMemberModal(id) {
  editingMemberId = id || null;
  const m = id ? members.find((x) => x.id === id) : null;

  $('member-modal-title').textContent = m ? 'Edit Team Member' : 'Add Team Member';
  $('member-name').value = m?.name || '';
  $('member-position').value = m?.title || '';
  $('member-batch').value = m?.batch || '';
  $('member-department').value = m?.department || '';
  $('member-linkedin').value = m?.linkedin_url || '';
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
  editingMemberId = null;
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
      linkedin_url: $('member-linkedin').value.trim() || null,
      category: $('member-category').value,
      display_order: Number($('member-order').value) || 99,
      active: $('member-active').checked,
    };

    const existing = editingMemberId ? members.find((m) => m.id === editingMemberId) : null;
    const file = $('member-photo').files[0];

    if ($('member-remove-photo').checked) {
      if (existing?.photo_url) await deleteMemberPhoto(existing.photo_url);
      payload.photo_url = null;
    } else if (file) {
      if (file.size > 3 * 1024 * 1024) throw new Error('Photo must be under 3MB');
      const newUrl = await uploadMemberPhoto(file);
      if (existing?.photo_url) await deleteMemberPhoto(existing.photo_url);
      payload.photo_url = newUrl;
    }

    if (editingMemberId) {
      const { error } = await supabaseClient.from('team_members').update(payload).eq('id', editingMemberId);
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
  if (!editingMemberId) return;
  if (!confirm('Remove this team member? This cannot be undone.')) return;
  try {
    const existing = members.find((m) => m.id === editingMemberId);
    const { error } = await supabaseClient.from('team_members').delete().eq('id', editingMemberId);
    if (error) throw error;
    if (existing?.photo_url) await deleteMemberPhoto(existing.photo_url);
    showToast('Member removed');
    closeMemberModal();
    await loadMembers();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------------------------------------------------------- alumni rendering

function renderAlumniCard(a) {
  const avatar = a.photo_url
    ? `<img src="${escapeHtml(a.photo_url)}" alt="" class="w-14 h-14 rounded-full object-cover border-2 border-gold/40 shrink-0" />`
    : `<div class="w-14 h-14 rounded-full bg-neutral-800 border-2 border-gold/40 flex items-center justify-center text-gold font-display font-bold shrink-0">${escapeHtml(initials(a.name))}</div>`;

  return `
    <div class="member-card bg-ink-secondary border border-white/10 border-t-2 border-t-gold/50 rounded-2xl shadow-lg p-5 flex gap-4 items-start ${a.active === false ? 'opacity-50' : ''}">
      ${avatar}
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-display font-semibold uppercase tracking-wider text-gold/80 truncate">Class of ${escapeHtml(String(a.class_year))}${a.active === false ? ' · Hidden' : ''}</p>
        <p class="font-display font-bold text-white truncate mt-0.5">${escapeHtml(a.name)}</p>
        <p class="text-xs text-gray-400 truncate">${escapeHtml(a.title)}</p>
        <p class="text-[11px] text-gray-500 mt-1 truncate">${escapeHtml(a.achievement || '')}</p>
        <button data-edit="${a.id}" class="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold hover:gap-2.5 transition-all mt-3">
          Edit
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderAlumni() {
  const grid = $('alumni-grid');
  grid.innerHTML = alumni.map(renderAlumniCard).join('');
  $('alumni-empty').classList.toggle('hidden', alumni.length !== 0);
  $('alumni-status').textContent = `${alumni.length} alumni inducted`;
  grid.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openAlumniModal(btn.dataset.edit)));
}

async function loadAlumni() {
  const { data, error } = await supabaseClient
    .from('alumni')
    .select('*')
    .order('class_year', { ascending: false })
    .order('display_order');
  if (error) { showToast(error.message, true); return; }
  alumni = data || [];
  renderAlumni();
}

// ---------------------------------------------------------------- alumni modal

function openAlumniModal(id) {
  editingAlumniId = id || null;
  const a = id ? alumni.find((x) => x.id === id) : null;

  $('alumni-modal-title').textContent = a ? 'Edit Alumni' : 'Add Alumni';
  $('alumni-name').value = a?.name || '';
  $('alumni-title').value = a?.title || '';
  $('alumni-year').value = a?.class_year ?? new Date().getFullYear();
  $('alumni-achievement').value = a?.achievement || '';
  $('alumni-linkedin').value = a?.linkedin_url || '';
  $('alumni-order').value = a?.display_order ?? 99;
  $('alumni-active').checked = a ? a.active !== false : true;
  $('alumni-photo').value = '';
  $('alumni-remove-photo').checked = false;
  $('alumni-remove-photo-label').classList.toggle('hidden', !a?.photo_url);
  $('alumni-delete-btn').classList.toggle('hidden', !a);
  $('alumni-form-error').classList.add('hidden');
  $('alumni-modal').classList.remove('hidden');
  $('alumni-name').focus();
}

function closeAlumniModal() {
  $('alumni-modal').classList.add('hidden');
  editingAlumniId = null;
}

async function handleAlumniSubmit(e) {
  e.preventDefault();
  const errorEl = $('alumni-form-error');
  errorEl.classList.add('hidden');
  const saveBtn = $('alumni-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const name = $('alumni-name').value.trim();
    const title = $('alumni-title').value.trim();
    const classYear = Number($('alumni-year').value);
    if (!name) throw new Error('Name is required');
    if (!title) throw new Error('Former position is required');
    if (!Number.isInteger(classYear) || classYear < 1990 || classYear > 2100) {
      throw new Error('Class year must be between 1990 and 2100');
    }

    const payload = {
      name,
      title,
      class_year: classYear,
      achievement: $('alumni-achievement').value.trim(),
      linkedin_url: $('alumni-linkedin').value.trim() || null,
      display_order: Number($('alumni-order').value) || 99,
      active: $('alumni-active').checked,
    };

    const existing = editingAlumniId ? alumni.find((a) => a.id === editingAlumniId) : null;
    const file = $('alumni-photo').files[0];

    if ($('alumni-remove-photo').checked) {
      if (existing?.photo_url) await deleteAlumniPhoto(existing.photo_url);
      payload.photo_url = null;
    } else if (file) {
      if (file.size > 3 * 1024 * 1024) throw new Error('Photo must be under 3MB');
      const newUrl = await uploadAlumniPhoto(file);
      if (existing?.photo_url) await deleteAlumniPhoto(existing.photo_url);
      payload.photo_url = newUrl;
    }

    if (editingAlumniId) {
      const { error } = await supabaseClient.from('alumni').update(payload).eq('id', editingAlumniId);
      if (error) throw error;
      showToast('Alumni updated');
    } else {
      const { error } = await supabaseClient.from('alumni').insert(payload);
      if (error) throw error;
      showToast('Alumni added');
    }
    closeAlumniModal();
    await loadAlumni();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function handleAlumniDelete() {
  if (!editingAlumniId) return;
  if (!confirm('Remove this alumni from the Hall of Fame? This cannot be undone.')) return;
  try {
    const existing = alumni.find((a) => a.id === editingAlumniId);
    const { error } = await supabaseClient.from('alumni').delete().eq('id', editingAlumniId);
    if (error) throw error;
    if (existing?.photo_url) await deleteAlumniPhoto(existing.photo_url);
    showToast('Alumni removed');
    closeAlumniModal();
    await loadAlumni();
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
  switchTab('roster');
  await Promise.all([loadMembers(), loadAlumni()]);
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

  $('tab-roster-btn').addEventListener('click', () => switchTab('roster'));
  $('tab-hof-btn').addEventListener('click', () => switchTab('hof'));

  $('add-member-btn').addEventListener('click', () => openMemberModal(null));
  $('member-form').addEventListener('submit', handleMemberSubmit);
  $('member-cancel-btn').addEventListener('click', closeMemberModal);
  $('member-modal-close').addEventListener('click', closeMemberModal);
  $('member-delete-btn').addEventListener('click', handleMemberDelete);

  $('add-alumni-btn').addEventListener('click', () => openAlumniModal(null));
  $('alumni-form').addEventListener('submit', handleAlumniSubmit);
  $('alumni-cancel-btn').addEventListener('click', closeAlumniModal);
  $('alumni-modal-close').addEventListener('click', closeAlumniModal);
  $('alumni-delete-btn').addEventListener('click', handleAlumniDelete);
});
