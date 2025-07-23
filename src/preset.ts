import type { UserAction } from "./action";
import { Selection, Location } from "./action";

export const SUMMARY_DOC_ACTION: UserAction = {
	name: "✨Summarize document",
	prompt: "Make a concise summary of the key points of the following text. IMPORTANT: Write your summary in exactly the same language as the original text. Do not translate or change the language.",
	sel: Selection.ALL,
	loc: Location.INSERT_HEAD,
	format: "**Summary**: {{result}}\n\n",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const COMPLETION_ACTION: UserAction = {
	name: "✅ Text Completion",
	prompt:
		"You are a text editing assistant at obsidian:\n" +
		"Correct errors, typos, punctuation, but do not change the meaning! Preserve the formatting exactly.\n" +
		"Exclude everything unnecessary from your answer (do not add anything from yourself to the output / do not comment)",
	sel: Selection.CURSOR,
	loc: Location.APPEND_CURRENT,
	format: "{{result}}",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const REWRITE_ACTION: UserAction = {
	name: "✍️ Rewrite selection (formal)",
	prompt: "Rewrite the following text in a professional tone",
	sel: Selection.CURSOR,
	loc: Location.REPLACE_CURRENT,
	format: "{{result}}",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const HASHTAG_ACTION: UserAction = {
	name: "⌗ Generate hashtags",
	prompt:
		"Generate hashtags for the following text.\n" +
		"Answer only content and nothing else, no introductory words, only substance. One line, key points.",
	sel: Selection.ALL,
	loc: Location.APPEND_BOTTOM,
	format: "\n{{result}}",
	model: "", // Will be set to first available model
	showModalWindow: true,
};

export const APPEND_TO_TASK_LIST: UserAction = {
	name: "⃣ Append to task list",
	prompt:
		"Summarize the following as an actionable task in a short sentence.\n" +
		"IMPORTANT: Write your summary in exactly the same language as the original text. Do not translate or change the language.",
	sel: Selection.CURSOR,
	loc: Location.APPEND_TO_FILE,
	locationExtra: { fileName: "Tasks.md" },
	format: "\n- [ ] {{result}}",
	model: "", // Will be set to first available model
	showModalWindow: false,
};

export const PASTE_FROM_CLIPBOARD_AS_MARKDOWN: UserAction = {
	name: "📋 Paste from clipboard as markdown",
	prompt:
		"You are provided with text copied to the clipboard for subsequent insertion into an Obsidian document. Format it as correctly as possible for Markdown representation, precisely preserving the data/text. If any part of the formatting is already present, try to preserve it by correcting it for proper interpretation by a Markdown editor. Convert html tables to Markdown also. \n" +
		'**CRITICAL**: Do not additionally enclose it with "```markdown".',
	sel: Selection.CLIPBOARD,
	loc: Location.APPEND_CURRENT,
	format: "{{result}}",
	model: "", // Will be set to first available model
	showModalWindow: false,
};

// Default actions
export const DEFAULT_ACTIONS: Array<UserAction> = [
	SUMMARY_DOC_ACTION,
	COMPLETION_ACTION,
	REWRITE_ACTION,
	HASHTAG_ACTION,
	APPEND_TO_TASK_LIST,
	PASTE_FROM_CLIPBOARD_AS_MARKDOWN,
];
