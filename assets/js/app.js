// BUP Business & Communication Club (BUP BCC) Achievements Logic - Horizontal Cards Grid View
const CARDS_PER_PAGE = 8;
let currentPage = 1;
let filteredAchievements = [];
let allAchievements = [];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  allAchievements = typeof achievementsData !== 'undefined' ? [...achievementsData] : [];
  filteredAchievements = [...allAchievements];

  // Event Listeners
  const searchInput = document.getElementById('search-input');
  const yearFilter = document.getElementById('year-filter');
  
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (yearFilter) yearFilter.addEventListener('change', applyFilters);

  // Setup Backdrop Dismiss for Dialog
  setupModals();

  // Initial Render
  renderGrid();
});

// Apply Search & Year Filters
function applyFilters() {
  const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const selectedYear = document.getElementById('year-filter')?.value || 'all';

  filteredAchievements = allAchievements.filter(item => {
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

// Render Horizontal Cards Grid (4 Columns x 2 Rows)
function renderGrid() {
  const gridContainer = document.getElementById('achievements-grid');
  const emptyState = document.getElementById('empty-state');
  const paginationContainer = document.getElementById('pagination-container');

  if (!gridContainer) return;

  const totalItems = filteredAchievements.length;
  const totalPages = Math.ceil(totalItems / CARDS_PER_PAGE) || 1;

  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const endIndex = startIndex + CARDS_PER_PAGE;
  const pageItems = filteredAchievements.slice(startIndex, endIndex);

  // Empty state check
  if (pageItems.length === 0) {
    gridContainer.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  } else {
    if (emptyState) emptyState.classList.add('hidden');
  }

  // Render 4-Column Grid Cards (Text-only members, no avatars)
  gridContainer.innerHTML = pageItems.map(item => {
    // Text-only member list (no profile pictures)
    const membersText = item.members.map(m => m.name).join(', ');

    return `
      <article class="group bg-ink-secondary rounded-2xl border border-white/10 hover:border-gold/40 transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xl hover:-translate-y-1">
        
        <!-- Card Header Image & Rank Badge -->
        <div class="relative h-48 w-full overflow-hidden bg-black/40 border-b border-white/10">
          <img 
            src="${item.image}" 
            alt="${item.title}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onerror="this.src='assets/corporiddlerz-2025.jpg'"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-ink-secondary via-transparent to-transparent"></div>
          
          <!-- Rank Pill Badge -->
          <span class="absolute top-3 left-3 bg-gold text-slate-950 font-display font-bold text-xs px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/></svg>
            ${item.rank}
          </span>
          
          <!-- Year Badge -->
          <span class="absolute top-3 right-3 bg-ink/80 backdrop-blur text-gray-300 text-xs px-2.5 py-1 rounded-full border border-white/10 font-display font-semibold">
            ${item.year}
          </span>
        </div>

        <!-- Card Content Body -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="text-xs text-gold font-display font-semibold uppercase tracking-wider mb-1 truncate">${item.organizer}</div>
            <h3 class="font-display font-bold text-lg text-white group-hover:text-gold transition-colors line-clamp-1 mb-2">${item.title}</h3>
            <p class="text-xs sm:text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">${item.description}</p>
          </div>

          <div>
            <!-- Team & Members Row (Text Only, No Profile Avatars) -->
            <div class="border-t border-white/10 pt-3 text-xs space-y-1 mb-4">
              <div class="flex items-center justify-between">
                <span class="text-gold font-display font-semibold">Team:</span>
                <span class="text-white font-medium truncate max-w-[150px]">${item.teamName}</span>
              </div>
              <div class="flex items-start justify-between gap-1">
                <span class="text-gray-400 font-medium shrink-0">Members:</span>
                <span class="text-gray-300 truncate max-w-[170px]" title="${membersText}">${membersText}</span>
              </div>
            </div>

            <!-- View Detail CTA -->
            <button 
              onclick="openDetailModal(${item.id})"
              class="w-full py-2 px-3 rounded-xl bg-ink hover:bg-gold hover:text-slate-950 text-white text-xs font-display font-semibold border border-white/10 hover:border-gold transition-all flex items-center justify-center gap-2"
            >
              <span>View Details</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
          </div>
        </div>

      </article>
    `;
  }).join('');

  // Render Pagination Controls
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
        onclick="changePage(${currentPage - 1})"
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
        onclick="changePage(${i})"
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
        onclick="changePage(${currentPage + 1})"
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
  const totalPages = Math.ceil(filteredAchievements.length / CARDS_PER_PAGE);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderGrid();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }
}

// Open Detail Modal
function openDetailModal(id) {
  const item = allAchievements.find(a => a.id === id);
  if (!item) return;

  const modal = document.getElementById('detail-modal');
  const modalBody = document.getElementById('detail-modal-body');

  if (!modal || !modalBody) return;

  const membersText = item.members.map(m => `${m.name} (${m.role})`).join(', ');

  modalBody.innerHTML = `
    <div class="relative h-64 w-full rounded-2xl overflow-hidden mb-6 bg-black/50">
      <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-t from-ink-secondary via-ink-secondary/30 to-transparent"></div>
      <div class="absolute bottom-4 left-4 right-4">
        <span class="bg-gold text-slate-950 font-display font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block shadow">
          ${item.rank}
        </span>
        <h2 class="font-display text-2xl font-extrabold text-white leading-tight">${item.title}</h2>
      </div>
    </div>

    <div class="space-y-4 text-sm text-gray-300">
      <div class="flex items-center justify-between text-xs text-gold font-display uppercase tracking-wider border-b border-white/10 pb-2">
        <span>Organizer: ${item.organizer}</span>
        <span>Year: ${item.year}</span>
      </div>

      <div>
        <h4 class="text-xs font-display font-semibold text-gold uppercase tracking-wider mb-1">Team & Members</h4>
        <p class="text-white font-medium mb-1">Team: ${item.teamName}</p>
        <p class="text-gray-300 text-xs leading-relaxed">Clubmates: ${membersText}</p>
      </div>

      <div>
        <h4 class="text-xs font-display font-semibold text-gold uppercase tracking-wider mb-1">Case & Achievement Overview</h4>
        <p class="text-gray-300 leading-relaxed">${item.description}</p>
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
