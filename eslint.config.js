// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  {
    ignores: ['dist/**', '.angular/**', 'coverage/**', 'out-tsc/**'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      // --- Selectors
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // --- Angular conventions
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
      // Severity upgrade: tsRecommended ships this as 'warn'; we treat it as 'error'.
      '@angular-eslint/use-lifecycle-interface': 'error',
      '@angular-eslint/component-class-suffix': 'error',
      '@angular-eslint/directive-class-suffix': 'error',
      // Our `$name` → alias `name` pattern deliberately renames inputs and outputs
      // so templates bind the clean name (see docs/conventions.md §2.5). Disable
      // the rules that would otherwise flag every aliased `input()` / `output()`.
      '@angular-eslint/no-input-rename': 'off',
      '@angular-eslint/no-output-rename': 'off',

      // --- Restricted syntax:
      //     1. No TS enums — use `as const satisfies ...` (see docs/conventions.md §1.1)
      //     2. No TS `private` modifier — use ECMAScript `#field` (see docs/conventions.md §1.8)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            "Don't use enums. Prefer `const X = [...] as const satisfies ...` — see docs/conventions.md §1.1.",
        },
        {
          selector:
            'PropertyDefinition[accessibility="private"], MethodDefinition[accessibility="private"], TSParameterProperty[accessibility="private"]',
          message:
            "Don't use the TypeScript `private` modifier. Use ECMAScript `#field` for true runtime privacy — see docs/conventions.md §1.8.",
        },
      ],

      // --- Explicit return types on every function (allow inline arrow callbacks to infer)
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // --- Readonly-first (field-level — parameter / local readonly-ness is enforced via code review)
      '@typescript-eslint/prefer-readonly': 'error',

      // --- Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        // Allow `_` prefix on intentionally-unused parameters and locals (matches the
        // `argsIgnorePattern: '^_'` exemption in `no-unused-vars`).
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: ['variable', 'parameter'], modifiers: ['unused'], format: null },
        // Allow `$prefix` (signals) and `suffix$` (observables) per docs/conventions.md.
        // Cannot *require* the prefix/suffix here because naming-convention's `types` filter
        // is limited to string/number/boolean/array/function — enforcement is code review.
        {
          selector: 'variableLike',
          format: null,
          filter: { regex: '(^\\$|\\$$)', match: true },
        },
        // Object literal keys are often host metadata (`[class]`, `(click)`), HTML attribute
        // names (`aria-hidden`), or config-object dictionaries keyed by arbitrary strings.
        // Format checks create friction without real value here.
        { selector: 'objectLiteralProperty', format: null },
      ],

      // --- Other TS hygiene
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // --- NGXS interop
      // NGXS groups action classes under a TS `namespace` (see docs/conventions.md §3),
      // and exposes selectors as `static` methods on state classes that get passed by
      // reference to `Store.selectSignal` / `Store.selectSnapshot`. Both patterns are
      // safe (no `this`-binding, namespaces collapse to a single object) but trip the
      // typescript-eslint defaults — relax both.
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
      '@angular-eslint/template/prefer-ngsrc': 'warn',
    },
  },
  prettier,
]);
