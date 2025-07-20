import { App, Editor, MarkdownView, Notice, Modal } from "obsidian";
import AIEditor from "./main";
import { getAvailableModelsWithPluginAIProviders } from "./action";
import type { UserAction } from "./action";
import type { AIModel, AIProvider } from "./types";
import { FilterableDropdown } from "./components/FilterableDropdown";
import type { FilterableDropdownOption } from "./components/FilterableDropdown";

class ModelSelectionModal extends Modal {
	private plugin: AIEditor;
	private selectedModelId: string;
	private availableModels: AIModel[] = [];
	private availableProviders: AIProvider[] = [];
	private defaultModelId: string;
	private onSubmit: (modelId: string) => void;
	private onCancel: () => void;
	private filterableDropdown: FilterableDropdown | null = null;
	private dropdownContainer: HTMLElement;

	constructor(
		app: App,
		plugin: AIEditor,
		currentModelId: string,
		onSubmit: (modelId: string) => void,
		onCancel: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.selectedModelId = currentModelId;
		this.defaultModelId = plugin.settings.aiProviders?.defaultModelId || "";
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
		
		// Add CSS class for styling
		this.modalEl.addClass("ai-actions-model-selection-modal");
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Load models
		try {
			this.availableModels = await getAvailableModelsWithPluginAIProviders(this.plugin.settings);
			this.availableProviders = this.plugin.settings.aiProviders?.providers || [];
		} catch (error) {
			console.error('Failed to load models:', error);
			this.availableModels = [];
			this.availableProviders = [];
		}

		// Set selected model if current is not available
		const isCurrentModelAvailable = this.availableModels.some(m => m.id === this.selectedModelId);
		if (!isCurrentModelAvailable) {
			this.selectedModelId = this.defaultModelId || (this.availableModels[0]?.id || "");
		}

		// Create message
		const messageEl = contentEl.createDiv("ai-actions-modal-message");
		messageEl.textContent = "The assigned model is unavailable. Select another model.";

		// Create controls container
		const controlsEl = contentEl.createDiv("ai-actions-modal-controls");

		// Create dropdown container
		this.dropdownContainer = controlsEl.createDiv("ai-actions-modal-dropdown");

		// Create buttons container
		const buttonsEl = controlsEl.createDiv("ai-actions-modal-buttons");

		// Create Select button
		const selectBtn = buttonsEl.createEl("button", {
			text: "Select",
			cls: "mod-cta"
		});
		selectBtn.addEventListener("click", () => this.handleSubmit());

		// Create Cancel button
		const cancelBtn = buttonsEl.createEl("button", {
			text: "Cancel"
		});
		cancelBtn.addEventListener("click", () => this.handleCancel());

		// Initialize dropdown
		this.initializeDropdown();

		// Handle keyboard events
		this.scope.register([], "Escape", () => {
			this.handleCancel();
		});

		this.scope.register(["Mod"], "Enter", () => {
			this.handleSubmit();
		});
	}

	private initializeDropdown() {
		if (this.availableModels.length === 0) return;

		// Create options for the filterable dropdown
		const options: FilterableDropdownOption[] = this.availableModels.map(model => {
			const providerName = this.getProviderNameForModel(model);
			const displayName = `${model.name} (${providerName})`;
			return {
				value: model.id,
				label: displayName,
				model: model
			};
		});

		// Create the filterable dropdown
		this.filterableDropdown = new FilterableDropdown(
			this.dropdownContainer,
			options,
			this.selectedModelId || this.availableModels[0].id,
			(value) => {
				this.selectedModelId = value;
			}
		);
	}

	private getProviderNameForModel(model: AIModel): string {
		// Handle plugin AI providers
		if (model.id.startsWith('plugin_ai_providers_')) {
			return "Plugin AI Providers";
		}
		// For internal providers, find by providerId
		const provider = this.availableProviders.find(p => p.id === model.providerId);
		return provider ? provider.name : "Unknown Provider";
	}

	private handleSubmit() {
		if (this.selectedModelId) {
			this.onSubmit(this.selectedModelId);
			this.close();
		}
	}

	private handleCancel() {
		this.onCancel();
		this.close();
	}

	onClose() {
		if (this.filterableDropdown) {
			this.filterableDropdown.destroy();
			this.filterableDropdown = null;
		}
	}
}

export class ModalBoxManager {
	plugin: AIEditor;

	constructor(plugin: AIEditor) {
		this.plugin = plugin;
	}

	/**
	 * Check if a model is available in the current settings
	 */
	async isModelAvailable(modelId: string): Promise<boolean> {
		const availableModels = await getAvailableModelsWithPluginAIProviders(this.plugin.settings);
		return availableModels.some(model => model.id === modelId);
	}

	/**
	 * Show modal for model selection
	 */
	async showModelSelectionModal(currentModelId: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new ModelSelectionModal(
				this.plugin.app,
				this.plugin,
				currentModelId,
				(modelId: string) => resolve(modelId),
				() => resolve(null)
			);
			modal.open();
		});
	}



	/**
	 * Check if action model is available and show modal if not
	 * Returns the model ID to use (either original or newly selected)
	 */
	async validateAndSelectModel(action: UserAction): Promise<string | null> {
		const isAvailable = await this.isModelAvailable(action.model);
		
		if (isAvailable) {
			// Model is available, return original model ID
			return action.model;
		}
		
		// Model is not available, show selection modal
		const selectedModelId = await this.showModelSelectionModal(action.model);
		
		if (selectedModelId) {
			// Update the action's model ID
			action.model = selectedModelId;
			
			// Save the updated action to settings
			const actionIndex = this.plugin.settings.customActions.findIndex(a => a.name === action.name);
			if (actionIndex !== -1) {
				this.plugin.settings.customActions[actionIndex] = action;
				await this.plugin.saveSettings();
			}
			
			return selectedModelId;
		}
		
		// User cancelled, return null
		return null;
	}
}
