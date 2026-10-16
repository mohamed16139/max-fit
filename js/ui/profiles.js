// Profile selection, onboarding (create / edit) and the Profile page.
import {$, $$, esc, icon, ibtn, avatar, toast, confirmDialog, guard, fmt, fmtDateLong, applyTheme, today} from "./dom.js";
import {ACTIVITY, GOALS, LIMITS, DIETS, ALLERGENS, targets, validateBody} from "../core/nutrition.js";
import {DuplicateProfileError, normName} from "../core/store.js";
import {ensureStarterPlans} from "../core/starter.js";
import {PROGRAM_TEMPLATES} from "../data/programs.js";
import {FOODS} from "../data/foods.js";

const goalLabel = id => (GOALS.find(g => g.id === id) || {}).label || "";

// ---------- profile picker ----------
export function renderProfiles(el, {store, go}) {
  const list = store.profiles(), active = store.activeId();
  el.innerHTML = `<div class="wrap" style="max-width:560px">
   <header class="hero"><div class="brandmark">${icon("dumbbell")}Manga Fit</div><h1>${list.length ? "Who's training?" : "Welcome"}</h1>
    <p class="muted" style="margin-top:8px">${list.length ? "Pick your profile to continue. Each profile keeps its own plans and progress." : "Create a profile to get your personal training and nutrition plan."}</p></header>
   <div class="stack" id="plist">${list.map(p => {
     const isA = p.id === active, t = targets(p), wp = p.training.plans[p.training.activePlanId];
     return `<div class="pcard${isA ? " active" : ""}">${avatar(p)}<div class="main">
       <div class="row" style="gap:8px"><h3>${esc(p.name)}</h3>${isA ? `<span class="badge brand">${icon("history", "sm")}Last used</span>` : ""}</div>
       <div class="muted" style="font-size:13px">${p.age != null ? `${p.age} yrs` : "Details needed"}${p.goal && p.age != null ? " · " + goalLabel(p.goal) : ""}${t ? ` · ${fmt(t.kcal)} kcal` : ""}${wp ? " · " + esc(wp.name) : ""}</div></div>
       <button type="button" class="btn ${isA ? "primary" : "ghost"} sm" data-open="${p.id}" aria-label="Continue as ${esc(p.name)}">${isA ? "Continue" : "Open"}${icon("chevron-right", "sm")}</button></div>`;
   }).join("")}</div>
   <button type="button" class="btn ${list.length ? "ghost" : "primary"} block lg" id="addP" style="margin-top:14px">${icon("user-plus")}${list.length ? "Add another profile" : "Create my profile"}</button>
   <p class="faint" style="font-size:12.5px;margin-top:18px;text-align:center">${icon("info", "sm")} Profiles are stored on this device only. They are not password-protected.</p>
  </div>`;
  $("#plist", el).onclick = e => {
    const b = e.target.closest("[data-open]"); if (!b) return;
    if (guard(() => { store.setActive(b.dataset.open); return true; })) go("#/training/workout");
  };
  $("#addP", el).onclick = () => go("#/new");
}

// ---------- onboarding ----------
const STEPS = [
  {id: "you", title: "About you", icon: "user"},
  {id: "body", title: "Your body", icon: "scale"},
  {id: "activity", title: "Activity", icon: "activity"},
  {id: "goal", title: "Your goal", icon: "target"},
  {id: "meals", title: "Meals", icon: "utensils"},
  {id: "food", title: "Food preferences", icon: "apple", optional: true},
  {id: "train", title: "Training plan", icon: "dumbbell", createOnly: true},
];

