import { MarkdownView } from "obsidian";
import { mount, unmount } from "svelte";
import type { Component } from "svelte";
import ActionResultPanel from "./components/ActionResultPanel.svelte";
import type AIEditor from "./main";
import { Location } from "./action";

type ActionResultPanelUpdateProps = {
	hasFileOutput?: boolean;
	defaultLocation?: Location;
};

type ActionResultPanelProps = {
	visible: boolean;
	cid: string;
	hasFileOutput: boolean;
	defaultLocation: Location;
	onAction?: (location: Location) => void;
	onCancel?: () => void;
};

type ActionResultPanelExports = {
	show: () => void;
	hide: () => void;
	updateProps: (props: ActionResultPanelUpdateProps) => void;
};

type ActionResultPanelEntry = {
	panel: ActionResultPanelExports;
	mountEl: HTMLElement;
};

export class ActionResultManager {
	plugin: AIEditor;
	panelCache: Map<string, ActionResultPanelEntry> = new Map();
	private currentResult: string = "";
	private currentFormat: ((text: string) => string) | null = null;
	private onAcceptCallback?: (result: string) => Promise<void>;
	private onLocationActionCallback?: (
		result: string,
		location: Location
	) => Promise<void>;
	private onCancelCallback?: () => void;
	private globalKeyHandler?: (e: KeyboardEvent) => void;

	constructor(plugin: AIEditor) {
		this.plugin = plugin;
		this.setupGlobalKeyHandler();
	}

	/**
	 * Get or create a result panel for the current view
	 */
	getResultPanel(): ActionResultPanelExports {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			throw new Error("No active MarkdownView found");
		}

		const targetEl = view.containerEl;
		const panelEl = targetEl.querySelector(".action-result-panel");

		// If panel already exists, find it in cache
		if (panelEl) {
			const cid = panelEl.getAttribute("data-cid");
			if (cid) {
				const cachedEntry = this.panelCache.get(cid);
				if (cachedEntry) {
					return cachedEntry.panel;
				} else {
					// Orphaned element, remove it
					panelEl.remove();
				}
			} else {
				// Element without cid, remove it
				panelEl.remove();
			}
		}

		// Create new panel
		const cid = Date.now().toString();
		const mountEl = targetEl.createDiv();
		const panel = mount<ActionResultPanelProps, ActionResultPanelExports>(
			ActionResultPanel as unknown as Component<
				ActionResultPanelProps,
				ActionResultPanelExports
			>,
			{
				target: mountEl,
				props: {
					visible: false,
					cid: cid,
					hasFileOutput: false,
					defaultLocation: Location.REPLACE_CURRENT,
					onAction: (location: Location) => {
						void this.handleLocationAction(location);
					},
					onCancel: () => {
						this.handleCancel();
					},
				},
			}
		);

		// Cache the panel
		this.panelCache.set(cid, { panel, mountEl });

		return panel;
	}

	/**
	 * Show the result panel after streaming is complete
	 */
	showResultPanel(
		result: string,
		format: ((text: string) => string) | null,
		onAccept: (result: string) => Promise<void>,
		onLocationAction?: (
			result: string,
			location: Location
		) => Promise<void>,
		hasFileOutput: boolean = false,
		onCancel?: () => void,
		defaultLocation: Location = Location.REPLACE_CURRENT
	): void {
		// Hide any existing panels first
		this.hideAllPanels();

		// Store callbacks and result
		this.currentResult = result;
		this.currentFormat = format;
		this.onAcceptCallback = onAccept;
		this.onLocationActionCallback = onLocationAction;
		this.onCancelCallback = onCancel;

		const panel = this.getResultPanel();

		// Update panel props
		panel.updateProps({ hasFileOutput, defaultLocation });

		// Position and show the panel
		this.positionResultPanel();
		panel.show();
	}

	/**
	 * Hide all result panels
	 */
	hideAllPanels() {
		this.panelCache.forEach(({ panel }) => {
			panel.hide();
		});
	}

	/**
	 * Position the result panel at fixed position (top-left)
	 */
	private positionResultPanel() {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const targetEl = view.containerEl;
		const panelEl = targetEl.querySelector(
			".action-result-panel"
		) as HTMLElement;

		if (panelEl) {
			// Set fixed position at top-left (mirrored from reference project)
			panelEl.setCssProps({
				top: "88px",
				left: "48px",
			});
		}
	}

	/**
	 * Handle action event (location-based actions)
	 */
	private async handleLocationAction(location: Location): Promise<void> {
		if (this.onLocationActionCallback && this.currentResult) {
			const formattedResult = this.currentFormat
				? this.currentFormat(this.currentResult)
				: this.currentResult;
			await this.onLocationActionCallback(formattedResult, location);
		}
	}

	/**
	 * Handle edit event
	 */
	private async handleEdit(): Promise<void> {
		if (this.onAcceptCallback && this.currentResult) {
			// For edit, we'll need to implement a text editor modal
			// For now, just accept the current result
			const formattedResult = this.currentFormat
				? this.currentFormat(this.currentResult)
				: this.currentResult;
			await this.onAcceptCallback(formattedResult);
		}
	}

	/**
	 * Handle cancel event
	 */
	private handleCancel(): void {
		if (this.onCancelCallback) {
			this.onCancelCallback();
		}
	}

	/**
	 * Setup global keyboard event handler for escape key
	 */
	private setupGlobalKeyHandler() {
		this.globalKeyHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// Check if any result panel is currently active
				const activePanelEl = document.querySelector(
					".action-result-panel--active"
				);
				if (activePanelEl) {
					const cid = activePanelEl.getAttribute("data-cid");
					if (cid) {
						const entry = this.panelCache.get(cid);
						if (entry) {
							const { panel } = entry;
							e.preventDefault();
							e.stopPropagation();
							panel.hide();
							if (this.onCancelCallback) {
								this.onCancelCallback();
							}
						}
					}
				}
			}
		};

		// Register global keydown event
		this.plugin.registerDomEvent(
			document,
			"keydown",
			this.globalKeyHandler
		);
	}

	/**
	 * Destroy all result panels
	 */
	destroy() {
		this.panelCache.forEach(({ panel, mountEl }) => {
			void unmount(panel);
			if (mountEl.isConnected) {
				mountEl.remove();
			}
		});
		this.panelCache.clear();
	}
}
