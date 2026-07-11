# Approval Gates

Explicit programmer approval is required before any of these changes:

- runtime architecture changes
- accepted product/business behavior changes
- auth, authorization, cookie, role, or permission changes
- weakened tests, validation, gates, documentation-sync rules, or approval
  requirements
- new production dependencies, services, credentials, or broader permissions
- live external calls that can spend money or mutate remote state
- destructive or data-loss operations
- system web server, PM2, certificate, or production deployment changes
- importing third-party assistant infrastructure into canonical repository
  files
- broadening AI tool, MCP, connector, package/plugin, model, or automation
  permissions
- overwriting existing assistant instruction files

Approval must be explicit in the user message. Planning and docs-only review
can continue when it does not make the protected change.

If a requested task crosses this gate, stop before editing protected surfaces
and state the exact approval needed.

Use `.ai/assistant/approvals/approval-template.md` when approval scope must be
durable across files, plan versions, imported infrastructure, or follow-up
validation.
