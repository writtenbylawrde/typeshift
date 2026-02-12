// Minimal TypeShift Valentine game (Jed-coded letters) 💙
// - 5 levels, hidden words: WILL / YOU / BE / MY / VALENTINE (valentine last level)
// - Score in the middle, no progress panel
// - "Jar" is hidden: shows only locked tokens until all levels complete
// - Final: drag to reorder phrase; YES/NO buttons; NO shrinks until gone; YES pops up message

const $ = (id) => document.getElementById(id);
const gridEl = $("grid");
const currentWordEl = $("currentWord");
const statusEl = $("status");
const scoreEl = $("score");
const jarHiddenEl = $("jarHidden");

const gameView = $("gameView");
const finalView = $("finalView");
const reorderList = $("reorderList");
const finalButtons = $("finalButtons");
const finalStatus = $("finalStatus");
const popup = $("popup");
const closePopupBtn = $("closePopupBtn");
const yesBtn = $("yesBtn");
const noBtn = $("noBtn");

const submitBtn = $("submitBtn");
const scoreBtn = $("scoreBtn");
const hintBtn = $("hintBtn");
const resetBtn = $("resetBtn");

// Tiny scoring list (optional, just to make “score” feel real)
const DICT = new Set([
  "WILL","YOU","BE","MY","VALENTINE",
  "JED","LEMUEL","LAPITAN","LOVE","YES","NO","ME","WE","US"
]);

const norm = (s) => (s || "").toUpperCase().replace(/[^A-Z]/g, "");
const mod3 = (n) => ((n % 3) + 3) % 3;

// Each level: columns of 3 letters [top, mid, bot] (must include hidden letter in each col)
const LEVELS = [
  { hidden: "YOU", hintMax: 2, cols: [
    ["J","E","Y"],
    ["L","O","A"],
    ["U","M","D"],
  ]},
  { hidden: "MY", hintMax: 1, cols: [
    ["M","L","A"],
    ["Y","E","U"],
  ]},
  { hidden: "WILL", hintMax: 2, cols: [
    ["W","J","E"],
    ["A","I","O"],
    ["L","E","M"],
    ["L","U","D"],
  ]},
  { hidden: "BE", hintMax: 1, cols: [
    ["B","J","A"],
    ["E","D","L"],
  ]},
  { hidden: "VALENTINE", hintMax: 3, cols: [
    ["V","J","L"], // V
    ["E","A","D"], // A
    ["L","M","U"], // L
    ["T","J","E"], // E
    ["N","A","L"], // N
    ["E","T","M"], // T
    ["I","U","A"], // I
    ["D","N","E"], // N
    ["L","J","E"], // E
  ]},
];

// State
let levelIndex = 0;
let rotations = [];        // per column: 0..2
let hintedCols = new Set();
let usedHints = 0;
let score = 0;

// Hidden jar contents are kept, but not shown until end
let unlocked = []; // array of hidden words in the order solved

// prevent scoring spam
let scoredThisLevel = new Set();

// ===== rotation helpers =====
function letterAtDisplayPos(col, rot, displayPos){
  return col[mod3(displayPos - rot)];
}
function selectedLetter(col, rot){
  return letterAtDisplayPos(col, rot, 1); // middle row
}
function rotForDesiredOriginalIndex(p){
  // want selected(mid) = col[p]
  // (1 - rot) mod 3 = p => rot = 1 - p
  return mod3(1 - p);
}
function computeSolutionRows(level){
  const target = norm(level.hidden);
  return level.cols.map((col, i) => {
    const want = target[i];
    const idx = col.indexOf(want);
    if (idx === -1) throw new Error(`Missing ${want} in col ${i+1}`);
    return idx;
  });
}

// ===== UI =====
function setStatus(msg){
  statusEl.textContent = msg;
}
function setScore(){
  scoreEl.textContent = String(score);
}
function updateCurrentWord(){
  const level = LEVELS[levelIndex];
  const w = level.cols.map((c, i) => selectedLetter(c, rotations[i])).join("");
  currentWordEl.textContent = w;
  return w;
}

function snapColumnToMiddle(colIndex, clickedDisplayPos){
  // Determine which ORIGINAL index (0/1/2) is currently sitting at the clicked display position,
  // then set rotation so that ORIGINAL index becomes the MIDDLE (displayPos 1).

  const rot = rotations[colIndex];
  const origIndex = mod3(clickedDisplayPos - rot);   // which original letter you clicked
  rotations[colIndex] = mod3(1 - origIndex);         // set rotation so it lands in the middle

  renderGrid();
}

function renderGrid(){
  const level = LEVELS[levelIndex];
  gridEl.innerHTML = "";

  level.cols.forEach((col, i) => {
    const rot = rotations[i];

    const colEl = document.createElement("div");
    colEl.className = "col" + (hintedCols.has(i) ? " hinted" : "");

    // Cells
    const top = document.createElement("div");
    top.className = "cell";
    top.textContent = letterAtDisplayPos(col, rot, 0);

    const mid = document.createElement("div");
    mid.className = "cell mid";
    mid.textContent = letterAtDisplayPos(col, rot, 1);

    const bot = document.createElement("div");
    bot.className = "cell";
    bot.textContent = letterAtDisplayPos(col, rot, 2);

    // NEW: snap behavior — click a letter to snap it into the middle instantly
    top.addEventListener("click", (e) => { e.stopPropagation(); snapColumnToMiddle(i, 0); });
    mid.addEventListener("click", (e) => { e.stopPropagation(); snapColumnToMiddle(i, 1); });
    bot.addEventListener("click", (e) => { e.stopPropagation(); snapColumnToMiddle(i, 2); });

    colEl.appendChild(top);
    colEl.appendChild(mid);
    colEl.appendChild(bot);

    gridEl.appendChild(colEl);
  });

  updateCurrentWord();
}

