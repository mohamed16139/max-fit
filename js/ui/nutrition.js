// Nutrition & Meal Planning: dashboard, meal editor, food picker, replacement, diet plans, food database, targets.
import {$, $$, esc, icon, ibtn, toast, sheet, confirmDialog, promptDialog, fmt, kcal, r0, r1, today, fmtDate, qtyLabel} from "./dom.js";
import {FOOD_SOURCE} from "../data/foods.js";
import {nutrientsFor, sum, mealTotals, planTotals, planTargets, targets, unitsFor, defaultUnit, convertQty, stepFor, practical, pieceHint,
  replacements, generateMeals, allowed, ACTIVITY, GOALS, LIMITS, mealLayout, KEY} from "../core/nutrition.js";
import {duplicatePlan} from "../core/training.js";
import {newDietPlan, PLAN_NAMES} from "../core/starter.js";

const CATS = [
  {id: "meat", label: "Meat & fish", icon: "beef"}, {id: "dairy", label: "Eggs & dairy", icon: "egg"}, {id: "grains", label: "Grains & potatoes", icon: "wheat"},
  {id: "fruit", label: "Fruit", icon: "apple"}, {id: "veg", label: "Vegetables", icon: "carrot"}, {id: "legumes", label: "Legumes", icon: "leaf"},
  {id: "nuts", label: "Nuts & seeds", icon: "nut"}, {id: "fats", label: "Oils & fats", icon: "droplet"}, {id: "snacks", label: "Snacks", icon: "cookie"},
  {id: "drinks", label: "Drinks", icon: "milk"}, {id: "custom", label: "My foods", icon: "star"},
];
const catIcon = f => icon((CATS.find(c => c.id === (f.custom ? "custom" : f.cat)) || CATS[0]).icon);
const ROLE_LABEL = {protein: "Protein source", carb: "Carb source", fat: "Fat source", veg: "Vegetable", fruit: "Fruit", drink: "Drink"};
const KEY_LABEL = {p: "protein", c: "carbs", f: "fat", kcal: "calories"};
// Display precision per unit: litres need 2 decimals (0.25 L), grams/ml 1.
const roundQ = (q, unit) => unit === "L" ? Math.round(q * 100) / 100 : r1(q);
let viewPlanId = null;   // a non-active plan opened for viewing (session only)

export function renderNutrition(el, ctx, sub) {
  const tabs = [["today", "Today", "house"], ["plans", "Plans", "list"], ["foods", "Foods", "search"], ["targets", "Targets", "target"]];
  el.innerHTML = `<header class="topbar"><div class="wrap"><h1>Nutrition</h1></div></header>
   <div class="wrap"><div class="seg" role="tablist">${tabs.map(([id, l, ic]) => `<button role="tab" aria-selected="${sub === id}" data-tab="${id}">${icon(ic, "sm")}${l}</button>`).join("")}</div><div id="nv"></div></div>`;
  $(".seg", el).onclick = e => { const b = e.target.closest("[data-tab]"); if (b) ctx.go("#/nutrition/" + b.dataset.tab); };
  const v = $("#nv", el);
  if (sub === "plans") return plansView(v, ctx);
  if (sub === "foods") return foodsView(v, ctx);
  if (sub === "targets") return targetsView(v, ctx);
  return todayView(v, ctx);
}

// ---------- helpers ----------
const currentPlan = p => p.nutrition.plans[viewPlanId] || p.nutrition.plans[p.nutrition.activePlanId] || null;
function itemN(ctx, it) { const f = ctx.foodById(it.foodId); return f ? nutrientsFor(f, it.qty, it.unit) : {kcal: 0, p: 0, c: 0, f: 0}; }
const macroTxt = n => `P ${r0(n.p)} · C ${r0(n.c)} · F ${r0(n.f)}`;
function updPlan(ctx, planId, fn, msg) {
  return ctx.save(d => { const pl = d.nutrition.plans[planId]; if (!pl) return false; if (fn(pl, d) === false) return false; pl.updatedAt = new Date().toISOString(); }, msg);
}
function eatenSet(p, planId) { const e = p.nutrition.eaten[today()]; return new Set(e && e.planId === planId ? e.meals : []); }
function ring(pct, big, small) {
  const R = 64, C = 2 * Math.PI * R, off = C * (1 - Math.min(1, Math.max(0, pct)));
  return `<div class="ring"><svg viewBox="0 0 148 148" aria-hidden="true"><circle cx="74" cy="74" r="${R}" fill="none" stroke-width="12" class="track"/><circle cx="74" cy="74" r="${R}" fill="none" stroke-width="12" stroke-linecap="round" class="val" stroke-dasharray="${C}" stroke-dashoffset="${off}" ${pct > 1.02 ? 'style="stroke:var(--danger)"' : ""}/></svg><div class="center"><div><b>${big}</b><small>${small}</small></div></div></div>`;
}
function macroBar(label, color, have, target, unit = "g") {
  const pct = target ? have / target : 0;
  return `<div class="macro"><div class="macro-h"><span class="dot" style="background:${color}"></span>${label}<span class="spacer"></span><span><b>${r0(have)}</b> / ${r0(target)} ${unit}</span></div>
   <div class="bar${pct > 1.1 ? " over" : ""}" role="progressbar" aria-label="${label}" aria-valuenow="${r0(have)}" aria-valuemax="${r0(target)}"><i style="width:${Math.min(100, pct * 100)}%;background:${color}"></i></div></div>`;
}

