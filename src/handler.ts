import { App, Editor, MarkdownView, Notice, TFile, Vault } from "obsidian";
import { LLMFactory } from "./llm/factory";
import type { AIEditorSettings } from "src/settings";
import type { UserAction } from "./action";
import { Selection, Location } from "./action";
import { spinnerPlugin } from "./spinnerPlugin";
import type { ActionResultManager } from "./action-result-manager";
import { stripThinkingTags } from "./utils/thinking-tags";

// Plugin interface
export interface PluginInterface {
	app?: App;
	actionResultManager?: ActionResultManager;
	modalManager?: {
		validateAndSelectModel: (action: UserAction) => Promise<string | null>;
	};
}

// StreamingProcessor interfaces
export interface StreamingConfig {
	action: UserAction;
	input: string;
	cursorPosition: number;
	userPrompt?: string;
	onToken: (token: string) => void;
	onComplete: (result: string) => void;
	onError: (error: Error) => void;
	onCancel: () => void;
}

export interface StreamingState {
	isActive: boolean;
	currentResult: string;
	isCancelled: boolean;
}

// PromptProcessor interfaces
export interface PromptConfig {
	action: UserAction;
	input: string;
	editor: Editor;
	view: MarkdownView;
	app: App;
	userPrompt?: string;
	outputMode?: string;
	plugin?: unknown; // Reference to main plugin
}

/**
 * StreamingProcessor handles unified streaming operations with consistent behavior
 * across all plugin features. It manages LLM streaming, spinner animations,
 * mobile keyboard handling, escape key cancellation, and error handling.
 */
export class StreamingProcessor {
	private state: StreamingState;
	private llmFactory: LLMFactory;
	private settings: AIEditorSettings;
	private currentSpinnerHide?: () => void;
	private escapeHandler?: (e: KeyboardEvent) => void;
	private app?: App;
	private activeEditor?: Editor; // Track active editor for focus restoration

	constructor(settings: AIEditorSettings, app?: App) {
		this.settings = settings;
		this.llmFactory = new LLMFactory(settings);
		this.app = app;
		this.state = {
			isActive: false,
			currentResult: "",
			isCancelled: false,
		};
	}

	/**
	 * Process streaming with unified logic for all plugin features
	 */
	async processStreaming(config: StreamingConfig): Promise<void> {
		if (this.state.isActive) {
			throw new Error("Streaming is already active");
		}

		// Store active editor for focus restoration
		this.activeEditor = this.getActiveEditor();

		// Reset state
		this.state = {
			isActive: true,
			currentResult: "",
			isCancelled: false,
		};

		let providerName = "Unknown provider";
		let spinner: {
			hideSpinner: () => void;
			onUpdate: (text: string) => void;
		} | null = null;

		try {
			// Get provider name for notice with error handling
			try {
				providerName = this.llmFactory.getProviderNameSync(
					config.action.model
				);
			} catch {
				providerName = "Provider";
			}

			new Notice(`Querying ${providerName} API...`);

			// Hide mobile keyboard with error handling
			this.hideMobileKeyboard();

			// Setup spinner with error handling
			spinner = this.setupSpinner(config.cursorPosition);
			this.currentSpinnerHide = spinner?.hideSpinner;

			// Setup escape key handler
			this.setupEscapeHandler(config.onCancel);

			// Create LLM instance and start streaming
			const llm = this.llmFactory.create(config.action.model);

			await llm.autocomplete(
				config.action.prompt,
				config.input,
				(token: string) => {
					if (this.state.isCancelled) {
						return; // Stop processing tokens if cancelled
					}

					this.state.currentResult += token;

					try {
						config.onToken(token);

						const displayResult = this.formatResultForDisplay(
							this.state.currentResult
						);

						// Update spinner with formatted result
						spinner?.onUpdate(displayResult);
					} catch {
						// Continue streaming despite callback errors
					}
				},
				config.action.temperature,
				config.action.maxOutputTokens,
				config.userPrompt,
				true // streaming enabled
			);

			// Check if cancelled during streaming
			if (this.state.isCancelled) {
				config.onCancel();
				return;
			}

			// Streaming completed successfully
			this.state.isActive = false;

			config.onComplete(this.state.currentResult);
		} catch (error) {
			this.state.isActive = false;
			const streamingError = error as Error;

			// Show user-friendly error notice
			this.showErrorNotice(streamingError, providerName);

			try {
				config.onError(streamingError);
			} catch {
				// Don't throw callback errors to avoid masking original error
			}
		} finally {
			// Guaranteed cleanup with error handling
			this.performCleanup();
		}
	}

