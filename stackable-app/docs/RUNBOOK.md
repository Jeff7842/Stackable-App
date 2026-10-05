# Runbook

Audience: operators.
Skeleton only. Each section is a TODO until the service exists.
Written steps will be numbered, with no prose between them.

## Health endpoints

Planned behaviour (not built yet):
- `GET /health`: the process is alive.
- `GET /ready`: database, queue and each required vendor answer within a short timeout. Also returns build version and uptime.
- A vendor outage reports "degraded", not "down".
- The gateway aggregates all services for the `/dev` health grid.

TODO: add the URL per service and the alert thresholds.
TODO: add steps to diagnose a failing `/ready`.

## Roll back a deployment

TODO: trigger condition.
TODO: impact.
TODO: numbered steps (Coolify rollback; plan says a failed health check after deploy triggers it).
TODO: escalation.
TODO: post-incident action.

## Backup and restore

TODO: backup schedule and location (Neon today, VPS Postgres later).
TODO: numbered restore steps.
TODO: restore drill record (planned for D13).

## Other required runbooks

TODO:
- Deploy a new version.
- Apply a database migration to production.
- Respond to a P0 incident.
- Rotate a compromised secret (includes `SCHOOL_SECURITY_CODES_SECRET`, which changes every derived school code. See H21).
