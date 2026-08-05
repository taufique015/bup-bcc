// ============================================================
// BUP BCC — Team page data loader (Supabase edition)
// Requires supabase-js and assets/js/supabase-config.js to be loaded first
// (see the <script> order in team.html).
// ============================================================

const CATEGORIES = [
  { id: 'executive-panel', label: 'Executive Panel' },
  { id: 'sub-executive-panel', label: 'Sub-Executive Panel' },
  { id: 'executive-members', label: 'Executive Members' },
  { id: 'general-members', label: 'General Members' },
];
// Kept as a static list here for simplicity — Supabase enforces the same set
// at the database level (see the CHECK constraint in supabase-setup.sql). If
// you add a category, update it in both places.

// Stand-in roster shown when the table is empty (or unreachable) so the page
// never renders bare. Replace these by adding real members in admin.html.
const PLACEHOLDER_MEMBERS = [
  { name: 'X', title: 'President', batch: 'BBA Batch 10', category: 'executive-panel', department: 'Executive Panel' },
  { name: 'X', title: 'General Secretary', batch: 'BBA Batch 10', category: 'executive-panel', department: 'Executive Panel' },
  { name: 'X', title: 'Vice President - Operations', batch: 'BBA Batch 10', category: 'executive-panel', department: 'Executive Panel' },
  { name: 'X', title: 'Joint Secretary', batch: 'BBA Batch 11', category: 'sub-executive-panel', department: 'Sub-Executive Panel' },
  { name: 'X', title: 'Assistant Director', batch: 'BBA Batch 11', category: 'sub-executive-panel', department: 'Sub-Executive Panel' },
  { name: 'X', title: 'Director - Marketing', batch: 'BBA Batch 11', category: 'executive-members', department: 'Marketing & Brand Strategy' },
  { name: 'X', title: 'Director - Corporate Relations', batch: 'BBA Batch 11', category: 'executive-members', department: 'Corporate Relations' },
  { name: 'X', title: 'Member', batch: 'BBA Batch 12', category: 'general-members', department: 'General Body' },
];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

let activeCategory = 'all';

function renderFilters() {
  const el = document.getElementById('team-filters');
  if (!el) return;
  const buttons = [{ id: 'all', label: 'All' }, ...CATEGORIES];
  el.innerHTML = buttons
    .map(
      (c) => `
    <button type="button" data-category="${c.id}"
      class="category-pill inline-flex items-center rounded-full border px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-display font-semibold transition-colors duration-200 ${
        c.id === activeCategory ? 'bg-gold text-ink border-gold' : 'border-white/25 text-white hover:border-gold hover:text-gold'
      }">${escapeHtml(c.label)}</button>
  `
    )
    .join('');
  el.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderFilters();
      loadTeam();
    });
  });
}

function categoryLabel(id) {
  const found = CATEGORIES.find((c) => c.id === id);
  return found ? found.label : id;
}

// Same gold-circle treatment as the footer social buttons on the homepage.
function renderLinkedIn(member) {
  if (!member.linkedin_url) return '';
  return `
    <a href="${escapeHtml(member.linkedin_url)}" target="_blank" rel="noopener noreferrer"
      aria-label="${escapeHtml(member.name)} on LinkedIn"
      class="mt-3 sm:mt-4 inline-flex w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-white/20 items-center justify-center text-gray-300 hover:text-ink hover:bg-gold hover:border-gold transition-colors">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor"><path d="M6.94 8.5H3.56V20.5H6.94V8.5z"/><path d="M5.25 3.5a2 2 0 100 4 2 2 0 000-4z"/><path d="M20.44 20.5h-3.37v-5.9c0-1.4-.03-3.2-1.96-3.2-1.96 0-2.26 1.53-2.26 3.1v6h-3.37V8.5h3.24v1.64h.04c.45-.86 1.55-1.76 3.19-1.76 3.42 0 4.49 2.25 4.49 5.17v6.95z"/></svg>
    </a>
  `;
}

function renderMemberCard(member) {
  const avatar = member.photo_url
    ? `<img src="${escapeHtml(member.photo_url)}" alt="${escapeHtml(member.name)}" loading="lazy" class="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto rounded-full object-cover border-2 border-gold" />`
    : `<div class="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto rounded-full bg-neutral-800 border-2 border-gold/60 flex items-center justify-center text-gold font-display font-black text-base sm:text-xl">${escapeHtml(initials(member.name))}</div>`;

  // Two across on a phone leaves roughly 160px per card — enough for the
  // department line to stay visible, just at a tighter type size.
  return `
    <div class="team-card group relative rounded-xl sm:rounded-2xl overflow-hidden bg-ink-secondary border border-white/10 shadow-lg p-4 pt-6 sm:p-6 sm:pt-8 text-center">
      <div class="ribbon-corner"></div>
      ${avatar}
      <h3 class="font-display text-sm sm:text-base lg:text-lg font-bold text-white mt-3 sm:mt-4 leading-snug">${escapeHtml(member.name)}</h3>
      <p class="text-gold font-display font-semibold text-xs sm:text-sm mt-1 leading-snug">${escapeHtml(member.title)}</p>
      ${member.department ? `<p class="mt-2 text-[11px] sm:text-sm text-gray-400 leading-relaxed">${escapeHtml(member.department)}</p>` : ''}
      ${member.batch ? `<span class="inline-block mt-3 sm:mt-4 text-[10px] sm:text-[11px] font-display font-semibold uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1">${escapeHtml(member.batch)}</span>` : ''}
      ${renderLinkedIn(member)}
    </div>
  `;
}

function renderSkeletons() {
  // Eight fills whole rows at every breakpoint: 4 rows at 2-up, 2 rows at 4-up.
  return Array.from({ length: 8 })
    .map(
      () => `
    <div class="rounded-xl sm:rounded-2xl bg-ink-secondary border border-white/10 p-4 pt-6 sm:p-6 sm:pt-8 text-center">
      <div class="skeleton w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto rounded-full"></div>
      <div class="skeleton h-3.5 sm:h-4 w-2/3 mx-auto mt-3 sm:mt-4 rounded"></div>
      <div class="skeleton h-2.5 sm:h-3 w-1/2 mx-auto mt-2 rounded"></div>
      <div class="skeleton h-5 sm:h-6 w-20 sm:w-24 mx-auto mt-3 sm:mt-4 rounded-full"></div>
    </div>
  `
    )
    .join('');
}

function placeholdersFor(category) {
  return category === 'all' ? PLACEHOLDER_MEMBERS : PLACEHOLDER_MEMBERS.filter((m) => m.category === category);
}

async function loadTeam() {
  const grid = document.getElementById('team-grid');
  const emptyEl = document.getElementById('team-empty');
  const errorEl = document.getElementById('team-error');
  if (!grid) return;

  emptyEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  grid.classList.remove('hidden');
  grid.innerHTML = renderSkeletons();

  try {
    let query = supabaseClient.from('team_members').select('*').eq('active', true).order('display_order');
    if (activeCategory !== 'all') query = query.eq('category', activeCategory);
    const { data, error } = await query;
    if (error) throw error;

    const members = data && data.length ? data : placeholdersFor(activeCategory);
    if (members.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }
    grid.innerHTML = members.map(renderMemberCard).join('');
  } catch (err) {
    console.error('Failed to load team members:', err);
    const members = placeholdersFor(activeCategory);
    if (members.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      errorEl.textContent = 'Unable to load the team right now. Please check back shortly.';
      errorEl.classList.remove('hidden');
      return;
    }
    grid.innerHTML = members.map(renderMemberCard).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderFilters();
  loadTeam();
});
