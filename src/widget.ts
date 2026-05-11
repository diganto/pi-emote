import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import type { Config } from "./types.js";
import type { Animator } from "./animator.js";
import type { RenderedFrame } from "./renderer.js";
import { log } from "./log.js";

// --- Exchange rate ---

let cachedRate: number | null = null;
let rateFetchPromise: Promise<number | null> | null = null;

async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  if (cachedRate !== null) return cachedRate;
  if (rateFetchPromise) return rateFetchPromise;

  rateFetchPromise = (async () => {
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      cachedRate = data.rates?.[to] ?? null;
      return cachedRate;
    } catch (e) {
      log(`exchange rate fetch failed: ${e}`);
      return null;
    }
  })();

  return rateFetchPromise;
}

// --- Token formatting ---

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1_000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

// --- Info panel ---

function buildInfoLines(width: number, config: Config, ctxRef: any, pi: any, theme: any, rate: number | null): string[] {
  const lines: string[] = [];
  if (!ctxRef) return lines;

  const model = ctxRef.model;
  let modelStr = model?.name ?? "no model";
  const thinkingLevel = pi.getThinkingLevel?.() ?? "high";
  if (model?.reasoning) {
    modelStr += ` • ${thinkingLevel}`;
  }
  lines.push(theme.bold(modelStr));

  const usage = ctxRef.getContextUsage?.();
  if (usage) {
    const pct = usage.percent !== null ? `${usage.percent.toFixed(1)}%` : "?";
    const tokens = usage.tokens !== null ? formatTokens(usage.tokens) : "?";
    const window = formatTokens(usage.contextWindow);
    lines.push(`Context: ${tokens}/${window} (${pct})`);
  }

  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  let currentProvider = "";
  let currentModelId = "";
  try {
    const entries = ctxRef.sessionManager.getEntries();
    for (const entry of entries) {
      if (entry.type === "model_change") {
        currentProvider = entry.provider ?? "";
        currentModelId = entry.modelId ?? "";
      } else if (entry.type === "message" && entry.message.role === "assistant") {
        const msg = entry.message;
        const usage = msg.usage;
        if (!usage) continue;

        totalInput += usage.input ?? 0;
        totalOutput += usage.output ?? 0;

        // Use stored cost if non-zero, otherwise calculate from model pricing
        const storedCost = usage.cost?.total ?? 0;
        if (storedCost > 0) {
          totalCost += storedCost;
        } else if (currentProvider && currentModelId && ctxRef.modelRegistry) {
          const modelInfo = ctxRef.modelRegistry.find(currentProvider, currentModelId);
          if (modelInfo?.cost) {
            const mc = modelInfo.cost;
            totalCost += (usage.input * mc.input / 1_000_000)
                      + (usage.output * mc.output / 1_000_000)
                      + (usage.cacheRead * mc.cacheRead / 1_000_000)
                      + (usage.cacheWrite * mc.cacheWrite / 1_000_000);
          }
        }
      }
    }
  } catch (e) {
    log(`cost calculation: ${e}`);
  }

  lines.push(`↑${formatTokens(totalInput)} ↓${formatTokens(totalOutput)}`);

  // Add exchange rate and converted cost if available
  if (rate !== null) {
    const inrCost = totalCost * rate;
    lines.push(`$${totalCost.toFixed(3)} / ₹${inrCost.toFixed(2)} • [$1 = ₹${rate.toFixed(2)}]`);
  } else {
    lines.push(`$${totalCost.toFixed(3)}`);
  }

  const infoWidth = width - config.size - 5;
  return lines.map(l => {
    if (visibleWidth(l) > infoWidth) return truncateToWidth(l, infoWidth, "…");
    return l;
  });
}

// --- Render helpers ---

/**
 * Kitty image layout: image sequence on row 0 (zero-width, cursor doesn't move),
 * avatarPad fills the space. Info text beside the image on all rows.
 */
function renderKittyFrame(frame: RenderedFrame & { kind: "image" }, width: number, config: Config, infoLines: string[], borderColor: (s: string) => string): string[] {
  const sep = borderColor("│");
  const leftMargin = " ";
  const avatarPad = " ".repeat(config.size);
  const lines: string[] = [];

  for (let i = 0; i < frame.rows; i++) {
    if (i === 0) {
      lines.push(leftMargin + frame.sequence + `${avatarPad} ${sep} ${infoLines[i] ?? ""}`);
    } else {
      lines.push(`${leftMargin}${avatarPad} ${sep} ${infoLines[i] ?? ""}`);
    }
  }

  return lines;
}

