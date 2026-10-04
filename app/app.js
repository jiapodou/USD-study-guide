/* NCP-OUSD flashcard mini-app. Vanilla JS, no build step, runs from file://. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const DECK = window.DECK;
  const DOMAINS = DECK.meta.domains;
  const domName = id => (DOMAINS.find(d => d.id === id) || {}).name || "—";
  const domWeight = id => (DOMAINS.find(d => d.id === id) || {}).weight || 0;

  /* ---------- study-guide references (from refs.js) ---------- */
  const REFS = window.REFS || {};
  const CARD_REFS = window.CARD_REFS || {};
  const DOMAIN_REFS = window.DOMAIN_REFS || {};
  function refAnchor(key) {
    const r = REFS[key];
    if (!r) return "";
    return `<a class="reflink" href="${r[1]}" target="_blank" rel="noopener">${r[0]}</a>`;
  }
  function cardRefsHtml(card) {
    const keys = CARD_REFS[card.id] || [];
    if (!keys.length) return "";
    return `<div class="cardrefs"><h4>📚 Study-guide references</h4>${keys.map(refAnchor).join("")}</div>`;
  }

  /* ---------- persistence (Leitner box SRS) ---------- */
  const LS_KEY = "ncp_ousd_srs_v1";
  const DAY = 86400000;
  const BOX_INTERVAL = [0, 0, 1, 3, 7, 14]; // days until due, indexed by box (1..5)
  let state = load();
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
  function cardState(id) {
    if (!state[id]) state[id] = { box: 1, due: 0, seen: 0, correct: 0 };
    return state[id];
  }
  function isDue(id) { const c = cardState(id); return (c.due || 0) <= Date.now(); }
  function grade(id, good) {
    const c = cardState(id);
    c.seen++;
    if (good) { c.box = Math.min(5, c.box + 1); c.correct++; }
    else { c.box = 1; }
    c.due = Date.now() + BOX_INTERVAL[c.box] * DAY;
    save();
  }

  /* ---------- tiny markdown for card backs ---------- */
  function md(t) {
    return t
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.*)$/gm, "•&nbsp;$1")
      .replace(/\n/g, "<br>");
  }

  /* ---------- filters ---------- */
  let selectedDomains = new Set(DOMAINS.map(d => d.id));

  /* ---------- FLASHCARDS ---------- */
  let session = [];   // array of card ids for current session
  let pos = 0;
  let cramMode = false;

  function buildSession() {
    let pool = DECK.cards.filter(c => selectedDomains.has(c.d));
    if (!cramMode) {
      const due = pool.filter(c => isDue(c.id));
      pool = due.length ? due : pool; // if nothing due, fall back to whole (lets user always study)
    }
    // order: unseen & low-box first, then shuffle within
    pool = shuffle(pool.slice());
    pool.sort((a, b) => cardState(a.id).box - cardState(b.id).box);
    session = pool.map(c => c.id);
    pos = 0;
    renderCard();
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function renderCard() {
    const host = $("#fc-host");
    updateFcStats();
    if (!session.length) {
      host.innerHTML = `<div class="empty"><h3>🎉 Nothing due right now</h3>
        <p>All selected cards are scheduled for later. Toggle <b>Cram mode</b> to review everything anyway, or pick more domains.</p></div>`;
      $("#fc-progress").style.width = "0%";
      return;
    }
    const id = session[pos];
    const card = DECK.cards.find(c => c.id === id);
    const c = cardState(id);
    host.innerHTML = `
      <div class="card-wrap">
        <div class="flashcard" id="flashcard">
          <div class="face front">
            <div class="meta">
              <span class="badge">D${card.d} · ${domName(card.d)} · ${domWeight(card.d)}%</span>
              ${card.tags.map(t => `<span class="badge dim">${t}</span>`).join("")}
              <span class="badge dim">box ${c.box}/5</span>
            </div>
            <div class="q">${md(card.front)}</div>
            <div class="hint">Click / press <b>Space</b> to flip</div>
          </div>
          <div class="face back">
            <div class="meta"><span class="badge">Answer</span></div>
            <div class="a">${md(card.back)}${cardRefsHtml(card)}</div>
          </div>
        </div>
      </div>
      <div class="rate" id="rate" style="visibility:hidden">
        <button class="btn" id="again">↺ Again <span class="kbd"><span>1</span></span></button>
        <button class="btn primary" id="good">✓ Got it <span class="kbd"><span>2</span></span></button>
      </div>
      <div class="nav">
        <button class="btn ghost" id="prev">← Prev</button>
        <button class="btn ghost" id="next">Skip →</button>
        <span class="kbd"><span>←</span> <span>→</span> navigate · <span>Space</span> flip</span>
      </div>`;
    const fc = $("#flashcard");
    fc.addEventListener("click", flip);
    $("#prev").onclick = () => { pos = (pos - 1 + session.length) % session.length; renderCard(); };
    $("#next").onclick = () => { advance(); };
    $("#again").onclick = (e) => { e.stopPropagation(); grade(id, false); advance(); };
    $("#good").onclick = (e) => { e.stopPropagation(); grade(id, true); advance(); };
    $("#fc-progress").style.width = ((pos) / session.length * 100) + "%";
  }
  function flip() {
    const fc = $("#flashcard");
    if (!fc) return;
    fc.classList.toggle("flipped");
    $("#rate").style.visibility = fc.classList.contains("flipped") ? "visible" : "hidden";
  }
  function advance() {
    if (pos < session.length - 1) { pos++; renderCard(); }
    else { session = []; renderCard(); updateFcStats(); }
  }
  function updateFcStats() {
    const pool = DECK.cards.filter(c => selectedDomains.has(c.d));
    const due = pool.filter(c => isDue(c.id)).length;
    const mastered = pool.filter(c => cardState(c.id).box >= 4).length;
    const seen = pool.filter(c => cardState(c.id).seen > 0).length;
    $("#fc-stats").innerHTML =
      `<span>In view: <b>${pool.length}</b></span>
       <span>Due now: <b>${due}</b></span>
       <span>Seen: <b>${seen}</b></span>
       <span>Mastered (box 4-5): <b>${mastered}</b></span>
       ${session.length ? `<span>Session: <b>${pos + 1}/${session.length}</b></span>` : ""}`;
  }

  /* ---------- filter chips ---------- */
  function renderFilters() {
    const host = $("#filters");
    host.innerHTML = DOMAINS.map(d =>
      `<label class="chip on" data-d="${d.id}">
         <input type="checkbox" checked data-d="${d.id}"> D${d.id} ${d.name} <span class="w">${d.weight}%</span>
       </label>`).join("");
    $$("#filters input").forEach(inp => inp.addEventListener("change", e => {
      const id = +e.target.dataset.d;
      if (e.target.checked) selectedDomains.add(id); else selectedDomains.delete(id);
      e.target.closest(".chip").classList.toggle("on", e.target.checked);
      if (!selectedDomains.size) { selectedDomains.add(id); e.target.checked = true; e.target.closest(".chip").classList.add("on"); }
      buildSession();
      renderResources();
    }));
  }

  /* ---------- QUIZ ---------- */
  let quiz = { items: [], idx: 0, score: 0, answered: false };
  function startQuiz() {
    const pool = DECK.quiz.filter(q => selectedDomains.has(q.d));
    quiz = { items: shuffle(pool.slice()), idx: 0, score: 0, answered: false };
    renderQuiz();
  }
  function renderQuiz() {
    const host = $("#quiz-host");
    if (!quiz.items.length) { host.innerHTML = `<div class="empty"><h3>No quiz questions for the selected domains</h3></div>`; return; }
    if (quiz.idx >= quiz.items.length) {
      const pct = Math.round(quiz.score / quiz.items.length * 100);
      host.innerHTML = `<div class="quiz-score">
        <div class="big">${pct}%</div>
        <p>You scored <b>${quiz.score}/${quiz.items.length}</b>. ${pct >= 80 ? "Exam-ready range 💪" : pct >= 65 ? "Close — keep drilling the weak domains." : "Review the flashcards for missed domains, then retry."}</p>
        <button class="btn primary" id="requiz">Retake quiz</button></div>`;
      $("#requiz").onclick = startQuiz;
      return;
    }
    const q = quiz.items[quiz.idx];
    quiz.answered = false;
    host.innerHTML = `
      <div class="quiz-q">
        <span class="badge">Q${quiz.idx + 1}/${quiz.items.length} · D${q.d} ${domName(q.d)}</span>
        <div class="q">${md(q.q)}</div>
        <div class="choices">
          ${q.choices.map((ch, i) => `<button class="choice" data-i="${i}">${md(ch)}</button>`).join("")}
        </div>
        <div id="explain"></div>
        <div class="nav"><span class="spacer"></span><button class="btn primary" id="q-next" disabled>Next →</button></div>
      </div>`;
    $$("#quiz-host .choice").forEach(btn => btn.onclick = () => answerQuiz(+btn.dataset.i));
    $("#q-next").onclick = () => { quiz.idx++; renderQuiz(); };
    $("#quiz-progress").style.width = (quiz.idx / quiz.items.length * 100) + "%";
  }
  function answerQuiz(i) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = quiz.items[quiz.idx];
    const correct = q.answer;
    if (i === correct) quiz.score++;
    $$("#quiz-host .choice").forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === correct) { btn.classList.add("correct"); btn.querySelector(".mark")?.remove(); btn.insertAdjacentHTML("beforeend", '<span class="mark">✓</span>'); }
      if (idx === i && i !== correct) { btn.classList.add("wrong"); btn.insertAdjacentHTML("beforeend", '<span class="mark">✗</span>'); }
    });
    const srcKeys = (q.card && CARD_REFS[q.card]) ? CARD_REFS[q.card] : [];
    const srcHtml = srcKeys.length ? `<div class="qsrc">📚 Source: ${srcKeys.map(refAnchor).join("")}</div>` : "";
    $("#explain").innerHTML = `<div class="explain"><b>${i === correct ? "Correct." : "Not quite."}</b> ${md(q.why)}${srcHtml}</div>`;
    $("#q-next").disabled = false;
    $("#q-next").textContent = quiz.idx === quiz.items.length - 1 ? "See score →" : "Next →";
  }


  /* ---------- COMPOSITION ARC MCQ ----------
     Strength mnemonic used here: L I V E R P S
     Local opinions > inherits > variants > references > payloads > specializes.
     Within a layer stack, stronger local layer opinions win over weaker sublayers.
  */
  const COMPOSITION_MCQS = (window.COMPOSITION_MCQS || []);

  let mcq = { items: [], idx: 0, score: 0, answered: false };

  function startMcq() {
    mcq = { items: shuffle(COMPOSITION_MCQS.slice()), idx: 0, score: 0, answered: false };
    renderMcq();
  }

  function renderMcq() {
    const host = $("#mcq-host");
    if (!host) return;
    if (mcq.idx >= mcq.items.length) {
      const pct = Math.round(mcq.score / mcq.items.length * 100);
      host.innerHTML = `<div class="quiz-score">
        <div class="big">${pct}%</div>
        <p>You scored <b>${mcq.score}/${mcq.items.length}</b> on composition-arc reasoning.</p>
        <button class="btn primary" id="remcq">New shuffled set</button></div>`;
      $("#mcq-progress").style.width = "100%";
      $("#remcq").onclick = startMcq;
      return;
    }

    const q = mcq.items[mcq.idx];
    mcq.answered = false;
    host.innerHTML = `
      <div class="quiz-q">
        <div class="meta">
          <span class="badge">Composition · ${mcq.idx + 1}/${mcq.items.length}</span>
          <span class="badge dim">What survives composition?</span>
        </div>
        <div class="q">${md(q.q)}</div>
        <pre class="usdcase">${q.code.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
        <div class="choices">
          ${q.choices.map((ch, i) => `<button class="choice" data-i="${i}">${md(ch)}</button>`).join("")}
        </div>
        <div id="mcq-explain"></div>
        <div class="nav">
          <span class="mcq-scoreline">Score: <b>${mcq.score}</b></span>
          <span class="spacer"></span>
          <button class="btn primary" id="mcq-next" disabled>Next →</button>
        </div>
      </div>`;
    $$("#mcq-host .choice").forEach(btn => btn.onclick = () => answerMcq(+btn.dataset.i));
    $("#mcq-next").onclick = () => { mcq.idx++; renderMcq(); };
    $("#mcq-progress").style.width = (mcq.idx / mcq.items.length * 100) + "%";
  }

  function answerMcq(i) {
    if (mcq.answered) return;
    mcq.answered = true;
    const q = mcq.items[mcq.idx];
    if (i === q.answer) mcq.score++;
    $$("#mcq-host .choice").forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.answer) {
        btn.classList.add("correct");
        btn.insertAdjacentHTML("beforeend", '<span class="mark">✓</span>');
      }
      if (idx === i && i !== q.answer) {
        btn.classList.add("wrong");
        btn.insertAdjacentHTML("beforeend", '<span class="mark">✗</span>');
      }
    });
    $("#mcq-explain").innerHTML = `<div class="explain"><b>${i === q.answer ? "Correct." : "Not quite."}</b> ${md(q.why)}</div>`;
    $("#mcq-next").disabled = false;
    $("#mcq-next").textContent = mcq.idx === mcq.items.length - 1 ? "See score →" : "Next →";
  }

  /* ---------- BLUEPRINT view ---------- */
  function renderBlueprint() {
    const bars = DOMAINS.slice().sort((a, b) => b.weight - a.weight).map(d =>
      `<div class="bar"><div class="lbl">D${d.id} ${d.name}</div>
        <div class="track"><div class="fill" style="width:${d.weight * 4}%"></div></div>
        <div class="pct">${d.weight}%</div></div>`).join("");
    $("#blueprint-bars").innerHTML = bars;
  }

  /* ---------- RESOURCES view (per-domain courses + readings from the guide) ---------- */
  function renderResources() {
    const host = $("#resources-host");
    if (!host) return;
    const doms = DOMAINS.slice().sort((a, b) => b.weight - a.weight).filter(d => selectedDomains.has(d.id));
    if (!doms.length) { host.innerHTML = `<p class="empty">No domains selected — pick some above.</p>`; return; }
    host.innerHTML = doms.map(d => {
      const dr = DOMAIN_REFS[d.id] || { courses: [], readings: [] };
      const courses = dr.courses.map(k => `<li>${refAnchor(k)}</li>`).join("");
      const readings = dr.readings.map(k => `<li>${refAnchor(k)}</li>`).join("");
      return `<h3>D${d.id} · ${d.name} <span class="tag">${d.weight}%</span></h3>
        <div class="reslabel">NVIDIA Courses</div><ul class="reslist">${courses}</ul>
        <div class="reslabel">Suggested Readings</div><ul class="reslist cols">${readings}</ul>`;
    }).join("");
  }

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", e => {
    if (!$("#view-cards").classList.contains("active")) return;
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") { e.preventDefault(); flip(); }
    else if (e.code === "ArrowRight") { advance(); }
    else if (e.code === "ArrowLeft") { pos = (pos - 1 + session.length) % session.length; renderCard(); }
    else if (e.key === "1") { const fc = $("#flashcard"); if (fc && session.length) { grade(session[pos], false); advance(); } }
    else if (e.key === "2") { const fc = $("#flashcard"); if (fc && session.length) { grade(session[pos], true); advance(); } }
  });

  /* ---------- tabs ---------- */
  function initTabs() {
    $$(".tab").forEach(t => t.onclick = () => {
      $$(".tab").forEach(x => x.classList.remove("active"));
      $$(".view").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      $("#view-" + t.dataset.view).classList.add("active");
      if (t.dataset.view === "quiz" && !quiz.items.length) startQuiz();
      if (t.dataset.view === "mcq" && !mcq.items.length) startMcq();
    });
  }

  /* ---------- controls ---------- */
  function initControls() {
    $("#cram").onchange = e => { cramMode = e.target.checked; buildSession(); };
    $("#new-session").onclick = buildSession;
    $("#reset").onclick = () => {
      if (confirm("Reset all spaced-repetition progress? This clears your box levels and schedule.")) {
        state = {}; save(); buildSession();
      }
    };
    $("#quiz-start").onclick = startQuiz;
    $("#mcq-start").onclick = startMcq;
  }

  /* ---------- boot ---------- */
  $("#meta-line").textContent = DECK.meta.questions;
  renderFilters();
  renderBlueprint();
  renderResources();
  initTabs();
  initControls();
  buildSession();
})();