export function renderOnboarding(el, {store, uid, go, mode, pid}) {
  const editing = mode === "edit";
  const src = editing ? store.profile(pid) : null;
  const steps = STEPS.filter(s => !(editing && s.createOnly));
  const d = src ? JSON.parse(JSON.stringify(src)) : {name: "", age: "", sex: "male", heightCm: "", weightKg: "", targetWeightKg: "", activity: "moderate", goal: "maintain",
    mealsPerDay: 4, mealTimes: [], diet: "none", allergies: [], dislikes: [], preferred: []};
  let tpl = "fullbody";
  let i = editing && (src.age == null || !src.heightCm || !src.weightKg) ? 0 : 0;

  const draw = () => {
    const s = steps[i];
    el.innerHTML = `<div class="wrap" style="max-width:560px;padding-top:calc(var(--safe-t) + 16px)">
     <div class="row" style="margin-bottom:12px">${ibtn("chevron-left", i ? "Back" : "Cancel", 'id="back"')}<div class="spacer"></div>
      <span class="faint" style="font-size:13px">Step ${i + 1} of ${steps.length}${s.optional ? " · optional" : ""}</span></div>
     <div class="steps" aria-hidden="true">${steps.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
     <div class="row" style="margin:22px 0 6px;gap:12px"><span class="cat-ico" style="background:var(--brand-soft);color:var(--brand)">${icon(s.icon)}</span><h1>${s.title}</h1></div>
     <form id="obf" class="stack" style="margin-top:14px" novalidate>${body(s.id)}<div class="err-msg" id="oberr" role="alert"></div></form>
     <div class="row" style="margin:20px 0 32px;gap:10px">
      ${s.optional ? '<button type="button" class="btn ghost" id="skip">Skip</button>' : ""}
      <button type="submit" form="obf" class="btn primary lg" style="flex:1">${i === steps.length - 1 ? (editing ? icon("save") + "Save changes" : icon("check") + "Create profile") : "Continue" + icon("chevron-right")}</button></div>
     ${editing ? `<p class="faint" style="font-size:13px;text-align:center;margin-bottom:24px">Changes are saved when you finish. ${src.age == null ? "" : '<a href="#/me" style="color:var(--ink-2)">Discard</a>'}</p>` : ""}
    </div>`;
    wire(s.id);
    $("#back", el).onclick = () => { if (i) { read(s.id); i--; draw(); } else go(editing ? "#/me" : "#/profiles"); };
    $("#obf", el).onsubmit = e => { e.preventDefault(); read(s.id); const err = check(s.id); if (err) { $("#oberr", el).textContent = err; return; } next(); };
    const sk = $("#skip", el); if (sk) sk.onclick = () => next();
    const f = $("input,select", $("#obf", el)); if (f && !editing) f.focus();
  };
  const next = () => { if (i < steps.length - 1) { i++; draw(); } else finish(); };

  const opt = (name, value, cur, title, hint, ic) => `<button type="button" class="opt" data-k="${name}" data-v="${value}" aria-pressed="${String(cur) === String(value)}">${icon(ic || "circle")}<span><b>${title}</b>${hint ? `<small>${hint}</small>` : ""}</span></button>`;
  const num = (id, label, val, unit, attrs, hint = "") => `<div class="field"><label for="${id}">${label}</label><div class="unit-in"><input id="${id}" type="number" inputmode="decimal" value="${esc(val ?? "")}" ${attrs}><span>${unit}</span></div>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  function body(id) {
    if (id === "you") return `<div class="field"><label for="nm">Name</label><input class="input" id="nm" autocomplete="given-name" maxlength="40" value="${esc(d.name)}" placeholder="Your name"></div>
      ${num("ag", "Age", d.age, "years", `min="${LIMITS.age[0]}" max="${LIMITS.age[1]}" inputmode="numeric"`)}
      <div class="field"><span class="label">Sex</span><span class="hint">Used by the calorie formula (Mifflin–St Jeor).</span><div class="grid2" style="grid-template-columns:1fr 1fr">${opt("sex", "male", d.sex, "Male")}${opt("sex", "female", d.sex, "Female")}</div></div>`;
    if (id === "body") return `${num("hc", "Height", d.heightCm, "cm", `min="${LIMITS.heightCm[0]}" max="${LIMITS.heightCm[1]}"`)}
      ${num("wk", "Current weight", d.weightKg, "kg", `min="${LIMITS.weightKg[0]}" max="${LIMITS.weightKg[1]}" step="0.1"`)}
      ${num("tw", "Target weight (optional)", d.targetWeightKg, "kg", `min="${LIMITS.weightKg[0]}" max="${LIMITS.weightKg[1]}" step="0.1"`, "Shown on your progress chart.")}`;
    if (id === "activity") return `<div class="opts">${ACTIVITY.map(a => opt("activity", a.id, d.activity, a.label, a.hint, "activity")).join("")}</div>`;
    if (id === "goal") {
      const t = targets({...d, age: +d.age, heightCm: +d.heightCm, weightKg: +d.weightKg});
      return `<div class="opts">${GOALS.map(g => opt("goal", g.id, d.goal, g.label, g.hint, {lose: "flame", maintain: "scale", gain: "dumbbell"}[g.id])).join("")}</div>
      ${t ? `<div class="card flat" id="tprev"><div class="eyebrow">Your estimated daily target</div><div class="row" style="margin-top:6px;align-items:baseline"><b style="font:700 36px var(--f-head)">${fmt(t.kcal)}</b><span class="muted">kcal</span></div>
       <div class="muted" style="font-size:14px">Protein ${t.p} g · Carbs ${t.c} g · Fat ${t.f} g</div>
       <p class="faint" style="font-size:12.5px;margin-top:8px">${icon("info", "sm")} An estimate from the Mifflin–St Jeor formula. Individual needs vary, so adjust after 2–3 weeks based on your progress.</p></div>` : ""}`;
    }
    if (id === "meals") return `<div class="field"><span class="label">Meals per day</span><div class="chips" id="mpd">${[2, 3, 4, 5, 6].map(n => `<button type="button" class="chip" data-mpd="${n}" aria-pressed="${+d.mealsPerDay === n}">${n} meals</button>`).join("")}</div></div>
      <div class="field"><span class="label">Meal times (optional)</span><span class="hint">Shown next to each meal in your plan.</span><div class="grid2" id="mtimes" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">${mealTimesHTML()}</div></div>`;
    if (id === "food") {
      const pick = ["chicken_breast_c", "beef_95_c", "salmon_c", "tuna_can", "egg", "greek_0", "cottage", "whey", "tofu", "lentils_c", "rice_white_c", "rice_brown_c", "pasta_c", "oats_d", "potato_boiled", "sweet_potato_c", "bread_ww", "quinoa_c", "banana", "apple", "dates_medjool", "olive_oil", "avocado", "almonds", "peanut_butter", "tahini"];
      const fname = id => (FOODS.find(f => f.id === id) || {}).name || id;
      return `<div class="field"><span class="label">Diet</span><div class="chips">${DIETS.map(x => `<button type="button" class="chip" data-k="diet" data-v="${x.id}" aria-pressed="${d.diet === x.id}">${x.label}</button>`).join("")}</div></div>
      <div class="field"><span class="label">Allergies and intolerances</span><span class="hint">Foods containing these are never suggested.</span><div class="chips">${ALLERGENS.map(a => `<button type="button" class="chip" data-multi="allergies" data-v="${a.id}" aria-pressed="${d.allergies.includes(a.id)}">${a.label}</button>`).join("")}</div></div>
      <div class="field"><span class="label">Foods you like</span><span class="hint">Your plan is built from these.</span><div class="chips">${pick.map(f => `<button type="button" class="chip" data-multi="preferred" data-v="${f}" aria-pressed="${d.preferred.includes(f)}">${esc(fname(f))}</button>`).join("")}</div></div>
      <div class="field"><span class="label">Foods you dislike</span><div class="chips">${pick.map(f => `<button type="button" class="chip" data-multi="dislikes" data-v="${f}" aria-pressed="${d.dislikes.includes(f)}">${esc(fname(f))}</button>`).join("")}</div></div>`;
    }
    if (id === "train") return `<p class="muted">Pick a starting plan. You can edit every exercise, or build your own, later.</p><div class="opts">${PROGRAM_TEMPLATES.map(p => `<button type="button" class="opt" data-tpl="${p.id}" aria-pressed="${tpl === p.id}">${icon("dumbbell")}<span><b>${esc(p.name)}</b><small>${p.daysPerWeek} days a week · ${p.level} · ${esc(p.goal)}</small></span></button>`).join("")}
      <button type="button" class="opt" data-tpl="" aria-pressed="${tpl === ""}">${icon("plus")}<span><b>Start empty</b><small>Build a plan yourself from the exercise library</small></span></button></div>`;
    return "";
  }
  function mealTimesHTML() {
    const n = +d.mealsPerDay || 4;
    return Array.from({length: n}, (_, k) => `<div class="field"><label for="mt${k}" style="font-weight:500;font-size:13px;color:var(--ink-2)">Meal ${k + 1}</label><input class="input" type="time" id="mt${k}" value="${esc(d.mealTimes[k] || "")}"></div>`).join("");
  }
  function wire(id) {
    const f = $("#obf", el);
    f.onclick = e => {
      const o = e.target.closest("[data-k]");
      if (o) { d[o.dataset.k] = o.dataset.v; $$(`[data-k="${o.dataset.k}"]`, f).forEach(b => b.setAttribute("aria-pressed", b === o)); if (id === "goal") draw(); return; }
      const m = e.target.closest("[data-multi]");
      if (m) { const k = m.dataset.multi, v = m.dataset.v, arr = d[k]; const on = !arr.includes(v); d[k] = on ? arr.concat(v) : arr.filter(x => x !== v);
        m.setAttribute("aria-pressed", on);
        if (on && (k === "preferred" || k === "dislikes")) { const other = k === "preferred" ? "dislikes" : "preferred"; d[other] = d[other].filter(x => x !== v); const ob = $(`[data-multi="${other}"][data-v="${v}"]`, f); if (ob) ob.setAttribute("aria-pressed", "false"); }
        return; }
      const mp = e.target.closest("[data-mpd]");
      if (mp) { readTimes(); d.mealsPerDay = +mp.dataset.mpd; $$("[data-mpd]", f).forEach(b => b.setAttribute("aria-pressed", b === mp)); $("#mtimes", f).innerHTML = mealTimesHTML(); return; }
      const t = e.target.closest("[data-tpl]");
      if (t) { tpl = t.dataset.tpl; $$("[data-tpl]", f).forEach(b => b.setAttribute("aria-pressed", b === t)); }
    };
  }
  function readTimes() { const ts = $$("#mtimes input", el).map(x => x.value); if (ts.length) d.mealTimes = ts; }
  function read(id) {
    const v = s => { const x = $(s, el); return x ? x.value.trim() : undefined; };
    if (id === "you") { d.name = v("#nm"); d.age = v("#ag"); }
    if (id === "body") { d.heightCm = v("#hc"); d.weightKg = v("#wk"); d.targetWeightKg = v("#tw"); }
    if (id === "meals") readTimes();
  }
  function check(id) {
    const inR = (x, [lo, hi]) => x !== "" && Number.isFinite(+x) && +x >= lo && +x <= hi;
    if (id === "you") {
      if (!normName(d.name)) return "Enter your name.";
      if (!inR(d.age, LIMITS.age) || !Number.isInteger(+d.age)) return `Enter an age between ${LIMITS.age[0]} and ${LIMITS.age[1]}.`;
      if (store.isDuplicate(d.name, +d.age, editing ? pid : undefined)) return `A profile named “${d.name.trim()}” aged ${+d.age} already exists. Open it from the profile list, or use a different name.`;
    }
    if (id === "body") {
      if (!inR(d.heightCm, LIMITS.heightCm)) return `Enter a height between ${LIMITS.heightCm[0]} and ${LIMITS.heightCm[1]} cm.`;
      if (!inR(d.weightKg, LIMITS.weightKg)) return `Enter a weight between ${LIMITS.weightKg[0]} and ${LIMITS.weightKg[1]} kg.`;
      if (d.targetWeightKg && !inR(d.targetWeightKg, LIMITS.weightKg)) return "Enter a realistic target weight, or leave it empty.";
    }
    return "";
  }
  function finish() {
    const fields = {name: d.name, age: +d.age, sex: d.sex, heightCm: +d.heightCm, weightKg: +d.weightKg, targetWeightKg: d.targetWeightKg ? +d.targetWeightKg : null,
      activity: d.activity, goal: d.goal, mealsPerDay: +d.mealsPerDay, mealTimes: d.mealTimes.slice(0, +d.mealsPerDay), diet: d.diet,
      allergies: d.allergies, dislikes: d.dislikes, preferred: d.preferred};
    if (validateBody(fields).length) { $("#oberr", el).textContent = "Some details are missing. Go back and check your age, height and weight."; return; }
    try {
      if (editing) {
        const before = store.profile(pid);
        store.updateProfile(pid, p => {
          Object.assign(p, fields);
          if (!before.weights.length || before.weightKg !== fields.weightKg) { const day = today(); p.weights = p.weights.filter(w => w.d !== day).concat({d: day, kg: fields.weightKg}); }
        });
        ensureStarterPlans(store, pid, uid);
        toast("Profile saved. Your targets were recalculated.");
        go(before.age == null ? "#/training/workout" : "#/me");
      } else {
        const p = store.createProfile(fields);
        store.updateProfile(p.id, x => { x.weights = [{d: today(), kg: fields.weightKg}]; });
        ensureStarterPlans(store, p.id, uid, tpl || null);
        toast(`Welcome, ${p.name}! Your plans are ready.`);
        go("#/nutrition/today");
      }
    } catch (e) {
      if (e instanceof DuplicateProfileError) { i = 0; draw(); $("#oberr", el).textContent = e.message; return; }
      $("#oberr", el).textContent = e.message || "Couldn't save.";
    }
  }
  draw();
}

