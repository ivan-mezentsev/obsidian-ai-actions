import { App, Editor, MarkdownView, Notice, TFile, Vault } from "obsidian";
import { LLMFactory } from "./llm/factory";
import type { AIEditorSettings } from "src/settings";
import type { UserAction } from "./action";
import { Selection, Location } from "./action";
import { spinnerPlugin } from "./spinnerPlugin";
import type { ActionResultManager } from "./action-result-manager";

export class ActionHandler {
	private llmFactory: LLMFactory;
	private plugin: any; // Reference to the main plugin

	constructor(settings: AIEditorSettings, plugin?: any) {
		this.llmFactory = new LLMFactory(settings);
		this.plugin = plugin;
	}

	async handleAction(userAction: UserAction, input: string): Promise<string> {
		const llm = this.llmFactory.create(userAction.model);
		const prompt = userAction.prompt.replace("{{input}}", input);
		return await llm.autocomplete(
			prompt,
			input,
			userAction.temperature,
			userAction.maxOutputTokens,
		);
	}

	async autocompleteStreaming(
		userAction: UserAction,
		input: string,
		onToken: (token: string) => void,
	): Promise<void> {
		const llm = this.llmFactory.create(userAction.model);
		return await llm.autocompleteStreaming(
			userAction.prompt,
			input,
			onToken,
			userAction.temperature,
			userAction.maxOutputTokens,
		);
	}

