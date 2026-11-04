# Declaration emit for exported functions

Converting `export function parse() {}` to `export const parse = () => {}` changes a library's `.d.ts` output from a function declaration to a constant with a function type. The parameter types, return type, type parameters, and JSDoc stay the same, so consumers get the same types. Only the form changes: editors show `const parse` instead of `function parse`.

Last verified: 2026-10-31, TypeScript 6.0.3.

## Experiment

Run from the repository root with `node --input-type=module -`. `ts.transpileDeclaration` emits declarations for one file in memory.

<!-- eslint-skip -->
```js
const ts = (await import(process.cwd() + '/node_modules/typescript/lib/typescript.js')).default;
const emit = (code) => ts.transpileDeclaration(code, { compilerOptions: { isolatedDeclarations: true, declaration: true } });
for (const code of [
  'export function parse(input: string): number { return 1 }',
  'export const parse = (input: string): number => 1',
  '/** Parses input */\nexport function parse<T>(input: T): T { return input }',
  '/** Parses input */\nexport const parse = <T,>(input: T): T => input',
]) { const r = emit(code); console.log(JSON.stringify(code), '\n  =>', JSON.stringify(r.outputText.trim()), r.diagnostics.length ? r.diagnostics.map(d => d.messageText) : ''); }
```

```text
"export function parse(input: string): number { return 1 }"
  => "export declare function parse(input: string): number;"
"export const parse = (input: string): number => 1"
  => "export declare const parse: (input: string) => number;"
"/** Parses input */\nexport function parse<T>(input: T): T { return input }"
  => "/** Parses input */\nexport declare function parse<T>(input: T): T;"
"/** Parses input */\nexport const parse = <T,>(input: T): T => input"
  => "/** Parses input */\nexport declare const parse: <T>(input: T) => T;"
```

Neither form produced diagnostics.

## Scope

The cases where the declaration form matters to the type system are already outside the conversion: `prefer-arrow-functions` never converts overloaded functions, functions merged with a namespace, assertion functions, or `never` return types. See [../../docs/rules/prefer-arrow-functions.md](../../docs/rules/prefer-arrow-functions.md#typescript).
