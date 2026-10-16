// Small UI toolkit shared by every screen: escaping, icons, sheets, confirm, toast, formatting, chart.
import {ICONS} from "../icons-data.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

export function icon(name, cls = "") {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}
/** Icon-only button with an accessible label and tooltip. */
export function ibtn(name, label, attrs = "", cls = "") {
  return `<button type="button" class="ibtn ${cls}" aria-label="${esc(label)}" data-tip="${esc(label)}" ${attrs}>${icon(name)}</button>`;
}

// ---------- formatting ----------
export const r0 = v => Number.isFinite(v) ? Math.round(v) : 0;
export const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
export const fmt = (v, d = 0) => Number.isFinite(v) ? v.toLocaleString(undefined, {maximumFractionDigits: d, minimumFractionDigits: 0}) : "–";
export const kcal = v => fmt(r0(v));
export function qtyLabel(qty, unit) { return `${fmt(qty, unit === "L" ? 2 : 1)} ${unit}`; }
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => iso(new Date());
export const fmtDate = d => new Date(d + "T00:00").toLocaleDateString(undefined, {day: "numeric", month: "short"});
export const fmtDateLong = s => new Date(s).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"});
export function initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"; }
const AV = ["#FF7A1A", "#F5C04A", "#5AB7E6", "#43C27A", "#E86FA5", "#A88BFA", "#F28B5B", "#4FD1C5"];
export function avatar(p, cls = "") {
  let h = 0; for (const c of p.id || p.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="av ${cls}" style="background:${AV[h % AV.length]}" aria-hidden="true">${esc(initials(p.name))}</span>`;
}

// ---------- toast ----------
let toastT;
export function toast(msg, {error = false, action = null, ms = 2600} = {}) {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
  el.className = "toast" + (error ? " err" : "");
  el.innerHTML = `${icon(error ? "triangle-alert" : "circle-check", "sm")}<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
  if (action) el.querySelector("button").onclick = () => { el.classList.remove("show"); action.run(); };
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), action ? 5000 : ms);
}

// ---------- sheets ----------
/**
 * Open a bottom sheet (dialog on wide screens). render(body, close) fills it; returns a promise
 * resolved with whatever close(value) is called with (undefined if dismissed).
 */
export function sheet({title, render, footer = null, wide = false}) {
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "sheet"; if (wide) d.style.maxWidth = "760px";
    d.innerHTML = `<div class="grab" aria-hidden="true"></div><div class="sheet-h"><h2>${esc(title)}</h2>${ibtn("x", "Close", 'data-close')}</div><div class="sheet-b"></div>${footer ? '<div class="sheet-f"></div>' : ""}`;
    document.body.appendChild(d);
    let done = false;
    const close = v => { if (done) return; done = true; d.close(); d.remove(); resolve(v); };
    d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) close(); });
    d.addEventListener("cancel", e => { e.preventDefault(); close(); });
    const api = {el: d, body: $(".sheet-b", d), foot: $(".sheet-f", d), close, setTitle: t => $(".sheet-h h2", d).textContent = t};
    render(api.body, close, api);
    if (footer) footer(api.foot, close, api);
    d.showModal();
    const f = $("[autofocus]", d); const h = $(".sheet-h h2", d); h.tabIndex = -1;
    (f || h).focus({preventScroll: true});
  });
}
/** Confirmation dialog. Resolves true/false. */
export function confirmDialog({title, message, confirm = "Confirm", danger = false}) {
  return sheet({
    title, render: b => { b.innerHTML = `<p class="muted">${esc(message)}</p>`; },
    footer: (f, close) => {
      f.innerHTML = `<button type="button" class="btn ghost" data-v="0">Cancel</button><button type="button" class="btn ${danger ? "danger" : "primary"}" data-v="1">${danger ? icon("trash-2", "sm") : ""}${esc(confirm)}</button>`;
      f.onclick = e => { const b = e.target.closest("[data-v]"); if (b) close(b.dataset.v === "1"); };
    },
  }).then(v => !!v);
}
/** One-field text prompt (rename etc.). Resolves the trimmed value or null. */
export function promptDialog({title, label, value = "", confirm = "Save", max = 60}) {
  return sheet({
    title, render: b => { b.innerHTML = `<form class="field" id="pf"><label for="pfv">${esc(label)}</label><input class="input" id="pfv" maxlength="${max}" value="${esc(value)}" autofocus required><div class="err-msg" id="pfe"></div></form>`; },
    footer: (f, close, api) => {
      f.innerHTML = `<button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" form="pf" class="btn primary">${esc(confirm)}</button>`;
      $("#pf", api.body).onsubmit = e => { e.preventDefault(); const v = $("#pfv", api.body).value.trim(); if (!v) { $("#pfe", api.body).textContent = "This can't be empty."; return; } close(v); };
    },
  }).then(v => v ?? null);
}

