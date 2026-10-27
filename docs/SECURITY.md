# Security

## Controls in place

| Area                | Control                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords           | scrypt (N=2¹⁵, r=8), per-user salt, constant-time compare. Login timing is the same for unknown emails. Hashes are upgraded on login when parameters change.                                                                     |
| Sessions            | 256-bit random tokens. Only the SHA-256 hash is stored. Cookie is `HttpOnly`, `SameSite=Lax`, `Secure` and `__Host-` prefixed over HTTPS. Revoked on logout, password reset (all sessions) and password change (other sessions). |
| CSRF                | State-changing requests must carry an `Origin` header matching `APP_ORIGIN`, on top of `SameSite` cookies.                                                                                                                       |
| Authorisation       | Every handler checks role and ownership on the server. Other users' resources return 404, not 403, so their existence isn't revealed. The UI's route guards are only for convenience.                                            |
| Input validation    | Shared Zod schemas on every body, query and path parameter. 64 KB body limit. Search text is escaped before use in `LIKE`.                                                                                                       |
| Rate limiting       | Per client IP: 300/min overall, 10/min on authentication endpoints, 5/min on reports. Client IP comes from a fixed proxy hop count, so it can't be spoofed.                                                                      |
| Account enumeration | Password reset always returns `202`. Login errors don't distinguish an unknown email from a wrong password.                                                                                                                      |
| Privacy             | Applicant phone and email are shown only after the employer shortlists them. Users can export their data (JSON) and delete their account.                                                                                        |
| Headers             | Strict CSP (`'self'` only, no inline scripts), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP. HSTS via Caddy. API responses are `no-store`.                                                  |
| Audit log           | Records sign-ins (including failures), password events, profile changes, applications, reports, moderation actions, data exports and deletions, with actor and IP.                                                               |
| Logging             | Cookies and authorization headers are redacted from request logs.                                                                                                                                                                |
| Containers          | Both images run as non-root users. Production dependencies only. The database is on an internal network with no published port. Caddy is the only public listener.                                                               |
| Supply chain        | Lockfile with `npm ci`. CI runs `npm audit` on production dependencies. Dependabot is enabled for npm, Docker and Actions.                                                                                                       |

Known accepted issue: `npm audit` reports a moderate advisory in a development-only dependency of `drizzle-kit` (the `esbuild` dev server). It isn't present in production images and isn't exposed.

## Pre-launch checklist

Code can't settle these. Each one needs a person to own it.

**Legal & policy**

- [ ] Have a Nigerian lawyer review the [privacy notice](../apps/web/src/pages/info.tsx) and terms against the **Nigeria Data Protection Act 2023**. Assess whether you need to register with the NDPC or appoint a DPO.
- [ ] Decide data-retention periods for audit logs and inactive accounts, and add a scheduled cleanup job.
- [ ] Publish a contact address for privacy requests and abuse reports.

**Operations**

- [ ] Real SMTP provider configured, with SPF, DKIM and DMARC records for the sending domain. Test a password reset end to end.
- [ ] Off-server backups running, and **one restore actually tested**.
- [ ] Uptime monitoring on `/api/ready` with alerts to a person.
- [ ] At least two people have moderator accounts. Define a target response time for reports.
- [ ] A written employer-verification procedure (e.g. CAC registration check plus a phone call) before anyone clicks "Verify".

**Security**

- [ ] `.env` on the server is `chmod 600` and not in git. Strong `POSTGRES_PASSWORD`.
- [ ] SSH key-only login, firewall allowing only 22, 80 and 443. Automatic OS security updates enabled.
- [ ] An independent penetration test or security review before handling significant volumes of personal data.

**Not collected by design:** NIN, BVN, bank details and payments. If identity verification is added later, use an approved verification provider's API and store only the verification result, never the raw identifier.
