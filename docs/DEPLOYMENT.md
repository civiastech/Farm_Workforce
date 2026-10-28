# Deployment

This guide puts the platform live on a single Linux server with HTTPS. It takes about 30 minutes.

## 1. What you need

- **A server.** Ubuntu 24.04 LTS, at least 2 vCPU, 4 GB RAM and 40 GB disk. Any provider works. A region close to your users (e.g. Lagos or Johannesburg, otherwise Europe) keeps the app fast.
- **A domain name** (e.g. `farmworkforce.ng`). Point its DNS **A** record (and **AAAA** for IPv6) at the server, plus `www`.
- **An SMTP email provider** for password resets and application updates.
- **An SMS provider account**: [Termii](https://termii.com) or [Africa's Talking](https://africastalking.com). Sign-up, password-reset codes and application updates go by SMS. Register a sender ID (e.g. `FarmWork`) early: approval by the networks can take several days. Any provider that offers SMTP credentials works.

## 2. Prepare the server

```bash
# Install Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Firewall: SSH and web only
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable
```

## 3. Get the code and configure it

```bash
sudo mkdir -p /srv && sudo chown $USER /srv && cd /srv
git clone https://github.com/civiastech/Farm_Workforce.git farm-workforce-platform
cd farm-workforce-platform
cp .env.production.example .env
nano .env        # set DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, MAIL_FROM, SMTP_URL and the SMS settings
chmod 600 .env
```

Generate a strong database password with `openssl rand -base64 32 | tr -d '/+='`.

## 4. Start it

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build --wait
```

Caddy requests the TLS certificate on first start, which takes a few seconds once DNS has propagated. Then open `https://YOUR-DOMAIN`.

Create your first moderator account. It prints a one-time password; change it after signing in.

```bash
docker compose -f compose.yaml -f compose.prod.yaml exec api \
  node dist/cli.js create-admin --email you@example.com --name "Your Name"
```

> Tip: `alias dc='docker compose -f compose.yaml -f compose.prod.yaml'` saves typing. The examples below use it.

## 5. Backups and monitoring

### Daily backups, copied off the server

`deploy/scripts/backup.sh` writes a compressed, integrity-checked `pg_dump` to `./backups` (keeping the newest 14), then copies it to cloud storage. A backup kept only on the server is lost if the server is.

**1. Create a storage bucket.** Any provider [rclone](https://rclone.org/overview/) supports works. Cheap choices are Backblaze B2, Cloudflare R2 and AWS S3. Create a private bucket (e.g. `fwp-backups`) and an access key that can only write to it.

**2. Tell rclone about it.** rclone runs from Docker, so nothing needs installing:

```bash
mkdir -p ~/.config/rclone
docker run --rm -it -v ~/.config/rclone:/config/rclone rclone/rclone:1.69 config
# n (new remote) → name: offsite → pick your provider → paste the key → accept the defaults
```

**3. Add the destination and a heartbeat to `.env`:**

```bash
BACKUP_REMOTE=offsite:fwp-backups        # <remote name>:<bucket>
BACKUP_REMOTE_DAYS=30                    # off-site copies older than this are deleted
BACKUP_HEARTBEAT_URL=https://hc-ping.com/your-check-id
```

For the heartbeat, create a free check at [healthchecks.io](https://healthchecks.io) with period **1 day** and grace **2 hours**, and copy its ping URL. The script pings it after every successful backup and pings `/fail` when a backup fails. If backups fail or stop running, healthchecks.io emails you.

**4. Run one now, then schedule it daily:**

```bash
./deploy/scripts/backup.sh                                     # should end with "copied off-site"
crontab -e                                                     # then add:
30 2 * * * cd /srv/farm-workforce-platform && ./deploy/scripts/backup.sh >> backups/backup.log 2>&1
```

**5. Test a restore** before launch, and then every few months. Restoring replaces the live database, so on a production server only do it to recover. To practise, use a spare server or your own machine:

```bash
# Fetch a copy back from off-site storage, then restore it
docker run --rm -v ~/.config/rclone:/config/rclone -v "$PWD/backups:/backups" \
  rclone/rclone:1.69 copy offsite:fwp-backups/fwp-YYYYMMDDTHHMMSSZ.sql.gz /backups
./deploy/scripts/restore.sh backups/fwp-YYYYMMDDTHHMMSSZ.sql.gz
```

### Uptime monitoring

Use a free external monitor such as [UptimeRobot](https://uptimerobot.com) or [Better Stack](https://betterstack.com/uptime):

| Monitor               | Settings                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Site and database** | HTTP(S) check on `https://YOUR-DOMAIN/api/ready` every 5 minutes. Alert if it isn't `200`. It returns `503` when the database is down. |
| **Certificate**       | SSL expiry alert 14 days before expiry. Caddy renews automatically, so an alert means renewal is failing.                              |
| **Backups**           | The healthchecks.io heartbeat above.                                                                                                   |

Send alerts to at least two people, by email plus SMS or a mobile app. A monitor that only alerts one inbox nobody watches isn't monitoring.

## 6. Updating to a new version

```bash
cd /srv/farm-workforce-platform
./deploy/scripts/backup.sh
git pull
dc up -d --build --wait
```

The `migrate` service applies any new database migrations before the new API starts. If a release is bad, check out the previous tag and run the same command. Migrations only move forward, so restore the backup if a migration needs undoing.

### Using prebuilt images instead of building on the server

Pushing a tag such as `v1.2.0` makes the **Release images** GitHub Action publish `ghcr.io/<owner>/<repo>-api` and `-web`. On the server, set these in `.env`:

```bash
IMAGE_PREFIX=ghcr.io/your-org/farm-workforce-platform   # must be lowercase
IMAGE_TAG=1.2.0
```

Then run `dc pull && dc up -d --wait`. Do not pass `--build`. If the packages are private, run `docker login ghcr.io` first.

## 7. Operating it

| Task                 | Command                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Service status       | `dc ps`                                                                                                            |
| Follow API logs      | `dc logs -f api`                                                                                                   |
| Readiness (incl. DB) | `curl https://YOUR-DOMAIN/api/ready`                                                                               |
| Database shell       | `dc exec db psql -U fwp -d fwp`                                                                                    |
| Recent audit events  | `dc exec db psql -U fwp -d fwp -c "select created_at, action, host(ip) from audit_logs order by id desc limit 50"` |
| Restart everything   | `dc restart`                                                                                                       |

**Notifications:** SMS and emails about applications go through an outbox table and are retried with back-off (30 s up to about 2 hours, six attempts). To see failures: `dc exec db psql -U fwp -d fwp -c "select created_at, channel, attempts, last_error from notifications where status <> 'sent' order by created_at desc limit 20"`. The API also deletes expired sessions and codes every hour.

**Logs:** API logs are structured JSON (one line per request, with a request ID), ready for any log shipper.

## Configuration reference (API)

| Variable                     | Default           | Notes                                                                                                                   |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | required          | `postgres://user:pass@host:5432/db`                                                                                     |
| `APP_ORIGIN`                 | required          | Public URL of the site. Used for CSRF checks and links in emails                                                        |
| `TRUST_PROXY`                | `1`               | Number of reverse proxies in front of the API (production: `2`)                                                         |
| `COOKIE_SECURE`              | from `APP_ORIGIN` | `true` when the origin is https                                                                                         |
| `SESSION_TTL_DAYS`           | `14`              | Sliding session lifetime                                                                                                |
| `RATE_LIMIT_PER_MINUTE`      | `300`             | Per client IP, all endpoints                                                                                            |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `10`              | Sign-in, registration, password endpoints                                                                               |
| `MAIL_TRANSPORT`             | `log`             | `smtp` in production                                                                                                    |
| `SMTP_URL`, `MAIL_FROM`      | —                 | Required when `MAIL_TRANSPORT=smtp`                                                                                     |
| `SMS_TRANSPORT`              | `log`             | `termii` or `africastalking` in production. `log` is refused on an https site, because it shows sign-up codes on screen |
| `SMS_SENDER_ID`              | —                 | Registered sender ID, up to 11 characters. Required for Termii                                                          |
| `TERMII_API_KEY`             | —                 | Required when `SMS_TRANSPORT=termii`                                                                                    |
| `TERMII_CHANNEL`             | `dnd`             | `dnd` reaches numbers on Do-Not-Disturb, which codes need                                                               |
| `AT_USERNAME`, `AT_API_KEY`  | —                 | Required when `SMS_TRANSPORT=africastalking` (`sandbox` for testing)                                                    |
| `LOG_LEVEL`                  | `info`            | `debug` for troubleshooting                                                                                             |

The API refuses to start if the configuration is invalid, and prints exactly which variable is wrong.
