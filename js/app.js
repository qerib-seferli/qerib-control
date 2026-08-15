import { CONFIG } from "./config.js";
import { supabase } from "./supabase.js";
import * as api from "./api.js";
import {
  $, $$, esc, money, formatDate, toDatetimeLocal, localToIso, nowLocalInput,
  daysUntil, isCurrentBakuMonth, effectiveStatus, statusLabel, slugify, addMonthsKeepingAnchor,
  toast, copyText, safeDomain
} from "./core.js";

const state = {
  session: null,
  me: null,
  projects: [],
  payments: [],
  logs: [],
  view: "dashboard",
  deferredInstallPrompt: null,
  detailProjectId: null,
  pendingIconFile: null,
  pendingIconRemove: false,
  confirmResolver: null
};

const viewMeta = {
  dashboard: ["Dashboard", "Bütün xidmətlərin cari vəziyyəti"],
  projects: ["Layihələr", "Layihələrin tam idarəetməsi"],
  payments: ["Ödənişlər", "Ödəniş və müddət tarixçəsi"],
  logs: ["Tarixçə", "Fəaliyyət və audit jurnalı"],
  settings: ["Parametrlər", "Profil və sistem məlumatları"]
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  registerPwa();
  updateOnlineState();

  try {
    state.session = await api.getSession();
    if (!state.session) return showLogin();

    const me = await api.getMe();
    if (!me?.is_admin) {
      await api.signOut();
      toast("Bu hesab Q-Control admini deyil.", "error");
      return showLogin();
    }

    state.me = me;
    showApp();
    await loadAll();
  } catch (err) {
    console.error(err);
    toast(errorMessage(err), "error", 6000);
    showLogin();
  } finally {
    $("#boot").classList.add("hidden");
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    state.session = session;
    if (event === "SIGNED_OUT") showLogin();
  });
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#logoutBtn").addEventListener("click", handleLogout);
  $("#togglePassword").addEventListener("click", () => {
    const input = $("#loginPassword");
    input.type = input.type === "password" ? "text" : "password";
  });

  $$(".nav-item, .mobile-nav-item[data-view]").forEach(btn =>
    btn.addEventListener("click", () => switchView(btn.dataset.view))
  );
  $("#addProjectBtn").addEventListener("click", () => openProjectDialog());
  $("#mobileAddProjectBtn").addEventListener("click", () => openProjectDialog());
  $("#dashboardSearch").addEventListener("input", renderProjectCards);
  $("#dashboardFilter").addEventListener("change", renderProjectCards);
  $("#projectsSearch").addEventListener("input", renderProjectsTable);

  $("#projectName").addEventListener("input", () => {
    if (!$("#projectId").value) $("#projectSlug").value = slugify($("#projectName").value);
  });
  $("#projectIconButton").addEventListener("click", () => $("#projectIconInput").click());
  $("#chooseProjectIconBtn").addEventListener("click", () => $("#projectIconInput").click());
  $("#projectIconInput").addEventListener("change", handleIconPick);
  $("#removeProjectIconBtn").addEventListener("click", handleIconRemove);
  $("#confirmCancelBtn").addEventListener("click", () => resolveConfirm(false));
  $("#confirmOkBtn").addEventListener("click", () => resolveConfirm(true));
  $("#projectForm").addEventListener("submit", handleProjectSave);
  $("#extendForm").addEventListener("submit", handleExtendSave);
  $$(".month-btn").forEach(btn => btn.addEventListener("click", () => selectMonths(Number(btn.dataset.months))));
  $("#profileForm").addEventListener("submit", handleProfileSave);
  $("#refreshSessionBtn").addEventListener("click", refreshSession);
  $("#copyIntegrationBtn").addEventListener("click", copyCurrentIntegration);
  $("#editFromDetailBtn").addEventListener("click", editCurrentDetail);

  $$("[data-close-dialog]").forEach(btn => btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.closeDialog)?.close();
  }));

  $("#menuBtn").addEventListener("click", openDrawer);
  $("#drawerBackdrop").addEventListener("click", closeDrawer);

  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    $("#installBtn").classList.remove("hidden");
  });
  $("#installBtn").addEventListener("click", installPwa);

  document.addEventListener("click", handleDelegatedClick);
}

