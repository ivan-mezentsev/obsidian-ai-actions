<script lang="ts">
	import { RefreshCcw as ReplaceIcon, MoveDown as AppendIcon, X as CloseIcon, Send as SubmitIcon, ClipboardPaste as ClipboardIcon, TextCursorInput as SelectionIcon, FileText as SelectionAllIcon } from "lucide-svelte";
	import { nextInputSource, getInputSourceMeta, type InputSource } from "../utils/inputSource";
	import { getOutputModeMeta, type OutputMode, toggleOutputMode as toggleOutputModeUtil } from "../utils/outputMode";
	import { createEventDispatcher } from "svelte";
	import { App, MarkdownView, Platform } from "obsidian";
	import type { AIModel, AIProvider } from "../types";
	import { FilterableDropdown } from "./FilterableDropdown";
	import type { FilterableDropdownOption } from "./FilterableDropdown";

	// Get app instance from global context
	let app: App;
	if (typeof window !== 'undefined' && (window as any).app) {
		app = (window as any).app;
	}

	export let visible: boolean = false;
	export let prompt: string = "";
	export let cid: string = "";
	export let availableModels: AIModel[] = [];
	export let availableProviders: AIProvider[] = [];
	export let selectedModelId: string = "";
	export let defaultModelId: string = "";
	export let outputMode: OutputMode = "replace"; // "replace" or "append"
	// Input source toggle local state
	export let inputSource: InputSource = "CURSOR";
	export let loadModelsAsync: () => Promise<AIModel[]>; // Function to load models asynchronously

	// Detect OS for keyboard shortcuts
	const shortcutKey = Platform.isMacOS ? 'Cmd' : 'Ctrl';
	const dynamicPlaceholder = Platform.isMobile ? 'Prompt...' : `Prompt... ${shortcutKey}+Enter to submit, Esc to close`;
	// Accessible tooltip/label for Submit button with correct Ctrl/Cmd hint
	$: submitAriaLabel = Platform.isMobile ? 'Submit prompt' : `Submit prompt (${shortcutKey}+Enter)`;

	const dispatch = createEventDispatcher();
	const iconSize = 18;
	let containerEl: HTMLDivElement;
	let promptEl: HTMLTextAreaElement;
	let modelDropdownEl: HTMLElement;
	let modelDropdown: FilterableDropdown | null = null;
	let selectedModelName: string = "Select Model";

	// Output mode meta
	$: outputModeMeta = getOutputModeMeta(outputMode);

	// Input source options metadata
	// derive meta for aria/tooltip
	$: inputSourceMeta = getInputSourceMeta(inputSource);

	// Initialize selected model with default
	$: if (selectedModelId === "" && defaultModelId !== "") {
		selectedModelId = defaultModelId;
	}

	// Get selected model name for display with provider
	$: {
		const selectedModel = availableModels.find(m => m.id === selectedModelId);
		if (selectedModel) {
			// Find provider name by providerId
			const providerName = getProviderNameForModel(selectedModel);
			const fullName = providerName ? `${selectedModel.name} (${providerName})` : selectedModel.name;
			// Truncate if too long
			selectedModelName = truncateText(fullName, 25);
		} else {
			selectedModelName = "Select Model";
		}
	}

	// Helper function to get provider name for a model
	function getProviderNameForModel(model: AIModel): string {
		// Handle plugin AI providers
		if (model.id.startsWith('plugin_ai_providers_')) {
			return "Plugin AI Providers";
		}
		// For internal providers, find by providerId
		const provider = availableProviders.find(p => p.id === model.providerId);
		return provider ? provider.name : "Unknown Provider";
	}

	// Helper function to truncate text with ellipsis
	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) {
			return text;
		}
		return text.substring(0, maxLength - 3) + "...";
	}

	// Load models asynchronously when component becomes visible
	$: if (loadModelsAsync && visible) {
		loadModelsAsync().then(models => {
			if (models && models.length > 0) {
				availableModels = models;

				// Check if currently selected model is still available
				const isCurrentModelAvailable = models.some(m => m.id === selectedModelId);
				if (!isCurrentModelAvailable) {
					// If current model is not available, use default model
					selectedModelId = defaultModelId;
				}

				// Initialize dropdown after models are loaded
				setTimeout(() => {
					if (modelDropdownEl) {
						initializeModelDropdown();
					}
				}, 10);
			}
		}).catch(error => {
			console.error('Failed to load models:', error);
		});
	}

	// Initialize filterable dropdown when models change
	$: if (availableModels.length > 0 && modelDropdownEl && !modelDropdown) {
		initializeModelDropdown();
	}

	// Update dropdown when selectedModelId changes externally
	$: if (modelDropdown && selectedModelId) {
		modelDropdown.setValue(selectedModelId);
	}

	function initializeModelDropdown() {
		if (!modelDropdownEl || availableModels.length === 0) return;

		// Clean up existing dropdown
		if (modelDropdown) {
			modelDropdown.destroy();
		}

		// Create options for the filterable dropdown
		const options: FilterableDropdownOption[] = availableModels.map(model => {
			const providerName = getProviderNameForModel(model);
			const displayName = `${model.name} (${providerName})`;
			return {
				value: model.id,
				label: displayName,
				model: model
			};
		});

		// Create the filterable dropdown
		modelDropdown = new FilterableDropdown(
			modelDropdownEl,
			options,
			selectedModelId || availableModels[0].id,
			(value) => {
				selectedModelId = value;
			}
		);
	}

	// Cleanup on component destroy
	function destroyModelDropdown() {
		if (modelDropdown) {
			modelDropdown.destroy();
			modelDropdown = null;
		}
	}

	// Auto-resize textarea function
	const autoResize = (element: HTMLTextAreaElement) => {
		// Remove any existing height classes
		element.classList.remove('ai-actions-textarea-auto', 'ai-actions-textarea-resized');

		const lineHeight = 20; // Approximate line height
		const padding = 16; // Top and bottom padding
		const maxLines = 4;
		const minHeight = 40;
		const maxHeight = (lineHeight * maxLines) + padding;

		// Temporarily add auto class to measure scrollHeight
		element.classList.add('ai-actions-textarea-auto');
		const newHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);

		// Use CSS custom property for dynamic height
		element.style.setProperty('--dynamic-height', newHeight + 'px');
		element.classList.remove('ai-actions-textarea-auto');
		element.classList.add('ai-actions-textarea-resized');
	};

	export function show(initialPrompt?: string) {
		visible = true;
		if (initialPrompt !== undefined) {
			prompt = initialPrompt;
		}
		setTimeout(() => {
			if (promptEl) {
				promptEl.focus();
				if (prompt) {
					promptEl.select();
				}
				autoResize(promptEl);
			}
		}, 50);
	}

	export function hide() {
		visible = false;
		// Don't clear prompt here to preserve user input

		// Return focus to editor when hiding prompt box
		setTimeout(() => {
			const activeView = app?.workspace?.getActiveViewOfType?.(MarkdownView);
			if (activeView?.editor) {
				activeView.editor.focus();
			}
		}, 50);
	}

	const onPromptChanged = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		prompt = target.value;
		autoResize(target);
	};

	// Clear prompt when component is hidden
	$: if (!visible) {
		// Only clear if we're actually hiding, not on initial load
		if (promptEl && document.contains(promptEl)) {
			setTimeout(() => {
				if (!visible) {
					prompt = "";
				}
			}, 200); // Wait for animation to complete
		}
	}

	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			hide();
			dispatch('close');
		} else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			submitPrompt();
		}
	};

	const submitPrompt = () => {
		if (prompt.trim() && selectedModelId) {
			dispatch('submit', { prompt: prompt.trim(), modelId: selectedModelId, outputMode, inputSource });

			setTimeout(() => {
				hide();
			}, 100);

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
		}
	};


	const toggleOutputMode = () => {
		outputMode = toggleOutputModeUtil(outputMode);
	};

	const toggleInputSource = () => {
		inputSource = nextInputSource(inputSource);
	};

	const closePrompt = () => {
		hide();
		dispatch('close');
	};

	const defaultEnterEvent = (e: KeyboardEvent) => {
		const isEnterPress = ["Enter", "NumpadEnter"].includes(e.code);
		if (isEnterPress) {
			e.preventDefault();
			const el = e.target as HTMLElement;
			el.click();
		}
	};

	// Focus management: keep Tab focus cycling within the prompt box
	function getFocusableElements(root: HTMLElement): HTMLElement[] {
		const selector = [
			'button',
			'[href]',
			'input',
			'select',
			'textarea',
			'[tabindex]:not([tabindex="-1"])'
		].join(',');
		const nodeList = root.querySelectorAll(selector);
		const elements: HTMLElement[] = [];
		nodeList.forEach((el) => {
			const element = el as HTMLElement;
			const disabled = (element as HTMLButtonElement).disabled === true;
			const isHidden = element.offsetParent === null || getComputedStyle(element).visibility === 'hidden';
			if (!disabled && !isHidden) {
				elements.push(element);
			}
		});
		return elements;
	}

	const onContainerKeydown = (e: KeyboardEvent) => {
		if (e.key !== 'Tab' || !containerEl || !visible) return;
		const focusables = getFocusableElements(containerEl);
		if (focusables.length === 0) return;
		const active = (document.activeElement as HTMLElement) || null;
		const currentIndex = active ? focusables.indexOf(active) : -1;
		const direction = e.shiftKey ? -1 : 1;
		let nextIndex: number;
		if (currentIndex === -1) {
			nextIndex = direction === 1 ? 0 : focusables.length - 1;
		} else {
			nextIndex = (currentIndex + direction + focusables.length) % focusables.length;
		}
		e.preventDefault();
		focusables[nextIndex]?.focus();
	};
