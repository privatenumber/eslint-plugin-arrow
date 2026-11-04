# Module evaluation and function declarations

In an ES module, a function declaration has its value before any module code runs, but a `const` binding has no value until its line runs. In an import cycle, another module can run first and call into this module, so converting a function declaration to a `const` arrow function can turn working code into a `ReferenceError`.

Last verified: 2026-10-31, Node.js v26.13.0, against the [ES2025 specification](https://tc39.es/ecma262/2025/).

## Mechanism

[InitializeEnvironment](https://tc39.es/ecma262/2025/#sec-source-text-module-record-initialize-environment) runs when a module is linked, before any module in the graph is evaluated. For each lexically scoped declaration it creates the binding, and only function declarations get a value at that point:

> If d is either a FunctionDeclaration, a GeneratorDeclaration, an AsyncFunctionDeclaration, or an AsyncGeneratorDeclaration, then Let fo be InstantiateFunctionObject of d with arguments env and privateEnv. Perform ! env.InitializeBinding(dn, fo).

A `const` binding is created by the same loop but stays uninitialized until evaluation reaches it. Reading it before that throws.

## Experiment

The modules are served from memory by a `module.register()` hook, so no files are written. Module `a` imports `b` first, so `b` runs before the rest of `a` and calls `f()` from `a`. The only difference between the two variants is whether `helper` is a declaration or a `const`; `f` stays an exported function declaration in both.

<!-- eslint-skip -->
```js
import { register } from 'node:module';
const hooks = `
const src = {
  'mem:a-decl': "import 'mem:b-decl'; function helper() { return 'ok' } export function f() { return helper() }",
  'mem:b-decl': "import { f } from 'mem:a-decl'; console.log('declaration helper:', f())",
  'mem:a-const': "import 'mem:b-const'; const helper = () => 'ok'; export function f() { return helper() }",
  'mem:b-const': "import { f } from 'mem:a-const'; try { console.log(f()) } catch (e) { console.log('const helper:', e.constructor.name + ': ' + e.message) }",
};
export async function resolve(s, c, next) { return s in src ? { url: s, shortCircuit: true } : next(s, c) }
export async function load(u, c, next) { return u in src ? { format: 'module', source: src[u], shortCircuit: true } : next(u, c) }
`;
register('data:text/javascript,' + encodeURIComponent(hooks));
await import('mem:a-decl');
await import('mem:a-const');
```

```text
declaration helper: ok
const helper: ReferenceError: Cannot access 'helper' before initialization
```

Node.js also printed a `DEP0205` warning that `module.register()` is deprecated in favor of `module.registerHooks()`. The warning does not affect the result.

## Export lists do not read the binding

`export { name }` only links an export name to a binding, so it can come before a `const` declaration. `export default name` evaluates `name` when the module runs, so it cannot.

Tested 2026-10-31 with Node.js v26.13.0, running `node --input-type=module -`:

<!-- eslint-skip -->
```js
const { parse } = await import('data:text/javascript,' + encodeURIComponent("export { parse }\nconst parse = () => 'ok'"));
console.log('export list above const:', parse());
try { await import('data:text/javascript,' + encodeURIComponent("export default parse\nconst parse = () => 'ok'")) } catch (e) { console.log('export default above const:', e.constructor.name + ': ' + e.message) }
```

```text
export list above const: ok
export default above const: ReferenceError: Cannot access 'parse' before initialization
```

So `prefer-arrow-functions` converts a function that only an earlier `export { name }` uses, and still skips one that an earlier `export default name` uses.

## Bundling keeps the failure

Bundlers concatenate modules into one scope, but they keep each declaration's kind, so the cycle fails the same way after bundling. esbuild changes the error, which makes the cause harder to find.

Tested 2026-10-31 with esbuild 0.28.2 and Rollup 4.65.0, both bundling in memory with a plugin that serves the modules, then running the output with Node.js v26.13.0. The script ran from the repository root with `node --input-type=module -`, using the copies that `pkgroll` installs:

<!-- eslint-skip -->
```js
const esbuild = await import(process.cwd() + '/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js');
const { rollup } = await import(process.cwd() + '/node_modules/.pnpm/rollup@4.65.0/node_modules/rollup/dist/es/rollup.js');

const variants = {
  declaration: "function helper() { return 'ok' }",
  const: "const helper = () => 'ok'",
};
const modules = (helper) => ({
  entry: "import './a'",
  a: `import './b'; ${helper}; export function f() { return helper() }`,
  b: "import { f } from './a'; try { console.log('  result:', f()) } catch (e) { console.log('  result:', e.constructor.name + ': ' + e.message) }",
});
const run = async (code) => { await import('data:text/javascript,' + encodeURIComponent(code)) };

for (const [label, helper] of Object.entries(variants)) {
  const src = modules(helper);
  const name = id => id.replace(/^\.\//, '').replace(/^virtual:/, '');

  const built = await esbuild.build({
    entryPoints: ['virtual:entry'], bundle: true, write: false, format: 'esm', logLevel: 'silent',
    plugins: [{ name: 'v', setup(b) {
      b.onResolve({ filter: /.*/ }, a => ({ path: name(a.path), namespace: 'v' }));
      b.onLoad({ filter: /.*/, namespace: 'v' }, a => ({ contents: src[a.path], loader: 'js' }));
    } }],
  });
  const esOut = built.outputFiles[0].text;
  console.log(`esbuild, helper as ${label}: helper compiled to`, JSON.stringify(esOut.match(/(var|const|let|function) helper[^\n]*/)?.[0]));
  await run(esOut);

  const bundle = await rollup({ input: 'entry', onwarn() {}, plugins: [{ name: 'v', resolveId: id => name(id), load: id => src[id] }] });
  const { output } = await bundle.generate({ format: 'es' });
  console.log(`rollup, helper as ${label}: helper compiled to`, JSON.stringify(output[0].code.match(/(var|const|let|function) helper[^\n]*/)?.[0]));
  await run(output[0].code);
}
```

```text
esbuild, helper as declaration: helper compiled to "function helper() {"
  result: ok
rollup, helper as declaration: helper compiled to "function helper() { return 'ok' } function f() { return helper() }"
  result: ok
esbuild, helper as const: helper compiled to "var helper = () => \"ok\";"
  result: TypeError: helper is not a function
rollup, helper as const: helper compiled to "const helper = () => 'ok'; function f() { return helper() }"
  result: ReferenceError: Cannot access 'helper' before initialization
```

- Rollup keeps the `const`, so the bundle throws the same `ReferenceError` as the unbundled modules.
- esbuild rewrites the top-level `const` to `var`. The binding exists but is `undefined` when `f()` runs, so the error says that `helper` is not a function instead of naming the initialization order.

## Consequence

Keeping exported functions as declarations does not make a module safe for cycles. Every function that the exported function reaches during the early call must also be a declaration. In this experiment, the exported `f` stayed a declaration and the call still failed, because `helper` was a `const`. Bundling does not change this. [prefer-arrow-functions-options.md](../eslint-plugin-arrow/prefer-arrow-functions-options.md#removed-exportedfunctiondeclarations) explains why the rule has no option for it.
