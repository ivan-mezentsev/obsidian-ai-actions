import { App, Modal, Setting } from "obsidian";
import { getAvailableModelsWithPluginAIProviders } from "../action";
import type { UserAction } from "../action";
import AIEditor from "src/main";
import { FilterableDropdown } from "../components/FilterableDropdown";
import type { FilterableDropdownOption } from "../components/FilterableDropdown";

export class QuickPromptEditModal extends Modal {
	action: UserAction;
	plugin: AIEditor;
	onSave: (userAction: UserAction) => void;
	private modelDropdown?: FilterableDropdown;

	constructor(
		app: App,
		plugin: AIEditor,
		user_action: UserAction,
		onSave: (userAction: UserAction) => void
	) {
		super(app);
		this.plugin = plugin;
		this.action = user_action;
		this.onSave = onSave;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h1", { text: 'Edit "Quick Prompt"' });

		this.createTextSetting(
			contentEl,
			"Action Name",
			"",
			this.action.name,
			async value => {
				this.action.name = value;
			}
		);

		new Setting(contentEl)
			.setName("LLM")
			.setDesc("Model auto-selected at Obsidian startup")
			.addButton(button => {
				button.setButtonText("Select model");
			});

		// Replace the button with our custom filterable dropdown
		const modelSetting = contentEl.lastElementChild as HTMLElement;
		const modelSettingControl = modelSetting.querySelector(
			".setting-item-control"
		) as HTMLElement;
		modelSettingControl.empty();

		const availableModels = await getAvailableModelsWithPluginAIProviders(
			this.plugin.settings
		);
		if (availableModels.length === 0) {
			const noModelsText = modelSettingControl.createDiv();
			noModelsText.textContent = "No models configured";
			noModelsText.style.color = "var(--text-muted)";
			noModelsText.style.fontStyle = "italic";
		} else {
			// Create options for the filterable dropdown
			const options: FilterableDropdownOption[] = availableModels.map(
				model => {
					let providerName = "Unknown provider";

					// Handle plugin AI providers
					if (model.id.startsWith("plugin_ai_providers_")) {
						// For plugin AI providers, the name already includes provider info
						providerName = "Plugin AI Providers";
					} else {
						// For internal providers, find by providerId
						const provider =
							this.plugin.settings.aiProviders.providers.find(
								p => p.id === model.providerId
							);
						providerName = provider
							? provider.name
							: "Unknown provider";
					}

					// Use a better format for long names with line break
					const displayName = `${model.name}\n(${providerName})`;
					return {
						value: model.id,
						label: displayName,
						model: model,
					};
				}
			);

			// Set current value or default to first model
			const currentModelId = this.action.model || availableModels[0].id;

			// Create the filterable dropdown
			this.modelDropdown = new FilterableDropdown(
				modelSettingControl,
				options,
				currentModelId,
				value => {
					this.action.model = value;
				}
			);
		}

		this.createTextSetting(
			contentEl,
			"Prompt",
			"Prompt for LLM to process your input",
			this.action.prompt,
			async value => {
				this.action.prompt = value;
			}
		);

		new Setting(contentEl)
			.setName("Temperature")
			.setDesc(
				"Controls randomness in AI responses. Higher values make output more creative, lower values more focused."
			)
			.addDropdown(dropdown => {
				const temperatureOptions = {
					none: "None",
					"0.2": "Low",
					"0.7": "Medium",
					"1": "Max",
				};

				dropdown.addOptions(temperatureOptions);

				// Set current value or default to "none"
				let currentValue = "none";
				if (this.action.temperature !== undefined) {
					if (this.action.temperature === 0.2) currentValue = "0.2";
					else if (this.action.temperature === 0.7)
						currentValue = "0.7";
					else if (this.action.temperature === 1) currentValue = "1";
				}

				dropdown.setValue(currentValue);
				dropdown.onChange(value => {
					if (value === "none") {
						this.action.temperature = undefined;
					} else {
						this.action.temperature = parseFloat(value);
					}
				});
			});

		new Setting(contentEl)
			.setName("Max output tokens")
			.setDesc(
				"Maximum number of tokens to generate (leave empty or 0 for default)"
			)
			.addText(text => {
				text.setPlaceholder("10000")
					.setValue(
						this.action.maxOutputTokens?.toString() || "10000"
					)
					.onChange(value => {
						const numValue = parseInt(value);
						if (isNaN(numValue) || numValue <= 0) {
							this.action.maxOutputTokens = undefined;
						} else {
							this.action.maxOutputTokens = numValue;
						}
					});
			});

		new Setting(contentEl)
			.addButton(button => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton(button => {
				button
					.setButtonText("Save")
					.setCta()
					.onClick(async () => {
						await this.onSave(this.action);
						this.close();
					});
			});
	}

	onClose() {
		// Clean up the filterable dropdown
		if (this.modelDropdown) {
			this.modelDropdown.destroy();
			this.modelDropdown = undefined;
		}

		let { contentEl } = this;
		contentEl.empty();
	}

	createTextSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		value: string,
		onSave: (newValue: string) => Promise<void>
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addTextArea(text => {
				text.setValue(value).onChange(async newValue => {
					await onSave(newValue);
				});
			});
	}
}
