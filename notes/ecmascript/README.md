# ECMAScript

Language semantics that decide whether a `function` can become an arrow function without changing behavior.

- [class-fields.md](./class-fields.md): how an arrow function class field differs from a method, with runtime experiments.
- [sloppy-mode-and-scripts.md](./sloppy-mode-and-scripts.md): four rules for sloppy code, scripts, and `__proto__` where a `function` and a `const` arrow function differ, with runtime experiments.
- [module-evaluation.md](./module-evaluation.md): why a function declaration works in an import cycle where a `const` throws.
- [function-properties.md](./function-properties.md): which function properties differ between a `function`, an arrow function, and methods, measured in V8 and JavaScriptCore.
