#!/usr/bin/env bash
set -euo pipefail

# Fresh clones of the reconciled Beads remote contain a dolt_ignore rule for
# the local-only events table, so Dolt correctly omits that table while cloning.
# bd 1.2.2 expects it to exist but does not recreate it in embedded mode. Repair
# that one local table without running migrations or committing shared schema.

readonly REQUIRED_BD_VERSION="1.2.2"
readonly DOLT_VERSION="2.3.1"
readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'Beads bootstrap repair failed: %s\n' "$*" >&2
  exit 1
}

command -v bd >/dev/null 2>&1 || fail "bd is not installed"
installed_bd="$(bd version | awk 'NR == 1 { print $3 }')"
[[ "$installed_bd" == "$REQUIRED_BD_VERSION" ]] || fail \
  "expected bd $REQUIRED_BD_VERSION, found ${installed_bd:-unknown}; refusing to migrate the shared schema"

cd "$ROOT"
if compgen -G "$ROOT/.beads/embeddeddolt/*/.dolt" >/dev/null; then
  printf 'Existing embedded Beads database found; preserving it.\n'
else
  bd bootstrap --yes
fi

context="$(bd context --json)"
grep -q '"dolt_mode": "embedded"' <<<"$context" || fail \
  "this repair is only for the supported embedded Dolt checkout"

database="$(
  CONTEXT="$context" python3 - <<'PY'
import json, os
print(json.loads(os.environ["CONTEXT"])["database"])
PY
)"
readonly database_dir="$ROOT/.beads/embeddeddolt/$database"
[[ -d "$database_dir/.dolt" ]] || fail "embedded database not found at $database_dir"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/gggplot-dolt.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)
    archive="dolt-linux-amd64.tar.gz"
    checksum="0a2a318f27c5e1088a2883038573c2054e00f356dc9752e74bca934f8321959a"
    bundle="dolt-linux-amd64"
    ;;
  Linux-aarch64 | Linux-arm64)
    archive="dolt-linux-arm64.tar.gz"
    checksum="33ce669f922a3424f271a9905b815ea442133a0504eea1f43b07cb5b1fef589e"
    bundle="dolt-linux-arm64"
    ;;
  *)
    fail "unsupported repair platform $(uname -s)-$(uname -m); run this from the Linux orb setup"
    ;;
esac

curl -fsSL \
  "https://github.com/dolthub/dolt/releases/download/v${DOLT_VERSION}/${archive}" \
  -o "$tmp/$archive"
printf '%s  %s\n' "$checksum" "$tmp/$archive" | sha256sum --check --status ||
  fail "Dolt archive checksum mismatch"
tar -xzf "$tmp/$archive" -C "$tmp"
dolt="$tmp/$bundle/bin/dolt"

query_csv() {
  (cd "$database_dir" && "$dolt" sql -r csv -q "$1")
}

ignored="$(
  query_csv "SELECT ignored FROM dolt_ignore WHERE pattern = 'events'" |
    tail -n +2 | tr -d '\r'
)"
[[ "$ignored" == "1" ]] || fail \
  "events is not marked local-only in dolt_ignore; refusing to alter shared schema"

exists="$(
  query_csv "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'events'" |
    tail -n +2 | tr -d '\r'
)"

if [[ "$exists" == "0" ]]; then
  (cd "$database_dir" && "$dolt" sql -q '
    CREATE TABLE events (
      id CHAR(36) NOT NULL,
      issue_id VARCHAR(255) NOT NULL,
      event_type VARCHAR(32) NOT NULL,
      actor VARCHAR(255) NOT NULL,
      old_value LONGTEXT,
      new_value LONGTEXT,
      comment TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_events_created_at (created_at),
      KEY idx_events_issue (issue_id),
      CONSTRAINT fk_events_issue FOREIGN KEY (issue_id)
        REFERENCES issues (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  ')
  printf 'Created the ignored local Beads events table.\n'
elif [[ "$exists" == "1" ]]; then
  printf 'The ignored local Beads events table is already present.\n'
else
  fail "unexpected events-table count: $exists"
fi

# Because events is ignored, creating it must not dirty or advance shared Dolt
# history. This is the guard that keeps bootstrap repair local-only.
status="$(cd "$database_dir" && "$dolt" status)"
grep -q 'nothing to commit, working tree clean' <<<"$status" || fail \
  "repair changed shared Dolt state; inspect before any pull or push"

printf 'Beads bootstrap is write-ready on bd %s without shared schema migration.\n' \
  "$REQUIRED_BD_VERSION"
