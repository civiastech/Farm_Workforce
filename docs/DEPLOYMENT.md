# Deployment

This guide puts the platform live on a single Linux server with HTTPS. It takes about 30 minutes.

## 1. What you need

- **A server.** Ubuntu 24.04 LTS, at least 2 vCPU, 4 GB RAM and 40 GB disk. Any provider works. A region close to your users (e.g. Lagos or Johannesburg, otherwise Europe) keeps the app fast.
- **A domain name** (e.g. `farmworkforce.ng`). Point its DNS **A** record (and **AAAA** for IPv6) at the server, plus `www`.
- **An SMTP email provider** for password resets and application updates. Any provider that offers SMTP credentials works.

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
git clone https://github.com/YOUR-ORG/farm-workforce-platform.git
cd farm-workforce-platform
cp .env.production.example .env
nano .env        # set DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, MAIL_FROM, SMTP_URL
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

## 5. Backups

Backups are compressed `pg_dump` files written to `./backups`.

```bash
./deploy/scripts/backup.sh                                     # make one now
crontab -e                                                     # then add a daily run:
30 2 * * * cd /srv/farm-workforce-platform && ./deploy/scripts/backup.sh >> backups/backup.log 2>&1
```

**Copy backups off the server**, for example with `rclone` to object storage. A backup kept on the same disk doesn't protect you if that disk fails. Test a restore regularly:

```bash
./deploy/scripts/restore.sh backups/fwp-YYYYMMDDTHHMMSSZ.sql.gz
```

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

**Monitoring:** point an uptime checker at `https://YOUR-DOMAIN/api/ready`. It returns `503` if the database is unreachable. API logs are structured JSON (one line per request, with a request ID), ready for any log shipper.

## Configuration reference (API)

| Variable                     | Default           | Notes                                                            |
| ---------------------------- | ----------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`               | required          | `postgres://user:pass@host:5432/db`                              |
| `APP_ORIGIN`                 | required          | Public URL of the site. Used for CSRF checks and links in emails |
| `TRUST_PROXY`                | `1`               | Number of reverse proxies in front of the API (production: `2`)  |
| `COOKIE_SECURE`              | from `APP_ORIGIN` | `true` when the origin is https                                  |
| `SESSION_TTL_DAYS`           | `14`              | Sliding session lifetime                                         |
| `RATE_LIMIT_PER_MINUTE`      | `300`             | Per client IP, all endpoints                                     |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `10`              | Sign-in, registration, password endpoints                        |
| `MAIL_TRANSPORT`             | `log`             | `smtp` in production                                             |
| `SMTP_URL`, `MAIL_FROM`      | —                 | Required when `MAIL_TRANSPORT=smtp`                              |
| `LOG_LEVEL`                  | `info`            | `debug` for troubleshooting                                      |

The API refuses to start if the configuration is invalid, and prints exactly which variable is wrong.
