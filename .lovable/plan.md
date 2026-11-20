# Dashboard redesign: Graphite neutral, less "AI-made"

## What makes it look AI-made today
- Every block is the same rounded card ("bento" tiles) with big corners and glow, so it reads like a template.
- Amber accent everywhere (buttons, gauges, icons, chart lines) plus gradients and glow shadows.
- A "Welcome back, name" header with large title, generic icons on every stat, mixed chart colors (amber, green, blue, red, purple).
- Charts use soft filled areas with no axes or reference values, so they feel decorative rather than useful.

## New direction: Graphite neutral
- Colors: near-black greys with no blue tint, white/grey text, a single muted teal accent used only for the main action and the selected state. Green/red only for profit and loss.
- Shape: smaller corners (6px), thin 1px borders, no glows and no gradients. Panels sit edge to edge in a tighter grid like pro platforms (IBKR, cTrader, TradingView).
- Type: keep JetBrains Mono for numbers and Work Sans for text, but smaller, denser, with tabular numbers aligned right.

## New dashboard layout
```text
+--------------------------------------------------------------+
| Account strip: Balance | Equity | Open P&L | Free margin | Margin level | [Deposit] |
+--------------------------------------+-----------------------+
| Equity curve (line, axes, range     | Account risk          |
| 1W 1M 3M ALL, start/end values)      | margin bar + numbers  |
|                                      | Performance: win rate,|
|                                      | profit factor, max DD |
+--------------------------------------+-----------------------+
| Daily P&L (green/red bars, zero line)| Exposure by market    |
|                                      | (horizontal bars, %)  |
+--------------------------------------+-----------------------+
| Open positions table (dense, sortable, P&L right-aligned)    |
+--------------------------------------------------------------+
```
- Remove "Welcome back" hero; name moves to the sidebar footer only.
- Remove decorative icons from stat cards.
- Replace the donut chart with horizontal exposure bars (easier to read).
- Margin level becomes a simple labeled bar with 100% margin call and 50% stop-out marks.

## Charts (better, cleaner)
- Equity: thin teal line, light gridlines, y-axis in $, hover crosshair with date and value, high/low labels.
- Daily P&L: green/red bars around a zero line, axis labels, totals for the range.
- Tooltips: compact, dark, monospace numbers.

## Also restyled (same colors, same shell)
- Sidebar, top bar and phone tab bar: flat graphite, teal for the active item.
- Buttons/inputs/tabs pick up the new colors automatically through the theme; trading screen, admin and landing follow automatically, with no layout changes there.

## Not changed
- No changes to money, trading, prices or data logic. Same pages and menu items.

## Check
Screenshots of the dashboard on desktop and phone as user1@demo.com with open trades, plus a quick look at the trade screen and landing page to confirm the new colors read well.

## Technical details
- `src/index.css`: rewrite tokens (background ~0 0% 5%, surface 220 4% 9%, border 220 4% 16%, primary teal 173 58% 39%, success 142 60% 45%, destructive 0 72% 58%), chart tokens to neutral greys + teal; `--radius` 0.375rem; drop `--shadow-glow`, `--gradient-amber` usage (keep names pointing to flat values so other pages don't break); `.bento` -> flat panel.
- `src/components/dashboard/widgets.tsx`: restyle StatCard (no icon), EquityChart (Line + axes + crosshair), DailyPnlChart (zero ReferenceLine, axes), replace Donut with ExposureBars, MarginGauge with marked bar.
- `src/pages/Dashboard.tsx`: new grid layout as above, account strip, remove hero.
- Update the visual direction memory to Graphite neutral + teal (replaces Midnight + Amber).