// =====================================================================
// Today / dashboard
// =====================================================================
function todayView(v, ctx) {
  const p = ctx.profile(), plan = currentPlan(p);
  if (!plan) {
    v.innerHTML = `<div class="card empty">${icon("utensils")}<h3>No diet plan yet</h3><p>Generate a plan from your targets, or build one yourself.</p><button type="button" class="btn primary" id="np">${icon("sparkles", "sm")}Create a diet plan</button></div>`;
    $("#np", v).onclick = () => newPlanSheet(ctx); return;
  }
  const T = planTargets(p, plan), tot = planTotals(plan, ctx.foodById), eaten = eatenSet(p, plan.id);
  const eatenTot = sum(plan.meals.filter(m => eaten.has(m.id)).map(m => mealTotals(m, ctx.foodById)));
  const isActive = plan.id === p.nutrition.activePlanId, remaining = T ? T.kcal - eatenTot.kcal : 0;
  v.innerHTML = `${!isActive ? `<div class="card flat row" style="margin-bottom:12px">${icon("info")}<span style="flex:1;font-size:14px">You're viewing <b>${esc(plan.name)}</b>. It isn't your active plan.</span><button type="button" class="btn sm primary" data-a="activate">Make active</button>${ibtn("x", "Back to active plan", 'data-a="unview"', "sm")}</div>` : ""}
   <section class="card"><div class="row" style="margin-bottom:12px"><div style="flex:1;min-width:0"><div class="eyebrow">${isActive ? "Active plan" : "Viewing"}</div><h2>${esc(plan.name)}</h2></div>${ibtn("arrow-left-right", "Switch plan", 'data-a="switch"')}${ibtn("pencil", "Rename plan", 'data-a="rename"')}</div>
    ${T ? `<div class="dash">${ring(eatenTot.kcal / T.kcal, kcal(Math.max(0, remaining)), remaining >= 0 ? "kcal left" : "kcal over")}
     <div class="macros"><div class="row wrap-ok" style="gap:6px"><span class="pill">${icon("target")}Target ${kcal(T.kcal)}</span><span class="pill">${icon("list")}Planned ${kcal(tot.kcal)}</span><span class="pill">${icon("circle-check")}Eaten ${kcal(eatenTot.kcal)}</span></div>
      ${macroBar("Protein", "var(--protein)", tot.p, T.p)}${macroBar("Carbs", "var(--carbs)", tot.c, T.c)}${macroBar("Fat", "var(--fat)", tot.f, T.f)}</div></div>
     <p class="faint" style="font-size:12.5px;margin-top:12px">Bars show the plan against your targets. ${Math.abs(tot.kcal - T.kcal) > T.kcal * 0.05 ? `<b style="color:var(--warn)">The plan is ${kcal(Math.abs(tot.kcal - T.kcal))} kcal ${tot.kcal > T.kcal ? "over" : "under"} target.</b>` : "The plan is on target."} Tick meals as you eat them.</p>`
     : `<p class="muted">Add your body details in your profile to see targets.</p>`}</section>
   <div class="row" style="margin:18px 0 10px"><h2 style="flex:1">Meals</h2><span class="faint" style="font-size:13px">${eaten.size} of ${plan.meals.length} eaten</span></div>
   <div class="stack" id="meals">${plan.meals.map((m, i) => mealCard(ctx, plan, m, i, eaten.has(m.id), p.mealTimes[i])).join("") || `<div class="card empty">${icon("utensils")}<p>No meals yet.</p></div>`}</div>
   <button type="button" class="btn ghost block" data-a="addmeal" style="margin-top:12px">${icon("plus", "sm")}Add a meal</button>
   <p class="src" style="margin-top:14px">${icon("info", "sm")} Nutrition values: ${esc(FOOD_SOURCE.name)} (${FOOD_SOURCE.version}). Targets are estimates.</p>`;

  v.onclick = async e => {
    const a = e.target.closest("[data-a]")?.dataset.a, mid = e.target.closest("[data-meal]")?.dataset.meal, iid = e.target.closest("[data-item]")?.dataset.item;
    if (a === "activate") { ctx.save(d => { d.nutrition.activePlanId = plan.id; }, `${plan.name} is now active`); viewPlanId = null; return ctx.rerender(); }
    if (a === "unview") { viewPlanId = null; return ctx.rerender(); }
    if (a === "switch") return switchPlanSheet(ctx);
    if (a === "rename") { const n = await promptDialog({title: "Rename plan", label: "Plan name", value: plan.name}); if (n) { updPlan(ctx, plan.id, pl => { pl.name = n; }, "Renamed"); ctx.rerender(); } return; }
    if (a === "addmeal") {
      const n = await promptDialog({title: "Add a meal", label: "Meal name", value: `Meal ${plan.meals.length + 1}`, confirm: "Add"}); if (!n) return;
      const id = ctx.uid(); updPlan(ctx, plan.id, pl => { pl.meals.push({id, name: n, items: []}); }); ctx.rerender(); return mealEditor(ctx, plan.id, id);
    }
    if (!mid) return;
    if (a === "eat") {
      ctx.save(d => { const t = today(), cur = d.nutrition.eaten[t]; let list = cur && cur.planId === plan.id ? cur.meals : [];
        list = list.includes(mid) ? list.filter(x => x !== mid) : list.concat(mid); d.nutrition.eaten = {[t]: {planId: plan.id, meals: list}}; });
      return ctx.rerender();
    }
    if (a === "edit") return mealEditor(ctx, plan.id, mid);
    if (a === "addfood") { const f = await foodPicker(ctx, plan.meals.find(m => m.id === mid).name); if (f) { addItem(ctx, plan.id, mid, f); ctx.rerender(); } return; }
    if (a === "replace" && iid) { if (await replaceFood(ctx, plan.id, mid, iid)) ctx.rerender(); }
  };
}
function mealCard(ctx, plan, m, i, eaten, time) {
  const t = mealTotals(m, ctx.foodById);
  return `<article class="meal${eaten ? " eaten" : ""}" data-meal="${m.id}"><div class="meal-h">
    <button type="button" class="eat" data-a="eat" aria-pressed="${eaten}" aria-label="${eaten ? "Mark as not eaten" : "Mark as eaten"}: ${esc(m.name)}">${icon("check", "sm")}</button>
    <div class="main"><h3>${esc(m.name)}</h3><div class="sub">${time ? esc(time) + " · " : ""}${kcal(t.kcal)} kcal · ${macroTxt(t)}</div></div>
    ${ibtn("plus", "Add food", 'data-a="addfood"')}${ibtn("square-pen", "Edit meal", 'data-a="edit"')}</div>
   ${m.items.length ? `<div class="items">${m.items.map(it => { const f = ctx.foodById(it.foodId), n = itemN(ctx, it);
     return `<div class="item" data-item="${it.id}"><div class="main"><div class="title">${f ? esc(f.name) : "Unknown food"}</div><div class="sub">${kcal(n.kcal)} kcal · ${macroTxt(n)}${f && pieceHint(f, it.qty, it.unit) ? " · " + pieceHint(f, it.qty, it.unit) : ""}</div></div>
      <span class="qty">${qtyLabel(it.qty, it.unit)}</span>${f ? ibtn("arrow-left-right", "Replace " + f.name, 'data-a="replace"', "sm") : ""}</div>`; }).join("")}</div>`
     : `<p class="faint" style="padding:0 14px 14px;font-size:14px">Empty. Tap + to add food.</p>`}
  </article>`;
}

