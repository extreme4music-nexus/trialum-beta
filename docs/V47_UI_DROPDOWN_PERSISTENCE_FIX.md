# v47 UI — Preserve Open Dropdowns and Accordions Across Actions

**Date:** 2026-11-23  
**Status:** Root cause confirmed; behavior change documented; implementation not started.  
**Scope:** Beta Classic UI. Habitat selection remains an intentional close-and-refresh exception.

## Observed behavior

Several expanded dropdown/accordion sections collapse after the player chooses an item or performs an action inside them. The player then has to reopen the section to continue. This occurs across multiple screens, including food storage and personal pet food reserves. The requested behavior is to preserve each expanded section until the player closes it, a different page/context is selected, or its content no longer exists. Selecting a different habitat in the laboratory remains the explicit exception: the active habitat changes and the screen refreshes, so the selector may close.

## Root cause in the current Beta source

The common cause is the successful-action repaint path, rather than each dropdown having its own reset bug:

1. `notice()` in `js/app.js` calls `render()` for every successful action (currently around line 73).
2. `render()` refreshes global UI and calls `renderTab()` (currently around line 229).
3. `renderTab()` replaces the current tab's complete DOM subtree using `tabContent.innerHTML = ...` (currently around lines 188–196).
4. A new `<details>` element starts closed unless its `open` state is restored. The old element—and its expanded state—was discarded.

Examples of affected `<details>` sections include:

- Per-recipe warehouse cards in `js/expansion-ui.js` (`<details class="card game-accordion">`).
- The personal food reserve panel in `js/food-home-ui.js` (`<details class="game-accordion">`).
- Plant, research, discovery, guide, and memory accordions in their respective UI modules.

The same full-subtree replacement can occur through direct `renderTab()` paths, such as pet model selection or asynchronous social/module updates. A fix limited to the food warehouse would leave the shared defect in place.

## Habitat exception

The fixed `#habitatSwitch` is outside `#tabContent`. Its `change` listener calls `selectHabitat()`, which updates `s.activeHabitat` and invokes `render()` (`js/app.js`, currently around line 230). This is a deliberate context change: the active habitat and dependent pet/UI state may change, so the selector is allowed to close and the new context is rendered. Preserve this exception explicitly; do not apply generic dropdown persistence to native selection menus.

Native HTML `<select>` controls on mobile may also close when an option is selected because the operating system owns their popup. The requested persistence primarily concerns in-page expandable dropdowns/accordions (`<details>`). Do not fight native platform behavior.

## Proposed change

Implement the behavior centrally so all pages use the same rule:

1. Before replacing `#tabContent`, collect the `open` state of expanded `<details>` elements using a stable key scoped to the current page. Add `data-accordion-key` values to dynamic/repeated sections where identity cannot be derived reliably from a unique element ID.
2. Render the updated tab content, then restore `open=true` for matching keys that still exist. Do not restore an element that was removed or whose containing page/context changed.
3. Ensure user-initiated closing is respected: a section explicitly closed by the player stays closed after the next action.
4. Apply this in the common tab-render path so successful game actions and module-triggered repaint paths behave consistently. Avoid implementing independent state caches in the warehouse, research, plant, or pet modules.
5. Keep `#habitatSwitch` outside this mechanism. A genuine habitat change continues to update the world and close/refresh the selector as currently designed.

Stable key rules:

- Prefer explicit element IDs for singleton sections.
- Use semantic stable keys for repeated sections (for example, `warehouse:<recipeId>`, `pet-food:<petId>`, `research:<fieldId>`).
- Do not key by localized summary text: language changes would lose state and duplicate labels collide.
- Do not key only by DOM index when dynamic lists can reorder.

## Acceptance criteria

- Open a warehouse recipe, move one unit, and confirm the same recipe remains expanded with updated counts.
- Open a pet's food-reserve panel, supply/return/feed one unit, and confirm the panel remains expanded with correct quantities.
- Perform successful and failed actions in plant, research, food, guide, and memory accordions; expanded state persists after successful repaint and is not spuriously opened after failure.
- If an action removes the underlying item/section, no stale open state is attached to another item.
- Explicitly close an accordion, perform an unrelated successful action on the same page, and confirm it stays closed.
- Switch tabs/pages and confirm state does not leak into another page. Return behavior should be specified consistently (default closed, unless a separate product decision asks for per-page memory).
- Select another habitat and confirm the existing context refresh still occurs and the habitat selector closes.
- Verify keyboard and screen-reader semantics of native `<details>` remain intact.

## Implementation boundary

This is a UI state-preservation change only. It must not mutate game state, change the action results, or alter persistence/backup formats. Implement as one focused Beta change after the owner approves proceeding from this documented diagnosis. Do not start a Play build or release as part of the UI fix unless requested separately.

## Change log

- 2026-11-23: traced the repeated collapse to `notice() → render() → renderTab() → innerHTML replacement`; documented the central fix and the intentional habitat-selector exception.