	/**
	 * Hide spinner without clearing results - for modal mode where results should remain visible
	 */
	hideSpinner(): void {
		try {
			// Hide spinner if active
			if (this.currentSpinnerHide) {
				try {
					this.currentSpinnerHide();
				} catch {
					// Silently handle spinner hide errors
				}
				this.currentSpinnerHide = undefined;
			}

			// Update workspace
			if (this.app) {
				try {
					this.app.workspace.updateOptions();
				} catch {
					// Silently handle workspace update errors
				}
			}
		} catch {
			// Silently handle any remaining errors
		}
	}

	/**
	 * Explicitly clear streaming results - separate from spinner hiding
	 */
	clearResults(): void {
		try {
			// Clear result state
			this.state.currentResult = "";
		} catch {
			// Silently handle any remaining errors
		}
	}

	/**
	 * Cancel active streaming with complete cleanup
	 */

	cancel(): void {
		try {
			if (this.state.isActive) {
				this.state.isCancelled = true;
				this.state.isActive = false;

				// Perform comprehensive cleanup
				this.clearResults();
				this.performCleanup();
			}
		} catch {
			// Force state reset even if cleanup fails
			this.state.isActive = false;
			this.state.isCancelled = true;
			this.state.currentResult = "";
		}
	}

	/**
	 * Get current streaming result
	 */
	getCurrentResult(): string {
		return this.state.currentResult;
	}

	/**
	 * Check if streaming is currently active
	 */
	isStreaming(): boolean {
		return this.state.isActive;
	}

