// Gives a profile its first workout plan and diet plan, so a new (or migrated) profile never opens empty.
import {FOODS} from "../data/foods.js";
import {PROGRAM_TEMPLATES} from "../data/programs.js";
import {planFromTemplate} from "./training.js";
import {targets, generateMeals} from "./nutrition.js";

export const PLAN_NAMES = {lose: "Fat Loss Plan", maintain: "Maintenance Plan", gain: "Muscle Gain Plan"};

export function newDietPlan(profile, {goal = profile.goal, name, uid, now, generate = true}) {
  const t = targets({...profile, goal});
  const meals = generate && t ? generateMeals({targets: t, mealsPerDay: profile.mealsPerDay, foods: FOODS.concat(Object.values(profile.nutrition.customFoods || {})), prefs: profile, uid}) : [];
  return {id: uid(), name: name || PLAN_NAMES[goal] || "My plan", goal, createdAt: now, updatedAt: now, meals};
}

/** Adds what's missing. templateId: the program picked in onboarding (or a v1 profile's old choice). */
export function ensureStarterPlans(store, pid, uid, templateId) {
  const p = store.profile(pid); if (!p) return;
  const tplId = templateId || p.legacyProgram;
  const needsW = !Object.keys(p.training.plans).length && tplId;
  const needsN = !Object.keys(p.nutrition.plans).length && targets(p);
  if (!needsW && !needsN && !p.legacyProgram) return;
  store.updateProfile(pid, d => {
    const now = new Date().toISOString();
    if (needsW) {
      const tpl = PROGRAM_TEMPLATES.find(x => x.id === tplId) || PROGRAM_TEMPLATES[0];
      const w = planFromTemplate(tpl, uid, now); d.training.plans[w.id] = w; d.training.activePlanId = w.id;
    }
    delete d.legacyProgram;
    if (needsN) { const plan = newDietPlan(d, {uid, now}); d.nutrition.plans[plan.id] = plan; d.nutrition.activePlanId = plan.id; }
  });
}
