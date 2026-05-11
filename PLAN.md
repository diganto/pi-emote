# Plan: Show USD→INR exchange rate beside total cost in pi-emote widget

## API Verified

`GET https://api.exchangerate-api.com/v4/latest/USD` → `{ rates: { INR: 94.570, ... } }`
- Free tier, no API key required
- Cached server-side, updates daily

## Changes (3 files)

### 1. `src/types.ts` — Add exchange rate config fields

```ts
export interface Config {
  // ... existing fields ...
  exchangeRate?: {
    from: string;   // e.g. "USD" (default)
    to: string;     // e.g. "INR"
  };
}
```

### 2. `src/widget.ts` — Add rate fetcher & display

New function `fetchExchangeRate()`:
- Fetches `https://api.exchangerate-api.com/v4/latest/{from}` 
- Returns `rate` number for `to` currency
- Caches in memory for lifetime of widget to avoid repeated requests (rate changes daily)
- Handles network errors gracefully (return null, widget still works)

Modify `buildInfoLines()`:
- Accept `config` parameter (already does)
- Compute INR cost: `totalCost * rate`
- Add two lines:
  1. `1 USD = ₹${rate.toFixed(2)}` (live exchange rate)
  2. `$${totalCost.toFixed(3)} / ₹${inrCost.toFixed(2)}` (converted cost)
- If rate not available (fetch failed, no config), fall back to showing only `$${totalCost.toFixed(3)}`

### 3. `config.json` — Add exchange rate config (optional)

```json
{
  // ... existing ...
  "exchangeRate": { "from": "USD", "to": "INR" }
}
```

## Expected widget output

```
──────────────────────────────────────────
  ▒▒▒▒▒▒▒▒  │ claude-sonnet-4-5 • high
  ▒▒  ▒▒▒▒  │ Context: 3.2k/200k (1.6%)
  ▒▒▒▒▒▒▒▒  │ ↑1.2k ↓456
            │ 1 USD = ₹94.57
            │ $0.023 / ₹2.18
```

## Edge cases

| Scenario | Behavior |
|----------|----------|
| No `exchangeRate` config | Show USD only (current behavior) |
| Network error / timeout | Show USD only, log warning |
| Rate fetch in progress | Show USD only until response arrives |
| `from`/`to` missing currencies | Show USD only |

## Out of scope
- Live realtime rate updates (not needed, API updates daily)
- Configurable refresh interval
- Multiple currency pairs