async function handleLogin(event) {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Daxil olunur…");
  try {
    await api.signIn($("#loginEmail").value.trim(), $("#loginPassword").value);
    const me = await api.getMe();
    if (!me?.is_admin) throw new Error("Bu hesab admin kimi təsdiqlənməyib.");
    state.me = me;
    state.session = await api.getSession();
    showApp();
    await loadAll();
    toast("Q-Control-a xoş gəldiniz.");
  } catch (err) {
    toast(errorMessage(err), "error", 5000);
    try { await api.signOut(); } catch {}
  } finally {
    setBusy(button, false);
  }
}

async function handleLogout() {
  try {
    await api.signOut();
    state.projects = [];
    state.payments = [];
    state.logs = [];
    showLogin();
  } catch (err) {
    toast(errorMessage(err), "error");
  }
}

function showLogin() {
  $("#boot").classList.add("hidden");
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
}

function showApp() {
  $("#boot").classList.add("hidden");
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#adminName").textContent = state.me?.display_name || "Admin";
  $("#adminEmail").textContent = state.me?.email || state.session?.user?.email || "—";
  $("#profileName").value = state.me?.display_name || "";
}

async function loadAll() {
  try {
    await api.refreshStatuses();
  } catch (err) {
    console.warn("Status refresh:", err);
  }

  const [projects, payments, logs] = await Promise.all([
    api.listProjects(),
    api.listPayments(),
    api.listLogs()
  ]);
  state.projects = projects;
  state.payments = payments;
  state.logs = logs;
  $("#supabaseState").textContent = "Qoşulub";
  renderAll();
}

function renderAll() {
  renderStats();
  renderProjectCards();
  renderProjectsTable();
  renderPayments();
  renderLogs();
}

function renderStats() {
  const active = state.projects.filter(p => effectiveStatus(p) === "active");
  const suspended = state.projects.filter(p => effectiveStatus(p) === "suspended");
  const dueSoon = state.projects.filter(p => {
    if (effectiveStatus(p) !== "active") return false;
    const d = daysUntil(p.paid_until);
    return d !== null && d >= 0 && d <= CONFIG.DUE_SOON_DAYS;
  });

  const mrr = active.reduce((sum, p) => sum + Number(p.monthly_price || 0), 0);
  const totalIncome = state.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const monthIncome = state.payments
    .filter(p => isCurrentBakuMonth(p.paid_at))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  $("#statActive").textContent = active.length;
  $("#statSuspended").textContent = suspended.length;
  $("#statDueSoon").textContent = dueSoon.length;
  $("#statMRR").textContent = money(mrr);
  $("#statMonthIncome").textContent = money(monthIncome);
  $("#statTotalIncome").textContent = money(totalIncome);

  $("#paymentsMonthIncome").textContent = money(monthIncome);
  $("#paymentsTotalIncome").textContent = money(totalIncome);
  $("#paymentsCount").textContent = new Intl.NumberFormat("az-AZ").format(state.payments.length);
}

function renderProjectCards() {
  const q = $("#dashboardSearch").value.trim().toLowerCase();
  const filter = $("#dashboardFilter").value;
  const list = state.projects.filter(p => {
    const status = effectiveStatus(p);
    const d = daysUntil(p.paid_until);
    const matchesQ = !q || `${p.name} ${p.domain || ""} ${p.slug}`.toLowerCase().includes(q);
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && status === "active") ||
      (filter === "suspended" && status === "suspended") ||
      (filter === "due" && status === "active" && d !== null && d >= 0 && d <= CONFIG.DUE_SOON_DAYS);
    return matchesQ && matchesFilter;
  });

  $("#projectCards").innerHTML = list.length ? list.map(projectCardHtml).join("") :
    `<div class="empty">Bu filtr üzrə layihə tapılmadı.</div>`;
}

