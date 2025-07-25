import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { Location, Selection } from "src/action";
import type { UserAction } from "src/action";
import AIEditor from "src/main";
import { ActionEditModal } from "./modals/action_editor";
import { QuickPromptEditModal } from "./modals/quick_prompt_editor";
import type { AIProvider, AIModel, AIProvidersSettings } from "./types";
import { ProviderEditModal } from "./modals/provider_editor";
import { ModelEditModal } from "./modals/model_editor";
import { waitForAI } from "@obsidian-ai-providers/sdk";
import type {
	IAIProvider,
	IAIProvidersService,
} from "@obsidian-ai-providers/sdk";

export interface AIEditorSettings {
	openAiApiKey: string; // Deprecated, will be removed
	testingMode: boolean;
	defaultModel: string; // Deprecated, will be removed
	customActions: Array<UserAction>;
	quickPrompt: UserAction;
	aiProviders: AIProvidersSettings;
	useNativeFetch: boolean;
	developmentMode: boolean;
}

export class AIEditorSettingTab extends PluginSettingTab {
	plugin: AIEditor;

	constructor(app: App, plugin: AIEditor) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;

		containerEl.empty();

		// Providers Section
		new Setting(containerEl)
			.setName("Providers")
			.setHeading()
			.addButton(button => {
				button.setButtonText("Add").onClick(() => {
					this.displayProviderEditModalForNew();
				});
				button.setCta();
			});

		for (
			let i = 0;
			i < this.plugin.settings.aiProviders.providers.length;
			i++
		) {
			this.displayProviderByIndex(containerEl, i);
		}

		// AI Models Section
		new Setting(containerEl)
			.setName("Models")
			.setHeading()
			.addButton(button => {
				button.setButtonText("Add").onClick(() => {
					this.displayModelEditModalForNew();
				});
				button.setCta();
			});

		for (
			let i = 0;
			i < this.plugin.settings.aiProviders.models.length;
			i++
		) {
			this.displayModelByIndex(containerEl, i);
		}

		new Setting(containerEl)
			.setName('Enable plugin "AI Providers" integration')
			.setDesc("Show models from the AI Providers plugin")
			.addToggle(toggle =>
				toggle
					.setValue(
						this.plugin.settings.aiProviders.usePluginAIProviders ||
							false
					)
					.onChange(async value => {
						this.plugin.settings.aiProviders.usePluginAIProviders =
							value;
						await this.plugin.saveSettings();
						await this.display();
					})
			);

		if (this.plugin.settings.aiProviders.usePluginAIProviders) {
			await this.displayPluginAIProviders(containerEl);
		}

		new Setting(containerEl)
			.setName("Custom actions")
			.setHeading()
			.addButton(button => {
				button.setButtonText("New").onClick(() => {
					this.displayActionEditModalForNewAction();
				});
				button.setCta();
			});

		for (let i = 0; i < this.plugin.settings.customActions.length; i++) {
			this.displayActionByIndex(containerEl, i);
		}

		// General Section - moved to the bottom
		new Setting(containerEl).setName("General").setHeading();

		// Quick Prompt Section
		this.createButton(
			containerEl,
			'"Quick Prompt"',
			"Edit",
			() => {
				this.displayQuickPromptEditModal();
			},
			false
		);

		// Development mode toggle with special styling
		const devModeContainer = containerEl.createDiv(
			"ai-actions-dev-mode-container"
		);
		devModeContainer.addClass("ai-actions-setting-item-highlighted");

