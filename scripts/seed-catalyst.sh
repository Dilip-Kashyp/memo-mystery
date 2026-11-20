#!/usr/bin/env bash
# Seeds the Catalyst Data Store through the deployed zcql_api function.
# Usage:
#   APP_URL=https://<your-app>.development.catalystserverless.in ADMIN_KEY=<key> ./scripts/seed-catalyst.sh
#   add RESET=1 to wipe the game tables first
set -euo pipefail
: "${APP_URL:?Set APP_URL to your Catalyst app domain (no trailing slash)}"
: "${ADMIN_KEY:?Set ADMIN_KEY to the value configured on the zcql_api function}"
API="$APP_URL/server/zcql_api"
H=(-H "x-admin-key: $ADMIN_KEY" -H "Content-Type: application/json")

if [[ "${RESET:-0}" == "1" ]]; then
  echo "→ Wiping game tables"
  curl -fsS -X POST "${H[@]}" "$API/admin/reset"; echo
fi

# Parents first: child tables resolve foreign keys to the parents' ROWIDs.
for t in Persons Meetup_Events Incident_Reports Event_Checkins Witness_Statements Cab_Rides Commit_Logs UPI_Payments; do
  echo "→ Seeding $t"
  curl -fsS -X POST "${H[@]}" -d "{\"table\":\"$t\"}" "$API/admin/seed"; echo
done

echo "→ Status"
curl -fsS "${H[@]}" "$API/admin/status"; echo