	/**
	 * Setup spinner at cursor position with error handling
	 */
	private setupSpinner(cursorPosition: number) {
		try {
			if (!this.app) {
				return null;
			}

			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView) {
				return null;
			}

			// @ts-expect-error, not typed
			const editorView = activeView.editor.cm;
			if (!editorView) {
				return null;
			}

			const spinner = editorView.plugin(spinnerPlugin);
			if (!spinner) {
				return null;
			}

			const hideSpinner = spinner.show(cursorPosition);

			const processText = (text: string) => {
				try {
					// Return text as-is without trimming to ensure uniform processing
					return text;
				} catch {
					return text; // Return original text as fallback
				}
			};

			const onUpdate = (updatedString: string) => {
				try {
					spinner.processText(updatedString, processText);
					if (this.app) {
						this.app.workspace.updateOptions();
					}
				} catch {
					// Silently handle spinner update errors
				}
			};

			return { hideSpinner, onUpdate };
		} catch {
			return null;
		}
	}

	/**
	 * Setup escape key cancellation handler with error handling
	 */
	private setupEscapeHandler(onCancel: () => void): void {
		try {
			// Remove any existing handler first
			if (this.escapeHandler) {
				try {
					document.removeEventListener(
						"keydown",
						this.escapeHandler,
						true
					);
				} catch {
					// Silently handle removal errors
				}
			}

			this.escapeHandler = (e: KeyboardEvent) => {
				try {
					if (e.key === "Escape" && this.state.isActive) {
						e.preventDefault();
						e.stopPropagation();

						// Cancel streaming first
						this.cancel();

						// Then call the callback
						try {
							onCancel();
						} catch {
							// Silently handle callback errors
						}
					}
				} catch {
					// Silently handle handler errors
				}
			};

			document.addEventListener("keydown", this.escapeHandler, true);
		} catch {
			// Silently handle setup errors
		}
	}

	/**
	 * Hide mobile keyboard with delay and comprehensive error handling
	 */
	private hideMobileKeyboard(): void {
		if (!this.app) {
			return;
		}

		setTimeout(() => {
			try {
				interface ObsidianAppWithCommands {
					commands?: {
						listCommands?: () => Array<{
							id: string;
							name?: string;
						}>;
						executeCommandById?: (id: string) => void;
					};
				}

				const appWithCommands = this.app as ObsidianAppWithCommands;
				if (!appWithCommands?.commands) {
					return;
				}

				// Check if the command exists before executing
				let commands: Array<{ id: string; name?: string }> = [];
				try {
					commands = appWithCommands.commands.listCommands?.() || [];
				} catch {
					return;
				}

				const keyboardCommand = commands.find(
					cmd =>
						cmd.id &&
						(cmd.id.includes("keyboard") ||
							cmd.id.includes("toggle-keyboard") ||
							cmd.id === "app:toggle-keyboard")
				);

				if (keyboardCommand) {
					try {
						appWithCommands.commands.executeCommandById?.(
							keyboardCommand.id
						);
					} catch {
						// Silently handle execution errors
					}
				}
			} catch {
				// Silently handle any errors
			}
		}, 1000);
	}

	/**
	 * Get active editor for focus restoration
	 */
	private getActiveEditor(): Editor | undefined {
		if (!this.app) return undefined;

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		return activeView?.editor;
	}

	/**
	 * Restore editor focus if possible
	 */
	private restoreEditorFocus(): void {
		try {
			if (this.activeEditor) {
				this.activeEditor.focus();
			}
		} catch {
			// Silently handle focus restoration errors
		}
	}

	/**
	 * Show user-friendly error notice
	 */
	private showErrorNotice(error: Error, providerName: string): void {
		let errorMessage = `${providerName} error: ${error.message}`;

		// Handle common error types with user-friendly messages
		if (
			error.message.includes("network") ||
			error.message.includes("fetch")
		) {
			errorMessage = `Network error connecting to ${providerName}. Please check your connection and try again.`;
		} else if (
			error.message.includes("API key") ||
			error.message.includes("authentication")
		) {
			errorMessage = `Authentication error with ${providerName}. Please check your API key in settings.`;
		} else if (
			error.message.includes("rate limit") ||
			error.message.includes("quota")
		) {
			errorMessage = `Rate limit exceeded for ${providerName}. Please wait and try again.`;
		} else if (error.message.includes("timeout")) {
			errorMessage = `Request timeout for ${providerName}. Please try again.`;
		}

		new Notice(errorMessage, 8000); // Show for 8 seconds
	}

	/**
	 * Perform comprehensive cleanup with error handling
	 */
	private performCleanup(): void {
		try {
			// Remove escape key handler
			if (this.escapeHandler) {
				try {
					document.removeEventListener(
						"keydown",
						this.escapeHandler,
						true
					);
				} catch {
					// Silently handle event listener removal errors
				}
				this.escapeHandler = undefined;
			}

			// DON'T hide spinner here automatically - it should be hidden explicitly when needed
			// This allows modal mode to keep results visible while hiding spinner separately

			// Update workspace
			if (this.app) {
				try {
					this.app.workspace.updateOptions();
				} catch {
					// Silently handle workspace update errors
				}
			}

			// Restore editor focus
			this.restoreEditorFocus();
		} catch {
			// Silently handle any remaining cleanup errors
		}
	}

	/**
	 * Format result for display during streaming
	 */
	private formatResultForDisplay(result: string): string {
		if (!result.trim()) {
			return "";
		}
		// Always format with empty lines like APPEND_CURRENT for consistent streaming display
		return ["\n", result.trim(), "\n"].join("");
	}

	/**
	 * Apply final formatting to displayed result after streaming completion
	 * This applies the action.format template to the final result for display
	 */
	applyFinalFormatToDisplay(format?: string): void {
		if (!format || !this.state.currentResult.trim()) {
			return;
		}

		try {
			// Apply format template to the current result
			const formattedResult = format.replace(
				/\{\{result\}\}/g,
				this.state.currentResult.trim()
			);

			// Update the displayed result with formatted version
			const displayResult = this.formatResultForDisplay(formattedResult);

			// Update spinner with formatted result if spinner is active
			if (this.currentSpinnerHide) {
				try {
					const activeView =
						this.app?.workspace.getActiveViewOfType(MarkdownView);
					if (activeView) {
						// @ts-expect-error, not typed
						const editorView = activeView.editor.cm;
						if (editorView) {
							const spinner = editorView.plugin(spinnerPlugin);
							if (spinner) {
								spinner.processText(
									displayResult,
									(text: string) => text
								);
								if (this.app) {
									this.app.workspace.updateOptions();
								}
							}
						}
					}
				} catch {
					// Silently handle spinner update errors
				}
			}
		} catch {
			// Silently handle formatting errors
		}
	}
}

