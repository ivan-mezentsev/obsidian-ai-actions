import { App, Modal, Setting } from "obsidian";
import {
	selectionDictionary,
	locationDictionary,
	modelDictionary,
	getAvailableModels,
	Selection,
	Location
} from "../action";
import type {
	UserAction
} from "../action";
import type { AIModel } from "../types";
import { DeletionModal } from "./deletion";
import AIEditor from "src/main";

export class ActionEditModal extends Modal {
	action: UserAction;
	plugin: AIEditor;
	onSave: (userAction: UserAction) => void;
	onDelete?: () => void;

	constructor(
		app: App,
		plugin: AIEditor,
		user_action: UserAction,
		onSave: (userAction: UserAction) => void,
		onDelete?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.action = user_action;
		this.onSave = onSave;
		this.onDelete = onDelete;
	}
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h1", { text: "Edit Action" });

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
		this.createTextSetting(
			contentEl,
			"Output Format",
			"Format your LLM output. Use {{result}} as placeholder.",
			this.action.format,
			async (value) => {
				this.action.format = value;
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
				text.setPlaceholder("1000")
					.setValue(this.action.maxOutputTokens?.toString() || "1000")
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
			.setName("Show Modal Window")
			.setDesc("Display window with results")
			.addToggle((toggle) => {
				toggle
					.setValue(this.action.showModalWindow ?? true)
					.onChange((value) => {
						this.action.showModalWindow = value;
					});
			});

		new Setting(contentEl)
			.setName("Input selection")
			.setDesc("What input would be sent to LLM?")
			.addDropdown((dropdown) => {
				if (this.action.sel == undefined) {
					this.action.sel = Selection.ALL;
				}
				dropdown
					.addOptions(selectionDictionary())
					.setValue(this.action.sel.toString())
					.onChange((value) => {
						this.action.sel = value as Selection;
					});
			});
		new Setting(contentEl)
			.setName("Output location")
			.setDesc(
				"Where do you to put the generated output after formatting?"
			)
			.addDropdown((dropdown) => {
				if (this.action.loc == undefined) {
					this.action.loc = Location.INSERT_HEAD;
				}
				dropdown
					.addOptions(locationDictionary())
					.setValue(this.action.loc)
					.onChange((value) => {
						this.action.loc = value as Location;
						this.onOpen();
					});
			});
		if (this.action.loc == Location.APPEND_TO_FILE) {
			new Setting(contentEl)
				.setName("File name")
				.setDesc("File name to append to")
				.addText((text) => {
					text.setPlaceholder("Enter file name")
						.setValue(this.action.locationExtra?.fileName || "")
						.onChange(async (value) => {
							this.action.locationExtra = {
								fileName: value,
							};
						});
				});
		}

		new Setting(contentEl)
			.addButton((button) => {
				if (this.onDelete) {
					let onDelete = this.onDelete;
					button
						.setButtonText("Delete")
						.setWarning()
						.onClick(async () => {
							new DeletionModal(this.app, () => {
								onDelete();
								this.close();
							}).open();
						});
				} else {
					button.setButtonText("Ignore").onClick(() => {
						this.close();
					});
				}
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
