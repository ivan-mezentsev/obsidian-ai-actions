import { App, Modal, Setting } from "obsidian";
import { Location } from "../action";

export class OutputModal extends Modal {
	title: string;
	format: (generated: string) => string;
	generated: string;
	editMode: boolean = false;

	onAccept:  (result: string) => Promise<void>;
	onLocationAction?: (result: string, location: Location) => Promise<void>;
	hasFileOutput: boolean = false;

	constructor(
		app: App,
		title: string,
		format: (generated: string) => string,
		onAccept:  (result: string) => Promise<void>,
		initial_text: string = "",
		onLocationAction?: (result: string, location: Location) => Promise<void>,
		hasFileOutput: boolean = false
	) {
		super(app);
		this.onAccept = onAccept;
		this.onLocationAction = onLocationAction;
		this.hasFileOutput = hasFileOutput;
		this.title = title;
		this.format = format;
		this.generated = initial_text;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: this.title, cls: "ai-actions-modal-title" });

		let textEl: HTMLElement;
		if (this.editMode) {
			textEl = contentEl.createEl("textarea", {
				text: this.format(this.generated),
				cls: "ai-actions-output-textarea",
				attr: {
					rows: "9",
					oninput: "this.innerHTML = this.value",
				},
			});
		} else {
			textEl = contentEl.createEl("p", {
				text: this.format(this.generated),
			});
		}
		contentEl.createEl("br");

		// Create button container with responsive layout
		const buttonContainer = contentEl.createEl("div", { cls: "ai-actions-button-container" });

		// Primary buttons row (Replace, Insert, Begin, End)
		const primaryButtonSetting = new Setting(buttonContainer)
			.setClass("ai-actions-primary-buttons")
			.setName("") // Remove default setting name/description
			.addButton((btn) =>
				btn.setButtonText("Replace").onClick(async () => {
					if (this.onLocationAction) {
						this.close();
						await this.onLocationAction(textEl.innerText, Location.REPLACE_CURRENT);
					}
				})
			)
			.addButton((btn) =>
				btn.setButtonText("Insert").onClick(async () => {
					if (this.onLocationAction) {
						this.close();
						await this.onLocationAction(textEl.innerText, Location.APPEND_CURRENT);
					}
				})
			)
			.addButton((btn) =>
				btn.setButtonText("Begin").onClick(async () => {
					if (this.onLocationAction) {
						this.close();
						await this.onLocationAction(textEl.innerText, Location.INSERT_HEAD);
					}
				})
			)
			.addButton((btn) =>
				btn.setButtonText("End").onClick(async () => {
					if (this.onLocationAction) {
						this.close();
						await this.onLocationAction(textEl.innerText, Location.APPEND_BOTTOM);
					}
				})
			);

		// Secondary buttons row (Edit, File, Cancel)
		const secondaryButtonSetting = new Setting(buttonContainer)
			.setClass("ai-actions-secondary-buttons")
			.setName("") // Remove default setting name/description
			.addButton((btn) =>
				btn.setButtonText("Edit").onClick(() => {
					this.editMode = true;
					this.onClose();
					this.onOpen();
				})
			);

		// Add File button conditionally
		if (this.hasFileOutput) {
			secondaryButtonSetting.addButton((btn) =>
				btn.setButtonText("File").onClick(async () => {
					if (this.onLocationAction) {
						this.close();
						await this.onLocationAction(textEl.innerText, Location.APPEND_TO_FILE);
					}
				})
			);
		}

		// Add Cancel button
		secondaryButtonSetting.addButton((btn) =>
			btn.setButtonText("Cancel").onClick(() => {
				this.close();
			})
		);
	}

	addToken(token: string) {
		this.generated = this.generated + token;
		this.contentEl.empty();
		this.onOpen();
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}
