// ============================================================
// BUP BCC — Team page data loader (Supabase edition)
// Requires supabase-js and assets/js/supabase-config.js to be loaded first
// (see the <script> order in team.html).
// ============================================================

const CATEGORIES = [
  { id: 'board', label: 'Executive Board' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'corporate', label: 'Corporate Relations' },
  { id: 'events', label: 'Event Management' },
  { id: 'hr', label: 'Human Resources' },
];
// Kept as a static list here for simplicity — Supabase enforces the same set
// at the database level (see the CHECK constraint in supabase-setup.sql). If
// you add a category, update it in both places.

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
      class="category-pill inline-flex items-center border rounded-full px-5 py-2 text-sm font-display font-medium transition-colors duration-200 ${
        c.id === activeCategory ? 'bg-gold text-ink border-gold' : 'border-white/20 text-gray-300 hover:border-gold hover:text-gold'
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

function renderMemberCard(member) {
  const avatar = member.photo_url
    ? `<img src="${escapeHtml(member.photo_url)}" alt="${escapeHtml(member.name)}" class="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full object-cover border-2 border-gold" />`
    : `<div class="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-neutral-800 border-2 border-gold/60 flex items-center justify-center text-gold font-display font-black text-xl">${escapeHtml(initials(member.name))}</div>`;

  return `
    <div class="team-card rounded-2xl bg-ink-secondary border-t-2 border-gold border border-white/10 p-6 text-center">
      ${member.batch ? `<span class="inline-block text-[11px] font-display font-semibold uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 rounded-full px-3 py-1 mb-4">${escapeHtml(member.batch)}</span>` : ''}
      ${avatar}
      <h3 class="font-display font-bold text-white mt-4">${escapeHtml(member.name)}</h3>
      <p class="text-gold text-xs font-medium mt-0.5">${escapeHtml(member.title)}</p>
      ${member.department ? `<p class="text-gray-500 text-xs mt-2">${escapeHtml(member.department)}</p>` : ''}
    </div>
  `;
}

function renderSkeletons() {
  return Array.from({ length: 4 })
    .map(
      () => `
    <div class="rounded-2xl bg-ink-secondary border border-white/10 p-6 text-center">
      <div class="skeleton w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full"></div>
      <div class="skeleton h-4 w-2/3 mx-auto mt-4 rounded"></div>
      <div class="skeleton h-3 w-1/2 mx-auto mt-2 rounded"></div>
    </div>
  `
    )
    .join('');
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

    if (!data || data.length === 0) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }
    grid.innerHTML = data.map(renderMemberCard).join('');
  } catch (err) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    errorEl.textContent = 'Unable to load the team right now. Please check back shortly.';
    errorEl.classList.remove('hidden');
    console.error('Failed to load team members:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderFilters();
  loadTeam();
});
