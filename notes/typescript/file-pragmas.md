# File pragmas

`// @ts-nocheck` and `// @ts-check` only work at the top of a file. Code moved above them turns them off, which changes type checking without changing runtime behavior. `no-function-hoisting` keeps moved code below them.

Last verified: 2026-10-31, TypeScript 6.0.3.

## Experiment

The two files differ only in whether the function is above or below the pragma. The second is what `no-function-hoisting` produced from the first before the file-directive fix, during pre-release development.

```sh
printf '// @ts-nocheck\nhelper()\nfunction helper(): number { return "x" }\n' > before.ts
printf 'function helper(): number { return "x" }\n// @ts-nocheck\nhelper()\n' > after.ts
tsc --noEmit --strict before.ts; tsc --noEmit --strict after.ts
```

```text
== before.ts
exit 0
== after.ts
after.ts(1,29): error TS2322: Type 'string' is not assignable to type 'number'.
exit 2
```

`// @ts-expect-error` and `// @ts-ignore` apply to the next line instead, so they stay attached to the statement below them when code moves.
