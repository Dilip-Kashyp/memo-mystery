#!/usr/bin/env bash
# Deploys the client + zcql_api function to Zoho Catalyst.
#
# The admin key is NEVER stored in git: catalyst-config.json keeps the placeholder
# "change-me", and this script swaps in $ADMIN_KEY only for the duration of the deploy.
#
#   Local:  ADMIN_KEY="$(cat .admin-key)" ./scripts/deploy.sh
#   CI:     see .github/workflows/deploy.yml (adds --token/--project/--org/--dc)
#
# Any extra arguments are passed straight to `catalyst deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."

CFG=functions/zcql_api/catalyst-config.json
CATALYST="${CATALYST_BIN:-catalyst}"

if [[ -z "${ADMIN_KEY:-}" ]]; then
  echo "⚠ ADMIN_KEY is not set: deploying with admin routes DISABLED (seeding/reset won't work)." >&2
else
  cp "$CFG" "$CFG.bak"
  trap 'mv -f "$CFG.bak" "$CFG"' EXIT
  node -e '
    const fs = require("fs"); const f = process.argv[1];
    const c = JSON.parse(fs.readFileSync(f, "utf8"));
    c.deployment.env_variables = { ...(c.deployment.env_variables || {}), ADMIN_KEY: process.env.ADMIN_KEY };
    fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");
  ' "$CFG"
fi

echo "→ Installing function dependencies"
(cd functions/zcql_api && npm ci --omit=dev --no-audit --no-fund)

echo "→ Deploying to Catalyst"
"$CATALYST" deploy -ni "$@"
