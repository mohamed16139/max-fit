// Training logic. Pure functions only: no DOM, no storage.

export const MUSCLES = ["chest", "shoulders", "triceps", "lats", "middle back", "traps", "lower back", "biceps", "forearms",
  "quadriceps", "hamstrings", "glutes", "calves", "abductors", "adductors", "abdominals"];
export const MUSCLE_GROUPS = [
  {id: "chest", label: "Chest", muscles: ["chest"]},
  {id: "back", label: "Back", muscles: ["lats", "middle back", "lower back", "traps"]},
  {id: "shoulders", label: "Shoulders", muscles: ["shoulders"]},
  {id: "arms", label: "Arms", muscles: ["biceps", "triceps", "forearms"]},
  {id: "legs", label: "Legs", muscles: ["quadriceps", "hamstrings", "calves", "adductors", "abductors"]},
  {id: "glutes", label: "Glutes", muscles: ["glutes"]},
  {id: "core", label: "Core", muscles: ["abdominals"]},
];
export const EQUIPMENT = [
  {id: "barbell", label: "Barbell"}, {id: "dumbbell", label: "Dumbbell"}, {id: "cable", label: "Cable"},
  {id: "machine", label: "Machine"}, {id: "body only", label: "Bodyweight"}, {id: "e-z curl bar", label: "EZ bar"},
  {id: "kettlebells", label: "Kettlebell"}, {id: "other", label: "Other"},
];
export const LEVELS = [{id: "beginner", label: "Beginner"}, {id: "intermediate", label: "Intermediate"}, {id: "expert", label: "Advanced"}];
export const PATTERN_LABELS = {
  horizontal_push: "Horizontal press", incline_push: "Incline press", decline_push: "Decline press", chest_fly: "Chest fly", dip: "Dip",
  vertical_push: "Overhead press", lateral_raise: "Lateral raise", front_raise: "Front raise", rear_delt: "Rear delt",
  upright_row: "Upright row", shrug: "Shrug", vertical_pull: "Vertical pull", lat_isolation: "Lat isolation",
  horizontal_pull: "Row", hinge: "Hip hinge", back_extension: "Back extension", squat: "Squat", lunge: "Lunge / split squat",
  hip_thrust: "Hip thrust / bridge", glute_isolation: "Glute isolation", adductor: "Adductor", knee_extension: "Knee extension",
  knee_flexion: "Leg curl", calf_raise: "Calf raise", biceps_curl: "Biceps curl", hammer_curl: "Hammer / reverse curl",
  triceps_extension: "Triceps extension", triceps_press: "Close-grip press", core_flexion: "Crunch", leg_raise: "Leg raise",
  core_stability: "Core stability", core_rotation: "Rotation", wrist_curl: "Wrist curl",
};
/** Training purpose, from the exercise's mechanics. */
export function purpose(e) {
  if (e.primary.includes("abdominals")) return "Core";
  if (e.mechanic === "compound") return "Strength & muscle";
  return "Muscle building";
}
/** A sensible starting prescription for an exercise added to a plan. */
export function recommend(e) {
  if (e.pattern === "core_stability" && e.force === "static") return {sets: 3, reps: "30–60 s", rest: "60 s"};
  if (e.primary.includes("abdominals")) return {sets: 3, reps: "12–20", rest: "60 s"};
  if (e.mechanic === "compound" && ["barbell"].includes(e.equipment) && ["squat", "hinge", "horizontal_push", "vertical_push", "horizontal_pull"].includes(e.pattern))
    return {sets: 3, reps: "6–8", rest: "2–3 min"};
  if (e.mechanic === "compound") return {sets: 3, reps: "8–12", rest: "90–120 s"};
  return {sets: 3, reps: "10–15", rest: "60–90 s"};
}
/** Seconds to rest, parsed from labels like "90–120 s", "2–3 min", "60 s" (uses the lower bound). */
export function restSeconds(label) {
  const m = String(label || "").match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(min|s)/);
  if (!m) return 90;
  return (+m[1]) * (m[3] === "min" ? 60 : 1);
}
const LV = {beginner: 0, intermediate: 1, expert: 2};

/**
 * Two alternatives for an exercise that do the same job in the workout.
 * Ranking: same movement pattern first (required for a "close" match), then primary muscle,
 * compound vs isolation, push/pull, shared secondary muscles, equipment and difficulty.
 * Only patterns that are genuinely similar are used as a fallback, and those are marked close=false.
 */
