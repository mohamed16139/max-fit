// Training & Workouts: today's workout, focus mode, plans and editor, exercise library, replacement, progress.
import {$, $$, esc, icon, ibtn, toast, sheet, confirmDialog, promptDialog, fmt, fmtDate, today, iso, lineChart} from "./dom.js";
import {EXERCISES} from "../data/exercises.js";
import {PROGRAM_TEMPLATES} from "../data/programs.js";
import {MUSCLE_GROUPS, EQUIPMENT, LEVELS, PATTERN_LABELS, PURPOSES, purpose, recommend, restSeconds, exerciseAlternatives, eqLabel, levelLabel,
  searchExercises, planFromTemplate, blankPlan, duplicatePlan, trainingDays, topSets} from "../core/training.js";

const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
const exName = id => (EX[id] || {name: id}).name;
const img = (id, n = 0) => `/img/ex/${encodeURIComponent(id)}-${n}.jpg`;
const thumb = id => EX[id] ? `<img class="thumb" src="${img(id)}" alt="" loading="lazy" width="52" height="52">` : `<span class="thumb cat-ico">${icon("dumbbell")}</span>`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const selDay = {};        // plan id -> selected day index (kept for the session)
let editingPlan = null;   // plan id open in the editor
let libState = {q: "", group: "", equipment: "", level: "", mechanic: "", purpose: ""};

export function renderTraining(el, ctx, sub) {
  const p = ctx.profile();
  const tabs = [["workout", "Workout", "play"], ["plans", "Plans", "list"], ["library", "Library", "book-open"], ["progress", "Progress", "trending-up"]];
  if (sub !== "plans") editingPlan = null;
  el.innerHTML = `<header class="topbar"><div class="wrap"><h1>Training</h1></div></header>
   <div class="wrap"><div class="seg" role="tablist">${tabs.map(([id, l, ic]) => `<button role="tab" aria-selected="${sub === id}" data-tab="${id}">${icon(ic, "sm")}${l}</button>`).join("")}</div><div id="tv"></div></div>`;
  $(".seg", el).onclick = e => { const b = e.target.closest("[data-tab]"); if (b) ctx.go("#/training/" + b.dataset.tab); };
  const v = $("#tv", el);
  if (sub === "plans") return editingPlan && p.training.plans[editingPlan] ? planEditor(v, ctx, editingPlan) : plansView(v, ctx);
  if (sub === "library") return libraryView(v, ctx);
  if (sub === "progress") return progressView(v, ctx);
  return workoutView(v, ctx);
}

// =====================================================================
// Workout
// =====================================================================
function workoutView(v, ctx) {
  const p = ctx.profile(), plan = p.training.plans[p.training.activePlanId];
  if (!plan) {
    v.innerHTML = `<div class="card empty">${icon("dumbbell")}<h3>No active workout plan</h3><p>Pick a ready-made program or build your own.</p>
      <button type="button" class="btn primary" id="toPlans">${icon("list", "sm")}Choose a plan</button></div>`;
    $("#toPlans", v).onclick = () => ctx.go("#/training/plans"); return;
  }
  if (selDay[plan.id] == null) selDay[plan.id] = Math.max(0, plan.days.findIndex(d => (d.exercises || []).length));
  const di = Math.min(selDay[plan.id], plan.days.length - 1), day = plan.days[di], logs = p.training.logs, t = today();
  const dayDone = d => (d.exercises || []).length && d.exercises.every(e => isDone(logs, e, t));
  const exs = day.exercises || [], doneN = exs.filter(e => isDone(logs, e, t)).length;
  v.innerHTML = `<section class="card" style="margin-bottom:12px"><div class="row"><div style="flex:1;min-width:0"><div class="eyebrow">Active plan</div><h2 style="margin-top:2px">${esc(plan.name)}</h2>
     <div class="muted" style="font-size:13px">${trainingDays(plan)} training days${plan.goal ? " · " + esc(plan.goal) : ""}</div></div>
     ${ibtn("square-pen", "Edit plan", 'data-a="edit"')}${ibtn("arrow-left-right", "Switch plan", 'data-a="switch"')}</div></section>
   <div class="week" role="group" aria-label="Days">${plan.days.map((d, i) => `<button type="button" class="dayb${d.exercises && d.exercises.length ? "" : " rest"}" aria-pressed="${i === di}" data-day="${i}"><small>Day ${i + 1} ${dayDone(d) ? icon("circle-check") : ""}</small><b>${esc(d.name)}</b></button>`).join("")}</div>
   ${exs.length ? `<div class="row" style="margin-bottom:10px"><div style="flex:1"><h2>${esc(day.name)}</h2><div class="muted" style="font-size:13px">${exs.length} exercises · ${doneN} done</div></div>
      <button type="button" class="btn primary" data-a="focus">${icon("play", "sm")}${doneN ? "Continue" : "Start workout"}</button></div>
     <div class="bar" style="margin-bottom:14px" role="progressbar" aria-valuenow="${doneN}" aria-valuemax="${exs.length}" aria-label="Exercises done"><i style="width:${exs.length ? doneN / exs.length * 100 : 0}%"></i></div>
     <div class="stack" id="exlist">${exs.map(e => exCard(e, logs, t)).join("")}</div>`
   : `<div class="card empty">${icon("leaf")}<h3>${esc(day.name || "Rest day")}</h3><p>${esc(day.rest || "Rest and recover. Light walking or mobility work is a good idea.")}</p>
      <button type="button" class="btn ghost sm" data-a="edit">${icon("plus", "sm")}Add exercises to this day</button></div>`}`;

  v.onclick = async e => {
    const a = e.target.closest("[data-a]")?.dataset.a, card = e.target.closest(".exc"), slot = card && exs.find(x => x.id === card.dataset.slot);
    const db = e.target.closest("[data-day]"); if (db) { selDay[plan.id] = +db.dataset.day; return ctx.rerender(); }
    if (a === "edit") { editingPlan = plan.id; return ctx.go("#/training/plans"); }
    if (a === "switch") return ctx.go("#/training/plans");
    if (a === "focus") return focusMode(ctx, plan.id, day.id);
    if (!slot) return;
    if (a === "info") return exerciseSheet(ctx, slot.exId);
    if (a === "replace") return replaceExercise(ctx, plan.id, day.id, slot.id);
    if (a === "unlock") { card.dataset.edit = "1"; card.outerHTML = exCard(slot, ctx.profile().training.logs, t, true); return; }
    if (a === "lock") { refreshCard(slot); return; }
    const ck = e.target.closest("[data-set]");
    if (ck) {
      const s = +ck.dataset.set, row = ck.closest(".setrow"), logged = row.classList.contains("logged") && !row.dataset.dirty;
      if (logged) { ctx.save(d => { d.training.logs = d.training.logs.filter(l => !(l.ex === slot.exId && l.d === t && l.s === s)); }); refreshCard(slot, true); return; }
      const kg = parseFloat($("[name=kg]", row).value || $("[name=kg]", row).placeholder), reps = parseInt($("[name=reps]", row).value || $("[name=reps]", row).placeholder, 10);
      if (!(kg >= 0 && kg <= 500)) { $("[name=kg]", row).focus(); return toast("Enter the weight in kg (0 for bodyweight).", {error: true}); }
      if (!(reps >= 1 && reps <= 200)) { $("[name=reps]", row).focus(); return toast("Enter how many reps you did.", {error: true}); }
      const saved = ctx.save(d => { d.training.logs = d.training.logs.filter(l => !(l.ex === slot.exId && l.d === t && l.s === s)); d.training.logs.push({d: t, ex: slot.exId, kg, reps, s, plan: plan.id}); });
      if (!saved) return;
      const done = isDone(saved.training.logs, slot, t);
      refreshCard(slot, !done);
      if (s > 0 && !done) restTimer(restSeconds(slot.rest), exName(slot.exId));
      if (done) { stopTimer(); toast(`${exName(slot.exId)} done`); const nx = exs.find(x => !isDone(saved.training.logs, x, t)); if (nx) $(`.exc[data-slot="${nx.id}"]`, v)?.scrollIntoView({behavior: "smooth", block: "center"}); }
      updateHeader();
    }
  };
  v.oninput = e => { const r = e.target.closest(".setrow"); if (r && r.classList.contains("logged")) { r.dataset.dirty = "1"; $(".ck", r).setAttribute("aria-label", "Save changes"); } };
  function refreshCard(slot, keepOpen) {
    const c = $(`.exc[data-slot="${slot.id}"]`, v); if (!c) return;
    c.outerHTML = exCard(slot, ctx.profile().training.logs, t, keepOpen && c.dataset.edit === "1");
  }
  function updateHeader() {
    const lg = ctx.profile().training.logs, n = exs.filter(e => isDone(lg, e, t)).length;
    const bar = $(".bar>i", v); if (bar) bar.style.width = n / exs.length * 100 + "%";
    const m = $("h2+.muted", v); if (m) m.textContent = `${exs.length} exercises · ${n} done`;
  }
}

