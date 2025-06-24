import { ActionHandler } from "src/handler";
import { Editor, MarkdownView, Plugin } from "obsidian";
import { AIEditorSettingTab, AIEditorSettings } from "src/settings";
import { DEFAULT_ACTIONS } from "src/preset";
import { DEFAULT_MODEL } from "./llm/models";
import { AIProvidersSettings } from "./types";

const DEFAULT_SETTINGS: AIEditorSettings = {
	// Legacy settings for backward compatibility
	openAiApiKey: "",
	testingMode: false,
	defaultModel: "", // Legacy field, now empty
	customActions: DEFAULT_ACTIONS,
	// New provider-based settings
	aiProviders: {
		providers: [],
		models: []
	},
	useNativeFetch: true,
	debugMode: false,
	developmentMode: false
};

export default class AIEditor extends Plugin {
	settings: AIEditorSettings;

	registerActions() {
		let actions = this.settings.customActions;
		let handler = new ActionHandler(this.settings);
		actions.forEach((action, i) => {
			this.addCommand({
				// When user edit the settings, this method is called to updated command.
				// Use index as id to avoid creating duplicates
				id: `user-action-${i}`,
				name: action.name,
				editorCallback: async (editor: Editor, view: MarkdownView) => {
					await handler.process(
						this.app,
						this.settings,
						action,
						editor,
						view
					);
				},
			});
		});
	}

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: "reload",
			name: "Reload commands",
			callback: () => {
				this.registerActions();
			},
		});
		this.registerActions();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AIEditorSettingTab(this.app, this));
		this.initializeDefaultModels();
	}

	onunload() {}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			loadedData
		);
		
		// Ensure aiProviders is properly initialized
		if (!this.settings.aiProviders) {
			this.settings.aiProviders = {
				providers: [],
				models: []
			};
		}
		if (!this.settings.aiProviders.providers) {
			this.settings.aiProviders.providers = [];
		}
		if (!this.settings.aiProviders.models) {
			this.settings.aiProviders.models = [];
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Initialize default models for preset actions if no models are configured
	private initializeDefaultModels() {
		const availableModels = this.settings.aiProviders?.models || [];
		if (availableModels.length === 0) {
			return; // No models configured, actions will show "No models configured"
		}

		const defaultModelId = availableModels[0].id;
		
		// Update preset actions with first available model if they don't have one
		this.settings.customActions.forEach(action => {
			if (!action.model || action.model === "") {
				action.model = defaultModelId;
			}
		});
	}
}
