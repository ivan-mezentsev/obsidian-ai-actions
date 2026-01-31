import { QuickPromptManager } from "./quick-prompt-manager";
import { Location, Selection } from "./action";
import type { AIEditorSettings } from "./settings";
import { ActionHandler, PromptProcessor } from "./handler";
import type AIEditor from "./main";
import type { App, Editor, MarkdownView } from "obsidian";

// Mocks to avoid importing real main/obsidian
jest.mock("./handler");
jest.mock("./action");
jest.mock("./main", () => ({
	default: class MockAIEditor {},
}));
jest.mock("./spinnerPlugin", () => ({
	spinnerPlugin: jest.fn(),
}));
jest.mock("@obsidian-ai-providers/sdk", () => ({
	waitForAI: jest.fn(),
}));
jest.mock("obsidian", () => ({
	Notice: jest.fn(),
	MarkdownView: jest.fn(),
	App: jest.fn(),
}));

describe("QuickPromptManager — inputSource wiring", () => {
	let quickPromptManager: QuickPromptManager;
	let mockPlugin: AIEditor;
	let mockSettings: AIEditorSettings;
	let mockEditor: jest.Mocked<Editor>;
	let mockView: jest.Mocked<MarkdownView>;
	let mockPromptProcessor: jest.Mocked<PromptProcessor>;
	let mockActionHandler: jest.Mocked<ActionHandler>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockSettings = {
			customActions: [],
			quickPrompt: {
				name: "Quick Prompt",
				prompt: "{{input}}",
				model: "m",
				sel: Selection.CURSOR,
				loc: Location.REPLACE_CURRENT,
				format: "{{result}}",
				temperature: 0.1,
				maxOutputTokens: 100,
			},
			aiProviders: { providers: [], models: [] },
			useNativeFetch: true,
			developmentMode: false,
		} as unknown as AIEditorSettings;

		mockEditor = {
			getSelection: jest.fn().mockReturnValue("sel"),
			getValue: jest.fn().mockReturnValue("all"),
			getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
			focus: jest.fn(),
			replaceRange: jest.fn(),
			replaceSelection: jest.fn(),
			setCursor: jest.fn(),
			lastLine: jest.fn().mockReturnValue(1),
			posToOffset: jest.fn().mockReturnValue(0),
		} as unknown as jest.Mocked<Editor>;

		mockView = {
			editor: mockEditor,
		} as unknown as jest.Mocked<MarkdownView>;

		const mockApp = {
			workspace: {
				getActiveViewOfType: jest.fn().mockReturnValue(mockView),
			},
		} as unknown as jest.Mocked<App>;

		mockPromptProcessor = {
			processPrompt: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<PromptProcessor>;

		mockActionHandler = {
			getTextInput: jest.fn().mockResolvedValue("in"),
		} as unknown as jest.Mocked<ActionHandler>;

		(mockPromptProcessor.processPrompt as unknown as jest.Mock).mockName(
			"processPrompt"
		);

		(ActionHandler as jest.Mock).mockImplementation(
			() => mockActionHandler
		);
		(PromptProcessor as jest.Mock).mockImplementation(
			() => mockPromptProcessor
		);

		mockPlugin = {
			app: mockApp,
			settings: mockSettings,
		} as unknown as AIEditor;
		quickPromptManager = new QuickPromptManager(mockPlugin);
	});

	const callProcess = async (inputSource: "CURSOR" | "CLIPBOARD" | "ALL") => {
		// @ts-expect-error accessing private method for test
		await quickPromptManager.processPrompt(
			"p",
			"m",
			"replace",
			inputSource
		);

		const processPromptMock =
			mockPromptProcessor.processPrompt as jest.MockedFunction<
				PromptProcessor["processPrompt"]
			>;
		const firstCall = processPromptMock.mock.calls[0];
		if (!firstCall) {
			throw new Error("Expected processPrompt to be called");
		}
		return firstCall[0];
	};

	it("maps CURSOR to Selection.CURSOR and calls getTextInput accordingly", async () => {
		const args = await callProcess("CURSOR");
		expect(mockActionHandler.getTextInput).toHaveBeenCalledWith(
			Selection.CURSOR,
			mockEditor
		);
		expect(args.action.sel).toBe(Selection.CURSOR);
	});

	it("maps CLIPBOARD to Selection.CLIPBOARD and calls getTextInput accordingly", async () => {
		const args = await callProcess("CLIPBOARD");
		expect(mockActionHandler.getTextInput).toHaveBeenCalledWith(
			Selection.CLIPBOARD,
			mockEditor
		);
		expect(args.action.sel).toBe(Selection.CLIPBOARD);
	});

	it("maps ALL to Selection.ALL and calls getTextInput accordingly", async () => {
		const args = await callProcess("ALL");
		expect(mockActionHandler.getTextInput).toHaveBeenCalledWith(
			Selection.ALL,
			mockEditor
		);
		expect(args.action.sel).toBe(Selection.ALL);
	});
});
