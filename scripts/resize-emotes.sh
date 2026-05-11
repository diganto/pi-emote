#!/usr/bin/env bash
# Resize all oversized emote PNGs to a sane size for a terminal avatar widget.
# Only resizes images where either dimension exceeds MAX_SIZE.
# Uses ImageMagick v7 (magick) with nearest-neighbor sampling.
#
# Usage: ./scripts/resize-emotes.sh [emote-set-dir] [max-size]
#
#   emote-set-dir   Path to an emote set (default: emotes/custom-avatar)
#   max-size        Max dimension in px (default: 128)
#
# Examples:
#   ./scripts/resize-emotes.sh                        # resize custom-avatar
#   ./scripts/resize-emotes.sh emotes/default 64      # resize default to 64px
#   ./scripts/resize-emotes.sh emotes/serious-avatar   # resize another set

EMOTE_DIR="${1:-emotes/custom-avatar}"
MAX_SIZE="${2:-128}"

if [ ! -d "$EMOTE_DIR" ]; then
  echo "❌ Emote set directory not found: $EMOTE_DIR"
  echo "Usage: $0 [emote-set-dir] [max-size]"
  exit 1
fi

if ! command -v magick &>/dev/null; then
  echo "❌ ImageMagick v7 (magick) not found. Install it: brew install imagemagick / apt install imagemagick"
  exit 1
fi

echo "🔍 Scanning $EMOTE_DIR for PNGs larger than ${MAX_SIZE}x${MAX_SIZE}px..."
echo ""

TOTAL=0
SKIPPED=0

for png in "$EMOTE_DIR"/*/*.png; do
  [ -f "$png" ] || continue

  read -r w h < <(magick identify -format "%w %h" "$png" 2>/dev/null || echo "0 0")

  if [ "$w" -le "$MAX_SIZE" ] && [ "$h" -le "$MAX_SIZE" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "   ↻ $png  (${w}x${h})"
  magick "$png" -sample "${MAX_SIZE}x${MAX_SIZE}" "$png"
  echo "     ✓ resized to ${MAX_SIZE}x${MAX_SIZE}px"
  TOTAL=$((TOTAL + 1))
done

echo ""
echo "✅ Done — resized $TOTAL PNGs, skipped $SKIPPED (already fine)"