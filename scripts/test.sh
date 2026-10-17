#!/bin/sh
# Runs the unit tests (tests/index.html) and end-to-end flows (tests/e2e.html) in headless Chrome.
# Results are read from the page title through Chrome's debugging endpoint. Exit code 1 on failure.
cd "$(dirname "$0")/.."
PORT=${PORT:-8765}; DBG=${DBG:-9333}
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE=$(mktemp -d)
cleanup() { kill $SRV 2>/dev/null; pkill -f "user-data-dir=$PROFILE" 2>/dev/null; rm -rf "$PROFILE"; }
trap cleanup EXIT
i=0; until curl -sf "http://127.0.0.1:$PORT/tests/index.html" >/dev/null; do i=$((i+1)); [ $i -gt 50 ] && { echo "server did not start"; exit 1; }; sleep 0.2; done
STATUS=0
python3 scripts/build_sw.py --check || STATUS=1
for page in index e2e; do
  "$CHROME" --headless=new --disable-gpu --user-data-dir="$PROFILE" --remote-debugging-port=$DBG --window-size=1000,900 --no-first-run --no-default-browser-check "http://127.0.0.1:$PORT/tests/$page.html" >/dev/null 2>&1 &
  T=""; n=0
  while [ $n -lt 240 ]; do
    T=$(curl -s "http://127.0.0.1:$DBG/json" | python3 -c 'import sys,json
try:
  ps=[p for p in json.load(sys.stdin) if p.get("type")=="page" and "/tests/" in p.get("url","")]; print(ps[0]["title"] if ps else "")
except Exception: print("")')
    case "$T" in *passed*|DONE*|error*) break;; esac
    n=$((n+1)); sleep 0.5
  done
  pkill -f "user-data-dir=$PROFILE" 2>/dev/null; sleep 0.5
  echo "== tests/$page.html"
  echo "$T" | tr '¦' '\n' | sed 's/^ //'
  case "$T" in *" passed"*) case "$T" in *FAIL*) STATUS=1;; esac;; DONE*) case "$T" in *FAIL*) STATUS=1;; esac;; *) STATUS=1; echo "(did not finish)";; esac
done
exit $STATUS
