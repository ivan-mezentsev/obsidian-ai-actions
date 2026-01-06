import obsidianmd from "eslint-plugin-obsidianmd";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";
import globals from "globals";

function flattenObsidianRecommendedConfig(configs) {
	const flattened = [];
	for (const cfg of configs) {
		if (cfg && typeof cfg === "object" && "extends" in cfg && cfg.extends) {
			const { extends: ext, ...rest } = cfg;
			const extArray = Array.isArray(ext) ? ext : [ext];
			const fileGlobs = rest.files;
			for (const item of extArray) {
				const items = Array.isArray(item) ? item : [item];
				for (const extCfg of items) {
					if (fileGlobs) {
						flattened.push({ ...extCfg, files: fileGlobs });
					} else {
						flattened.push(extCfg);
					}
				}
			}
			flattened.push(rest);
		} else {
			flattened.push(cfg);
		}
	}
	return flattened;
}

const obsidianRecommended = flattenObsidianRecommendedConfig([
	...obsidianmd.configs.recommended,
]);

export default [
	// Obsidian's official lint ruleset (mirrors the community-plugin bot checks)
	...obsidianRecommended,
	// The obsidianmd recommended ruleset enables type-aware @typescript-eslint rules.
	// Provide parserOptions so those rules can access TypeScript type information.
	{
		files: [
			"**/*.ts",
			"**/*.tsx",
			"**/*.js",
			"**/*.jsx",
			"**/*.cjs",
			"**/*.mjs",
		],
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"*.js",
						"*.jsx",
						"*.cjs",
						"*.mjs",
						"__mocks__/*.js",
						"__mocks__/*.jsx",
						"__mocks__/*.cjs",
						"__mocks__/*.mjs",
						"src/*.test.ts",
						"src/*/*.test.ts",
					],
					defaultProject: "tsconfig.json",
					maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 50,
				},
				tsconfigRootDir: process.cwd(),
			},
		},
	},
	{
		files: [
			"**/*.ts",
			"**/*.tsx",
			"**/*.js",
			"**/*.jsx",
			"**/*.cjs",
			"**/*.mjs",
		],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	// Keep Prettier enforcement (formatting as errors)
	{
		plugins: {
			prettier: eslintPluginPrettier,
		},
		rules: {
			"prettier/prettier": "error",
		},
	},
	// Prettier integration - must be last to override conflicting rules
	eslintConfigPrettier,
	// Jest test files configuration
	{
		files: [
			"**/*.test.ts",
			"**/*.test.js",
			"__mocks__/**/*.ts",
			"__mocks__/**/*.js",
		],
		languageOptions: {
			globals: {
				jest: "readonly",
				describe: "readonly",
				test: "readonly",
				it: "readonly",
				expect: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
				beforeAll: "readonly",
				afterAll: "readonly",
				navigator: "readonly",
			},
		},
	},
	// Node.js files configuration
	{
		files: ["**/*.js", "__mocks__/**/*.js"],
		languageOptions: {
			globals: {
				module: "readonly",
				require: "readonly",
				exports: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				global: "readonly",
				process: "readonly",
				Buffer: "readonly",
				navigator: "readonly",
			},
		},
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
	// Mock files configuration - relaxed rules for test mocks
	{
		files: ["__mocks__/**/*.ts", "__mocks__/**/*.js"],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "off",
			"no-unused-vars": "off",
		},
	},
	{
		ignores: [
			"node_modules/",
			"main.js",
			"dist/",
			"references/",
			"version-bump.mjs",
			"**/jest.*",
		],
	},
];
