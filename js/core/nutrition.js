// Nutrition calculations. Pure functions only: no DOM, no storage.
import {FOOD_GROUPS, RAW_FORMS} from "../data/foodgroups.js";
// Every number shown in the app (food rows, meal totals, day totals, generator, replacements)
// goes through nutrientsFor(), so they always agree.

export const ACTIVITY = [
  {id: "sedentary", factor: 1.2, label: "Sedentary", hint: "Desk job, little or no exercise"},
  {id: "light", factor: 1.375, label: "Lightly active", hint: "Exercise 1–3 days a week"},
  {id: "moderate", factor: 1.55, label: "Moderately active", hint: "Exercise 3–5 days a week"},
  {id: "very", factor: 1.725, label: "Very active", hint: "Hard exercise 6–7 days a week"},
  {id: "extra", factor: 1.9, label: "Extra active", hint: "Physical job plus daily training"},
];
export const GOALS = [
  {id: "lose", label: "Lose fat", hint: "About 20% below maintenance"},
  {id: "maintain", label: "Maintain weight", hint: "Eat at maintenance"},
  {id: "gain", label: "Build muscle", hint: "About 10% above maintenance"},
];
export const LIMITS = {age: [14, 90], heightCm: [120, 230], weightKg: [30, 300], mealsPerDay: [2, 6]};
const NUTRIENTS = ["kcal", "p", "c", "f", "fiber", "sugar", "satFat", "sodium"];

/** Mifflin–St Jeor (1990): BMR = 10·kg + 6.25·cm − 5·age + 5 (male) / −161 (female). kcal/day */
export function bmr({sex, weightKg, heightCm, age}) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "female" ? -161 : 5);
}
export function tdee(p) {
  const a = ACTIVITY.find(x => x.id === p.activity) || ACTIVITY[2];
  return bmr(p) * a.factor;
}

/** Which inputs are missing or out of range for the calculator. Empty array = valid. */
export function validateBody(p) {
  const bad = [];
  for (const k of ["age", "heightCm", "weightKg"]) {
    const v = +p[k], [lo, hi] = LIMITS[k];
    if (!Number.isFinite(v) || v < lo || v > hi) bad.push(k);
  }
  if (!["male", "female"].includes(p.sex)) bad.push("sex");
  return bad;
}

/**
 * Daily targets from a profile.
 * Calories: TDEE −20% to lose (deficit capped at 750 kcal), +10% to gain (surplus capped at 500).
 *   Never below BMR, 1200 kcal (female) or 1500 kcal (male) — common clinical floors for unsupervised diets.
 * Protein: 2.0 g/kg (lose), 1.6 g/kg (maintain), 1.8 g/kg (gain), within the ISSN range of 1.4–2.2 g/kg.
 *   For BMI over 27.5 it uses the weight at BMI 27.5, so protein isn't inflated by body fat.
 * Fat: 25% of calories, at least 0.6 g/kg. Carbs: whatever calories remain.
 */
export function targets(p) {
  if (validateBody(p).length) return null;
  const b = bmr(p), t = tdee(p), goal = p.goal || "maintain";
  let adj = 0;
  if (goal === "lose") adj = -Math.min(t * 0.2, 750);
  if (goal === "gain") adj = Math.min(t * 0.1, 500);
  const floor = Math.max(b, p.sex === "female" ? 1200 : 1500);
  const raw = t + adj, kcal = Math.round(Math.max(raw, floor) / 10) * 10;
  const h = p.heightCm / 100, refKg = Math.min(p.weightKg, 27.5 * h * h);
  const pg = Math.round(refKg * ({lose: 2.0, maintain: 1.6, gain: 1.8}[goal]));
  const fg = Math.round(Math.max(kcal * 0.25 / 9, 0.6 * refKg));
  const cg = Math.max(0, Math.round((kcal - pg * 4 - fg * 9) / 4));
  return {kcal, p: pg, c: cg, f: fg, bmr: Math.round(b), tdee: Math.round(t), adjust: Math.round(adj),
          floored: raw < floor, refKg: Math.round(refKg * 10) / 10};
}