function isDone(logs, slot, d) {
  const got = new Set(logs.filter(l => l.ex === slot.exId && l.d === d && l.s > 0).map(l => l.s));
  for (let k = 1; k <= slot.sets; k++) if (!got.has(k)) return false;
  return slot.sets > 0;
}
function lastSession(logs, exId, before) {
  const prev = logs.filter(l => l.ex === exId && l.d < before && l.s !== 0), day = prev.map(l => l.d).sort().pop();
  return day ? {day, sets: prev.filter(l => l.d === day).sort((a, b) => (a.s || 0) - (b.s || 0))} : null;
}
function exCard(slot, logs, t, editing = false) {
  const e = EX[slot.exId], todays = logs.filter(l => l.ex === slot.exId && l.d === t), done = isDone(logs, slot, t), last = lastSession(logs, slot.exId, t);
  const repsTarget = (String(slot.reps).match(/\d+/) || [""])[0];
  const head = `<div class="exc-h">${thumb(slot.exId)}<div class="main"><div class="title"><button type="button" data-a="info" aria-label="About ${esc(exName(slot.exId))}">${esc(exName(slot.exId))}</button>${done ? `<span class="badge ok">${icon("check", "sm")}Done</span>` : ""}</div>
     <div class="meta"><span class="pill">${slot.sets} × ${esc(slot.reps)}</span><span class="pill">${icon("timer")}${esc(slot.rest)}</span>${slot.weight ? `<span class="pill">${icon("target")}${fmt(slot.weight, 1)} kg</span>` : ""}${slot.notes ? `<span class="pill">${icon("file-text")}${esc(slot.notes)}</span>` : ""}</div></div>
     ${ibtn("arrow-left-right", "Replace exercise", 'data-a="replace"')}${done && !editing ? ibtn("pencil", "Edit sets", 'data-a="unlock"') : ""}</div>`;
  if (done && !editing) {
    const ws = todays.filter(l => l.s > 0).sort((a, b) => a.s - b.s);
    return `<article class="exc done" data-slot="${slot.id}">${head}<div class="exc-b"><div class="prev" style="margin-top:0">${ws.map(l => `Set ${l.s}: <b style="color:var(--ink)">${fmt(l.kg, 1)} kg × ${l.reps}</b>`).join(" · ")}</div></div></article>`;
  }
  const rows = [0, ...Array.from({length: slot.sets}, (_, k) => k + 1)].map(s => {
    const l = todays.find(x => x.s === s), ref = last && (last.sets.find(x => x.s === s) || last.sets[last.sets.length - 1]);
    const prevToday = todays.filter(x => x.s > 0 && x.s < s).sort((a, b) => b.s - a.s)[0];
    const phKg = l ? "" : (prevToday ? prevToday.kg : slot.weight ?? (ref ? ref.kg : "")), phReps = l ? "" : (ref ? ref.reps : repsTarget);
    return `<div class="setrow${l ? " logged" : ""}"><span class="lbl${s ? "" : " warm"}">${s ? "Set " + s : "Warm-up"}</span>
      <input name="kg" type="number" inputmode="decimal" step="0.5" min="0" max="500" value="${l ? l.kg : ""}" placeholder="${phKg}" aria-label="${s ? "Set " + s : "Warm-up"} weight in kg">
      <input name="reps" type="number" inputmode="numeric" min="1" max="200" value="${l ? l.reps : ""}" placeholder="${phReps}" aria-label="${s ? "Set " + s : "Warm-up"} reps">
      <button type="button" class="ck" data-set="${s}" aria-label="${l ? "Undo " : "Log "}${s ? "set " + s : "warm-up"}">${icon("check")}</button></div>`;
  }).join("");
  return `<article class="exc" data-slot="${slot.id}"${editing ? ' data-edit="1"' : ""}>${head}<div class="exc-b">
    <div class="sethead"><span>Set</span><span>kg</span><span>Reps</span><span></span></div><div class="sets">${rows}</div>
    ${last ? `<div class="prev">${icon("history", "sm")} Last time (${fmtDate(last.day)}): ${last.sets.map(l => `${fmt(l.kg, 1)}×${l.reps}`).join(", ")}</div>` : ""}
    ${editing ? `<button type="button" class="btn ghost sm" data-a="lock" style="margin-top:10px">${icon("check", "sm")}Done editing</button>` : ""}</div></article>`;
}

// ---------- rest timer ----------
let timerT = null;
function restTimer(sec, label) {
  stopTimer();
  const el = document.createElement("div");
  el.id = "rest"; el.className = "toast show"; el.setAttribute("role", "timer"); el.setAttribute("aria-live", "off");
  const end = Date.now() + sec * 1000;
  const tick = () => {
    const left = Math.max(0, Math.round((end + (+el.dataset.add || 0) * 1000 - Date.now()) / 1000));
    el.innerHTML = `${icon("timer", "sm")}<span>Rest <b class="num">${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}</b></span><button type="button" data-t="add">+15 s</button><button type="button" data-t="skip">Skip</button>`;
    if (!left) { stopTimer(); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} toast(`Rest over. Next set of ${label}.`); }
  };
  el.onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; if (b.dataset.t === "skip") stopTimer(); else { el.dataset.add = (+el.dataset.add || 0) + 15; tick(); } };
  document.body.appendChild(el); tick(); timerT = setInterval(tick, 500);
}
function stopTimer() { clearInterval(timerT); timerT = null; $("#rest")?.remove(); }

