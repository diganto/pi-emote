# Resize Custom Avatar Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Resize all oversized PNGs in `emotes/custom-avatar/` to 128x128.

**Architecture:** Use the existing `scripts/resize-emotes.sh` which uses ImageMagick v7 (`magick`) and nearest-neighbor sampling.

**Tech Stack:** Bash, ImageMagick (magick)

---

### Task 1: Run Resize Script

**Files:**
- Modify: `emotes/custom-avatar/**/*.png`

- [ ] **Step 1: Execute resize script on custom-avatar**

Run:
```bash
./scripts/resize-emotes.sh emotes/custom-avatar 128
```

- [ ] **Step 2: Verify dimensions**

Run:
```bash
magick identify -format "%w %h %f\n" emotes/custom-avatar/*/*.png
```
Expected: All files output `128 128 filename.png`

- [ ] **Step 3: Commit**

```bash
git add emotes/custom-avatar/
git commit -m "chore: resize all custom avatar emotes to 128x128"
```
