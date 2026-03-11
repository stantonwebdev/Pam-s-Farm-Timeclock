// Pam's Farm Time Clock - Main App Logic
import {
  getSetting, setSetting,
  clockIn, clockOut, getOpenEntry,
  getEntriesForWeek, addEntry, updateEntry, deleteEntry,
} from './storage.js';
import { generateCSV, exportAndShare, getWeekLabel } from './export.js';

// ── Week Utilities ──────────────────────────────────────────────

function getWeekStart(date) {
  // Thu–Wed work week: Thursday = day 4
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const daysSinceThursday = ((day - 4) + 7) % 7;
  d.setDate(d.getDate() - daysSinceThursday);
  return d;
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function buildWeekList() {
  const weeks = [];
  const now = new Date();
  let ws = getWeekStart(now);
  for (let i = 0; i < 6; i++) {
    weeks.push(new Date(ws));
    ws = new Date(ws);
    ws.setDate(ws.getDate() - 7);
  }
  return weeks; // newest first
}

function fmtShort(d) {
  return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
}

function getDayKey(d) {
  const dd = new Date(d);
  return `${dd.getFullYear()}-${(dd.getMonth()+1).toString().padStart(2,'0')}-${dd.getDate().toString().padStart(2,'0')}`;
}

function fmt24(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

function fmtDate(d) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = new Date(d);
  return `${days[dd.getDay()]} ${months[dd.getMonth()]} ${dd.getDate()}`;
}

function decHours(ms) {
  return (ms / 3600000).toFixed(2);
}

function parseTimeToMs(timeStr, dateRef) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateRef);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// ── State ────────────────────────────────────────────────────────

const state = {
  userName: '',
  openEntry: null,
  weekList: buildWeekList(),
  weekIndex: 0,
  clockInterval: null,
  currentEntries: [],
};

// ── DOM Refs ─────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const el = {
  loading:        $('loading'),
  app:            $('app'),
  // tabs
  homeTab:        $('home-tab'),
  timesheetTab:   $('timesheet-tab'),
  homeScreen:     $('home-screen'),
  timesheetScreen:$('timesheet-screen'),
  // home
  currentTime:    $('current-time'),
  currentDate:    $('current-date'),
  statusBadge:    $('status-badge'),
  clockInSince:   $('clock-in-since'),
  lastPunch:      $('last-punch'),
  clockInBtn:     $('clock-in-btn'),
  clockOutBtn:    $('clock-out-btn'),
  // timesheet
  weekLabel:      $('week-label'),
  prevWeekBtn:    $('prev-week-btn'),
  nextWeekBtn:    $('next-week-btn'),
  timesheetContent:$('timesheet-content'),
  // modals
  nameModal:      $('name-modal'),
  nameInput:      $('name-input'),
  nameError:      $('name-error'),
  notesModal:     $('notes-modal'),
  notesInput:     $('notes-input'),
  entryModal:     $('entry-modal'),
  entryModalTitle:$('entry-modal-title'),
  entryDate:      $('entry-date'),
  entryClockIn:   $('entry-clock-in'),
  entryClockOut:  $('entry-clock-out'),
  entryNotes:     $('entry-notes'),
  entryError:     $('entry-error'),
  entryDelete:    $('entry-delete'),
  entryConfirmBtn:$('entry-confirm-btn'),
};

// ── Clock ─────────────────────────────────────────────────────────

function startClock() {
  function tick() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2,'0');
    const mm = now.getMinutes().toString().padStart(2,'0');
    const ss = now.getSeconds().toString().padStart(2,'0');
    el.currentTime.textContent = `${hh}:${mm}:${ss}`;
    el.currentDate.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }
  tick();
  state.clockInterval = setInterval(tick, 1000);
}

// ── Home Screen ───────────────────────────────────────────────────

