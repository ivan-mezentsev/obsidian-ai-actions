<script lang="ts">
	import { X } from "lucide-svelte";
	import { createEventDispatcher } from "svelte";
	import { Location } from "../action";

	export let visible: boolean = false;
	export let cid: string = "";
	export let hasFileOutput: boolean = false;

	const dispatch = createEventDispatcher();
	const iconSize = 18;

	export function show() {
		visible = true;
	}

	export function hide() {
		visible = false;
	}

	const handleAction = (location: Location) => {
		dispatch('action', { location });
		hide();
	};



	const handleCancel = () => {
		dispatch('cancel');
		hide();
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
	class={`action-result-panel ${visible ? "action-result-panel--active" : "action-result-panel--hidden"}`}
>
	<div class="panel-container">
		<div class="action-buttons">
			<div
				class="action-btn action-btn--replace"
				on:click={() => handleAction(Location.REPLACE_CURRENT)}
				on:keydown={defaultEnterEvent}
				role="button"
				tabindex="0"
				title="Replace selected text"
			>
				Replace
			</div>
			<div
				class="action-btn action-btn--insert"
				on:click={() => handleAction(Location.APPEND_CURRENT)}
				on:keydown={defaultEnterEvent}
				role="button"
				tabindex="0"
				title="Insert at cursor"
			>
				Insert
			</div>
			<div
				class="action-btn action-btn--begin"
				on:click={() => handleAction(Location.INSERT_HEAD)}
				on:keydown={defaultEnterEvent}
				role="button"
				tabindex="0"
				title="Insert at beginning"
			>
				Begin
			</div>
			<div
				class="action-btn action-btn--end"
				on:click={() => handleAction(Location.APPEND_BOTTOM)}
				on:keydown={defaultEnterEvent}
				role="button"
				tabindex="0"
				title="Insert at end"
			>
				End
			</div>
			{#if hasFileOutput}
				<div
					class="action-btn action-btn--file"
					on:click={() => handleAction(Location.APPEND_TO_FILE)}
					on:keydown={defaultEnterEvent}
					role="button"
					tabindex="0"
					title="Save to file"
				>
					File
				</div>
			{/if}
			<div
				class="action-btn action-btn--cancel"
				on:click={handleCancel}
				on:keydown={defaultEnterEvent}
				role="button"
				tabindex="0"
				title="Cancel"
			>
				<X size={iconSize} />
			</div>
		</div>
	</div>
</div>

<style>
	:root {
		--action-panel-border-color: var(--interactive-accent);
		--action-panel-bg: var(--background-primary);
		--action-panel-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.action-result-panel {
		position: absolute;
		z-index: 1000;
		background-color: var(--background-primary);
		border: 1px solid var(--interactive-accent);
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		min-width: 280px;
		max-width: 400px;
		padding: 4px;
		transition: opacity 0.2s ease, transform 0.2s ease, left 0.3s cubic-bezier(0.45, 0.05, 0.55, 0.95);
	}

	.action-result-panel--active {
		opacity: 1;
		transform: translateY(0);
		pointer-events: all;
	}

	.action-result-panel--hidden {
		opacity: 0;
		transform: translateY(-10px);
		pointer-events: none;
		user-select: none;
	}

	.panel-container {
		display: flex;
		flex-direction: column;
	}

	.action-buttons {
		display: flex;
		gap: 4px;
		justify-content: center;
		flex-wrap: wrap;
		padding: 2px;
	}

	.action-btn {
		padding: 6px 12px;
		display: flex;
		justify-content: center;
		align-items: center;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s ease;
		border: 1px solid transparent;
		color: var(--text-normal);
		font-size: 12px;
		font-family: var(--font-interface);
		min-width: 50px;
		gap: 4px;
	}

	.action-btn:hover {
		background-color: var(--background-modifier-hover);
	}

	.action-btn:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.action-btn--replace {
		color: var(--interactive-accent);
	}

	.action-btn--replace:hover {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.action-btn--cancel {
		color: var(--text-muted);
		min-width: 32px;
		padding: 6px 8px;
	}

	.action-btn--cancel:hover {
		color: var(--text-error);
		border-color: var(--text-error);
	}
</style>