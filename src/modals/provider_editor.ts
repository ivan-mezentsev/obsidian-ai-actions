import { App, Modal, Setting, Notice, TextComponent } from "obsidian";
import type { AIProvider, AIProviderType } from "../types";
import AIEditor from "../main";

export class ProviderEditModal extends Modal {
	provider: AIProvider;
	plugin: AIEditor;
	onSave: (provider: AIProvider) => void;
	onDelete?: () => void;
	isNew: boolean;

	constructor(
		app: App,
		plugin: AIEditor,
		provider: AIProvider,
		onSave: (provider: AIProvider) => void,
		onDelete?: () => void,
		isNew: boolean = false
	) {
		super(app);
		this.plugin = plugin;
		this.provider = { ...provider }; // Create a copy
		this.onSave = onSave;
		this.onDelete = onDelete;
		this.isNew = isNew;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", {
			text: this.isNew ? "Add provider" : "Edit provider",
		});

		new Setting(contentEl)
			.setName("Provider name")
			.setDesc("Enter a name for this provider")
			.addText(text => {
				text.setPlaceholder("My provider")
					.setValue(this.provider.name)
					.onChange(value => {
						this.provider.name = value;
					});
				this.nameText = text;
			});

		new Setting(contentEl)
			.setName("Provider type")
			.setDesc("Select the type of AI provider")
			.addDropdown(dropdown => {
				const providerTypes: Record<AIProviderType, string> = {
					openai: "OpenAI",
					anthropic: "Anthropic",
					ollama: "Ollama",
					gemini: "Google Gemini",
					openrouter: "OpenRouter",
					lmstudio: "LM Studio",
					groq: "Groq",
				};

				Object.entries(providerTypes).forEach(([key, value]) => {
					dropdown.addOption(key, value);
				});

				dropdown.setValue(this.provider.type).onChange(value => {
					this.provider.type = value as AIProviderType;
					this.updateUrlForProviderType();
					this.updateNameForProviderType(value as AIProviderType);
				});
			});

		new Setting(contentEl)
			.setName("Provider URL")
			.setDesc("Enter the API endpoint URL")
			.addText(text => {
				text.setValue(this.provider.url || "").onChange(value => {
					this.provider.url = value;
				});
				this.urlText = text;
			});

		new Setting(contentEl)
			.setName("API key")
			.setDesc("Enter your API key (if required)")
			.addText(text => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- API keys commonly start with the literal prefix `sk-`
				text.setPlaceholder("sk-...")
					.setValue(this.provider.apiKey || "")
					.onChange(value => {
						this.provider.apiKey = value;
					});
			});

		// Buttons
		new Setting(contentEl)
			.addButton(button => {
				if (this.onDelete && !this.isNew) {
					button
						.setButtonText("Delete")
						.setWarning()
						.onClick(() => {
							this.onDelete!();
							this.close();
						});
				} else {
					button.setButtonText("Cancel").onClick(() => {
						this.close();
					});
				}
			})
			.addButton(button => {
				button
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						if (this.validateProvider()) {
							this.onSave(this.provider);
							this.close();
						}
					});
			});

		this.updateUrlPlaceholder();
	}

	private urlText: TextComponent | null = null;
	private nameText: TextComponent | null = null;

	private getDefaultUrls(): Record<AIProviderType, string> {
		return {
			openai: "https://api.openai.com/v1",
			anthropic: "https://api.anthropic.com",
			ollama: "http://localhost:11434",
			gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
			openrouter: "https://openrouter.ai/api/v1",
			lmstudio: "http://localhost:1234/v1",
			groq: "https://api.groq.com/openai/v1",
		};
	}

	private updateUrlPlaceholder() {
		if (!this.urlText) return;

		const defaultUrls = this.getDefaultUrls();
		const defaultUrl = defaultUrls[this.provider.type] || "https://...";
		this.urlText.setPlaceholder(defaultUrl);

		// Set default value if URL is empty (for new providers only)
		if (
			this.isNew &&
			(!this.provider.url || this.provider.url.trim() === "")
		) {
			this.provider.url = defaultUrl !== "https://..." ? defaultUrl : "";
			this.urlText.setValue(this.provider.url);
		}
	}

	private updateUrlForProviderType() {
		if (!this.urlText) return;

		const defaultUrls = this.getDefaultUrls();
		const defaultUrl = defaultUrls[this.provider.type] || "";

		// Always update URL when provider type changes
		if (defaultUrl) {
			this.provider.url = defaultUrl;
			this.urlText.setValue(this.provider.url);
		}

		this.urlText.setPlaceholder(defaultUrl || "https://...");
	}

	private updateNameForProviderType(providerType: AIProviderType) {
		const providerTypeNames: Record<AIProviderType, string> = {
			openai: "OpenAI",
			anthropic: "Anthropic",
			ollama: "Ollama",
			gemini: "Google Gemini",
			openrouter: "OpenRouter",
			lmstudio: "LM Studio",
			groq: "Groq",
		};

		const newName = providerTypeNames[providerType] || providerType;
		this.provider.name = newName;
		if (this.nameText) {
			this.nameText.setValue(newName);
		}
	}

	private validateProvider(): boolean {
		if (!this.provider.name.trim()) {
			new Notice("Provider name is required");
			return false;
		}

		if (!this.provider.url?.trim()) {
			new Notice("Provider URL is required");
			return false;
		}

		return true;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
