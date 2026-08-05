// ============================================================
// BUP BCC — Hall of Fame data loader (Supabase edition)
// Requires supabase-js and assets/js/supabase-config.js to be loaded first
// (see the <script> order in hall-of-fame.html).
// ============================================================

// Stand-in alumni shown when the table is empty (or unreachable) so the Hall of
// Fame never renders bare. Replace these from the Hall of Fame tab in admin.html.
const PLACEHOLDER_ALUMNI = [
  { name: 'X', title: 'Founding President', class_year: 2023, achievement: '' },
  { name: 'X', title: 'General Secretary', class_year: 2022, achievement: '' },
  { name: 'X', title: 'Vice President - Operations', class_year: 2021, achievement: '' },
  { name: 'X', title: 'Director - Corporate Relations', class_year: 2020, achievement: '' },
  { name: 'X', title: 'Director - Marketing', class_year: 2019, achievement: '' },
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

let alumni = [];
let activeYear = 'all';

// Same gold-circle treatment as the footer social buttons on the homepage.
function renderLinkedIn(person) {
  if (!person.linkedin_url) return '';
  return `
    <a href="${escapeHtml(person.linkedin_url)}" target="_blank" rel="noopener noreferrer"
      aria-label="${escapeHtml(person.name)} on LinkedIn"
      class="mt-3 inline-flex w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-white/20 items-center justify-center text-gray-300 hover:text-ink hover:bg-gold hover:border-gold transition-colors">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor"><path d="M6.94 8.5H3.56V20.5H6.94V8.5z"/><path d="M5.25 3.5a2 2 0 100 4 2 2 0 000-4z"/><path d="M20.44 20.5h-3.37v-5.9c0-1.4-.03-3.2-1.96-3.2-1.96 0-2.26 1.53-2.26 3.1v6h-3.37V8.5h3.24v1.64h.04c.45-.86 1.55-1.76 3.19-1.76 3.42 0 4.49 2.25 4.49 5.17v6.95z"/></svg>
    </a>
  `;
}

function renderAlumniCard(person) {
  const avatar = person.photo_url
    ? `<img src="${escapeHtml(person.photo_url)}" alt="${escapeHtml(person.name)}" loading="lazy" class="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-gold mb-4" />`
    : `<div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/5 border-2 border-gold/50 flex items-center justify-center text-gold font-display font-black text-lg sm:text-xl mb-4">${escapeHtml(initials(person.name))}</div>`;

  return `
    <div class="alumni-card relative rounded-2xl bg-ink-secondary border border-white/10 overflow-hidden flex flex-col items-center text-center" data-year="${escapeHtml(String(person.class_year))}">
      <div class="ribbon-corner"></div>
      <div class="pt-7 sm:pt-8 pb-1 px-3 sm:px-4 flex flex-col items-center">
        ${avatar}
        <h3 class="font-display font-bold text-white text-sm sm:text-base leading-tight">${escapeHtml(person.name)}</h3>
        <p class="text-[11px] sm:text-xs text-gold mt-1">${escapeHtml(person.title)}</p>
        ${person.achievement ? `<p class="mt-2 text-[11px] sm:text-xs text-gray-400 leading-relaxed">${escapeHtml(person.achievement)}</p>` : ''}
        ${renderLinkedIn(person)}
      </div>
      <div class="px-3 sm:px-4 pb-5 sm:pb-6 mt-1">
        <span class="inline-block text-[9px] sm:text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full">Class of ${escapeHtml(String(person.class_year))}</span>
      </div>
    </div>
  `;
}

function renderSkeletons() {
  // Eight fills whole rows at every breakpoint: 4 rows at 2-up, 2 rows at 4-up.
  return Array.from({ length: 8 })
    .map(
      () => `
    <div class="rounded-2xl bg-ink-secondary border border-white/10 p-4 pt-7 sm:p-6 sm:pt-8 text-center">
      <div class="skeleton w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full"></div>
      <div class="skeleton h-3.5 sm:h-4 w-2/3 mx-auto mt-4 rounded"></div>
      <div class="skeleton h-2.5 sm:h-3 w-1/2 mx-auto mt-2 rounded"></div>
      <div class="skeleton h-5 sm:h-6 w-24 mx-auto mt-4 rounded-full"></div>
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

    alumni = data && data.length ? data : PLACEHOLDER_ALUMNI;
    renderFilters();
    renderAlumni();
  } catch (err) {
    console.error('Failed to load alumni:', err);
    alumni = PLACEHOLDER_ALUMNI;
    renderFilters();
    renderAlumni();
  }
}

document.addEventListener('DOMContentLoaded', loadAlumni);
