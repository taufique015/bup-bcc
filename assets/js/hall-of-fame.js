// ============================================================
// BUP BCC — Hall of Fame data loader (Supabase edition)
// Requires supabase-js and assets/js/supabase-config.js to be loaded first
// (see the <script> order in hall-of-fame.html).
// ============================================================


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

let alumni = [];
let activeYear = 'all';

const SOCIAL_ICONS = {
  linkedin:
    '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M6.94 8.5H3.56V20.5H6.94V8.5z"/><path d="M5.25 3.5a2 2 0 100 4 2 2 0 000-4z"/><path d="M20.44 20.5h-3.37v-5.9c0-1.4-.03-3.2-1.96-3.2-1.96 0-2.26 1.53-2.26 3.1v6h-3.37V8.5h3.24v1.64h.04c.45-.86 1.55-1.76 3.19-1.76 3.42 0 4.49 2.25 4.49 5.17v6.95z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M22 12.06C22 6.5 17.5 2 12 2S2 6.5 2 12.06c0 5 3.66 9.17 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.45 2.91h-2.33v7.03C18.34 21.23 22 17.06 22 12.06z"/></svg>',
};

// Mirrors the team card: gold discs over the photo on hover, plus an inline row
// for touch screens where hover never fires.
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

function renderAlumniCard(person) {
  const portrait = person.photo_url
    ? `<img src="${escapeHtml(person.photo_url)}" alt="${escapeHtml(person.name)}" loading="lazy"
        class="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.07]" />`
    : `<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-ink text-gold/70 font-display font-black text-3xl sm:text-4xl tracking-widest">${escapeHtml(initials(person.name))}</div>`;

  return `
    <div class="alumni-card group relative flex flex-col overflow-hidden rounded-2xl bg-ink-secondary border border-white/10 shadow-lg" data-year="${escapeHtml(String(person.class_year))}">
      <div class="ribbon-corner"></div>
      <div class="relative w-full aspect-[4/5] overflow-hidden bg-neutral-900">
        ${portrait}
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent"></div>
        <span class="absolute bottom-2.5 right-2.5 z-10 text-[9px] sm:text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-gold bg-ink/70 backdrop-blur-sm border border-gold/25 px-2.5 py-0.5 rounded-full md:group-hover:opacity-0 transition-opacity duration-300">Class of ${escapeHtml(String(person.class_year))}</span>
        ${socialLinks(person, 'overlay')}
      </div>
      <div class="relative flex flex-col gap-1.5 flex-1 px-3.5 py-3.5 sm:px-5 sm:py-4">
        <div class="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"></div>
        <h3 class="font-display text-sm sm:text-base font-bold text-white leading-snug">${escapeHtml(person.name)}</h3>
        ${(() => { const t = person.title === 'No Post' && person.category === 'sub-executive-panel' ? 'Senior Executive Member' : person.title; return t && t !== 'No Post' ? `<p class="text-gold font-display font-semibold text-[10px] sm:text-[11px] uppercase tracking-[0.08em] leading-snug">${escapeHtml(t)}</p>` : ''; })()}
        ${person.achievement ? `<p class="text-[11px] sm:text-xs text-gray-400 leading-relaxed">${escapeHtml(person.achievement)}</p>` : ''}
        ${socialLinks(person, 'inline')}
      </div>
    </div>
  `;
}

function renderSkeletons() {
  // Eight fills whole rows at every breakpoint: 4 rows at 2-up, 2 rows at 4-up.
  return Array.from({ length: 8 })
    .map(
      () => `
    <div class="rounded-2xl overflow-hidden bg-ink-secondary border border-white/10">
      <div class="skeleton w-full aspect-[4/5]"></div>
      <div class="px-3.5 py-3.5 sm:px-5 sm:py-4">
        <div class="skeleton h-3.5 sm:h-4 w-3/4 rounded"></div>
        <div class="skeleton h-2.5 w-1/2 mt-2 rounded"></div>
        <div class="skeleton h-5 w-24 mt-3 rounded-full"></div>
      </div>
    </div>
  `
    )
    .join('');
}

function selectFilterButton(container, selectedBtn) {
  container.querySelectorAll('.year-filter-btn').forEach((btn) => {
    const isSelected = btn === selectedBtn;
    btn.setAttribute('aria-pressed', String(isSelected));
    btn.classList.toggle('bg-gold', isSelected);
    btn.classList.toggle('text-ink', isSelected);
    btn.classList.toggle('border-gold', isSelected);
    btn.classList.toggle('shadow-md', isSelected);
    btn.classList.toggle('shadow-gold/20', isSelected);
    btn.classList.toggle('border-white/15', !isSelected);
    btn.classList.toggle('text-gray-300', !isSelected);
    btn.classList.toggle('hover:border-gold/60', !isSelected);
    btn.classList.toggle('hover:text-white', !isSelected);
  });
}

// The year pills are derived from the data rather than hard-coded, so adding an
// alumni from a new class in the dashboard adds its filter automatically.
function renderFilters() {
  const container = document.getElementById('year-filters');
  if (!container) return;
  container.innerHTML = '';

  const years = [...new Set(alumni.map((a) => String(a.class_year)))].sort((a, b) => b.localeCompare(a));

  function createButton(label, year) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', 'false');
    btn.className = 'year-filter-btn px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-display font-semibold tracking-wide border transition-all duration-300';
    btn.addEventListener('click', () => {
      activeYear = year;
      selectFilterButton(container, btn);
      renderAlumni();
    });
    container.appendChild(btn);
    return btn;
  }

  const allBtn = createButton('All', 'all');
  let selected = allBtn;
  years.forEach((year) => {
    const btn = createButton(`Class of ${year}`, year);
    if (year === activeYear) selected = btn;
  });
  if (selected === allBtn) activeYear = 'all';
  selectFilterButton(container, selected);
}

function renderAlumni() {
  const grid = document.getElementById('alumni-grid');
  const emptyEl = document.getElementById('alumni-empty-state');
  if (!grid) return;

  const visible = activeYear === 'all' ? alumni : alumni.filter((a) => String(a.class_year) === activeYear);
  grid.innerHTML = visible.map(renderAlumniCard).join('');
  grid.classList.toggle('hidden', visible.length === 0);
  emptyEl.classList.toggle('hidden', visible.length > 0);
}

async function loadAlumni() {
  const grid = document.getElementById('alumni-grid');
  const emptyEl = document.getElementById('alumni-empty-state');
  const errorEl = document.getElementById('alumni-error');
  if (!grid) return;

  emptyEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  grid.classList.remove('hidden');
  grid.innerHTML = renderSkeletons();

  try {
    const { data, error } = await supabaseClient
      .from('alumni')
      .select('*')
      .eq('active', true)
      .order('class_year', { ascending: false })
      .order('display_order');
    if (error) throw error;

    alumni = data || [];
    renderFilters();
    renderAlumni();
  } catch (err) {
    console.error('Failed to load alumni:', err);
    alumni = [];
    renderFilters();
    renderAlumni();
  }
}

document.addEventListener('DOMContentLoaded', loadAlumni);
