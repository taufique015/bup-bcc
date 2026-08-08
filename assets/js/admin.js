// ============================================================
// BUP BCC — Executive dashboard (Team Roster + Hall of Fame)
// Requires supabase-js and assets/js/supabase-config.js loaded first.
// ============================================================

// ---------------------------------------------------------------- shared state

const CATEGORIES = [
  { id: 'executive-panel', label: 'Executive Panel' },
  { id: 'sub-executive-panel', label: 'Sub-Executive Panel' },
  { id: 'sub-executive-members', label: 'Sub-Executive Members' },
  { id: 'general-members', label: 'General Members' },
];

// Departments a post can be attached to. Only the two panels use them.
const DEPARTMENTS = [
  'Internal Affairs',
  'External Affairs',
  'Human Resources',
  'Policy Management',
  'IT & Web Development',
  'Operations & Activations',
  'Documentation',
  'Creative & Visualization',
  'Content & Publication',
  'Logistics & Procurement',
  'Academics',
  'Academics & Treasury',
  'Administration',
  'Communication',
  'Corporate Affairs',
  'Public Relations',
  'Partners',
  'Membership',
];

// Sub-Executive Panel members can sit on the panel without holding a post.
// Stored as a title (the database requires one) but never shown on team.html.
const NO_POST = 'No Post';

// Posts available per category. Sub-executive/general members hold no post or
// department — their title is fixed to the label below.
const POSTS = {
  'executive-panel': [
    'President',
    'Senior Vice President',
    'Vice President',
    'General Secretary',
    'Organizing Secretary',
    'Treasurer',
    'Joint Secretary',
  ],
  'sub-executive-panel': [
    'Junior Vice President',
    'Head of Department',
    'Deputy Head of Department',
    'Assistant Head of Department',
    'Senior Executive Member',
  ],
};

const PLAIN_TITLES = {
  'sub-executive-members': 'Sub-Executive Member',
  'general-members': 'General Member',
};

let members = [];
let alumni = [];
let achievements = [];
let editingMemberId = null;
let editingAlumniId = null;
let editingAchievementId = null;
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

const TABS = [
  { id: 'roster', panel: 'tab-roster', button: 'tab-roster-btn', publicPage: 'team.html' },
  { id: 'hof', panel: 'tab-hof', button: 'tab-hof-btn', publicPage: 'hall-of-fame.html' },
  { id: 'achievements', panel: 'tab-achievements', button: 'tab-achievements-btn', publicPage: 'achievements.html' },
];

function switchTab(tab) {
  activeTab = tab;

  const activeClasses = ['border-gold', 'bg-gold', 'text-ink'];
  const inactiveClasses = ['border-white/20', 'text-gray-300', 'hover:border-gold', 'hover:text-gold'];

  TABS.forEach((t) => {
    const isActive = t.id === tab;
    $(t.panel).classList.toggle('hidden', !isActive);
    const btn = $(t.button);
    activeClasses.forEach((c) => btn.classList.toggle(c, isActive));
    inactiveClasses.forEach((c) => btn.classList.toggle(c, !isActive));
    if (isActive) {
      $('view-public-link').href = t.publicPage;
      $('view-public-link').textContent = 'View public page';
    }
  });
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

// ------------------------------------------------- post / department selects

function optionsHtml(values, placeholder) {
  const opts = values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`);
  if (placeholder) opts.unshift(`<option value="">${escapeHtml(placeholder)}</option>`);
  return opts.join('');
}

// Splits a stored title such as "Head of Department - Academics" back into its
// post and department halves so the selects can be pre-filled when editing.
function splitTitle(title) {
  const [post, ...rest] = String(title || '').split(' - ');
  return { post: post.trim(), department: rest.join(' - ').trim() };
}

function composeTitle(prefix) {
  const category = $(`${prefix}-category`).value;
  if (PLAIN_TITLES[category]) return PLAIN_TITLES[category];
  const post = $(`${prefix}-post`).value;
  const department = $(`${prefix}-department`).value;
  if (!post) return '';
  if (post === NO_POST) return NO_POST;
  return department ? `${post} - ${department}` : post;
}

// Rebuilds the post list for the selected category and hides both selects for
// the two member categories, which carry no post or department.
function syncPostFields(prefix, keep) {
  const category = $(`${prefix}-category`).value;
  const posts = POSTS[category] || [];
  const hasPost = posts.length > 0;
  const postSelect = $(`${prefix}-post`);
  const deptSelect = $(`${prefix}-department`);

  $(`${prefix}-post-field`).classList.toggle('hidden', !hasPost);

  if (hasPost) {
    postSelect.innerHTML = optionsHtml(posts, 'Select a post…');
    postSelect.value = keep && posts.includes(keep.post) ? keep.post : '';
    deptSelect.innerHTML = optionsHtml(DEPARTMENTS, 'No department');
    deptSelect.value = keep && DEPARTMENTS.includes(keep.department) ? keep.department : '';
    // A panel member without a post carries no department either.
    $(`${prefix}-department-field`).classList.toggle('hidden', postSelect.value === NO_POST);
    if (postSelect.value === NO_POST) deptSelect.value = '';
  } else {
    $(`${prefix}-department-field`).classList.add('hidden');
    postSelect.innerHTML = '';
    deptSelect.innerHTML = '';
  }

  const preview = $(`${prefix}-title-preview`);
  const title = composeTitle(prefix);
  preview.textContent = title === NO_POST
    ? 'No post — the team page will show the name only.'
    : title ? `Will be shown as: ${title}` : 'Pick a post to build the title.';
}

function wirePostFields(prefix) {
  $(`${prefix}-category`).addEventListener('change', () => syncPostFields(prefix));
  $(`${prefix}-post`).addEventListener('change', () => syncPostFields(prefix, currentSelection(prefix)));
  $(`${prefix}-department`).addEventListener('change', () => syncPostFields(prefix, currentSelection(prefix)));
}

// Which panel a stored title belongs to, used where the row has no category
// column of its own (alumni).
function panelForTitle(title) {
  const { post } = splitTitle(title);
  const plain = Object.keys(PLAIN_TITLES).find((id) => PLAIN_TITLES[id] === post);
  if (plain) return plain;
  return Object.keys(POSTS).find((id) => POSTS[id].includes(post)) || '';
}

function currentSelection(prefix) {
  return { post: $(`${prefix}-post`).value, department: $(`${prefix}-department`).value };
}

function categoryLabel(id) {
  const c = CATEGORIES.find((c) => c.id === id);
  return c ? c.label : id;
}

function renderMemberCard(m) {
  const avatar = m.photo_url
    ? `<img src="${escapeHtml(m.photo_url)}" alt="" class="w-14 h-14 rounded-full object-cover border-2 border-gold/40 shrink-0" />`
    : `<div class="w-14 h-14 rounded-full bg-neutral-800 border-2 border-gold/40 flex items-center justify-center text-gold font-display font-bold shrink-0">${escapeHtml(initials(m.name))}</div>`;

  return `
    <div class="member-card bg-ink-secondary border border-white/10 border-t-2 border-t-gold/50 rounded-2xl shadow-lg p-5 flex gap-4 items-start ${m.active === false ? 'opacity-50' : ''}" data-id="${m.id}">
      <label class="member-cb-wrap mt-1 shrink-0 cursor-pointer hidden">
        <input type="checkbox" class="member-select-cb accent-gold w-4 h-4 rounded" data-id="${m.id}" />
      </label>
      ${avatar}
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-display font-semibold uppercase tracking-wider text-gold/80 truncate">${escapeHtml(categoryLabel(m.category))}${m.active === false ? ' · Hidden' : ''}</p>
        <p class="font-display font-bold text-white truncate mt-0.5">${escapeHtml(m.name)}</p>
        <p class="text-xs text-gray-400 truncate">${escapeHtml(m.title)}</p>
        <button data-edit="${m.id}" class="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold hover:gap-2.5 transition-all mt-3">
          Edit
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

let selectMode = false;
const PAGE_SIZE = 20;
let membersPage = 1;
let alumniPage = 1;

function renderPagination(containerId, currentPage, totalItems, onPageChange) {
  const outer = $(containerId);
  if (!outer) return;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) { outer.classList.add('hidden'); return; }
  outer.classList.remove('hidden');
  const inner = outer.firstElementChild;

  const btnBase = 'min-w-[2.25rem] h-9 px-3 rounded-lg text-sm font-display font-semibold transition-colors border';
  const activeCls = 'bg-gold text-ink border-gold';
  const inactiveCls = 'border-white/15 text-gray-300 hover:border-gold hover:text-gold';
  const disabledCls = 'border-white/10 text-gray-600 cursor-not-allowed';

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  inner.innerHTML = [
    `<button data-pg="prev" class="${btnBase} ${currentPage === 1 ? disabledCls : inactiveCls}" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`,
    ...pages.map((p) =>
      p === '…'
        ? `<span class="px-1 text-gray-600 text-sm self-center">…</span>`
        : `<button data-pg="${p}" class="${btnBase} ${p === currentPage ? activeCls : inactiveCls}">${p}</button>`
    ),
    `<button data-pg="next" class="${btnBase} ${currentPage === totalPages ? disabledCls : inactiveCls}" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`,
  ].join('');

  inner.querySelectorAll('button[data-pg]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.pg;
      let next = currentPage;
      if (v === 'prev') next = Math.max(1, currentPage - 1);
      else if (v === 'next') next = Math.min(totalPages, currentPage + 1);
      else next = Number(v);
      if (next !== currentPage) onPageChange(next);
    });
  });
}

