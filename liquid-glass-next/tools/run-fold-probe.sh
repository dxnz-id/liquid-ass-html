#!/data/data/com.termux/files/usr/bin/sh
D=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p $D/out
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3000/ && break; sleep 1; done
curl -sf -o /dev/null 'http://localhost:3000/?debug'; sleep 2
chromium-browser --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-webgl --hide-scrollbars \
  --remote-debugging-port=9463 --user-data-dir=$HOME/.cache/liquid-glass-next/prof-fold --window-size=390,844 --no-first-run --no-default-browser-check \
  "http://localhost:3000/?debug" >$D/out/fold-chromium.log 2>&1 &
P=$!
node $D/fold-probe.mjs
STATUS=$?
kill $P 2>/dev/null
wait $P 2>/dev/null
exit $STATUS
