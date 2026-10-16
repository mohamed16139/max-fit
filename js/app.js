// App shell: routing, navigation, active-profile context, theme, install prompt.
import {createStore, uid} from "./core/store.js";
import {FOODS} from "./data/foods.js";
import {ensureStarterPlans} from "./core/starter.js";
import {$, icon, avatar, esc, guard, applyTheme} from "./ui/dom.js";
import {renderProfiles, renderOnboarding, renderMe} from "./ui/profiles.js";
import {renderTraining} from "./ui/training.js";
import {renderNutrition} from "./ui/nutrition.js";

const store = createStore();
const root = $("#root");

// ---------- context handed to every screen ----------
// A screen gets a ctx bound to ONE profile id. Its save() always writes to that id, so nothing a
// screen does can leak into another profile, even if the user switches while something is open.
function makeCtx(pid) {
  const ctx = {
    store, pid, uid,
    profile: () => store.profile(pid),
    foods() { const p = store.profile(pid); return p ? FOODS.concat(Object.values(p.nutrition.customFoods || {})) : FOODS; },
    foodById(id) { return FOODS.find(f => f.id === id) || ((store.profile(pid) || {}).nutrition?.customFoods || {})[id] || null; },
    save(fn, msg) { return guard(() => store.updateProfile(pid, fn), msg); },
    go, rerender: () => route(),
    now: () => new Date().toISOString(),
  };
  return ctx;
}
// ---------- routing ----------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
let lastSection = {training: "workout", nutrition: "today"};

function route() {
  const [, sec = "", sub = ""] = (location.hash || "#/").split("/");
  const pid = store.activeId();
  document.body.dataset.section = sec;
  if (sec === "new") return shell(null, el => renderOnboarding(el, {store, uid, go, mode: "create"}));
  if (!pid || sec === "profiles" || sec === "") {
    if (!pid || sec === "profiles") return shell(null, el => renderProfiles(el, {store, go, uid}));
  }
  const p = store.profile(pid);
  if (!p) return go("#/profiles");
  guard(() => ensureStarterPlans(store, pid, uid));
  if (p.age == null || !p.heightCm || !p.weightKg) {           // migrated profile with missing details
    if (sec !== "edit") return go("#/edit");
  }
  if (sec === "edit") return shell(null, el => renderOnboarding(el, {store, uid, go, mode: "edit", pid}));
  const ctx = makeCtx(pid);
  if (sec === "training") { lastSection.training = sub || lastSection.training; return shell(ctx, el => renderTraining(el, ctx, lastSection.training)); }
  if (sec === "nutrition") { lastSection.nutrition = sub || lastSection.nutrition; return shell(ctx, el => renderNutrition(el, ctx, lastSection.nutrition)); }
  if (sec === "me") return shell(ctx, el => renderMe(el, ctx));
  go("#/training/workout");
}

function shell(ctx, render) {
  const sec = document.body.dataset.section;
  window.scrollTo(0, 0);
  if (!ctx) { root.innerHTML = `<main class="app" style="padding-bottom:24px"><div id="view"></div></main>`; render($("#view")); return; }
  const p = ctx.profile();
  const nav = [["training", "Training", icon("dumbbell")], ["nutrition", "Nutrition", icon("utensils")], ["me", "Profile", avatar(p)]];
  root.innerHTML = `<main class="app" id="main"><div id="view"></div></main>
   <nav class="nav" aria-label="Main"><ul>${nav.map(([id, label, ic]) => `<li><a href="#/${id}" ${sec === id ? 'aria-current="page"' : ""}>${ic}<span>${label}</span></a></li>`).join("")}</ul></nav>`;
  render($("#view"));
}

// Another tab changed the data: reload it so we never show or save stale information.
window.addEventListener("storage", e => { if (e.key === "mangafit.db") { store.refresh(); route(); } });
window.addEventListener("hashchange", route);

// ---------- theme ----------
try { applyTheme(localStorage.getItem("theme")); } catch (e) { /* storage blocked */ }

// ---------- install to home screen ----------
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; showInstall(); });
window.addEventListener("appinstalled", () => { deferredInstall = null; $("#install")?.remove(); });
function showInstall() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  let snooze = 0; try { snooze = +localStorage.getItem("installSnooze") || 0; } catch (e) {}
  if (standalone || Date.now() < snooze || $("#install")) return;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!deferredInstall && !ios) return;
  const el = document.createElement("div");
  el.id = "install"; el.className = "toast show"; el.style.bottom = "calc(var(--nav-h) + var(--safe-b) + 14px)";
  el.innerHTML = `${icon("house", "sm")}<span>${deferredInstall ? "Add Manga Fit to your home screen" : "Tap Share, then “Add to Home Screen”"}</span>${deferredInstall ? '<button type="button" data-a="add">Add</button>' : ""}<button type="button" data-a="x" aria-label="Not now">${icon("x", "sm")}</button>`;
  el.onclick = async e => {
    const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
    if (a === "add" && deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; }
    if (a === "x") try { localStorage.setItem("installSnooze", Date.now() + 3 * 864e5); } catch (err) {}
    el.remove();
  };
  document.body.appendChild(el);
}
setTimeout(showInstall, 2500);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

// ---------- start ----------
try { store.read(); route(); }
catch (e) { root.innerHTML = `<div class="wrap"><div class="empty">${icon("triangle-alert")}<h3>Couldn't load your data</h3><p>${esc(e.message)}</p></div></div>`; }