/**
 * iTerm2 image layout — text first, image last.
 *
 * The TUI processes lines top-to-bottom, erasing each with \x1b[2K before
 * writing. By placing the image on the LAST widget row with cursor-up
 * positioning, the image is rendered AFTER all line clears. It extends
 * downward over rows that already have text, filling the image area
 * (cols 1–size) without being erased. Text in cols (size+1)+ is preserved.
 *
 * Layout: frame.rows total (frame.rows-1 text rows + 1 image row).
 */
function renderITermFrame(frame: RenderedFrame & { kind: "image" }, width: number, config: Config, infoLines: string[], borderColor: (s: string) => string): string[] {
  const sep = borderColor("│");
  const size = config.size;
  const skipPad = `\x1b[${2 + size}C`;
  const lines: string[] = [];

  for (let i = 0; i < frame.rows; i++) {
    if (i < frame.rows - 1) {
      // Text rows: cursor-right past image area, then info
      lines.push(`${skipPad} ${sep} ${infoLines[i] ?? ""}`);
    } else {
      // Last row: cursor-up to first text row, place image, then text
      // After the image, cursor returns to this row (last image row, col 0).
      const up = frame.rows > 1 ? `\x1b[${frame.rows - 1}A` : "";
      lines.push(`${up}\x1b[1C${frame.sequence} ${sep} ${infoLines[i] ?? ""}`);
    }
  }

  return lines;
}

function renderTextFrame(frame: RenderedFrame & { kind: "text" }, width: number, config: Config, infoLines: string[], borderColor: (s: string) => string): string[] {
  const sep = borderColor("│");
  const leftMargin = " ";
  const avatarPad = " ".repeat(config.size);

  // Place emote text on the 3rd row (index 2), vertically centered in a
  // block tall enough to hold the info panel (min 4 rows to match image size).
  const emoteLines = frame.lines;
  const emoteRow = 2;
  const rowCount = Math.max(emoteRow + emoteLines.length, infoLines.length, 4);
  const lines: string[] = [];

  for (let i = 0; i < rowCount; i++) {
    const emoteIdx = i - emoteRow;
    const emote = (emoteIdx >= 0 && emoteIdx < emoteLines.length) ? emoteLines[emoteIdx] : "";
    const emoteWidth = visibleWidth(emote);
    // Center the emote within config.size columns
    const totalPad = config.size - emoteWidth;
    const padLeft = totalPad > 0 ? " ".repeat(Math.floor(totalPad / 2)) : "";
    const padRight = totalPad > 0 ? " ".repeat(Math.ceil(totalPad / 2)) : "";
    const cell = emote ? `${padLeft}${emote}${padRight}` : avatarPad;
    lines.push(`${leftMargin}${cell} ${sep} ${infoLines[i] ?? ""}`);
  }

  return lines;
}

// --- Widget factory ---

export interface WidgetDeps {
  animator: Animator;
  config: Config;
  pi: any;
  getCtxRef: () => any;
  getCurrentEmoteSet: () => string;
}

export function createWidgetFactory(deps: WidgetDeps) {
  // Start fetching rate when widget factory is created
  const ex = deps.config.exchangeRate;
  if (ex) {
    void fetchExchangeRate(ex.from, ex.to);
  }

  return (_tui: any, theme: any) => {
    deps.animator.setTui(_tui);
    return {
      render(width: number): string[] {
        const { animator, config } = deps;

        if (width < config.hideBelow) return [];

        const frame = animator.getRenderedFrame();
        if (!frame) {
          log(`render: no frame`);
          return [];
        }

        log(`render: kind=${frame.kind}, set="${deps.getCurrentEmoteSet()}"`);

        const thinkingLevel = deps.pi.getThinkingLevel?.() ?? "high";
        const borderColor = (theme as any).getThinkingBorderColor?.(thinkingLevel)
          ?? ((s: string) => theme.fg("border", s));
        const border = borderColor("─".repeat(width));
        const infoLines = buildInfoLines(width, config, deps.getCtxRef(), deps.pi, theme, cachedRate);

        const lines: string[] = [];
        lines.push(border);

        if (frame.kind === "image") {
          if (frame.cursorAdvances) {
            lines.push(...renderITermFrame(frame, width, config, infoLines, borderColor));
          } else {
            lines.push(...renderKittyFrame(frame, width, config, infoLines, borderColor));
          }
        } else {
          lines.push(...renderTextFrame(frame, width, config, infoLines, borderColor));
        }

        return lines;
      },
      invalidate() {},
      dispose() {
        deps.animator.setTui(null);
      },
    };
  };
}