/**
 * PromptProcessor coordinates between streaming and result application with mode-specific behavior.
 * It orchestrates streaming via StreamingProcessor and manages modal window display logic.
 */
export class PromptProcessor {
	private streamingProcessor: StreamingProcessor;
	private actionHandler: ActionHandler;
	private settings: AIEditorSettings;
	private plugin?: PluginInterface;

	constructor(settings: AIEditorSettings, plugin?: PluginInterface) {
		this.settings = settings;
		this.plugin = plugin;
		this.streamingProcessor = new StreamingProcessor(settings, plugin?.app);
		this.actionHandler = new ActionHandler(settings, plugin);
	}

	/**
	 * Process prompt with coordinated streaming and result application
	 */
	async processPrompt(config: PromptConfig): Promise<void> {
		const { action, input, editor, userPrompt, outputMode } = config;

		let cursorPositionFrom: { line: number; ch: number };
		let cursorPositionTo: { line: number; ch: number };
		let cursorOffset: number;

		try {
			// Prepare cursor positions for result application with error handling
			try {
				cursorPositionFrom = editor.getCursor("from");
				cursorPositionTo = editor.getCursor("to");
				cursorOffset = editor.posToOffset(cursorPositionTo);
			} catch {
				throw new Error("Failed to get editor cursor position");
			}

			// Ensure editor has focus for streaming visibility
			try {
				editor.focus();
			} catch {
				// Continue without focus - not critical
			}

			let accumulatedResult = "";
			let streamingError: Error | null = null;
			let wasCancelled = false;

			// Create streaming configuration
			const streamingConfig: StreamingConfig = {
				action,
				input,
				cursorPosition: cursorOffset,
				userPrompt,
				onToken: (token: string) => {
					accumulatedResult += token;
				},
				onComplete: (result: string) => {
					accumulatedResult = result;
				},
				onError: (error: Error) => {
					streamingError = error;
				},
				onCancel: () => {
					// Streaming was cancelled, hide spinner and clear results
					wasCancelled = true;
					this.streamingProcessor.hideSpinner();
					this.streamingProcessor.clearResults();
				},
			};

			// Execute streaming
			await this.streamingProcessor.processStreaming(streamingConfig);

			// Check if streaming was cancelled
			if (wasCancelled) {
				return;
			}

			// Check if streaming had an error
			if (streamingError) {
				throw streamingError;
			}

			if (!accumulatedResult.trim()) {
				return;
			}

			// Ensure editor maintains focus after streaming
			try {
				editor.focus();
			} catch {
				// Continue without focus - not critical
			}

			// Determine result handling mode
			const shouldShowModal = action.showModalWindow ?? true;
			const isQuickPrompt = outputMode !== undefined; // Quick prompt mode

			if (isQuickPrompt || !shouldShowModal) {
				// Direct mode: hide spinner, apply result immediately and clear
				this.streamingProcessor.hideSpinner();
				await this.handleDirectResult(
					accumulatedResult.trim(),
					config,
					cursorPositionFrom,
					cursorPositionTo
				);
				this.streamingProcessor.clearResults();
			} else {
				// Modal mode: apply final formatting to display and show ActionResultManager panel
				// Apply format template to the displayed result
				this.streamingProcessor.applyFinalFormatToDisplay(
					action.format
				);

				// Show ActionResultManager panel, keep result visible until user action
				// Do NOT hide spinner or clear results here - they remain visible until user chooses action
				await this.handleModalResult(
					accumulatedResult,
					config,
					cursorPositionFrom,
					cursorPositionTo
				);
			}
		} catch (error) {
			const promptError = error as Error;

			// Ensure cleanup on error
			try {
				this.streamingProcessor.hideSpinner();
				this.streamingProcessor.clearResults();
			} catch {
				// Silently handle cleanup errors
			}

			// Show user-friendly error notice
			this.showPromptErrorNotice(promptError);

			// Ensure editor maintains focus even on error
			try {
				editor.focus();
			} catch {
				// Silently handle focus errors
			}

			// Re-throw to allow caller to handle if needed
			throw promptError;
		}
	}