// ---------- Profile page ----------
export function renderMe(el, ctx) {
  const p = ctx.profile(), t = targets(p), act = ACTIVITY.find(a => a.id === p.activity);
  const others = ctx.store.profiles().filter(x => x.id !== p.id);
  const theme = (() => { try { return localStorage.getItem("theme") || "dark"; } catch (e) { return "dark"; } })();
  el.innerHTML = `<header class="topbar"><div class="wrap"><h1>Profile</h1>${ibtn("square-pen", "Edit profile", 'data-a="edit"')}</div></header>
  <div class="wrap stack" style="margin-top:14px">
   <section class="card"><div class="row" style="gap:14px">${avatar(p, "xl")}<div style="flex:1;min-width:0"><h2>${esc(p.name)}</h2>
     <div class="muted" style="font-size:14px">${p.age} yrs · ${p.sex === "female" ? "Female" : "Male"} · ${p.heightCm} cm · ${fmt(p.weightKg, 1)} kg</div></div></div>
    <div class="divider"></div>
    <dl class="kv"><dt>Goal</dt><dd>${goalLabel(p.goal)}</dd><dt>Activity</dt><dd>${act ? act.label : ""}</dd><dt>Meals per day</dt><dd>${p.mealsPerDay}</dd>
     ${p.targetWeightKg ? `<dt>Target weight</dt><dd>${fmt(p.targetWeightKg, 1)} kg</dd>` : ""}
     <dt>Diet</dt><dd>${(DIETS.find(x => x.id === p.diet) || DIETS[0]).label}</dd>
     <dt>Allergies</dt><dd>${p.allergies.length ? p.allergies.map(a => (ALLERGENS.find(x => x.id === a) || {}).label).join(", ") : "None"}</dd>
     ${t ? `<dt>Daily target</dt><dd>${fmt(t.kcal)} kcal · P ${t.p} · C ${t.c} · F ${t.f}</dd>` : ""}
     <dt>Created</dt><dd>${fmtDateLong(p.createdAt)}</dd></dl>
    <button type="button" class="btn ghost block" data-a="edit" style="margin-top:14px">${icon("square-pen", "sm")}Edit details and preferences</button></section>
   <section class="card"><div class="card-h"><h3>Switch profile</h3>${ibtn("user-plus", "Add profile", 'data-a="add"')}</div>
    ${others.length ? `<div class="list">${others.map(o => `<div class="li">${avatar(o)}<div class="main"><div class="title">${esc(o.name)}</div><div class="sub">${o.age != null ? o.age + " yrs" : "Details needed"}</div></div><button type="button" class="btn sm ghost" data-switch="${o.id}">${icon("arrow-left-right", "sm")}Switch</button></div>`).join("")}</div>`
      : `<p class="muted" style="font-size:14px">No other profiles on this device.</p>`}
    <button type="button" class="btn ghost block" data-a="all" style="margin-top:12px">${icon("users", "sm")}All profiles</button></section>
   <section class="card"><h3 style="margin-bottom:10px">Appearance</h3><div class="chips">
    <button type="button" class="chip" data-theme="dark" aria-pressed="${theme !== "light"}">${icon("moon")}Dark</button>
    <button type="button" class="chip" data-theme="light" aria-pressed="${theme === "light"}">${icon("sun")}Light</button></div></section>
   <section class="card"><h3 style="margin-bottom:6px">Data and sources</h3>
    <p class="muted" style="font-size:14px">Everything is saved on this device. Food values come from <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener" style="color:var(--ink)">USDA FoodData Central</a> (SR Legacy). Exercises and photos come from <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener" style="color:var(--ink)">free-exercise-db</a>. Calorie targets use the Mifflin–St Jeor formula and are estimates.</p>
    <button type="button" class="btn danger block" data-a="delete" style="margin-top:14px">${icon("trash-2", "sm")}Delete this profile</button></section>
  </div>`;
  el.onclick = async e => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "edit") return ctx.go("#/edit");
    if (a === "add") return ctx.go("#/new");
    if (a === "all") return ctx.go("#/profiles");
    const sw = e.target.closest("[data-switch]");
    if (sw) { if (guard(() => { ctx.store.setActive(sw.dataset.switch); return true; })) { toast(`Switched to ${ctx.store.profile(sw.dataset.switch).name}`); ctx.go("#/training/workout"); } return; }
    const th = e.target.closest("[data-theme]");
    if (th) { try { localStorage.setItem("theme", th.dataset.theme); } catch (err) {} applyTheme(th.dataset.theme); $$("[data-theme]", el).forEach(b => b.setAttribute("aria-pressed", b === th)); return; }
    if (a === "delete") {
      const okd = await confirmDialog({title: `Delete ${p.name}?`, message: `This permanently removes ${p.name}'s profile, diet plans, workout plans and progress from this device. Other profiles are not affected.`, confirm: "Delete profile", danger: true});
      if (okd && guard(() => { ctx.store.deleteProfile(p.id); return true; })) { toast("Profile deleted"); ctx.go("#/profiles"); }
    }
  };
}
