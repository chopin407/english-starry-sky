#!/usr/bin/env bash
set -euo pipefail
umask 077

root="${1:?Missing deployment directory}"
release="${2:?Missing release ID}"
port="${3:?Missing HTTP port}"
app=english-starry-sky
release_pattern='^[0-9]{14}-[0-9a-f]{8}$'
port_pattern='^[1-9][0-9]{3,4}$'

[[ "$root" =~ ^(/[a-zA-Z0-9_][a-zA-Z0-9_.-]*)+$ && "$release" =~ $release_pattern &&
   "$port" =~ $port_pattern && "$port" -ge 1024 && "$port" -le 65535 ]] || {
  echo 'Invalid deployment directory, release ID or port.' >&2
  exit 1
}
root="$(cd -- "$root" && pwd -P)"
incoming="$root/.incoming/$release"
target="$root/releases/$release"
marker="$root/current-release"
previous=
previous_port=
switching=0

start_release() {
  local dir="$1" service_port="$2"
  local interpreter="$python"
  local args=("$service_port")
  if [[ -f "$root/mysql-sync.json" && -f "$dir/lan_sync.py" ]]; then
    interpreter="$root/.sync-venv/bin/python"
    args+=(--sync-config "$root/mysql-sync.json")
    [[ -x "$interpreter" ]] || { echo 'Missing MySQL sync virtual environment.' >&2; return 1; }
  fi
  pm2 start "$dir/serve-lan.py" --name "$app" --interpreter "$interpreter" --cwd "$dir/site" \
    -- "${args[@]}" 9>&-
}

