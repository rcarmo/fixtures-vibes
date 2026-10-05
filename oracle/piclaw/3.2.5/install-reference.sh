#!/bin/sh
# Install (or reinstall from scratch) the dedicated Piclaw 3.2.5 reference instance on a Linux host over SSH.
#
#   oracle/piclaw/3.2.5/install-reference.sh root@192.168.1.236 [/opt/piclaw/releases/piclaw-3.2.5-linux-x64-baseline]
#
# Installs to /opt/piclaw-fixtures (release + fixture model) with state under /srv/piclaw-fixtures, and two systemd
# units: fixture-model (port 9920, all interfaces: the suite drives /control from outside) and piclaw-fixtures
# (port 8090). It touches nothing else on the host. Piclaw reaches the model as fixture-model.localhost, so the model
# URL is not "local" to Piclaw's local-lite heuristic (see README.md). `--uninstall` removes all of it again.
set -eu
target=${1:?usage: install-reference.sh user@host [release-dir] | user@host --uninstall}
release=${2:-/opt/piclaw/releases/piclaw-3.2.5-linux-x64-baseline}
repo=$(cd "$(dirname "$0")/../../.." && pwd)

if [ "$release" = "--uninstall" ]; then
  ssh "$target" 'systemctl disable --now piclaw-fixtures fixture-model 2>/dev/null || true
    rm -f /etc/systemd/system/piclaw-fixtures.service /etc/systemd/system/fixture-model.service
    systemctl daemon-reload; rm -rf /opt/piclaw-fixtures /srv/piclaw-fixtures
    sed -i "/# fixtures-vibes: fixture model hostname/d" /etc/hosts'
  exit 0
fi

test "$(cat "$release/VERSION" 2>/dev/null)" = 3.2.5 || { echo "not a Piclaw 3.2.5 release: $release" >&2; exit 1; }
name=$(basename "$release")
tar -C "$(dirname "$release")" -czf - "$name" | ssh "$target" "mkdir -p /opt/piclaw-fixtures && rm -rf /opt/piclaw-fixtures/$name && tar -C /opt/piclaw-fixtures -xzf -"
scp -q "$repo/control/fixture-model-server.ts" "$target:/opt/piclaw-fixtures/fixture-model-server.ts"

ssh "$target" NAME="$name" sh -s <<'REMOTE'
set -eu
R=/opt/piclaw-fixtures/$NAME
S=/srv/piclaw-fixtures
systemctl stop piclaw-fixtures fixture-model 2>/dev/null || true
mkdir -p $S/workspace/.piclaw $S/store $S/data $S/agent
grep -q '# fixtures-vibes: fixture model hostname' /etc/hosts ||
  echo '127.0.0.1 fixture-model.localhost # fixtures-vibes: fixture model hostname' >> /etc/hosts
cat > $S/agent/models.json <<'JSON'
{"providers":{"fixture":{"baseUrl":"http://fixture-model.localhost:9920/v1","api":"openai-completions","apiKey":"fixture-local-only","models":[{"id":"fixture-1"},{"id":"fixture-2"}]}}}
JSON
cat > $S/agent/settings.json <<'JSON'
{"defaultProvider":"fixture","defaultModel":"fixture-1","defaultThinkingLevel":"low"}
JSON
[ -f $S/workspace/.piclaw/config.json ] ||
  echo '{"domains":{"web":{"workspaceUploadLimitMb":256}}}' > $S/workspace/.piclaw/config.json
cat > /etc/systemd/system/fixture-model.service <<UNIT
[Unit]
Description=fixtures-vibes deterministic fixture model
[Service]
Environment=FIXTURE_MODEL_HOST=0.0.0.0 FIXTURE_MODEL_PORT=9920
ExecStart=$R/bun/bin/bun /opt/piclaw-fixtures/fixture-model-server.ts
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/piclaw-fixtures.service <<UNIT
[Unit]
Description=Piclaw 3.2.5 fixture reference instance (fixtures-vibes)
After=network-online.target fixture-model.service
Wants=fixture-model.service
[Service]
Environment=HOME=$S PICLAW_WORKSPACE=$S/workspace PICLAW_STORE=$S/store PICLAW_DATA=$S/data PICLAW_PI_AGENT_DIR=$S/agent
Environment=PICLAW_WEB_HOST=0.0.0.0 PICLAW_WEB_PORT=8090 PICLAW_KEYCHAIN_KEY=fixtures-vibes
WorkingDirectory=$S/workspace
ExecStart=$R/bin/piclaw
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now fixture-model piclaw-fixtures
for i in $(seq 1 90); do curl -fs -o /dev/null http://127.0.0.1:8090/agent/status && break; sleep 1; done
curl -fsS -o /dev/null http://127.0.0.1:8090/agent/status
sha256sum $R/app/runtime/web/static/classic/dist/app.bundle.js
REMOTE