function projectCardHtml(p) {
  const status = effectiveStatus(p);
  const d = daysUntil(p.paid_until);
  const dueClass = status === "active" && d !== null && d >= 0 && d <= CONFIG.DUE_SOON_DAYS;
  const badgeClass = dueClass ? "due" : status;
  const badgeText = dueClass ? `${d === 0 ? "BU GÜN" : `${d} GÜN QALIB`}` : statusLabel(status);
  const initials = esc((p.name || "Q").trim().charAt(0).toUpperCase());
  const icon = projectIconHtml(p, initials);
  return `
    <article class="project-card ${status}">
      <div class="project-top">
        <div class="project-icon">${icon}</div>
        <div class="project-meta">
          <h4>${esc(p.name)}</h4>
          <p>${esc(p.domain || p.slug)}</p>
        </div>
        <span class="badge ${badgeClass}">● ${esc(badgeText)}</span>
      </div>
      <div class="project-info">
        <div class="mini-kv"><span>Aylıq</span><b>${money(p.monthly_price)}</b></div>
        <div class="mini-kv"><span>Bitmə tarixi</span><b>${formatDate(p.paid_until, true)}</b></div>
        <div class="mini-kv"><span>Avtomatik</span><b>${p.auto_suspend ? "Aktiv" : "Söndürülüb"}</b></div>
        <div class="mini-kv"><span>Son dəyişiklik</span><b>${formatDate(p.updated_at, true)}</b></div>
      </div>
      <div class="project-actions">
        <button class="btn btn-success" data-action="pay" data-id="${p.id}">₼ Ödəniş</button>
        <button class="btn ${status === "active" ? "btn-danger" : "btn-soft"}" data-action="${status === "active" ? "suspend" : "activate"}" data-id="${p.id}">
          ${status === "active" ? "Dayandır" : "Aktiv et"}
        </button>
        <button class="btn btn-ghost" data-action="detail" data-id="${p.id}">Ətraflı</button>
      </div>
    </article>`;
}

function renderProjectsTable() {
  const q = $("#projectsSearch").value.trim().toLowerCase();
  const list = state.projects.filter(p => !q || `${p.name} ${p.domain || ""} ${p.slug}`.toLowerCase().includes(q));
  $("#projectsTableBody").innerHTML = list.length ? list.map(p => {
    const status = effectiveStatus(p);
    return `<tr>
      <td><div class="table-project"><div class="table-project-icon">${projectIconHtml(p, esc((p.name || "Q").trim().charAt(0).toUpperCase()))}</div><div class="cell-main"><strong>${esc(p.name)}</strong><span>${esc(p.domain || p.slug)}</span></div></div></td>
      <td><span class="badge ${status}">● ${statusLabel(status)}</span></td>
      <td>${money(p.monthly_price)}</td>
      <td>${formatDate(p.paid_until, true)}</td>
      <td>${p.auto_suspend ? "Bəli" : "Xeyr"}</td>
      <td><div class="table-actions">
        <button class="btn btn-soft" data-action="detail" data-id="${p.id}">Bax</button>
        <button class="btn btn-ghost" data-action="edit" data-id="${p.id}">Redaktə</button>
      </div></td>
    </tr>`;
  }).join("") : `<tr><td colspan="6">Layihə tapılmadı.</td></tr>`;
}

