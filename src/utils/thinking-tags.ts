/**
 * Result of processing text with thinking tags
 */
export interface ProcessedThinkingResult {
	/** Whether we're in thinking mode (unclosed <think> tag found) */
	isThinking: boolean;
	/** The text to display (without thinking content) */
	displayText: string;
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
	let displayText = text;
	let isThinking = false;
	let start = displayText.indexOf("<think>");

	while (start !== -1) {
		const end = displayText.indexOf("</think>", start + 7);
		if (end === -1) {
			// Unclosed <think> tag - we're in thinking mode
			displayText = displayText.slice(0, start).trim();
			isThinking = true;
			break;
		} else {
			// Complete <think>...</think> block - remove it
			displayText =
				displayText.slice(0, start) + displayText.slice(end + 8);
		}
		start = displayText.indexOf("<think>", start);
	}

	return { isThinking, displayText };
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
