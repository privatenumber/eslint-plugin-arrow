# TypeScript

TypeScript checking that affects which conversions are safe.

- [class-fields.md](./class-fields.md): which class field hazards TypeScript reports, and which converted forms it accepts.
- [declaration-emit.md](./declaration-emit.md): how converting an exported function changes `.d.ts` output.
- [inferred-function-types.md](./inferred-function-types.md): why a function whose signature reads `typeof` a value that calls it can fail with TS7022 as a `const`.
- [file-pragmas.md](./file-pragmas.md): why `@ts-check` and `@ts-nocheck` must stay above moved code.
