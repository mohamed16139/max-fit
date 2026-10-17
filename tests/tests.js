// Unit and integration tests for the core logic. Open tests/index.html (served over http) or run scripts/test.sh.
import * as N from "../js/core/nutrition.js";
import * as T from "../js/core/training.js";
import {createStore, DuplicateProfileError, KEY, normName} from "../js/core/store.js";
import {FOODS} from "../js/data/foods.js";
import {EXERCISES} from "../js/data/exercises.js";
import {PROGRAM_TEMPLATES, LEGACY_EXERCISE_NAMES} from "../js/data/programs.js";

const results = [];
const test = (name, fn) => { try { fn(); results.push([true, name]); } catch (e) { results.push([false, name, e.message]); } };
const eq = (a, b, m = "") => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const near = (a, b, tol, m = "") => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${m} expected ${b} ±${tol}, got ${a}`); };
const ok = (c, m = "assertion failed") => { if (!c) throw new Error(m); };
const throws = (fn, cls, m = "") => { try { fn(); } catch (e) { if (!cls || e instanceof cls) return; throw new Error(`${m} wrong error: ${e.message}`); } throw new Error(`${m} did not throw`); };
const F = id => FOODS.find(f => f.id === id);
let n = 0; const uid = () => "id" + (++n);

// In-memory localStorage stand-in
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, _m: m};
}

// ---------- calculator ----------
test("Mifflin–St Jeor BMR, male", () => eq(N.bmr({sex: "male", weightKg: 80, heightCm: 180, age: 30}), 1780));
test("Mifflin–St Jeor BMR, female", () => eq(N.bmr({sex: "female", weightKg: 60, heightCm: 165, age: 25}), 1345.25));
test("TDEE uses activity factor", () => near(N.tdee({sex: "male", weightKg: 80, heightCm: 180, age: 30, activity: "moderate"}), 1780 * 1.55, 1e-9));
test("Targets: lose = TDEE −20%, macros add up", () => {
  const t = N.targets({sex: "male", weightKg: 80, heightCm: 180, age: 30, activity: "moderate", goal: "lose"});
  eq(t.kcal, Math.round(1780 * 1.55 * 0.8 / 10) * 10); eq(t.p, 160);
  near(t.p * 4 + t.c * 4 + t.f * 9, t.kcal, 12, "macro kcal");
});
test("Targets: deficit capped at 750 kcal", () => {
  const p = {sex: "male", weightKg: 140, heightCm: 190, age: 30, activity: "extra", goal: "lose"};
  const t = N.targets(p); ok(t.tdee - t.kcal <= 755, `deficit ${t.tdee - t.kcal}`);
});
test("Targets: never below floor (BMR / 1200 / 1500)", () => {
  const t = N.targets({sex: "female", weightKg: 45, heightCm: 150, age: 60, activity: "sedentary", goal: "lose"});
  ok(t.kcal >= 1200 && t.kcal >= t.bmr - 10, `kcal ${t.kcal}`); ok(t.floored, "flagged as floored");
});
test("Targets: protein uses BMI-27.5 weight for high BMI", () => {
  const t = N.targets({sex: "male", weightKg: 130, heightCm: 175, age: 40, activity: "light", goal: "lose"});
  near(t.refKg, 27.5 * 1.75 * 1.75, 0.1); eq(t.p, Math.round(27.5 * 1.75 * 1.75 * 2));
});
test("Targets: invalid input gives null", () => {
  eq(N.targets({sex: "male", weightKg: 5, heightCm: 180, age: 30}), null);
  eq(N.targets({sex: "male", weightKg: 80, heightCm: 180, age: 8}), null);
  ok(N.validateBody({sex: "x", weightKg: 80, heightCm: 180, age: 30}).includes("sex"));
});

// ---------- units ----------
test("Per-100 g formula", () => { const n = N.nutrientsFor(F("chicken_breast_c"), 150, "g"); const c = F("chicken_breast_c").per100g; near(n.p, 1.5 * c.p, 1e-9); near(n.kcal, 1.5 * c.kcal, 1e-9); });
test("ml uses density, not 1 g = 1 ml", () => {
  const m = F("milk_2"); eq(m.unit, "ml"); ok(m.density > 1.02 && m.density < 1.04);
  near(N.toGrams(m, 250, "ml"), 250 * m.density, 1e-9);
  near(N.nutrientsFor(m, 250, "ml").kcal, 250 * m.density / 100 * m.per100g.kcal, 1e-9);
});
test("L ↔ ml conversion", () => { const m = F("milk_2"); near(N.convertQty(m, 1.5, "L", "ml"), 1500, 1e-9); near(N.convertQty(m, 250, "ml", "L"), 0.25, 1e-12); });
test("Solids can't be measured in ml", () => { ok(Number.isNaN(N.toGrams(F("rice_white_c"), 100, "ml"))); eq(N.unitsFor(F("rice_white_c")).join(), "g"); });
test("Negative quantity is invalid", () => ok(Number.isNaN(N.toGrams(F("egg"), -5, "g"))));
test("Meal and plan totals are sums of items", () => {
  const meal = {items: [{foodId: "egg", qty: 100, unit: "g"}, {foodId: "milk_2", qty: 200, unit: "ml"}]};
  const a = N.nutrientsFor(F("egg"), 100, "g"), b = N.nutrientsFor(F("milk_2"), 200, "ml"), t = N.mealTotals(meal, F);
  near(t.kcal, a.kcal + b.kcal, 1e-9); near(t.p, a.p + b.p, 1e-9);
  near(N.planTotals({meals: [meal, meal]}, F).f, 2 * t.f, 1e-9);
});
test("Every food has USDA source and core nutrients", () => {
  for (const f of FOODS) { ok(f.src && f.src.fdcId, f.id + " source"); for (const k of ["kcal", "p", "c", "f"]) ok(Number.isFinite(f.per100g[k]), f.id + " " + k); if (f.unit === "ml") ok(f.density > 0.5 && f.density < 1.5, f.id + " density"); }
});

// ---------- generator ----------
test("Generated plan lands near targets (3–6 meals)", () => {
  const tg = N.targets({sex: "male", weightKg: 80, heightCm: 178, age: 28, activity: "moderate", goal: "lose"});
  for (const m of [3, 4, 5, 6]) {
    const meals = N.generateMeals({targets: tg, mealsPerDay: m, foods: FOODS, prefs: {}, uid});
    eq(meals.length, m); const t = N.planTotals({meals}, F);
    near(t.p, tg.p, tg.p * 0.08, `protein ${m} meals`); near(t.c, tg.c, tg.c * 0.08, `carbs ${m} meals`); near(t.f, tg.f, tg.f * 0.15, `fat ${m} meals`);
    for (const ml of meals) for (const it of ml.items) { ok(it.qty > 0 && it.qty % 5 === 0, "practical portion " + it.qty); ok(it.qty <= N.portionCap(F(it.foodId)) + 150, `${it.foodId} ${it.qty} g is over its cap`); }
    near(t.kcal, tg.kcal, tg.kcal * 0.08, `kcal ${m} meals`);
  }
});
test("Generator respects vegan + allergies", () => {
  const tg = {kcal: 2200, p: 130, c: 260, f: 70};
  const prefs = {diet: "vegan", allergies: ["soy", "gluten"]};
  const meals = N.generateMeals({targets: tg, mealsPerDay: 4, foods: FOODS, prefs, uid});
  for (const m of meals) for (const it of m.items) ok(N.allowed(F(it.foodId), prefs), "not allowed: " + it.foodId);
});
test("Generator keeps eggs to a practical portion even when they're the only liked protein", () => {
  const meals = N.generateMeals({targets: {kcal: 2600, p: 170, c: 300, f: 75}, mealsPerDay: 3, foods: FOODS, prefs: {preferred: ["egg", "rice_white_c", "olive_oil"]}, uid});
  for (const m of meals) for (const it of m.items) if (it.foodId === "egg") ok(it.qty <= 200, "eggs " + it.qty);
  const t = N.planTotals({meals}, F); near(t.p, 170, 170 * 0.1, "protein still met");
});
test("Generator prefers liked foods", () => {
  const meals = N.generateMeals({targets: {kcal: 2400, p: 160, c: 280, f: 70}, mealsPerDay: 3, foods: FOODS, prefs: {preferred: ["salmon_c", "quinoa_c", "avocado"]}, uid});
  const ids = meals.flatMap(m => m.items.map(i => i.foodId)); ok(ids.includes("salmon_c") && ids.includes("quinoa_c"), ids.join());
});

// ---------- food replacement ----------
test("Protein replacement matches protein", () => {
  const r = N.replacements(F("chicken_breast_c"), 150, "g", FOODS, {});
  eq(r.key, "p"); eq(r.options.length, 2);
  for (const o of r.options) { eq(o.food.role, "protein"); near(o.n.p, r.base.p, r.base.p * 0.1, o.food.id); ok(o.food.id !== "chicken_breast_c"); }
});
test("Carb replacement matches carbs; fat matches fat", () => {
  const r = N.replacements(F("rice_white_c"), 200, "g", FOODS, {}); eq(r.key, "c");
  for (const o of r.options) near(o.n.c, r.base.c, r.base.c * 0.1, o.food.id);
  const f = N.replacements(F("olive_oil"), 10, "ml", FOODS, {}); eq(f.key, "f");
  for (const o of f.options) near(o.n.f, f.base.f, f.base.f * 0.25, o.food.id);
});
test("Replacement respects allergies", () => {
  const r = N.replacements(F("chicken_breast_c"), 150, "g", FOODS, {allergies: ["fish", "egg", "dairy"]});
  for (const o of r.options) ok(!o.food.flags.some(x => ["fish", "egg", "dairy"].includes(x)), o.food.id);
});

// ---------- exercises ----------
test("Exercise library is complete", () => {
  ok(EXERCISES.length > 150); const ids = new Set(EXERCISES.map(e => e.id)); eq(ids.size, EXERCISES.length, "unique ids");
  for (const p of PROGRAM_TEMPLATES) for (const d of p.days) for (const e of d.exercises || []) ok(ids.has(e.exId), "template uses unknown " + e.exId);
  for (const id of Object.values(LEGACY_EXERCISE_NAMES)) ok(ids.has(id), "legacy " + id);
});
test("Bench press alternatives are chest presses", () => {
  const bp = EXERCISES.find(e => e.id === "Barbell_Bench_Press_-_Medium_Grip");
  const alts = T.exerciseAlternatives(bp, EXERCISES); eq(alts.length, 2);
  for (const a of alts) { eq(a.ex.pattern, "horizontal_push", a.ex.id); eq(a.ex.primary[0], "chest"); ok(a.close); }
});
test("Equipment filter is honoured", () => {
  const sq = EXERCISES.find(e => e.id === "Barbell_Squat");
  for (const a of T.exerciseAlternatives(sq, EXERCISES, {equipment: ["dumbbell"]})) eq(a.ex.equipment, "dumbbell");
});
test("Rest label parsing", () => { eq(T.restSeconds("90–120 s"), 90); eq(T.restSeconds("2–3 min"), 120); eq(T.restSeconds("60 s"), 60); });

// ---------- profiles & persistence ----------
test("Duplicate profile blocked: same normalized name + age", () => {
  const s = createStore(memStorage()); s.createProfile({name: "Ahmed", age: 30});
  throws(() => s.createProfile({name: "  AHMED ", age: 30}), DuplicateProfileError, "uppercase");
  throws(() => s.createProfile({name: "ahmed", age: 30}), DuplicateProfileError, "lowercase");
  s.createProfile({name: "Ahmed", age: 31}); s.createProfile({name: "Omar", age: 30});
  eq(s.profiles().length, 3);
});
test("Duplicate blocked when editing too", () => {
  const s = createStore(memStorage()); s.createProfile({name: "Sara", age: 25}); const b = s.createProfile({name: "Mona", age: 25});
  throws(() => s.updateProfile(b.id, p => { p.name = "sara"; }), DuplicateProfileError);
  eq(s.profile(b.id).name, "Mona");
});
test("Profiles have stable unique ids, not name+age", () => {
  const s = createStore(memStorage()); const a = s.createProfile({name: "Ali", age: 20});
  s.updateProfile(a.id, p => { p.name = "Ali Hassan"; p.age = 21; }); eq(s.profile(a.id).name, "Ali Hassan");
});
test("Data isolation between profiles", () => {
  const st = memStorage(), s = createStore(st);
  const a = s.createProfile({name: "A", age: 20}), b = s.createProfile({name: "B", age: 20});
  s.updateProfile(a.id, p => { p.weights.push({d: "2026-01-01", kg: 70}); p.nutrition.plans.x = {id: "x", name: "A plan", meals: []}; });
  eq(s.profile(b.id).weights.length, 0); eq(Object.keys(s.profile(b.id).nutrition.plans).length, 0);
  s.setActive(b.id); s.updateProfile(b.id, p => { p.weights.push({d: "2026-01-02", kg: 90}); });
  eq(s.profile(a.id).weights[0].kg, 70); eq(s.profile(a.id).weights.length, 1);
});
test("Persists across restarts (new store on same storage)", () => {
  const st = memStorage(); const s1 = createStore(st); const a = s1.createProfile({name: "Z", age: 40});
  s1.updateProfile(a.id, p => { p.training.plans.w = {id: "w", name: "Mine", days: []}; p.training.activePlanId = "w"; });
  const s2 = createStore(st); eq(s2.activeId(), a.id); eq(s2.profile(a.id).training.plans.w.name, "Mine");
});
test("Two diet plans stay independent", () => {
  const st = memStorage(), s = createStore(st), a = s.createProfile({name: "P", age: 30});
  const m1 = N.generateMeals({targets: {kcal: 2000, p: 150, c: 200, f: 60}, mealsPerDay: 3, foods: FOODS, prefs: {}, uid});
  s.updateProfile(a.id, p => { p.nutrition.plans.one = {id: "one", name: "Cut", meals: m1}; const c = T.duplicatePlan(p.nutrition.plans.one, uid, "t", "Bulk"); p.nutrition.plans[c.id] = c; p.nutrition.activePlanId = "one"; });
  const two = Object.values(s.profile(a.id).nutrition.plans).find(x => x.name === "Bulk");
  s.updateProfile(a.id, p => { p.nutrition.plans[two.id].meals[0].items[0].qty = 999; p.nutrition.activePlanId = two.id; });
  ok(s.profile(a.id).nutrition.plans.one.meals[0].items[0].qty !== 999, "original unchanged");
  ok(s.profile(a.id).nutrition.plans.one.meals[0].id !== s.profile(a.id).nutrition.plans[two.id].meals[0].id, "copy has new ids");
});
test("Updating a deleted profile fails instead of writing elsewhere", () => {
  const s = createStore(memStorage()); const a = s.createProfile({name: "Gone", age: 30}); s.deleteProfile(a.id);
  throws(() => s.updateProfile(a.id, p => { p.weightKg = 1; })); eq(s.profiles().length, 0);
});
test("Migration from v1 keys", () => {
  const st = memStorage({
    recompUser: JSON.stringify({name: "Mohamed", age: 28, prog: "upperlower"}),
    recompMacros: JSON.stringify({kg: "80", cm: "178", sex: "m", act: "1.55", goal: "recomp"}),
    recompFoods: JSON.stringify({foods: ["chicken", "rice", "olive"], meals: "4"}),
    "recompProgress:mohamed": JSON.stringify({w: [{d: "2026-10-01", kg: 81}], l: [{d: "2026-10-02", ex: "Flat Bench Press", kg: 70, reps: 6, s: 1}], goal: 78}),
    "recompProgress:sara": JSON.stringify({w: [{d: "2026-10-01", kg: 60}], l: []}),
  });
  const s = createStore(st), ps = s.profiles(); eq(ps.length, 2);
  const m = s.profile(s.activeId()); eq(m.name, "Mohamed"); eq(m.age, 28); eq(m.heightCm, 178); eq(m.goal, "lose");
  eq(m.preferred.join(), "chicken_breast_c,rice_white_c,olive_oil"); eq(m.training.logs[0].ex, "Barbell_Bench_Press_-_Medium_Grip");
  eq(m.targetWeightKg, 78); eq(m.legacyProgram, "upperlower");
  const s2 = createStore(st); eq(s2.profiles().length, 2, "migration runs once"); eq(s2.activeId(), m.id, "stable id");
  ok(st.getItem("recompUser"), "old keys kept");
});
test("v3 migration renames untouched Body Recomp plans only", () => {
  const db = {schema: 2, migratedV1: true, activeProfileId: "a", profiles: {a: {id: "a", name: "A", age: 30, training: {plans: {
    x: {id: "x", templateId: "recomp", name: "Body Recomp", days: []}, y: {id: "y", templateId: "recomp", name: "My custom name", days: []}}}}}};
  const st = memStorage({"mangafit.db": JSON.stringify(db)}), p = createStore(st).profile("a");
  eq(p.training.plans.x.name, "PUSH-PULL-LEGS"); eq(p.training.plans.y.name, "My custom name");
});
test("normName", () => { eq(normName("  Ahmed   Ali "), "ahmed ali"); eq(normName("AHMED"), normName("ahmed")); });

// ---------- report ----------
const pass = results.filter(r => r[0]).length;
document.title = `${pass}/${results.length} passed ¦ ` + results.filter(r => !r[0]).map(r => "FAIL " + r[1] + " — " + r[2]).join(" ¦ ");
document.getElementById("out").textContent = results.map(r => (r[0] ? "PASS " : "FAIL ") + r[1] + (r[2] ? " — " + r[2] : "")).join("\n") + `\n\n${pass}/${results.length} passed`;
document.body.dataset.done = pass === results.length ? "pass" : "fail";
