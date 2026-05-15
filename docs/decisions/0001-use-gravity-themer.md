# 0001 — Use `@gravity-ui/uikit-themer` for color generation

**Status**: Accepted
**Date**: 2026-05-15

## Context

The plugin needs to generate a full Private Colors scale (alpha + solid variants from index 50 to 1000) from a single brand color, matching Gravity UI's blend algorithm so the generated brand looks correct against Gravity components.

Options considered:

- **Reimplement the algorithm ourselves** — full control, no dependency, but risk of drift from Gravity's canonical output. Doubles maintenance.
- **Use `@gravity-ui/uikit-themer`** — public npm package from Gravity team, has `updateBaseColor(brand)` that regenerates the private color scale. Same algorithm as the web Themer.
- **Fork and embed** — copy the relevant source files into our repo. Avoids npm dep but loses upstream fixes.

## Decision

Use `@gravity-ui/uikit-themer` as a regular npm dependency.

## Consequences

**Positive:**

- Generated output is bit-identical to the canonical web Themer, which designers may have already used to prototype the color.
- Algorithmic correctness is upstream's responsibility.
- Upgrades are free as long as the API stays stable.

**Negative / caveats:**

- The package's public API supports only `themeVariant: 'light' | 'dark'`. HC variants (Light HC, Dark HC) are not handled out of the box. We address this in ADR 0002.
- If the package internals are not exported, we may need to mirror a small piece of blend logic. Acceptable tradeoff.
- Bundle size increases. The package is small enough not to matter for a Figma plugin.

## Notes

- Use `updateBaseColor({ theme, colorToken: 'brand', value: { light, dark } })` rather than directly poking `baseColors` (per the package docs — direct manipulation skips regeneration).
- Wrap calls in `src/main/themer-bridge.ts` so the rest of the codebase can be agnostic to the underlying generator.
