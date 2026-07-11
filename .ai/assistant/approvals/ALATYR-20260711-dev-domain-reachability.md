# Approval Record

Approval ID: `ALATYR-20260711-dev-domain-reachability`
Operation ID: `EGMT-20260711-dev-domain-reachability`
Operation type: `security-sensitive code-local deployment-dev`
Plan version: `v1`
Plan hash: `not available; approval was given as a direct chat request`
Requested by: `project maintainer`
Approved by: `project maintainer`
Approved at: `2026-07-11T16:19:56+02:00`
Approval source/message: `User: "in this case, lets first make the project reachable. atvardovsky.dev is an domain, you can check an ip, port 80 is bussy, so you need to find other port"`
Expires at or reuse policy: `single implementation pass only`
Scope invalidation rule: `Approval is invalid if the change modifies Apache, Nginx, PM2, system service configuration, firewall rules, production TLS certificates, auth/session security settings, or exposes secrets.`

## Approved Scope

Allowed protected changes:

- Make the existing dev web app reachable through `atvardovsky.dev` on a non-80 port.
- Inspect DNS, local listeners, and project dev-server configuration.
- Restart only the EGMathTeacher local dev stack.

Allowed files or surfaces:

- `apps/web/vite.config.ts`
- `README.md`
- `.ai/project/blueprint.md`
- `.ai/project/contour.md`
- `.ai/assistant/approvals`
- `.ai/assistant/infrastructure-index.md`

Excluded actions:

- No Apache, Nginx, PM2, firewall, system service, or certificate changes.
- No production dependency changes.
- No auth, cookie, authorization, or API behavior changes.
- No live OpenAI or other spend-affecting external calls.
- No database destructive action.

Allowed actions mode:
`code-and-tests`

## Plan Evidence

Approved plan summary:

```text
Find the current domain IP and occupied ports, keep port 80 untouched, expose
the existing Vite dev server on an available high port by updating the Vite
host allowlist, restart only the project dev stack, and smoke-check the domain
URL plus the proxied API health endpoint.
```

Approved validation or manual review:

- `npm run build --workspace @egmathteacher/web`
- local DNS/IP/listener checks
- local HTTPS smoke check for `https://atvardovsky.dev:5137/`
- proxied health smoke check for `https://atvardovsky.dev:5137/health`

## Use Result

Used by operation/change: `EGMT-20260711-dev-domain-reachability`
Patch changed after approval: `yes; only within approved Vite dev-server config and source-of-truth docs`
Implementation stayed within approved scope: `yes`
Validation run: `npm run build --workspace @egmathteacher/web`; `dig +short atvardovsky.dev A`; `ss -tulpen`; local HTTPS smoke checks
Result/evidence: `domain resolves to 193.34.144.203; host eth0 has 193.34.144.203; port 80 remains occupied and untouched; Vite listens on 0.0.0.0:5137; API listens on 0.0.0.0:3000; https://atvardovsky.dev:5137/ returned HTTP 200; https://atvardovsky.dev:5137/health returned ok`
Residual risk: `current Vite HTTPS certificate is a localhost self-signed certificate with SAN localhost/127.0.0.1 only, so browsers can warn for atvardovsky.dev:5137; no external browser or off-host network probe was run; dev stack is not a production deployment`
