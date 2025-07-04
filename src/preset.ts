import type { UserAction } from "./action";
import { Selection, Location } from "./action";

export const SUMMARY_DOC_ACTION: UserAction = {
	name: "Summarize document",
	prompt: "Summarize the following in a paragraph",
	sel: Selection.ALL,
	loc: Location.INSERT_HEAD,
	format: "**Summary**: {{result}}\n\n",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const COMPLETION_ACTION: UserAction = {
	name: "Text Completion",
	prompt: "Complete the following text",
	sel: Selection.CURSOR,
	loc: Location.APPEND_CURRENT,
	format: "{{result}}",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const REWRITE_ACTION: UserAction = {
	name: "Rewrite selection (formal)",
	prompt: "Rewrite the following text in a professional tone",
	sel: Selection.CURSOR,
	loc: Location.REPLACE_CURRENT,
	format: "{{result}}",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const HASHTAG_ACTION: UserAction = {
	name: "Generate hashtags",
	prompt: "Generate hashtags for the following text",
	sel: Selection.ALL,
	loc: Location.APPEND_BOTTOM,
	format: "\n{{result}}",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const APPEND_TO_TASK_LIST: UserAction = {
	name: "Append to task list",
	prompt: "Summarize the following as an actionable task in a short sentence",
	sel: Selection.ALL,
	loc: Location.APPEND_TO_FILE,
	locationExtra: { fileName: "Tasks.md" },
	format: "\n- [ ] {{result}}",
	model: "", // Will be set to first available model
	showModalWindow: true,
}

// Default actions
export const DEFAULT_ACTIONS: Array<UserAction> = [
	SUMMARY_DOC_ACTION,
	COMPLETION_ACTION,
	REWRITE_ACTION,
	HASHTAG_ACTION,
	APPEND_TO_TASK_LIST,
];
