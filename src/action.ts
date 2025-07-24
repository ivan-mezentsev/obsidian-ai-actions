import type { AIModel, AIProviderType } from "./types";
import type { AIEditorSettings } from "./settings";
import { waitForAI } from "@obsidian-ai-providers/sdk";

export enum Selection {
	ALL = "ALL",
	CURSOR = "CURSOR",
	CLIPBOARD = "CLIPBOARD",
}

export enum Location {
	INSERT_HEAD = "INSERT_HEAD",
	APPEND_BOTTOM = "APPEND_BOTTOM",
	APPEND_CURRENT = "APPEND_CURRENT",
	APPEND_TO_FILE = "APPEND_TO_FILE",
	REPLACE_CURRENT = "REPLACE_CURRENT",
}

export interface UserAction {
	name: string;
	prompt: string;
	model: string; // Now stores model ID instead of OpenAIModel
	sel: Selection;
	loc: Location;
	format: string;
	temperature?: number; // Temperature setting for AI model
	maxOutputTokens?: number; // Maximum output tokens for AI model
	locationExtra?: { fileName: string };
	showModalWindow?: boolean; // Show modal window with results
}

const SELECTION_SETTING: { [key: string]: string } = {
	[Selection.ALL.toString()]: "Select the whole document",
	[Selection.CURSOR.toString()]: "Input selected text by cursor",
	[Selection.CLIPBOARD.toString()]: "Input text from clipboard",
};

const LOCATION_SETTING: { [key: string]: string } = {
	[Location.INSERT_HEAD.toString()]:
		"Insert at the beginning of the document",
	[Location.APPEND_BOTTOM.toString()]: "Append to the end of the document",
	[Location.APPEND_CURRENT.toString()]:
		"Append to the end of current selection",
	[Location.REPLACE_CURRENT.toString()]: "Replace the current selection",
	[Location.APPEND_TO_FILE.toString()]: "Append to a file specified below",
};

// Function to get available models from settings
export function getAvailableModels(settings: AIEditorSettings): AIModel[] {
	const internalModels = settings.aiProviders?.models || [];
	return internalModels;
}

// Function to get available models including plugin AI providers
export async function getAvailableModelsWithPluginAIProviders(
	settings: AIEditorSettings
): Promise<AIModel[]> {
	const internalModels = getAvailableModels(settings);

	// If plugin AI providers are not enabled, return only internal models
	if (!settings.aiProviders?.usePluginAIProviders) {
		return internalModels;
	}

	try {
		const aiProvidersWaiter = await waitForAI();
		const aiProvidersResponse = await aiProvidersWaiter.promise;

		// Convert plugin AI providers to AIModel format
		const pluginAIModels: AIModel[] = aiProvidersResponse.providers.map(
			provider => ({
				id: `plugin_ai_providers_${provider.id}`, // Prefix to distinguish from internal models
				name: provider.model
					? `${provider.name} ~ ${provider.model}`
					: provider.name,
				modelName: provider.model || provider.name, // Model name for display
				providerId: `plugin_ai_providers_${provider.id}`,
				type: "openai" as AIProviderType, // Default type for plugin AI providers
				pluginAIProviderId: provider.id, // Store original provider ID for execution
			})
		);

		return [...internalModels, ...pluginAIModels];
	} catch (error) {
		console.error("Failed to load plugin AI providers:", error);
		return internalModels;
	}
}

export function locationDictionary(): { [key: string]: string } {
	return Object.values(Location).reduce(
		(obj, value) => {
			obj[value] = LOCATION_SETTING[value];
			return obj;
		},
		{} as { [key: string]: string }
	);
}

export function selectionDictionary(): { [key: string]: string } {
	return Object.values(Selection).reduce(
		(obj, value) => {
			obj[value] = SELECTION_SETTING[value];
			return obj;
		},
		{} as { [key: string]: string }
	);
}

export function modelDictionary(
	settings: AIEditorSettings
): Record<string, string> {
	const dictionary: Record<string, string> = {};
	const models = getAvailableModels(settings);
	for (const model of models) {
		dictionary[model.name] = model.id;
	}
	return dictionary;
}
