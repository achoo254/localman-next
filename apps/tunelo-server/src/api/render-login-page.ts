// Server-rendered approve page for `tunelo login`. The CLI opens
// /login?req=<id>; this page shows the requesting device and an Approve
// button, then flips to success. No framework/build — one inline HTML string.
export function renderLoginPage(requestId: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tunelo — Authorize device</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background:#0b1020; color:#e5e9f0; display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .card { background:#151b2e; border:1px solid #263049; border-radius:14px; padding:2rem 2.25rem; width:min(92vw,420px); text-align:center; box-shadow:0 10px 40px rgba(0,0,0,.35); }
  h1 { font-size:1.15rem; margin:0 0 .5rem; }
  p { color:#9aa5c0; font-size:.9rem; line-height:1.5; margin:.4rem 0; }
  .device { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background:#0b1020; border:1px solid #2b3757; border-radius:10px; padding:.9rem 1rem; margin:1.1rem 0; }
  .device .name { font-size:1.05rem; font-weight:700; color:#e5e9f0; }
  .device .id { font-size:.78rem; color:#78849f; margin-top:.2rem; }
  button { width:100%; padding:.8rem; font-size:.95rem; font-weight:600; color:#fff; background:#4f6ef7; border:0; border-radius:10px; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  .ok, .err { display:none; }
  .badge { width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.9rem; margin:0 auto 1rem; }
  .ok .badge { background:#10331f; color:#4ade80; }
  .err .badge { background:#3a1720; color:#f87171; }
</style>
</head>
<body>
  <div class="card">
    <div id="pending">
      <h1>Authorize this device?</h1>
      <p>A device is asking to sign in to Tunelo.</p>
      <div class="device">
        <div class="name" id="dname">…</div>
        <div class="id" id="did"></div>
      </div>
      <button id="btn" disabled>Approve</button>
      <p id="msg"></p>
    </div>
    <div class="ok" id="ok">
      <div class="badge">✓</div>
      <h1>Device authorized</h1>
      <p>Your terminal is now signed in. You can close this tab.</p>
    </div>
    <div class="err" id="err">
      <div class="badge">!</div>
      <h1 id="etitle">Request not found</h1>
      <p>Run <code>tunelo login</code> again to get a new link.</p>
    </div>
  </div>
<script>
  var req = ${JSON.stringify(requestId)};
  function show(id){ ["pending","ok","err"].forEach(function(x){ document.getElementById(x).style.display=(x===id)?"block":"none"; }); }
  var btn = document.getElementById("btn");
  fetch("/api/device/request?req="+encodeURIComponent(req))
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(d){
      if(d.status==="approved"){ show("ok"); return; }
      document.getElementById("dname").textContent = d.deviceName || "Unknown device";
      document.getElementById("did").textContent = d.deviceId;
      btn.disabled = false;
    })
    .catch(function(){ show("err"); });
  btn.addEventListener("click", function(){
    btn.disabled = true;
    document.getElementById("msg").textContent = "Authorizing…";
    fetch("/api/device/approve", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({req:req}) })
      .then(function(r){ if(!r.ok) throw 0; show("ok"); })
      .catch(function(){ btn.disabled=false; document.getElementById("msg").textContent="Failed — try again."; });
  });
</script>
</body>
</html>`;
}