function renderPayments() {
  $("#paymentsTableBody").innerHTML = state.payments.length ? state.payments.map(p => `
    <tr>
      <td>${formatDate(p.paid_at, true)}</td>
      <td><div class="cell-main"><strong>${esc(p.control_projects?.name || "—")}</strong><span>${esc(p.control_projects?.domain || "")}</span></div></td>
      <td><strong>${money(p.amount)}</strong></td>
      <td>${p.months} ay</td>
      <td>${formatDate(p.period_from)} → ${formatDate(p.period_to)}</td>
      <td>${esc(p.note || "—")}</td>
    </tr>`).join("") : `<tr><td colspan="6">Hələ ödəniş qeydi yoxdur.</td></tr>`;
}

function renderLogs() {
  $("#logsList").innerHTML = state.logs.length ? state.logs.map(log => `
    <article class="log-item">
      <div class="log-icon">${logIcon(log.action)}</div>
      <div>
        <strong>${esc(logTitle(log))}</strong>
        <p>${esc(log.details?.message || log.control_projects?.name || "")}</p>
      </div>
      <time>${formatDate(log.created_at, true)}</time>
    </article>`).join("") : `<div class="empty">Fəaliyyət qeydi yoxdur.</div>`;
}

function logIcon(action) {
  if (action.includes("payment")) return "₼";
  if (action.includes("status")) return "◉";
  if (action.includes("project")) return "◇";
  return "•";
}

function logTitle(log) {
  const names = {
    project_created: "Layihə yaradıldı",
    project_updated: "Layihə yeniləndi",
    project_archived: "Layihə arxivləndi",
    status_changed: "Status dəyişdirildi",
    payment_recorded: "Ödəniş qeydə alındı",
    public_key_regenerated: "Public key yeniləndi",
    profile_updated: "Profil yeniləndi",
    auto_suspended: "Avtomatik dayandırıldı"
  };
  return names[log.action] || log.action;
}

function switchView(view) {
  state.view = view;
  $$(".nav-item, .mobile-nav-item[data-view]").forEach(x =>
    x.classList.toggle("active", x.dataset.view === view)
  );
  $$(".view").forEach(x => x.classList.toggle("active", x.id === `${view}View`));
  $("#viewTitle").textContent = viewMeta[view]?.[0] || "Q-Control";
  $("#viewSubtitle").textContent = viewMeta[view]?.[1] || "";
  closeDrawer();
}

function openProjectDialog(project = null) {
  state.pendingIconFile = null;
  state.pendingIconRemove = false;
  $("#projectIconInput").value = "";
  setProjectIconPreview(project?.icon_url || null, project?.name || "Q");
  $("#removeProjectIconBtn").classList.toggle("hidden", !project?.icon_url);
  $("#projectDialogTitle").textContent = project ? "Layihəni redaktə et" : "Yeni layihə";
  $("#projectId").value = project?.id || "";
  $("#projectName").value = project?.name || "";
  $("#projectSlug").value = project?.slug || "";
  $("#projectDomain").value = project?.domain || "";
  $("#projectPrice").value = Number(project?.monthly_price || 0);
  $("#projectPaidUntil").value = toDatetimeLocal(project?.paid_until);
  $("#projectStatus").value = project?.status || "active";
  $("#projectAutoSuspend").checked = project?.auto_suspend ?? true;
  $("#projectMaintenanceTitle").value = project?.maintenance_title || "Xidmət müvəqqəti dayandırılıb";
  $("#projectMaintenanceMessage").value = project?.maintenance_message || "Sistem infrastrukturu üzrə xidmət hazırda əlçatan deyil. Xidmət bərpa edildikdən sonra platforma avtomatik olaraq yenidən aktiv olacaq.";
  $("#projectNotes").value = project?.notes || "";
  $("#projectDialog").showModal();
}