/** Run a save and show a friendly error if it fails. Returns the result or undefined. */
export function guard(fn, okMsg) {
  try { const r = fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message || "Something went wrong.", {error: true}); return undefined; }
}

// ---------- chart ----------
/** Single-series line chart with a hover/tap readout. pts: [{d, v, tip?}] sorted by date. */
export function lineChart(el, pts, {unit = "kg", goal = null} = {}) {
  if (!pts.length) { el.innerHTML = ""; return; }
  const W = Math.max(280, el.clientWidth || 600), H = 200, L = 38, R = 12, T = 14, B = 24;
  const ts = pts.map(p => +new Date(p.d + "T00:00")), t0 = ts[0], t1 = ts[ts.length - 1];
  let lo = Math.min(...pts.map(p => p.v), goal ?? Infinity), hi = Math.max(...pts.map(p => p.v), goal ?? -Infinity);
  const pad = Math.max((hi - lo) * 0.15, 1); lo -= pad; hi += pad;
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100].find(s => (hi - lo) / s <= 5) || 100;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = v => t1 === t0 ? L + (W - L - R) / 2 : L + (v - t0) / (t1 - t0) * (W - L - R), y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let g = "";
  for (let v = lo; v <= hi + 1e-9; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${fmt(v, 1)}</text>`;
  const xs = pts.length > 1 ? [0, pts.length - 1] : [0];
  xs.forEach(i => g += `<text x="${x(ts[i])}" y="${H - 6}" text-anchor="${pts.length > 1 ? (i ? "end" : "start") : "middle"}" class="ax">${fmtDate(pts[i].d)}</text>`);
  if (goal != null) g += `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" class="goal"/><text x="${W - R}" y="${y(goal) - 5}" text-anchor="end" class="ax">Goal ${fmt(goal, 1)}</text>`;
  const path = pts.map((p, i) => (i ? "L" : "M") + x(ts[i]).toFixed(1) + " " + y(p.v).toFixed(1)).join("");
  const dots = pts.length <= 40 ? pts.map((p, i) => `<circle cx="${x(ts[i])}" cy="${y(p.v)}" r="4" class="pt"/>`).join("") : "";
  el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${pts.length} entries, latest ${fmt(pts[pts.length - 1].v, 1)} ${unit}">${g}<path d="${path}" class="ln"/>${dots}<line class="xh hidden" y1="${T}" y2="${H - B}"/></svg><div class="tip hidden"></div></div>`;
  const svg = $("svg", el), xh = $(".xh", el), tip = $(".tip", el);
  const show = e => {
    const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * (W / r.width);
    let i = 0; ts.forEach((v, k) => { if (Math.abs(x(v) - mx) < Math.abs(x(ts[i]) - mx)) i = k; });
    const px = x(ts[i]), py = y(pts[i].v);
    xh.setAttribute("x1", px); xh.setAttribute("x2", px);
    tip.innerHTML = `<b>${esc(pts[i].tip || fmt(pts[i].v, 1) + " " + unit)}</b><br>${fmtDate(pts[i].d)}`;
    tip.style.left = Math.min(Math.max(px * r.width / W, 60), r.width - 60) + "px"; tip.style.top = (py * r.height / H - 10) + "px";
    xh.classList.remove("hidden"); tip.classList.remove("hidden");
  };
  svg.onpointermove = show; svg.onpointerdown = show;
  svg.onpointerleave = () => { xh.classList.add("hidden"); tip.classList.add("hidden"); };
}

export function applyTheme(t) {
  if (t === "light") document.documentElement.dataset.theme = "light"; else delete document.documentElement.dataset.theme;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === "light" ? "#F3F3F1" : "#0A0A0A";
}
