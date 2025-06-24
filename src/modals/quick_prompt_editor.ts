import { App, Modal, Setting } from "obsidian";
import {
	getAvailableModels
} from "../action";
import type {
	UserAction
} from "../action";
import AIEditor from "src/main";

export class QuickPromptEditModal extends Modal {
	action: UserAction;
	plugin: AIEditor;
	onSave: (userAction: UserAction) => void;

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

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h1", { text: "Edit Quick Prompt" });

		this.createTextSetting(
			contentEl,
			"Action Name",
			"",
			this.action.name,
			async (value) => {
				this.action.name = value;
			}
		);

		new Setting(contentEl)
			.setName("LLM Model")
			.setDesc("The LLM model to use for this action")
			.addDropdown((dropdown) => {
				const availableModels = getAvailableModels(this.plugin.settings);
				if (availableModels.length === 0) {
					dropdown.addOption("", "No models configured");
					dropdown.setDisabled(true);
				} else {
					for (const model of availableModels) {
						const provider = this.plugin.settings.aiProviders.providers.find(p => p.id === model.providerId);
						const providerName = provider ? provider.name : "Unknown Provider";
						const displayName = `${model.name} (${providerName})`;
						dropdown.addOption(model.id, displayName);
					}
					// Set current value or default to first model
					const currentModelId = this.action.model || availableModels[0].id;
					dropdown.setValue(currentModelId);
					dropdown.onChange((value) => {
						this.action.model = value;
					});
				}
			});

		this.createTextSetting(
			contentEl,
			"Prompt",
			"Prompt for LLM to process your input",
			this.action.prompt,
			async (value) => {
				this.action.prompt = value;
			}
		);

		new Setting(contentEl)
			.setName("Temperature")
			.setDesc("Controls randomness in AI responses. Higher values make output more creative, lower values more focused.")
			.addDropdown((dropdown) => {
				const temperatureOptions = {
					"none": "None",
					"0.2": "Low",
					"0.7": "Medium",
					"1": "Max"
				};
				
				dropdown.addOptions(temperatureOptions);
				
				// Set current value or default to "none"
				let currentValue = "none";
				if (this.action.temperature !== undefined) {
					if (this.action.temperature === 0.2) currentValue = "0.2";
					else if (this.action.temperature === 0.7) currentValue = "0.7";
					else if (this.action.temperature === 1) currentValue = "1";
				}
				
				dropdown.setValue(currentValue);
				dropdown.onChange((value) => {
					if (value === "none") {
						this.action.temperature = undefined;
					} else {
						this.action.temperature = parseFloat(value);
					}
				});
			});

		new Setting(contentEl)
			.setName("Max Output Tokens")
			.setDesc("Maximum number of tokens to generate (leave empty or 0 for default)")
			.addText((text) => {
				text.setPlaceholder("10000")
					.setValue(this.action.maxOutputTokens?.toString() || "10000")
					.onChange((value) => {
						const numValue = parseInt(value);
						if (isNaN(numValue) || numValue <= 0) {
							this.action.maxOutputTokens = undefined;
						} else {
							this.action.maxOutputTokens = numValue;
						}
					});
			});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
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
			.addTextArea((text) => {
				text.setValue(value).onChange(async (newValue) => {
					await onSave(newValue);
				});
			});
	}
}