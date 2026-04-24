/**
 * Result of processing text with thinking tags
 */
export interface ProcessedThinkingResult {
	/** Whether we're in thinking mode (unclosed <think> tag found) */
	isThinking: boolean;
	/** The text to display (without thinking content) */
	displayText: string;
	/** Current streaming thinking text from an unclosed <think> block */
	thinkingText: string;
}

/**
 * Process text with potential <think> tags and return parsed result
 *
 * This function handles text that may contain <think>...</think> tags by:
 * - Removing all complete <think>...</think> blocks
 * - Detecting unclosed <think> tags (indicates thinking mode)
 * - Returning cleaned display text and thinking state
 *
 * @param text Raw text that may contain <think> tags
 * @returns Object with parsed thinking state and display text
 */
export function processThinkingTags(text: string): ProcessedThinkingResult {
	let displayText = "";
	let cursor = 0;

	while (cursor < text.length) {
		const start = text.indexOf("<think>", cursor);

		if (start === -1) {
			displayText += text.slice(cursor);
			break;
		}

		displayText += text.slice(cursor, start);

		const end = text.indexOf("</think>", start + 7);
		if (end === -1) {
			return {
				isThinking: true,
				displayText,
				thinkingText: text.slice(start + 7),
			};
		}

		cursor = end + 8;
	}

	return {
		isThinking: false,
		displayText,
		thinkingText: "",
	};
}

/**
 * Strip thinking tags from text and return clean display text
 *
 * This is a convenience function that only returns the cleaned text
 * without thinking state information.
 *
 * @param text Raw text that may contain <think> tags
 * @returns Cleaned text with thinking tags removed
 */
export function stripThinkingTags(text: string): string {
	return processThinkingTags(text).displayText;
}
