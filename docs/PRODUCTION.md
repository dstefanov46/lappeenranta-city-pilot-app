# Production deployment

The supported production layout runs two private `systemd` services from `/opt/lappeenranta`:

- `lappeenranta-backend.service` on `127.0.0.1:4000`
- `lappeenranta-frontend.service` on `127.0.0.1:3000`

The existing HTTPS reverse proxy remains the public entry point. It should expose `api-lappeenranta.sunesis.si` and forward to `http://127.0.0.1:3000`; port 4000 must not be exposed publicly.

## First deployment

Install Node.js 22 or newer system-wide on an Ubuntu/Debian VM, then clone the repository and run the installer as root:

```bash
sudo git clone <repository-url> /opt/lappeenranta
cd /opt/lappeenranta
sudo bash scripts/install-production.sh
```

The one-command installer creates the `lappeenranta` service account and `/var/lib/lappeenranta`, installs dependencies, runs typecheck/tests, builds both applications, installs the unit files, enables them at boot, and starts them. It waits for both local smoke tests to succeed before finishing.

## Configuration and data

Runtime configuration lives outside Git at `/etc/lappeenranta/lappeenranta.env`:

```env
LAPPEENRANTA_REPORT_API_URL=http://127.0.0.1:4000/api/reports
LAPPEENRANTA_DATA_DIR=/var/lib/lappeenranta
```

The installer creates that file only when it does not exist, so rerunning it preserves production-specific values. It is owned by the service account and mode `0600`. Reports and uploaded photos are persisted under `/var/lib/lappeenranta`.

## Operations

```bash
sudo systemctl status lappeenranta-backend
sudo systemctl status lappeenranta-frontend
sudo journalctl -u lappeenranta-backend -f
sudo journalctl -u lappeenranta-frontend -f
curl http://127.0.0.1:4000/health
curl -I https://api-lappeenranta.sunesis.si
```

The frontend is ordered after the backend and both services restart automatically after failures. They are independent of the SSH session and start again after a VM reboot.

## Redeployment and rollback

Pull the desired revision and rerun the same installer:

```bash
cd /opt/lappeenranta
sudo git pull --ff-only
sudo bash scripts/install-production.sh
```

This rebuilds and restarts both services without replacing the environment file or data directory. To roll back, check out the known-good revision (or restore the previous deployment), then rerun the installer. Before and after a deployment, submit one report with no photo and one with a photo and confirm their JSON/photo files appear under `/var/lib/lappeenranta`.

If the public site fails, first check the local health endpoint and service journals. Verify externally that ports 3000 and 4000 are inaccessible from the public internet; only the HTTPS reverse proxy should be reachable.
