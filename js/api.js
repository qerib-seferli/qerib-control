import { supabase } from "./supabase.js";

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getMe() {
  const { data, error } = await supabase.rpc("get_control_me");
  if (error) throw error;
  return data;
}

export async function updateProfileName(displayName) {
  const { data, error } = await supabase.rpc("update_control_profile", { p_display_name: displayName });
  if (error) throw error;
  return data;
}

export async function listProjects() {
  const { data, error } = await supabase.from("control_projects")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveProject(payload) {
  const fn = payload.id ? "update_control_project_v3" : "create_control_project_v3";
  const common = {
    p_name: payload.name,
    p_slug: payload.slug,
    p_domain: payload.domain || null,
    p_monthly_price: payload.monthly_price,
    p_status: payload.status,
    p_paid_until: payload.paid_until,
    p_auto_suspend: payload.auto_suspend,
    p_maintenance_title: payload.maintenance_title,
    p_maintenance_message: payload.maintenance_message,
    p_notes: payload.notes || null,
    p_control_mode: payload.control_mode,
    p_currency: payload.currency,
    p_sale_price: payload.sale_price
  };
  const args = payload.id ? { p_id: payload.id, ...common } : common;
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export async function setProjectStatus(projectId, status, note = null) {
  const { data, error } = await supabase.rpc("set_control_project_status", {
    p_project_id: projectId,
    p_status: status,
    p_note: note
  });
  if (error) throw error;
  return data;
}

export async function recordPaymentAndExtend({ projectId, months, amount, paidAt, note, paymentKind }) {
  const { data, error } = await supabase.rpc("record_control_payment_v3", {
    p_project_id: projectId,
    p_months: Number(months || 1),
    p_amount: Number(amount),
    p_paid_at: paidAt,
    p_note: note || null,
    p_payment_kind: paymentKind || "service"
  });
  if (error) throw error;
  return data;
}

export async function archiveProject(projectId) {
  const { data, error } = await supabase.rpc("archive_control_project", { p_project_id: projectId });
  if (error) throw error;
  return data;
}

export async function regeneratePublicKey(projectId) {
  const { data, error } = await supabase.rpc("regenerate_control_public_key", { p_project_id: projectId });
  if (error) throw error;
  return data;
}

export async function listPayments() {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabase.from("control_payments")
      .select("*, control_projects(id,name,domain,icon_url,currency)")
      .order("paid_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const rows = data || [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;

    // Səhv konfiqurasiya halında sonsuz sorğunu blokla.
    if (from >= 50000) break;
  }

  return all;
}

export async function listLogs(limit = 300) {
  const { data, error } = await supabase.from("control_activity_logs")
    .select("*, control_projects(id,name,domain,icon_url,currency)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function refreshStatuses() {
  const { data, error } = await supabase.rpc("refresh_control_project_statuses");
  if (error) throw error;
  return data;
}


export async function uploadProjectIcon(projectId, blob) {
  const path = `${projectId}/icon.webp`;

  // Eyni path istifadə olunur: köhnə obyekt əvvəl Storage API ilə silinir.
  await supabase.storage.from("project-icons").remove([path]);

  const { error: uploadError } = await supabase.storage
    .from("project-icons")
    .upload(path, blob, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: true
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("project-icons").getPublicUrl(path);
  const iconUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("control_projects")
    .update({ icon_url: iconUrl })
    .eq("id", projectId);
  if (updateError) throw updateError;

  return iconUrl;
}

export async function deleteProjectIcon(projectId) {
  const path = `${projectId}/icon.webp`;
  const { error: removeError } = await supabase.storage.from("project-icons").remove([path]);
  if (removeError) throw removeError;

  const { error: updateError } = await supabase
    .from("control_projects")
    .update({ icon_url: null })
    .eq("id", projectId);
  if (updateError) throw updateError;
}

export async function checkDomainService(domain) {
  const { data, error } = await supabase.rpc("check_control_service_by_domain", {
    p_domain: domain
  });
  if (error) throw error;
  return data;
}
