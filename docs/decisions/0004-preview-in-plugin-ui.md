# 0004 — Render the preview inside the plugin UI, not in the Figma file

**Status**: Accepted
**Date**: 2026-05-15

## Context

The wizard has a preview step where the designer sees how their brand will look on real components before committing. Two ways to implement:

- **(a) Render in the plugin UI** (HTML/CSS inside the iframe): the plugin draws sample components — buttons, links, selections, cards — styled with the just-computed brand colors.
- **(b) Create a preview page or frame in the Figma file**: spawn actual Figma components on a preview page, switch their variables to the new brand. Designer sees the real components.

## Decision

(a) — render entirely in the plugin UI.

**Constraint from the user**: nothing from the plugin's preview operation should remain in the lib file. The lib file must end up with only the actual variable additions, no preview pages, frames, or stray artifacts. (b) violates this unless we always clean up — and cleanup is brittle (what if the plugin crashes mid-preview?).

## Consequences

**Positive:**

- Lib file stays clean. The plugin's footprint is exclusively the new variables.
- Preview is instant: no Figma render cycle, no waiting for components to update.
- The plugin window controls the preview surface entirely, no risk of side effects.

**Negative:**

- We don't get to show "real" components from the lib. The preview is a fixed set of samples we draw in HTML/CSS. Mitigation: pick samples that exercise the most visually-impactful tokens (Branding-group ones: base brand, text brand, link, selection).
- Sample components must be maintained in sync with how Gravity components actually render. If a button changes its token usage in code, the preview must follow. In practice this is rare and the preview only needs to be "good enough" to convey brand fit.

## Notes

- Preview HTML uses real Gravity-style CSS custom properties (`--g-color-base-brand`, etc.). The values are injected at runtime based on plugin-computed colors.
- Preview includes a theme switcher (Light / Dark / Light HC / Dark HC) so the designer can verify all four.
- Sample component list lives in `src/ui/preview/components.ts`. Initial set: primary button, outline button, link, visited link, selection, card with heading and body text.