	async autocompleteStreamingWithUserPrompt(
		userAction: UserAction,
		input: string,
		userPrompt: string,
		onToken: (token: string) => void,
	): Promise<void> {
		const llm = this.llmFactory.create(userAction.model);
		return await llm.autocompleteStreamingWithUserPrompt(
			userAction.prompt,
			input,
			userPrompt,
			onToken,
			userAction.temperature,
			userAction.maxOutputTokens,
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

	getTextInput(sel: Selection, editor: Editor) {
		switch (sel) {
			case Selection.ALL:
				return editor.getValue();
			case Selection.CURSOR:
				return editor.getSelection();
			default:
				console.log(`Selection ${sel}`);
				throw "Selection not implemented";
		}
	}

	async addToNote(
		location: Location,
		text: string,
		editor: Editor,
		vault?: Vault,
		locationExtra?: { fileName: string },
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
			case Location.APPEND_TO_FILE:
				let fileName = locationExtra?.fileName;
				if (vault && fileName) {
					await this.appendToFileInVault(vault, fileName, text);
				}
				break;
			default:
				throw "Location not implemented";
		}
	}

	private async appendToFileInVault(
		vault: Vault,
		fileName: string,
		text: string,
	) {
		let file: TFile = await getFile(vault, fileName);
		vault.append(file, text);
	}

	async process(
		app: App,
		settings: AIEditorSettings,
		action: UserAction,
		editor: Editor,
		view: MarkdownView,
	) {
		// @ts-expect-error, not typed
		const editorView = editor.cm;

		const selection = editor.getSelection();
		let selectedText = selection || editor.getValue();
		const cursorPositionFrom = editor.getCursor("from");
		const cursorPositionTo = editor.getCursor("to");

		const text = this.getTextInput(action.sel, editor);
		const providerName = this.llmFactory.getProviderNameSync(action.model);
		new Notice(`Querying ${providerName} API...`);

		// Try to hide virtual keyboard on mobile devices with delay
		setTimeout(() => {
			if (app && (app as any).commands) {
				// Check if the command exists before executing
				const commands = (app as any).commands.listCommands ? (app as any).commands.listCommands() : [];
				const keyboardCommand = commands.find((cmd: any) => 
					cmd.id && (
						cmd.id.includes('keyboard') || 
						cmd.id.includes('toggle-keyboard') ||
						cmd.id === 'app:toggle-keyboard'
					)
				);
				
				if (keyboardCommand) {
					try {
						(app as any).commands.executeCommandById(keyboardCommand.id);
					} catch (error) {
						// Silently handle errors
					}
				}
			}
		}, 1000);

		// Ensure editor has focus for streaming visibility
		editor.focus();

		// Get spinner plugin and show loading animation at cursor position
		const spinner = editorView.plugin(spinnerPlugin) || undefined;
		const hideSpinner = spinner?.show(editor.posToOffset(cursorPositionTo));
		app.workspace.updateOptions();

		const processText = (text: string, selectedText: string) => {
			if (!text.trim()) {
				return "";
			}
			// For replace mode, return the text as is
			if (action.loc === Location.REPLACE_CURRENT) {
				return text.trim();
			}
			// For other modes, format as needed
			return ["\n", text.trim(), "\n"].join("");
		};

		const onUpdate = (updatedString: string) => {
			spinner?.processText(updatedString, (text: string) =>
				processText(text, selectedText),
			);
			app.workspace.updateOptions();
		};

		const shouldShowPanel = action.showModalWindow ?? true;
		let resultManager: ActionResultManager | null = null;

		if (shouldShowPanel) {
			resultManager = this.plugin.actionResultManager;
		}

		let accumulatedText = "";
		let streamingComplete = false;

		// Create callbacks for the result panel
		const onAccept = async (result: string) => {
			// Use saved cursor positions for replacement
			if (action.loc === Location.REPLACE_CURRENT) {
				editor.replaceRange(
					result,
					cursorPositionFrom,
					cursorPositionTo,
				);
			} else {
				await this.addToNote(
					action.loc,
					result,
					editor,
					view.file?.vault,
					action.locationExtra,
				);
			}
		};

		const onLocationAction = async (result: string, location: Location) => {
			if (location === Location.REPLACE_CURRENT) {
				editor.replaceRange(
					result,
					cursorPositionFrom,
					cursorPositionTo,
				);
			} else {
				await this.addToNote(
					location,
					result,
					editor,
					view.file?.vault,
					action.locationExtra,
				);
			}
		};

		try {
			await this.autocompleteStreaming(action, text, (token) => {
				accumulatedText += token;
				onUpdate(accumulatedText);
			});

			// Mark streaming as complete
			streamingComplete = true;

			// Ensure editor maintains focus after streaming
			editor.focus();

			// If panel should be shown, show it after streaming is complete
			if (shouldShowPanel && accumulatedText.trim() && resultManager) {
				// Show result panel and pass hideSpinner callback to be called when action is taken
				await resultManager.showResultPanel(
					accumulatedText.trim(),
					null,
					async (result: string) => {
						// Apply format template and hide spinner before applying result
						const finalText = action.format.replace("{{result}}", result);
						hideSpinner && hideSpinner();
						app.workspace.updateOptions();
						await onAccept(finalText);
					},
					async (result: string, location: Location) => {
						// Apply format template and hide spinner before applying result
						const finalText = action.format.replace("{{result}}", result);
						hideSpinner && hideSpinner();
						app.workspace.updateOptions();
						await onLocationAction(finalText, location);
					},
					action.loc === Location.APPEND_TO_FILE && !!action.locationExtra?.fileName,
					() => {
						// Hide spinner when panel is cancelled
						hideSpinner && hideSpinner();
						app.workspace.updateOptions();
					}
				);
			} else if (!shouldShowPanel && accumulatedText.trim()) {
				// Hide spinner when not showing panel
				hideSpinner && hideSpinner();
				app.workspace.updateOptions();
				// If panel is not shown, directly apply the result
				const finalText = action.format.replace(
					"{{result}}",
					accumulatedText.trim(),
				);
				if (action.loc === Location.REPLACE_CURRENT) {
					editor.replaceRange(
						finalText,
						cursorPositionFrom,
						cursorPositionTo,
					);
				} else {
					await this.addToNote(
						action.loc,
						finalText,
						editor,
						view.file?.vault,
						action.locationExtra,
					);
				}
			}
		} catch (error) {
			console.log(error);
			new Notice(`Autocomplete error:\n${error}`);
			hideSpinner && hideSpinner();
			app.workspace.updateOptions();
			// Ensure editor maintains focus even on error
			editor.focus();
		}
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
