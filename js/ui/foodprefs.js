// Food Preferences, by category: Protein → Carbs → Fats. Each tile is a general food ("Eggs", "Rice");
// tap it to like it, tap its thumbs-down to dislike it. The exact variant is picked later in a meal.
import {$, $$, esc, icon, ibtn, toast, confirmDialog} from "./dom.js";
import {FOODS} from "../data/foods.js";
import {PREF_ROLES} from "../data/foodgroups.js";
import {prefGroups, groupState, setGroupPref, restriction, likedIds, dislikedIds, generatePlan, planTargets} from "../core/nutrition.js";

const foodById = (id, custom) => FOODS.find(f => f.id === id) || custom.find(f => f.id === id);
/** "allergy" / "diet" when every food in the group is ruled out, else null. */
function groupRestriction(g, rules, custom) {
  const rs = g.foods.map(id => { const f = foodById(id, custom); return f ? restriction(f, rules) : null; });
  return rs.every(Boolean) ? (rs.includes("allergy") ? "allergy" : "diet") : null;
}
export function roleCounts(map, role, custom = []) {
  const gs = prefGroups(custom).filter(g => g.role === role);
  return {liked: gs.filter(g => groupState(map, g) === "like").length, disliked: gs.filter(g => groupState(map, g) === "dislike").length};
}

/**
 * Tile grid for one category.
 *  getMap() / setMap(newMap) -> saved map or null on failure / getRules() -> {diet, allergies}
 */
export function prefGrid(el, {role, getMap, setMap, getRules, custom = [], search = false, onChange = () => {}}) {
  let q = "";
  const groups = prefGroups(custom).filter(g => g.role === role);
  const tile = g => {
    const s = groupState(getMap(), g), r = groupRestriction(g, getRules(), custom);
    const liked = s === "like", disliked = s === "dislike";
    return `<div class="ptile${liked ? " liked" : ""}${disliked ? " disliked" : ""}${r ? " blocked" : ""}" data-g="${esc(g.id)}">
      <button type="button" class="ptile-main" data-a="like" aria-pressed="${liked}" ${r ? "disabled" : ""} aria-label="${esc(g.name)}: ${r ? (r === "allergy" ? "not available, allergy" : "not in your diet") : liked ? "liked, tap to clear" : "tap to like"}">
        <span class="ptile-ico">${icon(liked ? "thumbs-up" : g.icon)}</span><span class="ptile-name">${esc(g.name)}</span>
        <span class="ptile-sub">${r ? (r === "allergy" ? "Allergy" : "Not in your diet") : liked ? "Liked" : disliked ? "Disliked" : s === "mixed" ? "Some types disliked" : ""}</span></button>
      <button type="button" class="ptile-x" data-a="dislike" aria-pressed="${disliked}" aria-label="${disliked ? "Clear dislike for " : "Dislike "}${esc(g.name)}" data-tip="${disliked ? "Clear dislike" : "Dislike"}">${icon("thumbs-down")}</button></div>`;
  };
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = groups.filter(g => words.every(w => g.name.toLowerCase().includes(w)));
    const sections = [...new Set(list.map(g => g.section))];
    $(".pgrid-body", el).innerHTML = list.length ? sections.map(sec => `<h4 class="psec">${esc(sec)}</h4><div class="pgrid">${list.filter(g => g.section === sec).map(tile).join("")}</div>`).join("")
      : `<div class="empty">${icon("search")}<h3>No foods found</h3><p>Try another word.</p></div>`;
  };
  el.innerHTML = `${search ? `<div class="input-wrap" style="margin-bottom:6px">${icon("search")}<input class="input" type="search" placeholder="Search ${esc(PREF_ROLES.find(r => r.id === role).label.toLowerCase())}" aria-label="Search foods"></div>` : ""}<div class="pgrid-body"></div>`;
  if (search) $("input", el).oninput = e => { q = e.target.value; draw(); };
  el.onclick = e => {
    const b = e.target.closest("[data-a]"), t = b && b.closest("[data-g]"); if (!t || b.disabled) return;
    const g = groups.find(x => x.id === t.dataset.g), s = groupState(getMap(), g);
    const next = b.dataset.a === "like" ? (s === "like" ? "neutral" : "like") : (s === "dislike" ? "neutral" : "dislike");
    if (!setMap(setGroupPref(getMap(), g, next))) return;
    const tmp = document.createElement("div"); tmp.innerHTML = tile(g); const nu = tmp.firstElementChild;
    t.replaceWith(nu); nu.classList.add("flash"); nu.querySelector(`[data-a="${b.dataset.a}"]`).focus();
    onChange(getMap());
  };
  draw();
  return {refresh: draw};
}

