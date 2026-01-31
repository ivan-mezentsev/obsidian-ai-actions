import { QuickPromptManager } from "./quick-prompt-manager";
import { Location, getAvailableModelsWithPluginAIProviders } from "./action";
import type { AIEditorSettings } from "./settings";
import { Selection } from "./action";
import type { App, Editor, MarkdownView } from "obsidian";
import { ActionHandler, type PromptConfig, PromptProcessor } from "./handler";
import type AIEditor from "./main";
import type { InputSource } from "./utils/inputSource";

// Mock dependencies
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

describe("QuickPromptManager Integration Tests", () => {
	let quickPromptManager: QuickPromptManager;
	let mockPlugin: AIEditor;
	let mockSettings: AIEditorSettings;
	let mockEditor: jest.Mocked<Editor>;
	let mockView: jest.Mocked<MarkdownView>;
	let mockPromptProcessor: jest.Mocked<PromptProcessor>;
	let mockActionHandler: jest.Mocked<ActionHandler>;
	let getTextInputMock: jest.MockedFunction<
		(selection: Selection, editor: Editor) => Promise<string>
	>;
	let getActiveViewOfTypeMock: jest.MockedFunction<
		(type: unknown) => MarkdownView | null
	>;
	let processPromptMock: jest.MockedFunction<
		(config: PromptConfig) => Promise<void>
	>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock settings
		mockSettings = {
			customActions: [],
			quickPrompt: {
				name: "Quick Prompt",
				prompt: "Test prompt: {{input}}",
				model: "test-model",
				sel: Selection.CURSOR,
				loc: Location.REPLACE_CURRENT,
				format: "{{result}}",
				temperature: 0.7,
				maxOutputTokens: 1000,
			},
			aiProviders: {
				providers: [
					{ id: "provider1", name: "Test Provider", type: "openai" },
				],
				models: [
					{
						id: "test-model",
						name: "Test Model",
						providerId: "provider1",
						modelName: "test-model",
					},
				],
			},
			useNativeFetch: false,
			developmentMode: false,
		} as AIEditorSettings;

		// Mock editor
		mockEditor = {
			getSelection: jest.fn().mockReturnValue("selected text"),
			getValue: jest.fn().mockReturnValue("full text"),
			getCursor: jest
				.fn()
				.mockReturnValueOnce({ line: 0, ch: 0 }) // from
				.mockReturnValueOnce({ line: 0, ch: 10 }), // to
			focus: jest.fn(),
			replaceRange: jest.fn(),
			replaceSelection: jest.fn(),
			setCursor: jest.fn(),
			lastLine: jest.fn().mockReturnValue(10),
			posToOffset: jest.fn().mockReturnValue(100),
		} as unknown as jest.Mocked<Editor>;

		// Mock view
		mockView = {
			editor: mockEditor,
			file: {
				vault: {
					append: jest.fn(),
					create: jest.fn(),
					getAbstractFileByPath: jest.fn(),
				},
			},
		} as unknown as jest.Mocked<MarkdownView>;

		getActiveViewOfTypeMock = jest
			.fn<MarkdownView | null, [unknown]>()
			.mockReturnValue(mockView);

		// Mock app
		const mockApp = {
			workspace: {
				getActiveViewOfType: getActiveViewOfTypeMock,
				updateOptions: jest.fn(),
			},
		} as unknown as jest.Mocked<App>;

		// Mock plugin
		mockPlugin = {
			app: mockApp,
			settings: mockSettings,
		} as unknown as AIEditor;

		getTextInputMock = jest.fn<Promise<string>, [Selection, Editor]>();
		getTextInputMock.mockResolvedValue("test input");

		// Mock ActionHandler
		mockActionHandler = {
			getTextInput: getTextInputMock,
		} as unknown as jest.Mocked<ActionHandler>;

		// Mock PromptProcessor
		processPromptMock = jest
			.fn<Promise<void>, [PromptConfig]>()
			.mockResolvedValue(undefined);
		mockPromptProcessor = {
			processPrompt: processPromptMock,
		} as unknown as jest.Mocked<PromptProcessor>;

		// Mock the constructors
		(ActionHandler as jest.Mock).mockImplementation(
			() => mockActionHandler
		);
		(PromptProcessor as jest.Mock).mockImplementation(
			() => mockPromptProcessor
		);

		// Mock getAvailableModelsWithPluginAIProviders
		(
			getAvailableModelsWithPluginAIProviders as jest.MockedFunction<
				typeof getAvailableModelsWithPluginAIProviders
			>
		).mockResolvedValue([
			{
				id: "test-model",
				name: "Test Model",
				providerId: "provider1",
				modelName: "test-model",
			},
		]);

		quickPromptManager = new QuickPromptManager(mockPlugin);
	});

	describe("processPrompt method refactoring", () => {
		it("should delegate to PromptProcessor with correct configuration", async () => {
			const userPrompt = "Test user prompt";
			const modelId = "custom-model";
			const outputMode = "replace";

			await quickPromptManager["processPrompt"](
				userPrompt,
				modelId,
				outputMode
			);

			// Verify ActionHandler was created with correct settings
			expect(getTextInputMock).toHaveBeenCalledWith(
				Selection.CURSOR, // from quickPrompt settings
				mockEditor
			);

			// Verify PromptProcessor was called with correct configuration
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						name: "Quick Prompt",
						prompt: "Test prompt: {{input}}",
						model: "custom-model", // Should use provided modelId
						sel: Selection.CURSOR,
						loc: Location.REPLACE_CURRENT, // outputMode 'replace' maps to REPLACE_CURRENT
						format: "{{result}}",
						showModalWindow: false, // Quick prompts never show modal
					}) as unknown as PromptConfig["action"],
					input: "test input",
					editor: mockEditor,
					view: mockView,
					app: mockPlugin.app,
					userPrompt: "Test user prompt",
					outputMode: "replace",
					plugin: mockPlugin,
				})
			);
		});

		it("should use default model when no modelId provided", async () => {
			const userPrompt = "Test user prompt";

			await quickPromptManager["processPrompt"](userPrompt);

			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						model: "test-model", // Should use default from settings
					}) as unknown as PromptConfig["action"],
				})
			);
		});

		it('should map outputMode "append" to APPEND_CURRENT location', async () => {
			const userPrompt = "Test user prompt";
			const outputMode = "append";

			await quickPromptManager["processPrompt"](
				userPrompt,
				undefined,
				outputMode
			);

			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						loc: Location.APPEND_CURRENT,
					}) as unknown as PromptConfig["action"],
				})
			);
		});

		it("should always set showModalWindow to false for quick prompts", async () => {
			const userPrompt = "Test user prompt";

			await quickPromptManager["processPrompt"](userPrompt);

			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						showModalWindow: false,
					}) as unknown as PromptConfig["action"],
				})
			);
		});

		it("should preserve existing model selection and output mode logic", async () => {
			const userPrompt = "Test user prompt";
			const modelId = "different-model";
			const outputMode = "append";

			await quickPromptManager["processPrompt"](
				userPrompt,
				modelId,
				outputMode
			);

			// Verify the action configuration preserves original logic
			const expectedAction = {
				...mockSettings.quickPrompt,
				model: "different-model", // Should use provided modelId
				loc: Location.APPEND_CURRENT, // Should map append to APPEND_CURRENT
				showModalWindow: false, // Should always be false for quick prompts
			};

			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expectedAction,
				})
			);
		});

		it("should handle missing view gracefully", async () => {
			// Mock no active view
			getActiveViewOfTypeMock.mockReturnValue(null);

			const userPrompt = "Test user prompt";

			// Should return early without processing
			await quickPromptManager["processPrompt"](userPrompt);

			expect(processPromptMock).not.toHaveBeenCalled();
		});

		it("should pass all required parameters to PromptProcessor", async () => {
			const userPrompt = "Custom prompt";
			const modelId = "custom-model";
			const outputMode = "replace";

			await quickPromptManager["processPrompt"](
				userPrompt,
				modelId,
				outputMode
			);

			// Verify all required parameters are passed
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.any(
						Object
					) as unknown as PromptConfig["action"],
					input: "test input",
					editor: mockEditor,
					view: mockView,
					app: mockPlugin.app,
					userPrompt: "Custom prompt",
					outputMode: "replace",
					plugin: mockPlugin,
				})
			);
		});
	});

	describe("inputSource mapping integration", () => {
		it("should map inputSource=CLIPBOARD to Selection.CLIPBOARD and call getTextInput with it", async () => {
			await quickPromptManager["processPrompt"](
				"Test prompt",
				"test-model",
				"replace",
				"CLIPBOARD" as InputSource
			);

			expect(getTextInputMock).toHaveBeenCalledWith(
				Selection.CLIPBOARD,
				mockEditor
			);
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						sel: Selection.CLIPBOARD,
					}) as unknown as PromptConfig["action"],
				})
			);
		});

		it("should map inputSource=ALL to Selection.ALL and call getTextInput with it", async () => {
			await quickPromptManager["processPrompt"](
				"Test prompt",
				"test-model",
				"append",
				"ALL" as InputSource
			);

			expect(getTextInputMock).toHaveBeenCalledWith(
				Selection.ALL,
				mockEditor
			);
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						sel: Selection.ALL,
					}) as unknown as PromptConfig["action"],
				})
			);
		});
	});

	describe("behavior preservation verification", () => {
		it("should maintain quick-prompt specific behavior (no modal window)", async () => {
			const userPrompt = "Test prompt";

			await quickPromptManager["processPrompt"](userPrompt);
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						showModalWindow: false,
					}) as unknown as PromptConfig["action"],
				})
			);
		});

		it("should maintain immediate application behavior", async () => {
			const userPrompt = "Test prompt";

			await quickPromptManager["processPrompt"](userPrompt);
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					outputMode: "replace", // default outputMode
				})
			);
		});

		it("should preserve existing model selection logic", async () => {
			// Test with custom model
			await quickPromptManager["processPrompt"]("test", "custom-model");
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						model: "custom-model",
					}) as unknown as PromptConfig["action"],
				})
			);

			// Reset mock
			processPromptMock.mockClear();

			// Test with default model
			await quickPromptManager["processPrompt"]("test");
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						model: "test-model", // from settings
					}) as unknown as PromptConfig["action"],
				})
			);
		});

		it("should preserve existing output mode logic", async () => {
			// Test replace mode
			await quickPromptManager["processPrompt"](
				"test",
				undefined,
				"replace"
			);
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						loc: Location.REPLACE_CURRENT,
					}) as unknown as PromptConfig["action"],
				})
			);

			// Reset mock
			processPromptMock.mockClear();

			// Test append mode
			await quickPromptManager["processPrompt"](
				"test",
				undefined,
				"append"
			);
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						loc: Location.APPEND_CURRENT,
					}) as unknown as PromptConfig["action"],
				})
			);
		});

		it("should maintain all original quickPrompt settings except overridden ones", async () => {
			const userPrompt = "Test prompt";
			const modelId = "custom-model";
			const outputMode = "append";

			await quickPromptManager["processPrompt"](
				userPrompt,
				modelId,
				outputMode
			);
			expect(processPromptMock).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						// Should preserve original settings
						name: mockSettings.quickPrompt.name,
						prompt: mockSettings.quickPrompt.prompt,
						sel: mockSettings.quickPrompt.sel,
						format: mockSettings.quickPrompt.format,
						temperature: mockSettings.quickPrompt.temperature,
						maxOutputTokens:
							mockSettings.quickPrompt.maxOutputTokens,

						// Should override specific settings
						model: "custom-model",
						loc: Location.APPEND_CURRENT,
						showModalWindow: false,
					}) as unknown as PromptConfig["action"],
				})
			);
		});
	});

	describe("error handling preservation", () => {
		it("should handle PromptProcessor errors gracefully", async () => {
			const testError = new Error("PromptProcessor failed");
			processPromptMock.mockRejectedValue(testError);

			// Should propagate error since we're not handling it in processPrompt
			await expect(
				quickPromptManager["processPrompt"]("test")
			).rejects.toThrow("PromptProcessor failed");
		});

		it("should handle ActionHandler errors gracefully", async () => {
			const testError = new Error("getTextInput failed");
			getTextInputMock.mockRejectedValue(testError);

			// Should propagate error since it happens before PromptProcessor delegation
			await expect(
				quickPromptManager["processPrompt"]("test")
			).rejects.toThrow("getTextInput failed");
		});
	});

	describe("integration with existing UI management", () => {
		it("should not interfere with existing UI management methods", () => {
			// Verify that UI management methods are still available and unchanged
			expect(typeof quickPromptManager.getPromptBox).toBe("function");
			expect(typeof quickPromptManager.showQuickPrompt).toBe("function");
			expect(typeof quickPromptManager.destroy).toBe("function");
			expect(typeof quickPromptManager["hideAllPromptBoxes"]).toBe(
				"function"
			);
			expect(typeof quickPromptManager["positionPromptBox"]).toBe(
				"function"
			);
			expect(typeof quickPromptManager["registerPromptBoxEvents"]).toBe(
				"function"
			);
		});

		it("should maintain prompt box cache functionality", () => {
			expect(quickPromptManager.promptBoxCache).toBeInstanceOf(Map);
			expect(quickPromptManager.promptBoxCache.size).toBe(0);
		});
	});
});