// =====================================================================
// Meal editor
// =====================================================================
function addItem(ctx, planId, mealId, {food, qty, unit}) {
  updPlan(ctx, planId, pl => { const m = pl.meals.find(x => x.id === mealId); if (!m) return false; m.items.push({id: ctx.uid(), foodId: food.id, qty, unit}); }, `${food.name} added`);
  ctx.save(d => { d.nutrition.recent = [food.id, ...d.nutrition.recent.filter(x => x !== food.id)].slice(0, 20); });
}
function mealEditor(ctx, planId, mealId) {
  return sheet({title: "Edit meal", wide: true, render: (b, close, api) => {
    let saveT = null;
    const get = () => ctx.profile().nutrition.plans[planId]?.meals.find(m => m.id === mealId);
    const draw = () => {
      const m = get(); if (!m) return close();
      api.setTitle(m.name);
      const t = mealTotals(m, ctx.foodById);
      b.innerHTML = `<div class="row" style="margin-bottom:12px;gap:8px"><div class="field" style="flex:1"><label for="mname">Meal name</label><input class="input" id="mname" value="${esc(m.name)}" maxlength="40"></div></div>
       <div class="stack" id="eitems">${m.items.map((it, i) => editRow(ctx, it, i, m.items.length)).join("") || `<div class="empty">${icon("utensils")}<p>No food in this meal yet.</p></div>`}</div>
       <div class="card flat" style="margin-top:12px"><div class="eyebrow" style="margin-bottom:6px">Meal total</div><div class="mstrip" id="mtot">${strip(t)}</div></div>
       <div class="row wrap-ok" style="margin-top:12px;gap:8px"><button type="button" class="btn ghost sm" data-a="save">${icon("star", "sm")}Save as favourite meal</button><button type="button" class="btn ghost sm" data-a="insert">${icon("history", "sm")}Insert a saved meal</button><div class="spacer"></div><button type="button" class="btn danger sm" data-a="delmeal">${icon("trash-2", "sm")}Delete meal</button></div>`;
    };
    const liveUpdate = row => {
      const it = get().items.find(x => x.id === row.dataset.item), f = ctx.foodById(it.foodId);
      const q = parseFloat($(".q", row).value), u = $(".u", row)?.value || it.unit;
      if (!(q >= 0) || q > 100000) { $(".q", row).classList.add("err"); return; }
      $(".q", row).classList.remove("err");
      $(".mstrip", row).innerHTML = strip(nutrientsFor(f, q, u));
      $(".ph", row).textContent = pieceHint(f, q, u);
      const all = get().items.map(x => x.id === it.id ? {...x, qty: q, unit: u} : x);
      $("#mtot", b).innerHTML = strip(sum(all.map(x => itemN(ctx, x))));
      clearTimeout(saveT); saveT = setTimeout(() => updPlan(ctx, planId, pl => { const y = pl.meals.find(z => z.id === mealId).items.find(z => z.id === it.id); y.qty = q; y.unit = u; }), 350);
    };
    b.oninput = e => { const row = e.target.closest("[data-item]"); if (row && e.target.classList.contains("q")) liveUpdate(row); };
    b.onchange = e => {
      if (e.target.id === "mname") { const n = e.target.value.trim(); if (n) updPlan(ctx, planId, pl => { pl.meals.find(z => z.id === mealId).name = n; }); api.setTitle(n || get().name); return; }
      const row = e.target.closest("[data-item]");
      if (row && e.target.classList.contains("u")) {          // unit change converts the quantity, so the amount of food stays the same
        const it = get().items.find(x => x.id === row.dataset.item), f = ctx.foodById(it.foodId), to = e.target.value;
        const q = convertQty(f, parseFloat($(".q", row).value) || it.qty, it.unit, to), nq = to === "L" ? Math.round(q * 100) / 100 : Math.round(q);
        updPlan(ctx, planId, pl => { const y = pl.meals.find(z => z.id === mealId).items.find(z => z.id === it.id); y.qty = nq; y.unit = to; }); draw();
      }
    };
    b.onclick = async e => {
      const a = e.target.closest("[data-a]")?.dataset.a, row = e.target.closest("[data-item]"); if (!a) return;
      const m = get();
      if (a === "save") { const n = await promptDialog({title: "Save favourite meal", label: "Name", value: m.name}); if (n) ctx.save(d => { const id = ctx.uid(); d.nutrition.savedMeals[id] = {id, name: n, items: m.items.map(x => ({foodId: x.foodId, qty: x.qty, unit: x.unit}))}; }, "Saved to your meals"); return; }
      if (a === "insert") { const sm = await savedMealPicker(ctx); if (sm) { updPlan(ctx, planId, pl => { const mm = pl.meals.find(z => z.id === mealId); sm.items.forEach(x => mm.items.push({id: ctx.uid(), ...x})); }, `${sm.name} added`); draw(); } return; }
      if (a === "delmeal") { if (await confirmDialog({title: `Delete ${m.name}?`, message: "This meal and its foods are removed from the plan.", confirm: "Delete meal", danger: true})) { updPlan(ctx, planId, pl => { pl.meals = pl.meals.filter(z => z.id !== mealId); }, "Meal deleted"); close(); ctx.rerender(); } return; }
      if (!row) return;
      const it = m.items.find(x => x.id === row.dataset.item), i = m.items.indexOf(it), f = ctx.foodById(it.foodId);
      if (a === "inc" || a === "dec") { const inp = $(".q", row), u = $(".u", row)?.value || it.unit, st = stepFor(f, u); let q = (parseFloat(inp.value) || 0) + (a === "inc" ? st : -st); q = Math.max(0, u === "L" ? Math.round(q * 100) / 100 : Math.round(q / st) * st); inp.value = q; return liveUpdate(row); }
      if (a === "up" || a === "down") { updPlan(ctx, planId, pl => { const arr = pl.meals.find(z => z.id === mealId).items, j = i + (a === "up" ? -1 : 1); if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; }); return draw(); }
      if (a === "rm") { updPlan(ctx, planId, pl => { const mm = pl.meals.find(z => z.id === mealId); mm.items = mm.items.filter(z => z.id !== it.id); });
        toast(`${f ? f.name : "Food"} removed`, {action: {label: "Undo", run: () => { updPlan(ctx, planId, pl => { pl.meals.find(z => z.id === mealId).items.splice(i, 0, it); }); draw(); ctx.rerender(); }}}); return draw(); }
      if (a === "replace") { if (await replaceFood(ctx, planId, mealId, it.id)) draw(); return; }
    };
    api.redraw = draw; draw();
  }, footer: (f, close, api) => {
    f.innerHTML = `<button type="button" class="btn ghost" data-close>${icon("check", "sm")}Done</button><button type="button" class="btn primary" data-add>${icon("plus", "sm")}Add food</button>`;
    f.onclick = async e => {
      if (!e.target.closest("[data-add]")) return;
      const m = ctx.profile().nutrition.plans[planId].meals.find(x => x.id === mealId);
      const pick = await foodPicker(ctx, m.name); if (pick) { addItem(ctx, planId, mealId, pick); api.redraw(); }
    };
  }}).then(() => ctx.rerender());
}
function strip(n) { return `<div><b>${kcal(n.kcal)}</b>kcal</div><div><b>${r1(n.p)}</b>protein</div><div><b>${r1(n.c)}</b>carbs</div><div><b>${r1(n.f)}</b>fat</div>`; }
function editRow(ctx, it, i, len) {
  const f = ctx.foodById(it.foodId);
  if (!f) return `<div class="edit-item" data-item="${it.id}"><div class="top"><div class="main"><div class="title">Unknown food</div><div class="sub">This food was deleted.</div></div>${ibtn("trash-2", "Remove", 'data-a="rm"', "danger sm")}</div></div>`;
  const units = unitsFor(f), n = nutrientsFor(f, it.qty, it.unit);
  return `<div class="edit-item" data-item="${it.id}"><div class="top"><span class="cat-ico" style="width:34px;height:34px">${catIcon(f)}</span><div class="main"><div class="title">${esc(f.name)}</div><div class="sub ph">${pieceHint(f, it.qty, it.unit)}</div></div>
    ${ibtn("arrow-up", "Move up", `data-a="up" ${i ? "" : "disabled"}`, "sm")}${ibtn("arrow-down", "Move down", `data-a="down" ${i < len - 1 ? "" : "disabled"}`, "sm")}${ibtn("arrow-left-right", "Replace", 'data-a="replace"', "sm")}${ibtn("trash-2", "Remove", 'data-a="rm"', "sm danger")}</div>
   <div class="ctl"><div class="stepper"><button type="button" data-a="dec" aria-label="Less">${icon("minus", "sm")}</button><input class="q" type="number" inputmode="decimal" min="0" step="any" value="${it.qty}" aria-label="Quantity of ${esc(f.name)}">
     ${units.length > 1 ? `<select class="u" aria-label="Unit">${units.map(u => `<option${u === it.unit ? " selected" : ""}>${u}</option>`).join("")}</select>` : `<span style="padding:0 10px;color:var(--ink-3);font-weight:600">${it.unit}</span>`}
     <button type="button" data-a="inc" aria-label="More">${icon("plus", "sm")}</button></div></div>
   <div class="mstrip">${strip(n)}</div></div>`;
}
function savedMealPicker(ctx) {
  const list = Object.values(ctx.profile().nutrition.savedMeals);
  return sheet({title: "Saved meals", render: (b, close) => {
    b.innerHTML = list.length ? `<div class="list">${list.map(m => { const t = mealTotals(m, ctx.foodById); return `<div class="li" data-sm="${m.id}"><div class="main"><div class="title">${esc(m.name)}</div><div class="sub">${m.items.length} foods · ${kcal(t.kcal)} kcal · ${macroTxt(t)}</div></div>${ibtn("trash-2", "Delete saved meal", 'data-del', "sm danger")}<button type="button" class="btn sm primary" data-use>Add</button></div>`; }).join("")}</div>`
      : `<div class="empty">${icon("star")}<h3>No saved meals</h3><p>Open a meal and tap “Save as favourite meal” to reuse it.</p></div>`;
    b.onclick = e => { const r = e.target.closest("[data-sm]"); if (!r) return; const m = list.find(x => x.id === r.dataset.sm);
      if (e.target.closest("[data-use]")) close(m);
      if (e.target.closest("[data-del]")) { ctx.save(d => { delete d.nutrition.savedMeals[m.id]; }, "Deleted"); r.remove(); } };
  }});
}