// ---------- focus mode ----------
function focusMode(ctx, planId, dayId) {
  stopTimer();
  const ov = document.createElement("div"); ov.className = "focus"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Workout");
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  const t = today(); let resting = null, restT = null;
  const state = () => { const p = ctx.profile(), plan = p.training.plans[planId], day = plan && plan.days.find(d => d.id === dayId); return {p, plan, day}; };
  let idx = (() => { const {p, day} = state(); const i = day.exercises.findIndex(e => !isDone(p.training.logs, e, t)); return i < 0 ? 0 : i; })();
  let kg = null, reps = null, setN = null;
  const close = () => { clearInterval(restT); ov.remove(); document.body.style.overflow = ""; ctx.rerender(); };
  const draw = () => {
    const {p, day} = state(); if (!day) return close();
    const exs = day.exercises, slot = exs[idx], logs = p.training.logs;
    const total = exs.reduce((a, e) => a + e.sets, 0), doneSets = exs.reduce((a, e) => a + new Set(logs.filter(l => l.ex === e.exId && l.d === t && l.s > 0 && l.s <= e.sets).map(l => l.s)).size, 0);
    const allDone = exs.every(e => isDone(logs, e, t));
    if (allDone && !resting) {
      ov.innerHTML = `<div class="focus-h">${ibtn("x", "Close workout", 'data-f="close"')}<div class="bar"><i style="width:100%"></i></div></div>
       <div class="focus-b"><div class="empty" style="padding-top:60px">${icon("award")}<h1>Workout complete</h1><p>${exs.length} exercises · ${doneSets} working sets logged. Great work.</p>
       <button type="button" class="btn primary lg" data-f="close">${icon("check")}Finish</button></div></div>`;
      return;
    }
    const got = logs.filter(l => l.ex === slot.exId && l.d === t), last = lastSession(logs, slot.exId, t);
    if (setN == null) { setN = 1; for (let k = 1; k <= slot.sets; k++) if (!got.some(l => l.s === k)) { setN = k; break; } }
    const cur = got.find(l => l.s === setN), ref = cur || got.filter(l => l.s > 0).pop() || (last && (last.sets.find(l => l.s === setN) || last.sets[last.sets.length - 1]));
    if (kg == null) kg = ref ? ref.kg : 20;
    if (reps == null) reps = ref ? ref.reps : +((String(slot.reps).match(/\d+/) || [10])[0]);
    ov.innerHTML = `<div class="focus-h">${ibtn("x", "Close workout", 'data-f="close"')}<div class="bar" role="progressbar" aria-valuenow="${doneSets}" aria-valuemax="${total}" aria-label="Sets done"><i style="width:${total ? doneSets / total * 100 : 0}%"></i></div><span class="faint num" style="font-size:13px;min-width:70px;text-align:right">${idx + 1} / ${exs.length}</span></div>
     <div class="focus-b stack">
      <div class="shots"><figure><img src="${img(slot.exId, 0)}" alt="${esc(exName(slot.exId))}, start"></figure><figure><img src="${img(slot.exId, 1)}" alt="${esc(exName(slot.exId))}, finish"></figure></div>
      <div><h1>${esc(exName(slot.exId))}</h1><div class="row wrap-ok" style="margin-top:8px;gap:6px"><span class="pill">${slot.sets} × ${esc(slot.reps)}</span><span class="pill">${icon("timer")}Rest ${esc(slot.rest)}</span>${slot.notes ? `<span class="pill">${esc(slot.notes)}</span>` : ""}</div></div>
      ${resting ? `<div class="timer" role="timer"><span class="eyebrow">Rest</span><b id="rt">0:00</b><div class="row"><button type="button" class="btn ghost sm" data-f="add">+15 s</button><button type="button" class="btn primary sm" data-f="skip">Skip rest</button></div></div>` : `
      <div class="chips" role="group" aria-label="Set">${[0, ...Array.from({length: slot.sets}, (_, k) => k + 1)].map(k => { const l = got.find(x => x.s === k); return `<button type="button" class="chip" data-f="set" data-s="${k}" aria-pressed="${k === setN}">${l && k ? icon("check", "sm") : ""}${k ? "Set " + k : "Warm-up"}${l ? ` · ${fmt(l.kg, 1)}×${l.reps}` : ""}</button>`; }).join("")}</div>
      <div class="big-in"><div class="field"><span class="label">Weight (kg)</span><div class="stepper"><button type="button" data-f="kg-" aria-label="Less weight">${icon("minus")}</button><input id="fkg" type="number" inputmode="decimal" step="0.5" value="${kg}" aria-label="Weight in kg"><button type="button" data-f="kg+" aria-label="More weight">${icon("plus")}</button></div></div>
       <div class="field"><span class="label">Reps</span><div class="stepper"><button type="button" data-f="r-" aria-label="Fewer reps">${icon("minus")}</button><input id="frp" type="number" inputmode="numeric" value="${reps}" aria-label="Reps"><button type="button" data-f="r+" aria-label="More reps">${icon("plus")}</button></div></div></div>
      ${last ? `<p class="faint" style="font-size:14px">${icon("history", "sm")} Last time: ${last.sets.map(l => `${fmt(l.kg, 1)}×${l.reps}`).join(", ")}</p>` : ""}`}
     </div>
     <div class="focus-f"><button type="button" class="btn ghost lg" data-f="prev" ${idx ? "" : "disabled"} aria-label="Previous exercise">${icon("chevron-left")}</button>
      ${resting ? `<button type="button" class="btn primary lg" data-f="skip">${icon("skip-forward")}Next set</button>` : `<button type="button" class="btn primary lg" data-f="log">${icon("check")}Log ${setN ? "set " + setN : "warm-up"}</button>`}
      <button type="button" class="btn ghost lg" data-f="next" ${idx < exs.length - 1 ? "" : "disabled"} aria-label="Next exercise">${icon("chevron-right")}</button></div>`;
    if (resting) tickRest();
  };
  const tickRest = () => { const left = Math.max(0, Math.round((resting - Date.now()) / 1000)); const r = $("#rt", ov); if (r) r.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; if (!left) { resting = null; clearInterval(restT); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} draw(); } };
  const readIn = () => { const a = parseFloat($("#fkg", ov)?.value), b = parseInt($("#frp", ov)?.value, 10); if (Number.isFinite(a)) kg = a; if (Number.isFinite(b)) reps = b; };
  ov.onclick = e => {
    const f = e.target.closest("[data-f]")?.dataset.f; if (!f) return;
    const {day} = state(), slot = day.exercises[idx];
    if (f === "close") return close();
    if (f === "prev" || f === "next") { idx += f === "next" ? 1 : -1; kg = reps = setN = null; resting = null; clearInterval(restT); return draw(); }
    if (f === "skip") { resting = null; clearInterval(restT); return draw(); }
    if (f === "add") { resting += 15000; return tickRest(); }
    readIn();
    if (f === "kg-") kg = Math.max(0, Math.round((kg - 2.5) * 2) / 2); if (f === "kg+") kg = Math.round((kg + 2.5) * 2) / 2;
    if (f === "r-") reps = Math.max(1, reps - 1); if (f === "r+") reps = reps + 1;
    if (f === "set") { setN = +e.target.closest("[data-s]").dataset.s; kg = reps = null; return draw(); }
    if (f === "log") {
      if (!(kg >= 0 && kg <= 500) || !(reps >= 1 && reps <= 200)) return toast("Check the weight and reps.", {error: true});
      const s = setN, saved = ctx.save(d => { d.training.logs = d.training.logs.filter(l => !(l.ex === slot.exId && l.d === t && l.s === s)); d.training.logs.push({d: t, ex: slot.exId, kg, reps, s, plan: planId}); });
      if (!saved) return;
      const done = isDone(saved.training.logs, slot, t);
      setN = null;
      if (s > 0 && done) { const next = day.exercises.findIndex((x, i) => i > idx && !isDone(saved.training.logs, x, t)); if (next >= 0) { idx = next; kg = reps = null; } }
      if (s > 0) { resting = Date.now() + restSeconds(slot.rest) * 1000; clearInterval(restT); restT = setInterval(tickRest, 500); }
      return draw();
    }
    const a = $("#fkg", ov), b = $("#frp", ov); if (a) a.value = kg; if (b) b.value = reps;
  };
  ov.onkeydown = e => { if (e.key === "Escape") close(); };
  draw();
  const h = $("h1", ov); if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); }
}

