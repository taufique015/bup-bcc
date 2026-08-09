// BUP Business & Communication Club (BUP BCC) Achievements Logic - Horizontal Cards Grid View
// Records come from the Supabase `accomplishments` table.
const CARDS_PER_PAGE = 5;
const FALLBACK_IMAGE = 'assets/corporiddlerz-2025.jpg';

let currentPage = 1;
let filteredAccomplishments = [];
let allAccomplishments = [];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Normalises a Supabase row into the shape the renderers expect.
function fromRow(row) {
  const members = Array.isArray(row.members) ? row.members : [];
  return {
    id: String(row.id),
    title: row.title || '',
    organizer: row.organizer || '',
    year: String(row.year ?? ''),
    rank: row.rank || '',
    teamName: row.team_name || '',
    members: members.map((m) => ({ name: m?.name || '', role: m?.role || '' })).filter((m) => m.name),
    image: row.image_url || FALLBACK_IMAGE,
    description: row.description || '',
  };
}


// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const yearFilter = document.getElementById('year-filter');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (yearFilter) yearFilter.addEventListener('change', applyFilters);

  // Setup Backdrop Dismiss for Dialog
  setupModals();

  // Delegated "View Details" handling — ids are UUIDs, so they stay out of
  // inline handlers.
  const grid = document.getElementById('accomplishments-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-detail-id]');
      if (btn) openDetailModal(btn.dataset.detailId);
    });
  }

  const pagination = document.getElementById('pagination-container');
  if (pagination) {
    pagination.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (btn) changePage(Number(btn.dataset.page));
    });
  }

  loadAccomplishments();
});

async function loadAccomplishments() {
  let rows = null;

  if (typeof supabaseClient !== 'undefined') {
    try {
      const { data, error } = await supabaseClient
        .from('accomplishments')
        .select('*')
        .eq('active', true)
        .order('year', { ascending: false })
        .order('display_order');
      if (error) throw error;
      rows = data;
    } catch (err) {
      console.error('Failed to load accomplishments:', err);
    }
  }

  allAccomplishments = rows ? rows.map(fromRow) : [];
  populateYearFilter();
  applyFilters();
}

// Rebuilds the year dropdown from whatever years are actually present.
function populateYearFilter() {
  const select = document.getElementById('year-filter');
  if (!select) return;

  const previous = select.value;
  const years = [...new Set(allAccomplishments.map((a) => a.year).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  select.innerHTML =
    '<option value="all">All Years</option>' +
    years.map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');

  select.value = years.includes(previous) ? previous : 'all';
}

// Apply Search & Year Filters
function applyFilters() {
  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const selectedYear = document.getElementById('year-filter')?.value || 'all';

  filteredAccomplishments = allAccomplishments.filter(item => {
    // Year filter
    const matchesYear = selectedYear === 'all' || item.year === selectedYear;

    // Search filter across title, organizer, teamName, and member names
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery) ||
      item.organizer.toLowerCase().includes(searchQuery) ||
      item.teamName.toLowerCase().includes(searchQuery) ||
      item.members.some(m => m.name.toLowerCase().includes(searchQuery));

    return matchesYear && matchesSearch;
  });

  // Reset to page 1 on new filter
  currentPage = 1;
  renderGrid();
}

// Render Facebook-style feed (one card at a time, full width)
function renderGrid() {
  const gridContainer = document.getElementById('accomplishments-grid');
  const emptyState = document.getElementById('empty-state');
  const paginationContainer = document.getElementById('pagination-container');

  if (!gridContainer) return;

  const totalItems = filteredAccomplishments.length;
  const totalPages = Math.ceil(totalItems / CARDS_PER_PAGE) || 1;

  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pageItems = filteredAccomplishments.slice(startIndex, endIndex);

  if (pageItems.length === 0) {
    gridContainer.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  } else {
    if (emptyState) emptyState.classList.add('hidden');
  }

  gridContainer.innerHTML = pageItems.map(item => {
    const membersList = item.members.map(m =>
      `<span class="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-xs text-gray-300">${escapeHtml(m.role ? `${m.name} · ${m.role}` : m.name)}</span>`
    ).join('');

    return `
      <article class="bg-ink-secondary rounded-2xl border border-white/10 overflow-hidden shadow-xl">

        <!-- Post header -->
        <div class="flex items-center gap-3 px-4 pt-4 pb-3">
          <div class="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-gold fill-current" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/></svg>
          </div>
          <div class="min-w-0">
            <p class="font-display font-bold text-sm text-white leading-tight truncate">${escapeHtml(item.teamName || 'BUP BCC')}</p>
            <p class="text-xs text-gray-500">${escapeHtml(item.organizer)} · ${escapeHtml(item.year)}</p>
          </div>
          <span class="ml-auto shrink-0 bg-gold text-ink font-display font-bold text-[11px] px-2.5 py-1 rounded-full">${escapeHtml(item.rank)}</span>
        </div>

        <!-- Post body text -->
        <div class="px-4 pb-3">
          <h3 class="font-display font-bold text-base text-white mb-1">${escapeHtml(item.title)}</h3>
          ${item.description ? `<p class="text-sm text-gray-400 leading-relaxed">${escapeHtml(item.description)}</p>` : ''}
        </div>

        <!-- Image -->
        ${item.image ? `
        <div class="w-full h-auto bg-black/40 overflow-hidden">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover" loading="lazy" onerror="this.closest('div').style.display='none'">
        </div>` : ''}

        <!-- Members row -->
        ${membersList ? `
        <div class="px-4 pt-3 pb-1 flex flex-wrap gap-1.5">
          ${membersList}
        </div>` : ''}

        <!-- Action row -->
        <div class="px-4 py-3 border-t border-white/10 mt-2">
          <button
            type="button"
            data-detail-id="${escapeHtml(item.id)}"
            class="w-full py-2 rounded-xl bg-white/5 hover:bg-gold hover:text-ink text-gray-300 text-sm font-display font-semibold border border-white/10 hover:border-gold transition-all"
          >
            View Full Details
          </button>
        </div>

      </article>
    `;
  }).join('');

  renderPagination(totalPages);
}

// Render Pagination Controls
function renderPagination(totalPages) {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <div class="flex items-center justify-center gap-2 my-10">
      <button
        type="button"
        data-page="${currentPage - 1}"
        ${currentPage === 1 ? 'disabled' : ''}
        class="px-4 py-2 rounded-full bg-ink-secondary text-gray-300 text-sm font-display font-medium border border-white/10 hover:border-gold hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        &larr; Previous
      </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === currentPage;
    html += `
      <button
        type="button"
        data-page="${i}"
        class="w-10 h-10 rounded-full text-sm font-display font-semibold transition-all ${
          isActive
            ? 'bg-gold text-slate-950 font-bold shadow-lg shadow-gold/20 scale-105'
            : 'bg-ink-secondary text-gray-300 border border-white/10 hover:border-gold hover:text-white'
        }"
      >
        ${i}
      </button>
    `;
  }

  html += `
      <button
        type="button"
        data-page="${currentPage + 1}"
        ${currentPage === totalPages ? 'disabled' : ''}
        class="px-4 py-2 rounded-full bg-ink-secondary text-gray-300 text-sm font-display font-medium border border-white/10 hover:border-gold hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        Next &rarr;
      </button>
    </div>
  `;

  container.innerHTML = html;
}

