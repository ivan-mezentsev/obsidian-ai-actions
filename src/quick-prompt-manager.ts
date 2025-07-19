import { App, Editor, MarkdownView, Notice } from "obsidian";
import QuickPromptBox from "./components/QuickPromptBox.svelte";
import AIEditor from "./main";
import { ActionHandler } from "./handler";
import { generateUniqueId } from "./utils/common";
import { spinnerPlugin } from "./spinnerPlugin";
import { Location, getAvailableModelsWithPluginAIProviders } from "./action";
import type { AIModel } from "./types";

export class QuickPromptManager {
	plugin: AIEditor;
	promptBoxCache: Map<string, QuickPromptBox> = new Map();

	constructor(plugin: AIEditor) {
		this.plugin = plugin;
	}

	/**
	 * Get or create QuickPromptBox component
	 */
	getPromptBox(): QuickPromptBox {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			throw new Error("No active MarkdownView found");
		}

		const targetEl = view.containerEl;
		const promptBoxEl = targetEl.querySelector(".quick-prompt-box");

		// If prompt box already exists, find it in cache
		if (promptBoxEl) {
			const cid = promptBoxEl.getAttribute("data-cid");
			if (cid) {
				const cachedBox = this.promptBoxCache.get(cid);
				if (cachedBox) {
					return cachedBox;
				} else {
					// Orphaned element, remove it
					promptBoxEl.remove();
				}
			} else {
				// Element without cid, remove it
				promptBoxEl.remove();
			}
		}

		// Create new component
		const cid = this.generateUniqueId();
		const availableModels = this.plugin.settings.aiProviders?.models || [];
		const availableProviders =
			this.plugin.settings.aiProviders?.providers || [];
		const defaultModelId =
			this.plugin.settings.quickPrompt?.model ||
			this.plugin.settings.aiProviders?.defaultModelId ||
			"";
	
		const promptBox = new QuickPromptBox({
			target: targetEl,
			props: {
				visible: false,
				prompt: "",
				cid: cid,
				availableModels: availableModels,
				availableProviders: availableProviders,
				selectedModelId: defaultModelId,
				defaultModelId: defaultModelId,
				loadModelsAsync: () => getAvailableModelsWithPluginAIProviders(this.plugin.settings),
			},
		});

