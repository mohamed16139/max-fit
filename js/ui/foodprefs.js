// Food Preferences: one searchable list where every food has exactly one state — like, neutral or dislike.
// Used in onboarding (on a draft) and on its own page from Profile (saved immediately).
import {$, $$, esc, icon, ibtn, toast, confirmDialog} from "./dom.js";
import {FOODS} from "../data/foods.js";
import {foodPref, setFoodPref, restriction, likedIds, dislikedIds, generatePlan, planTargets} from "../core/nutrition.js";

// Display categories (meat and fish are split using the food's flags).
export const PREF_CATS = [
  {id: "meat", label: "Meat & poultry", icon: "beef"}, {id: "fish", label: "Fish & seafood", icon: "fish"},
  {id: "dairy", label: "Eggs & dairy", icon: "egg"}, {id: "grains", label: "Grains & carbs", icon: "wheat"},
  {id: "fruit", label: "Fruits", icon: "apple"}, {id: "veg", label: "Vegetables", icon: "carrot"},
  {id: "legumes", label: "Legumes", icon: "leaf"}, {id: "nuts", label: "Nuts & seeds", icon: "nut"},
  {id: "fats", label: "Oils & fats", icon: "droplet"}, {id: "snacks", label: "Snacks", icon: "cookie"},
  {id: "drinks", label: "Beverages", icon: "milk"}, {id: "custom", label: "My foods", icon: "star"},
];
export function prefCat(f) {
  if (f.custom) return "custom";
  if (f.cat === "meat") return (f.flags || []).some(x => x === "fish" || x === "shellfish") ? "fish" : "meat";
  return f.cat;
}
const catOf = f => PREF_CATS.find(c => c.id === prefCat(f)) || PREF_CATS[0];
const STATE_UI = {
  like: {icon: "thumbs-up", label: "Like"},
  neutral: {icon: "minus", label: "No preference"},
  dislike: {icon: "thumbs-down", label: "Dislike"},
};

/**
 * Mount the editor.
 *  getMap()            current {foodId: "like"|"dislike"} map
 *  setState(id, s)     persist one change; return the new map, or null if saving failed
 *  resetAll()          clear every preference; return the new map or null
 *  restoreAll(map)     put a previous map back (used by Undo); return the new map or null
 *  getRules()          {diet, allergies} — hard restrictions, shown on the rows
 *  foods               foods to list (database + the profile's custom foods)
 *  compact             limit the list height (for use inside onboarding)
 * Returns {refresh()} to redraw rows after the rules change.
 */