// ---------- the Food Preferences page (from Profile) ----------
export function renderPrefsPage(el, ctx, startRole = "protein") {
  let role = PREF_ROLES.some(r => r.id === startRole) ? startRole : "protein", changed = false;
  const custom = () => Object.values(ctx.profile().nutrition.customFoods || {});
  const getMap = () => (ctx.profile() || {}).foodPrefs || {};
  const setMap = m => { const r = ctx.save(d => { d.foodPrefs = m; }); return r ? r.foodPrefs : null; };
  const getRules = () => { const p = ctx.profile(); return {diet: p.diet, allergies: p.allergies}; };
  el.innerHTML = `<header class="topbar"><div class="wrap">${ibtn("chevron-left", "Back to profile", 'id="pback"')}<h1>Food Preferences</h1></div></header>
   <div class="wrap" style="margin-top:14px">
    <p class="muted">Tell us what you enjoy eating so we can personalize your meal plans. Pick general foods here; you can switch to a specific type (brown rice, boiled eggs…) inside any meal.</p>
    <div class="row wrap-ok" style="gap:8px;margin:12px 0" id="psum"></div>
    <div class="seg" role="tablist" id="ptabs"></div>
    <section class="card" id="pgrid"></section>
    <div class="row" style="margin-top:12px;gap:10px" id="pnav"></div>
    <section class="card hidden" id="papply" style="margin-top:12px;border-color:var(--brand-line)"></section>
   </div>`;
  $("#pback", el).onclick = () => ctx.go("#/me");
  const summary = () => {
    const m = getMap(), L = likedIds({foodPrefs: m}).length, D = dislikedIds({foodPrefs: m}).length;
    $("#psum", el).innerHTML = PREF_ROLES.map(r => { const c = roleCounts(m, r.id, custom()); return `<span class="badge">${r.label}: <b style="color:var(--ok)">${c.liked}</b> ${icon("thumbs-up", "sm")} <b style="color:var(--danger)">${c.disliked}</b> ${icon("thumbs-down", "sm")}</span>`; }).join("")
      + `<span class="spacer"></span>${L + D ? `<button type="button" class="btn ghost sm" data-reset>${icon("rotate-ccw", "sm")}Reset all</button>` : ""}`;
    $("#ptabs", el).innerHTML = PREF_ROLES.map(r => { const c = roleCounts(m, r.id, custom()); return `<button role="tab" aria-selected="${r.id === role}" data-role="${r.id}">${icon(r.icon, "sm")}${r.label}${c.liked ? ` <span class="badge ok" style="padding:0 6px">${c.liked}</span>` : ""}</button>`; }).join("");
  };
  const show = () => {
    const i = PREF_ROLES.findIndex(r => r.id === role), R = PREF_ROLES[i];
    prefGrid($("#pgrid", el), {role, getMap, setMap, getRules, custom: custom(), search: true, onChange: () => { changed = true; summary(); apply(); }});
    $("#pgrid", el).insertAdjacentHTML("afterbegin", `<p class="faint" style="font-size:13px;margin-bottom:10px">${esc(R.hint)} Tap to like · ${icon("thumbs-down", "sm")} to dislike.</p>`);
    $("#pnav", el).innerHTML = `${i ? `<button type="button" class="btn ghost" data-go="${PREF_ROLES[i - 1].id}">${icon("chevron-left", "sm")}${PREF_ROLES[i - 1].label}</button>` : ""}<span class="spacer"></span>
      ${i < PREF_ROLES.length - 1 ? `<button type="button" class="btn primary" data-go="${PREF_ROLES[i + 1].id}">Next: ${PREF_ROLES[i + 1].label}${icon("chevron-right", "sm")}</button>` : `<button type="button" class="btn primary" data-done>${icon("check", "sm")}Done</button>`}`;
    summary();
  };
  el.onclick = async e => {
    const t = e.target.closest("[data-role]"); if (t) { role = t.dataset.role; return show(); }
    const g = e.target.closest("[data-go]"); if (g) { role = g.dataset.go; show(); return window.scrollTo({top: 0, behavior: "smooth"}); }
    if (e.target.closest("[data-done]")) return ctx.go("#/me");
    if (e.target.closest("[data-reset]")) {
      const before = {...getMap()}; if (!setMap({})) return;
      changed = true; show(); apply();
      toast("All food preferences reset", {action: {label: "Undo", run: () => { if (setMap(before)) { show(); } }}});
    }
  };
  function apply() {
    const p = ctx.profile(), plan = p.nutrition.plans[p.nutrition.activePlanId], box = $("#papply", el);
    if (!changed || !plan) return box.classList.add("hidden");
    box.classList.remove("hidden");
    box.innerHTML = `<div class="row" style="gap:12px"><span class="cat-ico" style="background:var(--brand-soft);color:var(--brand)">${icon("refresh-cw")}</span><div style="flex:1"><b>Apply to “${esc(plan.name)}”?</b><div class="muted" style="font-size:13px">Your meals were built before these changes. Regenerate them to use your new preferences.</div></div></div>
      <button type="button" class="btn primary block" data-regen style="margin-top:12px">${icon("sparkles", "sm")}Regenerate meals</button>`;
    $("[data-regen]", box).onclick = async () => {
      if (!await confirmDialog({title: `Regenerate ${plan.name}?`, message: "The meals in this plan are replaced with new ones built from your preferences. Your other plans aren't touched.", confirm: "Regenerate"})) return;
      const prof = ctx.profile(), T = planTargets(prof, plan);
      if (!T) return toast("Add your body details first.", {error: true});
      const {meals, notes} = generatePlan({targets: T, mealsPerDay: prof.mealsPerDay, foods: ctx.foods(), prefs: prof, uid: ctx.uid});
      if (ctx.save(d => { const pl = d.nutrition.plans[plan.id]; if (!pl) return false; pl.meals = meals; pl.notes = notes; pl.updatedAt = new Date().toISOString(); }, "New meals generated")) ctx.go("#/nutrition/today");
    };
  }
  show();
}
/** For the Profile page: names of liked general foods. */
export function prefsSummary(p) {
  const custom = Object.values(p.nutrition.customFoods || {}), gs = prefGroups(custom), m = p.foodPrefs || {};
  const liked = gs.filter(g => groupState(m, g) === "like"), disliked = gs.filter(g => groupState(m, g) === "dislike");
  return {liked: liked.length, disliked: disliked.length, likedNames: liked.map(g => g.name)};
}
