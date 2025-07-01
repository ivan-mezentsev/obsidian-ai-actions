import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import {
	modelDictionary,
	Location,
	Selection,
} from "src/action";
import type {
	UserAction,
} from "src/action";
import AIEditor from "src/main";
import type { Model } from "./llm/models";
import { OpenAIModel } from "./llm/openai_llm";
import { ActionEditModal } from "./modals/action_editor";
import { QuickPromptEditModal } from "./modals/quick_prompt_editor";
import type { AIProvider, AIModel, AIProvidersSettings, AIProviderType } from "./types";
import { ProviderEditModal } from "./modals/provider_editor";
import { ModelEditModal } from "./modals/model_editor";


export interface AIEditorSettings {
	openAiApiKey: string; // Deprecated, will be removed
	testingMode: boolean;
	defaultModel: string; // Deprecated, will be removed
	customActions: Array<UserAction>;
	quickPrompt: UserAction;
	aiProviders: AIProvidersSettings;
	useNativeFetch: boolean;
	debugMode: boolean;
	developmentMode: boolean;
}

export class AIEditorSettingTab extends PluginSettingTab {
	plugin: AIEditor;

	constructor(app: App, plugin: AIEditor) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// AI Providers Section
		containerEl.createEl("h1", { text: "AI Providers" });
		
		this.createButton(
			containerEl,
			"Add new AI provider",
			"Add Provider",
			() => {
				this.displayProviderEditModalForNew();
			},
			true
		);

		for (let i = 0; i < this.plugin.settings.aiProviders.providers.length; i++) {
			this.displayProviderByIndex(containerEl, i);
		}

		// AI Models Section
		containerEl.createEl("h1", { text: "AI Models" });
		
		this.createButton(
			containerEl,
			"Add new AI model",
			"Add Model",
			() => {
				this.displayModelEditModalForNew();
			},
			true
		);

		for (let i = 0; i < this.plugin.settings.aiProviders.models.length; i++) {
			this.displayModelByIndex(containerEl, i);
		}

		containerEl.createEl("h1", { text: "Custom actions" });

		this.createButton(
			containerEl,
			"Create custom action",
			"New",
			() => {
				this.displayActionEditModalForNewAction();
			},
			true
		);

		for (let i = 0; i < this.plugin.settings.customActions.length; i++) {
			this.displayActionByIndex(containerEl, i);
		}

		// General Section - moved to the bottom
		containerEl.createEl("h1", { text: "General" });

		// Quick Prompt Section
		this.createButton(
			containerEl,
			"Quick Prompt",
			"Edit",
			() => {
				this.displayQuickPromptEditModal();
			},
			false
		);

		// Development mode toggle with special styling
		const devModeContainer = containerEl.createDiv("ai-actions-dev-mode-container");
		devModeContainer.addClass("ai-actions-setting-item-highlighted");
		