// =====================================================================
// Plans
// =====================================================================
function plansView(v, ctx) {
  const p = ctx.profile(), plans = Object.values(p.training.plans).sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
  v.innerHTML = `<div class="row" style="margin-bottom:12px"><h2 style="flex:1">Your workout plans</h2><button type="button" class="btn primary sm" data-a="new">${icon("plus", "sm")}New plan</button></div>
   ${plans.length ? `<div class="stack">${plans.map(pl => {
     const act = pl.id === p.training.activePlanId;
     return `<article class="card" data-plan="${pl.id}" style="${act ? "border-color:var(--brand-line)" : ""}">
      <div class="plan-card"><div class="main"><h3>${esc(pl.name)}${act ? `<span class="badge brand">Active</span>` : ""}</h3>
       <div class="muted" style="font-size:13px">${trainingDays(pl)} training days · ${pl.days.reduce((a, d) => a + (d.exercises || []).length, 0)} exercises${pl.goal ? " · " + esc(pl.goal) : ""}</div>
       <div class="faint" style="font-size:12px;margin-top:2px">Updated ${fmtDate(pl.updatedAt.slice(0, 10))}</div></div></div>
      <div class="row wrap-ok" style="gap:2px;margin-top:8px">${act ? `<button type="button" class="btn sm primary" data-a="open">${icon("play", "sm")}Go to workout</button>` : `<button type="button" class="btn sm primary" data-a="activate">Set active</button>`}<div class="spacer"></div>
       ${ibtn("square-pen", "Edit", 'data-a="edit"')}${ibtn("copy", "Duplicate", 'data-a="dup"')}${ibtn("pencil", "Rename", 'data-a="rename"')}${ibtn("trash-2", "Delete", 'data-a="del"', "danger")}</div>
      </article>`;
   }).join("")}</div>` : `<div class="card empty">${icon("list")}<h3>No plans yet</h3><p>Start from a ready-made program or build your own.</p></div>`}
   <h3 style="margin:22px 0 10px">Ready-made programs</h3><div class="grid2">${PROGRAM_TEMPLATES.map(t => `<article class="card"><div class="row" style="margin-bottom:6px"><h3 style="flex:1">${esc(t.name)}</h3><span class="badge">${t.level}</span></div>
    <p class="muted" style="font-size:14px">${esc(t.about)}</p><div class="row wrap-ok" style="margin:10px 0;gap:6px"><span class="pill">${icon("calendar")}${t.daysPerWeek} days / week</span><span class="pill">${icon("target")}${esc(t.goal)}</span></div>
    <button type="button" class="btn ghost sm block" data-tpl="${t.id}">${icon("plus", "sm")}Add to my plans</button></article>`).join("")}</div>`;
  v.onclick = async e => {
    const tb = e.target.closest("[data-tpl]");
    if (tb) { const t = PROGRAM_TEMPLATES.find(x => x.id === tb.dataset.tpl); return addPlan(ctx, planFromTemplate(t, ctx.uid, ctx.now())); }
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "new") return newPlanSheet(ctx);
    const id = e.target.closest("[data-plan]")?.dataset.plan, pl = id && ctx.profile().training.plans[id]; if (!pl) return;
    if (a === "activate") { ctx.save(d => { d.training.activePlanId = id; }, `${pl.name} is now your active plan`); return ctx.rerender(); }
    if (a === "open") return ctx.go("#/training/workout");
    if (a === "edit") { editingPlan = id; return ctx.rerender(); }
    if (a === "dup") { const c = duplicatePlan(pl, ctx.uid, ctx.now()); ctx.save(d => { d.training.plans[c.id] = c; }, "Plan duplicated"); return ctx.rerender(); }
    if (a === "rename") { const n = await promptDialog({title: "Rename plan", label: "Plan name", value: pl.name}); if (n) { ctx.save(d => { d.training.plans[id].name = n; d.training.plans[id].updatedAt = ctx.now(); }, "Plan renamed"); ctx.rerender(); } return; }
    if (a === "del") {
      if (!await confirmDialog({title: `Delete “${pl.name}”?`, message: "The plan is removed. Sets you already logged stay in your progress.", confirm: "Delete plan", danger: true})) return;
      ctx.save(d => { delete d.training.plans[id]; if (d.training.activePlanId === id) d.training.activePlanId = Object.keys(d.training.plans)[0] || null; }, "Plan deleted");
      return ctx.rerender();
    }
  };
}
function addPlan(ctx, plan, open = false) {
  const first = !ctx.profile().training.activePlanId;
  if (ctx.save(d => { d.training.plans[plan.id] = plan; if (first) d.training.activePlanId = plan.id; }, `“${plan.name}” added${first ? " and set as active" : ""}`)) { if (open) editingPlan = plan.id; ctx.rerender(); }
}
async function newPlanSheet(ctx) {
  const choice = await sheet({title: "New workout plan", render: (b, close) => {
    b.innerHTML = `<div class="opts"><button type="button" class="opt" data-c="">${icon("plus")}<span><b>Start empty</b><small>Name it, then add exercises from the library</small></span></button>
     ${PROGRAM_TEMPLATES.map(t => `<button type="button" class="opt" data-c="${t.id}">${icon("dumbbell")}<span><b>Copy “${esc(t.name)}”</b><small>${t.daysPerWeek} days · ${t.level} — then edit it</small></span></button>`).join("")}</div>`;
    b.onclick = e => { const o = e.target.closest("[data-c]"); if (o) close(o.dataset.c); };
  }});
  if (choice === undefined) return;
  if (choice === "") { const n = await promptDialog({title: "Name your plan", label: "Plan name", value: "My plan", confirm: "Create"}); if (n) addPlan(ctx, blankPlan(ctx.uid, ctx.now(), n), true); return; }
  addPlan(ctx, planFromTemplate(PROGRAM_TEMPLATES.find(t => t.id === choice), ctx.uid, ctx.now()), true);
}