function updateHomeUI() {
  const entry = state.openEntry;
  if (entry) {
    el.statusBadge.textContent = '● CLOCKED IN';
    el.statusBadge.className = 'status-badge clocked-in';
    el.clockInSince.textContent = `Since ${fmt24(entry.clockIn)}`;
    el.clockInSince.style.display = 'block';
    el.clockInBtn.disabled = true;
    el.clockOutBtn.disabled = false;
  } else {
    el.statusBadge.textContent = '○ CLOCKED OUT';
    el.statusBadge.className = 'status-badge clocked-out';
    el.clockInSince.style.display = 'none';
    el.clockInBtn.disabled = false;
    el.clockOutBtn.disabled = true;
  }
}

function showLastPunch(msg) {
  el.lastPunch.textContent = msg;
  el.lastPunch.style.display = 'block';
}

async function loadHomeStatus() {
  state.openEntry = await getOpenEntry();
  updateHomeUI();
}

async function handleClockIn() {
  if (state.openEntry) return;
  const weekStart = getWeekStart(new Date()).getTime();
  await clockIn(weekStart);
  state.openEntry = await getOpenEntry();
  showLastPunch(`Clocked in at ${fmt24(Date.now())}`);
  updateHomeUI();
}

function handleClockOutPress() {
  if (!state.openEntry) return;
  el.notesInput.value = '';
  openModal(el.notesModal);
}

async function handleClockOutConfirm() {
  if (!state.openEntry) return;
  const notes = el.notesInput.value.trim();
  closeModal(el.notesModal);
  await clockOut(state.openEntry.id, notes);
  showLastPunch(`Clocked out at ${fmt24(Date.now())}`);
  state.openEntry = null;
  updateHomeUI();
}

// ── Timesheet ─────────────────────────────────────────────────────

async function loadTimesheet() {
  const ws = state.weekList[state.weekIndex];
  const we = getWeekEnd(ws);
  el.weekLabel.textContent = `${fmtShort(ws)} – ${fmtShort(we)}`;
  el.prevWeekBtn.disabled = state.weekIndex >= state.weekList.length - 1;
  el.nextWeekBtn.disabled = state.weekIndex <= 0;

  const wsTs = ws.getTime();
  const weTs = we.getTime();
  const entries = await getEntriesForWeek(wsTs, weTs);
  state.currentEntries = entries;

  renderTimesheet(ws, entries);
}

function renderTimesheet(ws, entries) {
  const content = el.timesheetContent;
  content.innerHTML = '';

  let weekTotalMs = 0;
  let hasAnyEntry = false;

  for (let i = 0; i < 7; i++) {
    const day = new Date(ws);
    day.setDate(ws.getDate() + i);
    const key = getDayKey(day);
    const dayEntries = entries.filter(e => getDayKey(new Date(e.clockIn)) === key);

    const dayTotalMs = dayEntries.reduce((sum, e) => {
      return sum + (e.clockOut && e.clockIn ? e.clockOut - e.clockIn : 0);
    }, 0);
    weekTotalMs += dayTotalMs;
    if (dayEntries.length) hasAnyEntry = true;

    const card = document.createElement('div');
    card.className = 'day-card';

    // Header
    const header = document.createElement('div');
    header.className = 'day-header';

    const title = document.createElement('span');
    title.className = 'day-title';
    title.textContent = fmtDate(day);

    const right = document.createElement('div');
    right.className = 'day-header-right';

    if (dayTotalMs > 0) {
      const tot = document.createElement('span');
      tot.className = 'day-total';
      tot.textContent = `${decHours(dayTotalMs)} hrs`;
      right.appendChild(tot);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => openAddModal(day));
    right.appendChild(addBtn);

    header.appendChild(title);
    header.appendChild(right);
    card.appendChild(header);

    // Entries
    for (const entry of dayEntries) {
      const row = buildEntryRow(entry, day);
      card.appendChild(row);
    }

    content.appendChild(card);
  }

  // Weekly total
  const totCard = document.createElement('div');
  totCard.className = 'weekly-total-card';
  totCard.innerHTML = `
    <span class="weekly-total-label">Weekly Total</span>
    <span class="weekly-total-hours">${decHours(weekTotalMs)} hrs</span>
  `;
  content.appendChild(totCard);

  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'export-btn';
  exportBtn.textContent = '⬆ Export / Share CSV';
  exportBtn.addEventListener('click', handleExport);
  content.appendChild(exportBtn);
}

