<script lang="ts">
	import { X, Send, ChevronDown } from "lucide-svelte";
	import { createEventDispatcher } from "svelte";
	import { App, MarkdownView } from "obsidian";
	import type { AIModel, AIProvider } from "../types";

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
	export let outputMode: string = "replace"; // "replace" or "append"

	// Detect OS for keyboard shortcuts
	const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
	const shortcutKey = isMac ? 'Cmd' : 'Ctrl';
	const dynamicPlaceholder = `Prompt... ${shortcutKey}+Enter to submit, Esc to close`;

	const dispatch = createEventDispatcher();
	const iconSize = 18;
	let promptEl: HTMLTextAreaElement;
	let dropdownOpen = false;
	let dropdownEl: HTMLElement;
	let dropdownDirection: 'down' | 'up' = 'down';
	// Removed mode dropdown variables - using toggle instead
	let selectedModelName: string = "Select Model";

	// Output mode options with symbols
	const outputModes: Record<string, { symbol: string; label: string }> = {
		replace: { symbol: "↻", label: "Replace" },
		append: { symbol: "↓", label: "Append" }
	};

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

	// Close dropdown when clicking outside
	const handleClickOutside = (event: MouseEvent) => {
		if (dropdownEl && !dropdownEl.contains(event.target as Node)) {
			dropdownOpen = false;
		}
	};

	// Calculate dropdown direction based on available space
	const calculateDropdownDirection = () => {
		if (!dropdownEl) return;
		
		const rect = dropdownEl.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;
		const dropdownHeight = Math.min(200, availableModels.length * 32 + 8); // Approximate dropdown height
		
		// If not enough space below but enough space above, open upward
		if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
			dropdownDirection = 'up';
		} else {
			dropdownDirection = 'down';
		}
	};

	// Removed mode dropdown direction calculation - using toggle instead

	$: if (dropdownOpen) {
		document.addEventListener('click', handleClickOutside);
		// Calculate direction when dropdown opens
		setTimeout(calculateDropdownDirection, 0);
	} else {
		document.removeEventListener('click', handleClickOutside);
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
			dispatch('submit', { prompt: prompt.trim(), modelId: selectedModelId, outputMode });
			hide();
		}
	};

	const selectModel = (modelId: string) => {
		selectedModelId = modelId;
		dropdownOpen = false;
	};

	const toggleDropdown = () => {
		dropdownOpen = !dropdownOpen;
	};

	const toggleOutputMode = () => {
		outputMode = outputMode === "replace" ? "append" : "replace";
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
</script>

<div
	data-cid={cid}
	class={`quick-prompt-box ${visible ? "quick-prompt-box--active" : "quick-prompt-box--hidden"}`}
>
	<div class="prompt-container">
		<textarea
			wrap="soft"
			autocorrect="off"
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
		/>
		<div class="prompt-actions">
			<!-- Output Mode Toggle -->
			<div
				class="mode-toggle"
				on:click={toggleOutputMode}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label="{outputModes[outputMode].label} (click to toggle)"
			>
				<span class="mode-symbol">{outputModes[outputMode].symbol}</span>
			</div>
			
			<!-- Model Selector Dropdown -->
			<div class="model-selector" bind:this={dropdownEl}>
				<div
					class="model-selector-button"
					on:click={toggleDropdown}
					role="button"
					tabindex="0"
					on:keydown={defaultEnterEvent}
					aria-label={(() => {
						const selectedModel = availableModels.find(m => m.id === selectedModelId);
						if (selectedModel) {
							const providerName = getProviderNameForModel(selectedModel);
							return providerName ? `${selectedModel.name} (${providerName})` : selectedModel.name;
						}
						return "Select AI Model";
					})()}
				>
					<span class="model-name">{selectedModelName}</span>
					<ChevronDown size={14} class={dropdownOpen ? 'rotated' : ''} />
				</div>
				{#if dropdownOpen}
					<div class="model-dropdown model-dropdown--{dropdownDirection}">
						{#each availableModels as model}
					<div
						class="model-option {selectedModelId === model.id ? 'selected' : ''}"
						on:click={() => selectModel(model.id)}
						role="button"
						tabindex="0"
						on:keydown={defaultEnterEvent}
					>
						{model.name} ({getProviderNameForModel(model)})
					</div>
				{/each}
					</div>
				{/if}
			</div>
			
			<div
				class="prompt-btn prompt-btn--submit"
				on:click={submitPrompt}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label="Submit prompt (Ctrl+Enter)"
			>
				<Send size={iconSize} />
			</div>
			<div
				class="prompt-btn prompt-btn--close"
				on:click={closePrompt}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label="Close (Esc)"
			>
				<X size={iconSize} />
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
		color: var(--text-muted);
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
		color: var(--text-muted);
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
