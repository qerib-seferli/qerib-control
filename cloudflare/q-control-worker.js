const Q_CONTROL = {
  supabaseUrl: "https://dwunpvkhydaonnmhinkt.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dW5wdmtoeWRhb25ubWhpbmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MjYwOTAsImV4cCI6MjEwMjMwMjA5MH0.L33pytDZSTBJ5uA7S21W8-Nrxy3d66fQNQLhfIXGL2w",
  timeoutMs: 3000
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = normalizeHost(url.hostname);

    // Worker API/static yox, yalnız route qoşulan real domenlərdə işləyir.
    const status = await getStatus(host);

    // Q-Control əlçatmazdırsa və ya domain idarə olunmursa sayt açıq qalır.
    if (!status || status.managed === false || status.active !== false) {
      return fetch(request);
    }

    // API, asset və digər request-lərdə boş JSON/503 qaytarmaq əvəzinə
    // yalnız sənəd navigasiyasını premium maintenance səhifəsinə çeviririk.
    const accept = request.headers.get("accept") || "";
    const isDocument = request.method === "GET" && accept.includes("text/html");

    if (!isDocument) {
      return new Response("Service temporarily unavailable", {
        status: 503,
        headers: {
          "content-type": "text/plain; charset=UTF-8",
          "cache-control": "no-store"
        }
      });
    }

    return maintenanceResponse(status);
  }
};

async function getStatus(domain) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Q_CONTROL.timeoutMs);

  try {
    const response = await fetch(
      `${Q_CONTROL.supabaseUrl}/rest/v1/rpc/check_control_service_by_domain`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "apikey": Q_CONTROL.anonKey,
          "authorization": `Bearer ${Q_CONTROL.anonKey}`
        },
        body: JSON.stringify({ p_domain: domain })
      }
    );

    if (!response.ok) throw new Error(`Q-Control ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("[Q-Control Gateway]", error);
    return null; // fail-open
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHost(host = "") {
  return String(host).toLowerCase().replace(/^www\./, "");
}

function maintenanceResponse(data) {
  const project = escapeHtml(data.project_name || "Xidmət");
  const title = escapeHtml(data.maintenance_title || "Xidmət müvəqqəti dayandırılıb");
  const message = escapeHtml(
    data.maintenance_message ||
    "Sistem infrastrukturu üzrə xidmət hazırda əlçatan deyil. Xidmət bərpa edildikdən sonra platforma avtomatik olaraq yenidən aktiv olacaq."
  );

  const html = `<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#07100d">
<title>${project} — Xidmət statusu</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:#07100d;color:#f7fbf9;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{min-height:100vh;display:grid;place-items:center;padding:24px;background:
radial-gradient(circle at 50% -10%,rgba(47,211,155,.14),transparent 34%),
radial-gradient(circle at 100% 100%,rgba(90,110,255,.08),transparent 30%),#07100d}
main{width:min(640px,100%);text-align:center}
.status{width:78px;height:78px;border-radius:25px;margin:0 auto 25px;display:grid;place-items:center;
background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 80px rgba(0,0,0,.35)}
.status:after{content:"";width:18px;height:18px;border-radius:50%;background:#fbbf24;box-shadow:0 0 0 9px rgba(251,191,36,.08),0 0 32px rgba(251,191,36,.24)}
.eyebrow{font-size:10px;font-weight:850;letter-spacing:.18em;text-transform:uppercase;color:#83918b}
h1{font-size:clamp(30px,7vw,52px);line-height:1.06;letter-spacing:-.045em;margin:14px 0 18px}
p{max-width:540px;margin:0 auto;color:#97a59f;font-size:14px;line-height:1.75}
.rule{width:54px;height:3px;background:#2fd39b;border-radius:99px;margin:30px auto}
.brand{font-size:14px;font-weight:850}.foot{font-size:10px;color:#65736d;margin-top:9px}
@media(max-width:520px){body{padding:18px}.status{width:66px;height:66px;border-radius:21px}p{font-size:13px}}
</style>
</head>
<body>
<main>
<div class="status" aria-hidden="true"></div>
<div class="eyebrow">Service status</div>
<h1>${title}</h1>
<p>${message}</p>
<div class="rule"></div>
<div class="brand">${project}</div>
<div class="foot">Xidmət bərpa olunduqda platforma avtomatik olaraq yenidən əlçatan olacaq.</div>
</main>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-robots-tag": "noindex, nofollow"
    }
  });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);
}
