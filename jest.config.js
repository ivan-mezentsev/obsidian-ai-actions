module.exports = {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	moduleNameMapper: {
		"^svelte$": "<rootDir>/__mocks__/svelte.js",
		"\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
		"\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
			"<rootDir>/__mocks__/fileMock.js",
		"\\.svelte$": "<rootDir>/__mocks__/svelteMock.js",
		"^obsidian$": "<rootDir>/__mocks__/obsidian.ts",
		"^@google/genai$": "<rootDir>/__mocks__/google-genai.ts",
		"^openai$": "<rootDir>/__mocks__/openai.ts",
	},
	setupFiles: ["<rootDir>/jest.setup.js"],
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "/references/"],
	modulePathIgnorePatterns: ["/references/"],
	transform: {
		"^.+\\.(ts|tsx|js|jsx)$": "ts-jest",
	},
	transformIgnorePatterns: ["node_modules/(?!(@google/genai)/)"],
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
