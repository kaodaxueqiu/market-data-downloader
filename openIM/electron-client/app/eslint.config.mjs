import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginPrettier from "eslint-plugin-prettier";
import pluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "dist-electron/**",
            "build/**",
            "src/utils/**",
            "*.config.js",
            "*.config.ts",
            "vite.config.ts",
            "tailwind.config.js",
            "postcss.config.js",
        ],
    },

    // Base config for all files
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
            },
        },
    },

    // TypeScript files
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({
        ...config,
        files: ["src/**/*.{ts,tsx}"],
    })),

    // TypeScript parser options
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // React configuration
    {
        files: ["src/**/*.{jsx,tsx}"],
        plugins: {
            react: pluginReact,
            "react-hooks": pluginReactHooks,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            ...pluginReact.configs.recommended.rules,
            ...pluginReact.configs["jsx-runtime"].rules,
            ...pluginReactHooks.configs.recommended.rules,
            "react/display-name": "off",
            "react/no-danger-with-children": "warn",
            "react-hooks/exhaustive-deps": "warn",

        },
    },

    // Prettier integration
    {
        files: ["src/**/*.{js,jsx,ts,tsx}"],
        plugins: {
            prettier: pluginPrettier,
        },
        rules: {
            "prettier/prettier": "error",
        },
    },

    // Import sorting
    {
        files: ["src/**/*.{js,jsx,ts,tsx}"],
        plugins: {
            "simple-import-sort": pluginSimpleImportSort,
        },
        rules: {
            "simple-import-sort/imports": "error",
            "simple-import-sort/exports": "error",
        },
    },

    // Custom rules for all source files
    {
        files: ["src/**/*.{js,jsx,ts,tsx}"],
        rules: {
            // General rules
            eqeqeq: "error",
            "no-else-return": "error",
            "no-implicit-coercion": ["error", { disallowTemplateShorthand: true }],
            "no-unneeded-ternary": "error",
            "no-useless-call": "error",
            "no-useless-computed-key": "error",
            "no-useless-concat": "error",
            "prefer-arrow-callback": "error",
            "prefer-const": "error",
            "prefer-rest-params": "error",
            "prefer-spread": "error",
            "prefer-template": "error",
            radix: ["error", "always"],

            // TypeScript specific
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-misused-promises": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },

    // Prettier config (must be last to override other formatting rules)
    eslintConfigPrettier,
);
