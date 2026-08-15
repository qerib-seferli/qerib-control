export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const APP_TIME_ZONE = "Asia/Baku";

export function money(value, currency = "AZN") {
  const n = Number(value || 0);
  const formatted = new Intl.NumberFormat("az-AZ", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n);
  const symbol = ({ AZN:"₼", USD:"$", EUR:"€" })[currency] || currency;
  return currency === "USD" || currency === "EUR"
    ? `${symbol}${formatted}`
    : `${formatted} ${symbol}`;
}

function bakuParts(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(d);
  const obj = {};
  for (const part of parts) {
    if (part.type !== "literal") obj[part.type] = part.value;
  }
  return obj;
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("az-AZ", withTime
    ? {
        timeZone: APP_TIME_ZONE,
        day:"2-digit", month:"2-digit", year:"numeric",
        hour:"2-digit", minute:"2-digit", hourCycle:"h23"
      }
    : { timeZone: APP_TIME_ZONE, day:"2-digit", month:"2-digit", year:"numeric" }
  ).format(d);
}

export function toDatetimeLocal(value) {
  if (!value) return "";
  const p = bakuParts(value);
  if (!p) return "";
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function localToIso(value) {
  if (!value) return null;
  // Q-Control biznes saatı Azərbaycan vaxtıdır (+04:00, DST yoxdur).
  const normalized = String(value).length === 16 ? `${value}:00+04:00` : `${value}+04:00`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function nowLocalInput() {
  return toDatetimeLocal(new Date());
}

export function daysUntil(value) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function isCurrentBakuMonth(value) {
  const item = bakuParts(value);
  const now = bakuParts(new Date());
  return Boolean(item && now && item.year === now.year && item.month === now.month);
}

export function effectiveStatus(project) {
  if (!project) return "suspended";
  if (project.status === "cancelled") return "cancelled";

  // Monitor-only və birdəfəlik layihələr Q-Control tərəfindən bloklanmır.
  if (project.control_mode !== "enforced_recurring") return "active";

  if (project.status === "suspended") return "suspended";
  if (project.auto_suspend && project.paid_until && new Date(project.paid_until).getTime() <= Date.now()) return "suspended";
  return "active";
}

export function statusLabel(status) {
  return ({ active:"AKTİV", suspended:"DAYANDIRILIB", cancelled:"LƏĞV EDİLİB" })[status] || status;
}

export function slugify(value = "") {
  const map = { ə:"e", ı:"i", ö:"o", ü:"u", ş:"s", ç:"c", ğ:"g", Ə:"e", İ:"i", Ö:"o", Ü:"u", Ş:"s", Ç:"c", Ğ:"g" };
  return value.trim().split("").map(c => map[c] ?? c).join("")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,80);
}

export function addMonthsKeepingAnchor(dateValue, months) {
  const p = bakuParts(dateValue || new Date());
  if (!p) return null;

  const year = Number(p.year);
  const monthIndex = Number(p.month) - 1;
  const day = Number(p.day);
  const hour = Number(p.hour);
  const minute = Number(p.minute);
  const second = Number(p.second || 0);

  const target = new Date(Date.UTC(year, monthIndex + Number(months), 1, hour - 4, minute, second));
  const targetBaku = bakuParts(target);
  if (!targetBaku) return null;

  const targetYear = Number(targetBaku.year);
  const targetMonth = Number(targetBaku.month);
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);

  const iso = `${targetYear}-${String(targetMonth).padStart(2,"0")}-${String(safeDay).padStart(2,"0")}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:${String(second).padStart(2,"0")}+04:00`;
  const result = new Date(iso);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function toast(message, type = "success", timeout = 3200) {
  const host = $("#toastHost");
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => node.remove(), timeout);
}

export async function copyText(text, message = "Kopyalandı") {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast(message);
  }
}

export function safeDomain(value = "") {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