async function handleProjectSave(event) {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Yadda saxlanır…");
  const payload = {
    id: $("#projectId").value || null,
    name: $("#projectName").value.trim(),
    slug: slugify($("#projectSlug").value),
    domain: safeDomain($("#projectDomain").value),
    monthly_price: Number($("#projectPrice").value || 0),
    paid_until: localToIso($("#projectPaidUntil").value),
    status: $("#projectStatus").value,
    auto_suspend: $("#projectAutoSuspend").checked,
    maintenance_title: $("#projectMaintenanceTitle").value.trim(),
    maintenance_message: $("#projectMaintenanceMessage").value.trim(),
    notes: $("#projectNotes").value.trim()
  };
  try {
    const savedId = await api.saveProject(payload);
    const projectId = payload.id || savedId;

    if (state.pendingIconRemove && projectId) {
      await api.deleteProjectIcon(projectId);
    }
    if (state.pendingIconFile && projectId) {
      const iconBlob = await prepareIconBlob(state.pendingIconFile);
      await api.uploadProjectIcon(projectId, iconBlob);
    }

    state.pendingIconFile = null;
    state.pendingIconRemove = false;
    $("#projectDialog").close();
    await loadAll();
    toast(payload.id ? "Layihə yeniləndi." : "Layihə yaradıldı.");
  } catch (err) {
    toast(errorMessage(err), "error", 5000);
  } finally {
    setBusy(button, false);
  }
}

function openExtend(project) {
  $("#extendProjectId").value = project.id;
  $("#extendProjectName").textContent = project.name;
  $("#extendAmount").value = Number(project.monthly_price || 0);
  $("#extendPaidAt").value = nowLocalInput();
  $("#extendNote").value = "";
  selectMonths(1);
  $("#extendDialog").showModal();
}

function selectMonths(months) {
  $("#extendMonths").value = months;
  $$(".month-btn").forEach(b => b.classList.toggle("active", Number(b.dataset.months) === months));
  const project = getProject($("#extendProjectId").value);
  if (project) {
    $("#extendAmount").value = (Number(project.monthly_price || 0) * months).toFixed(2);
    const next = addMonthsKeepingAnchor(project.paid_until || new Date().toISOString(), months);
    $("#extendPreview").innerHTML = `Cari bitmə: <b>${formatDate(project.paid_until, true)}</b><br>Yeni bitmə: <b>${formatDate(next?.toISOString(), true)}</b><br>Ödəniş qeydə alındıqdan sonra status <b>AKTİV</b> ediləcək.`;
  }
}

async function handleExtendSave(event) {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Qeyd olunur…");
  try {
    await api.recordPaymentAndExtend({
      projectId: $("#extendProjectId").value,
      months: Number($("#extendMonths").value),
      amount: Number($("#extendAmount").value),
      paidAt: localToIso($("#extendPaidAt").value),
      note: $("#extendNote").value.trim()
    });
    $("#extendDialog").close();
    await loadAll();
    toast("Ödəniş qeyd edildi və layihə aktivləşdirildi.");
  } catch (err) {
    toast(errorMessage(err), "error", 5000);
  } finally {
    setBusy(button, false);
  }
}

async function changeStatus(project, status) {
  const activating = status === "active";
  const approved = await qConfirm({
    title: activating ? "Layihə aktivləşdirilsin?" : "Xidmət dayandırılsın?",
    message: activating
      ? `${project.name} dərhal aktiv statusa keçiriləcək.`
      : `${project.name} üçün xidmət ekranı aktiv ediləcək.`,
    confirmText: activating ? "Aktivləşdir" : "Dayandır",
    tone: activating ? "primary" : "danger"
  });
  if (!approved) return;
  try {
    await api.setProjectStatus(project.id, status);
    await loadAll();
    toast(status === "active" ? "Layihə aktivləşdirildi." : "Layihə dayandırıldı.");
  } catch (err) {
    toast(errorMessage(err), "error", 5000);
  }
}