export function exerciseAlternatives(ex, library, {equipment = null, maxLevel = null, exclude = [], n = 2} = {}) {
  const near = NEAR[ex.pattern] || [];
  const out = [];
  for (const c of library) {
    if (c.id === ex.id || exclude.includes(c.id)) continue;
    if (equipment && equipment.length && !equipment.includes(c.equipment)) continue;
    if (maxLevel != null && LV[c.level] > maxLevel) continue;
    const same = c.pattern === ex.pattern, isNear = near.includes(c.pattern);
    if (!same && !isNear) continue;
    let s = same ? 10 : 4;
    const reasons = [];
    if (same) reasons.push(`Same movement: ${PATTERN_LABELS[ex.pattern].toLowerCase()}`);
    else reasons.push(`Similar movement (${PATTERN_LABELS[c.pattern].toLowerCase()})`);
    if (c.primary[0] === ex.primary[0]) { s += 4; reasons.push(`targets the ${ex.primary[0]}`); }
    else if (c.primary.some(m => ex.primary.includes(m))) s += 2;
    if (c.mechanic === ex.mechanic) { s += 2; reasons.push(c.mechanic === "compound" ? "multi-joint like the original" : "single-joint like the original"); }
    if (c.force === ex.force) s += 1;
    const shared = c.secondary.filter(m => ex.secondary.includes(m)).length; s += Math.min(shared, 3) * 0.5;
    if (c.equipment === ex.equipment) s += 0.5; else reasons.push(`uses ${eqLabel(c.equipment).toLowerCase()} instead of ${eqLabel(ex.equipment).toLowerCase()}`);
    s -= Math.abs((LV[c.level] ?? 1) - (LV[ex.level] ?? 1)) * 0.75;
    out.push({ex: c, score: s, close: same && c.primary[0] === ex.primary[0], why: reasons.join(", ")});
  }
  out.sort((a, b) => b.score - a.score);
  // prefer variety: the second pick shouldn't use the same equipment as the first when an equally good one exists
  if (out.length > 2 && out[0].ex.equipment === out[1].ex.equipment) {
    const j = out.findIndex((o, i) => i > 1 && o.ex.equipment !== out[0].ex.equipment && o.score >= out[1].score - 1.5);
    if (j > 0) out.splice(1, 0, out.splice(j, 1)[0]);
  }
  return out.slice(0, n);
}
// Patterns that can stand in for each other when nothing in the same pattern is available.
const NEAR = {
  horizontal_push: ["incline_push", "decline_push", "dip"], incline_push: ["horizontal_push"], decline_push: ["horizontal_push", "dip"], dip: ["horizontal_push", "triceps_press"],
  chest_fly: [], vertical_push: [], lateral_raise: ["upright_row"], front_raise: ["vertical_push"], rear_delt: ["horizontal_pull"],
  upright_row: ["lateral_raise", "shrug"], shrug: ["upright_row"], vertical_pull: ["lat_isolation"], lat_isolation: ["vertical_pull"],
  horizontal_pull: ["rear_delt"], hinge: ["back_extension", "knee_flexion"], back_extension: ["hinge"], squat: ["lunge"],
  lunge: ["squat"], hip_thrust: ["glute_isolation", "hinge"], glute_isolation: ["hip_thrust"], adductor: [], knee_extension: ["squat"],
  knee_flexion: ["hinge"], calf_raise: [], biceps_curl: ["hammer_curl"], hammer_curl: ["biceps_curl"], triceps_extension: ["triceps_press"],
  triceps_press: ["triceps_extension", "dip"], core_flexion: ["leg_raise"], leg_raise: ["core_flexion"], core_stability: ["core_rotation"],
  core_rotation: ["core_stability"], wrist_curl: [],
};
export function eqLabel(id) { return (EQUIPMENT.find(e => e.id === id) || {label: id}).label; }
export function levelLabel(id) { return (LEVELS.find(e => e.id === id) || {label: id}).label; }

/** Library search with filters. */
export const PURPOSES = ["Strength & muscle", "Muscle building", "Core"];
export function searchExercises(library, {q = "", group = "", equipment = "", level = "", mechanic = "", purpose: pur = ""} = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const g = MUSCLE_GROUPS.find(x => x.id === group);
  return library.filter(e => {
    if (g && !g.muscles.includes(e.primary[0])) return false;
    if (equipment && e.equipment !== equipment) return false;
    if (level && e.level !== level) return false;
    if (mechanic && e.mechanic !== mechanic) return false;
    if (pur && purpose(e) !== pur) return false;
    if (words.length) {
      const hay = (e.name + " " + e.primary.join(" ") + " " + e.secondary.join(" ") + " " + e.equipment + " " + (PATTERN_LABELS[e.pattern] || "")).toLowerCase();
      if (!words.every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

/** A new, independent workout plan from a template (deep copy with fresh ids). */
export function planFromTemplate(tpl, uid, now) {
  return {
    id: uid(), name: tpl.name, goal: tpl.goal, templateId: tpl.id, notes: "", createdAt: now, updatedAt: now,
    days: tpl.days.map(d => ({id: uid(), name: d.name, rest: d.rest || "", exercises: (d.exercises || []).map(e => ({id: uid(), ...e, notes: ""}))})),
  };
}
export function blankPlan(uid, now, name = "My plan") {
  const days = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"].map((n, i) => ({id: uid(), name: i < 3 ? n : "Rest", rest: i < 3 ? "" : "Rest and recover.", exercises: []}));
  return {id: uid(), name, goal: "", notes: "", createdAt: now, updatedAt: now, days};
}
/** Deep copy with new ids so edits to the copy never touch the original. */
export function duplicatePlan(plan, uid, now, name) {
  const c = JSON.parse(JSON.stringify(plan));
  c.id = uid(); c.name = name || plan.name + " (copy)"; c.createdAt = c.updatedAt = now; delete c.templateId;
  for (const d of c.days || []) { d.id = uid(); for (const e of d.exercises || []) e.id = uid(); }
  for (const m of c.meals || []) { m.id = uid(); for (const it of m.items) it.id = uid(); }
  return c;
}
export function trainingDays(plan) { return plan.days.filter(d => (d.exercises || []).length).length; }

/** Heaviest working set per day for one exercise (warm-ups excluded). */
export function topSets(logs, exId) {
  const top = {};
  for (const e of logs) if (e.ex === exId && e.s !== 0) if (!top[e.d] || e.kg > top[e.d].kg || (e.kg === top[e.d].kg && e.reps > top[e.d].reps)) top[e.d] = e;
  return Object.values(top).sort((a, b) => a.d < b.d ? -1 : 1);
}