// ---------- units ----------
export const UNITS = {g: "g", ml: "ml", L: "L"};
/** Units a food can be measured in. Solids: grams. Liquids: ml and L (converted with the food's density). */
export function unitsFor(food) { return food.unit === "ml" ? ["ml", "L", "g"] : ["g"]; }
/** Quantity in grams. Liquids use the food's density (g/ml) — grams and ml are never assumed equal. */
export function toGrams(food, qty, unit) {
  const q = +qty;
  if (!(q >= 0)) return NaN;
  if (unit === "g") return q;
  if (!food.density) return NaN;           // a solid can't be measured by volume
  if (unit === "ml") return q * food.density;
  if (unit === "L") return q * 1000 * food.density;
  return NaN;
}
export function fromGrams(food, grams, unit) {
  if (unit === "g") return grams;
  if (!food.density) return NaN;
  return unit === "L" ? grams / food.density / 1000 : grams / food.density;
}
export function convertQty(food, qty, from, to) { return fromGrams(food, toGrams(food, qty, from), to); }
export function defaultUnit(food) { return food.unit === "ml" ? "ml" : "g"; }

/** Nutrients for a quantity of food. nutrient = grams / 100 × value per 100 g. Unrounded. */
export function nutrientsFor(food, qty, unit = defaultUnit(food)) {
  const g = toGrams(food, qty, unit), out = {};
  for (const k of NUTRIENTS) out[k] = food.per100g[k] == null ? null : (Number.isFinite(g) ? g / 100 * food.per100g[k] : NaN);
  out.grams = g;
  return out;
}
export function sum(list) {
  const out = {kcal: 0, p: 0, c: 0, f: 0, fiber: 0, sugar: 0, satFat: 0, sodium: 0};
  for (const n of list) for (const k in out) if (Number.isFinite(n[k])) out[k] += n[k];
  return out;
}
export function mealTotals(meal, foodById) {
  return sum(meal.items.map(it => { const f = foodById(it.foodId); return f ? nutrientsFor(f, it.qty, it.unit) : {}; }));
}
export function planTotals(plan, foodById) { return sum(plan.meals.map(m => mealTotals(m, foodById))); }

/** Step size for the +/− buttons, so tapping gives practical portions. */
export function stepFor(food, unit) {
  if (unit === "L") return 0.1;
  if (unit === "ml") return food.role === "fat" ? 5 : 50;
  if (food.role === "fat" || (food.pieces[0] && food.pieces[0].g < 10)) return 5;
  if (food.role === "veg" || food.role === "carb" || food.role === "protein") return 10;
  return 10;
}
/** Round to a practical portion for display/generation (5 g / 5 ml, 0.05 L). */
export function practical(qty, unit) {
  if (unit === "L") return Math.round(qty * 20) / 20;
  return Math.max(0, Math.round(qty / 5) * 5);
}
export function pieceHint(food, qty, unit) {
  const pc = food.pieces && food.pieces[0];
  if (!pc) return "";
  const g = toGrams(food, qty, unit), n = Math.round(g / pc.g * 2) / 2;
  if (!(n > 0) || n > 40) return "";
  return `≈ ${n} ${pc.label}${n > 1 && !["tbsp", "tsp"].includes(pc.label) ? "s" : ""}`;
}

// ---------- restrictions ----------
export const DIETS = [
  {id: "none", label: "No restriction"},
  {id: "pescatarian", label: "Pescatarian", excludes: ["meat"]},
  {id: "vegetarian", label: "Vegetarian", excludes: ["meat", "fish", "shellfish"]},
  {id: "vegan", label: "Vegan", excludes: ["meat", "fish", "shellfish", "dairy", "egg"], alsoIds: ["honey"]},
];
export const ALLERGENS = [
  {id: "dairy", label: "Milk / dairy"}, {id: "egg", label: "Eggs"}, {id: "gluten", label: "Gluten / wheat"},
  {id: "fish", label: "Fish"}, {id: "shellfish", label: "Shellfish"}, {id: "peanut", label: "Peanuts"},
  {id: "treenut", label: "Tree nuts"}, {id: "soy", label: "Soy"}, {id: "sesame", label: "Sesame"},
];
/** Hard rules only — diet and allergies. A food that fails this is never suggested or added. */
export function allowed(food, prefs = {}) { return !restriction(food, prefs); }
/** Why a food is off-limits: "diet", "allergy", or null. Preferences are not restrictions. */
export function restriction(food, prefs = {}) {
  const diet = DIETS.find(d => d.id === (prefs.diet || "none")) || DIETS[0];
  const flags = food.flags || [];
  if ((prefs.allergies || []).some(x => flags.includes(x))) return "allergy";
  if ((diet.excludes || []).some(x => flags.includes(x)) || (diet.alsoIds || []).includes(food.id)) return "diet";
  return null;
}

