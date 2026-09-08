/**
 * الصق هذا الملف داخل Apps Script المرتبط بالجدول:
 * https://docs.google.com/spreadsheets/d/1AvTWXZ9h21ZcQwFVMjS6u8fRPcHbxpLjE5hTaQXqrf8/edit
 *
 * ثم: نشر → نشر جديد → تطبيق ويب
 * التنفيذ: أنا  |  من يمكنه الوصول: أي شخص
 * انسخ رابط Web App والصقه في js/config.js مكان sheetsUrl
 */

var SHEET_ID = "1AvTWXZ9h21ZcQwFVMjS6u8fRPcHbxpLjE5hTaQXqrf8";

function doGet() {
  return ContentService.createTextOutput("دليل الأجهزة الرقمية — جاهز لاستقبال النتائج");
}

function boundSpreadsheet_() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var data = readPayload_(e);
    var kind = String(data.kind || "");
    var ss = boundSpreadsheet_();

    if (kind === "quiz") {
      writeQuiz_(ss, data);
    } else if (kind === "lab") {
      writeLab_(ss, data);
    } else if (kind === "exam") {
      writeExam_(ss, data);
    } else {
      throw new Error("unknown kind: " + kind);
    }

    return jsonOut_({ ok: true, kind: kind });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function writeQuiz_(ss, data) {
  var sumHead = [
    "الاسم", "الشعبة", "التاريخ والوقت",
    "صحيحة", "خاطئة", "المجموع", "النسبة %",
    "ملخص الصحيحة", "ملخص الخاطئة"
  ];
  var detHead = [
    "الاسم", "الشعبة", "التاريخ والوقت",
    "رقم السؤال", "السؤال",
    "إجابة الطالب", "الإجابة الصحيحة",
    "النتيجة", "التفسير"
  ];
  var summary = ensureSheet_(ss, "اختبر نفسك - ملخص", sumHead);
  var details = ensureSheet_(ss, "اختبر نفسك - تفاصيل", detHead);

  summary.appendRow([
    data.name || "",
    data.klass || "",
    data.when || "",
    data.correct || 0,
    data.wrong || 0,
    data.total || 0,
    data.percent || 0,
    data.correctSummary || "",
    data.wrongSummary || ""
  ]);

  (data.details || []).forEach(function (row) {
    details.appendRow([
      data.name || "",
      data.klass || "",
      data.when || "",
      row.num || "",
      row.question || "",
      row.chosen || "",
      row.correctText || "",
      row.result || "",
      row.explain || ""
    ]);
  });
}

function writeLab_(ss, data) {
  var sumHead = [
    "الاسم", "الشعبة", "التاريخ والوقت",
    "قرارات صحيحة", "قرارات خاطئة", "لم يجب",
    "عدد السيناريوهات", "النسبة %",
    "ملخص الاختيارات"
  ];
  var detHead = [
    "الاسم", "الشعبة", "التاريخ والوقت",
    "رقم السيناريو", "عنوان السيناريو", "وصف الحالة",
    "اختيار الطالب", "الخيار الصحيح",
    "النتيجة", "سبب القرار", "أجاب؟"
  ];
  var summary = ensureSheet_(ss, "مختبر البنية - ملخص", sumHead);
  var details = ensureSheet_(ss, "مختبر البنية - تفاصيل", detHead);

  summary.appendRow([
    data.name || "",
    data.klass || "",
    data.when || "",
    data.correct || 0,
    data.wrong || 0,
    data.skipped || 0,
    data.total || 0,
    data.percent || 0,
    data.choiceSummary || ""
  ]);

  (data.details || []).forEach(function (row) {
    details.appendRow([
      data.name || "",
      data.klass || "",
      data.when || "",
      row.num || "",
      row.title || "",
      row.brief || "",
      row.chosen || "",
      row.correctText || "",
      row.result || "",
      row.why || "",
      row.answered || ""
    ]);
  });
}

