// Rootz
// Per-puzzle progression model. Goal: solve all 80 puzzles.
// Solved puzzles stay solved. Failing a puzzle locks it for 24 hours.

const PUZZLES_URL = "./puzzles.json";
const MAX_MISTAKES = 4;
const HINT_HIGHLIGHT_MS = 4000;
const LOCK_MS = 24 * 60 * 60 * 1000; // 24 hours

const els = {
  subtitle: document.getElementById("subtitle"),
  puzzleMeta: document.getElementById("puzzleMeta"),
  mistakesLeft: document.getElementById("mistakesLeft"),
  solvedGroups: document.getElementById("solvedGroups"),
  board: document.getElementById("board"),
  boardWrap: document.getElementById("boardWrap"),
  controls: document.getElementById("controls"),
  hintBtn: document.getElementById("hintBtn"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  submitBtn: document.getElementById("submitBtn"),
  howBtn: document.getElementById("howBtn"),
  statsBtn: document.getElementById("statsBtn"),
  toast: document.getElementById("toast"),
  howModal: document.getElementById("howModal"),
  statsModal: document.getElementById("statsModal"),
  endModal: document.getElementById("endModal"),
  endNextBtn: document.getElementById("endNextBtn"),
  pickerModal: document.getElementById("pickerModal"),
  puzzleGrid: document.getElementById("puzzleGrid"),
  archiveBtn: document.getElementById("archiveBtn"),
  endSummary: document.getElementById("endSummary"),
  endDetail: document.getElementById("endDetail"),
  resetStatsBtn: document.getElementById("resetStatsBtn"),
  statSolved: document.getElementById("statSolved"),
  statRemaining: document.getElementById("statRemaining"),
  statAttempts: document.getElementById("statAttempts"),
  statWinPct: document.getElementById("statWinPct"),
  reminderToggle: document.getElementById("reminderToggle"),
  reminderStatus: document.getElementById("reminderStatus"),
  progressLine: document.getElementById("progressLine"),
  lockedCard: document.getElementById("lockedCard"),
  lockedTitle: document.getElementById("lockedTitle"),
  lockedBody: document.getElementById("lockedBody"),
  lockedPickBtn: document.getElementById("lockedPickBtn"),
};

// ---------- Utilities ----------
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getQuery() {
  const p = new URLSearchParams(location.search);
  return { id: p.get("id") ? Number(p.get("id")) : null };
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function openModal(modal) { if (modal && !modal.open) modal.showModal(); }
function closeModal(modal) { if (modal && modal.open) modal.close(); }

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;
  const id = btn.getAttribute("data-close");
  const modal = document.getElementById(id);
  if (modal) closeModal(modal);
});

function normalizeSet(a) { return [...a].sort().join("||"); }

