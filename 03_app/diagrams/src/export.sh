#!/bin/sh
# Export the diagram pages to PNG with headless Chrome. Run from 03_app/diagrams:  sh src/export.sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="file://$(cd "$(dirname "$0")" && pwd)/diagrams.html"
for pair in "1 user_story_1" "4 user_story_2" "2 system" "3 sequence_1_upload_save" "5 sequence_2_browse_similar" "6 sequence_3_wake_up"; do
  set -- $pair
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1600,1000 \
    --virtual-time-budget=4000 --screenshot="$PWD/$2.png" "$SRC?p=$1" 2>/dev/null
  echo "wrote $2.png"
done