	/**
	 * Handle modal result display and user interaction
	 */
	private async handleModalResult(
		result: string,
		config: PromptConfig,
		cursorPositionFrom: { line: number; ch: number },
		cursorPositionTo: { line: number; ch: number }
	): Promise<void> {
		const { action, editor, view } = config;

		try {
			const resultManager = this.plugin?.actionResultManager;
			if (!resultManager) {
				throw new Error("ActionResultManager not available");
			}

			// Create callbacks for result application with error handling
			const onAccept = async (finalResult: string) => {
				try {
					// Apply format template
					const formattedResult = this.formatResult(
						finalResult,
						action.format
					);

					// Hide spinner and apply result based on location
					this.streamingProcessor.hideSpinner();

					if (action.loc === Location.REPLACE_CURRENT) {
						editor.replaceRange(
							formattedResult,
							cursorPositionFrom,
							cursorPositionTo
						);
					} else {
						await this.actionHandler.addToNote(
							action.loc,
							formattedResult,
							editor,
							view.file?.vault,
							action.locationExtra
						);
					}

					// Clear streaming results only AFTER applying result
					this.streamingProcessor.clearResults();
				} catch (error) {
					this.showPromptErrorNotice(error as Error);
				}
			};

			const onLocationAction = async (
				finalResult: string,
				location: Location
			) => {
				try {
					// Apply format template
					const formattedResult = this.formatResult(
						finalResult,
						action.format
					);

					// Hide spinner and apply result based on specified location
					this.streamingProcessor.hideSpinner();

					if (location === Location.REPLACE_CURRENT) {
						editor.replaceRange(
							formattedResult,
							cursorPositionFrom,
							cursorPositionTo
						);
					} else {
						await this.actionHandler.addToNote(
							location,
							formattedResult,
							editor,
							view.file?.vault,
							action.locationExtra
						);
					}

					// Clear streaming results only AFTER applying result
					this.streamingProcessor.clearResults();
				} catch (error) {
					this.showPromptErrorNotice(error as Error);
				}
			};

			const onCancel = () => {
				try {
					// Hide spinner and clear streaming results when modal is cancelled
					this.streamingProcessor.hideSpinner();
					this.streamingProcessor.clearResults();
				} catch {
					// Silently handle cancel errors
				}
			};

			// Show result panel - result remains visible in spinner until user action
			try {
				await resultManager.showResultPanel(
					result.trim(),
					null, // format function (we handle formatting in callbacks)
					onAccept,
					onLocationAction,
					action.loc === Location.APPEND_TO_FILE &&
						!!action.locationExtra?.fileName,
					onCancel,
					action.loc // Pass default location from action settings
				);
				// Note: Do NOT clear results here - they remain visible in spinner until user chooses action
			} catch {
				return;
			}
		} catch {
			return;
		}
	}

