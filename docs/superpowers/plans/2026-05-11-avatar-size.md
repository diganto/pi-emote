# Avatar Size Increase Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Make avatar display larger in pi-emote widget by increasing `config.size`.

**Architecture:** Single config value `size` controls display cols, padding, and info panel width. Change default + bump widget layout.

**Tech Stack:** TypeScript, pi-tui

---

### Task 1: Bump default size

**Files:**
- Modify: `src/config.ts:36`
- Modify: `src/types.ts:6`

- [ ] **Step 1: Change default size 8→10 in config.ts**

```ts
// src/config.ts line 36
size: 10,
```

- [ ] **Step 2: Verify type accepts larger value**

`src/types.ts:6` — already `size: number`, no change needed. Type allows any int.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: bump avatar default size to 10 cells"
```

---

### Task 2: Update widget layout for wider avatar

**Files:**
- Modify: `src/widget.ts:86`

- [ ] **Step 1: Increase info panel left margin to match larger avatar**

```ts
// src/widget.ts line 86
const infoWidth = width - config.size - 5;
```

This already uses `config.size` — auto-adjusts when size changes. No code change needed.

Verify layout works at 10 cols by checking renderKittyFrame/renderITermFrame use `config.size` directly (they do).

- [ ] **Step 2: Commit**

```bash
git commit -m "fix: adjust widget layout for wider avatar"
```

---

### Task 3: Update config.json (project override)

**Files:**
- Modify: `config.json`

- [ ] **Step 1: Set local config to match new default**

```json
// config.json
"size": 10,
```

- [ ] **Step 2: Commit**

```bash
git add config.json
git commit -m "chore: set local avatar size to 10"
```

---

### Task 4: Verify

- [ ] **Step 1: Check widget renders correctly**

Run pi session. Verify:
- Avatar displays at 10 cols wide
- Info panel text aligns properly beside avatar
- No layout overflow in narrow terminals (hideBelow=80 still protects small terminals)

- [ ] **Step 2: Test with config override**

```bash
# Override to test larger sizes
cat <<< '{"size": 14}' > .pi/extensions/pi-emote/config.json
```
Verify widget adapts.

- [ ] **Step 3: Revert override if needed**

```bash
rm .pi/extensions/pi-emote/config.json
```
