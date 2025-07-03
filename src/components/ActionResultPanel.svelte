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

	const handleEdit = () => {
		dispatch('edit');
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
		<!-- Primary action buttons -->
		<div class="action-buttons primary-actions">
			<button
				class="action-btn action-btn--replace"
				on:click={() => handleAction(Location.REPLACE_CURRENT)}
				on:keydown={defaultEnterEvent}
				title="Replace selected text"
			>
				Replace
			</button>
			<button
				class="action-btn action-btn--insert"
				on:click={() => handleAction(Location.APPEND_CURRENT)}
				on:keydown={defaultEnterEvent}
				title="Insert at cursor"
			>
				Insert
			</button>
			<button
				class="action-btn action-btn--begin"
				on:click={() => handleAction(Location.INSERT_HEAD)}
				on:keydown={defaultEnterEvent}
				title="Insert at beginning"
			>
				Begin
			</button>
			<button
				class="action-btn action-btn--end"
				on:click={() => handleAction(Location.APPEND_BOTTOM)}
				on:keydown={defaultEnterEvent}
				title="Insert at end"
			>
				End
			</button>
		</div>

		<!-- Secondary action buttons -->
		<div class="action-buttons secondary-actions">
			<button
				class="action-btn action-btn--edit"
				on:click={handleEdit}
				on:keydown={defaultEnterEvent}
				title="Edit result"
			>
				Edit
			</button>
			{#if hasFileOutput}
				<button
					class="action-btn action-btn--file"
					on:click={() => handleAction(Location.APPEND_TO_FILE)}
					on:keydown={defaultEnterEvent}
					title="Save to file"
				>
					File
				</button>
			{/if}
			<button
				class="action-btn action-btn--cancel"
				on:click={handleCancel}
				on:keydown={defaultEnterEvent}
				title="Cancel"
			>
				<X size={iconSize} />
			</button>
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
		padding: 8px;
		transition: opacity 0.2s ease, transform 0.2s ease;
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
		gap: 6px;
	}

	.action-buttons {
		display: flex;
		gap: 6px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.primary-actions {
		border-bottom: 1px solid var(--background-modifier-border);
		padding-bottom: 6px;
	}

	.action-btn {
		padding: 6px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 12px;
		font-family: var(--font-interface);
		transition: all 0.2s ease;
		min-width: 50px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}

	.action-btn:hover {
		background-color: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
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