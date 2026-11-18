#!/bin/sh
# Export the three diagram pages to PNG with headless Chrome. Run from 03_app/diagrams:  sh src/export.sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="file://$(cd "$(dirname "$0")" && pwd)/diagrams.html"
for pair in "1 user_story" "2 system" "3 sequence"; do
  set -- $pair
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1600,1000 \
    --virtual-time-budget=4000 --screenshot="$PWD/$2.png" "$SRC?p=$1" 2>/dev/null
  echo "wrote $2.png"
done