function renderHiddenJar(){
  // show only locked tokens: 5 circles/labels, not the words
  jarHiddenEl.innerHTML = "";
  const total = LEVELS.length;

  for (let i = 0; i < total; i++){
    const t = document.createElement("div");
    t.className = "jarToken";
    t.textContent = i < unlocked.length ? "UNLOCKED" : "LOCKED";
    jarHiddenEl.appendChild(t);
  }
}

// ===== Game actions =====
function initLevel(){
  const level = LEVELS[levelIndex];
  rotations = level.cols.map(() => 0);
  hintedCols.clear();
  usedHints = 0;
  scoredThisLevel.clear();

  renderGrid();
  renderHiddenJar();
  setScore();
  setStatus("Click a column to rotate letters.");
}

function resetLevel(){
  initLevel();
  setStatus("Reset.");
}

function giveHint(){
  const level = LEVELS[levelIndex];
  if (usedHints >= level.hintMax){
    setStatus("No more hints for this level.");
    return;
  }

  const sol = computeSolutionRows(level);
  const candidates = [];
  for (let i = 0; i < level.cols.length; i++){
    if (!hintedCols.has(i)) candidates.push(i);
  }
  if (!candidates.length){
    setStatus("All columns already hinted.");
    return;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  rotations[pick] = rotForDesiredOriginalIndex(sol[pick]);
  hintedCols.add(pick);
  usedHints++;

  renderGrid();
  setStatus(`Hint used: column ${pick + 1}.`);
}

function scoreWord(){
  const w = norm(updateCurrentWord());
  const hidden = norm(LEVELS[levelIndex].hidden);

  if (w.length < 2){
    setStatus("Make a word first.");
    return;
  }
  if (w === hidden){
    setStatus("That’s the hidden word — press Submit.");
    return;
  }
  if (scoredThisLevel.has(w)){
    setStatus("Already scored that one this level.");
    return;
  }

  const pts = DICT.has(w) ? w.length : 1;
  score += pts;
  scoredThisLevel.add(w);
  setScore();
  setStatus(`+${pts} point${pts === 1 ? "" : "s"}.`);
}

function submitHidden(){
  const guess = norm(updateCurrentWord());
  const hidden = norm(LEVELS[levelIndex].hidden);

  if (guess !== hidden){
    setStatus("Not yet 👀");
    return;
  }

  unlocked.push(hidden);
  renderHiddenJar();

  if (levelIndex < LEVELS.length - 1){
    levelIndex++;
    initLevel();
    setStatus("Unlocked. Next level.");
  } else {
    // finished all
    startFinal();
  }
}

// ===== FINAL (reorder phrase) =====
let dragFrom = null;
let noScale = 1;

function startFinal(){
  gameView.classList.add("hidden");
  finalView.classList.remove("hidden");

  // show chips (actual words) ONLY now
  renderReorderList();
  updateFinalStatus();

  noScale = 1;
  noBtn.style.transform = "scale(1)";
  noBtn.style.opacity = "1";
}

function renderReorderList(){
  reorderList.innerHTML = "";
  unlocked.forEach((w, idx) => {
    const li = document.createElement("li");
    li.className = "reorderItem";
    li.draggable = true;
    li.dataset.index = String(idx);

    const left = document.createElement("div");
    left.className = "reorderWord";
    left.textContent = w;

    const right = document.createElement("div");
    right.className = "reorderHint";
    right.textContent = "drag";

    li.appendChild(left);
    li.appendChild(right);

    li.addEventListener("dragstart", (e) => {
      dragFrom = Number(li.dataset.index);
      e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const to = Number(li.dataset.index);
      if (dragFrom === null || dragFrom === to) return;

      const moved = unlocked.splice(dragFrom, 1)[0];
      unlocked.splice(to, 0, moved);
      dragFrom = null;

      renderReorderList();
      updateFinalStatus();
    });

    reorderList.appendChild(li);
  });
}

function updateFinalStatus(){
  const sentence = unlocked.join(" ").toLowerCase();
  const target = "will you be my valentine";

  if (sentence === target){
    finalStatus.textContent = "Perfect. Now choose 😭💙";
    finalButtons.classList.remove("hidden");   // show YES/NO
  } else {
    finalStatus.textContent = "Keep dragging…";
    finalButtons.classList.add("hidden");      // hide YES/NO
  }
}

function handleNo(){
  // NO gets progressively smaller until gone
  noScale *= 0.78;
  noBtn.style.transform = `scale(${noScale})`;
  noBtn.style.opacity = String(Math.max(0, noScale));

  if (noScale < 0.18){
    noBtn.style.display = "none";
  }

  // YES grows as NO shrinks 😭💙
  const yesScale = Math.min(1 + (1 - noScale) * 1.4, 2.2); // cap so it doesn't get absurd
  yesBtn.style.transform = `scale(${yesScale})`;
}

function handleYes(){
  const sentence = unlocked.join(" ").toLowerCase();
  if (sentence !== "will you be my valentine"){
    finalStatus.textContent = "Arrange the sentence correctly first 👀";
    return;
  }
  popup.classList.remove("hidden");
}

function closePopup(){
  popup.classList.add("hidden");
}

// ===== wire up =====
submitBtn.addEventListener("click", submitHidden);
scoreBtn.addEventListener("click", scoreWord);
hintBtn.addEventListener("click", giveHint);
resetBtn.addEventListener("click", resetLevel);

noBtn.addEventListener("click", handleNo);
yesBtn.addEventListener("click", handleYes);
closePopupBtn.addEventListener("click", closePopup);
popup.addEventListener("click", (e) => {
  if (e.target === popup) closePopup();
});

// start
initLevel();