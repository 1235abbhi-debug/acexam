const SUBJECTS = [
  { code: "9701", name: "Chemistry" },
  { code: "9702", name: "Physics" },
  { code: "9709", name: "Mathematics" },
  { code: "9700", name: "Biology" }
];

const appState = {
  subject: "9701",
  level: "AS",
  ao: "ALL",
  allQuestions: [],
  openNotes: {},
  activeQ: null,
  revealed: false,
  modalMode: "clean",
  quizIndex: 0,
  quizScore: 0,
  quizAnswered: false,
  selectedOption: null
};

function esc(val) {
  return String(val == null ? "" : val)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """);
}

function showBanner(msg, isOk) {
  const el = document.getElementById("status-banner");
  el.classList.remove("hidden");
  el.className = isOk
    ? "rounded-xl px-4 py-2.5 text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center justify-between gap-2"
    : "rounded-xl px-4 py-2.5 text-xs font-medium border border-rose-200 bg-rose-50 text-rose-900 flex items-center justify-between gap-2";
  el.innerHTML = `<span>${esc(msg)}</span><button onclick="this.parentElement.classList.add('hidden')" class="font-bold opacity-60 hover:opacity-100">✕</button>`;
}

async function initVault() {
  try {
    const manifestRes = await fetch(`./papers/manifest.json?t=${Date.now()}`);
    if (!manifestRes.ok) {
      throw new Error(`Could not load papers/manifest.json (HTTP ${manifestRes.status})`);
    }
    const fileList = await manifestRes.json();
    if (!Array.isArray(fileList)) {
      throw new Error("papers/manifest.json must be a JSON array of filenames.");
    }

    const loaded = [];
    for (const filename of fileList) {
      const fileRes = await fetch(`./papers/${filename}?t=${Date.now()}`);
      if (!fileRes.ok) {
        showBanner(`Warning: Could not load papers/${filename} (HTTP ${fileRes.status})`, false);
        continue;
      }
      const paperData = await fileRes.json();
      const meta = paperData.meta || {};
      const subjectCode = String(meta.subjectCode || "9701");
      const level = String(meta.level || "AS").toUpperCase().includes("A2") ? "A2" : "AS";
      const paperCode = meta.paperCode || filename.replace(".json", "");
      const series = meta.series || "";

      (paperData.questions || []).forEach((q, idx) => {
        loaded.push({
          id: `${paperCode}-${q.qNum || idx}-${idx}`,
          subjectCode,
          level,
          paperCode,
          series,
          qNum: q.qNum || `${idx + 1}`,
          chapter: q.chapter || "General Syllabus Topics",
          ao: q.ao === "AO1" ? "AO1" : "AO2",
          marks: Number(q.marks) || 1,
          type: q.type || (q.options ? "mcq" : "structured"),
          question: q.question || "",
          options: q.options || null,
          answer: q.answer || null,
          steps: Array.isArray(q.steps) ? q.steps : [],
          markScheme: Array.isArray(q.markScheme) ? q.markScheme : [],
          examinerReport: q.examinerReport || "Review command words, units, and significant figures carefully."
        });
      });
    }

    appState.allQuestions = loaded;
    render();
    showBanner(`✓ Loaded ${loaded.length} verified Cambridge past-paper question${loaded.length === 1 ? "" : "s"} from ${fileList.length} paper file${fileList.length === 1 ? "" : "s"}.`, true);
  } catch (err) {
    render();
    showBanner(`Setup Notice: ${err.message}`, false);
  }
}

function setSubject(code) {
  appState.subject = code;
  appState.quizIndex = 0;
  appState.quizScore = 0;
  appState.selectedOption = null;
  render();
}

function setLevel(lvl) {
  appState.level = lvl;
  appState.quizIndex = 0;
  appState.quizScore = 0;
  appState.selectedOption = null;
  document.getElementById("btn-AS").className = lvl === "AS"
    ? "px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-slate-900 text-white"
    : "px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900";
  document.getElementById("btn-A2").className = lvl === "A2"
    ? "px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-slate-900 text-white"
    : "px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900";
  render();
}

function setAO(ao) {
  appState.ao = ao;
  document.getElementById("ao-ALL").className = ao === "ALL"
    ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700";
  document.getElementById("ao-AO1").className = ao === "AO1"
    ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200";
  document.getElementById("ao-AO2").className = ao === "AO2"
    ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200";
  render();
}

function aoBadge(ao) {
  return ao === "AO1"
    ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">AO1 • Recall</span>`
    : `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">AO2 • Application</span>`;
}

function render() {
  // Subject Tabs
  document.getElementById("subject-tabs").innerHTML = SUBJECTS.map(s => {
    const active = s.code === appState.subject;
    const count = appState.allQuestions.filter(q => q.subjectCode === s.code && q.level === appState.level).length;
    const cls = active
      ? "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white flex items-center gap-2"
      : "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 flex items-center gap-2";
    return `<button onclick="setSubject('${s.code}')" class="${cls}"><span>${esc(s.name)}</span><span class="font-mono text-xs ${active ? "text-emerald-400" : "text-slate-400"}">${s.code} (${count})</span></button>`;
  }).join("");

  const subjectQuestions = appState.allQuestions.filter(
    q => q.subjectCode === appState.subject && q.level === appState.level
  );

  // Marks Split
  let ao1M = 0, ao2M = 0;
  subjectQuestions.forEach(q => {
    if (q.ao === "AO1") ao1M += q.marks;
    else ao2M += q.marks;
  });
  const totalM = ao1M + ao2M || 1;
  document.getElementById("marks-pill").innerHTML =
    `Marks: <span class="text-indigo-700">AO1 ${ao1M}m (${Math.round((ao1M / totalM) * 100)}%)</span> • <span class="text-amber-700">AO2 ${ao2M}m (${100 - Math.round((ao1M / totalM) * 100)}%)</span>`;

  // Spotlight Question + Principal Examiner Report
  const spotBox = document.getElementById("spotlight-box");
  if (subjectQuestions.length > 0) {
    spotBox.classList.remove("hidden");
    const fq = subjectQuestions[0];
    const spotAo = document.getElementById("spot-ao");
    spotAo.className = fq.ao === "AO1"
      ? "px-2.5 py-1 rounded-full text-xs font-bold border bg-indigo-50 text-indigo-800 border-indigo-200"
      : "px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200";
    spotAo.textContent = fq.ao === "AO1" ? "AO1 • Knowledge & Recall" : "AO2 • Application & Analysis";
    document.getElementById("spot-ref").textContent = `${fq.paperCode} Q${fq.qNum}`;
    document.getElementById("spot-title").textContent = `${fq.chapter} (${fq.series || "Past Paper"})`;
    document.getElementById("spot-question").textContent = fq.question;
    document.getElementById("spot-marks").textContent = `Worth ${fq.marks} ${fq.marks === 1 ? "Mark" : "Marks"}`;
    document.getElementById("spot-examiner").textContent = fq.examinerReport;
    const subjObj = SUBJECTS.find(s => s.code === appState.subject);
    document.getElementById("spot-subject").textContent = `${appState.subject} ${subjObj ? subjObj.name : ""} • ${appState.level}`;
    document.getElementById("spot-btn").onclick = () => openModal(fq.id);
  } else {
    spotBox.classList.add("hidden");
  }

  // Filter & Group by Chapter
  const term = document.getElementById("search-input").value.trim().toLowerCase();
  const filtered = subjectQuestions.filter(q => {
    if (appState.ao !== "ALL" && q.ao !== appState.ao) return false;
    if (!term) return true;
    return q.chapter.toLowerCase().includes(term) ||
      q.paperCode.toLowerCase().includes(term) ||
      q.qNum.toLowerCase().includes(term) ||
      q.question.toLowerCase().includes(term) ||
      q.examinerReport.toLowerCase().includes(term);
  });

  const chapterMap = {};
  filtered.forEach(q => {
    if (!chapterMap[q.chapter]) chapterMap[q.chapter] = [];
    chapterMap[q.chapter].push(q);
  });
  const chapterNames = Object.keys(chapterMap);

  document.getElementById("results-label").textContent =
    `${filtered.length} question${filtered.length === 1 ? "" : "s"} across ${chapterNames.length} syllabus chapter${chapterNames.length === 1 ? "" : "s"}`;

  const container = document.getElementById("chapters-container");
  if (!chapterNames.length) {
    container.innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2"><p class="text-sm font-bold text-slate-800">No questions uploaded for this subject/level yet</p><p class="text-xs text-slate-500">Add a JSON file inside <code class="font-mono bg-slate-100 px-1.5 py-0.5 rounded">papers/</code> and list its filename in <code class="font-mono bg-slate-100 px-1.5 py-0.5 rounded">papers/manifest.json</code> to publish it automatically.</p></div>`;
  } else {
    container.innerHTML = chapterNames.map(chName => {
      const qs = chapterMap[chName];
      const isOpen = !!appState.openNotes[chName];
      const notesDrawer = isOpen ? `
        <div class="bg-indigo-50/60 border-b border-indigo-100 p-4 sm:p-5 space-y-3">
          <div class="font-mono text-xs font-bold uppercase text-indigo-900">Chapter Revision Notes & Examiner Traps</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${qs.map(q => `
              <div class="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-mono text-xs font-bold text-slate-900">${esc(q.paperCode)} Q${esc(q.qNum)}</span>
                  ${aoBadge(q.ao)}
                </div>
                <ol class="text-xs text-slate-700 space-y-1 leading-relaxed">
                  ${q.steps.map(s => `<li>• ${esc(s)}</li>`).join("")}
                </ol>
                <div class="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <strong>Examiner Report:</strong> ${esc(q.examinerReport)}
                </div>
              </div>
            `).join("")}
          </div>
        </div>` : "";

      const rows = qs.map(q => `
        <div onclick="openModal('${esc(q.id)}')" class="p-4 sm:p-5 hover:bg-slate-50 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1.5 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs font-bold">${esc(q.paperCode)} Q${esc(q.qNum)}</span>
              ${aoBadge(q.ao)}
              <span class="text-xs font-semibold text-slate-500">${esc(q.series)}</span>
            </div>
            <p class="text-xs sm:text-sm text-slate-800 font-medium line-clamp-2 whitespace-pre-line">${esc(q.question)}</p>
          </div>
          <div class="flex items-center gap-2.5 shrink-0">
            <span class="font-mono text-xs font-semibold text-slate-500">[${q.marks}m]</span>
            <span class="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Practice</span>
          </div>
        </div>
      `).join("");

      return `
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div class="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm sm:text-base font-bold">${esc(chName)}</h3>
              <span class="text-[11px] font-mono text-slate-400">${qs.length} Question${qs.length === 1 ? "" : "s"}</span>
            </div>
            <button onclick="toggleChapterNotes('${esc(chName)}')" class="px-3 py-1.5 rounded-xl text-xs font-bold ${isOpen ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-emerald-300 border border-slate-700"}">${isOpen ? "Hide Notes" : "Chapter Notes & Warnings"}</button>
          </div>
          ${notesDrawer}
          <div class="divide-y divide-slate-100">${rows}</div>
        </div>
      `;
    }).join("");
  }

  renderQuiz(subjectQuestions);
}

function toggleChapterNotes(chName) {
  appState.openNotes[chName] = !appState.openNotes[chName];
  render();
}

function openModal(qId) {
  const q = appState.allQuestions.find(item => item.id === qId);
  if (!q) return;
  appState.activeQ = q;
  appState.revealed = false;
  appState.modalMode = "clean";
  appState.selectedOption = null;
  renderModal();
  document.getElementById("study-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("study-modal").classList.add("hidden");
}

function setModalMode(mode) {
  appState.modalMode = mode;
  renderModal();
}

function toggleReveal() {
  appState.revealed = !appState.revealed;
  renderModal();
}

function selectModalOption(letter) {
  appState.selectedOption = letter;
  appState.revealed = true;
  renderModal();
}

function renderModal() {
  const q = appState.activeQ;
  if (!q) return;
  document.getElementById("modal-ref").textContent = `${q.paperCode} Q${q.qNum}`;
  document.getElementById("modal-topic").textContent = q.chapter;
  document.getElementById("modal-chapter").textContent = q.series;

  const mao = document.getElementById("modal-ao");
  mao.className = q.ao === "AO1"
    ? "text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/40"
    : "text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40";
  mao.textContent = q.ao === "AO1" ? "AO1 • Recall" : "AO2 • Application";

  document.getElementById("mode-clean").className = appState.modalMode === "clean"
    ? "px-3.5 py-2 rounded-t-xl text-xs font-bold border-b-2 border-slate-900 text-slate-900 bg-white"
    : "px-3.5 py-2 rounded-t-xl text-xs font-semibold border-b-2 border-transparent text-slate-500";
  document.getElementById("mode-paper").className = appState.modalMode === "paper"
    ? "px-3.5 py-2 rounded-t-xl text-xs font-bold border-b-2 border-slate-900 text-slate-900 bg-white"
    : "px-3.5 py-2 rounded-t-xl text-xs font-semibold border-b-2 border-transparent text-slate-500";

  const mcqOptionsHtml = q.options ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
      ${["A", "B", "C", "D"].filter(l => q.options[l]).map(l => {
        let cls = "text-left p-3 rounded-xl border text-xs sm:text-sm font-medium transition ";
        if (appState.selectedOption) {
          if (l === q.answer) cls += "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-bold";
          else if (l === appState.selectedOption) cls += "bg-rose-50 border-2 border-rose-500 text-rose-950 font-semibold";
          else cls += "bg-slate-50 border-slate-200 text-slate-600";
        } else {
          cls += "bg-white hover:bg-slate-50 border-slate-200 text-slate-800";
        }
        return `<button onclick="selectModalOption('${l}')" class="${cls}"><span class="font-mono font-bold mr-2">${l}.</span>${esc(q.options[l])}</button>`;
      }).join("")}
    </div>` : "";

  const solutionDrawer = appState.revealed ? `
    <div class="space-y-4">
      <div class="rounded-xl bg-indigo-50 border border-indigo-200 p-4">
        <div class="font-mono text-xs font-bold uppercase text-indigo-900 mb-2">How It's Done (Step-by-Step Working)</div>
        <ul class="space-y-1.5 text-sm text-indigo-950">${q.steps.map(s => `<li>→ ${esc(s)}</li>`).join("")}</ul>
      </div>
      <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
        <div class="font-mono text-xs font-bold uppercase text-emerald-800 mb-2">Official Mark Scheme</div>
        <ul class="space-y-1.5 text-sm text-emerald-950">${q.markScheme.map(m => `<li>✓ ${esc(m)}</li>`).join("")}</ul>
      </div>
      <div class="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <div class="font-mono text-xs font-bold uppercase text-amber-800 mb-1">Principal Examiner Report</div>
        <p class="text-sm text-amber-950 leading-relaxed">${esc(q.examinerReport)}</p>
      </div>
    </div>` : "";

  const body = document.getElementById("modal-body");
  if (appState.modalMode === "paper") {
    body.innerHTML = `
      <div class="cambridge-sheet p-6 sm:p-8 rounded-lg space-y-5">
        <div class="flex justify-between border-b border-slate-400 pb-2 text-xs font-sans font-bold">
          <span>CAMBRIDGE INTERNATIONAL AS & A LEVEL</span>
          <span class="font-mono">${esc(q.paperCode)} Q${esc(q.qNum)}</span>
        </div>
        <div class="text-base leading-relaxed whitespace-pre-line">${esc(q.question)}</div>
        ${mcqOptionsHtml}
        ${!q.options ? `<div class="space-y-2 pt-2"><div class="dotted-line"></div><div class="dotted-line"></div><div class="dotted-line"></div></div>` : ""}
        <div class="text-right font-bold text-sm">[Total: ${q.marks}]</div>
      </div>
      <div class="flex justify-center">
        <button onclick="toggleReveal()" class="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">${appState.revealed ? "Hide Mark Scheme & Examiner Report" : "Reveal Working, Mark Scheme & Examiner Report"}</button>
      </div>${solutionDrawer}`;
  } else {
    body.innerHTML = `
      <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5">
        <div class="flex items-center justify-between mb-2">${aoBadge(q.ao)}<span class="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-900 text-white">[${q.marks}m]</span></div>
        <p class="text-sm sm:text-base font-medium text-slate-900 leading-relaxed whitespace-pre-line">${esc(q.question)}</p>
        ${mcqOptionsHtml}
      </div>
      <div class="flex items-center justify-between gap-3 bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
        <span class="text-xs text-slate-700 font-medium">Attempt the question first, then reveal the mark scheme and Principal Examiner Report.</span>
        <button onclick="toggleReveal()" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0">${appState.revealed ? "Hide Solution" : "Reveal Solution & Examiner Report"}</button>
      </div>${solutionDrawer}`;
  }
}

function renderQuiz(subjectQuestions) {
  const mcqs = subjectQuestions.filter(q => q.options && q.answer);
  const box = document.getElementById("quiz-body");
  if (!mcqs.length) {
    document.getElementById("quiz-counter").textContent = "0 MCQs";
    box.innerHTML = `<p class="text-xs text-slate-500">Add a Paper 1 multiple-choice JSON file to activate the interactive self-test for this subject.</p>`;
    return;
  }

  const total = Math.min(5, mcqs.length);
  const current = mcqs[appState.quizIndex % total];
  appState.quizAnswered = false;
  document.getElementById("quiz-counter").textContent = `Q ${(appState.quizIndex % total) + 1}/${total} • Score: ${appState.quizScore}`;

  const letters = ["A", "B", "C", "D"];
  box.innerHTML = `
    <p class="text-sm sm:text-base font-bold text-slate-900 mb-4 whitespace-pre-line">${esc(current.question)}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      ${letters.filter(l => current.options[l]).map(l => `
        <button onclick="gradeQuiz('${l}', '${current.answer}')" id="quiz-btn-${l}" class="text-left p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs sm:text-sm font-medium">
          <span class="font-mono font-bold text-slate-500 mr-2">${l}.</span>${esc(current.options[l])}
        </button>
      `).join("")}
    </div>
    <div id="quiz-feedback" class="hidden mt-4 rounded-xl bg-slate-900 text-white p-4 text-xs sm:text-sm space-y-1"></div>
  `;
}

function gradeQuiz(picked, correct) {
  if (appState.quizAnswered) return;
  appState.quizAnswered = true;
  const subjectQuestions = appState.allQuestions.filter(q => q.subjectCode === appState.subject && q.level === appState.level);
  const mcqs = subjectQuestions.filter(q => q.options && q.answer);
  const total = Math.min(5, mcqs.length);
  const current = mcqs[appState.quizIndex % total];

  const isRight = picked === correct;
  if (isRight) appState.quizScore++;
  document.getElementById("quiz-counter").textContent = `Q ${(appState.quizIndex % total) + 1}/${total} • Score: ${appState.quizScore}`;

  ["A", "B", "C", "D"].forEach(l => {
    const btn = document.getElementById(`quiz-btn-${l}`);
    if (!btn) return;
    if (l === correct) btn.className = "text-left p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-600 text-xs sm:text-sm font-bold text-emerald-950";
    else if (l === picked && !isRight) btn.className = "text-left p-3.5 rounded-xl bg-rose-50 border-2 border-rose-500 text-xs sm:text-sm font-semibold text-rose-950";
  });

  const fb = document.getElementById("quiz-feedback");
  fb.classList.remove("hidden");
  fb.innerHTML = `
    <div><strong class="${isRight ? "text-emerald-400" : "text-amber-400"}">${isRight ? "✓ Correct!" : "✗ Incorrect (Correct: " + correct + ")"}</strong> ${esc(current.steps.join(" "))}</div>
    <div class="text-amber-300 text-xs pt-1"><strong>Principal Examiner Report:</strong> ${esc(current.examinerReport)}</div>
  `;
}

function nextQuiz() {
  const subjectQuestions = appState.allQuestions.filter(q => q.subjectCode === appState.subject && q.level === appState.level);
  const mcqs = subjectQuestions.filter(q => q.options && q.answer);
  if (!mcqs.length) return;
  const total = Math.min(5, mcqs.length);
  if ((appState.quizIndex + 1) % total === 0) appState.quizScore = 0;
  appState.quizIndex++;
  renderQuiz(subjectQuestions);
}

initVault();
