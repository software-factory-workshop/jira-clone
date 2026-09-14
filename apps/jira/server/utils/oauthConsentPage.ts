/**
 * Minimal browser consent screen for the demo OAuth provider.
 *
 * `GET /api/oauth/authorize` is a machine-shaped JSON route, but the user
 * arrives there in a browser (Vercel Connect redirects them). When the
 * request prefers HTML, the route renders this page instead: it shows who
 * is signing in, which client asked, which scopes, and offers Approve /
 * Deny. The decision is the same JSON POST to `/api/oauth/consent`; on
 * approval the page forwards the browser to the client's redirect URI with
 * the code and state, on denial with `error=access_denied`. Pure; no
 * secrets beyond the short-lived grant ticket the ticket route already
 * returned as JSON.
 */
export type ConsentPageInput = {
  grantTicket: string;
  clientId: string;
  clientName?: string | null;
  redirectUri: string;
  scopes: readonly string[];
  state: string | null;
  account: { label: string; role: string };
  consentPath: string;
  expiresInSeconds: number;
};

export function prefersHtml(accept: string | undefined): boolean {
  if (!accept) return false;
  const html = accept.indexOf("text/html");
  if (html < 0) return false;
  const json = accept.indexOf("application/json");
  return json < 0 || html < json;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderConsentPage(input: ConsentPageInput): string {
  const target = new URL(input.redirectUri);
  const payload = JSON.stringify({
    grantTicket: input.grantTicket,
    consentPath: input.consentPath,
    redirectUri: input.redirectUri,
    state: input.state,
  }).replaceAll("<", "\\u003c");
  const client = input.clientName ? `${escapeHtml(input.clientName)} <code>${escapeHtml(input.clientId)}</code>` : `<code>${escapeHtml(input.clientId)}</code>`;
  const scopes = input.scopes.map((scope) => `<li><code>${escapeHtml(scope)}</code></li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize ${escapeHtml(input.clientName ?? input.clientId)} · ADEO Jira demo</title>
<style>
body{font-family:system-ui,sans-serif;background:#f6f7f9;color:#1c1c1e;margin:0;display:grid;place-items:center;min-height:100vh}
main{background:#fff;border:1px solid #e1e4e8;border-radius:12px;padding:32px;max-width:440px;width:calc(100% - 32px);box-shadow:0 8px 24px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 8px}p{margin:8px 0;line-height:1.45}code{background:#f1f3f5;padding:1px 5px;border-radius:4px;font-size:.92em;word-break:break-all}
ul{margin:4px 0 0 18px;padding:0}.actions{display:flex;gap:12px;margin-top:24px}
button{flex:1;padding:10px 14px;border-radius:8px;border:1px solid #cfd4da;background:#fff;font:inherit;cursor:pointer}
button.primary{background:#0f7b6c;border-color:#0f7b6c;color:#fff}button[disabled]{opacity:.6;cursor:wait}
.muted{color:#5b616b;font-size:13px}.error{color:#b42318}
</style></head><body><main>
<h1>Authorize access to the ADEO Jira demo</h1>
<p><strong>${client}</strong> wants to act as <strong>${escapeHtml(input.account.label)}</strong> (role <code>${escapeHtml(input.account.role)}</code>) with scopes:</p>
<ul>${scopes}</ul>
<p class="muted">You will be sent back to <code>${escapeHtml(target.origin)}</code>. This request expires in ${Math.max(1, Math.round(input.expiresInSeconds / 60))} minutes. Demo-only OAuth provider; nothing here is production auth.</p>
<div class="actions"><button type="button" id="deny">Deny</button><button type="button" class="primary" id="approve">Approve</button></div>
<p id="status" class="muted" role="status"></p>
<script id="consent-data" type="application/json">${payload}</script>
<script>
(function(){
  var data = JSON.parse(document.getElementById('consent-data').textContent);
  var status = document.getElementById('status');
  function done(params){ var u = new URL(data.redirectUri); Object.keys(params).forEach(function(k){ if(params[k]!=null) u.searchParams.set(k, params[k]); }); location.assign(u.toString()); }
  function decide(approved){
    document.querySelectorAll('button').forEach(function(b){ b.disabled = true; });
    status.textContent = approved ? 'Approving…' : 'Denying…';
    fetch(data.consentPath, {method:'POST', headers:{'content-type':'application/json'}, credentials:'same-origin', body: JSON.stringify({grant_ticket: data.grantTicket, approved: approved})})
      .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, body: j}; }); })
      .then(function(res){
        if (approved && res.ok && res.body.code) return done({code: res.body.code, state: res.body.state});
        if (!approved) return done({error: 'access_denied', state: data.state});
        status.className = 'error'; status.textContent = (res.body && (res.body.message || res.body.statusMessage)) || 'Consent failed.';
      })
      .catch(function(){ status.className = 'error'; status.textContent = 'Consent request failed.'; });
  }
  document.getElementById('approve').addEventListener('click', function(){ decide(true); });
  document.getElementById('deny').addEventListener('click', function(){ decide(false); });
})();
</script>
</main></body></html>`;
}
