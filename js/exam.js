const $app = document.getElementById("app");
const TYPE_AR = { tf: "صح / خطأ", mcq: "اختيار من متعدد", scenario: "سيناريو مؤسسي", image: "تعرّف الصورة" };

const state = {
  name: "",
  klass: "",
  order: [],
  answers: {},
  i: 0,
  startedAt: 0,
  finishedAt: 0,
  endsAt: 0,
  tick: null,
  submitted: false,
  timedOut: false,
  sendNote: "",
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function qAt(i) {
  return QUESTIONS.find((q) => q.id === state.order[i]);
}

function totalPoints() {
  return QUESTIONS.reduce((s, q) => s + q.points, 0);
}

function nowStamp(ms) {
  return new Date(ms || Date.now()).toLocaleString("ar-JO", { dateStyle: "short", timeStyle: "medium" });
}

function durationInfo(startMs, endMs) {
  const totalSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return {
    seconds: totalSec,
    minutes: Math.round((totalSec / 60) * 100) / 100,
    clock: String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"),
    text: m + " دقيقة و " + s + " ثانية",
  };
}

function typePercent(details, type) {
  const rows = details.filter((d) => d.type === type);
  if (!rows.length) return "";
  const max = rows.reduce((s, d) => s + d.points, 0);
  const earned = rows.reduce((s, d) => s + d.earned, 0);
  return max ? Math.round((earned / max) * 100) : 0;
}

function joinItems(rows, fmt) {
  return rows.length ? rows.map(fmt).join("  |  ") : "لا يوجد";
}

function sheetsUrl() {
  return String((window.DD_CLOUD || {}).sheetsUrl || "").trim();
}

function sendCloud(pack) {
  const url = sheetsUrl();
  if (!url) return "missing";
  const body = JSON.stringify(pack);
  try {
    let form = document.getElementById("examCloudForm");
    if (!form) {
      form = document.createElement("form");
      form.id = "examCloudForm";
      form.method = "POST";
      form.target = "examSink";
      form.acceptCharset = "UTF-8";
      form.style.display = "none";
      ["payload", "data"].forEach((name) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        form.appendChild(input);
      });
      document.body.appendChild(form);
    }
    form.action = url;
    form.querySelector("[name=payload]").value = body;
    form.querySelector("[name=data]").value = body;
    form.submit();
    return "sent";
  } catch (err) {
    try {
      fetch(url, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "payload=" + encodeURIComponent(body),
      });
      return "sent";
    } catch (e2) {
      return "fail";
    }
  }
}

function grade() {
  const details = state.order.map((id, i) => {
    const q = QUESTIONS.find((x) => x.id === id);
    const chosenId = state.answers[q.id];
    const chosen = q.options.find((o) => o.id === chosenId);
    const correct = q.options.find((o) => o.ok);
    const ok = Boolean(chosen && chosen.ok);
    return {
      num: i + 1,
      id: q.id,
      type: q.type,
      typeAr: TYPE_AR[q.type],
      topic: q.topic,
      points: q.points,
      prompt: q.prompt,
      chosen: chosen ? chosen.text : "لم يجب",
      correctText: correct ? correct.text : "",
      result: !chosenId ? "لم يجب" : (ok ? "صحيح" : "خطأ"),
      earned: ok ? q.points : 0,
      explain: q.explain,
    };
  });
  const earned = details.reduce((s, d) => s + d.earned, 0);
  const max = totalPoints();
  const percent = Math.round((earned / max) * 100);
  const correct = details.filter((d) => d.result === "صحيح").length;
  const wrong = details.filter((d) => d.result === "خطأ").length;
  const skipped = details.filter((d) => d.result === "لم يجب").length;
  const weak = {};
  details.forEach((d) => {
    if (d.result !== "صحيح") weak[d.topic] = (weak[d.topic] || 0) + 1;
  });
  const weakTopics = Object.entries(weak).sort((a, b) => b[1] - a[1]).map(([t, n]) => t + " (" + n + ")");
  let band = "لم يثبت الفهم بعد — أعد دراسة المعرض والمصطلحات ثم أعد المحاولة.";
  if (percent >= 85) band = "أتقنت الدرس: تميّز الأجهزة وتتخذ قرار بنية تحتية واعي.";
  else if (percent >= 70) band = "فهم جيد مع ثغرات. راجع الموضوعات الضعيفة أدناه.";
  else if (percent >= 50) band = "بداية فهم، لكن التفاصيل المؤسسية لم تكتمل. أعد الدرس قبل الاعتماد على النتيجة.";
  return { details, earned, max, percent, correct, wrong, skipped, weakTopics, band };
}