function computeGroupColor(index) {
  return ["var(--g1)","var(--g2)","var(--g3)","var(--g4)"][index % 4];
}
function colorVarFor(index) {
  return ["var(--g1)","var(--g2)","var(--g3)","var(--g4)"][index % 4];
}
function formatUnlockTime(lockUntil) {
  const d = new Date(lockUntil);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const opts = { hour: "numeric", minute: "2-digit" };
  if (sameDay) return `today at ${d.toLocaleTimeString([], opts)}`;
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow at ${d.toLocaleTimeString([], opts)}`;
  const dateOpts = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  return d.toLocaleString([], dateOpts);
}

// ---------- Stats / progress ----------
const STATS_KEY = "rootz:stats";

function emptyStats() {
  return {
    totalAttempts: 0,
    puzzles: {}, // { "1": { solved:false, lockUntil:0, attempts:0, lastAttempt:0 } }
  };
}

function loadStats() {
  const raw = localStorage.getItem(STATS_KEY);
  if (!raw) return emptyStats();
  try {
    const parsed = JSON.parse(raw);
    // Migrate older shapes (with played/wins/streak/etc) by dropping them
    // and starting fresh on the new schema, while preserving any existing
    // puzzles map if one was already saved.
    if (!parsed.puzzles || typeof parsed.puzzles !== "object") parsed.puzzles = {};
    if (typeof parsed.totalAttempts !== "number") parsed.totalAttempts = 0;
    return { totalAttempts: parsed.totalAttempts, puzzles: parsed.puzzles };
  } catch { return emptyStats(); }
}

function saveStats(s) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

function getPuzzleProgress(stats, id) {
  return stats.puzzles[String(id)] || { solved: false, lockUntil: 0, attempts: 0, lastAttempt: 0 };
}
function setPuzzleProgress(stats, id, prog) {
  stats.puzzles[String(id)] = prog;
}

function isLocked(stats, id) {
  const p = getPuzzleProgress(stats, id);
  return !p.solved && p.lockUntil > Date.now();
}

function countByState(stats, total) {
  let solved = 0, attempted = 0, locked = 0;
  for (let id = 1; id <= total; id++) {
    const p = getPuzzleProgress(stats, id);
    if (p.solved) solved++;
    else if (p.lockUntil > Date.now()) locked++;
    else if (p.attempts > 0) attempted++;
  }
  const unsolved = total - solved;
  return { solved, attempted, locked, unsolved, total };
}

function nextPlayable(stats, total) {
  for (let id = 1; id <= total; id++) {
    const p = getPuzzleProgress(stats, id);
    if (p.solved) continue;
    if (p.lockUntil > Date.now()) continue;
    return id;
  }
  return null;
}

function updateStatsUI(total) {
  const s = loadStats();
  const c = countByState(s, total);
  if (els.statSolved)    els.statSolved.textContent    = `${c.solved}/${total}`;
  if (els.statRemaining) els.statRemaining.textContent = String(c.unsolved);
  if (els.statAttempts)  els.statAttempts.textContent  = String(s.totalAttempts);
  if (els.statWinPct) {
    const pct = s.totalAttempts ? Math.round((c.solved / s.totalAttempts) * 100) : 0;
    els.statWinPct.textContent = `${pct}%`;
  }
  if (els.progressLine) {
    if (c.solved === total) {
      els.progressLine.textContent = `All ${total} solved! Mahalo nui.`;
    } else {
      els.progressLine.textContent = `${c.solved} solved · ${c.unsolved} to go`;
    }
  }
}

// ---------- Render ----------
function setSubmitEnabled(state) {
  els.submitBtn.disabled = state.selected.length !== 4 || state.isOver;
}

function unsolvedGroups(state) {
  const solvedKeys = new Set(state.solved.map(s => normalizeSet(s.words)));
  return state.groups.filter(g => !solvedKeys.has(g.setKey));
}

function hintsAvailable(state) {
  return Math.max(0, state.maxHints - state.hintsUsed);
}

function setHintEnabled(state) {
  if (!els.hintBtn) return;
  const noUnsolved = unsolvedGroups(state).length === 0;
  const used = hintsAvailable(state) <= 0;
  const off = state.isOver || noUnsolved || used;
  els.hintBtn.disabled = off;
  els.hintBtn.classList.toggle("spent", used && !state.isOver);
  els.hintBtn.title = used
    ? "Hint already used for this puzzle"
    : "Use your one hint for this puzzle";
}

function renderSolved(state) {
  els.solvedGroups.innerHTML = "";
  for (const solved of state.solved) {
    const card = document.createElement("div");
    card.className = "solvedCard";

    const label = document.createElement("div");
    label.className = "solvedLabel";
    label.textContent = solved.label;
    label.style.color = solved.color;

    const words = document.createElement("div");
    words.className = "solvedWords";
    for (const w of solved.words) {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = w;
      words.appendChild(chip);
    }

    card.appendChild(label);
    card.appendChild(words);
    els.solvedGroups.appendChild(card);
  }
}

function renderBoard(state) {
  els.board.innerHTML = "";
  state.board.forEach((w, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile";
    btn.textContent = w;
    btn.setAttribute("role", "gridcell");
    btn.dataset.word = w;
    btn.dataset.index = String(idx);

    if (state.selected.includes(w)) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      if (state.isOver) return;
      const has = state.selected.includes(w);
      if (has) {
        state.selected = state.selected.filter(x => x !== w);
      } else {
        if (state.selected.length >= 4) {
          showToast("Only 4 selections");
          return;
        }
        state.selected = [...state.selected, w];
      }
      render(state);
    });

    els.board.appendChild(btn);
  });
}

function renderMeta(state) {
  els.mistakesLeft.textContent = String(state.mistakesLeft);
  els.subtitle.textContent = `Puzzle ${state.puzzleId} of ${state.totalPuzzles}`;
  els.puzzleMeta.textContent = `Puzzle ${state.puzzleId} of ${state.totalPuzzles}`;
}

function render(state) {
  renderMeta(state);
  renderSolved(state);
  renderBoard(state);
  setSubmitEnabled(state);
  setHintEnabled(state);
  saveState(state.storageKey, state.persist());
  updateStatsUI(state.totalPuzzles);
}

// ---------- State persistence (current puzzle progress) ----------
function stableKey(puzzleId) {
  return `rootz:puzzle:${puzzleId}`;
}

function loadState(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveState(key, state) {
  localStorage.setItem(key, JSON.stringify(state));
}

// ---------- Game lifecycle ----------
function finishGame(state, didWin) {
  state.isOver = true;

  const stats = loadStats();
  const id = state.puzzleId;
  const prog = { ...getPuzzleProgress(stats, id) };
  prog.attempts += 1;
  prog.lastAttempt = Date.now();
  if (didWin) {
    prog.solved = true;
    prog.lockUntil = 0;
  } else {
    prog.lockUntil = Date.now() + LOCK_MS;
  }
  setPuzzleProgress(stats, id, prog);
  stats.totalAttempts += 1;
  saveStats(stats);
  updateStatsUI(state.totalPuzzles);

  const solvedCount = state.solved.length;
  const attempts = state.attempts.length;
  els.endSummary.textContent = didWin
    ? `Solved 4 of 4 in ${attempts} tries`
    : `Ended at ${solvedCount} of 4`;

  if (els.endDetail) {
    if (didWin) {
      const c = countByState(loadStats(), state.totalPuzzles);
      els.endDetail.textContent = c.unsolved === 0
        ? "You have solved every puzzle. Mahalo nui."
        : `${c.solved} of ${state.totalPuzzles} solved · ${c.unsolved} to go`;
    } else {
      els.endDetail.textContent = "Locked for 24 hours. Pick another puzzle and come back to this one tomorrow.";
    }
  }

  // Configure "Next puzzle" button based on what's available
  if (els.endNextBtn) {
    const next = nextPlayable(loadStats(), state.totalPuzzles);
    if (next && next !== state.puzzleId) {
      els.endNextBtn.hidden = false;
      els.endNextBtn.textContent = `Next puzzle (${next})`;
      els.endNextBtn.onclick = () => goToPuzzle(next);
    } else if (countByState(loadStats(), state.totalPuzzles).unsolved === 0) {
      els.endNextBtn.hidden = false;
      els.endNextBtn.textContent = "All solved";
      els.endNextBtn.disabled = true;
    } else {
      els.endNextBtn.hidden = true;
    }
  }

  openModal(els.endModal);
  render(state);
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try { await navigator.serviceWorker.register("./sw.js"); } catch {}
}

// ---------- Locked card ----------
function showLockedCard(puzzleId, lockUntil, total) {
  els.boardWrap.hidden = true;
  els.controls.hidden = true;
  els.solvedGroups.hidden = true;
  els.lockedCard.hidden = false;
  els.lockedTitle.textContent = `Puzzle ${puzzleId} is locked`;
  els.lockedBody.textContent = `You can try this one again ${formatUnlockTime(lockUntil)}.`;
  els.subtitle.textContent = `Puzzle ${puzzleId} of ${total} · locked`;
  els.puzzleMeta.textContent = `Locked`;
  els.lockedPickBtn.onclick = () => openModal(els.pickerModal);
}

function hideLockedCard() {
  els.boardWrap.hidden = false;
  els.controls.hidden = false;
  els.solvedGroups.hidden = false;
  els.lockedCard.hidden = true;
}

// ---------- Puzzle picker grid ----------
let allPuzzles = [];

function buildPickerGrid() {
  if (!els.puzzleGrid) return;
  const stats = loadStats();
  const now = Date.now();
  els.puzzleGrid.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const p of allPuzzles) {
    const prog = getPuzzleProgress(stats, p.id);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "pcell";
    cell.dataset.id = String(p.id);
    cell.setAttribute("role", "gridcell");

    let state, marker = "";
    if (prog.solved) { state = "solved"; marker = "✓"; }
    else if (prog.lockUntil > now) { state = "locked"; marker = "🔒"; }
    else if (prog.attempts > 0) { state = "attempted"; }
    else { state = "unsolved"; }
    cell.classList.add(state);

    cell.innerHTML = `<span class="pn">${p.id}</span>` + (marker ? `<span class="pm" aria-hidden="true">${marker}</span>` : "");

    let title = `Puzzle ${p.id}`;
    if (state === "solved") title += " — Solved";
    else if (state === "locked") title += ` — Locked until ${formatUnlockTime(prog.lockUntil)}`;
    else if (state === "attempted") title += ` — Attempted (${prog.attempts} tries)`;
    else title += " — New";
    cell.title = title;
    cell.setAttribute("aria-label", title);

    cell.addEventListener("click", () => {
      if (state === "locked") {
        showToast(`Locked until ${formatUnlockTime(prog.lockUntil)}`);
        return;
      }
      closeModal(els.pickerModal);
      goToPuzzle(p.id);
    });

    frag.appendChild(cell);
  }
  els.puzzleGrid.appendChild(frag);
}

// ---------- Navigation ----------
function goToPuzzle(id) {
  const u = new URL(location.href);
  u.searchParams.set("id", String(id));
  location.href = u.toString();
}

// ---------- Game init ----------
function initGame(puzzles, requestedId = null) {
  const stats = loadStats();
  const total = puzzles.length;

  let id = requestedId;
  if (!id) {
    const next = nextPlayable(stats, total);
    id = next || 1;
  }
  if (id < 1 || id > total) id = 1;

  const puzzle = puzzles.find(p => p.id === id) || puzzles[0];

  // Locked check (only blocks if not already solved)
  if (isLocked(stats, puzzle.id)) {
    const prog = getPuzzleProgress(stats, puzzle.id);
    showLockedCard(puzzle.id, prog.lockUntil, total);
    updateStatsUI(total);
    return null;
  }

  hideLockedCard();

  const storageKey = stableKey(puzzle.id);

  const groupSets = puzzle.groups.map(g => ({
    label: g.label,
    words: g.words.slice(),
    setKey: normalizeSet(g.words),
  }));

  const persisted = loadState(storageKey);

  const state = {
    puzzleId: puzzle.id,
    totalPuzzles: total,
    groups: groupSets,
    board: puzzle.boardWords.slice(),
    selected: [],
    solved: [],
    mistakesLeft: MAX_MISTAKES,
    isOver: false,
    attempts: [],
    hintsUsed: 0,
    maxHints: 1,
    storageKey,
    persist() {
      return {
        puzzleId: this.puzzleId,
        board: this.board,
        solved: this.solved,
        mistakesLeft: this.mistakesLeft,
        isOver: this.isOver,
        attempts: this.attempts,
        hintsUsed: this.hintsUsed,
      };
    },
  };

  // Determine if we should rehydrate. If the puzzle is already solved
  // (in stats) we treat it as a fresh replay and ignore any prior in-progress
  // state.
  const puzzleSolved = getPuzzleProgress(stats, puzzle.id).solved;
  if (persisted && persisted.puzzleId === puzzle.id && !puzzleSolved && !persisted.isOver) {
    state.board = persisted.board || state.board;
    state.solved = persisted.solved || [];
    state.mistakesLeft = typeof persisted.mistakesLeft === "number" ? persisted.mistakesLeft : MAX_MISTAKES;
    state.isOver = !!persisted.isOver;
    state.attempts = persisted.attempts || [];
    state.hintsUsed = typeof persisted.hintsUsed === "number" ? persisted.hintsUsed : 0;
  } else if (persisted && puzzleSolved) {
    // Replay: clear the persisted in-progress state
    localStorage.removeItem(storageKey);
  }

  // Normalize solved groups with colors
  state.solved = state.solved.map((s, idx) => ({
    label: s.label,
    words: s.words,
    color: s.color || computeGroupColor(idx),
    colorVar: s.colorVar || colorVarFor(idx),
  }));

  // Remove solved words from board if needed
  const solvedWords = new Set(state.solved.flatMap(s => s.words));
  state.board = state.board.filter(w => !solvedWords.has(w));

  function clearSelection() {
    state.selected = [];
    render(state);
  }

  function shuffleBoard() {
    for (let k = state.board.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [state.board[k], state.board[j]] = [state.board[j], state.board[k]];
    }
    render(state);
  }

  function submit() {
    if (state.isOver) return;
    if (state.selected.length !== 4) return;

    const key = normalizeSet(state.selected);

    if (state.solved.some(s => normalizeSet(s.words) === key)) {
      showToast("Already solved");
      return;
    }

    const match = state.groups.find(g => g.setKey === key);
    state.attempts.push(state.selected.slice());

    if (match) {
      const idx = state.solved.length;
      const colorVar = colorVarFor(idx);
      const color = computeGroupColor(idx);

      state.solved.push({ label: match.label, words: state.selected.slice(), color, colorVar });
      const selectedSet = new Set(state.selected);
      state.board = state.board.filter(w => !selectedSet.has(w));
      state.selected = [];

      showToast("Correct");

      if (state.solved.length === 4) {
        finishGame(state, true);
        return;
      }
      render(state);
      return;
    }

    state.mistakesLeft -= 1;
    state.selected = [];
    showToast("Not a group");

    if (state.mistakesLeft <= 0) {
      finishGame(state, false);
      return;
    }
    render(state);
  }

  function useHint() {
    if (state.isOver) return;
    if (hintsAvailable(state) <= 0) {
      showToast("Hint already used");
      return;
    }
    const candidates = unsolvedGroups(state);
    if (candidates.length === 0) return;

    const group = candidates[Math.floor(Math.random() * candidates.length)];
    const wordSet = new Set(group.words);
    const tiles = [...els.board.querySelectorAll(".tile")]
      .filter(t => wordSet.has(t.dataset.word));

    if (tiles.length === 0) {
      showToast("No tiles to hint");
      return;
    }

    state.hintsUsed += 1;
    saveState(state.storageKey, state.persist());
    setHintEnabled(state);

    const HINT_BG = "#c4602b";
    const HINT_BG_DARK = "#e89060";
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const bg = isDark ? HINT_BG_DARK : HINT_BG;

    const saved = tiles.map(t => ({
      el: t,
      bg: t.style.background, color: t.style.color, border: t.style.borderColor,
      shadow: t.style.boxShadow, transform: t.style.transform,
      transition: t.style.transition, zIndex: t.style.zIndex, position: t.style.position,
    }));

    tiles.forEach(t => {
      t.classList.add("hinted");
      t.style.transition = "transform 180ms ease, box-shadow 180ms ease, background 180ms ease";
      t.style.background = bg;
      t.style.color = "#ffffff";
      t.style.borderColor = bg;
      t.style.boxShadow = "0 6px 20px rgba(196, 96, 43, 0.45), 0 0 0 3px rgba(196, 96, 43, 0.55)";
      t.style.transform = "scale(1.05)";
      t.style.position = "relative";
      t.style.zIndex = "2";
    });

    if (els.board.scrollIntoView) {
      els.board.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    setTimeout(() => {
      saved.forEach(s => {
        s.el.classList.remove("hinted");
        s.el.style.background = s.bg;
        s.el.style.color = s.color;
        s.el.style.borderColor = s.border;
        s.el.style.boxShadow = s.shadow;
        s.el.style.transform = s.transform;
        s.el.style.transition = s.transition;
        s.el.style.zIndex = s.zIndex;
        s.el.style.position = s.position;
      });
    }, HINT_HIGHLIGHT_MS);

    showToast("Hint: these 4 belong together");
  }

  els.submitBtn.onclick = submit;
  els.clearBtn.onclick = clearSelection;
  els.shuffleBtn.onclick = shuffleBoard;
  if (els.hintBtn) els.hintBtn.onclick = useHint;

  els.howBtn.onclick = () => openModal(els.howModal);
  els.statsBtn.onclick = () => {
    updateStatsUI(state.totalPuzzles);
    refreshReminderUI();
    openModal(els.statsModal);
  };

  els.archiveBtn.onclick = () => {
    buildPickerGrid();
    openModal(els.pickerModal);
  };

  els.resetStatsBtn.onclick = () => {
    if (!confirm("Reset all progress? This will erase every solved puzzle and unlock all locks.")) return;
    localStorage.removeItem(STATS_KEY);
    // Clear in-progress per-puzzle state too
    for (let i = 1; i <= state.totalPuzzles; i++) {
      localStorage.removeItem(stableKey(i));
    }
    updateStatsUI(state.totalPuzzles);
    showToast("Progress reset");
    setTimeout(() => location.href = "./index.html", 600);
  };

  render(state);

  return state;
}

// ---------- Reminders ----------
const REMINDER_KEY = "rootz:reminders";
const LAST_NUDGE_KEY = "rootz:lastNudge";

function reminderOptedIn() { return localStorage.getItem(REMINDER_KEY) === "on"; }
function setReminderOptedIn(on) {
  if (on) localStorage.setItem(REMINDER_KEY, "on");
  else localStorage.removeItem(REMINDER_KEY);
}
function notificationsSupported() { return typeof window !== "undefined" && "Notification" in window; }

function refreshReminderUI() {
  if (!els.reminderToggle || !els.reminderStatus) return;
  if (!notificationsSupported()) {
    els.reminderToggle.checked = false;
    els.reminderToggle.disabled = true;
    els.reminderStatus.textContent = "This browser does not support notifications.";
    els.reminderStatus.className = "reminderStatus warn";
    return;
  }
  const perm = Notification.permission;
  const opted = reminderOptedIn();
  els.reminderToggle.checked = opted && perm === "granted";

  if (perm === "denied") {
    els.reminderStatus.textContent = "Notifications are blocked in your browser. Enable them in your site settings to turn this on.";
    els.reminderStatus.className = "reminderStatus warn";
  } else if (opted && perm === "granted") {
    els.reminderStatus.textContent = "On. We will nudge you the next time you open Rootz with puzzles still to solve.";
    els.reminderStatus.className = "reminderStatus ok";
  } else {
    els.reminderStatus.textContent = "Off. Tap the toggle to turn it on.";
    els.reminderStatus.className = "reminderStatus";
  }
}

async function onReminderToggle(e) {
  const wantOn = !!e.target.checked;
  if (!wantOn) {
    setReminderOptedIn(false);
    refreshReminderUI();
    showToast("Reminders off");
    return;
  }
  if (!notificationsSupported()) {
    e.target.checked = false;
    refreshReminderUI();
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setReminderOptedIn(true);
      showToast("Reminders on");
    } else {
      e.target.checked = false;
      setReminderOptedIn(false);
      showToast("Permission not granted");
    }
  } catch {
    e.target.checked = false;
    setReminderOptedIn(false);
  }
  refreshReminderUI();
}

async function maybeNudgeOnLoad(total) {
  if (!reminderOptedIn()) return;
  if (!notificationsSupported() || Notification.permission !== "granted") return;

  const stats = loadStats();
  const c = countByState(stats, total);
  if (c.unsolved === 0) return;  // nothing left to nudge about

  // Don't nudge twice in the same calendar day.
  const today = todayISO();
  const lastNudge = localStorage.getItem(LAST_NUDGE_KEY);
  if (lastNudge === today) return;

  const playable = c.unsolved - c.locked;
  const body = playable > 0
    ? `You have ${c.unsolved} more puzzle${c.unsolved === 1 ? "" : "s"} to solve.`
    : `You have ${c.unsolved} more to solve. They are all locked right now — try again later.`;

  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
    const opts = { body, icon: "./icon-192.png", badge: "./icon-192.png", tag: "rootz-daily", renotify: false };
    if (reg && reg.showNotification) {
      reg.showNotification("Rootz", opts);
    } else if (window.Notification) {
      new Notification("Rootz", opts);
    }
    localStorage.setItem(LAST_NUDGE_KEY, today);
  } catch {}
}

// ---------- Bootstrap ----------
function wireGlobalModalClose() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    [els.howModal, els.statsModal, els.endModal, els.pickerModal].forEach(m => closeModal(m));
  });
}

async function loadPuzzles() {
  const res = await fetch(PUZZLES_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("puzzles.json not found");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("bad puzzles.json");
  return data;
}

(async function main() {
  wireGlobalModalClose();
  registerSW();

  let puzzles = null;
  try {
    puzzles = await loadPuzzles();
  } catch {
    els.puzzleMeta.textContent = "Could not load puzzles.json";
    showToast("Run a local server to play");
    return;
  }

  allPuzzles = puzzles;
  if (els.reminderToggle) els.reminderToggle.addEventListener("change", onReminderToggle);

  const q = getQuery();
  initGame(puzzles, q.id);
  updateStatsUI(puzzles.length);

  maybeNudgeOnLoad(puzzles.length);
})();
