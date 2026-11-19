#!/bin/sh
# Export the three Thursday diagrams to PNG with headless Chrome. Run from 04_final/diagrams:  sh src/export.sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="file://$(cd "$(dirname "$0")" && pwd)/diagrams.html"
for p in system user_flow sequence; do
  q=$p; [ "$p" = user_flow ] && q=flow
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1600,1000 \
    --virtual-time-budget=4000 --screenshot="$PWD/$p.png" "$SRC?p=$q" 2>/dev/null
  echo "wrote $p.png"
done