function buildEntryRow(entry, day) {
  const row = document.createElement('div');
  row.className = 'entry-row';

  const times = document.createElement('div');
  times.className = 'entry-times';

  const timeText = entry.clockOut
    ? `${fmt24(entry.clockIn)} → ${fmt24(entry.clockOut)}`
    : `${fmt24(entry.clockIn)} → In Progress`;

  const timeLine = document.createElement('div');
  timeLine.className = 'entry-time-line';
  timeLine.textContent = timeText;
  times.appendChild(timeLine);

  if (entry.notes) {
    const notes = document.createElement('div');
    notes.className = 'entry-notes';
    notes.textContent = entry.notes;
    times.appendChild(notes);
  }

  const dur = document.createElement('div');
  dur.className = 'entry-duration';
  if (entry.clockOut) {
    dur.textContent = `${decHours(entry.clockOut - entry.clockIn)}h`;
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'entry-edit-btn';
  editBtn.textContent = '✎';
  editBtn.addEventListener('click', () => openEditModal(entry, day));

  row.appendChild(times);
  row.appendChild(dur);
  row.appendChild(editBtn);
  return row;
}

// ── Entry Modal ──────────────────────────────────────────────────

let entryModalContext = null; // { mode: 'add'|'edit', entry?, day }

function openAddModal(day) {
  entryModalContext = { mode: 'add', day };
  el.entryModalTitle.textContent = 'Add Time Entry';
  el.entryDate.textContent = fmtDate(day);
  el.entryClockIn.value = '';
  el.entryClockOut.value = '';
  el.entryNotes.value = '';
  el.entryError.style.display = 'none';
  el.entryDelete.style.display = 'none';
  el.entryConfirmBtn.textContent = 'Add Entry';
  el.entryConfirmBtn.className = 'modal-btn modal-btn-green';
  openModal(el.entryModal);
  setTimeout(() => el.entryClockIn.focus(), 100);
}

function openEditModal(entry, day) {
  entryModalContext = { mode: 'edit', entry, day };
  el.entryModalTitle.textContent = 'Edit Time Entry';
  el.entryDate.textContent = fmtDate(day);
  el.entryClockIn.value = fmt24(entry.clockIn);
  el.entryClockOut.value = entry.clockOut ? fmt24(entry.clockOut) : '';
  el.entryNotes.value = entry.notes || '';
  el.entryError.style.display = 'none';
  el.entryDelete.style.display = 'block';
  el.entryConfirmBtn.textContent = 'Save Changes';
  el.entryConfirmBtn.className = 'modal-btn modal-btn-green';
  openModal(el.entryModal);
}

async function handleEntryConfirm() {
  const ctx = entryModalContext;
  if (!ctx) return;

  const ciVal = el.entryClockIn.value;
  const coVal = el.entryClockOut.value;
  const notes = el.entryNotes.value.trim();

  if (!ciVal) {
    showEntryError('Clock in time is required.');
    return;
  }
  if (!coVal) {
    showEntryError('Clock out time is required.');
    return;
  }

  const day = ctx.day;
  const ciMs = parseTimeToMs(ciVal, day);
  let coMs = parseTimeToMs(coVal, day);

  // handle midnight crossover
  if (coMs <= ciMs) coMs += 86400000;

  if (coMs <= ciMs) {
    showEntryError('Clock out must be after clock in.');
    return;
  }

  const weekStart = getWeekStart(day).getTime();

  if (ctx.mode === 'add') {
    await addEntry(ciMs, coMs, notes, weekStart);
  } else {
    await updateEntry(ctx.entry.id, ciMs, coMs, notes);
  }

  closeModal(el.entryModal);
  await loadTimesheet();
}

async function handleEntryDelete() {
  const ctx = entryModalContext;
  if (!ctx || ctx.mode !== 'edit') return;

  if (!confirm('Delete this time entry?')) return;
  await deleteEntry(ctx.entry.id);
  closeModal(el.entryModal);
  await loadTimesheet();
}

function showEntryError(msg) {
  el.entryError.textContent = msg;
  el.entryError.style.display = 'block';
}

// ── Export ───────────────────────────────────────────────────────

async function handleExport() {
  const ws = state.weekList[state.weekIndex];
  const we = getWeekEnd(ws);
  const entries = await getEntriesForWeek(ws.getTime(), we.getTime());
  try {
    await exportAndShare(state.userName, ws.getTime(), entries);
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
}

// ── Modal Helpers ─────────────────────────────────────────────────

function openModal(overlay) {
  overlay.classList.add('open');
}

function closeModal(overlay) {
  overlay.classList.remove('open');
}

// ── Name Modal ────────────────────────────────────────────────────

async function handleSaveName() {
  const name = el.nameInput.value.trim();
  if (!name) {
    el.nameError.textContent = 'Please enter your full name.';
    el.nameError.style.display = 'block';
    return;
  }
  await setSetting('user_name', name);
  state.userName = name;
  closeModal(el.nameModal);
}

// ── Tabs ──────────────────────────────────────────────────────────

function switchTab(tab) {
  if (tab === 'home') {
    el.homeScreen.classList.add('active');
    el.timesheetScreen.classList.remove('active');
    el.homeTab.classList.add('active');
    el.timesheetTab.classList.remove('active');
    loadHomeStatus();
  } else {
    el.timesheetScreen.classList.add('active');
    el.homeScreen.classList.remove('active');
    el.timesheetTab.classList.add('active');
    el.homeTab.classList.remove('active');
    loadTimesheet();
  }
}

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  // Load user name
  const name = await getSetting('user_name');
  if (!name) {
    el.loading.style.display = 'none';
    el.app.style.display = 'flex';
    openModal(el.nameModal);
  } else {
    state.userName = name;
    el.loading.style.display = 'none';
    el.app.style.display = 'flex';
  }

  // Start clock
  startClock();

  // Load home status
  await loadHomeStatus();

  // Show home tab by default
  el.homeScreen.classList.add('active');
  el.homeTab.classList.add('active');
}

// ── Event Listeners ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Tab buttons
  el.homeTab.addEventListener('click', () => switchTab('home'));
  el.timesheetTab.addEventListener('click', () => switchTab('timesheet'));

  // Clock in/out
  el.clockInBtn.addEventListener('click', handleClockIn);
  el.clockOutBtn.addEventListener('click', handleClockOutPress);

  // Notes modal (clock out)
  $('notes-cancel').addEventListener('click', () => closeModal(el.notesModal));
  $('notes-confirm').addEventListener('click', handleClockOutConfirm);

  // Week nav
  el.prevWeekBtn.addEventListener('click', () => {
    if (state.weekIndex < state.weekList.length - 1) {
      state.weekIndex++;
      loadTimesheet();
    }
  });
  el.nextWeekBtn.addEventListener('click', () => {
    if (state.weekIndex > 0) {
      state.weekIndex--;
      loadTimesheet();
    }
  });

  // Entry modal
  $('entry-cancel').addEventListener('click', () => closeModal(el.entryModal));
  el.entryConfirmBtn.addEventListener('click', handleEntryConfirm);
  el.entryDelete.querySelector('.delete-link').addEventListener('click', handleEntryDelete);

  // Name modal
  $('name-save').addEventListener('click', handleSaveName);
  el.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSaveName(); });

  // Kick off
  init();
});