// =====================================================================
// Food picker (search without leaving the meal)
// =====================================================================
function foodPicker(ctx, mealName) {
  const st = {q: "", cat: "", tab: "all"};
  return sheet({title: `Add to ${mealName}`, wide: true, render: (b, close) => {
    let chosen = null;
    const listView = () => {
      const p = ctx.profile();
      b.innerHTML = `<div class="input-wrap">${icon("search")}<input class="input" type="search" id="fq" placeholder="Search foods" value="${esc(st.q)}" aria-label="Search foods"></div>
       <div class="chips" style="margin-top:10px">${[["all", "All", "list"], ["fav", "Favourites", "star"], ["recent", "Recent", "history"], ["mine", "My foods", "square-pen"]].map(([id, l, ic]) => `<button type="button" class="chip" data-tab="${id}" aria-pressed="${st.tab === id}">${icon(ic)}${l}</button>`).join("")}</div>
       <div class="chips scroll" style="margin-top:8px">${CATS.filter(c => c.id !== "custom").map(c => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${st.cat === c.id}">${icon(c.icon)}${c.label}</button>`).join("")}</div>
       <div class="list" id="fres" style="margin-top:8px"></div>
       <button type="button" class="btn ghost block sm" data-a="custom" style="margin-top:10px">${icon("plus", "sm")}Create a custom food</button>`;
      const draw = () => { $("#fres", b).innerHTML = foodRows(ctx, filterFoods(ctx, st), p.nutrition.favorites) || `<div class="empty">${icon("search")}<h3>No foods found</h3><p>Try another word, or create a custom food.</p></div>`; };
      $("#fq", b).oninput = e => { st.q = e.target.value; draw(); };
      draw(); setTimeout(() => $("#fq", b)?.focus(), 60);
    };
    const qtyView = f => {
      chosen = f;
      const u = defaultUnit(f), pc = f.pieces && f.pieces[0], q0 = pc && pc.g < 150 && f.role !== "fat" ? practical(pc.g * (f.id.startsWith("egg") ? 2 : 1), "g") : (u === "ml" ? (f.role === "fat" ? 10 : 250) : f.role === "fat" ? 10 : 100);
      const units = unitsFor(f);
      b.innerHTML = `<button type="button" class="btn ghost sm" data-a="back">${icon("chevron-left", "sm")}Back to search</button>
       <div class="row" style="margin:14px 0"><span class="cat-ico">${catIcon(f)}</span><div style="flex:1"><h3>${esc(f.name)}</h3><div class="faint" style="font-size:13px">${ROLE_LABEL[f.role] || ""}</div></div></div>
       <div class="field"><span class="label">Amount</span><div class="row wrap-ok"><div class="stepper"><button type="button" data-a="dec" aria-label="Less">${icon("minus", "sm")}</button><input id="aq" class="q" type="number" inputmode="decimal" min="0" step="any" value="${q0}" aria-label="Amount">
        ${units.length > 1 ? `<select id="au" class="u" aria-label="Unit">${units.map(x => `<option${x === u ? " selected" : ""}>${x}</option>`).join("")}</select>` : `<span style="padding:0 10px;color:var(--ink-3);font-weight:600">g</span>`}<button type="button" data-a="inc" aria-label="More">${icon("plus", "sm")}</button></div>
        ${(f.pieces || []).map(pp => `<button type="button" class="chip" data-pc="${pp.g}">1 ${esc(pp.label)} · ${fmt(pp.g, 1)} g</button>`).join("")}</div><span class="hint" id="aph"></span></div>
       <div class="mstrip" id="astrip" style="margin-top:12px"></div>
       <button type="button" class="btn primary block lg" data-a="add" style="margin-top:16px">${icon("plus")}Add to ${esc(mealName)}</button>`;
      const upd = () => { const q = parseFloat($("#aq", b).value), uu = $("#au", b)?.value || u; const n = nutrientsFor(f, q >= 0 ? q : 0, uu); $("#astrip", b).innerHTML = strip(n); $("#aph", b).textContent = pieceHint(f, q, uu); };
      $("#aq", b).oninput = upd; if ($("#au", b)) $("#au", b).onchange = e => { const prev = e.target.dataset.prev || u; $("#aq", b).value = roundQ(convertQty(f, parseFloat($("#aq", b).value) || 0, prev, e.target.value), e.target.value); e.target.dataset.prev = e.target.value; upd(); };
      upd(); setTimeout(() => $("#aq", b).select(), 60);
    };
    b.onclick = e => {
      const tb = e.target.closest("[data-tab]"); if (tb) { st.tab = tb.dataset.tab; return listView(); }
      const cb = e.target.closest("[data-cat]"); if (cb) { st.cat = st.cat === cb.dataset.cat ? "" : cb.dataset.cat; return listView(); }
      const fav = e.target.closest("[data-fav]"); if (fav) { toggleFav(ctx, fav.dataset.fav); return listView(); }
      const r = e.target.closest("[data-food]"); if (r) return qtyView(ctx.foodById(r.dataset.food));
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "back") return listView();
      if (a === "custom") return customFoodSheet(ctx).then(f => { if (f) qtyView(f); else listView(); });
      if (a === "inc" || a === "dec") { const inp = $("#aq", b), uu = $("#au", b)?.value || defaultUnit(chosen), s = stepFor(chosen, uu); inp.value = Math.max(0, roundQ((parseFloat(inp.value) || 0) + (a === "inc" ? s : -s), uu)); return inp.dispatchEvent(new Event("input")); }
      const pc = e.target.closest("[data-pc]"); if (pc) { const uu = $("#au", b)?.value || "g"; $("#aq", b).value = roundQ(convertQty(chosen, +pc.dataset.pc, "g", uu), uu); return $("#aq", b).dispatchEvent(new Event("input")); }
      if (a === "add") { const q = parseFloat($("#aq", b).value), uu = $("#au", b)?.value || defaultUnit(chosen); if (!(q > 0) || q > 100000) return toast("Enter an amount greater than 0.", {error: true}); close({food: chosen, qty: roundQ(q, uu), unit: uu}); }
    };
    listView();
  }});
}
function toggleFav(ctx, id) { ctx.save(d => { const f = d.nutrition.favorites; d.nutrition.favorites = f.includes(id) ? f.filter(x => x !== id) : [id, ...f]; }); }
function filterFoods(ctx, {q, cat, tab}) {
  const p = ctx.profile(), all = ctx.foods(), words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = all;
  if (tab === "fav") list = p.nutrition.favorites.map(id => ctx.foodById(id)).filter(Boolean);
  if (tab === "recent") list = p.nutrition.recent.map(id => ctx.foodById(id)).filter(Boolean);
  if (tab === "mine") list = all.filter(f => f.custom);
  if (cat) list = list.filter(f => f.cat === cat);
  if (words.length) list = list.filter(f => words.every(w => (f.name + " " + f.cat + " " + (f.src?.desc || "")).toLowerCase().includes(w)));
  return list.slice(0, 120);
}
function foodRows(ctx, list, favs) {
  const prefs = ctx.profile();
  return list.map(f => { const per = f.unit === "ml" ? nutrientsFor(f, 100, "ml") : f.per100g, ok = allowed(f, prefs);
    return `<div class="row" style="border-top:1px solid var(--line);gap:4px"><button type="button" class="food-li" data-food="${f.id}" style="border:0;flex:1">${`<span class="cat-ico">${catIcon(f)}</span>`}<div class="main"><div class="title">${esc(f.name)}${ok ? "" : ' <span class="badge warn">Not in your diet</span>'}</div>
      <div class="sub">per 100 ${f.unit === "ml" ? "ml" : "g"}: ${kcal(per.kcal)} kcal · ${macroTxt(per)}</div></div></button>${ibtn("star", favs.includes(f.id) ? "Remove favourite" : "Add favourite", `data-fav="${f.id}"`, favs.includes(f.id) ? "brand" : "")}</div>`; }).join("");
}

// ---------- custom food ----------
function customFoodSheet(ctx, existing = null) {
  return sheet({title: existing ? "Edit custom food" : "Create a custom food", render: b => {
    const e = existing || {name: "", cat: "custom", role: "", unit: "g", density: 1, per100g: {}};
    const per = existing && existing.unit === "ml" ? Object.fromEntries(Object.entries(e.per100g).map(([k, v]) => [k, r1(v * e.density)])) : e.per100g;
    const n = (id, label, val, unit = "g") => `<div class="field"><label for="${id}">${label}</label><div class="unit-in"><input id="${id}" type="number" inputmode="decimal" min="0" step="any" value="${val ?? ""}"><span>${unit}</span></div></div>`;
    b.innerHTML = `<form id="cf" class="stack" novalidate><p class="faint" style="font-size:13px">${icon("info", "sm")} Copy the values from the product's nutrition label. Custom foods are marked as your own data, not verified.</p>
      <div class="field"><label for="cn">Name</label><input class="input" id="cn" maxlength="50" value="${esc(e.name)}" required></div>
      <div class="field"><span class="label">Measured as</span><div class="chips"><button type="button" class="chip" data-u="g" aria-pressed="${e.unit === "g"}">Solid (grams)</button><button type="button" class="chip" data-u="ml" aria-pressed="${e.unit === "ml"}">Liquid (ml)</button></div></div>
      <div class="field ${e.unit === "ml" ? "" : "hidden"}" id="dens"><label for="cd">Density</label><div class="unit-in"><input id="cd" type="number" inputmode="decimal" min="0.5" max="2" step="0.01" value="${e.density || 1}"><span>g per ml</span></div><span class="hint">Water and most drinks are about 1.00–1.05. Oils are about 0.91.</span></div>
      <div class="field"><span class="label" id="perlbl">Per 100 ${e.unit === "ml" ? "ml" : "g"}</span><div class="grid2" style="grid-template-columns:1fr 1fr">${n("ck", "Calories", per.kcal, "kcal")}${n("cp", "Protein", per.p)}${n("cc", "Carbs", per.c)}${n("cfa", "Fat", per.f)}${n("cfi", "Fiber (optional)", per.fiber)}</div></div>
      <div class="field"><label for="cr">Role in a meal</label><select class="input" id="cr"><option value="">Decide from the macros</option>${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}"${e.role === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="err-msg" id="cerr" role="alert"></div></form>`;
    b.onclick = ev => { const u = ev.target.closest("[data-u]"); if (!u) return; $$("[data-u]", b).forEach(x => x.setAttribute("aria-pressed", x === u)); $("#dens", b).classList.toggle("hidden", u.dataset.u !== "ml"); $("#perlbl", b).textContent = `Per 100 ${u.dataset.u}`; };
  }, footer: (f, close, api) => {
    f.innerHTML = `<button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" data-ok>${icon("save", "sm")}Save food</button>`;
    f.onclick = ev => {
      if (!ev.target.closest("[data-ok]")) return;
      const b = api.body, g = id => $(id, b).value.trim(), num = id => g(id) === "" ? null : +g(id), err = m => { $("#cerr", b).textContent = m; };
      const name = g("#cn"), unit = $('[data-u][aria-pressed="true"]', b).dataset.u, dens = unit === "ml" ? num("#cd") : null;
      const v = {kcal: num("#ck"), p: num("#cp"), c: num("#cc"), f: num("#cfa"), fiber: num("#cfi")};
      if (!name) return err("Enter a name.");
      for (const k of ["kcal", "p", "c", "f"]) if (v[k] == null || !(v[k] >= 0)) return err("Enter calories, protein, carbs and fat (0 or more).");
      if (v.p + v.c + v.f > 100.5) return err("Protein + carbs + fat can't be more than 100 g per 100.");
      if (v.fiber != null && !(v.fiber >= 0)) return err("Fiber can't be negative.");
      if (unit === "ml" && !(dens >= 0.5 && dens <= 2)) return err("Enter a density between 0.5 and 2 g/ml.");
      const est = v.p * 4 + v.c * 4 + v.f * 9;
      if (v.kcal > 0 && Math.abs(est - v.kcal) > Math.max(40, v.kcal * 0.35)) return err(`Those macros add up to about ${r0(est)} kcal, not ${v.kcal}. Check the label.`);
      const per100g = {};                // stored per 100 g; liquid labels are per 100 ml, so divide by density
      for (const [k, x] of Object.entries(v)) if (x != null) per100g[k] = unit === "ml" ? x / dens : x;
      const dominant = ["p", "c", "f"].sort((a, b2) => v[b2] * (b2 === "f" ? 9 : 4) - v[a] * (a === "f" ? 9 : 4))[0];
      const role = g("#cr") || (unit === "ml" ? "drink" : {p: "protein", c: "carb", f: "fat"}[dominant]);
      const food = {id: existing ? existing.id : "custom_" + ctx.uid(), name, cat: "custom", role, meals: ["b", "m", "s"], flags: [], custom: true, unit, ...(unit === "ml" ? {density: dens} : {}),
        per100g, pieces: [], src: {db: "Custom", desc: "Entered by you"}};
      if (ctx.save(d => { d.nutrition.customFoods[food.id] = food; }, existing ? "Food updated" : "Custom food saved")) close(food);
    };
  }});
}

