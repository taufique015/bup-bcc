// ============================================================
// BUP BCC — Team page data loader (Supabase edition)
// Requires supabase-js and assets/js/supabase-config.js to be loaded first
// (see the <script> order in team.html).
// ============================================================

const CATEGORIES = [
  { id: 'executive-panel', label: 'Executive Panel' },
  { id: 'sub-executive-panel', label: 'Sub-Executive Panel' },
  { id: 'sub-executive-members', label: 'Sub-Executive Members' },
  { id: 'general-members', label: 'General Members' },
];
// Kept as a static list here for simplicity — Supabase enforces the same set
// at the database level (see the CHECK constraint in supabase-setup.sql). If
// you add a category, update it in both places.


// Sub-Executive Panel members can be listed without a post; admin stores the
// sentinel title below because the database requires one, and the card hides it.
const NO_POST = 'No Post';

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

const SOCIAL_ICONS = {
  linkedin:
    '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M6.94 8.5H3.56V20.5H6.94V8.5z"/><path d="M5.25 3.5a2 2 0 100 4 2 2 0 000-4z"/><path d="M20.44 20.5h-3.37v-5.9c0-1.4-.03-3.2-1.96-3.2-1.96 0-2.26 1.53-2.26 3.1v6h-3.37V8.5h3.24v1.64h.04c.45-.86 1.55-1.76 3.19-1.76 3.42 0 4.49 2.25 4.49 5.17v6.95z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M22 12.06C22 6.5 17.5 2 12 2S2 6.5 2 12.06c0 5 3.66 9.17 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.45 2.91h-2.33v7.03C18.34 21.23 22 17.06 22 12.06z"/></svg>',
};

// Two sets of the same links: gold discs revealed over the photo on hover for
// pointer devices, and a quiet inline row for touch screens where hover never
// fires.
function socialLinks(person, variant) {
  const links = [
    { key: 'facebook', url: person.facebook_url, label: 'Facebook' },
    { key: 'linkedin', url: person.linkedin_url, label: 'LinkedIn' },
  ].filter((l) => l.url);
  if (!links.length) return '';

  const overlay = variant === 'overlay';
  const linkClass = overlay
    ? 'w-9 h-9 rounded-full bg-gold text-ink flex items-center justify-center shadow-lg shadow-black/40 transition-transform duration-200 hover:scale-110 active:scale-95'
    : 'w-8 h-8 rounded-full border border-white/15 text-gray-300 flex items-center justify-center transition-colors hover:text-ink hover:bg-gold hover:border-gold';

  const items = links
    .map(
      (l) => `
        <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"
          aria-label="${escapeHtml(person.name)} on ${l.label}"
          class="${linkClass}">${SOCIAL_ICONS[l.key]}</a>`
    )
    .join('');

  if (!overlay) return `<div class="flex gap-1.5 pt-1 md:hidden">${items}</div>`;

  return `
    <div class="absolute inset-0 hidden md:flex items-end justify-center pb-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent"></div>
      <div class="relative flex gap-2.5 translate-y-3 group-hover:translate-y-0 transition-transform duration-300 ease-out">${items}</div>
    </div>
  `;
}

// Portrait-led card: the photo carries the top of the card edge to edge and the
// details sit on a plate beneath it, separated by a gold hairline.
function renderPortrait(person) {
  const inner = person.photo_url
    ? `<img src="${escapeHtml(person.photo_url)}" alt="${escapeHtml(person.name)}" loading="lazy"
        class="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.07]" />`
    : `<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-ink text-gold/70 font-display font-black text-3xl sm:text-4xl tracking-widest">${escapeHtml(initials(person.name))}</div>`;

  return `
    <div class="relative w-full aspect-[4/5] overflow-hidden bg-neutral-900">
      ${inner}
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent"></div>
      ${socialLinks(person, 'overlay')}
    </div>
  `;
}

function renderMemberCard(member) {
  return `
    <div class="team-card group relative flex flex-col overflow-hidden rounded-xl sm:rounded-2xl bg-ink-secondary border border-white/10 shadow-lg">
      <div class="ribbon-corner"></div>
      ${renderPortrait(member)}
      <div class="relative flex flex-col gap-1.5 flex-1 px-3.5 py-3.5 sm:px-5 sm:py-4">
        <div class="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"></div>
        <h3 class="font-display text-sm sm:text-base font-bold text-white leading-snug">${escapeHtml(member.name)}</h3>
        ${(() => { const t = member.title === NO_POST && member.category === 'sub-executive-panel' ? 'Senior Executive Member' : member.title; return t && t !== NO_POST ? `<p class="text-gold font-display font-semibold text-[10px] sm:text-[11px] uppercase tracking-[0.08em] leading-snug">${escapeHtml(t)}</p>` : ''; })()}
        ${member.department ? `<p class="text-[11px] sm:text-xs text-gray-400 leading-relaxed">${escapeHtml(member.department)}</p>` : ''}
        ${socialLinks(member, 'inline')}
      </div>
    </div>
  `;
}

function renderSkeletons() {
  // Eight fills whole rows at every breakpoint: 4 rows at 2-up, 2 rows at 4-up.
  return Array.from({ length: 8 })
    .map(
      () => `
    <div class="rounded-xl sm:rounded-2xl overflow-hidden bg-ink-secondary border border-white/10">
      <div class="skeleton w-full aspect-[4/5]"></div>
      <div class="px-3.5 py-3.5 sm:px-5 sm:py-4">
        <div class="skeleton h-3.5 sm:h-4 w-3/4 rounded"></div>
        <div class="skeleton h-2.5 w-1/2 mt-2 rounded"></div>
        <div class="skeleton h-5 w-20 mt-3 rounded-full"></div>
      </div>
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

    // Category first, then display_order so ranked panel posts keep their
    // hierarchy, then name A-Z. Plain member categories all share one
    // display_order, so they come out purely alphabetical.
    const categoryOrder = CATEGORIES.map((c) => c.id);
    const sorted = [...(data || [])].sort((a, b) => {
      const ai = categoryOrder.indexOf(a.category);
      const bi = categoryOrder.indexOf(b.category);
      if (ai !== bi) return (ai === -1 ? categoryOrder.length : ai) - (bi === -1 ? categoryOrder.length : bi);
      const ao = a.display_order ?? 99;
      const bo = b.display_order ?? 99;
      if (ao !== bo) return ao - bo;
      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });

    if (!sorted.length) {
      grid.innerHTML = '';
      grid.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }
    grid.innerHTML = sorted.map(renderMemberCard).join('');
  } catch (err) {
    console.error('Failed to load team members:', err);
    grid.innerHTML = '';
    grid.classList.add('hidden');
    errorEl.textContent = 'Unable to load the team right now. Please check back shortly.';
    errorEl.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderFilters();
  loadTeam();
});
