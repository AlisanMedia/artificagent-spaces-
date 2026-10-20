#!/usr/bin/env bash
set -euo pipefail

if [ "$(git rev-parse --is-shallow-repository)" != "false" ]; then
  echo "Full Git history is required for secret scanning." >&2
  exit 1
fi

task_tmp=$(mktemp -d -t artificagent-gitleaks.XXXXXXXXXX)
trap 'rm -rf "$task_tmp"' EXIT
archive="$task_tmp/gitleaks.tar.gz"
curl --fail --silent --show-error --location --proto '=https' \
  --retry 2 --retry-delay 1 --retry-max-time 60 --max-time 30 \
  --output "$archive" \
  https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
printf '%s  %s\n' \
  551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb \
  "$archive" | sha256sum --check --status
tar -xzf "$archive" -C "$task_tmp" gitleaks
printf '[extend]\nuseDefault = true\n' > "$task_tmp/default.toml"
mkdir -p artifacts/governance
"$task_tmp/gitleaks" git . --log-opts=--all \
  --config "$task_tmp/default.toml" --ignore-gitleaks-allow \
  --gitleaks-ignore-path "$task_tmp/no-ignore-file" \
  --redact=100 --no-banner --no-color --timeout=120 \
  --report-format=json --report-path=artifacts/governance/secrets.json
