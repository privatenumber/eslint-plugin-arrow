# Oxlint

How Oxlint loads and runs this plugin.

- [js-plugins.md](./js-plugins.md): Oxlint runs the published ESLint plugin unchanged, applies one pass of fixes per run, extends shared configs only by path or imported object, and adds about 30% runtime when a rule subscribes to code path events.