// Change active page
function changePage(page) {
  const totalPages = Math.ceil(filteredAccomplishments.length / CARDS_PER_PAGE);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderGrid();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }
}

// Open Detail Modal
function openDetailModal(id) {
  const item = allAccomplishments.find(a => a.id === String(id));
  if (!item) return;

  const modal = document.getElementById('detail-modal');
  const modalBody = document.getElementById('detail-modal-body');

  if (!modal || !modalBody) return;

  const membersText = escapeHtml(
    item.members.map(m => (m.role ? `${m.name} (${m.role})` : m.name)).join(', ')
  );

  modalBody.innerHTML = `
    <div class="relative h-80 w-full rounded-2xl overflow-hidden mb-6 bg-black/50">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover" onerror="this.src='${FALLBACK_IMAGE}'" />
      <div class="absolute inset-0 bg-gradient-to-t from-ink-secondary via-ink-secondary/30 to-transparent"></div>
      <div class="absolute bottom-4 left-4 right-4">
        <span class="bg-gold text-slate-950 font-display font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block shadow">
          ${escapeHtml(item.rank)}
        </span>
        <h2 class="font-display text-2xl font-extrabold text-white leading-tight">${escapeHtml(item.title)}</h2>
      </div>
    </div>

    <div class="space-y-4 text-sm text-gray-300">
      <div class="flex items-center justify-between text-xs text-gold font-display uppercase tracking-wider border-b border-white/10 pb-2">
        <span>Organizer: ${escapeHtml(item.organizer)}</span>
        <span>Year: ${escapeHtml(item.year)}</span>
      </div>

      <div>
        <h4 class="text-xs font-display font-semibold text-gold uppercase tracking-wider mb-1">Team & Members</h4>
        <p class="text-white font-medium mb-1">Team: ${escapeHtml(item.teamName)}</p>
        <p class="text-gray-300 text-xs leading-relaxed">Clubmates: ${membersText}</p>
      </div>

      <div>
        <h4 class="text-xs font-display font-semibold text-gold uppercase tracking-wider mb-1">Case & Achievement Overview</h4>
        <p class="text-gray-300 leading-relaxed">${escapeHtml(item.description)}</p>
      </div>
    </div>
  `;

  modal.showModal();
}

function setupModals() {
  document.querySelectorAll('dialog').forEach(modal => {
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.bottom && rect.left <= e.clientX && e.clientX <= rect.right);
      if (!isInDialog) {
        modal.close();
      }
    });
  });
}

function closeDialog(id) {
  const modal = document.getElementById(id);
  if (modal) modal.close();
}