// ---------- plan editor ----------
const REST_OPTS = ["30 s", "45 s", "60 s", "60–90 s", "90 s", "90–120 s", "2 min", "2–3 min", "3–5 min"];
function planEditor(v, ctx, planId) {
  const p = ctx.profile(), plan = p.training.plans[planId];
  const upd = (fn, msg) => ctx.save(d => { const pl = d.training.plans[planId]; if (!pl) return false; fn(pl); pl.updatedAt = ctx.now(); }, msg);
  v.innerHTML = `<div class="row" style="margin-bottom:12px">${ibtn("chevron-left", "Back to plans", 'data-a="back"')}<div style="flex:1;min-width:0"><div class="eyebrow">Editing</div><h2 style="overflow:hidden;text-overflow:ellipsis">${esc(plan.name)}</h2></div>
    ${ibtn("pencil", "Rename plan", 'data-a="rename"')}${plan.id !== p.training.activePlanId ? `<button type="button" class="btn sm primary" data-a="activate">Use plan</button>` : `<span class="badge brand">Active</span>`}</div>
   <section class="card stack" style="margin-bottom:12px"><div class="field"><label for="pgoal">Training goal</label><input class="input" id="pgoal" maxlength="60" value="${esc(plan.goal || "")}" placeholder="e.g. Strength & muscle"></div>
    <div class="field"><label for="pnotes">Notes</label><textarea class="input" id="pnotes" rows="2" maxlength="400" placeholder="Anything to remember about this plan">${esc(plan.notes || "")}</textarea></div></section>
   <div class="stack" id="days">${plan.days.map((d, di) => `<section class="card" data-day="${d.id}">
     <div class="card-h"><span class="badge">Day ${di + 1}</span><h3>${esc(d.name)}</h3>${ibtn("pencil", "Rename day", 'data-a="dname"', "sm")}${ibtn("arrow-up", "Move day up", `data-a="dup" ${di ? "" : "disabled"}`, "sm")}${ibtn("arrow-down", "Move day down", `data-a="ddown" ${di < plan.days.length - 1 ? "" : "disabled"}`, "sm")}${ibtn("trash-2", "Delete day", 'data-a="ddel"', "sm danger")}</div>
     ${(d.exercises || []).length ? `<div class="list">${d.exercises.map((x, xi) => `<div class="li" data-slot="${x.id}" style="flex-wrap:wrap">${thumb(x.exId)}
       <div class="main" style="min-width:150px"><div class="title">${esc(exName(x.exId))}</div><div class="sub">${esc(cap((EX[x.exId] || {primary: [""]}).primary[0]))} · ${esc(eqLabel((EX[x.exId] || {}).equipment))}</div></div>
       <div class="row" style="gap:0">${ibtn("arrow-up", "Move up", `data-a="up" ${xi ? "" : "disabled"}`, "sm")}${ibtn("arrow-down", "Move down", `data-a="down" ${xi < d.exercises.length - 1 ? "" : "disabled"}`, "sm")}${ibtn("arrow-left-right", "Replace", 'data-a="replace"', "sm")}${ibtn("trash-2", "Remove", 'data-a="rm"', "sm danger")}</div>
       <div class="row wrap-ok" style="width:100%;gap:8px;padding-left:64px">
        <div class="stepper" title="Sets"><button type="button" data-a="s-" aria-label="Fewer sets">${icon("minus", "sm")}</button><input aria-label="Sets" value="${x.sets}" data-f="sets" inputmode="numeric"><button type="button" data-a="s+" aria-label="More sets">${icon("plus", "sm")}</button></div>
        <label class="sr" for="r${x.id}">Reps</label><input class="input" id="r${x.id}" data-f="reps" value="${esc(x.reps)}" style="width:96px;min-height:42px" placeholder="Reps" title="Reps">
        <label class="sr" for="rs${x.id}">Rest</label><select class="input" id="rs${x.id}" data-f="rest" style="width:auto;min-height:42px" title="Rest">${[...new Set([x.rest, ...REST_OPTS])].map(o => `<option${o === x.rest ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>
        <label class="sr" for="w${x.id}">Target weight</label><div class="unit-in" style="width:110px" title="Target weight (optional)"><input id="w${x.id}" data-f="weight" type="number" inputmode="decimal" step="0.5" min="0" value="${x.weight ?? ""}" placeholder="Target" style="min-height:40px;padding:6px 8px"><span style="padding:0 8px">kg</span></div>
        <label class="sr" for="n${x.id}">Notes</label><input class="input" id="n${x.id}" data-f="notes" value="${esc(x.notes || "")}" style="flex:1;min-width:120px;min-height:42px" placeholder="Note (optional)" maxlength="80"></div></div>`).join("")}</div>`
       : `<p class="muted" style="font-size:14px;margin-bottom:8px">${esc(d.rest || "Rest day. Add exercises to make it a training day.")}</p>`}
     <button type="button" class="btn ghost sm block" data-a="add" style="margin-top:10px">${icon("plus", "sm")}Add exercise</button></section>`).join("")}</div>
   ${plan.days.length < 7 ? `<button type="button" class="btn ghost block" data-a="addday" style="margin-top:12px">${icon("calendar", "sm")}Add a day</button>` : ""}`;
  const dayOf = e => { const id = e.target.closest("[data-day]")?.dataset.day; return id; };
  v.onclick = async e => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    const did = dayOf(e), sid = e.target.closest("[data-slot]")?.dataset.slot;
    const findDay = pl => pl.days.find(d => d.id === did), findSlot = pl => (findDay(pl).exercises || []).find(x => x.id === sid);
    const move = (arr, i, j) => { if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
    if (a === "back") { editingPlan = null; return ctx.rerender(); }
    if (a === "activate") { ctx.save(d => { d.training.activePlanId = planId; }, "Active plan updated"); return ctx.rerender(); }
    if (a === "rename") { const n = await promptDialog({title: "Rename plan", label: "Plan name", value: plan.name}); if (n) { upd(pl => { pl.name = n; }, "Renamed"); ctx.rerender(); } return; }
    if (a === "dname") { const cur = plan.days.find(d => d.id === did); const n = await promptDialog({title: "Rename day", label: "Day name", value: cur.name, max: 30}); if (n) { upd(pl => { findDay(pl).name = n; }); ctx.rerender(); } return; }
    if (a === "dup" || a === "ddown") { upd(pl => { const i = pl.days.findIndex(d => d.id === did); move(pl.days, i, i + (a === "dup" ? -1 : 1)); }); return ctx.rerender(); }
    if (a === "ddel") { const cur = plan.days.find(d => d.id === did); if ((cur.exercises || []).length && !await confirmDialog({title: `Delete ${cur.name}?`, message: "The day and its exercises are removed from this plan.", confirm: "Delete day", danger: true})) return; upd(pl => { pl.days = pl.days.filter(d => d.id !== did); }); return ctx.rerender(); }
    if (a === "addday") { upd(pl => { pl.days.push({id: ctx.uid(), name: `Day ${pl.days.length + 1}`, rest: "", exercises: []}); }); return ctx.rerender(); }
    if (a === "add") { const exId = await pickExercise(ctx); if (exId) { upd(pl => { const r = recommend(EX[exId]); (findDay(pl).exercises ||= []).push({id: ctx.uid(), exId, ...r, notes: ""}); }, `${exName(exId)} added`); ctx.rerender(); } return; }
    if (!sid) return;
    if (a === "up" || a === "down") { upd(pl => { const arr = findDay(pl).exercises, i = arr.findIndex(x => x.id === sid); move(arr, i, i + (a === "up" ? -1 : 1)); }); return ctx.rerender(); }
    if (a === "rm") { const old = JSON.parse(JSON.stringify(findSlot(plan))), pos = findDay(plan).exercises.findIndex(x => x.id === sid);
      upd(pl => { const dd = findDay(pl); dd.exercises = dd.exercises.filter(x => x.id !== sid); });
      toast(`${exName(old.exId)} removed`, {action: {label: "Undo", run: () => { upd(pl => { findDay(pl).exercises.splice(pos, 0, old); }); ctx.rerender(); }}}); return ctx.rerender(); }
    if (a === "replace") return replaceExercise(ctx, planId, did, sid);
    if (a === "s-" || a === "s+") { const s = upd(pl => { const x = findSlot(pl); x.sets = Math.min(10, Math.max(1, x.sets + (a === "s+" ? 1 : -1))); }); if (s) $(`[data-slot="${sid}"] [data-f=sets]`, v).value = findSlot(s.training.plans[planId]).sets; }
  };
  v.onchange = e => {
    const f = e.target.dataset.f, did = dayOf(e), sid = e.target.closest("[data-slot]")?.dataset.slot;
    if (e.target.id === "pgoal" || e.target.id === "pnotes") { upd(pl => { pl[e.target.id === "pgoal" ? "goal" : "notes"] = e.target.value.trim(); }, "Saved"); return; }
    if (!f || !sid) return;
    upd(pl => { const x = pl.days.find(d => d.id === did).exercises.find(y => y.id === sid); let val = e.target.value.trim();
      if (f === "sets") { val = Math.min(10, Math.max(1, parseInt(val, 10) || x.sets)); e.target.value = val; }
      if (f === "reps" && !val) { val = x.reps; e.target.value = val; }
      if (f === "weight") { val = val === "" ? null : Math.max(0, Math.min(500, parseFloat(val))); if (!Number.isFinite(val)) val = null; e.target.value = val ?? ""; }
      x[f] = val; }, "Saved");
  };
}

// =====================================================================
// Exercise library, detail, picker
// =====================================================================
function filtersHTML(st) {
  const sel = (k, opts, label) => `<label class="sr" for="f-${k}">${label}</label><select class="input" id="f-${k}" data-filter="${k}" style="width:auto;min-height:38px;padding:6px 10px;font-size:14px">${opts.map(([v, l]) => `<option value="${v}"${st[k] === v ? " selected" : ""}>${l}</option>`).join("")}</select>`;
  return `<div class="input-wrap">${icon("search")}<input class="input" type="search" id="lq" placeholder="Search exercises or muscles" value="${esc(st.q)}" aria-label="Search exercises"></div>
   <div class="chips scroll" style="margin-top:10px" role="group" aria-label="Muscle group"><button type="button" class="chip" data-group="" aria-pressed="${!st.group}">All</button>${MUSCLE_GROUPS.map(g => `<button type="button" class="chip" data-group="${g.id}" aria-pressed="${st.group === g.id}">${g.label}</button>`).join("")}</div>
   <div class="row wrap-ok" style="margin-top:10px;gap:8px">${icon("sliders-horizontal", "sm")}
    ${sel("equipment", [["", "Any equipment"], ...EQUIPMENT.map(e => [e.id, e.label])], "Equipment")}
    ${sel("level", [["", "Any level"], ...LEVELS.map(e => [e.id, e.label])], "Difficulty")}
    ${sel("mechanic", [["", "Any type"], ["compound", "Compound"], ["isolation", "Isolation"]], "Exercise type")}
    ${sel("purpose", [["", "Any purpose"], ...PURPOSES.map(x => [x, x])], "Training purpose")}</div>`;
}
function exRow(e, extra = "") {
  return `<button type="button" class="food-li" data-ex="${e.id}">${thumb(e.id)}<div class="main"><div class="title">${esc(e.name)}</div>
   <div class="sub">${esc(cap(e.primary[0]))} · ${esc(eqLabel(e.equipment))} · ${levelLabel(e.level)}</div></div>${extra || icon("chevron-right", "sm")}</button>`;
}
function wireFilters(scope, st, redraw) {
  const q = $("#lq", scope);
  q.oninput = () => { st.q = q.value; redraw(); };
  scope.addEventListener("click", e => { const g = e.target.closest("[data-group]"); if (g) { st.group = g.dataset.group; $$("[data-group]", scope).forEach(b => b.setAttribute("aria-pressed", b === g)); redraw(); } });
  scope.addEventListener("change", e => { const f = e.target.dataset.filter; if (f) { st[f] = e.target.value; redraw(); } });
}
function libraryView(v, ctx) {
  v.innerHTML = `<section class="card" style="margin-bottom:12px">${filtersHTML(libState)}</section><div class="card"><div class="faint" id="lcount" style="font-size:13px;margin-bottom:4px"></div><div class="list" id="lres"></div></div>`;
  const redraw = () => {
    const res = searchExercises(EXERCISES, libState);
    $("#lcount", v).textContent = `${res.length} exercise${res.length === 1 ? "" : "s"}`;
    $("#lres", v).innerHTML = res.length ? res.map(e => exRow(e)).join("") : `<div class="empty">${icon("search")}<h3>No matches</h3><p>Try another search or clear a filter.</p></div>`;
  };
  wireFilters(v, libState, redraw); redraw();
  $("#lres", v).onclick = e => { const r = e.target.closest("[data-ex]"); if (r) exerciseSheet(ctx, r.dataset.ex); };
}
function exerciseDetailHTML(e) {
  const r = recommend(e);
  return `<div class="shots"><figure><img src="${img(e.id, 0)}" alt="${esc(e.name)}, start position" loading="lazy"><figcaption>Start</figcaption></figure><figure><img src="${img(e.id, 1)}" alt="${esc(e.name)}, finish position" loading="lazy"><figcaption>Finish</figcaption></figure></div>
   <div class="row wrap-ok" style="gap:6px;margin:12px 0"><span class="badge brand">${esc(PATTERN_LABELS[e.pattern])}</span><span class="badge">${cap(e.mechanic)}</span><span class="badge">${levelLabel(e.level)}</span><span class="badge">${esc(eqLabel(e.equipment))}</span><span class="badge">${purpose(e)}</span></div>
   <dl class="kv" style="margin-bottom:12px"><dt>Target muscles</dt><dd>${e.primary.map(cap).join(", ")}</dd>${e.secondary.length ? `<dt>Also works</dt><dd>${e.secondary.map(cap).join(", ")}</dd>` : ""}<dt>Suggested</dt><dd>${r.sets} × ${r.reps} · rest ${r.rest}</dd></dl>
   <h3 style="margin-bottom:8px">How to do it</h3><ol class="steps-list">${e.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;
}
async function exerciseSheet(ctx, exId) {
  const e = EX[exId]; if (!e) return toast("This exercise isn't in the library.", {error: true});
  const res = await sheet({title: e.name, wide: true, render: b => {
    const alts = exerciseAlternatives(e, EXERCISES);
    b.innerHTML = exerciseDetailHTML(e) + `<h3 style="margin:18px 0 6px">Alternatives</h3><div class="list">${alts.map(a => exRow(a.ex)).join("") || '<p class="muted">No close alternatives in the library.</p>'}</div>`;
    b.onclick = ev => { const r = ev.target.closest("[data-ex]"); if (r) { b.closest("dialog").dispatchEvent(new CustomEvent("swap", {detail: r.dataset.ex})); } };
  }, footer: (f, close, api) => {
    f.innerHTML = `<button type="button" class="btn primary" data-add>${icon("plus", "sm")}Add to a plan</button>`;
    f.onclick = ev => { if (ev.target.closest("[data-add]")) close("add"); };
    api.el.addEventListener("swap", ev => close({swap: ev.detail}));
  }});
  if (res && res.swap) return exerciseSheet(ctx, res.swap);
  if (res === "add") return addToPlanSheet(ctx, exId);
}
async function addToPlanSheet(ctx, exId) {
  const p = ctx.profile(), plans = Object.values(p.training.plans);
  if (!plans.length) { toast("Create a workout plan first.", {error: true}); return ctx.go("#/training/plans"); }
  const pick = await sheet({title: `Add ${exName(exId)}`, render: (b, close) => {
    b.innerHTML = plans.map(pl => `<h4 style="margin:10px 0 6px">${esc(pl.name)}${pl.id === p.training.activePlanId ? ' <span class="badge brand">Active</span>' : ""}</h4><div class="opts">${pl.days.map((d, i) => `<button type="button" class="opt" data-p="${pl.id}" data-d="${d.id}">${icon("calendar")}<span><b>Day ${i + 1} · ${esc(d.name)}</b><small>${(d.exercises || []).length} exercises</small></span></button>`).join("")}</div>`).join("");
    b.onclick = e => { const o = e.target.closest("[data-p]"); if (o) close({p: o.dataset.p, d: o.dataset.d}); };
  }});
  if (!pick) return;
  ctx.save(d => { const pl = d.training.plans[pick.p], day = pl && pl.days.find(x => x.id === pick.d); if (!day) return false; (day.exercises ||= []).push({id: ctx.uid(), exId, ...recommend(EX[exId]), notes: ""}); pl.updatedAt = ctx.now(); }, `${exName(exId)} added to the plan`);
}
function pickExercise(ctx) {
  const st = {q: "", group: "", equipment: "", level: "", mechanic: "", purpose: ""};
  return sheet({title: "Add exercise", wide: true, render: (b, close) => {
    b.innerHTML = filtersHTML(st) + `<div class="list" id="pres" style="margin-top:10px"></div>`;
    const redraw = () => { const r = searchExercises(EXERCISES, st).slice(0, 80); $("#pres", b).innerHTML = r.map(e => exRow(e, `<span class="ibtn filled sm" aria-hidden="true">${icon("plus", "sm")}</span>`)).join("") || `<div class="empty">${icon("search")}<p>No matches.</p></div>`; };
    wireFilters(b, st, redraw); redraw();
    $("#pres", b).onclick = e => { const r = e.target.closest("[data-ex]"); if (r) close(r.dataset.ex); };
    setTimeout(() => $("#lq", b).focus(), 50);
  }});
}