function writeExam_(ss, data) {
  var sumHead = [
    "الاسم", "الشعبة",
    "وقت البدء", "وقت التسليم",
    "المدة (د:ث)", "المدة نصًا", "المدة بالثواني", "المدة بالدقائق",
    "المدة المسموحة (دقيقة)", "طريقة التسليم",
    "صحيحة", "خاطئة", "لم يجب", "أجاب", "عدد الأسئلة",
    "الدرجات", "الدرجة الكاملة", "النسبة %",
    "نسبة صح/خطأ %", "نسبة الاختيار %", "نسبة السيناريو %", "نسبة الصور %",
    "الحكم", "موضوعات ضعيفة",
    "ملخص الأخطاء", "الأسئلة المتروكة", "الأسئلة الصحيحة"
  ];
  var detHead = [
    "الاسم", "الشعبة", "وقت التسليم", "مدة الامتحان",
    "رقم السؤال", "معرف السؤال", "نوع السؤال", "الموضوع",
    "السؤال", "إجابة الطالب", "الإجابة الصحيحة",
    "النتيجة", "أخطأ؟", "تركه فارغًا؟",
    "الدرجة المكتسبة", "درجة السؤال", "التفسير"
  ];
  var errHead = [
    "الاسم", "الشعبة", "وقت التسليم", "مدة الامتحان",
    "رقم السؤال", "نوع السؤال", "الموضوع",
    "السؤال", "إجابة الطالب", "الإجابة الصحيحة",
    "النتيجة", "الدرجة الضائعة", "التفسير"
  ];
  var summary = ensureSheet_(ss, "الامتحان الختامي - ملخص", sumHead);
  var details = ensureSheet_(ss, "الامتحان الختامي - تفاصيل", detHead);
  var errors = ensureSheet_(ss, "الامتحان الختامي - الأخطاء", errHead);

  summary.appendRow([
    data.name || "",
    data.klass || "",
    data.startedAt || "",
    data.finishedAt || data.when || "",
    data.durationClock || "",
    data.durationText || "",
    data.durationSeconds || "",
    data.durationMinutes || "",
    data.allowedMinutes || data.minutes || "",
    data.submitType || "",
    data.correct || 0,
    data.wrong || 0,
    data.skipped || 0,
    data.answered || ((data.correct || 0) + (data.wrong || 0)),
    data.total || 0,
    data.points || 0,
    data.maxPoints || 0,
    data.percent || 0,
    data.percentTf === "" ? "" : data.percentTf,
    data.percentMcq === "" ? "" : data.percentMcq,
    data.percentScenario === "" ? "" : data.percentScenario,
    data.percentImage === "" ? "" : data.percentImage,
    data.band || "",
    data.weakTopics || "",
    data.errorSummary || "",
    data.skippedSummary || "",
    data.correctSummary || ""
  ]);

  (data.details || []).forEach(function (row, i) {
    var result = row.result || "";
    var earned = row.earned != null ? row.earned : 0;
    var pts = row.points || 0;
    details.appendRow([
      data.name || "",
      data.klass || "",
      data.finishedAt || data.when || "",
      data.durationText || data.durationClock || "",
      row.num || (i + 1),
      row.id || "",
      row.typeAr || row.type || "",
      row.topic || "",
      row.prompt || "",
      row.chosen || "",
      row.correctText || "",
      result,
      result === "خطأ" ? "نعم" : "لا",
      result === "لم يجب" ? "نعم" : "لا",
      earned,
      pts,
      row.explain || ""
    ]);
    if (result === "خطأ" || result === "لم يجب") {
      errors.appendRow([
        data.name || "",
        data.klass || "",
        data.finishedAt || data.when || "",
        data.durationText || data.durationClock || "",
        row.num || (i + 1),
        row.typeAr || row.type || "",
        row.topic || "",
        row.prompt || "",
        row.chosen || "",
        row.correctText || "",
        result,
        Math.max(0, pts - earned),
        row.explain || ""
      ]);
    }
  });
}

function firstText_(v) {
  if (v == null) return "";
  if (Object.prototype.toString.call(v) === "[object Array]") {
    v = v.length ? v[0] : "";
  }
  return String(v);
}

function tryParseJson_(text) {
  if (!text) return null;
  try {
    var obj = JSON.parse(text);
    if (obj && typeof obj === "object") return obj;
  } catch (err) {
    try {
      var obj2 = JSON.parse(String(text).replace(/^\uFEFF/, "").trim());
      if (obj2 && typeof obj2 === "object") return obj2;
    } catch (err2) {}
  }
  return null;
}

function tryParseForm_(text) {
  if (!text || text.indexOf("=") < 0) return null;
  var parts = String(text).split("&");
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf("=");
    if (eq < 0) continue;
    var key = parts[i].slice(0, eq);
    var val = parts[i].slice(eq + 1);
    try { key = decodeURIComponent(key.replace(/\+/g, " ")); } catch (e1) {}
    if (key !== "payload" && key !== "data") continue;
    try { val = decodeURIComponent(val.replace(/\+/g, " ")); } catch (e2) {}
    var parsed = tryParseJson_(val);
    if (parsed) return parsed;
  }
  return null;
}

function readPayload_(e) {
  e = e || {};
  var p = e.parameter || {};
  var ps = e.parameters || {};
  var raw = e.postData && e.postData.contents ? String(e.postData.contents) : "";
  var candidates = [p.payload, p.data, ps.payload, ps.data, raw];
  for (var i = 0; i < candidates.length; i++) {
    var text = firstText_(candidates[i]);
    if (!text) continue;
    var asJson = tryParseJson_(text);
    if (asJson) return asJson;
    var asForm = tryParseForm_(text);
    if (asForm) return asForm;
  }
  throw new Error("empty body");
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 1) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