// =====================================================================
// Food replacement
// =====================================================================
async function replaceFood(ctx, planId, mealId, itemId) {
  const p = ctx.profile(), meal = p.nutrition.plans[planId].meals.find(m => m.id === mealId), it = meal.items.find(x => x.id === itemId), f = ctx.foodById(it.foodId);
  if (!f) return false;
  const r = replacements(f, it.qty, it.unit, ctx.foods(), p);
  const dTxt = (v, unit = "g") => { const x = r1(v); return `<i class="${Math.abs(x) < (unit === "kcal" ? 10 : 2) ? "d-eq" : x > 0 ? "d-up" : "d-down"}">${x > 0 ? "+" : x < 0 ? "−" : "±"}${fmt(Math.abs(x), unit === "kcal" ? 0 : 1)}</i>`; };
  const cmp = (n, diff) => `<div class="cmp"><div><small>kcal</small><b>${kcal(n.kcal)}</b>${diff ? dTxt(diff.kcal, "kcal") : ""}</div><div><small>Protein</small><b>${r1(n.p)}</b>${diff ? dTxt(diff.p) : ""}</div><div><small>Carbs</small><b>${r1(n.c)}</b>${diff ? dTxt(diff.c) : ""}</div><div><small>Fat</small><b>${r1(n.f)}</b>${diff ? dTxt(diff.f) : ""}</div></div>`;
  const pick = await sheet({title: "Replace food", wide: true, render: (b, close) => {
    const anyClose = r.options.some(o => o.close);
    b.innerHTML = `<div class="alt" style="background:none"><div class="alt-h"><span class="cat-ico">${catIcon(f)}</span><div style="flex:1"><div class="eyebrow">Replacing</div><h3>${esc(f.name)} · ${qtyLabel(it.qty, it.unit)}</h3></div></div>${cmp(r.base)}</div>
      <p class="muted" style="font-size:13.5px;margin:12px 0">${icon("info", "sm")} Portions are sized to give the same <b>${KEY_LABEL[r.key]}</b> as the original, because that's this food's job in the meal. Differences are shown under each value.</p>
      ${r.options.length && !anyClose ? `<p class="badge warn" style="white-space:normal;margin-bottom:10px">${icon("triangle-alert", "sm")} No truly equivalent food fits your preferences. These are the closest, so check the differences.</p>` : ""}
      <div class="stack">${r.options.length ? r.options.map((o, i) => `<article class="alt"><div class="alt-h"><span class="cat-ico">${catIcon(o.food)}</span><div style="flex:1;min-width:0"><h3>${esc(o.food.name)}</h3><div class="muted" style="font-size:13px">${qtyLabel(o.qty, o.unit)}${pieceHint(o.food, o.qty, o.unit) ? " · " + pieceHint(o.food, o.qty, o.unit) : ""}</div></div>${o.close ? '<span class="badge ok">Close match</span>' : '<span class="badge warn">Closest option</span>'}</div>
          ${cmp(o.n, o.diff)}<button type="button" class="btn primary sm" data-pick="${i}">${icon("check", "sm")}Use ${esc(o.food.name)}</button></article>`).join("")
        : `<div class="empty">${icon("search")}<h3>No alternatives</h3><p>Nothing in the database can stand in for this food with your diet settings. Try adding a custom food.</p></div>`}</div>`;
    b.onclick = e => { const pk = e.target.closest("[data-pick]"); if (pk) close(r.options[+pk.dataset.pick]); };
  }});
  if (!pick) return false;
  // Only this item changes. Every other food in the meal stays exactly as it was.
  const old = {...it};
  const ok = updPlan(ctx, planId, pl => { const x = pl.meals.find(m => m.id === mealId)?.items.find(y => y.id === itemId); if (!x) return false; x.foodId = pick.food.id; x.qty = pick.qty; x.unit = pick.unit; });
  if (ok) toast(`Replaced with ${pick.food.name}`, {action: {label: "Undo", run: () => { updPlan(ctx, planId, pl => { const x = pl.meals.find(m => m.id === mealId)?.items.find(y => y.id === itemId); if (x) Object.assign(x, old); }); ctx.rerender(); }}});
  return !!ok;
}