// ---------- replace exercise ----------
async function replaceExercise(ctx, planId, dayId, slotId) {
  const plan = ctx.profile().training.plans[planId], day = plan.days.find(d => d.id === dayId), slot = day.exercises.find(x => x.id === slotId), cur = EX[slot.exId];
  if (!cur) return toast("This exercise isn't in the library, so alternatives can't be matched.", {error: true});
  let eq = [];
  const chosen = await sheet({title: "Replace exercise", wide: true, render: (b, close) => {
    const draw = () => {
      const alts = exerciseAlternatives(cur, EXERCISES, {equipment: eq});
      const anyClose = alts.some(a => a.close);
      b.innerHTML = `<div class="li" style="border:0;padding-top:0">${thumb(cur.id)}<div class="main"><div class="eyebrow">Replacing</div><div class="title">${esc(cur.name)}</div><div class="sub">${esc(PATTERN_LABELS[cur.pattern])} · ${cur.primary.map(cap).join(", ")} · ${esc(eqLabel(cur.equipment))}</div></div></div>
       <div class="field" style="margin:6px 0 14px"><span class="label">Equipment you have</span><div class="chips"><button type="button" class="chip" data-eq="" aria-pressed="${!eq.length}">Any</button>${EQUIPMENT.filter(x => x.id !== "other" && x.id !== "kettlebells").map(x => `<button type="button" class="chip" data-eq="${x.id}" aria-pressed="${eq.includes(x.id)}">${x.label}</button>`).join("")}</div></div>
       ${alts.length && !anyClose ? `<p class="badge warn" style="white-space:normal;margin-bottom:10px">${icon("info", "sm")} No exact equivalent with this equipment. These are the closest options.</p>` : ""}
       <div class="stack">${alts.length ? alts.map(a => `<article class="alt"><div class="alt-h">${thumb(a.ex.id)}<div style="flex:1;min-width:0"><h3>${esc(a.ex.name)}</h3><div class="sub muted" style="font-size:13px">${esc(eqLabel(a.ex.equipment))} · ${levelLabel(a.ex.level)} · ${cap(a.ex.mechanic)}</div></div>${a.close ? '<span class="badge ok">Close match</span>' : '<span class="badge warn">Closest option</span>'}</div>
          <dl class="kv"><dt>Targets</dt><dd>${a.ex.primary.map(cap).join(", ")}</dd>${a.ex.secondary.length ? `<dt>Also works</dt><dd>${a.ex.secondary.slice(0, 4).map(cap).join(", ")}</dd>` : ""}<dt>Your sets</dt><dd>${slot.sets} × ${esc(slot.reps)} · rest ${esc(slot.rest)}</dd></dl>
          <p class="muted" style="font-size:13.5px">${icon("info", "sm")} ${esc(cap(a.why))}.</p>
          <div class="row"><button type="button" class="btn ghost sm" data-view="${a.ex.id}">${icon("image", "sm")}View</button><button type="button" class="btn primary sm" style="flex:1" data-pick="${a.ex.id}">${icon("check", "sm")}Use this exercise</button></div></article>`).join("")
        : `<div class="empty">${icon("search")}<h3>No suitable alternative</h3><p>Nothing in the library does the same job with this equipment. Try “Any”.</p></div>`}</div>`;
    };
    b.onclick = e => {
      const q = e.target.closest("[data-eq]"); if (q) { const id = q.dataset.eq; eq = !id ? [] : eq.includes(id) ? eq.filter(x => x !== id) : eq.concat(id); return draw(); }
      const pk = e.target.closest("[data-pick]"); if (pk) return close(pk.dataset.pick);
      const vw = e.target.closest("[data-view]"); if (vw) { const ex = EX[vw.dataset.view]; sheet({title: ex.name, wide: true, render: bb => { bb.innerHTML = exerciseDetailHTML(ex); }}); }
    };
    draw();
  }});
  if (!chosen) return;
  const oldId = slot.exId;
  // Only this slot changes; sets, reps, rest and notes are kept so the workout's volume stays the same.
  const ok = ctx.save(d => { const s = d.training.plans[planId]?.days.find(x => x.id === dayId)?.exercises.find(x => x.id === slotId); if (!s) return false; s.exId = chosen; d.training.plans[planId].updatedAt = ctx.now(); });
  if (!ok) return;
  ctx.rerender();
  toast(`Replaced with ${exName(chosen)}`, {action: {label: "Undo", run: () => { ctx.save(d => { const s = d.training.plans[planId]?.days.find(x => x.id === dayId)?.exercises.find(x => x.id === slotId); if (s) s.exId = oldId; }); ctx.rerender(); }}});
}

