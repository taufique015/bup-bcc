// ============================================================
// BUP BCC — Events page data loader (Supabase edition)
// Requires supabase-js and assets/js/supabase-config.js to be loaded first
// (see the <script> order in events.html). Renders the event cards, the
// category filter, and the Event Calendar timeline from the "events" table,
// so everything is driven by whatever the admin dashboard adds.
// ============================================================

const EVENT_CATEGORIES = [
  { id: 'competition', label: 'Competition' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'seminar', label: 'Seminar' },
  { id: 'networking', label: 'Networking' },
];
// Kept as a static list here for simplicity — Supabase enforces the same set at
// the database level (see the CHECK constraint in supabase-setup.sql). If you
// add a category, update it in both places AND add a filter pill in events.html.

const CATEGORY_LABEL = Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.id, c.label]));

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CAL_ICON = '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
const PIN_ICON = '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-gold" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.1 7-11.5A7 7 0 105 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const ARROW_ICON = '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// event_date is a plain date column ("2026-08-01"); parse it as local time so a
// day-1 date never slips to the previous month in a negative-offset timezone.
function eventDate(ev) {
  return ev.event_date ? new Date(ev.event_date + 'T00:00:00') : null;
}

function formatDate(ev) {
  const d = eventDate(ev);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------- cards

function renderCard(ev) {
  const label = CATEGORY_LABEL[ev.category] || ev.category;
  const href = ev.detail_url || '#';
  const img = ev.image_url
    ? `<img src="${escapeHtml(ev.image_url)}" alt="${escapeHtml(ev.title)}" loading="lazy">`
    : '';
  const date = formatDate(ev);

  return `
    <div class="glass-card group relative rounded-2xl overflow-hidden bg-ink-secondary/70 backdrop-blur-md border border-white/10 shadow-lg hover:-translate-y-1.5 transition-transform duration-300" data-category="${escapeHtml(ev.category)}">
      <div class="ribbon-corner"></div>
      <div class="glass-glow pointer-events-none absolute inset-0 rounded-2xl border border-gold/20 opacity-0 transition-opacity duration-300 z-[1]" style="background: radial-gradient(220px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(242, 185, 13, 0.22), rgba(201, 154, 0, 0.08) 40%, transparent 80%);"></div>
      <div class="glass-border-glow pointer-events-none absolute inset-0 rounded-2xl border border-white/20 opacity-0 transition-opacity duration-300 z-[1]" style="mask-image: radial-gradient(220px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), black 30%, transparent 100%); -webkit-mask-image: radial-gradient(220px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), black 30%, transparent 100%);"></div>
      <div class="relative z-[2]">
        <div class="relative h-40 sm:h-44 bg-ink flex items-center justify-center border-b border-white/10">
          ${img}
        </div>
        <div class="p-6 pt-12">
          <span class="inline-block text-[11px] font-display font-semibold uppercase tracking-wider text-gold bg-gold/10 border border-gold/20 rounded-full px-3 py-1 mb-3">${escapeHtml(label)}</span>
          <h3 class="font-display text-lg font-bold text-white">${escapeHtml(ev.title)}</h3>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-400">
            ${date ? `<span class="flex items-center gap-1">${CAL_ICON}${escapeHtml(date)}</span>` : ''}
            ${ev.location ? `<span class="flex items-center gap-1">${PIN_ICON}${escapeHtml(ev.location)}</span>` : ''}
          </div>
          ${ev.description ? `<p class="mt-3 text-sm text-gray-400 leading-relaxed">${escapeHtml(ev.description)}</p>` : ''}
          <a href="${escapeHtml(href)}" class="mt-4 inline-flex items-center gap-1.5 text-gold font-display font-semibold text-sm group-hover:gap-2.5 transition-all">
            View Details
            ${ARROW_ICON}
          </a>
        </div>
      </div>
    </div>
  `;
}

// The navbar and featured banner get their glow from the inline script in
// events.html; the DB-driven cards are created after that runs, so they get the
// identical spotlight-follows-cursor handler wired up here.
function attachGlow(card) {
  const glow = card.querySelector('.glass-glow');
  const borderGlow = card.querySelector('.glass-border-glow');
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    if (glow) glow.style.opacity = '1';
    if (borderGlow) borderGlow.style.opacity = '1';
  });
  card.addEventListener('mouseleave', () => {
    if (glow) glow.style.opacity = '0';
    if (borderGlow) borderGlow.style.opacity = '0';
  });
}