</script>

<div
	data-cid={cid}
	class={`quick-prompt-box ${visible ? "quick-prompt-box--active" : "quick-prompt-box--hidden"}`}
	bind:this={containerEl}
	on:keydown={onContainerKeydown}
	role="dialog"
	aria-modal="true"
	tabindex="-1"
>
	<div class="prompt-container">
		<textarea
			wrap="soft"
			autocapitalize="off"
			spellcheck="false"
			on:input={onPromptChanged}
			on:keydown={onKeyDown}
			rows="1"
			class="prompt-input ai-actions-auto-resize-textarea"
			bind:this={promptEl}
			bind:value={prompt}
			placeholder={dynamicPlaceholder}
			tabindex="0"
		></textarea>
		<div class="prompt-actions">
			<!-- Input Source Toggle -->
			<div
				class="mode-toggle"
				on:click={toggleInputSource}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label={inputSourceMeta.aria}
				data-testid="input-source-toggle"
			>
				<span class="mode-symbol" data-icon={inputSourceMeta.iconKey}>
					<span class="icon icon--cursor"><SelectionIcon size={iconSize} /></span>
					<span class="icon icon--clipboard"><ClipboardIcon size={iconSize} /></span>
					<span class="icon icon--all"><SelectionAllIcon size={iconSize} /></span>
				</span>
			</div>
			<!-- Output Mode Toggle -->
			<div
				class="mode-toggle"
				on:click={toggleOutputMode}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label={outputModeMeta.aria}
				data-testid="output-mode-toggle"
			>
				<span class="mode-symbol" data-icon={outputModeMeta.iconKey}>
					<span class="icon icon--replace"><ReplaceIcon size={iconSize} /></span>
					<span class="icon icon--append"><AppendIcon size={iconSize} /></span>
				</span>
			</div>

			<!-- Model Selector Dropdown -->
			<div class="model-selector" bind:this={modelDropdownEl}>
				<!-- FilterableDropdown will be rendered here -->
			</div>

			<div
				class="prompt-btn prompt-btn--submit"
				on:click={submitPrompt}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label={submitAriaLabel}
			>
				<SubmitIcon size={iconSize} />
			</div>
			<div
				class="prompt-btn prompt-btn--close"
				on:click={closePrompt}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label="Close (Esc)"
			>
				<CloseIcon size={iconSize} />
			</div>
		</div>
	</div>

