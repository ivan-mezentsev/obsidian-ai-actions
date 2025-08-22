import { QuickPromptManager } from "./quick-prompt-manager";
import type AIEditor from "./main";
import type { App, Editor, MarkdownView } from "obsidian";
import type { AIEditorSettings } from "./settings";
import { ActionHandler, PromptProcessor } from "./handler";
import { Location, Selection } from "./action";

// Mocks
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

describe("QuickPrompt autoselection and submit", () => {
	let quickPromptManager: QuickPromptManager;
	let mockPlugin: AIEditor;
	let mockSettings: AIEditorSettings;
	let mockEditor: jest.Mocked<Editor>;
	let mockView: jest.Mocked<MarkdownView>;
	let mockPromptProcessor: jest.Mocked<PromptProcessor>;
	let mockActionHandler: jest.Mocked<ActionHandler>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Settings with empty default model
		mockSettings = {
			customActions: [],
			quickPrompt: {
				name: "Quick Prompt",
				prompt: "{{input}}",
				model: "", // defaultModelId empty per scenario
				sel: Selection.CURSOR,
				loc: Location.REPLACE_CURRENT,
				format: "{{result}}",
				temperature: 0.1,
				maxOutputTokens: 100,
			},
			aiProviders: {
				providers: [{ id: "p1", name: "P1", type: "openai" }],
				models: [], // not used directly by QuickPromptBox autoload
			},
			useNativeFetch: true,
			developmentMode: false,
		} as unknown as AIEditorSettings;

		mockEditor = {
			getSelection: jest.fn().mockReturnValue(""),
			getValue: jest.fn().mockReturnValue(""),
			getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
			focus: jest.fn(),
			replaceRange: jest.fn(),
			replaceSelection: jest.fn(),
			setCursor: jest.fn(),
			lastLine: jest.fn().mockReturnValue(0),
			posToOffset: jest.fn().mockReturnValue(0),
		} as unknown as jest.Mocked<Editor>;

		mockView = {
			editor: mockEditor,
			containerEl: document.body as unknown as HTMLElement,
			contentEl: document.body as unknown as HTMLElement,
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

		(ActionHandler as unknown as jest.Mock).mockImplementation(
			() => mockActionHandler
		);
		(PromptProcessor as unknown as jest.Mock).mockImplementation(
			() => mockPromptProcessor
		);

		mockPlugin = {
			app: mockApp,
			settings: mockSettings,
			registerDomEvent: jest.fn(),
		} as unknown as AIEditor;

		quickPromptManager = new QuickPromptManager(mockPlugin);
	});

	it("submits with non-empty model id after first show (autoselect implied)", async () => {
		// Given: defaultModelId is empty and models would be loaded (autoselect to first happens in component).
		const promptBox = quickPromptManager.getPromptBox();

		// Prepare prompt and simulate that component chose first model "m1"
		(
			promptBox as unknown as { $set: (p: { prompt: string }) => void }
		).$set({
			prompt: "hello",
		});

		// Fire submit event from the mocked Svelte component
		type SubmitHandler = (
			e: CustomEvent<{
				prompt: string;
				modelId: string;
				outputMode: string;
				inputSource: string;
			}>
		) => void;
		const submitHandler = (
			promptBox as unknown as {
				eventHandlers: Record<string, SubmitHandler>;
			}
		).eventHandlers["submit"];
		expect(typeof submitHandler).toBe("function");
		submitHandler(
			new CustomEvent("submit", {
				detail: {
					prompt: "hello",
					modelId: "m1", // implies autoselected first model
					outputMode: "replace",
					inputSource: "CURSOR",
				},
			})
		);

		// Wait for async logic inside manager
		await new Promise(resolve => setTimeout(resolve, 0));

		// Then: processor was called with this model id
		const callArgs = (mockPromptProcessor.processPrompt as jest.Mock).mock
			.calls[0][0];
		expect(callArgs.action.model).toBe("m1");
		expect(callArgs.userPrompt).toBe("hello");
	});
});