// ---------- food preferences ----------
// One map per profile, food id -> "like" | "dislike". A food that isn't in the map is neutral.
// Because it's a map keyed by the stable food id, a food can only ever have one state.
export const PREF_STATES = ["like", "neutral", "dislike"];
export function foodPref(profile, id) { const v = (profile.foodPrefs || {})[id]; return v === "like" || v === "dislike" ? v : "neutral"; }
/** Returns a new map with one food set to a state; "neutral" removes the entry. */
export function setFoodPref(map, id, state) {
  const out = {...(map || {})};
  if (state === "like" || state === "dislike") out[id] = state; else delete out[id];
  return out;
}
export function normalizeFoodPrefs(map) {
  const out = {};
  for (const [id, v] of Object.entries(map || {})) if (id && (v === "like" || v === "dislike")) out[id] = v;
  return out;
}
/** Older data kept two lists. A food in both becomes "dislike" so it is never served against someone's wishes. */
export function prefsFromLists(liked = [], disliked = [], base = {}) {
  let m = normalizeFoodPrefs(base);
  for (const id of liked) if (!m[id]) m = setFoodPref(m, id, "like");
  for (const id of disliked) m = setFoodPref(m, id, "dislike");
  return m;
}
export const likedIds = p => Object.keys(p.foodPrefs || {}).filter(id => p.foodPrefs[id] === "like");
export const dislikedIds = p => Object.keys(p.foodPrefs || {}).filter(id => p.foodPrefs[id] === "dislike");
/**
 * General-food groups (data/foodgroups.js) plus one group per custom food. A group's state is derived
 * from its foods: liked if any type is liked (and none disliked), disliked likewise, "mixed" if both.
 */
export function prefGroups(customFoods = []) {
  const extra = customFoods.filter(f => ["protein", "carb", "fat", "fruit"].includes(f.role))
    .map(f => ({id: "custom:" + f.id, name: f.name, role: f.role === "fruit" ? "carb" : f.role, section: "My foods", icon: "star", foods: [f.id]}));
  return FOOD_GROUPS.concat(extra);
}
export function groupState(map, group) {
  const states = new Set(group.foods.map(id => foodPref({foodPrefs: map}, id)));
  const L = states.has("like"), D = states.has("dislike");
  return L && D ? "mixed" : L ? "like" : D ? "dislike" : "neutral";
}
/** Set every food in a group to one state (neutral removes them). */
export function setGroupPref(map, group, state) {
  let m = {...(map || {})};
  for (const id of group.foods) m = setFoodPref(m, id, state);
  return m;
}
/** Can the app suggest this food? Allowed by diet/allergies and not disliked. Neutral foods are fine. */
export function suggestible(food, prefs = {}) { return allowed(food, prefs) && foodPref(prefs, food.id) !== "dislike"; }

// ---------- meal layout ----------
// share = portion of the day's targets; tag = which foods suit the meal (b breakfast, m main, s snack).
const LAYOUTS = {
  2: [["Breakfast", "b", 1], ["Dinner", "m", 1.2]],
  3: [["Breakfast", "b", 1], ["Lunch", "m", 1.2], ["Dinner", "m", 1.1]],
  4: [["Breakfast", "b", 1], ["Lunch", "m", 1.2], ["Snack", "s", 0.5], ["Dinner", "m", 1.1]],
  5: [["Breakfast", "b", 1], ["Morning snack", "s", 0.5], ["Lunch", "m", 1.2], ["Afternoon snack", "s", 0.5], ["Dinner", "m", 1.1]],
  6: [["Breakfast", "b", 1], ["Morning snack", "s", 0.5], ["Lunch", "m", 1.2], ["Afternoon snack", "s", 0.5], ["Dinner", "m", 1.1], ["Evening snack", "s", 0.4]],
};
export function mealLayout(n) { return LAYOUTS[Math.min(6, Math.max(2, n | 0))] || LAYOUTS[4]; }