		this.registerPromptBoxEvents(targetEl, promptBox);
		this.promptBoxCache.set(cid, promptBox);
		return promptBox;
	}

	/**
	 * Generate unique ID for components
	 */
	private generateUniqueId(): string {
		return `qp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Show quick prompt at cursor position
	 */
	async showQuickPrompt(editor: Editor, view: MarkdownView) {
		// Hide any existing prompt boxes first
		this.hideAllPromptBoxes();

		const promptBox = this.getPromptBox();

		// Show the prompt box first
		promptBox.show("");

		// Position after a short delay to ensure DOM is ready
		setTimeout(() => {
			this.positionPromptBox(editor, view);
		}, 10);
	}

	/**
	 * Hide all active prompt boxes
	 */
	private hideAllPromptBoxes() {
		this.promptBoxCache.forEach((promptBox) => {
			if (promptBox) {
				promptBox.hide();
			}
		});
	}

	/**
	 * Position prompt box near cursor or selection
	 */
	private positionPromptBox(editor: Editor, view: MarkdownView) {
		// Get cursor position (if there's selection, use the end of selection)
		const selection = editor.getSelection();
		const cursorPos = selection
			? editor.getCursor("to")
			: editor.getCursor();

		// @ts-expect-error, not typed
		const editorView = editor.cm;
		const coords = editorView.coordsAtPos(editor.posToOffset(cursorPos));

		if (coords) {
			const promptBoxEl = view.containerEl.querySelector(
				".quick-prompt-box",
			) as HTMLElement;
			if (promptBoxEl) {
				// Get editor container position for relative positioning
				const editorContainer = view.contentEl;
				const editorRect = editorContainer.getBoundingClientRect();

				// Calculate position relative to editor container
				const relativeLeft = coords.left - editorRect.left;
				const relativeTop = coords.bottom - editorRect.top;

				// Add CSS class for positioning
			promptBoxEl.classList.add("ai-actions-quick-prompt-box");

			// Position slightly below and to the right of cursor/selection
			promptBoxEl.style.setProperty("left", `${relativeLeft + 10}px`);
			promptBoxEl.style.setProperty("top", `${relativeTop + 10}px`);

				// Ensure it doesn't go off screen
				const rect = promptBoxEl.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				if (rect.right > viewportWidth) {
					const newLeft = Math.max(
						10,
						relativeLeft - rect.width - 10,
					);
				promptBoxEl.style.setProperty("left", `${newLeft}px`);
			}
	
			if (rect.bottom > viewportHeight) {
				const newTop = Math.max(10, relativeTop - rect.height - 20);
				promptBoxEl.style.setProperty("top", `${newTop}px`);
			}
			}
		}
	}

	/**
	 * Register event handlers for prompt box
	 */
	private registerPromptBoxEvents(
		mountEl: HTMLElement,
		promptBox: QuickPromptBox,
	) {
		// Handle submit event
		promptBox.$on("submit", async (event: any) => {
			const { prompt, modelId, outputMode } = event.detail;
			await this.processPrompt(prompt, modelId, outputMode);
		});

		// Handle close event
		promptBox.$on("close", () => {
			promptBox.hide();
		});

		// Handle escape key globally
		this.plugin.registerDomEvent(mountEl, "keydown", (e) => {
			if (e.key === "Escape") {
				const promptBoxEl = mountEl.querySelector(
					".quick-prompt-box--active",
				);
				if (promptBoxEl) {
					promptBox.hide();
				}
			}
		});
	}

	/**
	 * Process the submitted prompt
	 */
	private async processPrompt(
		userPrompt: string,
		modelId?: string,
		outputMode: string = "replace",
	) {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		// @ts-expect-error, not typed
		const editorView = editor.cm;

		// Ensure editor has focus for streaming visibility
		editor.focus();

		const handler = new ActionHandler(this.plugin.settings);

		// Keep the original quick prompt action settings but use selected model and output mode
		const quickPromptAction = {
			...this.plugin.settings.quickPrompt,
			model: modelId || this.plugin.settings.quickPrompt.model,
			loc:
				outputMode === "append"
					? Location.APPEND_CURRENT
					: Location.REPLACE_CURRENT,
		};

		// Save cursor positions before processing
		const selection = editor.getSelection();
		let selectedText = selection || editor.getValue();
		const cursorPositionFrom = editor.getCursor("from");
		const cursorPositionTo = editor.getCursor("to");

		try {
			// Get provider name for the model (including plugin AI providers)
			const availableModels = await getAvailableModelsWithPluginAIProviders(this.plugin.settings);
			const model = availableModels.find(
				(m) => m.id === quickPromptAction.model,
			);
			
			let providerName = "AI";
			if (model?.pluginAIProviderId) {
				// For plugin AI providers, use the model name as provider display
				providerName = model.name;
			} else {
				const provider = this.plugin.settings.aiProviders?.providers.find(
					(p) => p.id === model?.providerId,
				);
				providerName = provider?.name || "AI";
			}

			// Show processing notice
			const notice = new Notice(`Querying ${providerName} API...`, 0);

			// Get spinner plugin and show loading animation at cursor position
			const spinner = editorView.plugin(spinnerPlugin) || undefined;
			const hideSpinner = spinner?.show(
				editor.posToOffset(cursorPositionTo),
			);
			this.plugin.app.workspace.updateOptions();

			const processText = (text: string, selectedText: string) => {
				if (!text.trim()) {
					return "";
				}
				// For replace mode, return the text as is
				if (quickPromptAction.loc === Location.REPLACE_CURRENT) {
					return text.trim();
				}
				// For other modes, format as needed
				return ["\n\n", text.trim(), "\n"].join("");
			};

			const onUpdate = (updatedString: string) => {
				spinner?.processText(updatedString, (text: string) =>
					processText(text, selectedText),
				);
				this.plugin.app.workspace.updateOptions();
			};

			// Get text input based on selection mode
			const text = await handler.getTextInput(quickPromptAction.sel, editor);

			let result = "";
			// Use the streaming method with optional user prompt
			await handler.autocompleteStreaming(
				quickPromptAction,
				await text,
				(token) => {
					result += token;
					onUpdate(result);
				},
				userPrompt,
			);

			// Hide spinner when done
			hideSpinner && hideSpinner();
			this.plugin.app.workspace.updateOptions();

			// Ensure editor maintains focus after streaming
			editor.focus();

			// Apply result using saved cursor positions
			const formattedResult = quickPromptAction.format.replace(
				"{{result}}",
				result,
			);

			if (quickPromptAction.loc === Location.REPLACE_CURRENT) {
				editor.replaceRange(
					formattedResult,
					cursorPositionFrom,
					cursorPositionTo,
				);
			} else {
				await handler.addToNote(
					quickPromptAction.loc,
					formattedResult,
					editor,
					view.file?.vault,
					quickPromptAction.locationExtra,
				);
			}

			notice.hide();
		} catch (error) {
			console.error("Quick Prompt error:", error);
			new Notice(`Quick Prompt error: ${error}`);

			// Hide spinner on error
			const spinner = editorView.plugin(spinnerPlugin) || undefined;
			const hideSpinner = spinner?.hide;
			hideSpinner && hideSpinner(editor.posToOffset(cursorPositionTo));
			this.plugin.app.workspace.updateOptions();

			// Ensure editor maintains focus even on error
			editor.focus();
		}
	}

	/**
	 * Destroy all prompt boxes
	 */
	destroy() {
		this.promptBoxCache.forEach((promptBox, cid) => {
			if (promptBox) {
				// Find and remove the DOM element
				const element = document.querySelector(`[data-cid="${cid}"]`);
				if (element) {
					element.remove();
				}
				// Destroy the Svelte component
				promptBox.$destroy();
			}
		});
		this.promptBoxCache.clear();
	}
}