function examPayload(g) {
  const finishedAt = state.finishedAt || Date.now();
  const dur = durationInfo(state.startedAt, finishedAt);
  const errors = g.details.filter((d) => d.result === "خطأ");
  const blanks = g.details.filter((d) => d.result === "لم يجب");
  const goods = g.details.filter((d) => d.result === "صحيح");
  return {
    kind: "exam",
    name: state.name,
    klass: state.klass,
    when: nowStamp(finishedAt),
    startedAt: nowStamp(state.startedAt),
    finishedAt: nowStamp(finishedAt),
    durationSeconds: dur.seconds,
    durationMinutes: dur.minutes,
    durationClock: dur.clock,
    durationText: dur.text,
    allowedMinutes: EXAM.minutes,
    submitType: state.timedOut ? "انتهى الوقت — تسليم تلقائي" : "تسليم يدوي",
    minutes: EXAM.minutes,
    correct: g.correct,
    wrong: g.wrong,
    skipped: g.skipped,
    answered: g.correct + g.wrong,
    total: QUESTIONS.length,
    points: g.earned,
    maxPoints: g.max,
    percent: g.percent,
    percentTf: typePercent(g.details, "tf"),
    percentMcq: typePercent(g.details, "mcq"),
    percentScenario: typePercent(g.details, "scenario"),
    percentImage: typePercent(g.details, "image"),
    band: g.band,
    weakTopics: g.weakTopics.join("، ") || "لا يوجد",
    errorSummary: joinItems(errors, (d) =>
      "س" + d.num + " [" + d.topic + "] أجاب: " + d.chosen + " | الصحيح: " + d.correctText
    ),
    skippedSummary: joinItems(blanks, (d) => "س" + d.num + " [" + d.topic + "] " + d.prompt),
    correctSummary: joinItems(goods, (d) => "س" + d.num + " [" + d.topic + "]"),
    details: g.details,
  };
}

function renderStart() {
  document.body.classList.add("is-start");
  const n = QUESTIONS.length;
  const tf = QUESTIONS.filter((q) => q.type === "tf").length;
  const mcq = QUESTIONS.filter((q) => q.type === "mcq").length;
  const sc = QUESTIONS.filter((q) => q.type === "scenario").length;
  const img = QUESTIONS.filter((q) => q.type === "image").length;
  $app.innerHTML = `
    <div class="start-fit">
      <p class="kicker">${esc(EXAM.unit)}</p>
      <h1>${esc(EXAM.title)}</h1>
      <p class="lead">امتحان ختامي بعد دراسة المعرض. الأسئلة جديدة: ليست من المختبر ولا من «اختبر نفسك». الأنواع: صح وخطأ، اختيار، سيناريو، وصورة جهاز.</p>
      <div class="grid grid-3 start-stats">
        <div class="stat"><b>${n}</b> سؤالًا · ${totalPoints()} درجة</div>
        <div class="stat"><b>${EXAM.minutes} د</b> ثم تسليم تلقائي</div>
        <div class="stat"><b>${tf}+${mcq}+${sc}+${img}</b> صح/خطأ · اختيار · سيناريو · صورة</div>
      </div>
      <article class="panel start-panel">
        <h2>قبل أن تبدأ</h2>
        <ul>
          <li>اقرأ السؤال كاملًا. في الصور انظر إلى الشكل لا اللون فقط.</li>
          <li>يمكن التنقل بين الأسئلة قبل التسليم.</li>
          <li>بعد التسليم تُحفظ بياناتك ويمكنك مراجعة الإجابات.</li>
        </ul>
        <form id="start-form">
          <div class="form-row">
            <label>اسم الطالب <input id="nm" required autocomplete="name" /></label>
            <label>الشعبة / الصف <input id="kl" placeholder="مثال: 11 ت" /></label>
          </div>
          <small class="err hidden" id="err">اكتب الاسم للبدء.</small>
          <button class="btn" type="submit">بدء الامتحان</button>
        </form>
      </article>
    </div>
  `;
  $app.querySelector("#start-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $app.querySelector("#nm").value.trim();
    if (!name) {
      $app.querySelector("#err").classList.remove("hidden");
      return;
    }
    state.name = name;
    state.klass = $app.querySelector("#kl").value.trim();
    startExam();
  };
}

function startExam() {
  document.body.classList.remove("is-start");
  state.order = shuffle(QUESTIONS.map((q) => q.id));
  QUESTIONS.forEach((q) => {
    if (q.type !== "tf") q.options = shuffle(q.options);
  });
  state.answers = {};
  state.i = 0;
  state.submitted = false;
  state.timedOut = false;
  state.startedAt = Date.now();
  state.finishedAt = 0;
  state.endsAt = state.startedAt + EXAM.minutes * 60 * 1000;
  document.getElementById("timer-box").classList.remove("hidden");
  if (state.tick) clearInterval(state.tick);
  state.tick = setInterval(updateTimer, 250);
  updateTimer();
  renderQuestion();
}

function updateTimer() {
  const left = Math.max(0, state.endsAt - Date.now());
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const el = document.getElementById("timer");
  el.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  document.getElementById("timer-box").classList.toggle("warn", left < 5 * 60 * 1000);
  if (left <= 0 && !state.submitted) submitExam(true);
}

