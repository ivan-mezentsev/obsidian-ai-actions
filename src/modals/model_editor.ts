import { App, Modal, Setting, Notice } from "obsidian";
import type { AIModel, AIProvider } from "../types";
import AIEditor from "../main";

export class ModelEditModal extends Modal {
    model: AIModel;
    plugin: AIEditor;
    onSave: (model: AIModel) => void;
    onDelete?: () => void;
    isNew: boolean;
    availableProviders: AIProvider[];

    constructor(
        app: App,
        plugin: AIEditor,
        model: AIModel,
        availableProviders: AIProvider[],
        onSave: (model: AIModel) => void,
        onDelete?: () => void,
        isNew: boolean = false
    ) {
        super(app);
        this.plugin = plugin;
        this.model = { ...model }; // Create a copy
        this.availableProviders = availableProviders;
        this.onSave = onSave;
        this.onDelete = onDelete;
        this.isNew = isNew;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: this.isNew ? "Add AI Model" : "Edit AI Model" });

        new Setting(contentEl)
            .setName("Model Name")
            .setDesc("Enter a display name for this model")
            .addText((text) => {
                text.setPlaceholder("GPT-4")
                    .setValue(this.model.name)
                    .onChange((value) => {
                        this.model.name = value;
                    });
            });

        new Setting(contentEl)
            .setName("Provider")
            .setDesc("Select the AI provider for this model")
            .addDropdown((dropdown) => {
                if (this.availableProviders.length === 0) {
                    dropdown.addOption("", "No providers available");
                } else {
                    this.availableProviders.forEach(provider => {
                        dropdown.addOption(provider.id, provider.name);
                    });
                }
                
                dropdown.setValue(this.model.providerId)
                    .onChange((value) => {
                        this.model.providerId = value;
                        this.updateAvailableModels();
                    });
                
                this.providerDropdown = dropdown;
            });

        this.modelNameSetting = new Setting(contentEl)
            .setName("Model Name (API)")
            .setDesc("Enter the exact model name as used by the API")
            .addText((text) => {
                text.setPlaceholder("gpt-4")
                    .setValue(this.model.modelName)
                    .onChange((value) => {
                        this.model.modelName = value;
                    });
                this.modelNameText = text;
            });

        this.refreshButton = new Setting(contentEl)
            .setName("Available Models")
            .setDesc("Refresh the list of available models from the provider")
            .addButton((button) => {
                button.setButtonText("Refresh Models")
                    .onClick(async () => {
                        await this.refreshModels();
                    });
            });

        // Buttons
        new Setting(contentEl)
            .addButton((button) => {
                if (this.onDelete && !this.isNew) {
                    button.setButtonText("Delete")
                        .setWarning()
                        .onClick(() => {
                            this.onDelete!();
                            this.close();
                        });
                } else {
                    button.setButtonText("Cancel")
                        .onClick(() => {
                            this.close();
                        });
                }
            })
            .addButton((button) => {
                button.setButtonText("Save")
                    .setCta()
                    .onClick(() => {
                        if (this.validateModel()) {
                            this.onSave(this.model);
                            this.close();
                        }
                    });
            });

        this.updateAvailableModels();
    }

    private providerDropdown: any;
    private modelNameText: any;
    private modelNameSetting: Setting;
    private refreshButton: Setting;

    private updateAvailableModels() {
        const selectedProvider = this.availableProviders.find(p => p.id === this.model.providerId);
        if (selectedProvider?.availableModels && selectedProvider.availableModels.length > 0) {
            // Replace text input with dropdown
            this.modelNameSetting.clear();
            this.modelNameSetting.addDropdown((dropdown) => {
                selectedProvider.availableModels!.forEach(modelName => {
                    dropdown.addOption(modelName, modelName);
                });
                dropdown.setValue(this.model.modelName)
                    .onChange((value) => {
                        this.model.modelName = value;
                    });
            });
        }
    }

    private async refreshModels() {
        const selectedProvider = this.availableProviders.find(p => p.id === this.model.providerId);
        if (!selectedProvider) {
            new Notice("Please select a provider first");
            return;
        }

        try {
            new Notice("Fetching models...");
            const models = await this.fetchModelsFromProvider(selectedProvider);
            selectedProvider.availableModels = models;
            
            // Update the provider in settings
            const providerIndex = this.plugin.settings.aiProviders.providers.findIndex(p => p.id === selectedProvider.id);
            if (providerIndex !== -1) {
                this.plugin.settings.aiProviders.providers[providerIndex] = selectedProvider;
                await this.plugin.saveSettings();
            }
            
            this.updateAvailableModels();
            new Notice(`Found ${models.length} models`);
        } catch (error) {
            new Notice(`Failed to fetch models: ${error}`);
        }
    }

    private async fetchModelsFromProvider(provider: AIProvider): Promise<string[]> {
        if (!provider.url || !provider.apiKey) {
            throw new Error("Provider URL and API key are required");
        }

        let url: string;
        let headers: Record<string, string>;

        if (provider.type === 'gemini') {
            // For Gemini, use the direct API endpoint without /models suffix
            // The base URL should be https://generativelanguage.googleapis.com/v1beta
            const baseUrl = provider.url.replace('/openai', ''); // Remove /openai if present
            url = `${baseUrl}/models?key=${provider.apiKey}`;
            headers = {
                'Content-Type': 'application/json'
            };
        } else {
            // For OpenAI-compatible APIs (OpenAI, OpenRouter, Groq, LMStudio, etc.)
            url = `${provider.url}/models`;
            headers = {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            };
        }

        const response = await fetch(url, {
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (provider.type === 'gemini') {
            // Gemini API returns models in a different format
            return data.models?.map((model: any) => model.name.replace('models/', '')) || [];
        } else {
            // OpenAI-compatible format
            return data.data?.map((model: any) => model.id) || [];
        }
    }

    private validateModel(): boolean {
        if (!this.model.name.trim()) {
            new Notice("Model display name is required");
            return false;
        }
        
        if (!this.model.providerId) {
            new Notice("Provider must be selected");
            return false;
        }
        
        if (!this.model.modelName.trim()) {
            new Notice("Model API name is required");
            return false;
        }
        
        return true;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}