function setSelectMode(on) {
  selectMode = on;
  document.querySelectorAll('.member-cb-wrap').forEach((el) => el.classList.toggle('hidden', !on));
  if (!on) document.querySelectorAll('.member-select-cb').forEach((cb) => (cb.checked = false));
  syncDeleteSelectedBtn();
  syncGraduateSelectedBtn();
  syncSelectAllBtn();
}

// Only meaningful once select mode is on, so it rides in and out with the
// checkboxes. Scoped to the cards on screen, which is all the bulk actions read.
function syncSelectAllBtn() {
  const btn = $('select-all-btn');
  if (!btn) return;
  btn.classList.toggle('hidden', !selectMode);
  if (!selectMode) return;
  const boxes = [...document.querySelectorAll('.member-select-cb')];
  const allChecked = boxes.length > 0 && boxes.every((cb) => cb.checked);
  const icon = allChecked
    ? '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
    : '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  btn.innerHTML = `${allChecked ? 'Deselect All' : 'Select All'} ${icon}`;
}

// Companion to the delete button: same selection, opposite outcome. Idle it
// reads as a call to action, in select mode it counts what's about to move.
function syncGraduateSelectedBtn() {
  const btn = $('graduate-selected-btn');
  if (!btn) return;
  const cap = '<svg viewBox="0 0 24 24" class="w-4 h-4 ml-2 inline-block" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4L2 9l10 5 10-5-10-5z"/><path d="M6 11.5V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5"/></svg>';
  const checked = selectMode ? [...document.querySelectorAll('.member-select-cb:checked')] : [];
  if (!selectMode) {
    btn.innerHTML = `Graduate Selected ${cap}`;
  } else if (checked.length === 0) {
    btn.innerHTML = `Select members to graduate ${cap}`;
  } else {
    btn.innerHTML = `Graduate ${checked.length} to Hall of Fame ${cap}`;
  }
  btn.classList.toggle('opacity-50', selectMode && checked.length === 0);
}

