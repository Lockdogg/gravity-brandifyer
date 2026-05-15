# 0002 — Generate HC themes by re-applying the same blend with HC backgrounds

**Status**: Accepted
**Date**: 2026-05-15

## Context

The internal lib supports 4 themes (Light, Dark, Light HC, Dark HC). A new brand must work in all four. The `@gravity-ui/uikit-themer` package only exposes Light and Dark generation. We need a strategy for HC variants.

Options:

- **(a) Skip HC for new brands**: leave HC modes empty or copy from Light/Dark. Cheap, but HC users of products on this brand get a broken experience.
- **(b) Inherit HC from base brand**: in HC modes, alias to base brand's tokens (no per-brand HC colors). The brand visually disappears under HC. Cheap, semi-acceptable.
- **(c) Generate HC properly**: apply the same blend algorithm with HC-specific backgrounds. More work but correct.

## Decision

(c) — generate HC properly.

The blend algorithm in Gravity's docs is parametric on the **primary background** and the **contrasting background** of a theme. The same algorithm with different bg values produces different output scales:

- **Light**: primary `#FFFFFF`, contrasting `#2D2C33`.
- **Dark**: primary `#2D2C33`, contrasting `#FFFFFF`.
- **Light HC**: primary `#FFFFFF`, contrasting `#222326` (or whatever the lib defines — read at runtime).
- **Dark HC**: primary `#222326`, contrasting `#FFFFFF`.

So we apply the same blend twice more (once with Light HC params, once with Dark HC) to produce the HC private color scales.

## Implementation

- Source the HC primary/contrasting backgrounds at runtime by reading `Yandex Cloud/Branding/Base Background` for each of the 4 modes. The lib is the source of truth — values may be tweaked over time.
- Light/Dark generation: call `@gravity-ui/uikit-themer.updateBaseColor` as normal.
- HC generation: implement a small `hcBlend(brandColor, primaryBg, contrastingBg)` function in `src/main/hc-blend.ts`. Linear sRGB interpolation. Pseudocode:

  ```ts
  function generateScale(brand: RGB, primaryBg: RGB, contrastingBg: RGB): ScaleByIndex {
    // 50..500: alpha (no theme dependency)
    // 50..500 solid: linear blend brand → primaryBg, ratio = (500 - i) / 500
    // 550 solid: brand color itself
    // 600..1000 solid: linear blend brand → contrastingBg, ratio = (i - 550) / 450
  }
  ```

- Verify against actual Themer output via unit tests: known brand color → known Light values must match. Use the user-provided Themer CSS sample as a fixture (`docs/themer-output-example.css`).

## Consequences

**Positive:**

- HC users see the brand. Accessibility intent is preserved.
- Algorithm is the same — no risk of HC drifting from regular themes conceptually.
- We get to control HC behavior precisely.

**Negative:**

- Slightly more code in the plugin.
- If our blend implementation diverges from Themer's internal math in subtle ways (e.g. linear sRGB vs gamma-corrected), HC values may look slightly off. Mitigation: unit tests against the canonical Themer output for Light/Dark first, then assume same math works for HC.

## Future

If `@gravity-ui/uikit-themer` adds HC support to its public API, switch to that and drop the custom code. Track via issue in the team's tooling backlog.
