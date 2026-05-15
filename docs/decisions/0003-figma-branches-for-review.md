# 0003 — Use Figma branches for review, not a custom submit-flow

**Status**: Accepted
**Date**: 2026-05-15

## Context

The central lib is shared. We need a review step before a designer's new brand is published. Options:

- **(a) Custom submit/review in the plugin**: plugin produces a brand "config" artifact (JSON) that DS team imports and reviews separately. Two-step flow with an explicit gate.
- **(b) Figma branches**: designer makes a branch of the central lib, runs the plugin in the branch, branch goes through Figma's native review/merge UI. One-step from plugin's perspective.
- **(c) Direct write to main, fix-later culture**: designers write directly to main, trust them. Risk of unreviewed brands accumulating.

## Decision

(b) — Figma branches.

DS team already practices branch-based work on the lib. The plugin slots into this naturally: it writes into whatever file context it's run in (which should be a branch), and Figma's native merge UI handles the review.

## Consequences

**Positive:**

- No custom approval mechanism to build or maintain.
- Designers use a workflow they already know.
- Reviewer sees the actual variable changes diff-style in Figma's branch UI.
- Rollback is trivial: revert the branch.

**Negative:**

- Plugin can technically run on the main branch and write there directly. Mitigated with a soft warning ("You're on main, consider branching first") rather than a hard block — sometimes DS team will want to write to main directly.
- Designers without write access to the lib can't use the plugin at all. Acceptable: brand creation is intentionally a privileged action.

## Notes

- The plugin doesn't need to know about branches — it just operates on the current file. Branch awareness comes from Figma's UI showing the designer they're in a branch.
- The plugin's "Done" screen explicitly nudges: "Submit this branch for review when ready."
