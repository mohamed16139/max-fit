// Local persistence for profiles and everything that belongs to them.
//
// One key holds the whole database: {schema, activeProfileId, profiles: {id: Profile}}.
// Every write goes through updateProfile(id, fn): it re-reads storage, applies fn to *that*
// profile only, validates, and writes back. Views pass the profile id they rendered for, so a
// late save can never land on a different profile after a switch, and a stale in-memory copy
// can never overwrite newer data written by another tab.

import {LEGACY_EXERCISE_NAMES} from "../data/programs.js";

export const KEY = "mangafit.db";
export const SCHEMA = 2;

export class SaveError extends Error {}
export class DuplicateProfileError extends Error {
  constructor() { super("A profile with this name and age already exists."); }
}

export const normName = s => String(s || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();

export function emptyProfile(fields = {}) {
  const t = now();
  return {
    id: uid(), createdAt: t, updatedAt: t,
    name: "", age: null, sex: "male", heightCm: null, weightKg: null, activity: "moderate", goal: "maintain",
    mealsPerDay: 4, targetWeightKg: null, diet: "none", allergies: [], dislikes: [], preferred: [], mealTimes: [],
    weights: [],
    nutrition: {plans: {}, activePlanId: null, favorites: [], recent: [], customFoods: {}, savedMeals: {}, eaten: {}},
    training: {plans: {}, activePlanId: null, logs: [], equipment: []},
    ...fields,
  };
}

export function createStore(storage = globalThis.localStorage) {
  const listeners = new Set();
  let cache = null;

  function read() {
    let db = null;
    try { db = JSON.parse(storage.getItem(KEY) || "null"); } catch (e) { db = null; }
    if (!db || typeof db !== "object") db = {schema: SCHEMA, activeProfileId: null, profiles: {}};
    if (!db.migratedV1 || db.schema !== SCHEMA) {
      db = migrate(db, storage);
      try { storage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* stays in memory; next save retries */ }
    }
    cache = db;
    return db;
  }
  function write(db) {
    try { storage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { throw new SaveError("Couldn't save. Your device storage may be full."); }
    cache = db;
    listeners.forEach(fn => fn(db));
  }
  function assertUnique(db, name, age, exceptId) {
    const n = normName(name);
    for (const p of Object.values(db.profiles))
      if (p.id !== exceptId && normName(p.name) === n && p.age != null && +p.age === +age) throw new DuplicateProfileError();
  }

  return {
    read, onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Re-read after another tab changed storage. */
    refresh() { return read(); },
    profiles() { return Object.values((cache || read()).profiles).sort((a, b) => (b.lastOpenedAt || b.updatedAt) < (a.lastOpenedAt || a.updatedAt) ? -1 : 1); },
    profile(id) { return (cache || read()).profiles[id] || null; },
    activeId() { const db = cache || read(); return db.profiles[db.activeProfileId] ? db.activeProfileId : null; },
    isDuplicate(name, age, exceptId) { try { assertUnique(read(), name, age, exceptId); return false; } catch (e) { return true; } },

    createProfile(fields) {
      const db = read();
      if (!normName(fields.name)) throw new Error("Enter a name.");
      assertUnique(db, fields.name, fields.age);              // checked again here, at write time
      const p = emptyProfile({...fields, name: String(fields.name).trim().replace(/\s+/g, " ")});
      db.profiles[p.id] = p; db.activeProfileId = p.id; p.lastOpenedAt = now();
      write(db);
      return p;
    },
    /** Apply fn(profileDraft) to one profile and save. fn may return false to cancel. */
    updateProfile(id, fn) {
      const db = read(), cur = db.profiles[id];
      if (!cur) throw new SaveError("This profile no longer exists.");
      const draft = JSON.parse(JSON.stringify(cur));
      if (fn(draft) === false) return cur;
      draft.id = id; draft.name = String(draft.name || "").trim().replace(/\s+/g, " ");
      if (!draft.name) throw new Error("Enter a name.");
      assertUnique(db, draft.name, draft.age, id);
      draft.updatedAt = now();
      db.profiles[id] = draft;
      write(db);
      return draft;
    },
    setActive(id) {
      const db = read();
      if (id && !db.profiles[id]) throw new SaveError("This profile no longer exists.");
      db.activeProfileId = id;
      if (id) db.profiles[id].lastOpenedAt = now();
      write(db);
    },
    deleteProfile(id) {
      const db = read();
      delete db.profiles[id];
      if (db.activeProfileId === id) db.activeProfileId = null;
      write(db);
    },
  };
}

// ---------- migrations ----------
// v1 (before profiles): recompUser {name, age, prog}, recompMacros {kg, cm, sex, act, goal},
// recompFoods {foods, meals}, recompProgress:<name> {w, l, goal}. Old keys are left in place.

const OLD_ACT = {"1.2": "sedentary", "1.375": "light", "1.55": "moderate", "1.725": "very"};
const OLD_GOAL = {recomp: "lose", cut: "lose", keep: "maintain", bulk: "gain"};
const OLD_FOOD = {chicken: "chicken_breast_c", turkey: "turkey_breast_c", beef: "beef_95_c", tuna: "tuna_can", salmon: "salmon_c",
  whitefish: "cod_c", shrimp: "shrimp_c", eggs: "egg", whites: "egg_white", yogurt: "greek_0", cottage: "cottage", whey: "whey",
  rice: "rice_white_c", brownrice: "rice_brown_c", pasta: "pasta_c", oats: "oats_d", potato: "potato_boiled", sweetpotato: "sweet_potato_c",
  bread: "bread_ww", quinoa: "quinoa_c", lentils: "lentils_c", banana: "banana", dates: "dates_medjool", olive: "olive_oil",
  avocado: "avocado", almonds: "almonds", walnuts: "walnuts", pb: "peanut_butter", tahini: "tahini", cheese: "cheddar", butter: "butter"};

export function migrate(db, storage) {
  if (db.schema === SCHEMA && db.migratedV1) return db;
  if (!db.migratedV1) {
    const get = k => { try { return JSON.parse(storage.getItem(k) || "null"); } catch (e) { return null; } };
    const user = get("recompUser"), macros = get("recompMacros"), foods = get("recompFoods");
    const keys = []; for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k && k.startsWith("recompProgress:")) keys.push(k); }
    const names = new Set(keys.map(k => k.slice("recompProgress:".length)));
    if (user && user.name) names.add(normName(user.name));
    for (const lower of names) {
      const isUser = user && normName(user.name) === lower;
      const name = isUser ? user.name : lower.replace(/\b\w/g, c => c.toUpperCase());
      const age = isUser ? +user.age || null : null;
      if (Object.values(db.profiles).some(p => normName(p.name) === lower && (p.age ?? null) === age)) continue;
      const pr = get("recompProgress:" + lower) || {};
      const p = emptyProfile({name, age, migratedFrom: "v1"});
      if (isUser && macros) {
        if (+macros.kg) p.weightKg = +macros.kg;
        if (+macros.cm) p.heightCm = +macros.cm;
        p.sex = macros.sex === "f" ? "female" : "male";
        p.activity = OLD_ACT[macros.act] || "moderate";
        p.goal = OLD_GOAL[macros.goal] || "maintain";
      }
      if (isUser && foods) {
        p.preferred = (foods.foods || []).map(f => OLD_FOOD[f]).filter(Boolean);
        if (+foods.meals) p.mealsPerDay = +foods.meals;
      }
      p.weights = (pr.w || []).filter(x => x && x.d && +x.kg).map(x => ({d: x.d, kg: +x.kg}));
      if (pr.goal) p.targetWeightKg = +pr.goal;
      if (!p.weightKg && p.weights.length) p.weightKg = p.weights.slice().sort((a, b) => a.d < b.d ? 1 : -1)[0].kg;
      p.training.logs = (pr.l || []).map(x => ({d: x.d, ex: LEGACY_EXERCISE_NAMES[x.ex] || x.ex, kg: +x.kg, reps: +x.reps, s: x.s ?? null}));
      if (isUser && user.prog) p.legacyProgram = user.prog;   // turned into a real plan on first open
      db.profiles[p.id] = p;
      if (isUser) db.activeProfileId = p.id;
    }
    db.migratedV1 = true;
  }
  db.schema = SCHEMA;
  return db;
}