		new Setting(devModeContainer)
			.setName("Development mode")
			.setDesc(
				"Enable development options for plugin configuration and testing"
			)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.developmentMode)
					.onChange(async value => {
						this.plugin.settings.developmentMode = value;
						await this.plugin.saveSettings();
						// Refresh the display to show/hide development options
						await this.display();
					})
			);

		// Development options container - only visible when developmentMode is enabled
		const devOptionsContainer = containerEl.createDiv(
			"ai-actions-dev-options-container"
		);
		if (!this.plugin.settings.developmentMode) {
			devOptionsContainer.addClass("ai-actions-dev-options-hidden");
		}

		new Setting(devOptionsContainer)
			.setName("Testing mode")
			.setDesc(
				"Use testing mode to test custom action without calling AI APIs"
			)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.testingMode)
					.onChange(async value => {
						this.plugin.settings.testingMode = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(devOptionsContainer)
			.setName("Use native fetch")
			.setDesc(
				"Use Obsidian's native fetch to bypass CORS restrictions. Enable this if you encounter CORS errors with AI providers."
			)
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.useNativeFetch)
					.onChange(async value => {
						this.plugin.settings.useNativeFetch = value;
						await this.plugin.saveSettings();
					})
			);
	}

	displayActionByIndex(containerEl: HTMLElement, index: number): void {
		const userAction = this.plugin.settings.customActions[index];
		if (userAction != undefined) {
			new Setting(containerEl)
				.setName(userAction.name)
				.addButton(button => {
					button.setButtonText("Clone").onClick(() => {
						this.displayActionEditModalForCloneAction(userAction);
					});
				})
				.addButton(button => {
					button.setButtonText("Edit").onClick(() => {
						this.displayActionEditModalByActionAndIndex(
							userAction,
							index
						);
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
		new Setting(containerEl).setName(name).addButton(button => {
			button.setButtonText(buttonText).onClick(onClickHandler);
			if (cta) {
				button.setCta();
			}
		});
	}

	private displayActionEditModalForNewAction() {
		// Get first available model or empty string if none configured
		const availableModels = this.plugin.settings.aiProviders?.models || [];
		const defaultModelId =
			availableModels.length > 0 ? availableModels[0].id : "";

		const DUMMY_ACTION: UserAction = {
			name: "Action name",
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
			name: sourceAction.name + " (Copy)",
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
		const actionToDelete = this.plugin.settings.customActions[index];
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
		await this.display();
	}

	// Provider management methods
	displayProviderByIndex(containerEl: HTMLElement, index: number): void {
		const provider = this.plugin.settings.aiProviders.providers[index];
		if (provider != undefined) {
			this.createButton(
				containerEl,
				`${provider.name} (${provider.type})`,
				"Edit",
				() => {
					this.displayProviderEditModalByIndex(provider, index);
				}
			);
		}
	}

	private displayProviderEditModalForNew() {
		const newProvider: AIProvider = {
			id: Date.now().toString(),
			name: "New provider",
			type: "openai",
			url: "",
			apiKey: "",
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

	private displayProviderEditModalByIndex(
		provider: AIProvider,
		index: number
	) {
		new ProviderEditModal(
			this.app,
			this.plugin,
			provider,
			async (updatedProvider: AIProvider) => {
				this.plugin.settings.aiProviders.providers[index] =
					updatedProvider;
				await this.saveSettingsAndRefresh();
			},
			async () => {
				this.plugin.settings.aiProviders.providers.splice(index, 1);
				// Remove models that use this provider
				this.plugin.settings.aiProviders.models =
					this.plugin.settings.aiProviders.models.filter(
						m => m.providerId !== provider.id
					);
				await this.saveSettingsAndRefresh();
			}
		).open();
	}

	// Model management methods
	displayModelByIndex(containerEl: HTMLElement, index: number): void {
		const model = this.plugin.settings.aiProviders.models[index];
		if (model != undefined) {
			const provider = this.plugin.settings.aiProviders.providers.find(
				p => p.id === model.providerId
			);
			const providerName = provider ? provider.name : "Unknown Provider";
			this.createButton(
				containerEl,
				`${model.name} (${providerName})`,
				"Edit",
				() => {
					this.displayModelEditModalByIndex(model, index);
				}
			);
		}
	}

	private displayModelEditModalForNew() {
		if (this.plugin.settings.aiProviders.providers.length === 0) {
			new Notice("Please add at least one AI provider first");
			return;
		}

		const newModel: AIModel = {
			id: Date.now().toString(),
			name: "New model",
			providerId: this.plugin.settings.aiProviders.providers[0].id,
			modelName: "",
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
			async updatedAction => {
				this.plugin.settings.quickPrompt = updatedAction;
				await this.plugin.saveSettings();
				await this.display();
			}
		);
		modal.open();
	}

	private async displayPluginAIProviders(containerEl: HTMLElement) {
		try {
			// Check if AI Providers plugin is available with timeout
			const aiResolver = await waitForAI();

			// Add timeout to prevent infinite waiting
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error("AI Providers plugin timeout"));
				}, 1000); // 1 second timeout
			});

			const aiProviders: IAIProvidersService = await Promise.race([
				aiResolver.promise,
				timeoutPromise,
			]);

			if (
				!aiProviders ||
				!aiProviders.providers ||
				aiProviders.providers.length === 0
			) {
				containerEl.createEl("p", {
					text: "No AI providers available. Please configure providers in the AI Providers plugin.",
					cls: "setting-item-description",
				});
				return;
			}

			// Display available providers as models using the same style as regular models
			aiProviders.providers.forEach((provider: IAIProvider) => {
				const setting = new Setting(containerEl).setName(
					`${provider.name} (Plugin AI Providers)`
				);

				// Add a disabled button to show it's read-only
				setting.addButton(button => {
					button.setButtonText("Read-only").setDisabled(true);
				});
			});
		} catch {
			containerEl.createEl("p", {
				text: "AI Providers plugin is not available or not loaded.",
				cls: "setting-item-description",
			});
		}
	}
}
