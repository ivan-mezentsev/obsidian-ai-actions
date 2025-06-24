import type { Model } from "./llm/models";
import { OpenAIModel } from "./llm/openai_llm";
import type { AIModel } from "./types";
import type { AIEditorSettings } from "./settings";

export enum Selection {
	ALL = "ALL",
	CURSOR = "CURSOR",
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
	if (!settings.aiProviders || !settings.aiProviders.models) {
		return [];
	}
	return settings.aiProviders.models;
}

export function locationDictionary(): { [key: string]: string } {
	return Object.values(Location).reduce((obj, value) => {
		obj[value] = LOCATION_SETTING[value];
		return obj;
	}, {} as { [key: string]: string });
}

export function selectionDictionary(): { [key: string]: string } {
	return Object.values(Selection).reduce((obj, value) => {
		obj[value] = SELECTION_SETTING[value];
		return obj;
	}, {} as { [key: string]: string });
}

export function modelDictionary(settings: AIEditorSettings): Record<string, string> {
	const dictionary: Record<string, string> = {};
	const models = getAvailableModels(settings);
	for (const model of models) {
		dictionary[model.name] = model.id;
	}
	return dictionary;
}
