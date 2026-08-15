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

export function money(value) {
  const n = Number(value || 0);
  return `${new Intl.NumberFormat("az-AZ", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n)} ₼`;
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("az-AZ", withTime
    ? { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }
    : { day:"2-digit", month:"2-digit", year:"numeric" }
  ).format(d);
}

export function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function nowLocalInput() {
  return toDatetimeLocal(new Date().toISOString());
}

export function daysUntil(value) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function effectiveStatus(project) {
  if (!project) return "suspended";
  if (project.status === "cancelled") return "cancelled";
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
  const base = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const targetDay = base.getDate();
  const result = new Date(base);
  result.setDate(1);
  result.setMonth(result.getMonth() + Number(months));
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(targetDay, lastDay));
  return result;
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

export function confirmAction(message) {
  return window.confirm(message);
}
