# 0005 — v1 covers brand creation only (no edit/delete/migrate)

**Status**: Accepted
**Date**: 2026-05-15

## Context

A "complete" brand management plugin could support:

1. Create a new brand.
2. Edit an existing brand (change color, swap base brand, etc.).
3. Delete a brand.
4. Migrate a working file from one brand to another.
5. Rename a brand.

We need to scope v1 to avoid over-building.

## Decision

**v1 scope**: brand creation only (item 1).

Items 2–5 are out of scope. Rationale per item:

- **Edit**: the v1 plugin can be re-run for a new brand, but a created brand is, in practice, edited rarely. When edits are needed, they're usually targeted (tweak one token), which is faster done manually in Figma's Variables UI than via a wizard. Revisit if user feedback says otherwise.
- **Delete**: deleting a brand mode is destructive and has referential-integrity implications (designs using that mode break). Best left as a manual DS-team operation in v1.
- **Migrate working file**: with the Brand-collection abstraction (components alias through `--g-color-*`), switching brand on a design is a native Figma mode-switch on the collection. No plugin needed.
- **Rename**: same as delete — destructive, rare, easier as a manual operation.

## Consequences

**Positive:**

- Smaller surface area, faster delivery.
- Less risk of introducing bugs in destructive operations.
- Clear "single happy path" makes the wizard simple.

**Negative:**

- If a designer makes a typo in the brand name, they have to delete-and-recreate (or rename manually in Variables UI). Mitigation: solid name validation upfront.
- Designers who want to iterate on a brand color have to either (a) ask DS to edit it, (b) edit manually in Variables UI, or (c) wait for v2. Acceptable for initial release.

## Future

If usage shows clear need, v2 candidates in priority order:

1. **Edit**: re-run the wizard on an existing brand, regenerate private colors with a new input color, overwrite values in place.
2. **Delete with dependency check**: scan the file for usages of the brand's tokens, warn the designer, then remove the column/group/private colors.
3. **Rename**: rename the brand mode and update all `<Brand>/...` variable names consistently.