// =====================================================================
// Diet plans
// =====================================================================
function plansView(v, ctx) {
  const p = ctx.profile(), plans = Object.values(p.nutrition.plans).sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
  v.innerHTML = `<div class="row" style="margin-bottom:12px"><h2 style="flex:1">Your diet plans</h2><button type="button" class="btn primary sm" data-a="new">${icon("plus", "sm")}New plan</button></div>
   ${plans.length ? `<div class="stack">${plans.map(pl => { const T = planTargets(p, pl), t = planTotals(pl, ctx.foodById), act = pl.id === p.nutrition.activePlanId;
     return `<article class="card" data-plan="${pl.id}" style="${act ? "border-color:var(--brand-line)" : ""}"><div class="plan-card"><div class="main"><h3>${esc(pl.name)}${act ? '<span class="badge brand">Active</span>' : ""}</h3>
       <div class="muted" style="font-size:13px">${pl.meals.length} meals · ${kcal(t.kcal)} kcal planned${T ? ` of ${kcal(T.kcal)}` : ""} · ${pl.customTargets ? "Custom targets" : (GOALS.find(g => g.id === (pl.goal || p.goal)) || {}).label}</div>
       <div class="faint" style="font-size:12px">Created ${fmtDate(pl.createdAt.slice(0, 10))} · updated ${fmtDate(pl.updatedAt.slice(0, 10))}</div></div></div>
      <div class="row wrap-ok" style="gap:2px;margin-top:8px">${act ? "" : `<button type="button" class="btn sm primary" data-a="activate">Set active</button>`}<button type="button" class="btn sm ghost" data-a="view">${icon("utensils", "sm")}Open</button><div class="spacer"></div>
       ${ibtn("target", "Targets", 'data-a="targets"')}${ibtn("refresh-cw", "Regenerate meals", 'data-a="regen"')}${ibtn("copy", "Duplicate", 'data-a="dup"')}${ibtn("pencil", "Rename", 'data-a="rename"')}${ibtn("trash-2", "Delete", 'data-a="del"', "danger")}</div></article>`; }).join("")}</div>`
   : `<div class="card empty">${icon("list")}<h3>No diet plans</h3><p>Create your first plan from your targets.</p></div>`}
   <p class="faint" style="font-size:13px;margin-top:12px">Each plan keeps its own meals and targets. Switching the active plan never changes the others.</p>`;
  v.onclick = async e => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "new") return newPlanSheet(ctx);
    const id = e.target.closest("[data-plan]")?.dataset.plan, pl = ctx.profile().nutrition.plans[id]; if (!pl) return;
    if (a === "activate") { ctx.save(d => { d.nutrition.activePlanId = id; }, `${pl.name} is now active`); viewPlanId = null; return ctx.rerender(); }
    if (a === "view") { viewPlanId = id === ctx.profile().nutrition.activePlanId ? null : id; return ctx.go("#/nutrition/today"); }
    if (a === "dup") { const c = duplicatePlan(pl, ctx.uid, ctx.now()); ctx.save(d => { d.nutrition.plans[c.id] = c; }, "Plan duplicated"); return ctx.rerender(); }
    if (a === "rename") { const n = await promptDialog({title: "Rename plan", label: "Plan name", value: pl.name}); if (n) { updPlan(ctx, id, x => { x.name = n; }, "Renamed"); ctx.rerender(); } return; }
    if (a === "targets") { if (await targetsSheet(ctx, id)) ctx.rerender(); return; }
    if (a === "regen") {
      if (!await confirmDialog({title: `Regenerate ${pl.name}?`, message: "This replaces the meals in this plan with a new set built from your targets and food preferences. Other plans aren't touched. To keep these meals, duplicate the plan first.", confirm: "Regenerate"})) return;
      const prof = ctx.profile(), T = planTargets(prof, pl);
      if (!T) return toast("Add your body details first.", {error: true});
      updPlan(ctx, id, x => { x.meals = generateMeals({targets: T, mealsPerDay: prof.mealsPerDay, foods: ctx.foods(), prefs: prof, uid: ctx.uid}); }, "New meals generated");
      return ctx.rerender();
    }
    if (a === "del") {
      if (!await confirmDialog({title: `Delete ${pl.name}?`, message: "This plan and its meals are permanently removed. Your other plans stay as they are.", confirm: "Delete plan", danger: true})) return;
      ctx.save(d => { delete d.nutrition.plans[id]; if (d.nutrition.activePlanId === id) d.nutrition.activePlanId = Object.keys(d.nutrition.plans)[0] || null; }, "Plan deleted");
      if (viewPlanId === id) viewPlanId = null; return ctx.rerender();
    }
  };
}
async function newPlanSheet(ctx) {
  const p = ctx.profile();
  const res = await sheet({title: "New diet plan", render: b => {
    b.innerHTML = `<form id="npf" class="stack"><div class="field"><label for="npn">Plan name</label><input class="input" id="npn" maxlength="40" value="${esc(PLAN_NAMES[p.goal] || "My plan")}"></div>
     <div class="field"><span class="label">Goal for this plan</span><div class="opts">${GOALS.map(g => { const t = targets({...p, goal: g.id}); return `<button type="button" class="opt" data-g="${g.id}" aria-pressed="${g.id === p.goal}">${icon({lose: "flame", maintain: "scale", gain: "dumbbell"}[g.id])}<span><b>${g.label}</b><small>${t ? `${fmt(t.kcal)} kcal · P ${t.p} · C ${t.c} · F ${t.f} g` : ""}</small></span></button>`; }).join("")}</div></div>
     <div class="field"><span class="label">Meals</span><div class="opts"><button type="button" class="opt" data-gen="1" aria-pressed="true">${icon("sparkles")}<span><b>Generate meals for me</b><small>${p.mealsPerDay} meals from the foods you like, sized to your targets</small></span></button>
      <button type="button" class="opt" data-gen="0" aria-pressed="false">${icon("plus")}<span><b>Start empty</b><small>${p.mealsPerDay} empty meals to fill yourself</small></span></button></div></div></form>`;
    b.onclick = e => { const g = e.target.closest("[data-g]"), gn = e.target.closest("[data-gen]");
      if (g) { $$("[data-g]", b).forEach(x => x.setAttribute("aria-pressed", x === g)); const nm = $("#npn", b); if (Object.values(PLAN_NAMES).includes(nm.value)) nm.value = PLAN_NAMES[g.dataset.g]; }
      if (gn) $$("[data-gen]", b).forEach(x => x.setAttribute("aria-pressed", x === gn)); };
  }, footer: (f, close, api) => {
    f.innerHTML = `<button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" data-ok>${icon("check", "sm")}Create plan</button>`;
    f.onclick = e => { if (!e.target.closest("[data-ok]")) return; const b = api.body; const name = $("#npn", b).value.trim() || "My plan";
      close({name, goal: $('[data-g][aria-pressed="true"]', b).dataset.g, gen: $('[data-gen][aria-pressed="true"]', b).dataset.gen === "1"}); };
  }});
  if (!res) return;
  const prof = ctx.profile(), now = ctx.now();
  const plan = newDietPlan(prof, {goal: res.goal, name: res.name, uid: ctx.uid, now, generate: res.gen});
  if (!res.gen) plan.meals = mealLayout(prof.mealsPerDay).map(([n]) => ({id: ctx.uid(), name: n, items: []}));
  const first = !prof.nutrition.activePlanId;
  if (ctx.save(d => { d.nutrition.plans[plan.id] = plan; if (first) d.nutrition.activePlanId = plan.id; }, `${plan.name} created`)) { viewPlanId = first ? null : plan.id; ctx.go("#/nutrition/today"); }
}
async function switchPlanSheet(ctx) {
  const p = ctx.profile(), plans = Object.values(p.nutrition.plans);
  const id = await sheet({title: "Diet plans", render: (b, close) => {
    b.innerHTML = `<div class="opts">${plans.map(pl => `<button type="button" class="opt" data-id="${pl.id}" aria-pressed="${pl.id === (currentPlan(p) || {}).id}">${icon("utensils")}<span><b>${esc(pl.name)}${pl.id === p.nutrition.activePlanId ? " · active" : ""}</b><small>${pl.meals.length} meals · ${kcal(planTotals(pl, ctx.foodById).kcal)} kcal</small></span></button>`).join("")}</div>
     <button type="button" class="btn ghost block" data-new style="margin-top:12px">${icon("plus", "sm")}New plan</button>`;
    b.onclick = e => { const o = e.target.closest("[data-id]"); if (o) close(o.dataset.id); if (e.target.closest("[data-new]")) close("__new"); };
  }});
  if (!id) return;
  if (id === "__new") return newPlanSheet(ctx);
  ctx.save(d => { d.nutrition.activePlanId = id; }, `${p.nutrition.plans[id].name} is now active`); viewPlanId = null; ctx.rerender();
}
async function targetsSheet(ctx, planId) {
  const p = ctx.profile(), pl = p.nutrition.plans[planId], auto = targets({...p, goal: pl.goal || p.goal}), cur = pl.customTargets || auto || {kcal: 2000, p: 120, c: 220, f: 65};
  return sheet({title: `Targets · ${pl.name}`, render: b => {
    b.innerHTML = `<div class="opts"><button type="button" class="opt" data-m="auto" aria-pressed="${!pl.customTargets}">${icon("sparkles")}<span><b>Calculate from my profile</b><small>${auto ? `${fmt(auto.kcal)} kcal · P ${auto.p} · C ${auto.c} · F ${auto.f} g` : "Needs body details"}</small></span></button>
      <button type="button" class="opt" data-m="custom" aria-pressed="${!!pl.customTargets}">${icon("square-pen")}<span><b>Set my own targets</b><small>For a coach's or dietitian's numbers</small></span></button></div>
      <div class="grid2 ${pl.customTargets ? "" : "hidden"}" id="ct" style="grid-template-columns:1fr 1fr;margin-top:12px">
       ${[["tk", "Calories", cur.kcal, "kcal"], ["tp", "Protein", cur.p, "g"], ["tc", "Carbs", cur.c, "g"], ["tf", "Fat", cur.f, "g"]].map(([id, l, v2, u]) => `<div class="field"><label for="${id}">${l}</label><div class="unit-in"><input id="${id}" type="number" inputmode="numeric" min="0" value="${v2}"><span>${u}</span></div></div>`).join("")}
       <p class="faint" style="grid-column:1/-1;font-size:12.5px" id="ctchk"></p></div><div class="err-msg" id="terr"></div>`;
    const chk = () => { const k = +$("#tk", b).value, m = +$("#tp", b).value * 4 + +$("#tc", b).value * 4 + +$("#tf", b).value * 9; $("#ctchk", b).textContent = `Macros add up to ${fmt(m)} kcal${Math.abs(m - k) > 50 ? ` — ${fmt(Math.abs(m - k))} kcal ${m > k ? "more" : "less"} than the calorie target` : ""}.`; };
    b.oninput = chk; chk();
    b.onclick = e => { const m = e.target.closest("[data-m]"); if (m) { $$("[data-m]", b).forEach(x => x.setAttribute("aria-pressed", x === m)); $("#ct", b).classList.toggle("hidden", m.dataset.m !== "custom"); } };
  }, footer: (f, close, api) => {
    f.innerHTML = `<button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" data-ok>${icon("save", "sm")}Save targets</button>`;
    f.onclick = e => { if (!e.target.closest("[data-ok]")) return; const b = api.body, mode = $('[data-m][aria-pressed="true"]', b).dataset.m;
      if (mode === "auto") { updPlan(ctx, planId, x => { delete x.customTargets; }, "Targets follow your profile"); return close(true); }
      const t = {kcal: +$("#tk", b).value, p: +$("#tp", b).value, c: +$("#tc", b).value, f: +$("#tf", b).value};
      if (!(t.kcal >= 1000 && t.kcal <= 6000)) { $("#terr", b).textContent = "Enter a calorie target between 1,000 and 6,000 kcal."; return; }
      if (![t.p, t.c, t.f].every(x => x >= 0 && x <= 600)) { $("#terr", b).textContent = "Enter macros between 0 and 600 g."; return; }
      updPlan(ctx, planId, x => { x.customTargets = t; }, "Custom targets saved"); close(true); };
  }});
}