function renderQuestion() {
  const q = qAt(state.i);
  const n = state.order.length;
  const chosen = state.answers[q.id];
  $app.innerHTML = `
    <div class="meta">
      <span class="badge">${TYPE_AR[q.type]} · ${esc(q.topic)} · ${q.points} درجة</span>
      <span>سؤال ${state.i + 1} من ${n} · أُجيب ${Object.keys(state.answers).length}/${n}</span>
    </div>
    <article class="panel">
      <h2>${esc(q.prompt)}</h2>
      ${q.image ? `<div class="q-image"><img src="${esc(q.image)}" alt="${esc(q.imageAlt || "")}" /></div>` : ""}
      ${q.options.map((o) => `
        <button class="choice ${chosen === o.id ? "on" : ""}" data-opt="${o.id}">${esc(o.text)}</button>
      `).join("")}
      <div class="pager">
        <button class="btn ghost" id="prev" ${state.i === 0 ? "disabled" : ""}>السابق</button>
        <button class="btn" id="next">${state.i === n - 1 ? "مراجعة التسليم" : "التالي"}</button>
      </div>
    </article>
    <div class="dots" id="dots"></div>
    <p style="margin-top:16px"><button class="btn danger" id="finish">تسليم الامتحان الآن</button></p>
  `;
  const dots = $app.querySelector("#dots");
  state.order.forEach((id, idx) => {
    const b = document.createElement("button");
    b.textContent = idx + 1;
    if (idx === state.i) b.classList.add("now");
    if (state.answers[id]) b.classList.add("done");
    b.onclick = () => { state.i = idx; renderQuestion(); };
    dots.appendChild(b);
  });
  $app.querySelectorAll("[data-opt]").forEach((btn) => {
    btn.onclick = () => {
      state.answers[q.id] = btn.dataset.opt;
      renderQuestion();
    };
  });
  $app.querySelector("#prev").onclick = () => { state.i = Math.max(0, state.i - 1); renderQuestion(); };
  $app.querySelector("#next").onclick = () => {
    if (state.i === n - 1) renderConfirm();
    else { state.i += 1; renderQuestion(); }
  };
  $app.querySelector("#finish").onclick = () => renderConfirm();
}

function renderConfirm() {
  const n = QUESTIONS.length;
  const done = Object.keys(state.answers).length;
  $app.innerHTML = `
    <h1>تسليم الامتحان</h1>
    <p class="lead">أجبت ${done} من ${n}. الأسئلة الفارغة تُحسب صفرًا. بعد التسليم تُحفظ البيانات.</p>
    <div class="pager">
      <button class="btn ghost" id="back">العودة للأسئلة</button>
      <button class="btn danger" id="go">تأكيد التسليم</button>
    </div>
  `;
  $app.querySelector("#back").onclick = () => renderQuestion();
  $app.querySelector("#go").onclick = () => submitExam(false);
}

function submitExam(timedOut) {
  if (state.submitted) return;
  state.submitted = true;
  state.timedOut = Boolean(timedOut);
  state.finishedAt = Date.now();
  if (state.tick) clearInterval(state.tick);
  const box = document.getElementById("timer-box");
  if (box) box.classList.add("hidden");
  const g = grade();
  g.duration = durationInfo(state.startedAt, state.finishedAt);
  g.timedOut = state.timedOut;
  state.sendNote = sendCloud(examPayload(g));
  renderResult(g);
}

function renderResult(g) {
  const send = state.sendNote === "sent"
    ? `<p class="send-status ok">تم حفظ البيانات.</p>`
    : `<p class="send-status bad">تعذّر حفظ البيانات. أخبر المعلم بالاسم والدرجة ${g.percent}%.</p>`;
  $app.innerHTML = `
    <p class="kicker">نتيجة ${esc(state.name)}</p>
    <h1>هل اكتمل فهم الدرس؟</h1>
    <div class="score-ring" style="--p:${g.percent}"><span>${g.earned}/${g.max}</span></div>
    <p class="band">${g.percent}% · ${g.correct} صحيحة · ${g.wrong} خطأ · ${g.skipped} بلا إجابة · المدة ${esc(g.duration.text)}</p>
    <p class="lead" style="text-align:center">${esc(g.band)}</p>
    ${send}
    ${g.weakTopics.length ? `<article class="panel"><strong>موضوعات تحتاج مراجعة:</strong> ${esc(g.weakTopics.join("، "))}</article>` : ""}
    <h2>مراجعة التعلم</h2>
    <div class="review">
      ${g.details.map((d, i) => `
        <article class="${d.result === "صحيح" ? "good" : "bad"}">
          <h3>${i + 1}. ${esc(d.typeAr)} · ${esc(d.result)} · ${d.earned}/${d.points}</h3>
          <p>${esc(d.prompt)}</p>
          <p><strong>إجابتك:</strong> ${esc(d.chosen)}</p>
          <p><strong>الأصح:</strong> ${esc(d.correctText)}</p>
          <p>${esc(d.explain)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

renderStart();