// =====================================================================
// Progress
// =====================================================================
let proEx = null;
function progressView(v, ctx) {
  const p = ctx.profile(), w = [...p.weights].sort((a, b) => a.d < b.d ? -1 : 1), last = w[w.length - 1], first = w[0], t = today();
  const tw = w.find(x => x.d === t);
  const chg = (a, b) => { const d = Math.round((a - b) * 10) / 10; return (d > 0 ? "+" : d < 0 ? "−" : "±") + fmt(Math.abs(d), 1) + " kg"; };
  const ago = n => { if (!last) return null; const c = new Date(last.d + "T00:00"); c.setDate(c.getDate() - n); const k = iso(c); return [...w].reverse().find(e => e.d <= k); };
  const wk = ago(7);
  const W = p.training.logs.filter(l => l.s !== 0), names = [...new Set(W.map(l => l.ex))];
  if (!proEx || !names.includes(proEx)) proEx = W.length ? W[W.length - 1].ex : null;
  const days = new Set(W.map(l => l.d)), since = iso(new Date(Date.now() - 27 * 864e5));
  v.innerHTML = `<section class="card"><div class="card-h"><span class="cat-ico">${icon("scale")}</span><h2>Body weight</h2></div>
    <form class="row" id="wf"><div class="unit-in" style="flex:1;max-width:220px"><input id="wkg" type="number" inputmode="decimal" step="0.1" min="30" max="300" placeholder="${last ? fmt(last.kg, 1) : "Today's weight"}" value="${tw ? tw.kg : ""}" aria-label="Today's weight in kg"><span>kg</span></div>
     <button type="submit" class="btn primary">${icon("save", "sm")}${tw ? "Update today" : "Save today"}</button></form>
    <p class="faint" style="font-size:13px;margin-top:6px">${tw ? `Saved ${fmt(tw.kg, 1)} kg for today.` : "Weigh yourself in the morning, before eating, for consistent numbers."}</p>
    ${last ? `<div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:14px">
      ${stat("Current", fmt(last.kg, 1) + " kg", fmtDate(last.d))}${stat("Since start", chg(last.kg, first.kg), "from " + fmt(first.kg, 1) + " kg")}
      ${stat("Last 7 days", wk && wk !== last ? chg(last.kg, wk.kg) : "—", wk && wk !== last ? "vs " + fmtDate(wk.d) : "needs a week of entries")}
      ${stat("To goal", p.targetWeightKg ? fmt(Math.abs(p.targetWeightKg - last.kg), 1) + " kg" : "—", p.targetWeightKg ? "goal " + fmt(p.targetWeightKg, 1) + " kg" : "set one in your profile")}</div>
     <div id="wchart" style="margin-top:14px"></div>
     <details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:14px">All weigh-ins (${w.length})</summary><table class="t" style="margin-top:8px"><thead><tr><th>Date</th><th class="n">Weight</th><th class="n">Change</th><th></th></tr></thead><tbody>
      ${[...w].reverse().map((e, i, a) => `<tr><td>${fmtDate(e.d)}</td><td class="n">${fmt(e.kg, 1)} kg</td><td class="n">${a[i + 1] ? chg(e.kg, a[i + 1].kg) : ""}</td><td class="n">${ibtn("trash-2", "Delete " + fmtDate(e.d), `data-wdel="${e.d}"`, "sm danger")}</td></tr>`).join("")}</tbody></table></details>` : ""}
   </section>
   <section class="card" style="margin-top:12px"><div class="card-h"><span class="cat-ico">${icon("trending-up")}</span><h2>Strength</h2></div>
    ${names.length ? `<div class="grid2" style="grid-template-columns:repeat(3,1fr)">${stat("Workouts", days.size, "days logged")}${stat("Last 4 weeks", [...days].filter(d => d >= since).length, "workouts")}${stat("Exercises", names.length, "tracked")}</div>
     <table class="t" style="margin-top:12px"><thead><tr><th>Exercise</th><th class="n">First</th><th class="n">Best</th><th class="n">Change</th></tr></thead><tbody>
     ${names.map(n => { const ts = topSets(W, n), f = ts[0], best = ts.reduce((m, x) => !m || x.kg > m.kg || (x.kg === m.kg && x.reps > m.reps) ? x : m, null), d = Math.round((best.kg - f.kg) * 10) / 10;
       return `<tr data-pex="${esc(n)}" style="cursor:pointer;${n === proEx ? "background:var(--brand-soft)" : ""}"><td><button type="button" style="all:unset;cursor:pointer;font-weight:600">${esc(exName(n))}</button><div class="faint" style="font-size:12px">${ts.length} session${ts.length > 1 ? "s" : ""}</div></td><td class="n">${fmt(f.kg, 1)}×${f.reps}</td><td class="n">${fmt(best.kg, 1)}×${best.reps}</td><td class="n" style="${d > 0 ? "color:var(--brand);font-weight:700" : ""}">${d > 0 ? "+" + fmt(d, 1) + " kg" : d < 0 ? "−" + fmt(-d, 1) + " kg" : "—"}</td></tr>`; }).join("")}</tbody></table>
     <h3 style="margin:16px 0 2px">${esc(exName(proEx))}</h3><p class="faint" style="font-size:13px">Heaviest working set per workout. Tap a row above to switch.</p><div id="lchart" style="margin-top:6px"></div>
     <details style="margin-top:10px"><summary class="muted" style="cursor:pointer;font-size:14px">All sets for this exercise</summary><table class="t" style="margin-top:8px"><thead><tr><th>Date</th><th>Set</th><th class="n">kg</th><th class="n">Reps</th><th></th></tr></thead><tbody>
      ${p.training.logs.map((l, i) => ({l, i})).filter(x => x.l.ex === proEx).sort((a, b) => a.l.d < b.l.d ? 1 : a.l.d > b.l.d ? -1 : (a.l.s ?? 9) - (b.l.s ?? 9)).map(({l, i}) => `<tr><td>${fmtDate(l.d)}</td><td>${l.s === 0 ? "Warm-up" : l.s ? "Set " + l.s : ""}</td><td class="n">${fmt(l.kg, 1)}</td><td class="n">${l.reps}</td><td class="n">${ibtn("trash-2", "Delete set", `data-ldel="${i}"`, "sm danger")}</td></tr>`).join("")}</tbody></table></details>`
     : `<div class="empty">${icon("dumbbell")}<h3>No sets logged yet</h3><p>Log your sets during a workout and your strength progress shows up here.</p></div>`}
   </section>`;
  const draw = () => {
    if (last) lineChart($("#wchart", v), w.map(e => ({d: e.d, v: e.kg})), {goal: p.targetWeightKg});
    if (proEx) lineChart($("#lchart", v), topSets(W, proEx).map(e => ({d: e.d, v: e.kg, tip: `${fmt(e.kg, 1)} kg × ${e.reps}`})));
  };
  requestAnimationFrame(draw);
  $("#wf", v).onsubmit = e => {
    e.preventDefault(); const kg = parseFloat($("#wkg", v).value);
    if (!(kg >= 30 && kg <= 300)) return toast("Enter a weight between 30 and 300 kg.", {error: true});
    if (ctx.save(d => { d.weights = d.weights.filter(x => x.d !== t).concat({d: t, kg}); d.weightKg = kg; }, "Weight saved. Your nutrition targets were updated.")) ctx.rerender();
  };
  v.onclick = async e => {
    const r = e.target.closest("[data-pex]"); if (r) { proEx = r.dataset.pex; return ctx.rerender(); }
    const wd = e.target.closest("[data-wdel]");
    if (wd && await confirmDialog({title: "Delete weigh-in?", message: `Remove the entry for ${fmtDate(wd.dataset.wdel)}.`, confirm: "Delete", danger: true})) { ctx.save(d => { d.weights = d.weights.filter(x => x.d !== wd.dataset.wdel); }); return ctx.rerender(); }
    const ld = e.target.closest("[data-ldel]");
    if (ld) { const i = +ld.dataset.ldel, l = p.training.logs[i]; ctx.save(d => { const k = d.training.logs.findIndex(x => x.d === l.d && x.ex === l.ex && x.s === l.s && x.kg === l.kg && x.reps === l.reps); if (k >= 0) d.training.logs.splice(k, 1); }); ctx.rerender(); }
  };
}
const stat = (label, val, sub) => `<div class="card flat tight"><div class="eyebrow">${label}</div><div style="font:700 22px var(--f-head);margin-top:2px">${val}</div><div class="faint" style="font-size:12px">${sub}</div></div>`;
