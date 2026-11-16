# Arena Header Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Anton to the desktop arena navigation and redesign the existing open transfer-window indicator as an energetic angular status ticket without changing navigation behavior or colors.

**Architecture:** `Layout.jsx` receives only semantic markup/classes for the indicator, while `arenaNavigation.css` owns typography, dark/light presentation, animation and reduced-motion behavior. A source-level test follows the repository's existing presentation-test pattern.

**Tech Stack:** React 18, CSS, Node test runner, existing STAGE navigation.

**Spec:** `docs/superpowers/specs/2026-11-16-arena-header-typography-design.md`

## Global Constraints

- Desktop top-navigation and dropdown labels use explicit `'Anton', Impact, sans-serif`.
- Preserve blue/white navigation and green/turquoise transfer-window colors.
- Keep existing routes, dropdown behavior, status logic and mobile navigation unchanged.
- Disable decorative animation for reduced-motion users.
- Add no dependency or font asset.

## Review Focus

- Portalled dropdown labels must inherit Anton even outside the header DOM; the test asserts `.stage-arena-menu` typography.
- Light-theme header contrast must remain readable; the test asserts a `.stage-arena-header-light` status-ticket treatment.
- A false/unknown transfer status must still render no ticket; existing conditional rendering remains unchanged and the test pins the conditional.
- The status ticket must not wrap or overflow a crowded header; CSS assertions pin `white-space: nowrap` and compact sizing.
- Reduced-motion users must receive neither pulse nor sheen animation; the test asserts the reduced-motion selectors.

---

### Task 1: Arena header typography and transfer status ticket

**Files:**
- Create: `src/components/navigation/__tests__/arenaHeaderPresentation.test.mjs`
- Modify: `src/components/Layout.jsx`
- Modify: `src/components/navigation/arenaNavigation.css`
- Modify: `.21st/design.json`

**Interfaces:**
- Consumes: `transferWindowIndicator` from existing `getTransferWindowIndicatorLabel()` flow.
- Produces: unchanged navigation behavior with new `.stage-arena-transfer-status`, child label/status classes and explicit Anton styling.

- [ ] **Step 1: Write the failing presentation test**

Assert explicit Anton styling for `.stage-arena-tab > span` and `.stage-arena-menu [role="menuitem"]`; assert ticket child classes, green/turquoise colors, clipped angular shape, nowrap sizing, light-theme override, and reduced-motion disabling both animations. Assert the existing `transferWindowIndicator ?` conditional remains.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/components/navigation/__tests__/arenaHeaderPresentation.test.mjs`

Expected: FAIL because the new status-ticket markup and CSS do not exist and arena labels do not explicitly declare Anton.

- [ ] **Step 3: Search 21st and inspect applicable inspiration**

Run: `21st search "compact esports navigation status badge angular" --context auto`. Use only inspiration that fits the existing flat arena header; install nothing.

- [ ] **Step 4: Implement semantic status-ticket markup**

Replace the indicator's inline visual styles with `.stage-arena-transfer-status`, `.stage-arena-transfer-dot`, `.stage-arena-transfer-label`, and `.stage-arena-transfer-open`. Preserve the same conditional and accessible text.

- [ ] **Step 5: Implement the approved CSS treatment**

Set explicit Anton typography on arena triggers and portalled menu labels. Add angular ticket, retained green/turquoise palette, light-theme contrast, pulse/sheen animations and reduced-motion overrides.

- [ ] **Step 6: Record the durable design decision**

Add `.21st/design.json` decision `Anton arena navigation` describing the explicit Anton labels and angular green transfer-status ticket.

- [ ] **Step 7: Run verification**

Run the focused test, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `21st review src/components/Layout.jsx src/components/navigation/arenaNavigation.css`. Apply only safe deterministic fixes, then rerun affected checks.

- [ ] **Step 8: Visually review desktop dark/light headers**

Confirm Anton appearance, dropdown consistency, ticket spacing, retained colors, no header overflow and reduced-motion behavior.

- [ ] **Step 9: Commit**

```bash
git add src/components/Layout.jsx src/components/navigation/arenaNavigation.css src/components/navigation/__tests__/arenaHeaderPresentation.test.mjs .21st/design.json
git commit -m "style: energize arena header navigation"
```
