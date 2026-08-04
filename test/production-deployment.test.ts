import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (filename: string) => readFileSync(path.join(root, filename), "utf8");

describe("production deployment", () => {
  const installer = read("scripts/install-production.sh");
  const backend = read("deploy/systemd/lappeenranta-backend.service");
  const frontend = read("deploy/systemd/lappeenranta-frontend.service");

  it("guards the installer against unsupported hosts and runtimes", () => {
    expect(installer).toContain('[[ "${EUID}" -eq 0 ]]');
    expect(installer).toContain('ID:-}" == "ubuntu"');
    expect(installer).toContain('ID:-}" == "debian"');
    expect(installer).toContain('"$node_major" -ge 22');
    expect(installer).toContain('command -v "$command_name"');
  });

  it("preserves production configuration and data", () => {
    expect(installer).toContain('if [[ ! -e "$ENV_FILE" ]]');
    expect(installer).toContain("LAPPEENRANTA_DATA_DIR=/var/lib/lappeenranta");
    expect(installer).toContain('chmod 0600 "$ENV_FILE"');
    expect(installer).toContain('install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$DATA_DIR"');
  });

  it("orders services, restarts failures, and binds only to loopback", () => {
    expect(backend).toContain("Restart=on-failure");
    expect(backend).toContain("ExecStart=/usr/bin/env node /opt/lappeenranta/dist/backend/backend/server.js");
    expect(backend).toContain("ReadWritePaths=/var/lib/lappeenranta");
    expect(frontend).toContain("Requires=lappeenranta-backend.service");
    expect(frontend).toContain("After=lappeenranta-backend.service");
    expect(frontend).toContain("--hostname 127.0.0.1 --port 3000");
    expect(installer).toContain("http://127.0.0.1:4000/health");
    expect(installer).toContain("http://127.0.0.1:3000/");
  });
});
