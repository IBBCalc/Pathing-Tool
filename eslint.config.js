import tseslint from '@typescript-eslint/eslint-plugin';
import stylisticTs from '@stylistic/eslint-plugin-ts';
import parser from '@typescript-eslint/parser';
import importX from 'eslint-plugin-import-x';

export default [ 
    {
        name: "eslint-config",
        files: ["src/**/*.{ts,tsx,js,jsx}"],
        ignores: ["dist/*", "build/*", "coverage/*", "public/*", ".github/*", "node_modules/*", ".vscode/*"],
        languageOptions: {
            parser: parser
        },
        plugins: {
            "import-x": importX,
            '@stylistic/ts': stylisticTs,
            '@typescript-eslint': tseslint
        },
        rules: {
            "eqeqeq": "off", // Enforces the use of `===` and `!==` instead of `==` and `!=`
            "indent": "off", // Enforces a 2-space indentation, enforces indentation of `case ...:` statements
            "quotes": "off", // Enforces the use of double quotes for strings
            "no-var": "off", // Disallows the use of `var`, enforcing `let` or `const` instead
            "prefer-const": "off", // Enforces the use of `const` for variables that are never reassigned
            "no-undef": "off", // Disables the rule that disallows the use of undeclared variables (TypeScript handles this)
            "@typescript-eslint/no-unused-vars": "off",
            "eol-last": ["error", "always"], // Enforces at least one newline at the end of files
            "@stylistic/ts/semi": "off", // Requires semicolons for TypeScript-specific syntax
            "semi": "off", // Disables the general semi rule for TypeScript files
            "no-extra-semi": "off", // Disallows unnecessary semicolons for TypeScript-specific syntax
            "brace-style": "off", // Note: you must disable the base rule as it can report incorrect errors
            "curly": "off", // Enforces the use of curly braces for all control statements
            "@stylistic/ts/brace-style": ["error", "1tbs"], // Enforces the following brace style: https://eslint.style/rules/js/brace-style#_1tbs
            "no-trailing-spaces": ["error", { // Disallows trailing whitespace at the end of lines
                "skipBlankLines": false, // Enforces the rule even on blank lines
                "ignoreComments": false // Enforces the rule on lines containing comments
            }],
            "space-before-blocks": "off", // Enforces a space before blocks
            "keyword-spacing": "off", // Enforces spacing before and after keywords
            "comma-spacing": "off", // Enforces spacing after commas
            "import-x/extensions": "off", // Enforces no extension for imports unless json
            "array-bracket-spacing": "off", // Enforces consistent spacing inside array brackets
            "object-curly-spacing": "off", // Enforces consistent spacing inside braces of object literals, destructuring assignments, and import/export specifiers
            "computed-property-spacing": "off", // Enforces consistent spacing inside computed property brackets
            "space-infix-ops": "off", // Enforces spacing around infix operators
            "no-multiple-empty-lines": "off", // Disallows multiple empty lines
            "@typescript-eslint/consistent-type-imports": "off", // Enforces type-only imports wherever possible
        }
    },
    {
        name: "eslint-tests",
        files: ["src/test/**/**.test.ts"],
        languageOptions: {
            parser: parser,
            parserOptions: {
                "project": ["./tsconfig.json"]
            }
        },
        plugins: {
            "@typescript-eslint": tseslint
        },
        rules: {
            "@typescript-eslint/no-floating-promises": "error", // Require Promise-like statements to be handled appropriately. - https://typescript-eslint.io/rules/no-floating-promises/
            "@typescript-eslint/no-misused-promises": "error", // Disallow Promises in places not designed to handle them. - https://typescript-eslint.io/rules/no-misused-promises/
        }
    }
]
