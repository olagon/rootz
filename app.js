// Rootz
// Fully static. Loads puzzles.json. Saves progress locally.

const PUZZLES_URL = "./puzzles.json";
const MAX_MISTAKES = 4;

const els = {
  subtitle: document.getElementById("subtitle"),
  puzzleMeta: document.getElementById("puzzleMeta"),
  mistakesLeft: document.getElementById("mistakesLeft"),
  solvedGroups: document.getElementById("solvedGroups"),
  board: document.getElementById("board"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  submitBtn: document.getElementById("submitBtn"),
  howBtn: document.getElementById("howBtn"),
  statsBtn: document.getElementById("statsBtn"),
  toast: document.getElementById("toast"),
  howModal: document.getElementById("howModal"),
  statsModal: document.getElementById("statsModal"),
  endModal: document.getElementById("endModal"),
  archiveModal: document.getElementById("archiveModal"),
  archiveBtn: document.getElementById("archiveBtn"),
  practiceBtn: document.getElementById("practiceBtn"),
  archiveSelect: document.getElementById("archiveSelect"),
  openArchiveSelectedBtn: document.getElementById("openArchiveSelectedBtn"),
  endSummary: document.getElementById("endSummary"),
  resultGrid: document.getElementById("resultGrid"),
  copyBtn: document.getElementById("copyBtn"),
  resetStatsBtn: document.getElementById("resetStatsBtn"),
  statPlayed: document.getElementById("statPlayed"),
  statWinPct: document.getElementById("statWinPct"),
  statStreak: document.getElementById("statStreak"),
  statBest: document.getElementById("statBest"),
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysSince(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const t0 = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  const t1 = new Date().setHours(0, 0, 0, 0);
  return Math.floor((t1 - t0) / 86400000);
}

function getQuery() {
  const p = new URLSearchParams(location.search);
  return {
    id: p.get("id") ? Number(p.get("id")) : null,
    mode: p.get("mode") || null,
  };
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function openModal(modal) {
  if (!modal.open) modal.showModal();
}

function closeModal(modal) {
  if (modal.open) modal.close();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;
  const id = btn.getAttribute("data-close");
  const modal = document.getElementById(id);
  if (modal) closeModal(modal);
});

function loadStats() {
  const raw = localStorage.getItem("rootz:stats");
  if (!raw) return { played: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, lastWinDate: null };
  try { return JSON.parse(raw); } catch { return { played: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, lastWinDate: null }; }
}

function saveStats(s) {
  localStorage.setItem("rootz:stats", JSON.stringify(s));
}

function updateStatsUI() {
  const s = loadStats();
  els.statPlayed.textContent = String(s.played);
  const winPct = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  els.statWinPct.textContent = `${winPct}%`;
  els.statStreak.textContent = String(s.streak);
  els.statBest.textContent = String(s.bestStreak);
}

function stableKey(mode, dateISO, puzzleId) {
  return `rootz:${mode}:${dateISO}:p${puzzleId}`;
}

function loadState(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function saveState(key, state) {
  localStorage.setItem(key, JSON.stringify(state));
}

function normalizeSet(a) {
  return [...a].sort().join("||");
}

function computeGroupColor(index) {
  return ["var(--g1)","var(--g2)","var(--g3)","var(--g4)"][index % 4];
}

function colorToEmoji(colorVar) {
  if (colorVar === "var(--g1)") return "🟨";
  if (colorVar === "var(--g2)") return "🟦";
  if (colorVar === "var(--g3)") return "🟪";
  return "🟩";
}

function setSubmitEnabled(state) {
  els.submitBtn.disabled = state.selected.length !== 4 || state.isOver;
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
  const modeLbl = state.mode === "practice" ? "Practice" : (state.mode === "archive" ? "Archive" : "Daily");
  els.subtitle.textContent = `${modeLbl} puzzle`;
  els.puzzleMeta.textContent = `Puzzle ${state.puzzleId} of ${state.totalPuzzles} · ${state.dateISO}`;
}

function render(state) {
  renderMeta(state);
  renderSolved(state);
  renderBoard(state);
  setSubmitEnabled(state);
  saveState(state.storageKey, state.persist());
}

function buildResultGrid(state) {
  els.resultGrid.innerHTML = "";

  // 16 squares, 4x4. Each solved group fills one row.
  const rows = [];
  for (const solved of state.solved) {
    const emoji = colorToEmoji(solved.colorVar);
    rows.push([emoji, emoji, emoji, emoji]);
  }
  while (rows.length < 4) rows.push(["⬛","⬛","⬛","⬛"]);

  for (const row of rows) {
    for (const _ of row) {
      const div = document.createElement("div");
      div.className = "square";
      els.resultGrid.appendChild(div);
    }
  }

  // Paint squares row by row.
  const squares = [...els.resultGrid.querySelectorAll(".square")];
  let idx = 0;
  for (const solved of state.solved) {
    const color = solved.color;
    for (let k = 0; k < 4; k++) {
      squares[idx].style.background = color;
      idx++;
    }
  }
}

function finishGame(state, didWin) {
  state.isOver = true;

  const stats = loadStats();
  stats.played += 1;
  if (didWin) stats.wins += 1;
  else stats.losses += 1;

  if (state.mode === "daily") {
    if (didWin) {
      const t = state.dateISO;
      if (stats.lastWinDate) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yyyy = y.getFullYear();
        const mm = String(y.getMonth() + 1).padStart(2, "0");
        const dd = String(y.getDate()).padStart(2, "0");
        const yesterdayISO = `${yyyy}-${mm}-${dd}`;
        if (stats.lastWinDate === yesterdayISO) stats.streak += 1;
        else stats.streak = 1;
      } else {
        stats.streak = 1;
      }
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      stats.lastWinDate = t;
    } else {
      stats.streak = 0;
    }
  }

  saveStats(stats);
  updateStatsUI();

  const solvedCount = state.solved.length;
  const attempts = state.attempts.length;
  els.endSummary.textContent = didWin ? `Solved ${solvedCount}/4 in ${attempts} tries` : `Ended at ${solvedCount}/4`;

  buildResultGrid(state);
  openModal(els.endModal);
  render(state);
}

function computeShareText(state, didWin) {
  const header = `Rootz #${state.puzzleId} ${state.dateISO}`;
  const status = didWin ? `Win in ${state.attempts.length}` : `No win`;
  const lines = state.solved.map((s) => {
    const e = colorToEmoji(s.colorVar);
    return `${e}${e}${e}${e}`;
  });
  while (lines.length < 4) lines.push("⬛⬛⬛⬛");
  return [header, status, ...lines].join("\n");
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try { await navigator.serviceWorker.register("./sw.js"); } catch {}
}

function buildArchive(puzzles) {
  els.archiveSelect.innerHTML = "";
  for (const p of puzzles) {
    const opt = document.createElement("option");
    opt.value = String(p.id);
    opt.textContent = `Puzzle ${p.id}`;
    els.archiveSelect.appendChild(opt);
  }
}

function pickDailyPuzzle(puzzles) {
  const start = "2026-01-01";
  const offset = Math.max(0, daysSince(start));
  const index = offset % puzzles.length;
  return puzzles[index];
}

function initGame(puzzles, mode, forcedId = null) {
  const dateISO = todayISO();
  const totalPuzzles = puzzles.length;

  let puzzle = null;
  if (forcedId) puzzle = puzzles.find(p => p.id === forcedId) || puzzles[0];
  else if (mode === "practice") puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  else puzzle = pickDailyPuzzle(puzzles);

  const storageKey = stableKey(mode, mode === "daily" ? dateISO : (mode === "practice" ? "practice" : "archive"), puzzle.id);

  const groupSets = puzzle.groups.map(g => ({
    label: g.label,
    words: g.words.slice(),
    setKey: normalizeSet(g.words),
  }));

  const persisted = loadState(storageKey);

  const state = {
    mode,
    dateISO,
    puzzleId: puzzle.id,
    totalPuzzles,
    groups: groupSets,
    board: puzzle.boardWords.slice(),
    selected: [],
    solved: [],
    mistakesLeft: MAX_MISTAKES,
    isOver: false,
    attempts: [],
    storageKey,
    persist() {
      return {
        mode: this.mode,
        dateISO: this.dateISO,
        puzzleId: this.puzzleId,
        board: this.board,
        solved: this.solved,
        mistakesLeft: this.mistakesLeft,
        isOver: this.isOver,
        attempts: this.attempts,
      };
    },
  };

  if (persisted && persisted.puzzleId === puzzle.id) {
    state.board = persisted.board || state.board;
    state.solved = persisted.solved || [];
    state.mistakesLeft = typeof persisted.mistakesLeft === "number" ? persisted.mistakesLeft : MAX_MISTAKES;
    state.isOver = !!persisted.isOver;
    state.attempts = persisted.attempts || [];
  }

  // Normalize solved groups with colors
  state.solved = state.solved.map((s, idx) => ({
    label: s.label,
    words: s.words,
    color: s.color || computeGroupColor(idx),
    colorVar: s.colorVar || ["var(--g1)","var(--g2)","var(--g3)","var(--g4)"][idx % 4],
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
      const colorVar = ["var(--g1)","var(--g2)","var(--g3)","var(--g4)"][idx % 4];
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

  els.submitBtn.onclick = submit;
  els.clearBtn.onclick = clearSelection;
  els.shuffleBtn.onclick = shuffleBoard;

  els.howBtn.onclick = () => openModal(els.howModal);
  els.statsBtn.onclick = () => { updateStatsUI(); openModal(els.statsModal); };

  els.archiveBtn.onclick = () => openModal(els.archiveModal);
  els.practiceBtn.onclick = () => {
    const u = new URL(location.href);
    u.searchParams.set("mode", "practice");
    u.searchParams.delete("id");
    location.href = u.toString();
  };

  els.openArchiveSelectedBtn.onclick = () => {
    const id = Number(els.archiveSelect.value);
    const u = new URL(location.href);
    u.searchParams.set("id", String(id));
    u.searchParams.set("mode", "archive");
    location.href = u.toString();
  };

  els.copyBtn.onclick = async () => {
    const didWin = state.solved.length === 4 && state.mistakesLeft > 0;
    const text = computeShareText(state, didWin);
    try { await navigator.clipboard.writeText(text); showToast("Copied"); }
    catch { showToast("Copy failed"); }
  };

  els.resetStatsBtn.onclick = () => {
    localStorage.removeItem("rootz:stats");
    updateStatsUI();
    showToast("Stats reset");
  };

  render(state);

  if (state.isOver) buildResultGrid(state);

  return state;
}

async function loadPuzzles() {
  const res = await fetch(PUZZLES_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("puzzles.json not found");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("bad puzzles.json");
  return data;
}

function wireGlobalModalClose() {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    [els.howModal, els.statsModal, els.endModal, els.archiveModal].forEach(m => closeModal(m));
  });
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

  buildArchive(puzzles);

  const q = getQuery();
  const mode = q.mode === "practice" ? "practice" : (q.mode === "archive" ? "archive" : "daily");
  const forcedId = q.id && q.id >= 1 ? q.id : null;

  updateStatsUI();
  initGame(puzzles, mode, forcedId);
})();
