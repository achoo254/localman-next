// Server-rendered pairing page for `tunelo login`. Shows the code the user
// copies into their terminal, then polls until the CLI claims it and flips
// the view to a success state. No framework/build — one inline HTML string.
export function renderLoginPage(code: string): string {
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
  h1 { font-size:1.15rem; margin:0 0 .25rem; }
  p { color:#9aa5c0; font-size:.9rem; line-height:1.5; margin:.4rem 0; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:2rem; letter-spacing:.35rem;
    font-weight:700; background:#0b1020; border:1px solid #2b3757; border-radius:10px; padding:.9rem 0; margin:1.1rem 0; user-select:all; }
  .hint { font-size:.82rem; color:#78849f; }
  .ok { display:none; }
  .ok .badge { width:56px; height:56px; border-radius:50%; background:#10331f; color:#4ade80; display:flex; align-items:center; justify-content:center; font-size:1.9rem; margin:0 auto 1rem; }
  .expired { display:none; color:#f4a4a4; }
  .spin { display:inline-block; width:14px; height:14px; border:2px solid #33406a; border-top-color:#7c93d8; border-radius:50%; animation:s 1s linear infinite; vertical-align:-2px; margin-right:6px; }
  @keyframes s { to { transform:rotate(360deg); } }
</style>
</head>
<body>
  <div class="card">
    <div id="pending">
      <h1>Authorize this device</h1>
      <p>Copy the code below and paste it into your terminal where <code>tunelo login</code> is waiting.</p>
      <div class="code" id="code">${code}</div>
      <p class="hint"><span class="spin"></span>Waiting for the terminal…</p>
    </div>
    <div class="ok" id="ok">
      <div class="badge">✓</div>
      <h1>Device authorized</h1>
      <p>Your terminal is now signed in. You can close this tab.</p>
    </div>
    <div class="expired" id="expired">
      <h1>Code expired</h1>
      <p>Run <code>tunelo login</code> again to get a new code.</p>
    </div>
  </div>
<script>
  var code = ${JSON.stringify(code)};
  function show(id){ ["pending","ok","expired"].forEach(function(x){ document.getElementById(x).style.display = (x===id)?"block":"none"; }); }
  function poll(){
    fetch("/api/device/status?code="+encodeURIComponent(code))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d.status==="claimed"){ show("ok"); return; }
        if(d.status==="expired"){ show("expired"); return; }
        setTimeout(poll, 2000);
      })
      .catch(function(){ setTimeout(poll, 3000); });
  }
  poll();
</script>
</body>
</html>`;
}