</div>

<style>
	:root {
		--quick-prompt-border-color: var(--interactive-accent);
		--quick-prompt-bg: var(--background-primary);
		--quick-prompt-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	/* Ensure background is always visible */
	.quick-prompt-box {
		background-color: var(--background-primary) !important;
	}

	.quick-prompt-box {
		position: absolute;
		z-index: 1000;
		background-color: var(--background-primary);
		border: 1px solid var(--interactive-accent);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 360px;
		max-width: 600px;
		padding: 4px;
		transition: opacity 0.2s ease, transform 0.2s ease;
	}

	.quick-prompt-box--active {
		opacity: 1;
		transform: translateY(0);
		pointer-events: all;
	}

	.quick-prompt-box--hidden {
		opacity: 0;
		transform: translateY(-10px);
		pointer-events: none;
		user-select: none;
	}

	.prompt-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.prompt-input {
		width: 100%;
		min-height: 40px;
		max-height: 96px; /* 4 lines: (20px * 4) + 16px padding */
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-family: var(--font-interface);
		font-size: 14px;
		resize: none;
		box-shadow: none;
		outline: none;
		overflow-y: auto;
		line-height: 20px;
	}

	/* Auto-resize textarea classes */
	:global(.ai-actions-textarea-auto) {
		height: auto !important;
	}

	:global(.ai-actions-textarea-resized) {
		height: var(--dynamic-height) !important;
	}

	.prompt-input:focus {
		border-color: var(--quick-prompt-border-color);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.prompt-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.prompt-btn {
		width: 32px;
		height: 32px;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s ease;
		border: 1px solid transparent;
	}

	.prompt-btn:hover {
		background-color: var(--background-modifier-hover);
	}

	.prompt-btn:focus {
		outline: none;
		border-color: var(--quick-prompt-border-color);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.prompt-btn--submit {
		color: var(--interactive-accent);
	}

	.prompt-btn--submit:hover {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.prompt-btn--close {
		color: var(--interactive-accent);
	}

	/* Mode Toggle Styles */
	.mode-toggle {
		width: 32px;
		height: 32px;
		display: flex;
		justify-content: center;
		align-items: center;
		border: 1px solid transparent;
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--interactive-accent);
		cursor: pointer;
		transition: all 0.2s ease;
		margin-right: 8px;
	}

	.mode-toggle:hover {
		background-color: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.mode-toggle:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.mode-symbol {
		font-size: 14px;
		line-height: 1;
		user-select: none;
	}

	/* Icon visibility controlled via data attribute */
	.mode-symbol .icon { display: none; }
	.mode-symbol[data-icon="cursor"] .icon--cursor { display: inline-flex; }
	.mode-symbol[data-icon="clipboard"] .icon--clipboard { display: inline-flex; }
	.mode-symbol[data-icon="all"] .icon--all { display: inline-flex; }
	/* Output mode icons */
	.mode-symbol[data-icon="replace"] .icon--replace { display: inline-flex; }
	.mode-symbol[data-icon="append"] .icon--append { display: inline-flex; }

	/* Model Selector Styles */
	.model-selector {
		position: relative;
		margin-right: 8px;
	}

	.model-selector-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 12px;
		width: 180px;
		max-width: 180px;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.model-selector-button:hover {
		background-color: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.model-selector-button:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.model-name {
		flex: 1;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	:global(.model-selector-button .rotated) {
		transform: rotate(180deg);
	}

	.model-dropdown {
		position: absolute;
		left: 0;
		right: 0;
		z-index: 1001;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-height: 200px;
		overflow-y: auto;
	}

	.model-dropdown--down {
		top: 100%;
		margin-top: 2px;
	}

	.model-dropdown--up {
		bottom: 100%;
		margin-bottom: 2px;
	}

	.model-option {
		padding: 8px 12px;
		cursor: pointer;
		font-size: 12px;
		color: var(--text-normal);
		transition: background-color 0.2s ease;
		border-bottom: 1px solid var(--background-modifier-border-hover);
	}

	.model-option:last-child {
		border-bottom: none;
	}

	.model-option:hover {
		background-color: var(--background-modifier-hover);
	}

	.model-option.selected {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.model-option:focus {
		outline: none;
		background-color: var(--background-modifier-hover);
	}

</style>
