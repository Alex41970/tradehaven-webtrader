# Fix phone touch problems on the Trade screen

## What's wrong (found in the code)
1. **Markets open on their own while scrolling.** Each market row opens the chart the moment a finger *touches* it, not when you *tap* it. So any scroll that starts on a row opens that market.
2. **The list rebuilds itself on every price update.** Rows are recreated from scratch every few seconds, which makes scrolling feel jumpy, can close the watchlist star menu by itself, and wastes battery.
3. **One-tap Buy/Sell can fire by accident.** The big Sell/Buy buttons sit right where your thumb rests while scrolling the chart page. A stray touch opens a real trade with no confirmation.
4. **Small touch targets.** The watchlist star (24px), lot +/- buttons and filter chips are below the 44px finger size Apple and Google recommend.
5. **Chart vs page scrolling fight.** Dragging on the chart can scroll the page (or the reverse), and the chart height doesn't fit well with the pinned trade bar.
6. **Other touch issues:** grey tap flash on iPhone, the lots box zooms the page or flips values when you scroll it, "New watchlist" uses a browser pop-up, and the long market list has no "back to top".

## The fix
1. Rows open only on a real tap: the finger lifts without moving more than a few pixels. Scrolling never opens anything.
2. Move the market row out so it stays stable between price updates; only the price and % change refresh.
3. Buy/Sell protection: a short confirm step (tap shows "Confirm Buy 0.10 lots @ price", second tap executes, cancels after 3 seconds). Add a setting to switch to true one-tap for experienced traders, off by default.
4. Bigger targets: star, +/- and chips become 44px touch areas without changing the look much.
5. Chart owns its touch gestures (pinch/drag) and the page keeps scrolling outside it; size the chart to the space left above the trade bar.
6. Remove the tap flash, stop lot box zoom/scroll changes, replace the pop-up with a small sheet, add pull-to-top button.
7. Same tap-vs-scroll check for other phone lists: open trades, history, dashboard market cards, and the "More" menu.

## Check
Run a phone-sized browser test: swipe through the market list (nothing should open), tap a market (chart opens), tap Buy once (confirm shows, no trade), confirm (trade opens), then close it. Screenshots of each step.

## Technical details
- `WebTrader.tsx`: delete `onPointerDown` select handler; add a `useTapGuard` hook (pointerdown records x/y/time, pointerup selects if moved < 8px and < 500ms; cancels on `pointercancel`/scroll). Hoist `AssetRow` to module level with `React.memo` and stable `onSelect` via `useCallback`.
- Confirm-to-trade state in the mobile trade bar; preference in localStorage.
- `touch-action: pan-y` on lists, `touch-action: none` inside chart container; `-webkit-tap-highlight-color: transparent` in `index.css`; lots input `type="text" inputMode="decimal"`, font-size >= 16px.
- Audit `TradeRow.tsx`, dashboard widgets and AppShell "More" sheet for the same pointerdown pattern.