function syncDeleteSelectedBtn() {
  const btn = $('delete-selected-btn');
  if (!btn) return;
  const checked = selectMode ? [...document.querySelectorAll('.member-select-cb:checked')] : [];
  if (!selectMode) {
    btn.innerHTML = `Delete Selected <svg viewBox="0 0 24 24" class="w-4 h-4 ml-2 inline-block" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    btn.className = btn.className.replace(/border-gold[^\s]*/g, '').replace(/text-gold[^\s]*/g, '').trim();
    btn.classList.add('border-red-500/60', 'hover:border-red-400', 'hover:text-red-400', 'text-red-500');
  } else if (checked.length === 0) {
    btn.innerHTML = `Cancel <svg viewBox="0 0 24 24" class="w-4 h-4 ml-2 inline-block" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    btn.classList.remove('border-red-500/60', 'hover:border-red-400', 'hover:text-red-400', 'text-red-500');
    btn.classList.add('border-white/25', 'text-gray-300');
  } else {
    btn.innerHTML = `Delete ${checked.length} Member${checked.length === 1 ? '' : 's'} <svg viewBox="0 0 24 24" class="w-4 h-4 ml-2 inline-block" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    btn.classList.remove('border-white/25', 'text-gray-300');
    btn.classList.add('border-red-500/60', 'hover:border-red-400', 'hover:text-red-400', 'text-red-500');
  }
}

// Roster order: category first (panels before members), then display_order so
// ranked panel posts keep their hierarchy, then name A→Z. Plain member
// categories share one display_order, so they come out purely alphabetical.
function sortRoster(rows) {
  const order = CATEGORIES.map((c) => c.id);
  return [...rows].sort((a, b) => {
    const ai = order.indexOf(a.category);
    const bi = order.indexOf(b.category);
    if (ai !== bi) return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    const ao = a.display_order ?? 99;
    const bo = b.display_order ?? 99;
    if (ao !== bo) return ao - bo;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
  });
}

function renderMembers() {
  const grid = $('members-grid');
  const start = (membersPage - 1) * PAGE_SIZE;
  const page = members.slice(start, start + PAGE_SIZE);
  grid.innerHTML = page.map(renderMemberCard).join('');
  $('members-empty').classList.toggle('hidden', members.length !== 0);
  $('members-status').textContent = `${members.length} member${members.length === 1 ? '' : 's'} total`;
  grid.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openMemberModal(btn.dataset.edit)));
  grid.querySelectorAll('.member-select-cb').forEach((cb) =>
    cb.addEventListener('change', () => {
      syncDeleteSelectedBtn();
      syncGraduateSelectedBtn();
      syncSelectAllBtn();
    })
  );
  if (selectMode) setSelectMode(true);
  syncDeleteSelectedBtn();
  syncGraduateSelectedBtn();
  syncSelectAllBtn();
  renderPagination('members-pagination', membersPage, members.length, (p) => { membersPage = p; renderMembers(); });
}

function populateCategorySelect() {
  const html = CATEGORIES.map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
  $('member-category').innerHTML = html;
  $('alumni-category').innerHTML = html;
  wirePostFields('member');
  wirePostFields('alumni');
  syncPostFields('member');
  syncPostFields('alumni');
}

async function loadMembers() {
  const { data, error } = await supabaseClient.from('team_members').select('*').order('display_order');
  if (error) { showToast(error.message, true); return; }
  members = sortRoster(data || []);
  renderMembers();
}

// ---------------------------------------------------------------- team modal

function openMemberModal(id) {
  editingMemberId = id || null;
  const m = id ? members.find((x) => x.id === id) : null;

  $('member-modal-title').textContent = m ? 'Edit Team Member' : 'Add Team Member';
  $('member-name').value = m?.name || '';
  $('member-linkedin').value = m?.linkedin_url || '';
  $('member-facebook').value = m?.facebook_url || '';
  $('member-category').value = m?.category || CATEGORIES[0]?.id || '';
  const split = splitTitle(m?.title);
  syncPostFields('member', { post: split.post, department: split.department || m?.department || '' });
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
    const category = $('member-category').value;
    const title = composeTitle('member');
    if (!name) throw new Error('Name is required');
    if (!title) throw new Error('Post is required');

    const payload = {
      name,
      title,
      department: POSTS[category] && title !== NO_POST ? $('member-department').value : '',
      linkedin_url: $('member-linkedin').value.trim() || null,
      facebook_url: $('member-facebook').value.trim() || null,
      category,
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

// ---------------------------------------------------------------- bulk upload

// Rows parsed from the spreadsheet that passed validation and are ready to insert.
let bulkRows = [];

// Canonical columns for the multi-column format (still accepted alongside the
// simple SL./Name/Designation format used by the official panel spreadsheet).
const BULK_COLUMNS = [
  'name', 'category', 'post', 'department',
  'linkedin_url', 'facebook_url', 'display_order', 'active', 'photo_url',
];

// Header cells are matched loosely so "Full Name" and "name" both resolve.
function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s\-\.]+/g, '_');
}

const HEADER_ALIASES = {
  full_name: 'name',
  member_name: 'name',
  panel: 'category',
  title: 'post',
  dept: 'department',
  linkedin: 'linkedin_url',
  facebook: 'facebook_url',
  order: 'display_order',
  visible: 'active',
  photo: 'photo_url',
  // SL. column is ignored
  sl_: null,
  sl: null,
  'sl.': null,
};

function bulkColumnFor(header) {
  const key = normalizeHeader(header);
  if (key in HEADER_ALIASES) return HEADER_ALIASES[key]; // null means skip
  return BULK_COLUMNS.includes(key) ? key : null;
}

function categoryIdFrom(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  // The retired Executive Members category folds into the sub-executive members.
  if (key === 'executive-members' || key === 'executive members') return 'sub-executive-members';
  const match = CATEGORIES.find((c) => c.id === key || c.label.toLowerCase() === key);
  return match ? match.id : null;
}

function parseBoolean(value, fallback = true) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return !['no', 'false', '0', 'hidden', 'inactive', 'n'].includes(raw);
}

// ---------------------------------------------------------------- designation parsing
//
// The official panel spreadsheet writes a post and its department together in a
// single "Designation" cell, and the wording drifts from sheet to sheet:
//
//   Vice President (IT & Web Development)     Vice-President("IT and Web Dev")
//   Head of Communication                     Head of "Communication"
//   Deputy Head of Adminstration              Head of Department - Communication
//   Assistant Head of Operations & Activation Junior Vice President
//
// Everything below normalizes those variants down to a canonical
// { category, title, department } triple instead of rejecting the row.

const QUOTE_CHARS = '"“”‘’\'`';
const BRACKET_PAIRS = { '(': ')', '[': ']', '{': '}' };

// Peels off any wrapping quotes or brackets: `"Communication"` -> `Communication`.
function stripWrappers(raw) {
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  for (let guard = 0; guard < 5 && s.length > 1; guard++) {
    const first = s[0];
    const last = s[s.length - 1];
    if (BRACKET_PAIRS[first] === last || (QUOTE_CHARS.includes(first) && QUOTE_CHARS.includes(last))) {
      s = s.slice(1, -1).trim();
    } else {
      break;
    }
  }
  return s;
}

// Comparison key that ignores case, punctuation, hyphenation and "&" vs "and",
// so "Vice-President", "vice president" and "Vice President" all collapse to one.
function normalizeKey(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return a.length || b.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

// Picks the closest entry in `list` for `value`. Exact (normalized) matches win;
// otherwise a typo is accepted only when it is both close and unambiguous, so
// "Adminstration" resolves to "Administration" but a genuinely new label doesn't
// get silently absorbed into a similar-looking one.
function closestMatch(list, value) {
  const key = normalizeKey(value);
  if (!key) return null;
  const exact = list.find((item) => normalizeKey(item) === key);
  if (exact) return exact;

  let best = null;
  let bestDist = Infinity;
  let runnerUp = Infinity;
  for (const item of list) {
    const dist = levenshtein(normalizeKey(item), key);
    if (dist < bestDist) {
      runnerUp = bestDist;
      bestDist = dist;
      best = item;
    } else if (dist < runnerUp) {
      runnerUp = dist;
    }
  }
  const tolerance = Math.min(2, Math.floor(key.length / 6));
  if (best && bestDist <= tolerance && runnerUp - bestDist >= 2) return best;
  return null;
}

// Resolves a department string against DEPARTMENTS. Unknown departments are
// kept verbatim (title-cased as written) rather than treated as an error — the
// club adds departments faster than this list gets updated.
function fuzzyDept(raw) {
  let cleaned = stripWrappers(raw);
  // "Department of Communication", "Communication Department", "Comms Dept."
  cleaned = stripWrappers(cleaned.replace(/^(?:the\s+)?(?:department|dept\.?|dpt\.?)\s+(?:of|for)\s+/i, ''));
  cleaned = stripWrappers(cleaned.replace(/\s+(?:department|dept\.?|dpt\.?)$/i, ''));
  if (!cleaned) return '';
  return closestMatch(DEPARTMENTS, cleaned) || cleaned;
}

// Splits "Post (Dept)", `Post "Dept"`, "Post [Dept]" and "Post - Dept" into parts.
// A hyphen only counts as a separator when it is surrounded by whitespace, so
// "Vice-President" and "Sub-Executive Member" stay intact.
function splitPostAndDept(raw) {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();

  const bracketed = s.match(/^(.*?)\s*[([{]([^)\]}]+)[)\]}]\s*$/);
  if (bracketed && bracketed[1].trim()) {
    return { post: bracketed[1].trim(), dept: bracketed[2].trim() };
  }

  const quoted = s.match(/^(.*?)\s*["“‘`']([^"”’`']+)["”’`']\s*$/);
  if (quoted && quoted[1].trim()) {
    return { post: quoted[1].trim(), dept: quoted[2].trim() };
  }

  const dashed = s.match(/^(.*\S)\s+[-–—:,]\s*(\S.*)$/) || s.match(/^(.*\S)\s*[-–—:,]\s+(\S.*)$/);
  if (dashed) return { post: dashed[1].trim(), dept: dashed[2].trim() };

  return { post: s, dept: '' };
}

// Maps a "… Head …" prefix onto one of the three canonical head posts.
function headPostFor(prefix) {
  const p = normalizeKey(prefix);
  if (/^(assistant|asst|assoc|associate)/.test(p)) return 'Assistant Head of Department';
  if (/^(deputy|dy|vice|joint|co)/.test(p)) return 'Deputy Head of Department';
  return 'Head of Department';
}

// Parses a Designation string (as used in the official panel spreadsheet) into
// { category, title, department }. Returns null for unrecognized values.
function parseDesignation(raw) {
  const str = stripWrappers(raw);
  if (!str) return null;

  const { post: postPart, dept: deptPart } = splitPostAndDept(str);

  // 1. Plain member titles: General Member, Sub-Executive Member, Executive Member
  const plainId = Object.keys(PLAIN_TITLES).find(
    (id) => normalizeKey(PLAIN_TITLES[id]) === normalizeKey(str)
      || normalizeKey(PLAIN_TITLES[id]) === normalizeKey(postPart),
  );
  if (plainId) return { category: plainId, title: PLAIN_TITLES[plainId], department: '' };

  // 2. "Senior Executive Member" belongs to the Sub-Executive Panel.
  //    Plain "Executive Member" (retired category) falls into sub-executive-members.
  const legacy = normalizeKey(str);
  if (legacy === 'senior executive member') {
    return { category: 'sub-executive-panel', title: 'Senior Executive Member', department: '' };
  }
  if (legacy === 'executive member') {
    return { category: 'sub-executive-members', title: 'Executive Member', department: '' };
  }

  // 3. Head-style posts. "of" is optional and the department may sit after the
  //    word, inside quotes/brackets, or after a dash.
  const headMatch = postPart.match(/^(.*?)\bheads?\b\s*(?:of|for)?\s*(.*)$/i);
  if (headMatch) {
    let rest = stripWrappers(headMatch[2]);
    // "Head of Department - Communication" / "Head of the Department of Comms"
    rest = stripWrappers(rest.replace(/^(?:the\s+)?(?:departments?|dept\.?|dpt\.?)\b\s*(?:of|for)?\s*/i, ''));
    const department = fuzzyDept(rest || deptPart);
    const post = headPostFor(headMatch[1]);
    return {
      category: 'sub-executive-panel',
      title: department ? `${post} - ${department}` : post,
      department,
    };
  }

  // 4. Everything else: match the post against the panel post lists. Exact
  //    matches are tried across both panels first so a near-miss in one panel
  //    can't shadow an exact hit in the other ("Junior Vice President" must not
  //    be absorbed by "Senior Vice President").
  const panels = ['executive-panel', 'sub-executive-panel'];
  const postKey = normalizeKey(postPart);
  const exactPanel = panels.find((c) => POSTS[c].some((p) => normalizeKey(p) === postKey));
  for (const category of exactPanel ? [exactPanel] : panels) {
    const post = exactPanel
      ? POSTS[category].find((p) => normalizeKey(p) === postKey)
      : closestMatch(POSTS[category], postPart);
    if (!post) continue;
    const department = fuzzyDept(deptPart);
    return {
      category,
      title: department ? `${post} - ${department}` : post,
      department,
    };
  }

  return null;
}

// Turns one spreadsheet row into either a ready payload or a rejection reason.
// Supports two modes:
//   designation-mode: row has a `designation` key (official panel spreadsheet format)
//   column-mode:      row has separate `category`, `post`, `department` keys
function buildBulkRow(row) {
  const name = String(row.name ?? '').trim();
  if (!name) return { error: 'Missing name' };

  let category, title, department = '';

  if ('designation' in row) {
    // Designation-mode: infer everything from the single Designation field
    const parsed = parseDesignation(row.designation);
    if (!parsed) {
      return { error: `Unrecognized designation "${String(row.designation).trim()}"` };
    }
    category = parsed.category;
    title = parsed.title;
    department = parsed.department;
  } else {
    // Column-mode: explicit category/post/department columns
    category = categoryIdFrom(row.category ?? CATEGORIES[0].id);
    if (category === null) return { error: `Unknown category "${String(row.category).trim()}"` };

    const posts = POSTS[category];
    if (posts) {
      const post = String(row.post ?? '').trim();
      if (!post) return { error: `Post required for ${categoryLabel(category)}` };
      const matchedPost = posts.find((p) => p.toLowerCase() === post.toLowerCase());
      if (!matchedPost) return { error: `Unknown post "${post}"` };

      const dept = matchedPost === NO_POST ? '' : String(row.department ?? '').trim();
      if (dept) {
        const matchedDept = DEPARTMENTS.find((d) => d.toLowerCase() === dept.toLowerCase());
        if (!matchedDept) return { error: `Unknown department "${dept}"` };
        department = matchedDept;
      }
      title = department ? `${matchedPost} - ${department}` : matchedPost;
    } else {
      title = PLAIN_TITLES[category] || '';
    }
  }

  const orderRaw = String(row.display_order ?? '').trim();
  const order = Number(orderRaw);

  return {
    payload: {
      name,
      title,
      department,
      linkedin_url: String(row.linkedin_url ?? '').trim() || null,
      facebook_url: String(row.facebook_url ?? '').trim() || null,
      photo_url: String(row.photo_url ?? '').trim() || null,
      category,
      display_order: orderRaw && Number.isFinite(order) ? order : 99,
      active: parseBoolean(row.active),
    },
  };
}

function renderBulkPreview(results) {
  $('bulk-preview-body').innerHTML = results.map((r) => {
    const ok = !r.error;
    const status = ok
      ? '<span class="text-gold">Ready</span>'
      : `<span class="text-red-400">${escapeHtml(r.error)}</span>`;
    return `
      <tr class="${ok ? '' : 'bg-red-500/5'}">
        <td class="px-3 py-2 text-gray-500">${r.line}</td>
        <td class="px-3 py-2 text-white">${escapeHtml(r.payload?.name || r.raw?.name || '—')}</td>
        <td class="px-3 py-2 text-gray-400">${escapeHtml(r.payload?.title || '—')}</td>
        <td class="px-3 py-2 text-gray-400">${escapeHtml(r.payload ? categoryLabel(r.payload.category) : '—')}</td>
        <td class="px-3 py-2">${status}</td>
      </tr>
    `;
  }).join('');
  $('bulk-preview-wrap').classList.remove('hidden');
}

function resetBulkState() {
  bulkRows = [];
  $('bulk-import-btn').disabled = true;
  $('bulk-summary').classList.add('hidden');
  $('bulk-preview-wrap').classList.add('hidden');
  $('bulk-preview-body').innerHTML = '';
  $('bulk-error').classList.add('hidden');
}

function bulkError(message) {
  const el = $('bulk-error');
  el.textContent = message;
  el.classList.remove('hidden');
}

function openBulkModal() {
  resetBulkState();
  $('bulk-file').value = '';
  $('bulk-modal').classList.remove('hidden');
}

function closeBulkModal() {
  $('bulk-modal').classList.add('hidden');
  resetBulkState();
}

// Generates an XLSX template that mirrors the official panel spreadsheet format:
// title rows at the top, then batch sections each with a SL./Name/Designation header,
// followed by sample rows for every designation type.
function downloadBulkTemplate() {
  if (typeof XLSX === 'undefined') {
    bulkError('Spreadsheet reader failed to load. Reload the page and try again.');
    return;
  }

  const aoa = [
    ['', '', 'BUP Business & Communication Club'],
    ['', '', 'Executive Panel 20XX – XX'],
    ['', '', 'Batch 20XX  (Executive Panel)'],
    ['SL.', 'Name', 'Designation'],
    [1, 'Full Name Here', 'President'],
    [2, 'Full Name Here', 'General Secretary'],
    [3, 'Full Name Here', 'Senior Vice President (Internal Affairs)'],
    [4, 'Full Name Here', 'Vice President (Operations & Activations)'],
    [5, 'Full Name Here', 'Treasurer'],
    [6, 'Full Name Here', 'Joint Secretary'],
    [7, 'Full Name Here', 'Organizing Secretary'],
    ['', '', 'Batch 20XX  (Sub-Executive Panel)'],
    ['SL.', 'Name', 'Designation'],
    [1, 'Full Name Here', 'Junior Vice President'],
    [2, 'Full Name Here', 'Head of Communication'],
    [3, 'Full Name Here', 'Head of Corporate Affairs'],
    [4, 'Full Name Here', 'Deputy Head of Documentation'],
    [5, 'Full Name Here', 'Assistant Head of Logistics & Procurement'],
    [6, 'Full Name Here', 'No Post'],
    ['', '', 'Batch 20XX  (Sub-Executive Members)'],
    ['SL.', 'Name', 'Designation'],
    [1, 'Full Name Here', 'Sub-Executive Member'],
    ['', '', 'Batch 20XX  (General Members)'],
    ['SL.', 'Name', 'Designation'],
    [1, 'Full Name Here', 'General Member'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Panel 20XX-XX');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bcc-panel-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

async function handleBulkFile(e) {
  resetBulkState();
  const file = e.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    bulkError('Spreadsheet reader failed to load. Check your connection and reload the page.');
    return;
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('The file has no sheets.');

    // blankrows:true so we can detect section-header rows by empty Name cells
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true, defval: '' });

    // Find the first row containing "Name" — handles title rows at the top of
    // the official spreadsheet format (rows 1–3 are club/panel/batch labels).
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(grid.length, 15); i++) {
      if (grid[i].some((cell) => /^name$/i.test(String(cell).trim()))) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) throw new Error('No header row with a "Name" column found.');

    const firstHeaders = grid[headerRowIdx].map(bulkColumnFor);
    const nameColIdx = firstHeaders.indexOf('name');
    const hasDesignationCol = grid[headerRowIdx].some((c) => /^designation$/i.test(String(c).trim()));

    const results = [];
    let sl = 0;

    for (let i = headerRowIdx + 1; i < grid.length; i++) {
      const cells = grid[i];

      // Repeated section-header rows (SL. / Name / Designation) — skip them and
      // reset the current header mapping to the same column set.
      const col0 = String(cells[0] ?? '').trim();
      const col1 = String(cells[1] ?? '').trim();
      if (/^sl\.?$/i.test(col0)
        && (/^name$/i.test(col1) || cells.some((c) => /^designation$/i.test(String(c).trim())))) continue;

      // Skip rows where Name is empty (section titles, spacing rows).
      const nameVal = String(cells[nameColIdx] ?? '').trim();
      if (!nameVal) continue;

      // Skip if SL. is non-numeric (extra header artifacts)
      if (col0 && !/^\d+$/.test(col0)) continue;

      const raw = {};
      firstHeaders.forEach((col, c) => { if (col) raw[col] = cells[c]; });

      // In designation-mode the Designation column drives everything; preserve it.
      if (hasDesignationCol) {
        const desigIdx = grid[headerRowIdx].findIndex((c) => /^designation$/i.test(String(c).trim()));
        if (desigIdx !== -1) raw.designation = String(cells[desigIdx] ?? '').trim();
        // Remove `post` key so buildBulkRow picks the designation path.
        delete raw.post;
        delete raw.category;
      }

      sl += 1;
      if (!String(raw.display_order ?? '').trim()) {
        raw.display_order = /^\d+$/.test(col0) ? Number(col0) : sl;
      }
      results.push({ line: i + 1, raw, ...buildBulkRow(raw) });
    }

    if (!results.length) throw new Error('No member rows found in the file.');

    bulkRows = results.filter((r) => !r.error).map((r) => r.payload);
    const skipped = results.length - bulkRows.length;

    $('bulk-summary').textContent = `${bulkRows.length} member${bulkRows.length === 1 ? '' : 's'} ready to import`
      + (skipped ? ` · ${skipped} row${skipped === 1 ? '' : 's'} will be skipped` : '');
    $('bulk-summary').classList.remove('hidden');
    renderBulkPreview(results);
    $('bulk-import-btn').disabled = bulkRows.length === 0;
  } catch (err) {
    bulkError(err.message || 'Could not read that file.');
  }
}

async function handleBulkImport() {
  if (!bulkRows.length) return;
  const btn = $('bulk-import-btn');
  btn.disabled = true;
  btn.textContent = 'Importing…';
  $('bulk-error').classList.add('hidden');

  try {
    const { error } = await supabaseClient.from('team_members').insert(bulkRows);
    if (error) throw error;
    showToast(`${bulkRows.length} member${bulkRows.length === 1 ? '' : 's'} imported`);
    closeBulkModal();
    await loadMembers();
  } catch (err) {
    bulkError(err.message);
    btn.disabled = false;
  } finally {
    btn.textContent = 'Import';
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
  const start = (alumniPage - 1) * PAGE_SIZE;
  const page = alumni.slice(start, start + PAGE_SIZE);
  grid.innerHTML = page.map(renderAlumniCard).join('');
  $('alumni-empty').classList.toggle('hidden', alumni.length !== 0);
  $('alumni-status').textContent = `${alumni.length} alumni inducted`;
  grid.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openAlumniModal(btn.dataset.edit)));
  renderPagination('alumni-pagination', alumniPage, alumni.length, (p) => { alumniPage = p; renderAlumni(); });
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
  // Alumni store only the composed title, so the panel is inferred from the post.
  const aSplit = splitTitle(a?.title);
  $('alumni-category').value = panelForTitle(a?.title) || CATEGORIES[0]?.id;
  syncPostFields('alumni', aSplit);
  $('alumni-year').value = a?.class_year ?? new Date().getFullYear();
  $('alumni-achievement').value = a?.achievement || '';
  $('alumni-linkedin').value = a?.linkedin_url || '';
  $('alumni-facebook').value = a?.facebook_url || '';
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
    const title = composeTitle('alumni');
    const classYear = Number($('alumni-year').value);
    if (!name) throw new Error('Name is required');
    if (!title) throw new Error('Post is required');
    if (!Number.isInteger(classYear) || classYear < 1990 || classYear > 2100) {
      throw new Error('Class year must be between 1990 and 2100');
    }

    const payload = {
      name,
      title,
      class_year: classYear,
      achievement: $('alumni-achievement').value.trim(),
      linkedin_url: $('alumni-linkedin').value.trim() || null,
      facebook_url: $('alumni-facebook').value.trim() || null,
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

// ---------------------------------------------------------------- achievement images

function achievementStoragePath(url) {
  const marker = '/achievement-photos/';
  const idx = (url || '').indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

async function deleteAchievementPhoto(photoUrl) {
  const path = achievementStoragePath(photoUrl);
  if (!path) return;
  await supabaseClient.storage.from('achievement-photos').remove([path]);
}

async function uploadAchievementPhoto(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseClient.storage.from('achievement-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabaseClient.storage.from('achievement-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------- achievement members

// The textarea holds one member per line as "Name - Role"; the role is
// optional, and everything after the first separator counts as the role so a
// title containing a hyphen survives the round trip.
function parseMembers(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf(' - ');
      if (sep === -1) return { name: line, role: '' };
      return { name: line.slice(0, sep).trim(), role: line.slice(sep + 3).trim() };
    })
    .filter((m) => m.name);
}

function membersToText(list) {
  return (Array.isArray(list) ? list : [])
    .map((m) => (m?.role ? `${m.name} - ${m.role}` : m?.name || ''))
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------- achievement rendering

function renderAchievementCard(a) {
  const memberNames = (Array.isArray(a.members) ? a.members : []).map((m) => m?.name).filter(Boolean).join(', ');
  const cover = a.image_url
    ? `<img src="${escapeHtml(a.image_url)}" alt="" class="w-14 h-14 rounded-xl object-cover border-2 border-gold/40 shrink-0" />`
    : `<div class="w-14 h-14 rounded-xl bg-neutral-800 border-2 border-gold/40 flex items-center justify-center text-gold shrink-0">
         <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/></svg>
       </div>`;

  return `
    <div class="member-card bg-ink-secondary border border-white/10 border-t-2 border-t-gold/50 rounded-2xl shadow-lg p-5 flex gap-4 items-start ${a.active === false ? 'opacity-50' : ''}">
      ${cover}
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-display font-semibold uppercase tracking-wider text-gold/80 truncate">${escapeHtml(String(a.year))}${a.rank ? ' · ' + escapeHtml(a.rank) : ''}${a.active === false ? ' · Hidden' : ''}</p>
        <p class="font-display font-bold text-white truncate mt-0.5">${escapeHtml(a.title)}</p>
        <p class="text-xs text-gray-400 truncate">${escapeHtml(a.organizer || '')}</p>
        <p class="text-[11px] text-gray-500 mt-1 truncate">${escapeHtml(a.team_name || '')}${memberNames ? ' — ' + escapeHtml(memberNames) : ''}</p>
        <button data-edit="${a.id}" class="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-gold hover:gap-2.5 transition-all mt-3">
          Edit
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderAchievements() {
  const grid = $('achievements-grid');
  grid.innerHTML = achievements.map(renderAchievementCard).join('');
  $('achievements-empty').classList.toggle('hidden', achievements.length !== 0);
  $('achievements-status').textContent = `${achievements.length} achievement${achievements.length === 1 ? '' : 's'} recorded`;
  grid.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openAchievementModal(btn.dataset.edit)));
}

async function loadAchievements() {
  const { data, error } = await supabaseClient
    .from('achievements')
    .select('*')
    .order('year', { ascending: false })
    .order('display_order');
  if (error) { showToast(error.message, true); return; }
  achievements = data || [];
  renderAchievements();
}

// ---------------------------------------------------------------- achievement modal

function openAchievementModal(id) {
  editingAchievementId = id || null;
  const a = id ? achievements.find((x) => x.id === id) : null;

  $('achievement-modal-title').textContent = a ? 'Edit Achievement' : 'Add Achievement';
  $('achievement-title').value = a?.title || '';
  $('achievement-organizer').value = a?.organizer || '';
  $('achievement-year').value = a?.year ?? new Date().getFullYear();
  $('achievement-rank').value = a?.rank || '';
  $('achievement-team').value = a?.team_name || '';
  $('achievement-members').value = membersToText(a?.members);
  $('achievement-description').value = a?.description || '';
  $('achievement-order').value = a?.display_order ?? 99;
  $('achievement-active').checked = a ? a.active !== false : true;
  $('achievement-photo').value = '';
  $('achievement-remove-photo').checked = false;
  $('achievement-remove-photo-label').classList.toggle('hidden', !a?.image_url);
  $('achievement-delete-btn').classList.toggle('hidden', !a);
  $('achievement-form-error').classList.add('hidden');
  $('achievement-modal').classList.remove('hidden');
  $('achievement-title').focus();
}

function closeAchievementModal() {
  $('achievement-modal').classList.add('hidden');
  editingAchievementId = null;
}

async function handleAchievementSubmit(e) {
  e.preventDefault();
  const errorEl = $('achievement-form-error');
  errorEl.classList.add('hidden');
  const saveBtn = $('achievement-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const title = $('achievement-title').value.trim();
    const year = Number($('achievement-year').value);
    if (!title) throw new Error('Title is required');
    if (!Number.isInteger(year) || year < 1990 || year > 2100) {
      throw new Error('Year must be between 1990 and 2100');
    }

    const payload = {
      title,
      organizer: $('achievement-organizer').value.trim(),
      year,
      rank: $('achievement-rank').value.trim(),
      team_name: $('achievement-team').value.trim(),
      members: parseMembers($('achievement-members').value),
      description: $('achievement-description').value.trim(),
      display_order: Number($('achievement-order').value) || 99,
      active: $('achievement-active').checked,
    };

    const existing = editingAchievementId ? achievements.find((a) => a.id === editingAchievementId) : null;
    const file = $('achievement-photo').files[0];

    if ($('achievement-remove-photo').checked) {
      if (existing?.image_url) await deleteAchievementPhoto(existing.image_url);
      payload.image_url = null;
    } else if (file) {
      if (file.size > 3 * 1024 * 1024) throw new Error('Image must be under 3MB');
      const newUrl = await uploadAchievementPhoto(file);
      if (existing?.image_url) await deleteAchievementPhoto(existing.image_url);
      payload.image_url = newUrl;
    }

    if (editingAchievementId) {
      const { error } = await supabaseClient.from('achievements').update(payload).eq('id', editingAchievementId);
      if (error) throw error;
      showToast('Achievement updated');
    } else {
      const { error } = await supabaseClient.from('achievements').insert(payload);
      if (error) throw error;
      showToast('Achievement added');
    }
    closeAchievementModal();
    await loadAchievements();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function handleAchievementDelete() {
  if (!editingAchievementId) return;
  if (!confirm('Remove this achievement? This cannot be undone.')) return;
  try {
    const existing = achievements.find((a) => a.id === editingAchievementId);
    const { error } = await supabaseClient.from('achievements').delete().eq('id', editingAchievementId);
    if (error) throw error;
    if (existing?.image_url) await deleteAchievementPhoto(existing.image_url);
    showToast('Achievement removed');
    closeAchievementModal();
    await loadAchievements();
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
  if (!(await isAdmin())) {
    await supabaseClient.auth.signOut();
    errorEl.textContent = 'This account is not an Executive account.';
    errorEl.classList.remove('hidden');
    return;
  }
  currentUser = data.user;
  await enterDashboard();
}

// A valid Supabase account is not the same thing as an Executive. The database
// enforces this too (RLS + is_admin()); this only stops the dashboard from
// rendering an empty, unusable shell for someone who isn't on the allow-list.
async function isAdmin() {
  const { data, error } = await supabaseClient.rpc('is_admin');
  if (error) return false;
  return data === true;
}

async function enterDashboard() {
  $('welcome-text').textContent = `Signed in as ${currentUser.email}`;
  showScreen('dashboard-screen');
  populateCategorySelect();
  switchTab('roster');
  await Promise.all([loadMembers(), loadAlumni(), loadAchievements()]);
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
  if (data.session && (await isAdmin())) {
    currentUser = data.session.user;
    await enterDashboard();
  } else if (data.session) {
    await supabaseClient.auth.signOut();
    showScreen('auth-screen');
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
  $('tab-achievements-btn').addEventListener('click', () => switchTab('achievements'));

  $('add-member-btn').addEventListener('click', () => openMemberModal(null));
  $('select-all-btn').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('.member-select-cb')];
    const allChecked = boxes.length > 0 && boxes.every((cb) => cb.checked);
    boxes.forEach((cb) => (cb.checked = !allChecked));
    syncDeleteSelectedBtn();
    syncGraduateSelectedBtn();
    syncSelectAllBtn();
  });
  $('delete-selected-btn').addEventListener('click', async () => {
    if (!selectMode) { setSelectMode(true); return; }
    const checked = [...document.querySelectorAll('.member-select-cb:checked')];
    if (!checked.length) { setSelectMode(false); return; }
    const ids = checked.map((cb) => cb.dataset.id);
    if (!confirm(`Permanently delete ${ids.length} member${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    const { error } = await supabaseClient.from('team_members').delete().in('id', ids);
    if (error) { alert('Delete failed: ' + error.message); return; }
    members = members.filter((m) => !ids.includes(String(m.id)));
    membersPage = 1;
    setSelectMode(false);
    renderMembers();
  });
  $('graduate-selected-btn').addEventListener('click', async () => {
    if (!selectMode) { setSelectMode(true); return; }
    const checked = [...document.querySelectorAll('.member-select-cb:checked')];
    if (!checked.length) return;
    const ids = checked.map((cb) => cb.dataset.id);
    const picked = members.filter((m) => ids.includes(String(m.id)));

    // The class year is decided server-side (highest year in the Hall of Fame
    // + 1); ask for it first so the confirmation can name it.
    const { data: year, error: yearError } = await supabaseClient.rpc('next_class_year');
    if (yearError) { alert('Could not work out the class year: ' + yearError.message); return; }

    const names = picked.slice(0, 5).map((m) => `• ${m.name} → Former ${m.title}`).join('\n');
    const more = picked.length > 5 ? `\n…and ${picked.length - 5} more` : '';
    if (!confirm(`Graduate ${ids.length} member${ids.length === 1 ? '' : 's'} into the Hall of Fame, Class of ${year}?\n\n${names}${more}\n\nThey will be removed from the team roster.`)) return;

    const { data: classYear, error } = await supabaseClient.rpc('graduate_members', { p_ids: ids });
    if (error) { alert('Graduation failed: ' + error.message); return; }

    setSelectMode(false);
    membersPage = 1;
    alumniPage = 1;
    await Promise.all([loadMembers(), loadAlumni()]);
    showToast(`Moved ${ids.length} member${ids.length === 1 ? '' : 's'} to the Hall of Fame, Class of ${classYear}`);
  });
  $('member-form').addEventListener('submit', handleMemberSubmit);
  $('member-cancel-btn').addEventListener('click', closeMemberModal);
  $('member-modal-close').addEventListener('click', closeMemberModal);
  $('member-delete-btn').addEventListener('click', handleMemberDelete);

  $('bulk-upload-btn').addEventListener('click', openBulkModal);
  $('bulk-modal-close').addEventListener('click', closeBulkModal);
  $('bulk-cancel-btn').addEventListener('click', closeBulkModal);
  $('bulk-template-btn').addEventListener('click', downloadBulkTemplate);
  $('bulk-file').addEventListener('change', handleBulkFile);
  $('bulk-import-btn').addEventListener('click', handleBulkImport);

  $('add-alumni-btn').addEventListener('click', () => openAlumniModal(null));
  $('alumni-form').addEventListener('submit', handleAlumniSubmit);
  $('alumni-cancel-btn').addEventListener('click', closeAlumniModal);
  $('alumni-modal-close').addEventListener('click', closeAlumniModal);
  $('alumni-delete-btn').addEventListener('click', handleAlumniDelete);

  $('add-achievement-btn').addEventListener('click', () => openAchievementModal(null));
  $('achievement-form').addEventListener('submit', handleAchievementSubmit);
  $('achievement-cancel-btn').addEventListener('click', closeAchievementModal);
  $('achievement-modal-close').addEventListener('click', closeAchievementModal);
  $('achievement-delete-btn').addEventListener('click', handleAchievementDelete);
});
