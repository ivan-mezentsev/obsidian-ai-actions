import { QuickPromptManager } from "./quick-prompt-manager";
import { Location, getAvailableModelsWithPluginAIProviders } from "./action";
import type { AIEditorSettings } from "./settings";
import { Selection } from "./action";
import type { App, Editor, MarkdownView } from "obsidian";
import { ActionHandler, PromptProcessor } from "./handler";
import type AIEditor from "./main";

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

	beforeEach(() => {
		jest.clearAllMocks();

		// Mock settings
		mockSettings = {
			openAiApiKey: "test-key",
			testingMode: false,
			defaultModel: "test-model",
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
				defaultModelId: "test-model",
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

		// Mock app
		const mockApp = {
			workspace: {
				getActiveViewOfType: jest.fn().mockReturnValue(mockView),
				updateOptions: jest.fn(),
			},
		} as unknown as jest.Mocked<App>;

		// Mock plugin
		mockPlugin = {
			app: mockApp,
			settings: mockSettings,
		} as unknown as AIEditor;

		// Mock ActionHandler
		mockActionHandler = {
			getTextInput: jest.fn().mockResolvedValue("test input"),
		} as unknown as jest.Mocked<ActionHandler>;

		// Mock PromptProcessor
		mockPromptProcessor = {
			processPrompt: jest.fn().mockResolvedValue(undefined),
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
			expect(mockActionHandler.getTextInput).toHaveBeenCalledWith(
				Selection.CURSOR, // from quickPrompt settings
				mockEditor
			);

			// Verify PromptProcessor was called with correct configuration
			expect(mockPromptProcessor.processPrompt).toHaveBeenCalledWith({
				action: expect.objectContaining({
					name: "Quick Prompt",
					prompt: "Test prompt: {{input}}",
					model: "custom-model", // Should use provided modelId
					sel: Selection.CURSOR,
					loc: Location.REPLACE_CURRENT, // outputMode 'replace' maps to REPLACE_CURRENT
					format: "{{result}}",
					showModalWindow: false, // Quick prompts never show modal
				}),
				input: "test input",
				editor: mockEditor,
				view: mockView,
				app: mockPlugin.app,
				userPrompt: "Test user prompt",
				outputMode: "replace",
				plugin: mockPlugin,
			});
		});

		it("should use default model when no modelId provided", async () => {
			const userPrompt = "Test user prompt";

			await quickPromptManager["processPrompt"](userPrompt);

			expect(mockPromptProcessor.processPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						model: "test-model", // Should use default from settings
					}),
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

			expect(mockPromptProcessor.processPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						loc: Location.APPEND_CURRENT,
					}),
				})
			);
		});

		it("should always set showModalWindow to false for quick prompts", async () => {
			const userPrompt = "Test user prompt";

			await quickPromptManager["processPrompt"](userPrompt);

			expect(mockPromptProcessor.processPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expect.objectContaining({
						showModalWindow: false,
					}),
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

			expect(mockPromptProcessor.processPrompt).toHaveBeenCalledWith(
				expect.objectContaining({
					action: expectedAction,
				})
			);
		});

		it("should handle missing view gracefully", async () => {
			// Mock no active view
			(
				mockPlugin.app.workspace.getActiveViewOfType as jest.Mock
			).mockReturnValue(null);

			const userPrompt = "Test user prompt";

			// Should return early without processing
			await quickPromptManager["processPrompt"](userPrompt);

			expect(mockPromptProcessor.processPrompt).not.toHaveBeenCalled();
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
			expect(mockPromptProcessor.processPrompt).toHaveBeenCalledWith({
				action: expect.any(Object),
				input: "test input",
				editor: mockEditor,
				view: mockView,
				app: mockPlugin.app,
				userPrompt: "Custom prompt",
				outputMode: "replace",
				plugin: mockPlugin,
			});
		});
	});

	describe("behavior preservation verification", () => {
		it("should maintain quick-prompt specific behavior (no modal window)", async () => {
			const userPrompt = "Test prompt";

			await quickPromptManager["processPrompt"](userPrompt);

			// Verify showModalWindow is always false
			const callArgs = mockPromptProcessor.processPrompt.mock.calls[0][0];
			expect(callArgs.action.showModalWindow).toBe(false);
		});

		it("should maintain immediate application behavior", async () => {
			const userPrompt = "Test prompt";

			await quickPromptManager["processPrompt"](userPrompt);

			// Verify outputMode is passed to indicate immediate application
			const callArgs = mockPromptProcessor.processPrompt.mock.calls[0][0];
			expect(callArgs.outputMode).toBe("replace"); // default outputMode
		});

		it("should preserve existing model selection logic", async () => {
			// Test with custom model
			await quickPromptManager["processPrompt"]("test", "custom-model");
			let callArgs = mockPromptProcessor.processPrompt.mock.calls[0][0];
			expect(callArgs.action.model).toBe("custom-model");

			// Reset mock
			mockPromptProcessor.processPrompt.mockClear();

			// Test with default model
			await quickPromptManager["processPrompt"]("test");
			callArgs = mockPromptProcessor.processPrompt.mock.calls[0][0];
			expect(callArgs.action.model).toBe("test-model"); // from settings
		});

		it("should preserve existing output mode logic", async () => {
			// Test replace mode
			await quickPromptManager["processPrompt"](
				"test",
				undefined,
				"replace"
			);
			let callArgs = mockPromptProcessor.processPrompt.mock.calls[0][0];
			expect(callArgs.action.loc).toBe(Location.REPLACE_CURRENT);

			// Reset mock
			mockPromptProcessor.processPrompt.mockClear();

			// Test append mode
			await quickPromptManager["processPrompt"](
				"test",
				undefined,
				"append"
			);
			callArgs = mockPromptProcessor.processPrompt.mock.calls[0][0];
			expect(callArgs.action.loc).toBe(Location.APPEND_CURRENT);
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

			const callArgs = mockPromptProcessor.processPrompt.mock.calls[0][0];
			const action = callArgs.action;

			// Should preserve original settings
			expect(action.name).toBe(mockSettings.quickPrompt.name);
			expect(action.prompt).toBe(mockSettings.quickPrompt.prompt);
			expect(action.sel).toBe(mockSettings.quickPrompt.sel);
			expect(action.format).toBe(mockSettings.quickPrompt.format);
			expect(action.temperature).toBe(
				mockSettings.quickPrompt.temperature
			);
			expect(action.maxOutputTokens).toBe(
				mockSettings.quickPrompt.maxOutputTokens
			);

			// Should override specific settings
			expect(action.model).toBe("custom-model");
			expect(action.loc).toBe(Location.APPEND_CURRENT);
			expect(action.showModalWindow).toBe(false);
		});
	});

	describe("error handling preservation", () => {
		it("should handle PromptProcessor errors gracefully", async () => {
			const testError = new Error("PromptProcessor failed");
			mockPromptProcessor.processPrompt.mockRejectedValue(testError);

			// Should propagate error since we're not handling it in processPrompt
			await expect(
				quickPromptManager["processPrompt"]("test")
			).rejects.toThrow("PromptProcessor failed");
		});

		it("should handle ActionHandler errors gracefully", async () => {
			const testError = new Error("getTextInput failed");
			mockActionHandler.getTextInput.mockRejectedValue(testError);

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
