/*
  Q-Control client guard
  Bu faylı müştəri saytında məsələn:
  /assets/js/q-control-guard.js
  kimi saxla.

  index.html <head> hissəsində, digər app scriptlərindən ƏVVƏL:
  <script>
  window.Q_CONTROL = {
    projectKey: "PANELDƏN_PUBLIC_KEY",
    domain: "meyveci.az"
  };
  </script>
  <script type="module" src="/assets/js/q-control-guard.js"></script>

  Qeyd:
  - Q-Control admin service_role key burada YOXDUR.
  - yalnız anon key + public status RPC istifadə olunur.
  - API əlçatmazdırsa fail-open tətbiq edilir: sayt təsadüfən bağlanmır.
*/

const Q = {
  url: "https://dwunpvkhydaonnmhinkt.supabase.co",
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dW5wdmtoeWRhb25ubWhpbmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MjYwOTAsImV4cCI6MjEwMjMwMjA5MH0.L33pytDZSTBJ5uA7S21W8-Nrxy3d66fQNQLhfIXGL2w",
  projectKey: window.Q_CONTROL?.projectKey || "",
  domain: window.Q_CONTROL?.domain || location.hostname,
  timeoutMs: 5000,
  cacheMs: 10000
};

const gateStyle = document.createElement("style");
gateStyle.id = "q-control-gate";
gateStyle.textContent = "html{visibility:hidden!important}";
document.documentElement.appendChild(gateStyle);

function reveal() {
  document.getElementById("q-control-gate")?.remove();
  document.documentElement.style.visibility = "";
}

function normalizeHost(v = "") {
  return String(v).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

function maintenancePage(data) {
  const title = data?.maintenance_title || "Xidmət müvəqqəti dayandırılıb";
  const message = data?.maintenance_message || "Sistem infrastrukturu üzrə xidmət hazırda əlçatan deyil. Xidmət bərpa edildikdən sonra platforma avtomatik olaraq yenidən aktiv olacaq.";
  const name = data?.project_name || document.title || "Xidmət";

  document.head.innerHTML = `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#0b0f14">
    <title>${escapeHtml(name)} — Müvəqqəti dayandırılıb</title>
    <style>
      *{box-sizing:border-box}
      html,body{margin:0;min-height:100%;background:#080b10;color:#f4f7f8;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      body{min-height:100vh;display:grid;place-items:center;padding:22px;background:
        radial-gradient(circle at 50% -10%,rgba(53,211,153,.10),transparent 34%),
        radial-gradient(circle at 100% 100%,rgba(73,112,255,.08),transparent 32%),#080b10}
      .wrap{width:min(620px,100%);text-align:center}
      .status{width:74px;height:74px;margin:0 auto 24px;border-radius:24px;display:grid;place-items:center;
        border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);box-shadow:0 18px 60px rgba(0,0,0,.35)}
      .status:before{content:"";width:18px;height:18px;border-radius:50%;background:#fbbf24;box-shadow:0 0 0 8px rgba(251,191,36,.08),0 0 28px rgba(251,191,36,.25)}
      .eyebrow{font-size:11px;letter-spacing:.17em;text-transform:uppercase;color:#93a0ae;font-weight:800}
      h1{font-size:clamp(28px,6vw,48px);line-height:1.05;margin:14px 0 16px;letter-spacing:-.035em}
      p{max-width:530px;margin:0 auto;color:#99a4b1;line-height:1.75;font-size:14px}
      .line{width:56px;height:3px;border-radius:99px;background:#2fd39b;margin:28px auto}
      .name{font-weight:850;font-size:14px}
      .foot{margin-top:9px;color:#687481;font-size:11px}
      @media(max-width:520px){body{padding:18px}.status{width:66px;height:66px;border-radius:21px}p{font-size:13px}}
    </style>`;

  document.body.innerHTML = `
    <main class="wrap">
      <div class="status" aria-hidden="true"></div>
      <div class="eyebrow">Service Status</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <div class="line"></div>
      <div class="name">${escapeHtml(name)}</div>
      <div class="foot">Xidmət bərpa olunduqda sistem avtomatik olaraq yenidən əlçatan olacaq.</div>
    </main>`;
  reveal();
}

function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

function cacheKey() {
  return `q-control:${Q.projectKey}`;
}

function getCached() {
  try {
    const item = JSON.parse(sessionStorage.getItem(cacheKey()) || "null");
    if (!item || Date.now() - item.ts > Q.cacheMs) return null;
    return item.data;
  } catch { return null; }
}

function setCached(data) {
  try { sessionStorage.setItem(cacheKey(), JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function checkStatus() {
  if (!Q.projectKey) {
    console.warn("[Q-Control] projectKey təyin edilməyib; fail-open.");
    reveal();
    return;
  }

  const cached = getCached();
  if (cached) {
    if (cached.active) reveal(); else maintenancePage(cached);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Q.timeoutMs);

  try {
    const res = await fetch(`${Q.url}/rest/v1/rpc/check_control_service`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "apikey": Q.anon,
        "Authorization": `Bearer ${Q.anon}`
      },
      body: JSON.stringify({
        p_public_key: Q.projectKey,
        p_domain: normalizeHost(Q.domain || location.hostname)
      })
    });

    if (!res.ok) throw new Error(`Q-Control HTTP ${res.status}`);
    const data = await res.json();
    setCached(data);

    if (data?.active === false) maintenancePage(data);
    else reveal();
  } catch (err) {
    console.warn("[Q-Control] status yoxlanmadı, fail-open:", err);
    reveal();
  } finally {
    clearTimeout(timer);
  }
}

checkStatus();
