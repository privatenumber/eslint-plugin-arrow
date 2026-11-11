# TypeScript

TypeScript checking that affects which conversions are safe.

- [class-fields.md](./class-fields.md): which class field hazards TypeScript reports, and which converted forms it accepts.
- [declaration-emit.md](./declaration-emit.md): how converting an exported function changes `.d.ts` output.
- [inferred-function-types.md](./inferred-function-types.md): why signatures that read `typeof` the function or a value that calls it, and returns that call the function itself, fail as a `const`, and why a function that only throws infers `never` instead of `void`.
- [control-flow-annotations.md](./control-flow-annotations.md): why calls to a `never` or assertion function stop narrowing when the function becomes a `const` without a variable annotation.
- [jsdoc-this.md](./jsdoc-this.md): which JSDoc hosts move a `@this` tag onto the converted arrow function, where checked JavaScript reports TS2730.
- [file-pragmas.md](./file-pragmas.md): why `@ts-check` and `@ts-nocheck` must stay above moved code.