	/**
	 * Handle direct result application without modal
	 */
	private async handleDirectResult(
		result: string,
		config: PromptConfig,
		cursorPositionFrom: { line: number; ch: number },
		cursorPositionTo: { line: number; ch: number }
	): Promise<void> {
		const { action, editor } = config;

		// Apply format template (result should already be trimmed by caller)
		const formattedResult = this.formatResult(result, action.format);

		// Apply result based on location
		if (action.loc === Location.REPLACE_CURRENT) {
			try {
				editor.replaceRange(
					formattedResult,
					cursorPositionFrom,
					cursorPositionTo
				);
			} catch {
				throw new Error("Failed to apply result to editor");
			}
		} else {
			try {
				await this.actionHandler.addToNote(
					action.loc,
					formattedResult,
					editor,
					config.view.file?.vault,
					action.locationExtra
				);
			} catch {
				throw new Error("Failed to add result to note");
			}
		}
	}

	/**
	 * Apply format template to result with error handling
	 */

	private formatResult(result: string, format?: string): string {
		try {
			if (!format || !format.trim()) {
				return stripThinkingTags(result);
			}

			// Clean up the streaming result by stripping thinking tags
			const cleanResult = stripThinkingTags(result).trim();

			// Apply the format template
			return format.replace(/\{\{result\}\}/g, cleanResult);
		} catch {
			// Return original result as fallback
			return result;
		}
	}

	/**
	 * Show user-friendly error notice for prompt processing
	 */
	private showPromptErrorNotice(error: Error): void {
		let errorMessage = `Prompt processing error: ${error.message}`;

		// Handle specific error types
		if (
			error.message.includes("cursor") ||
			error.message.includes("editor")
		) {
			errorMessage = "Editor error occurred. Please try again.";
		} else if (
			error.message.includes("modal") ||
			error.message.includes("result manager")
		) {
			errorMessage =
				"Result display error. The operation completed but results may not be visible.";
		}

		new Notice(errorMessage, 6000);
	}
}

export class ActionHandler {
	private llmFactory: LLMFactory;
	private plugin?: PluginInterface; // Reference to the main plugin

	constructor(settings: AIEditorSettings, plugin?: PluginInterface) {
		this.llmFactory = new LLMFactory(settings);
		this.plugin = plugin;
	}

	async handleAction(userAction: UserAction, input: string): Promise<string> {
		const llm = this.llmFactory.create(userAction.model);
		const prompt = userAction.prompt.replace("{{input}}", input);
		const result = await llm.autocomplete(
			prompt,
			input,
			undefined,
			userAction.temperature,
			userAction.maxOutputTokens
		);
		return result as string;
	}

	async autocompleteStreaming(
		userAction: UserAction,
		input: string,
		onToken: (token: string) => void,
		userPrompt?: string
	): Promise<void> {
		const llm = this.llmFactory.create(userAction.model);
		await llm.autocomplete(
			userAction.prompt,
			input,
			onToken,
			userAction.temperature,
			userAction.maxOutputTokens,
			userPrompt,
			true
		);
	}

	getAPIKey(settings: AIEditorSettings) {
		const apiKey = settings.openAiApiKey;
		if (!apiKey) {
			new Notice("API key is not set in plugin settings");
			throw "API key not set";
		}
		return apiKey;
	}

	async getTextInput(sel: Selection, editor: Editor): Promise<string> {
		switch (sel) {
			case Selection.ALL:
				return editor.getValue();
			case Selection.CURSOR:
				return editor.getSelection();
			case Selection.CLIPBOARD:
				try {
					const clipboardContent = await this.readClipboardContent();
					// Check if clipboard is empty or contains only whitespace
					if (!clipboardContent || !clipboardContent.trim()) {
						new Notice(
							"Clipboard is empty or contains only whitespace.",
							10000
						);
						throw "Clipboard is empty or contains only whitespace.";
					}
					return clipboardContent;
				} catch (error) {
					console.error("Failed to read clipboard:", error);
					throw "Failed to read clipboard. Please ensure clipboard permissions are granted.";
				}
			default:
				console.log(`Selection ${sel}`);
				throw "Selection not implemented";
		}
	}