// =====================================================================
// Food database
// =====================================================================
const dbState = {q: "", cat: "", tab: "all"};
function foodsView(v, ctx) {
  v.innerHTML = `<section class="card"><div class="input-wrap">${icon("search")}<input class="input" type="search" id="dq" placeholder="Search ${ctx.foods().length} foods" value="${esc(dbState.q)}" aria-label="Search foods"></div>
    <div class="chips" style="margin-top:10px">${[["all", "All", "list"], ["fav", "Favourites", "star"], ["recent", "Recent", "history"], ["mine", "My foods", "square-pen"]].map(([id, l, ic]) => `<button type="button" class="chip" data-tab="${id}" aria-pressed="${dbState.tab === id}">${icon(ic)}${l}</button>`).join("")}</div>
    <div class="chips scroll" style="margin-top:8px">${CATS.filter(c => c.id !== "custom").map(c => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${dbState.cat === c.id}">${icon(c.icon)}${c.label}</button>`).join("")}</div></section>
   <div class="row" style="margin:14px 0 6px"><span class="faint" id="dcount" style="flex:1;font-size:13px"></span><button type="button" class="btn ghost sm" data-a="custom">${icon("plus", "sm")}Custom food</button></div>
   <div class="card tight"><div id="dres"></div></div>
   <p class="src" style="margin-top:12px">${icon("info", "sm")} Values per 100 g (or 100 ml for drinks) from <a href="${FOOD_SOURCE.url}" target="_blank" rel="noopener">${esc(FOOD_SOURCE.name)}</a>, ${esc(FOOD_SOURCE.version)}. Raw and cooked foods are listed separately because their values differ.</p>`;
  const draw = () => { const list = filterFoods(ctx, dbState); $("#dcount", v).textContent = `${list.length} food${list.length === 1 ? "" : "s"}`;
    $("#dres", v).innerHTML = foodRows(ctx, list, ctx.profile().nutrition.favorites) || `<div class="empty">${icon("search")}<h3>No foods found</h3><p>${dbState.tab === "mine" ? "You haven't created any foods yet." : dbState.tab === "fav" ? "Tap the star on a food to add it here." : "Try another search."}</p></div>`; };
  $("#dq", v).oninput = e => { dbState.q = e.target.value; draw(); };
  draw();
  v.onclick = async e => {
    const tb = e.target.closest("[data-tab]"); if (tb) { dbState.tab = tb.dataset.tab; return ctx.rerender(); }
    const cb = e.target.closest("[data-cat]"); if (cb) { dbState.cat = dbState.cat === cb.dataset.cat ? "" : cb.dataset.cat; return ctx.rerender(); }
    const fav = e.target.closest("[data-fav]"); if (fav) { toggleFav(ctx, fav.dataset.fav); return draw(); }
    if (e.target.closest("[data-a=custom]")) { if (await customFoodSheet(ctx)) { dbState.tab = "mine"; ctx.rerender(); } return; }
    const r = e.target.closest("[data-food]"); if (r) { await foodDetail(ctx, r.dataset.food); draw(); }
  };
}
async function foodDetail(ctx, id) {
  const f = ctx.foodById(id); if (!f) return;
  const res = await sheet({title: f.name, render: b => {
    const per = nutrientsFor(f, 100, "g"), perMl = f.unit === "ml" ? nutrientsFor(f, 100, "ml") : null, pc = f.pieces || [];
    const row = (l, k, u = "g") => `<tr><td>${l}</td><td class="n">${per[k] == null ? "–" : fmt(per[k], k === "kcal" ? 0 : 1) + " " + u}</td>${perMl ? `<td class="n">${perMl[k] == null ? "–" : fmt(perMl[k], k === "kcal" ? 0 : 1) + " " + u}</td>` : ""}${pc[0] ? `<td class="n">${(() => { const x = nutrientsFor(f, pc[0].g, "g")[k]; return x == null ? "–" : fmt(x, k === "kcal" ? 0 : 1) + " " + u; })()}</td>` : ""}</tr>`;
    b.innerHTML = `<div class="row wrap-ok" style="gap:6px;margin-bottom:12px"><span class="badge">${(CATS.find(c => c.id === f.cat) || {label: "My food"}).label}</span><span class="badge">${ROLE_LABEL[f.role] || ""}</span>${f.unit === "ml" ? `<span class="badge">Liquid · ${f.density} g/ml</span>` : ""}${allowed(f, ctx.profile()) ? "" : '<span class="badge warn">Not in your diet</span>'}</div>
     <table class="t"><thead><tr><th>Nutrient</th><th class="n">per 100 g</th>${perMl ? '<th class="n">per 100 ml</th>' : ""}${pc[0] ? `<th class="n">per ${esc(pc[0].label)} (${fmt(pc[0].g, 1)} g)</th>` : ""}</tr></thead><tbody>
      ${row("Energy", "kcal", "kcal")}${row("Protein", "p")}${row("Carbohydrate", "c")}${row("Fat", "f")}${row("Fiber", "fiber")}${row("Sugars", "sugar")}${row("Saturated fat", "satFat")}${row("Sodium", "sodium", "mg")}</tbody></table>
     <p class="src" style="margin-top:12px">${f.custom ? `${icon("square-pen", "sm")} Custom food — values entered by you.` : `${icon("info", "sm")} Source: ${esc(f.src.db)}, FDC ID <a href="https://fdc.nal.usda.gov/food-details/${f.src.fdcId}/nutrients" target="_blank" rel="noopener">${f.src.fdcId}</a> — “${esc(f.src.desc)}”.`}</p>`;
  }, footer: (fo, close) => {
    const fav = ctx.profile().nutrition.favorites.includes(f.id);
    fo.innerHTML = `<button type="button" class="btn ghost" data-a="fav">${icon("star", "sm")}${fav ? "Unfavourite" : "Favourite"}</button>${f.custom ? `<button type="button" class="btn ghost" data-a="edit">${icon("pencil", "sm")}Edit</button><button type="button" class="btn danger" data-a="del" aria-label="Delete food">${icon("trash-2", "sm")}</button>` : ""}<button type="button" class="btn primary" data-a="add">${icon("plus", "sm")}Add to a meal</button>`;
    fo.onclick = e => { const a = e.target.closest("[data-a]")?.dataset.a; if (a) close(a); };
  }});
  if (res === "fav") toggleFav(ctx, f.id);
  if (res === "edit") await customFoodSheet(ctx, f);
  if (res === "del" && await confirmDialog({title: `Delete ${f.name}?`, message: "Meals that use it will show it as an unknown food until you remove or replace it.", confirm: "Delete food", danger: true})) ctx.save(d => { delete d.nutrition.customFoods[f.id]; }, "Food deleted");
  if (res === "add") {
    const p = ctx.profile(), plan = currentPlan(p); if (!plan) return toast("Create a diet plan first.", {error: true});
    const mid = await sheet({title: `Add to ${plan.name}`, render: (b, close) => { b.innerHTML = `<div class="opts">${plan.meals.map(m => `<button type="button" class="opt" data-m="${m.id}">${icon("utensils")}<span><b>${esc(m.name)}</b><small>${kcal(mealTotals(m, ctx.foodById).kcal)} kcal</small></span></button>`).join("")}</div>`; b.onclick = e => { const o = e.target.closest("[data-m]"); if (o) close(o.dataset.m); }; }});
    if (!mid) return;
    const u = defaultUnit(f), pc = f.pieces && f.pieces[0];
    addItem(ctx, plan.id, mid, {food: f, qty: pc && pc.g < 150 && f.role !== "fat" ? practical(pc.g, "g") : (u === "ml" ? 250 : f.role === "fat" ? 10 : 100), unit: u});
  }
}

// =====================================================================
// Targets (calculator)
// =====================================================================
function targetsView(v, ctx) {
  const p = ctx.profile(), t = targets(p), act = ACTIVITY.find(a => a.id === p.activity) || ACTIVITY[2], goal = GOALS.find(g => g.id === p.goal) || GOALS[1];
  if (!t) { v.innerHTML = `<div class="card empty">${icon("target")}<h3>Add your details</h3><p>Age, height and weight are needed to calculate targets.</p><button type="button" class="btn primary" id="ep">Edit profile</button></div>`; $("#ep", v).onclick = () => ctx.go("#/edit"); return; }
  const pg = {lose: 2.0, maintain: 1.6, gain: 1.8}[p.goal];
  v.innerHTML = `<section class="card"><div class="eyebrow">Your daily target</div><div class="row" style="align-items:baseline;margin:4px 0 10px"><b style="font:700 46px/1 var(--f-head);color:var(--brand)">${fmt(t.kcal)}</b><span class="muted">kcal a day</span></div>
    <div class="grid2" style="grid-template-columns:repeat(3,1fr)">${[["Protein", t.p, "var(--protein)", t.p * 4], ["Carbs", t.c, "var(--carbs)", t.c * 4], ["Fat", t.f, "var(--fat)", t.f * 9]].map(([l, g, c, k]) => `<div class="card flat tight"><div class="row" style="gap:6px"><span class="dot" style="background:${c}"></span><span class="eyebrow">${l}</span></div><div style="font:700 26px var(--f-head)">${g} g</div><div class="faint" style="font-size:12px">${r0(k / t.kcal * 100)}% of calories</div></div>`).join("")}</div>
    <button type="button" class="btn ghost block" id="ep" style="margin-top:14px">${icon("square-pen", "sm")}Change my details or goal</button></section>
   <section class="card" style="margin-top:12px"><h3 style="margin-bottom:10px">How this is calculated</h3>
    <dl class="kv"><dt>1. Basal metabolic rate (BMR)</dt><dd>${fmt(t.bmr)} kcal</dd><dt class="faint" style="grid-column:1/-1;font-size:12.5px">Mifflin–St Jeor: 10 × ${fmt(p.weightKg, 1)} kg + 6.25 × ${p.heightCm} cm − 5 × ${p.age} yrs ${p.sex === "female" ? "− 161" : "+ 5"}</dt>
     <dt>2. Daily energy use (TDEE)</dt><dd>${fmt(t.tdee)} kcal</dd><dt class="faint" style="grid-column:1/-1;font-size:12.5px">BMR × ${act.factor} (${act.label.toLowerCase()})</dt>
     <dt>3. Goal: ${goal.label.toLowerCase()}</dt><dd>${t.adjust > 0 ? "+" : t.adjust < 0 ? "−" : "±"}${fmt(Math.abs(t.adjust))} kcal</dd>
     ${t.floored ? `<dt class="faint" style="grid-column:1/-1;font-size:12.5px;color:var(--warn)">Raised to a safe minimum (your BMR, and at least ${p.sex === "female" ? "1,200" : "1,500"} kcal).</dt>` : ""}
     <dt>4. Protein</dt><dd>${pg} g/kg × ${fmt(t.refKg, 1)} kg</dd>${t.refKg < p.weightKg ? `<dt class="faint" style="grid-column:1/-1;font-size:12.5px">Based on the weight for a BMI of 27.5, so protein isn't overstated.</dt>` : ""}
     <dt>5. Fat</dt><dd>25% of calories</dd><dt>6. Carbs</dt><dd>The remaining calories</dd></dl>
    <p class="faint" style="font-size:13px;margin-top:12px">${icon("info", "sm")} These are estimates. Individual needs vary with genetics, body composition and daily activity. Track your weight for 2–3 weeks and adjust by 100–200 kcal if it isn't moving as intended. If you have a medical condition, are pregnant or under 18, check with a professional.</p></section>`;
  $("#ep", v).onclick = () => ctx.go("#/edit");
}
