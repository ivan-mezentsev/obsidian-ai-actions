<script lang="ts">
	import { X, Send, ChevronDown } from "lucide-svelte";
	import { createEventDispatcher } from "svelte";
	import type { AIModel } from "../types";

	export let visible: boolean = false;
	export let prompt: string = "";
	export let cid: string = "";
	export let availableModels: AIModel[] = [];
	export let selectedModelId: string = "";
	export let defaultModelId: string = "";

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

	// Initialize selected model with default
	$: if (selectedModelId === "" && defaultModelId !== "") {
		selectedModelId = defaultModelId;
	}

	// Get selected model name for display
	$: selectedModelName = availableModels.find(m => m.id === selectedModelId)?.name || "Select Model";

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

	$: if (dropdownOpen) {
		document.addEventListener('click', handleClickOutside);
		// Calculate direction when dropdown opens
		setTimeout(calculateDropdownDirection, 0);
	} else {
		document.removeEventListener('click', handleClickOutside);
	}

	// Auto-resize textarea function
	const autoResize = (element: HTMLTextAreaElement) => {
		element.style.height = 'auto';
		const lineHeight = 20; // Approximate line height
		const padding = 16; // Top and bottom padding
		const maxLines = 4;
		const minHeight = 40;
		const maxHeight = (lineHeight * maxLines) + padding;
		
		const newHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
		element.style.height = newHeight + 'px';
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
			dispatch('submit', { prompt: prompt.trim(), modelId: selectedModelId });
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
			class="prompt-input"
			bind:this={promptEl}
			bind:value={prompt}
			placeholder={dynamicPlaceholder}
			tabindex="0"
		/>
		<div class="prompt-actions">
			<!-- Model Selector Dropdown -->
			<div class="model-selector" bind:this={dropdownEl}>
				<div
					class="model-selector-button"
					on:click={toggleDropdown}
					role="button"
					tabindex="0"
					on:keydown={defaultEnterEvent}
					aria-label="Select AI Model"
					title="Select AI Model"
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
								{model.name}
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
				title="Submit prompt (Ctrl+Enter)"
			>
				<Send size={iconSize} />
			</div>
			<div
				class="prompt-btn prompt-btn--close"
				on:click={closePrompt}
				role="button"
				tabindex="0"
				on:keydown={defaultEnterEvent}
				aria-label="Close"
				title="Close (Esc)"
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
		min-width: 120px;
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