function openDetail(project) {
  state.detailProjectId = project.id;
  const status = effectiveStatus(project);
  $("#detailName").textContent = project.name;
  $("#detailDomain").textContent = project.domain || project.slug;
  $("#detailProjectIcon").innerHTML = projectIconHtml(project, esc((project.name || "Q").trim().charAt(0).toUpperCase()));
  const integration = integrationSnippet(project);
  const mode = project.domain ? "Cloudflare Worker" : "Frontend guard";
  $("#copyIntegrationBtn").textContent = project.domain ? "Route məlumatını kopyala" : "İnteqrasiya kodunu kopyala";
  $("#detailContent").innerHTML = `
    <div class="detail-grid">
      <div class="detail-box"><span>Status</span><b>${statusLabel(status)}</b></div>
      <div class="detail-box"><span>Aylıq</span><b>${money(project.monthly_price)}</b></div>
      <div class="detail-box"><span>Bitmə tarixi</span><b>${formatDate(project.paid_until, true)}</b></div>
      <div class="detail-box"><span>Avto dayandırma</span><b>${project.auto_suspend ? "Aktiv" : "Söndürülüb"}</b></div>
      <div class="detail-box"><span>Qoruma üsulu</span><b>${mode}</b></div>
      <div class="detail-box"><span>Slug</span><b>${esc(project.slug)}</b></div>
    </div>
    <pre class="code-box">${esc(integration)}</pre>
    <div class="modal-actions" style="border-top:0;padding-top:0">
      <button class="btn btn-soft" data-action="regen-key" data-id="${project.id}">Public key yenilə</button>
      <button class="btn btn-danger" data-action="archive" data-id="${project.id}">Arxivlə</button>
    </div>`;
  $("#detailDialog").showModal();
}

function integrationSnippet(project) {
  if (project.domain) {
    return `Cloudflare Worker route:
${project.domain}/*
www.${project.domain}/*

Worker: q-control-gateway
Q-Control layihə domeni: ${project.domain}

HTML və JS fayllarına heç bir kod əlavə etmək lazım deyil.`;
  }

  return `<script>
window.Q_CONTROL = {
  projectKey: "${project.public_key}",
  domain: ""
};
<\/script>
<script src="https://qerib-seferli.github.io/qerib-control/client/q-control-guard.js"><\/script>`;
}

async function copyCurrentIntegration() {
  const project = getProject(state.detailProjectId);
  if (project) await copyText(integrationSnippet(project), "İnteqrasiya kodu kopyalandı.");
}

function editCurrentDetail() {
  const project = getProject(state.detailProjectId);
  if (!project) return;
  $("#detailDialog").close();
  openProjectDialog(project);
}

async function handleProfileSave(event) {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Saxlanır…");
  try {
    state.me = await api.updateProfileName($("#profileName").value.trim());
    $("#adminName").textContent = state.me.display_name || "Admin";
    toast("Profil yeniləndi.");
  } catch (err) {
    toast(errorMessage(err), "error");
  } finally {
    setBusy(button, false);
  }
}

async function refreshSession() {
  try {
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
    toast("Sessiya yeniləndi.");
  } catch (err) {
    toast(errorMessage(err), "error");
  }
}

async function handleDelegatedClick(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const project = getProject(btn.dataset.id);
  if (!project) return;

  if (btn.dataset.action === "pay") return openExtend(project);
  if (btn.dataset.action === "suspend") return changeStatus(project, "suspended");
  if (btn.dataset.action === "activate") return changeStatus(project, "active");
  if (btn.dataset.action === "detail") return openDetail(project);
  if (btn.dataset.action === "edit") return openProjectDialog(project);

  if (btn.dataset.action === "archive") {
    if (!await qConfirm({
      title: "Layihə arxivlənsin?",
      message: `${project.name} siyahıdan çıxarılacaq, tarixçə və ödəniş məlumatları silinməyəcək.`,
      confirmText: "Arxivlə",
      tone: "danger"
    })) return;
    try {
      await api.archiveProject(project.id);
      $("#detailDialog").close();
      await loadAll();
      toast("Layihə arxivləndi.");
    } catch (err) { toast(errorMessage(err), "error"); }
  }

  if (btn.dataset.action === "regen-key") {
    if (!await qConfirm({
      title: "Public key yenilənsin?",
      message: "Domeni olmayan frontend inteqrasiyalarında köhnə açar dərhal etibarsız olacaq.",
      confirmText: "Yenilə",
      tone: "danger"
    })) return;
    try {
      await api.regeneratePublicKey(project.id);
      await loadAll();
      openDetail(getProject(project.id));
      toast("Public key yeniləndi.");
    } catch (err) { toast(errorMessage(err), "error"); }
  }
}