	/**
	 * Read clipboard content as-is without any modifications
	 * Preserves original formatting by reading HTML content directly
	 */
	private async readClipboardContent(): Promise<string> {
		try {
			// Try to read rich content using the modern Clipboard API
			const clipboardAPI = (
				globalThis as unknown as {
					navigator: { clipboard: { read(): Promise<unknown[]> } };
				}
			).navigator;
			const clipboardItems = await clipboardAPI.clipboard.read();

			for (const item of clipboardItems as unknown as Array<{
				types: string[];
				getType(type: string): Promise<{ text(): Promise<string> }>;
			}>) {
				// Priority order: HTML (for rich formatting), then plain text
				if (item.types.includes("text/html")) {
					const blob = await item.getType("text/html");
					const htmlContent = await blob.text();

					// Return HTML content as-is without any conversion
					return htmlContent;
				}

				if (item.types.includes("text/plain")) {
					const blob = await item.getType("text/plain");
					return await blob.text();
				}
			}

			// If no text content found, return empty string
			return "";
		} catch (error) {
			// Fallback to the old method if the modern API fails
			console.warn(
				"Modern clipboard API failed, falling back to readText():",
				error
			);
			const clipboardAPI = (
				globalThis as unknown as {
					navigator: { clipboard: { readText(): Promise<string> } };
				}
			).navigator;
			return await clipboardAPI.clipboard.readText();
		}
	}

	async addToNote(
		location: Location,
		text: string,
		editor: Editor,
		vault?: Vault,
		locationExtra?: { fileName: string }
	) {
		switch (location) {
			case Location.INSERT_HEAD:
				editor.setCursor(0, 0);
				editor.replaceRange(text, editor.getCursor());
				break;
			case Location.APPEND_BOTTOM:
				editor.setCursor(editor.lastLine());
				editor.replaceRange(text, editor.getCursor());
				break;
			case Location.APPEND_CURRENT:
				text = editor.getSelection() + "\n\n" + text;
				editor.replaceSelection(text);
				break;
			case Location.REPLACE_CURRENT:
				editor.replaceSelection(text);
				break;
			case Location.APPEND_TO_FILE: {
				const fileName = locationExtra?.fileName;
				if (vault && fileName) {
					await this.appendToFileInVault(vault, fileName, text);
				}
				break;
			}
			default:
				throw "Location not implemented";
		}
	}

	private async appendToFileInVault(
		vault: Vault,
		fileName: string,
		text: string
	) {
		let file: TFile = await getFile(vault, fileName);
		vault.append(file, text);
	}

	async process(
		app: App,
		settings: AIEditorSettings,
		action: UserAction,
		editor: Editor,
		view: MarkdownView
	) {
		// Check if model is available and get user selection if not
		const validatedModelId =
			await this.plugin?.modalManager?.validateAndSelectModel(action);
		if (!validatedModelId) {
			// User cancelled model selection
			return;
		}

		// Update action with validated model ID
		action.model = validatedModelId;

		// Text input preparation
		const text = await this.getTextInput(action.sel, editor);

		const promptProcessor = new PromptProcessor(settings, this.plugin);
		await promptProcessor.processPrompt({
			action,
			input: text,
			editor,
			view,
			app,
			plugin: this.plugin,
		});
	}
}

async function getFile(vault: Vault, fileName: string) {
	let file = vault.getAbstractFileByPath(fileName);
	if (file == null) {
		return await vault.create(fileName, "");
	} else if (file instanceof TFile) {
		return file;
	} else {
		throw "Not a file path";
	}
}
