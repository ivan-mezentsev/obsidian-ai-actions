import { MarkdownView } from "obsidian";
import ActionResultPanel from "./components/ActionResultPanel.svelte";
import type AIEditor from "./main";
import { Location } from "./action";

export class ActionResultManager {
	plugin: AIEditor;
	panelCache: Map<string, ActionResultPanel> = new Map();
	private currentResult: string = "";
	private currentFormat: ((text: string) => string) | null = null;
	private onAcceptCallback?: (result: string) => Promise<void>;
	private onLocationActionCallback?: (result: string, location: Location) => Promise<void>;
	private onCancelCallback?: () => void;
	private globalKeyHandler?: (e: KeyboardEvent) => void;

	constructor(plugin: AIEditor) {
		this.plugin = plugin;
		this.setupGlobalKeyHandler();
	}

	/**
	 * Get or create a result panel for the current view
	 */
	getResultPanel(): ActionResultPanel {
		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			throw new Error("No active MarkdownView found");
		}

		const targetEl = view.containerEl;
		const panelEl = targetEl.querySelector(".action-result-panel");

		// If panel already exists, find it in cache
		if (panelEl) {
			const cid = panelEl.getAttribute("data-cid");
			if (cid) {
				const cachedPanel = this.panelCache.get(cid);
				if (cachedPanel) {
					return cachedPanel;
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

		const panel = new ActionResultPanel({
			target: mountEl,
			props: {
				visible: false,
				cid: cid,
				hasFileOutput: false
			}
		});

		// Register event handlers
		this.registerPanelEvents(mountEl, panel);

		// Cache the panel
		this.panelCache.set(cid, panel);

		return panel;
	}

	/**
	 * Show the result panel after streaming is complete
	 */
	async showResultPanel(
		result: string,
		format: ((text: string) => string) | null,
		onAccept: (result: string) => Promise<void>,
		onLocationAction?: (result: string, location: Location) => Promise<void>,
		hasFileOutput: boolean = false,
		onCancel?: () => void
	) {
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
		panel.$set({ hasFileOutput });

		// Position and show the panel
		this.positionResultPanel();
		panel.show();
	}

	/**
	 * Hide all result panels
	 */
	hideAllPanels() {
		this.panelCache.forEach((panel) => {
			panel.hide();
		});
	}

	/**
	 * Position the result panel at fixed position (top-left)
	 */
	private positionResultPanel() {
		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const targetEl = view.containerEl;
		const panelEl = targetEl.querySelector(".action-result-panel") as HTMLElement;

		if (panelEl) {
			// Set fixed position at top-left (mirrored from reference project)
			panelEl.style.setProperty("top", "88px");
			panelEl.style.setProperty("left", "48px");
		}
	}

	/**
	 * Register event handlers for result panel
	 */
	private registerPanelEvents(
		mountEl: HTMLElement,
		panel: ActionResultPanel
	) {
		// Handle action event (location-based actions)
		panel.$on("action", async (event: any) => {
			const { location } = event.detail;
			if (this.onLocationActionCallback && this.currentResult) {
				const formattedResult = this.currentFormat ? this.currentFormat(this.currentResult) : this.currentResult;
				await this.onLocationActionCallback(formattedResult, location);
			}
		});

		// Handle edit event
		panel.$on("edit", async () => {
			if (this.onAcceptCallback && this.currentResult) {
				// For edit, we'll need to implement a text editor modal
				// For now, just accept the current result
				const formattedResult = this.currentFormat ? this.currentFormat(this.currentResult) : this.currentResult;
				await this.onAcceptCallback(formattedResult);
			}
		});

		// Handle cancel event
		panel.$on("cancel", () => {
			panel.hide();
			if (this.onCancelCallback) {
				this.onCancelCallback();
			}
		});
	}

	/**
	 * Setup global keyboard event handler for escape key
	 */
	private setupGlobalKeyHandler() {
		this.globalKeyHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// Check if any result panel is currently active
				const activePanelEl = document.querySelector(".action-result-panel--active");
				if (activePanelEl) {
					const cid = activePanelEl.getAttribute("data-cid");
					if (cid) {
						const panel = this.panelCache.get(cid);
						if (panel) {
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
		this.plugin.registerDomEvent(document, "keydown", this.globalKeyHandler);
	}

	/**
	 * Destroy all result panels
	 */
	destroy() {
		this.panelCache.forEach((panel, cid) => {
			if (panel) {
				// Find and remove the DOM element
				const element = document.querySelector(`[data-cid="${cid}"]`);
				if (element) {
					element.remove();
				}
				// Destroy the Svelte component
				panel.$destroy();
			}
		});
		this.panelCache.clear();
	}
}