let filtersWired = false;

function wireFilters() {
  if (filtersWired) return;
  filtersWired = true;
  const filterButtons = document.querySelectorAll('.category-pill');
  const emptyState = document.getElementById('events-empty-state');
  const activeClasses = ['bg-gold', 'text-ink', 'border-gold'];
  const inactiveClasses = ['border-white/20', 'text-gray-300'];

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => {
        b.classList.remove(...activeClasses);
        b.classList.add(...inactiveClasses);
      });
      btn.classList.remove(...inactiveClasses);
      btn.classList.add(...activeClasses);

      const category = btn.dataset.category;
      let visibleCount = 0;
      document.querySelectorAll('#events-grid > [data-category]').forEach((card) => {
        const match = category === 'all' || card.dataset.category === category;
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      if (emptyState) emptyState.classList.toggle('hidden', visibleCount !== 0);
    });
  });
}

// ---------------------------------------------------------------- calendar

function eventsInMonth(events, year, monthIndex) {
  return events.filter((ev) => {
    const d = eventDate(ev);
    return d && d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

function calendarYear(events) {
  const years = events.map((ev) => eventDate(ev)).filter(Boolean).map((d) => d.getFullYear());
  return years.length ? Math.max(...years) : new Date().getFullYear();
}

function renderCalendar(events) {
  const year = calendarYear(events);
  const title = document.getElementById('calendar-title');
  if (title) title.textContent = `Event Calendar ${year}`;

  const byMonth = MONTHS_FULL.map((_, i) => eventsInMonth(events, year, i));

  const mobile = document.getElementById('calendar-mobile');
  if (mobile) {
    mobile.innerHTML = `<div class="flex flex-col">${byMonth
      .map((evs, i) => {
        const featured = evs.some((e) => e.featured);
        const has = evs.length > 0;
        const dot = featured
          ? '<span class="w-3.5 h-3.5 rounded-full shadow-[0_0_14px_3px_rgba(242,185,13,0.55)] bg-gold shrink-0" aria-hidden="true"></span>'
          : has
            ? '<span class="w-2.5 h-2.5 rounded-full border-2 border-gold bg-ink shrink-0" aria-hidden="true"></span>'
            : '<span class="w-2.5 h-2.5 rounded-full border-2 border-gold/40 bg-ink shrink-0" aria-hidden="true"></span>';
        const connector = i < 11 ? '<span class="w-px flex-1 bg-white/15 mt-1" aria-hidden="true"></span>' : '';
        const labelClass = featured ? 'text-white font-semibold' : 'text-gray-400';
        const chips = evs
          .map((e) =>
            e.featured
              ? `<div class="mt-2 inline-block bg-gold border border-gold rounded-lg px-3 py-1.5"><p class="text-xs text-ink font-display font-bold">${escapeHtml(e.title)}</p></div>`
              : `<div class="mt-2 inline-block bg-ink-secondary border border-gold/30 rounded-lg px-3 py-1.5"><p class="text-xs text-gold font-display font-semibold">${escapeHtml(e.title)}</p></div>`
          )
          .join('');
        return `
          <div class="flex gap-4">
            <div class="w-2.5 shrink-0 flex flex-col items-center">${dot}${connector}</div>
            <div class="${i < 11 ? 'pb-5' : ''}">
              <p class="text-sm ${labelClass}">${MONTHS_FULL[i]}</p>
              ${chips}
            </div>
          </div>`;
      })
      .join('')}</div>`;
  }

  const desktop = document.getElementById('calendar-desktop');
  if (desktop) {
    const labels = byMonth
      .map((evs, i) => {
        const featured = evs.some((e) => e.featured);
        return `<div class="text-center text-xs sm:text-sm ${featured ? 'text-white font-semibold' : 'text-gray-400'}">${MONTHS_SHORT[i]}</div>`;
      })
      .join('');

    const dots = byMonth
      .map((evs) => {
        const featured = evs.some((e) => e.featured);
        const has = evs.length > 0;
        const span = featured
          ? '<span class="w-3.5 h-3.5 rounded-full bg-gold shadow-[0_0_14px_3px_rgba(242,185,13,0.55)]"></span>'
          : has
            ? '<span class="w-2.5 h-2.5 rounded-full border-2 border-gold bg-ink"></span>'
            : '<span class="w-2.5 h-2.5 rounded-full border-2 border-gold/40 bg-ink"></span>';
        return `<div class="relative z-10 flex justify-center">${span}</div>`;
      })
      .join('');

    const chips = byMonth
      .map((evs) => {
        if (!evs.length) return '<div></div>';
        const inner = evs
          .map((e) =>
            e.featured
              ? `<div class="bg-gold border border-gold rounded-lg px-1.5 py-2 text-center"><p class="text-[10px] sm:text-[11px] leading-tight text-ink font-display font-bold">${escapeHtml(e.title)}</p></div>`
              : `<div class="bg-ink-secondary border border-gold/30 rounded-lg px-1.5 py-2 text-center"><p class="text-[10px] sm:text-[11px] leading-tight text-gold font-display font-semibold">${escapeHtml(e.title)}</p></div>`
          )
          .join('');
        return `<div class="flex flex-col gap-1.5">${inner}</div>`;
      })
      .join('');

    desktop.innerHTML = `
      <div class="grid grid-cols-12">${labels}</div>
      <div class="relative grid grid-cols-12 mt-4">
        <div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/15"></div>
        ${dots}
      </div>
      <div class="grid grid-cols-12 gap-1.5 sm:gap-2 mt-4">${chips}</div>`;
  }
}

// ---------------------------------------------------------------- past events gallery

function renderPastTile(ev) {
  const year = eventDate(ev)?.getFullYear() ?? '';
  const img = ev.image_url
    ? `<img src="${escapeHtml(ev.image_url)}" alt="${escapeHtml(ev.title)}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110">`
    : `<span class="text-gray-700 text-4xl font-display font-bold">${escapeHtml(String(year))}</span>`;
  const href = ev.detail_url || '#';

  return `
    <a href="${escapeHtml(href)}" class="group relative rounded-xl overflow-hidden bg-ink border border-white/10 h-[108px] block">
      <div class="absolute inset-0 flex items-center justify-center overflow-hidden">${img}</div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"></div>
      <div class="absolute inset-x-0 bottom-0 p-3">
        <p class="text-white text-xs sm:text-sm font-display font-semibold leading-tight">${escapeHtml(ev.title)}</p>
        ${year ? `<p class="text-gold text-[11px] mt-0.5">${year}</p>` : ''}
      </div>
      <div class="absolute inset-0 border border-transparent group-hover:border-gold/40 rounded-xl transition-colors duration-300"></div>
    </a>`;
}

// ---------------------------------------------------------------- load

async function loadEvents() {
  const grid = document.getElementById('events-grid');
  const emptyState = document.getElementById('events-empty-state');
  if (!grid) return;

  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .eq('active', true)
      .order('event_date', { ascending: false })
      .order('display_order');
    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 3);

    const events = data || [];
    // Upcoming grid: future events + anything within the last 2 years
    const upcoming = events.filter((ev) => {
      const d = eventDate(ev);
      return !d || d >= twoYearsAgo;
    });
    const past = events.filter((ev) => {
      const d = eventDate(ev);
      return d && d < today;
    });

    // Upcoming events grid
    grid.querySelectorAll('[data-category]').forEach((node) => node.remove());
    grid.insertAdjacentHTML('afterbegin', upcoming.map(renderCard).join(''));
    if (emptyState) emptyState.classList.toggle('hidden', upcoming.length !== 0);
    grid.querySelectorAll('.glass-card').forEach(attachGlow);
    wireFilters();

    // Past events gallery — show section only when there are past events
    const pastSection = document.getElementById('past-events-section');
    const pastGrid = document.getElementById('past-events-grid');
    if (pastGrid && pastSection) {
      if (past.length > 0) {
        // Past events ordered most-recent first
        pastGrid.innerHTML = past.map(renderPastTile).join('');
        pastSection.classList.remove('hidden');
      } else {
        pastSection.classList.add('hidden');
      }
    }

    renderCalendar(events);
  } catch (err) {
    console.error('Failed to load events:', err);
    wireFilters();
  }
}

document.addEventListener('DOMContentLoaded', loadEvents);
