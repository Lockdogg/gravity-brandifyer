# Project context for Claude Code

This file is read at the start of every Claude Code session. Keep it compact (~2 screens). For deeper detail see `PLAN.md`, `SPEC.md`, and `docs/`.

## What is this

Figma plugin **Gravity Brandifyer** for the internal **YC Gravity UI** design library. Lets a product designer add their own "brand" to the central lib via a wizard: input a brand color → plugin generates Private Colors scale + Appearance group + new Brand-collection mode for all 4 themes (Light, Dark, Light HC, Dark HC), all written into the current Figma branch.

Out-of-scope for v1: edit/delete brands, working-file migrations (those are native Figma mode-switches on the Brand collection), typography/radii customization.

## Token model (memorize)

3-tier:

1. **Private Colors** — primitives `<Brand>/Light/Blue/550 Solid` etc. RGB values.
2. **Appearance** — branded semantic tokens `<Brand>/Text/Primary` etc. Collection has 4 modes: Light / Dark / Light HC / Dark HC. ~142 tokens per brand.
3. **Brand** — abstract `--g-color-text-primary` etc. Collection has one mode per brand (~6 today, limit ~40 in Figma). ~215 tokens. Each alias resolves to a specific `<Brand>/...` in Appearance based on the brand mode.

Components in the lib point at **Brand** (the abstract layer). Switching brand = switching the Brand mode. Switching theme = switching the Appearance mode. The two are orthogonal.

## Plugin behavior on commit

For brand `<NewBrand>`:

- **Private Colors**: ~31 new vars `<NewBrand>/Brand/50..1000` (alpha + solid scale), 4 mode values each.
- **Appearance**: new group `<NewBrand>/`, ~142 vars. Branding/* aliases to new private brand primitives. Everything else (Text, Base, Base Semantic, ...) aliases to the **base brand**'s tokens (default: Yandex Cloud).
- **Brand**: new mode column, all ~215 vars aliased to corresponding `<NewBrand>/...` in Appearance.

Plugin **does not** create pages, frames, or any artifacts in the lib file beyond these variables.

## Two-phase workflow (confirmed architecture)

**Phase 1 — run in `Brand Name Private Colors` file** (blank file, no Appearance/Brand):
Plugin generates `<Brand>/Brand/50..1000` local collection. Designer publishes as library.

**Phase 2 — run in main lib branch** (Appearance + Brand present):
Plugin creates Appearance group + Brand mode, aliasing Branding/* to the published Phase 1 lib.
Plugin auto-detects phase from which collections exist in the current file.

## Themer integration

Use `@gravity-ui/uikit-themer` for Light/Dark private color generation (function `updateBaseColor`).

For Light HC and Dark HC: the package's public API doesn't support HC. We apply the **same blend algorithm** with **HC backgrounds**:

- Light HC primary bg: `#FFFFFF`, contrasting bg: `#222326` (or whatever's in `Yandex Cloud/Branding/Base Background` for Light HC mode — read it at runtime).
- Dark HC primary bg: `#222326`, contrasting bg: `#FFFFFF`.

Blend logic: indices 50–500 = alpha or blend with primary bg; 600–1000 solid = blend with contrasting bg. Linear interpolation in sRGB is fine to match Themer output. See `src/main/hc-blend.ts` and ADR 0002.

## Architecture

Standard Figma plugin 2-process model:

- **`src/main/`** — Figma main thread. Reads/writes variables via `figma.variables.*`. No DOM.
- **`src/ui/`** — HTML iframe. Wizard, preview rendering, CSS export download. No Figma API access.
- **`src/shared/`** — types and message contracts for main↔UI communication.

Communication via `postMessage`. All message types declared in `src/shared/messages.ts`.

## Conventions

- TypeScript strict mode.
- No HTTP requests from the plugin. Themer runs locally as an npm dep.
- No browser storage (localStorage/sessionStorage) — plugin state lives in memory only.
- Preview UI uses real CSS custom properties (`--g-color-base-brand` etc.) with computed values so the demo matches what'll be in the lib.
- Russian for UI strings (designer audience), English for code comments and identifiers.
- Variable names in Figma follow existing convention: `<Brand>/<Group>/<TokenName>`, exactly as Yandex Cloud / Gravity / etc.

## Where to look

- **`PLAN.md`** — full plan: motivation, architecture, milestones. Start here on first session.
- **`SPEC.md`** — detailed product requirements: wizard steps, validations, edge cases. Reference daily.
- **`docs/architecture.md`** — data flows, variable maps.
- **`docs/decisions/`** — ADRs for key choices. Read before second-guessing a decision.
- **`docs/lib-dumps/`** — JSON dumps of the existing lib for reference and tests.
- **`docs/themer-output-example.css`** — example Themer output. Our CSS export must match this format.

## Current state

- [x] Milestone 0: Bootstrap
- [x] Milestone 1: Lib inspection
- [x] Milestone 2: Themer + HC blend — `generatePrivateColors` via `themer-bridge.ts`; HC themes use FALLBACK_BACKGROUNDS (no runtime read yet — sufficient for Phase 1)
- [ ] Milestone 3: Preview UI
- [~] Milestone 4: Variable writer — Phase 1 done (`writePrivateColorsFull`, ~1212 vars); Phase 2 (Appearance + Brand mode) not started
- [ ] Milestone 5: Wizard end-to-end
- [ ] Milestone 6: CSS export
- [ ] Milestone 7: Expert mode (custom Private Colors) — color-family overrides for Phase 1 already done; external lib scope still pending
- [ ] Milestone 8: Docs, polish, publish

### Phase 1 UI — complete
Brand name + color, Simple/Expert segmented control (top), Expert mode with 6 chromatic family overrides + "select all", generate button, toast notifications, help tooltip.