		new Setting(devModeContainer)
			.setName("Development mode")
			.setDesc("Enable development options for plugin configuration and testing")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.developmentMode)
					.onChange(async (value) => {
						this.plugin.settings.developmentMode = value;
						await this.plugin.saveSettings();
						// Refresh the display to show/hide development options
						this.display();
					})
			);

		// Development options container - only visible when developmentMode is enabled
		const devOptionsContainer = containerEl.createDiv("ai-actions-dev-options-container");
		if (!this.plugin.settings.developmentMode) {
			devOptionsContainer.addClass("ai-actions-dev-options-hidden");
		}

		new Setting(devOptionsContainer)
			.setName("Testing mode")
			.setDesc(
				"Use testing mode to test custom action without calling AI APIs"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.testingMode)
					.onChange(async (value) => {
						this.plugin.settings.testingMode = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(devOptionsContainer)
			.setName("Use native fetch")
			.setDesc(
				"Use Obsidian's native fetch to bypass CORS restrictions. Enable this if you encounter CORS errors with AI providers."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useNativeFetch)
					.onChange(async (value) => {
						this.plugin.settings.useNativeFetch = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(devOptionsContainer)
			.setName("Debug mode")
			.setDesc(
				"Enable debug logging of all AI requests and responses with headers to the console. Check Developer Tools console to see the logs."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					})
			);
	}

	displayActionByIndex(containerEl: HTMLElement, index: number): void {
		const userAction = this.plugin.settings.customActions.at(index);
		if (userAction != undefined) {
			const setting = new Setting(containerEl)
				.setName(userAction.name)
				.addButton((button) => {
					button.setButtonText("Clone").onClick(() => {
						this.displayActionEditModalForCloneAction(userAction);
					});
				})
				.addButton((button) => {
					button.setButtonText("Edit").onClick(() => {
						this.displayActionEditModalByActionAndIndex(userAction, index);
					});
				});
		}
	}

	createButton(
		containerEl: HTMLElement,
		name: string,
		buttonText: string,
		onClickHandler: () => void,
		cta = false
	): void {
		new Setting(containerEl).setName(name).addButton((button) => {
			button.setButtonText(buttonText).onClick(onClickHandler);
			if (cta) {
				button.setCta();
			}
		});
	}

	private displayActionEditModalForNewAction() {
		// Get first available model or empty string if none configured
		const availableModels = this.plugin.settings.aiProviders?.models || [];
		const defaultModelId = availableModels.length > 0 ? availableModels[0].id : "";
		
		const DUMMY_ACTION: UserAction = {
			name: "Action Name",
			prompt: "Enter your prompt",
			sel: Selection.ALL,
			loc: Location.INSERT_HEAD,
			format: "{{result}}\n",
			model: defaultModelId,
			temperature: undefined,
			maxOutputTokens: undefined,
		};
		new ActionEditModal(
			this.app,
			this.plugin,
			DUMMY_ACTION,
			async (action: UserAction) => {
				this.plugin.settings.customActions.push(action);
				await this.saveSettingsAndRefresh();
			},
			undefined
		).open();
	}

	private displayActionEditModalForCloneAction(sourceAction: UserAction) {
		// Create a copy of the source action with modified name
		const clonedAction: UserAction = {
			...sourceAction,
			name: sourceAction.name + " (Copy)"
		};
		new ActionEditModal(
			this.app,
			this.plugin,
			clonedAction,
			async (action: UserAction) => {
				this.plugin.settings.customActions.push(action);
				await this.saveSettingsAndRefresh();
			},
			undefined
		).open();
	}

	private displayActionEditModalByActionAndIndex(
		userAction: UserAction,
		index: number
	) {
		new ActionEditModal(
			this.app,
			this.plugin,
			userAction,
			async (action: UserAction) => {
				await this.saveUserActionAndRefresh(index, action);
			},
			async () => {
				await this.deleteUserActionAndRefresh(index);
			}
		).open();
	}

	private async deleteUserActionAndRefresh(index: number) {
		const actionToDelete = this.plugin.settings.customActions.at(index);
		if (actionToDelete != undefined) {
			this.plugin.settings.customActions.remove(actionToDelete);
			await this.saveSettingsAndRefresh();
		}
	}

	private async saveUserActionAndRefresh(index: number, action: UserAction) {
		this.plugin.settings.customActions[index] = action;
		await this.saveSettingsAndRefresh();
	}

	private async saveSettingsAndRefresh() {
		await this.plugin.saveSettings();
		this.plugin.registerActions();
		this.display();
	}

	// Provider management methods
	displayProviderByIndex(containerEl: HTMLElement, index: number): void {
		const provider = this.plugin.settings.aiProviders.providers.at(index);
		if (provider != undefined) {
			this.createButton(containerEl, `${provider.name} (${provider.type})`, "Edit", () => {
				this.displayProviderEditModalByIndex(provider, index);
			});
		}
	}

	private displayProviderEditModalForNew() {
		const newProvider: AIProvider = {
			id: Date.now().toString(),
			name: "New Provider",
			type: "openai",
			url: "",
			apiKey: ""
		};
		new ProviderEditModal(
			this.app,
			this.plugin,
			newProvider,
			async (provider: AIProvider) => {
				this.plugin.settings.aiProviders.providers.push(provider);
				await this.saveSettingsAndRefresh();
			},
			undefined,
			true
		).open();
	}

	private displayProviderEditModalByIndex(provider: AIProvider, index: number) {
		new ProviderEditModal(
			this.app,
			this.plugin,
			provider,
			async (updatedProvider: AIProvider) => {
				this.plugin.settings.aiProviders.providers[index] = updatedProvider;
				await this.saveSettingsAndRefresh();
			},
			async () => {
				this.plugin.settings.aiProviders.providers.splice(index, 1);
				// Remove models that use this provider
				this.plugin.settings.aiProviders.models = this.plugin.settings.aiProviders.models.filter(
					m => m.providerId !== provider.id
				);
				await this.saveSettingsAndRefresh();
			}
		).open();
	}

	// Model management methods
	displayModelByIndex(containerEl: HTMLElement, index: number): void {
		const model = this.plugin.settings.aiProviders.models.at(index);
		if (model != undefined) {
			const provider = this.plugin.settings.aiProviders.providers.find(p => p.id === model.providerId);
			const providerName = provider ? provider.name : "Unknown Provider";
			this.createButton(containerEl, `${model.name} (${providerName})`, "Edit", () => {
				this.displayModelEditModalByIndex(model, index);
			});
		}
	}

	private displayModelEditModalForNew() {
		if (this.plugin.settings.aiProviders.providers.length === 0) {
			new Notice("Please add at least one AI provider first");
			return;
		}

		const newModel: AIModel = {
			id: Date.now().toString(),
			name: "New Model",
			providerId: this.plugin.settings.aiProviders.providers[0].id,
			modelName: ""
		};
		new ModelEditModal(
			this.app,
			this.plugin,
			newModel,
			this.plugin.settings.aiProviders.providers,
			async (model: AIModel) => {
				this.plugin.settings.aiProviders.models.push(model);
				await this.saveSettingsAndRefresh();
			},
			undefined,
			true
		).open();
	}

	private displayModelEditModalByIndex(model: AIModel, index: number) {
		new ModelEditModal(
			this.app,
			this.plugin,
			model,
			this.plugin.settings.aiProviders.providers,
			async (updatedModel: AIModel) => {
				this.plugin.settings.aiProviders.models[index] = updatedModel;
				await this.saveSettingsAndRefresh();
			},
			async () => {
				this.plugin.settings.aiProviders.models.splice(index, 1);
				await this.saveSettingsAndRefresh();
			}
		).open();
	}

	private displayQuickPromptEditModal() {
		const modal = new QuickPromptEditModal(
			this.app,
			this.plugin,
			this.plugin.settings.quickPrompt,
			async (updatedAction) => {
				this.plugin.settings.quickPrompt = updatedAction;
				await this.plugin.saveSettings();
				this.display();
			}
		);
		modal.open();
	}
}
