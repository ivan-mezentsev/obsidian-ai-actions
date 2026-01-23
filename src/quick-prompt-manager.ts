import { Editor, MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import type { Component } from "svelte";
import QuickPromptBox from "./components/QuickPromptBox.svelte";
import AIEditor from "./main";
import { ActionHandler, PromptProcessor } from "./handler";
import {
	Location,
	getAvailableModelsWithPluginAIProviders,
	Selection,
} from "./action";
import type { AIModel, AIProvider } from "./types";
import type { InputSource } from "./utils/inputSource";

type QuickPromptBoxProps = {
	visible: boolean;
	prompt: string;
	cid: string;
	availableModels: AIModel[];
	availableProviders: AIProvider[];
	selectedModelId: string;
	defaultModelId: string;
	loadModelsAsync: () => Promise<AIModel[]>;
	onSubmit?: (payload: {
		prompt: string;
		modelId: string;
		outputMode: string;
		inputSource: InputSource;
	}) => void;
	onClose?: () => void;
};

type QuickPromptBoxExports = {
	show: (initialPrompt?: string) => void;
	hide: () => void;
};

type QuickPromptBoxEntry = {
	promptBox: QuickPromptBoxExports;
	mountEl: HTMLElement;
};

export class QuickPromptManager {
	plugin: AIEditor;
	promptBoxCache: Map<string, QuickPromptBoxEntry> = new Map();

	constructor(plugin: AIEditor) {
		this.plugin = plugin;
	}

	/**
	 * Get or create QuickPromptBox component
	 */
	getPromptBox(): QuickPromptBoxExports {
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
				const cachedEntry = this.promptBoxCache.get(cid);
				if (cachedEntry) {
					return cachedEntry.promptBox;
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
		const cid = `qp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
		const availableModels = this.plugin.settings.aiProviders?.models || [];
		const availableProviders =
			this.plugin.settings.aiProviders?.providers || [];
		const defaultModelId = this.plugin.settings.quickPrompt?.model || "";
		const mountEl = targetEl.createDiv();

		const promptBox = mount<QuickPromptBoxProps, QuickPromptBoxExports>(
			QuickPromptBox as unknown as Component<
				QuickPromptBoxProps,
				QuickPromptBoxExports
			>,
			{
				target: mountEl,
				props: {
					visible: false,
					prompt: "",
					cid: cid,
					availableModels: availableModels,
					availableProviders: availableProviders,
					selectedModelId: defaultModelId,
					defaultModelId: defaultModelId,
					loadModelsAsync: () =>
						getAvailableModelsWithPluginAIProviders(
							this.plugin.settings
						),
					onSubmit: payload => {
						this.handleSubmit(payload);
					},
					onClose: () => {
						this.hideAllPromptBoxes();
					},
				},
			}
		);

		this.registerPromptBoxEvents(targetEl, promptBox);
		this.promptBoxCache.set(cid, { promptBox, mountEl });
		return promptBox;
	}

	/**
	 * Show quick prompt at cursor position
	 */
	showQuickPrompt(editor: Editor, view: MarkdownView) {
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
		this.promptBoxCache.forEach(({ promptBox }) => {
			promptBox.hide();
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

		const editorView = (
			editor as unknown as {
				cm: {
					coordsAtPos: (pos: number) => {
						left: number;
						bottom: number;
					};
				};
			}
		).cm;
		const coords = editorView.coordsAtPos(editor.posToOffset(cursorPos));

		if (coords) {
			const promptBoxEl = view.containerEl.querySelector(
				".quick-prompt-box"
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
				promptBoxEl.setCssProps({
					left: `${relativeLeft + 10}px`,
					top: `${relativeTop + 10}px`,
				});

				// Ensure it doesn't go off screen
				const rect = promptBoxEl.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				if (rect.right > viewportWidth) {
					const newLeft = Math.max(
						10,
						relativeLeft - rect.width - 10
					);
					promptBoxEl.setCssProps({ left: `${newLeft}px` });
				}

				if (rect.bottom > viewportHeight) {
					const newTop = Math.max(10, relativeTop - rect.height - 20);
					promptBoxEl.setCssProps({ top: `${newTop}px` });
				}
			}
		}
	}

	/**
	 * Register event handlers for prompt box
	 */
	private registerPromptBoxEvents(
		mountEl: HTMLElement,
		promptBox: QuickPromptBoxExports
	) {
		// Handle escape key globally
		this.plugin.registerDomEvent(mountEl, "keydown", e => {
			if (e.key === "Escape") {
				const promptBoxEl = mountEl.querySelector(
					".quick-prompt-box--active"
				);
				if (promptBoxEl) {
					promptBox.hide();
				}
			}
		});
	}

	private handleSubmit(payload: {
		prompt: string;
		modelId: string;
		outputMode: string;
		inputSource: InputSource;
	}) {
		void this.processPrompt(
			payload.prompt,
			payload.modelId,
			payload.outputMode,
			payload.inputSource
		);
	}

	/**
	 * Process the submitted prompt using PromptProcessor
	 */
	private async processPrompt(
		userPrompt: string,
		modelId?: string,
		outputMode: string = "replace",
		inputSource: InputSource = "CURSOR"
	) {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		const handler = new ActionHandler(this.plugin.settings, this.plugin);

		// Prepare quick prompt action (existing logic)
		const quickPromptAction = {
			...this.plugin.settings.quickPrompt,
			model: modelId || this.plugin.settings.quickPrompt.model,
			loc:
				outputMode === "append"
					? Location.APPEND_CURRENT
					: Location.REPLACE_CURRENT,
			showModalWindow: false, // Quick prompts never show modal
		};

		// Map UI inputSource to Selection enum and override sel
		const selMap: Record<InputSource, Selection> = {
			CURSOR: Selection.CURSOR,
			CLIPBOARD: Selection.CLIPBOARD,
			ALL: Selection.ALL,
		};
		quickPromptAction.sel = selMap[inputSource] ?? Selection.CURSOR;

		// Get text input based on selection mode
		const text = await handler.getTextInput(quickPromptAction.sel, editor);

		const promptProcessor = new PromptProcessor(
			this.plugin.settings,
			this.plugin
		);
		await promptProcessor.processPrompt({
			action: quickPromptAction,
			input: text,
			editor,
			view,
			app: this.plugin.app,
			userPrompt,
			outputMode,
			plugin: this.plugin,
		});
	}

	/**
	 * Destroy all prompt boxes
	 */
	destroy() {
		this.promptBoxCache.forEach(({ promptBox, mountEl }) => {
			void unmount(promptBox);
			if (mountEl.isConnected) {
				mountEl.remove();
			}
		});
		this.promptBoxCache.clear();
	}
}