export function foodPrefsEditor(el, {getMap, setState, resetAll, restoreAll, getRules, foods = FOODS, compact = false, onChange = () => {}}) {
  const st = {q: "", filter: "all", cat: ""};
  const prof = () => ({foodPrefs: getMap(), ...getRules()});
  el.innerHTML = `<div class="prefs">
    <div class="row wrap-ok" style="gap:8px;margin-bottom:12px" id="psum"></div>
    <div class="input-wrap">${icon("search")}<input class="input" type="search" id="pq" placeholder="Search foods" autocomplete="off" aria-label="Search foods" aria-controls="plist"></div>
    <div class="chips" role="group" aria-label="Show" style="margin-top:10px">
      ${[["all", "All foods", "list"], ["like", "Liked", "thumbs-up"], ["dislike", "Disliked", "thumbs-down"]].map(([id, l, ic]) => `<button type="button" class="chip" data-filter="${id}" aria-pressed="${id === "all"}">${icon(ic)}${l}<span class="num" data-count="${id}"></span></button>`).join("")}</div>
    <div class="chips scroll" role="group" aria-label="Category" style="margin-top:8px">
      <button type="button" class="chip" data-cat="" aria-pressed="true">All categories</button>
      ${PREF_CATS.filter(c => c.id !== "custom" || foods.some(f => f.custom)).map(c => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="false">${icon(c.icon)}${c.label}</button>`).join("")}</div>
    <div class="faint" id="pcount" style="font-size:13px;margin:12px 0 4px" aria-live="polite"></div>
    <div class="pref-list${compact ? " compact" : ""}" id="plist"></div></div>`;

  const summary = () => {
    const m = getMap(), nL = Object.values(m).filter(v => v === "like").length, nD = Object.values(m).filter(v => v === "dislike").length;
    $("#psum", el).innerHTML = `<span class="badge ok">${icon("thumbs-up", "sm")}${nL} liked</span><span class="badge" style="background:var(--danger-soft);color:var(--danger)">${icon("thumbs-down", "sm")}${nD} disliked</span><span class="spacer"></span>
      ${nL + nD ? `<button type="button" class="btn ghost sm" data-reset>${icon("rotate-ccw", "sm")}Reset all</button>` : `<span class="faint" style="font-size:13px">Everything is neutral until you choose</span>`}`;
    $('[data-count="like"]', el).textContent = nL ? ` ${nL}` : "";
    $('[data-count="dislike"]', el).textContent = nD ? ` ${nD}` : "";
  };
  const matches = f => {
    const s = foodPref(prof(), f.id);
    if (st.filter !== "all" && s !== st.filter) return false;
    if (st.cat && prefCat(f) !== st.cat) return false;
    const words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    return words.every(w => (f.name + " " + catOf(f).label).toLowerCase().includes(w));
  };
  const rowHTML = f => {
    const p = prof(), s = foodPref(p, f.id), r = restriction(f, p);
    const tag = r ? `<span class="badge warn">${icon("ban", "sm")}${r === "allergy" ? "Allergy" : "Not in your diet"}</span>` : "";
    return `<div class="pref-row" data-id="${esc(f.id)}" data-state="${s}">
      <span class="cat-ico" aria-hidden="true">${icon(catOf(f).icon)}</span>
      <div class="main"><div class="title">${esc(f.name)}</div><div class="sub">${esc(catOf(f).label)} ${tag}</div></div>
      <div class="tri" role="radiogroup" aria-label="Preference for ${esc(f.name)}">
        ${["like", "neutral", "dislike"].map(k => {
          const blocked = k === "like" && r;
          return `<button type="button" role="radio" data-s="${k}" aria-checked="${s === k}" tabindex="${s === k ? 0 : -1}" aria-label="${STATE_UI[k].label}${blocked ? " (not available: " + (r === "allergy" ? "allergy" : "diet") + ")" : ""}" data-tip="${blocked ? "Conflicts with your " + (r === "allergy" ? "allergies" : "diet") : STATE_UI[k].label}" ${blocked ? "disabled" : ""}>${icon(STATE_UI[k].icon)}</button>`;
        }).join("")}</div></div>`;
  };
  const list = () => {
    const res = foods.filter(matches);
    $("#pcount", el).textContent = `${res.length} food${res.length === 1 ? "" : "s"}${st.filter !== "all" ? (st.filter === "like" ? " liked" : " disliked") : ""}`;
    $("#plist", el).innerHTML = res.length ? res.map(rowHTML).join("") : `<div class="empty">${icon(st.filter === "like" ? "thumbs-up" : st.filter === "dislike" ? "thumbs-down" : "search")}
      <h3>${st.filter === "like" ? "No liked foods yet" : st.filter === "dislike" ? "No disliked foods" : "No foods found"}</h3>
      <p>${st.filter !== "all" ? "Switch to All foods and tap the thumbs on anything you enjoy or avoid." : "Try another word or category."}</p></div>`;
    summary();
  };
  const updateRow = id => {
    const row = $(`.pref-row[data-id="${CSS.escape(id)}"]`, el), f = foods.find(x => x.id === id); if (!row || !f) return;
    const tmp = document.createElement("div"); tmp.innerHTML = rowHTML(f);
    const nu = tmp.firstElementChild; row.replaceWith(nu); nu.classList.add("flash");
    return nu;
  };
  const choose = (id, s) => {
    if (foodPref(prof(), id) === s) return;
    const res = setState(id, s);
    if (!res) return;                       // save failed: the row stays as it was
    const row = updateRow(id); summary(); onChange(getMap());
    const btn = row && $(`[data-s="${s}"]`, row); if (btn && document.activeElement && el.contains(document.activeElement)) btn.focus();
  };

  $("#pq", el).oninput = e => { st.q = e.target.value; list(); };
  el.addEventListener("click", e => {
    const b = e.target.closest(".tri [data-s]"); if (b && !b.disabled) return choose(b.closest(".pref-row").dataset.id, b.dataset.s);
    const fl = e.target.closest("[data-filter]"); if (fl) { st.filter = fl.dataset.filter; $$("[data-filter]", el).forEach(x => x.setAttribute("aria-pressed", x === fl)); return list(); }
    const c = e.target.closest("[data-cat]"); if (c) { st.cat = c.dataset.cat; $$("[data-cat]", el).forEach(x => x.setAttribute("aria-pressed", x === c)); return list(); }
    if (e.target.closest("[data-reset]")) {
      const before = {...getMap()};
      if (!resetAll()) return;
      list(); onChange(getMap());
      toast("All food preferences reset", {action: {label: "Undo", run: () => { if (restoreAll(before)) { list(); onChange(getMap()); } }}});
    }
  });
  // Arrow keys move within a row's three options, like a radio group.
  el.addEventListener("keydown", e => {
    const b = e.target.closest(".tri [data-s]"); if (!b || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const opts = $$("[data-s]:not([disabled])", b.parentElement), i = opts.indexOf(b), nx = opts[(i + (e.key === "ArrowRight" ? 1 : -1) + opts.length) % opts.length];
    choose(b.closest(".pref-row").dataset.id, nx.dataset.s); const row = $(`.pref-row[data-id="${CSS.escape(b.closest(".pref-row").dataset.id)}"]`, el); $(`[data-s="${nx.dataset.s}"]`, row)?.focus();
  });
  list();
  return {refresh: list};
}

// ---------- the Food Preferences page (from Profile) ----------
export function renderPrefsPage(el, ctx) {
  const pid = ctx.pid;
  let changed = false;
  el.innerHTML = `<header class="topbar"><div class="wrap">${ibtn("chevron-left", "Back to profile", 'id="pback"')}<h1>Food Preferences</h1></div></header>
   <div class="wrap" style="margin-top:14px">
    <p class="muted" style="margin-bottom:14px">Tell us what you enjoy eating so we can personalize your meal plans. Allergies and diet are set separately in your profile and always come first.</p>
    <section class="card" id="ped"></section>
    <section class="card hidden" id="papply" style="margin-top:12px;border-color:var(--brand-line)"></section>
   </div>`;
  $("#pback", el).onclick = () => ctx.go("#/me");
  const save = fn => { const r = ctx.save(d => { d.foodPrefs = fn(d.foodPrefs || {}); }); return r ? r.foodPrefs : null; };
  foodPrefsEditor($("#ped", el), {
    getMap: () => (ctx.profile() || {}).foodPrefs || {},
    setState: (id, s) => save(m => setFoodPref(m, id, s)),
    resetAll: () => save(() => ({})),
    restoreAll: map => save(() => map),
    getRules: () => { const p = ctx.profile(); return {diet: p.diet, allergies: p.allergies}; },
    foods: ctx.foods(),
    onChange: () => { changed = true; showApply(); },
  });
  function showApply() {
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
}
export function prefsSummary(p) {
  const L = likedIds(p), D = dislikedIds(p);
  return {liked: L.length, disliked: D.length, likedNames: L.map(id => (FOODS.find(f => f.id === id) || (p.nutrition.customFoods || {})[id] || {}).name).filter(Boolean)};
}
