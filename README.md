# Gravity Brandifyer Plugin

Figma plugin for adding new brands to the internal YC Gravity UI design library. A product designer inputs a brand color, the plugin generates a full Private Colors scale and Appearance group, then adds a new column to the Brand collection — all in a Figma branch, ready for review.

## Status

🚧 Early development. See `PLAN.md` for milestones, `CLAUDE.md` for project context.

## Quick start (developer)

```bash
git clone <repo>
cd brand-manager-plugin
pnpm install
pnpm build
```

Then in Figma:

1. **Plugins → Development → Import plugin from manifest…**
2. Pick `manifest.json` from this repo.
3. Open the YC Gravity UI library file, create a branch, run the plugin from **Plugins → Development → Gravity Brandifyer**.

For development with live rebuild:

```bash
pnpm dev
```

## How to use (designer)

1. Open the YC Gravity UI library file.
2. Create a Figma branch (so your changes are reviewable).
3. Run **Plugins → Gravity Brandifyer**.
4. Follow the wizard: pick a base brand, set your brand color, preview, and commit.
5. Download the CSS file for engineering handoff.
6. Submit your branch for review via Figma's native UI.

## Documentation

- **`PLAN.md`** — full project plan, milestones, motivation.
- **`SPEC.md`** — detailed product requirements: wizard steps, validations, edge cases.
- **`CLAUDE.md`** — project context for AI agents working in this repo.
- **`docs/architecture.md`** — system architecture, data flows.
- **`docs/decisions/`** — architecture decision records.

## Project structure

```
src/
  main/    Figma main-thread code (Variables API access)
  ui/      HTML iframe with wizard, preview, export
  shared/  types and message contracts
docs/      design docs, ADRs, reference materials
```

See `PLAN.md` for the full layout and what each file does.

## Tech

- TypeScript
- Figma Plugin API
- `@gravity-ui/uikit-themer` for color generation
- esbuild for bundling

## Contributing

This is an internal tool. Issues and PRs go through the DS team. See `docs/decisions/` before proposing architectural changes — chances are the question was already considered.

## License

(To be determined — internal use for now.)