function projectIconHtml(project, fallback = "Q") {
  if (project?.icon_url) {
    return `<img src="${esc(project.icon_url)}" alt="" loading="lazy">`;
  }
  return `<span>${fallback}</span>`;
}

function setProjectIconPreview(url, name = "Q") {
  const img = $("#projectIconPreview");
  const fallback = $("#projectIconFallback");
  if (url) {
    img.src = url;
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
    fallback.textContent = (name || "Q").trim().charAt(0).toUpperCase() || "Q";
    fallback.classList.remove("hidden");
  }
}

function handleIconPick(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    toast("PNG, JPG və ya WebP şəkil seçin.", "error");
    event.target.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast("Şəkil maksimum 8 MB ola bilər.", "error");
    event.target.value = "";
    return;
  }
  state.pendingIconFile = file;
  state.pendingIconRemove = false;
  setProjectIconPreview(URL.createObjectURL(file), $("#projectName").value || "Q");
  $("#removeProjectIconBtn").classList.remove("hidden");
}

function handleIconRemove() {
  state.pendingIconFile = null;
  state.pendingIconRemove = true;
  $("#projectIconInput").value = "";
  setProjectIconPreview(null, $("#projectName").value || "Q");
  $("#removeProjectIconBtn").classList.add("hidden");
}

async function prepareIconBlob(file) {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true });
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close?.();

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("İkon optimizasiya edilə bilmədi.")), "image/webp", 0.84);
  });
}

function qConfirm({ title, message, confirmText = "Təsdiqlə", tone = "primary" }) {
  const dialog = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  const ok = $("#confirmOkBtn");
  ok.textContent = confirmText;
  ok.className = `btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`;
  $("#confirmIcon").textContent = tone === "danger" ? "!" : "Q";
  $("#confirmIcon").classList.toggle("danger", tone === "danger");

  return new Promise(resolve => {
    state.confirmResolver = resolve;
    dialog.showModal();
  });
}

function resolveConfirm(value) {
  $("#confirmDialog").close();
  const resolve = state.confirmResolver;
  state.confirmResolver = null;
  resolve?.(value);
}

function getProject(id) {
  return state.projects.find(p => p.id === id);
}

function openDrawer() {
  $("#sidebar").classList.add("open");
  $("#drawerBackdrop").classList.remove("hidden");
}
function closeDrawer() {
  $("#sidebar").classList.remove("open");
  $("#drawerBackdrop").classList.add("hidden");
}

function updateOnlineState() {
  const el = $("#connectionBadge");
  if (!el) return;
  const online = navigator.onLine;
  el.className = `status-pill ${online ? "online" : "offline"}`;
  el.textContent = online ? "● Onlayn" : "● Oflayn";
}

async function installPwa() {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  $("#installBtn").classList.add("hidden");
}

function registerPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
}

function setBusy(button, busy, text = "") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    if (text) button.textContent = text;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  }
}

function errorMessage(err) {
  const msg = err?.message || String(err || "Naməlum xəta");
  if (/invalid login credentials/i.test(msg)) return "Email və ya şifrə yanlışdır.";
  if (/not admin/i.test(msg)) return "Bu hesab admin səlahiyyətinə malik deyil.";
  if (/duplicate key/i.test(msg)) return "Bu slug və ya public key artıq mövcuddur.";
  return msg;
}