// ---------- generator ----------
function solve(A, b) { // small Gaussian elimination
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
const GROUPS = [["protein", "p"], ["carb", "c"], ["fat", "f"]];
/** Grams of each food so the picked foods hit macro target t. Each role group shares its main macro equally. */
export function fitFoods(foods, t) {
  const blends = GROUPS.map(([role, main]) => {
    const fs = foods.filter(f => f.role === role || (role === "carb" && f.role === "fruit"));
    if (!fs.length) return null;
    const per = {p: 0, c: 0, f: 0}, grams = {};
    fs.forEach(f => { const gr = (1 / fs.length) / (f.per100g[main] / 100); grams[f.id] = gr; for (const m in per) per[m] += gr * f.per100g[m] / 100; });
    return {main, per, grams};
  });
  let act = blends.map((b, i) => b ? i : -1).filter(i => i >= 0);
  while (act.length) {
    const A = act.map(r => act.map(c => blends[c].per[blends[r].main])), bb = act.map(r => t[blends[r].main]);
    const sol = solve(A, bb); if (!sol) { act.pop(); continue; }
    const neg = sol.reduce((m, v, i) => v < sol[m] ? i : m, 0);
    if (sol[neg] >= 0) { const out = {}; act.forEach((c, i) => Object.entries(blends[c].grams).forEach(([id, g]) => out[id] = (out[id] || 0) + g * sol[i])); return out; }
    act.splice(neg, 1);
  }
  return null;
}

/**
 * Build meals that add up to the targets from the foods the person likes.
 * Meals are filled in order, each taking its share of what's left, so an overshoot early is
 * made up later. Lunch and dinner include vegetables (counted). Portions are rounded to 5 g / 5 ml.
 */
export function generateMeals(args) { return generatePlan(args).meals; }
/**
 * Build meals plus notes explaining any compromise: liked foods left out by an allergy or diet,
 * food groups with no liked option, or targets the chosen foods couldn't meet.
 */
export function generatePlan({targets: T, mealsPerDay, foods, prefs, uid}) {
  const ok = foods.filter(f => suggestible(f, prefs));
  const liked = new Set(likedIds(prefs));
  const meals = buildMeals({T, mealsPerDay, foods, prefs, uid, ok, liked});
  return {meals, notes: planNotes({T, meals, foods, prefs, ok, liked})};
}
function buildMeals({T, mealsPerDay, foods, prefs, uid, ok, liked}) {
  const poolFor = (role, tag) => {
    const pool = ok.filter(f => f.role === role && f.meals.includes(tag) && f.unit === "g" && !RAW_FORMS.has(f.id));
    const fav = pool.filter(f => liked.has(f.id)), def = pool.filter(f => !liked.has(f.id) && DEFAULT_PICKS.includes(f.id)), rest = pool.filter(f => !liked.has(f.id) && !DEFAULT_PICKS.includes(f.id));
    return {first: fav.length ? fav : def.length ? def : rest, backup: (fav.length ? def : []).concat(rest), liked: fav.length > 0};
  };
  const layout = mealLayout(mealsPerDay), wsum = layout.reduce((a, m) => a + m[2], 0), seen = {};
  const left = {p: T.p, c: T.c, f: T.f}; let wleft = wsum;
  const vegPool = ok.filter(f => f.role === "veg" && f.meals.includes("m"));
  const vegPref = vegPool.filter(f => liked.has(f.id)), vegs = (vegPref.length ? vegPref : vegPool.filter(f => ["broccoli_c", "cucumber", "tomato", "lettuce", "green_beans", "zucchini"].includes(f.id)));
  const byId = id => ok.find(f => f.id === id) || foods.find(f => f.id === id);
  return layout.map(([name, tag, w], mi) => {
    const k = seen[tag] = (seen[tag] || 0) + 1;
    const roles = ["protein", tag === "s" ? "fruit" : "carb", "fat"];
    const pools = roles.map(r => poolFor(r, tag));
    const pick = pl => pl.first.length ? pl.first[(k - 1) % pl.first.length] : null;   // rotate so repeated meals differ
    const t0 = {p: Math.max(0, left.p * w / wleft), c: Math.max(0, left.c * w / wleft), f: Math.max(0, left.f * w / wleft)};
    const veg = tag === "m" && vegs.length ? vegs[(mi + k) % vegs.length] : null;
    // Build the meal around one protein. Fit the foods to the target; a food that would exceed a
    // practical portion is fixed at its cap and another food of the same role tops up the rest.
    const build = protein => {
      const chosen = [protein, pick(pools[1]), pick(pools[2])].filter(Boolean);
      const spare = pools.map(pl => pl.first.filter(f => !chosen.includes(f)).concat(pl.backup));
      const t = {...t0}, items = [];
      const take = (f, g) => { const n = nutrientsFor(f, g, "g"); items.push({foodId: f.id, qty: g, unit: "g"}); t.p = Math.max(0, t.p - n.p); t.c = Math.max(0, t.c - n.c); t.f = Math.max(0, t.f - n.f); };
      if (veg) take(veg, 150);                       // vegetables first; counted in the meal
      let flex = chosen.slice(), g = {};
      for (let round = 0; round < 4; round++) {
        g = fitFoods(flex, t) || {};
        const over = flex.filter(f => (g[f.id] || 0) > portionCap(f));
        if (!over.length) break;
        for (const f of over) {
          take(f, practical(portionCap(f), "g")); flex = flex.filter(x => x !== f);
          const ri = roles.indexOf(f.role === "fruit" && tag !== "s" ? "carb" : f.role), alt = ri >= 0 ? spare[ri].find(x => !flex.includes(x) && !items.some(it => it.foodId === x.id)) : null;
          if (alt) flex.push(alt);
        }
      }
      for (const [id, gr] of Object.entries(g)) { const q = practical(Math.min(gr, portionCap(byId(id))), "g"); if (q > 0) items.push({foodId: id, qty: q, unit: "g"}); }
      const merged = [];
      for (const it of items) { const m = merged.find(x => x.foodId === it.foodId); if (m) m.qty += it.qty; else merged.push({...it}); }
      const tot = sum(merged.map(it => nutrientsFor(byId(it.foodId), it.qty, it.unit)));
      const err = Math.abs(tot.p - t0.p) * 4 + Math.abs(tot.c - t0.c) * 4 + Math.abs(tot.f - t0.f) * 9;
      return {merged, tot, err};
    };
    // Try the rotated protein first, then a few others; keep the closest (small bonus for variety).
    // Only foods the person liked are tried when they named any; otherwise the default picks.
    const first = pick(pools[0]), cands = [first, ...pools[0].first.filter(f => f !== first), ...(pools[0].liked ? [] : pools[0].backup)].filter(Boolean).slice(0, 5);
    let best = null;
    for (const [i, pr] of cands.entries()) { const r = build(pr), score = r.err + (i ? 25 : 0); if (!best || score < best.score) best = {...r, score}; }
    if (!best) best = build(null);
    left.p -= best.tot.p; left.c -= best.tot.c; left.f -= best.tot.f; wleft -= w;
    return {id: uid(), name, items: best.merged.map(it => ({id: uid(), ...it}))};
  });
}
const ROLE_WORD = {protein: "protein", carb: "carb", fat: "fat"};
function planNotes({T, meals, foods, prefs, ok, liked}) {
  const notes = [], byId = id => foods.find(f => f.id === id);
  const blocked = [...liked].map(byId).filter(f => f && !allowed(f, prefs));
  if (blocked.length) notes.push({kind: "info", text: `Left out because of your ${blocked.some(f => restriction(f, prefs) === "allergy") ? "allergies" : "diet"}: ${blocked.map(f => f.name).join(", ")}.`});
  if (liked.size) for (const role of ["protein", "carb", "fat"]) {
    const usable = ok.filter(f => liked.has(f.id) && (f.role === role || (role === "carb" && f.role === "fruit")) && f.unit === "g");
    if (!usable.length) {
      const used = [...new Set(meals.flatMap(m => m.items.map(i => byId(i.foodId))).filter(f => f && f.role === role).map(f => f.name))];
      if (used.length) notes.push({kind: "info", text: `You haven't liked any ${ROLE_WORD[role]} foods that fit your diet, so we used ${used.slice(0, 3).join(", ")}. Like a few to make it yours.`});
    }
  }
  const tot = sum(meals.flatMap(m => m.items.map(i => nutrientsFor(byId(i.foodId), i.qty, i.unit))));
  const miss = [["p", "protein", "protein"], ["c", "carbs", "carb"], ["f", "fat", "fat"]].filter(([k]) => T[k] > 0 && Math.abs(tot[k] - T[k]) > Math.max(8, T[k] * 0.1));
  for (const [k, word, role] of miss) {
    const ideas = ok.filter(f => (f.role === role || (role === "carb" && f.role === "fruit")) && !liked.has(f.id) && DEFAULT_PICKS.includes(f.id)).slice(0, 3).map(f => f.name);
    notes.push({kind: "warn", text: `Your foods give ${Math.round(tot[k])} g of ${word} against a target of ${T[k]} g.${ideas.length ? ` Liking foods such as ${ideas.join(", ")} would help.` : ""}`});
  }
  return notes;
}

/** Largest practical amount of one food in a single meal, in grams. */
export function portionCap(f) {
  const id = f.id;
  if (id === "egg" || id === "egg_boiled") return 200;          // 4 large eggs
  if (id === "egg_white") return 300;
  if (id.startsWith("whey")) return 45;
  if (f.cat === "fats") return f.id === "olives" ? 60 : 15;
  if (f.cat === "nuts") return 40;
  if (["cheddar", "mozzarella", "feta", "parmesan"].includes(id)) return 60;
  if (id === "avocado") return 150;
  if (id === "hummus") return 80;
  if (["dates_medjool", "dates_deglet", "raisins", "figs_dried"].includes(id)) return 80;
  if (["oats_d", "granola", "rice_white_r", "rice_brown_r", "pasta_d", "quinoa_d"].includes(id)) return 110;
  if (["bread_ww", "bread_white", "pita", "pita_ww", "tortilla"].includes(id)) return 130;
  if (f.cat === "snacks") return 60;
  if (f.role === "protein") return f.cat === "dairy" ? 400 : 300;
  if (f.role === "fruit") return 300;
  if (f.role === "carb") return 450;
  return 400;
}
// Foods used when the person hasn't said what they like.
export const DEFAULT_PICKS = ["chicken_breast_c", "egg", "greek_0", "tuna_can", "beef_95_c", "salmon_c", "rice_white_c", "oats_d", "potato_boiled", "bread_ww", "pasta_c", "banana", "apple", "olive_oil", "almonds", "peanut_butter", "avocado"];

// ---------- replacement ----------
// The nutrient that defines a food's job in a meal: what a replacement must match first.
export const KEY = {protein: "p", carb: "c", fruit: "c", fat: "f", veg: "kcal", drink: "kcal"};
/**
 * Two alternatives for one food in a meal, sized to match its key nutrient.
 * Returns {options:[{food, qty, unit, n, diff, score, close}], key}. `close` is false when the best
 * available option still differs a lot, so the UI can say so instead of calling it equivalent.
 */
export function replacements(food, qty, unit, foods, prefs, n = 2) {
  const key = KEY[food.role] || "kcal", base = nutrientsFor(food, qty, unit);
  const useKcal = !(base[key] > 0.5);
  const k = useKcal ? "kcal" : key;
  const sameRole = foods.filter(f => f.id !== food.id && suggestible(f, prefs) && (f.role === food.role || (["carb", "fruit"].includes(food.role) && ["carb", "fruit"].includes(f.role))));
  const opts = [];
  for (const f of sameRole) {
    const per = f.per100g[k]; if (!(per > 0)) continue;
    const u = defaultUnit(f), grams = base[k] / per * 100, q = practical(fromGrams(f, grams, u), u);
    if (!(q > 0)) continue;
    const g2 = toGrams(f, q, u);
    if (g2 > (f.unit === "ml" ? 1500 : 700) || g2 > Math.max(4 * base.grams, 250)) continue;   // impractical portion
    const nn = nutrientsFor(f, q, u);
    const diff = {kcal: nn.kcal - base.kcal, p: nn.p - base.p, c: nn.c - base.c, f: nn.f - base.f};
    // energy-weighted error on the other macros, relative to the original's calories
    const err = (Math.abs(diff.p) * 4 + Math.abs(diff.c) * 4 + Math.abs(diff.f) * 9) / Math.max(base.kcal, 40);
    const score = err + (f.cat === food.cat ? 0 : 0.08) + (f.unit === food.unit ? 0 : 0.15);
    opts.push({food: f, qty: q, unit: u, n: nn, diff, score, close: err <= 0.35});
  }
  opts.sort((a, b) => a.score - b.score);
  return {key: k, base, options: opts.slice(0, n)};
}

/** A diet plan's targets: its own custom numbers, or calculated from the profile with the plan's goal. */
export function planTargets(profile, plan) {
  if (plan && plan.customTargets) return plan.customTargets;
  return targets({...profile, goal: (plan && plan.goal) || profile.goal});
}
