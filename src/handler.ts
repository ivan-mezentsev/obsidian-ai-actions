import { OutputModal } from "src/modals/output";
import { App, Editor, MarkdownView, Notice, TFile, Vault } from "obsidian";
import { LLMFactory } from "./llm/factory";
import type { AIEditorSettings } from "src/settings";
import type { UserAction } from "./action";
import { Selection, Location } from "./action";
import { spinnerPlugin } from "./spinnerPlugin";

export class ActionHandler {
	private llmFactory: LLMFactory;

	constructor(settings: AIEditorSettings) {
		this.llmFactory = new LLMFactory(settings);
	}

	async handleAction(userAction: UserAction, input: string): Promise<string> {
		const llm = this.llmFactory.create(userAction.model);
		const prompt = userAction.prompt.replace("{{input}}", input);
		return await llm.autocomplete(prompt, input, userAction.temperature, userAction.maxOutputTokens);
	}

	async autocompleteStreaming(
		userAction: UserAction,
		input: string,
		onToken: (token: string) => void
	): Promise<void> {
		const llm = this.llmFactory.create(userAction.model);
		return await llm.autocompleteStreaming(userAction.prompt, input, onToken, userAction.temperature, userAction.maxOutputTokens);
	}

	async autocompleteStreamingWithUserPrompt(
		userAction: UserAction,
		input: string,
		userPrompt: string,
		onToken: (token: string) => void
	): Promise<void> {
		const llm = this.llmFactory.create(userAction.model);
		return await llm.autocompleteStreamingWithUserPrompt(userAction.prompt, input, userPrompt, onToken, userAction.temperature, userAction.maxOutputTokens);
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
				text = editor.getSelection() + text;
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
		// @ts-expect-error, not typed
		const editorView = editor.cm;

		const selection = editor.getSelection();
		let selectedText = selection || editor.getValue();
		const cursorPositionFrom = editor.getCursor("from");
		const cursorPositionTo = editor.getCursor("to");

		const text = this.getTextInput(action.sel, editor);
		const providerName = this.llmFactory.getProviderName(action.model);
		new Notice(`Querying ${providerName} API...`);

		// Ensure editor has focus for streaming visibility
		editor.focus();

		// Get spinner plugin and show loading animation at cursor position
		const spinner = editorView.plugin(spinnerPlugin) || undefined;
		const hideSpinner = spinner?.show(editor.posToOffset(cursorPositionTo));

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
				processText(text, selectedText)
			);
		};

		const shouldShowModal = action.showModalWindow ?? true;
		let modal: OutputModal | null = null;

		if (shouldShowModal) {
			modal = new OutputModal(
				app,
				action.name,
				(text: string) => action.format.replace("{{result}}", text),
				async (result: string) => {
					// Use saved cursor positions for replacement
					if (action.loc === Location.REPLACE_CURRENT) {
						editor.replaceRange(
							result,
							cursorPositionFrom,
							cursorPositionTo
						);
					} else {
						await this.addToNote(
							action.loc,
							result,
							editor,
							view.file?.vault,
							action.locationExtra
						);
					}
				},
				"",
				async (result: string, location: Location) => {
					if (location === Location.REPLACE_CURRENT) {
						editor.replaceRange(
							result,
							cursorPositionFrom,
							cursorPositionTo
						);
					} else {
						await this.addToNote(
							location,
							result,
							editor,
							view.file?.vault,
							action.locationExtra
						);
					}
				},
				action.loc === Location.APPEND_TO_FILE && !!action.locationExtra?.fileName
			);
		}

		let modalDisplayed = false;
		let accumulatedText = "";

		try {
			await this.autocompleteStreaming(
				action,
				text,
				(token) => {
					accumulatedText += token;
					onUpdate(accumulatedText);

					if (shouldShowModal) {
						if (!modalDisplayed) {
							modalDisplayed = true;
							modal!.open();
						}
						modal!.addToken(token);
					}
				}
			);

			// When streaming is complete, hide spinner and handle final result
			hideSpinner && hideSpinner();

			// Ensure editor maintains focus after streaming
			editor.focus();

			// If modal is not shown, directly apply the result
			if (!shouldShowModal && accumulatedText.trim()) {
				const finalText = action.format.replace("{{result}}", accumulatedText.trim());
				if (action.loc === Location.REPLACE_CURRENT) {
					editor.replaceRange(
						finalText,
						cursorPositionFrom,
						cursorPositionTo
					);
				} else {
					await this.addToNote(
						action.loc,
						finalText,
						editor,
						view.file?.vault,
						action.locationExtra
					);
				}
			} else if (shouldShowModal && action.loc === Location.REPLACE_CURRENT && accumulatedText.trim()) {
				// For replace mode with modal, directly replace the text using saved positions
				const finalText = action.format.replace("{{result}}", accumulatedText.trim());
				editor.replaceRange(
					finalText,
					cursorPositionFrom,
					cursorPositionTo
				);
			}

		} catch (error) {
			console.log(error);
			new Notice(`Autocomplete error:\n${error}`);
			hideSpinner && hideSpinner();
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