healthy() {
  local dir="$1" service_port="$2" url expected actual audio_response
  expected="${dir##*/}"
  url="http://127.0.0.1:$service_port"
  for ((attempt = 0; attempt < 15; attempt++)); do
    if actual="$(curl -fsS --max-time 2 "$url/release.txt" 2>/dev/null)" && [[ "$actual" == "$expected" ]] &&
        curl -fsS --max-time 2 -o /dev/null "$url/" &&
        { [[ ! -f "$root/mysql-sync.json" || ! -f "$dir/lan_sync.py" ]] ||
          curl -fsS --max-time 5 -o /dev/null "$url/api/health"; } &&
        audio_response="$(curl -fsS --max-time 2 -r 0-1 -o /dev/null -w '%{http_code}:%{size_download}' \
          "$url/lessons/7a/starter-unit-1-a-2a.mp3")" && [[ "$audio_response" == 206:2 ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

finish() {
  local status="$?"
  trap - EXIT
  trap '' HUP INT TERM
  if (( status != 0 && switching )) && [[ ! -f "$marker" || "$(<"$marker")" != "$release" ]]; then
    echo 'Deployment failed. Restoring the previous service.' >&2
    if pm2 describe "$app" >/dev/null 2>&1 9>&-; then
      pm2 delete "$app" 9>&- || echo "Could not remove the failed process: $app" >&2
    fi
    if [[ -n "$previous" ]]; then
      if start_release "$previous" "$previous_port" && healthy "$previous" "$previous_port"; then
        echo "Restored release: ${previous##*/}" >&2
        pm2 save --force 9>&- || echo 'Could not save the restored process list.' >&2
      else
        echo "Automatic restore failed. Check: pm2 logs $app" >&2
      fi
    else
      pm2 save --force 9>&- || echo 'Could not save the process list.' >&2
    fi
  fi
  rm -rf -- "$incoming" || echo "Could not clean up $incoming" >&2
  exit "$status"
}

trap finish EXIT
trap 'exit 1' HUP INT TERM
if ! command -v pm2 >/dev/null || ! command -v node >/dev/null; then
  if [[ "${ENGLISH_LAN_PM2_PROFILE:-}" == 1 ]]; then
    echo 'Node.js and PM2 are required in the SSH user environment.' >&2
    exit 1
  fi
  # fnm and nvm are often loaded only by the interactive Bash profile.
  export ENGLISH_LAN_PM2_PROFILE=1
  exec bash -ic 'exec bash "$@"' bash "$0" "$@" </dev/null
fi
for command in python3 curl tar flock; do
  command -v "$command" >/dev/null || { echo "Required on server: $command" >&2; exit 1; }
done
python="$(command -v python3)"

exec 9>"$root/.deploy.lock"
flock -n 9 || { echo "Another $app deployment is running." >&2; exit 1; }

[[ ! -L "$marker" && ( ! -e "$marker" || -f "$marker" ) ]] || { echo 'Invalid current-release path.' >&2; exit 1; }
if [[ -f "$marker" ]]; then
  old_release="$(<"$marker")"
  [[ "$old_release" =~ $release_pattern ]] || { echo 'Invalid current-release file.' >&2; exit 1; }
  previous="$root/releases/$old_release"
  [[ -s "$previous/port" && -s "$previous/serve-lan.py" && -s "$previous/site/index.html" ]] || {
    echo 'Missing previous release.' >&2; exit 1;
  }
  previous_port="$(<"$previous/port")"
  [[ "$previous_port" =~ $port_pattern && "$previous_port" -ge 1024 && "$previous_port" -le 65535 ]] || {
    echo 'Invalid previous port.' >&2; exit 1;
  }
fi

pm2 ping >/dev/null 9>&-
running="$(pm2 jlist 9>&- | "$python" -c '
import json, sys
app, previous = sys.argv[1:]
matches = [entry for entry in json.load(sys.stdin) if entry["name"] == app]
if matches and (not previous or len(matches) != 1 or
                matches[0]["pm2_env"]["pm_exec_path"] != previous + "/serve-lan.py"):
    sys.exit(f"PM2 name {app} is already in use outside this deployment.")
print(int(bool(matches)))
' "$app" "$previous")"

if (( !running )) || [[ "$previous_port" != "$port" ]]; then
  "$python" - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])
with socket.socket() as sock:
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", port))
    except OSError as error:
        sys.exit(f"Cannot bind HTTP port {port}: {error}. Choose another port with -Port.")
PY
fi

staged="$incoming/unpacked"
mkdir -p -- "$root/releases"
mkdir -- "$staged"
tar -xzf "$incoming/$app-$release.tar.gz" --no-same-owner --no-same-permissions -C "$staged"
if [[ -f "$staged/lan-delta.json" ]]; then
  [[ -n "$previous" ]] || { echo 'Incremental deployment requires an active release.' >&2; exit 1; }
  "$python" "$incoming/lan_delta.py" restore "$staged" "$previous"
  rm -- "$staged/lan-delta.json"
fi
for file in serve-lan.py site/index.html site/version.json site/atlas/index.json site/lessons/7a/starter-unit-1-a-2a.mp3; do
  [[ -s "$staged/$file" ]] || { echo "Missing release file: $file" >&2; exit 1; }
done
if [[ -f "$root/mysql-sync.json" && ! -s "$staged/lan_sync.py" ]]; then
  echo 'This archive predates MySQL sync. Build a new archive before deploying.' >&2
  exit 1
fi
printf '%s\n' "$release" > "$staged/site/release.txt"
printf '%s\n' "$port" > "$staged/port"
[[ ! -e "$target" && ! -L "$target" ]] || { echo "Release already exists: $target" >&2; exit 1; }
mv -T -- "$staged" "$target"

if (( running )); then pm2 delete "$app" 9>&-; fi
switching=1
start_release "$target" "$port"
healthy "$target" "$port" || { echo "Health check failed for release $release." >&2; exit 1; }
pm2 save 9>&-
printf '%s\n' "$release" > "$incoming/current-release"
mv -Tf -- "$incoming/current-release" "$marker"
switching=0
printf 'Active release: %s\n' "$release"
