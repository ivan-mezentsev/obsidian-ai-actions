import { stripThinkingTags } from "./thinking-tags";

type GeminiPartLike = {
	text?: string;
	thought?: boolean;
	thoughtSignature?: string;
};

export type GeminiResponseLike = {
	candidates?: Array<{
		content?: {
			parts?: GeminiPartLike[];
		};
	}>;
};

type StreamSegment =
	| { kind: "thought"; text: string }
	| { kind: "rawText"; text: string };

type RenderState = {
	output: string;
	mode: "answer" | "thought";
	isThinking: boolean;
	thinkingSource: "explicit" | "rawToken" | null;
	rawBuffer: string;
};

const GEMMA_THINK_TOKEN = "<|think|>";
const GEMMA_THOUGHT_START = "<|channel>thought";
const GEMMA_THOUGHT_END = "<channel|>";
const GEMMA_THOUGHT_END_ALT = "<|channel|>";

const ANSWER_MODE_TOKENS = [GEMMA_THINK_TOKEN, GEMMA_THOUGHT_START];
const THOUGHT_MODE_TOKENS = [
	GEMMA_THINK_TOKEN,
	GEMMA_THOUGHT_END,
	GEMMA_THOUGHT_END_ALT,
];

function getResponseParts(
	response?: GeminiResponseLike | null
): GeminiPartLike[] {
	return response?.candidates?.[0]?.content?.parts ?? [];
}

function longestPartialTokenSuffix(text: string, tokens: string[]): number {
	const maxTokenLength = Math.max(...tokens.map(token => token.length));
	const maxSuffixLength = Math.min(text.length, maxTokenLength - 1);

	for (let suffixLength = maxSuffixLength; suffixLength > 0; suffixLength--) {
		const suffix = text.slice(-suffixLength);
		if (tokens.some(token => token.startsWith(suffix))) {
			return suffixLength;
		}
	}

	return 0;
}

function openThinking(state: RenderState, source: "explicit" | "rawToken") {
	if (!state.isThinking) {
		state.output += "<think>";
		state.isThinking = true;
	}
	state.mode = "thought";
	state.thinkingSource = source;
}

function closeThinking(state: RenderState) {
	if (state.isThinking) {
		state.output += "</think>";
		state.isThinking = false;
	}
	state.mode = "answer";
	state.thinkingSource = null;
}

function emitText(state: RenderState, text: string) {
	if (!text) {
		return;
	}

	state.output += text;
}

function consumeRawText(state: RenderState, text: string, finalize: boolean) {
	state.rawBuffer += text;

	while (state.rawBuffer.length > 0) {
		const activeTokens =
			state.mode === "thought" ? THOUGHT_MODE_TOKENS : ANSWER_MODE_TOKENS;

		let earliestIndex = -1;
		let matchedToken = "";

		for (const token of activeTokens) {
			const index = state.rawBuffer.indexOf(token);
			if (
				index !== -1 &&
				(earliestIndex === -1 || index < earliestIndex)
			) {
				earliestIndex = index;
				matchedToken = token;
			}
		}

		if (earliestIndex === -1) {
			if (finalize) {
				emitText(state, state.rawBuffer);
				state.rawBuffer = "";
				return;
			}

			const partialLength = longestPartialTokenSuffix(
				state.rawBuffer,
				activeTokens
			);
			const flushLength = state.rawBuffer.length - partialLength;
			if (flushLength > 0) {
				emitText(state, state.rawBuffer.slice(0, flushLength));
				state.rawBuffer = state.rawBuffer.slice(flushLength);
			}
			return;
		}

		if (earliestIndex > 0) {
			emitText(state, state.rawBuffer.slice(0, earliestIndex));
			state.rawBuffer = state.rawBuffer.slice(earliestIndex);
		}

		if (matchedToken === GEMMA_THINK_TOKEN) {
			state.rawBuffer = state.rawBuffer.slice(GEMMA_THINK_TOKEN.length);
			continue;
		}

		if (matchedToken === GEMMA_THOUGHT_START) {
			state.rawBuffer = state.rawBuffer.slice(GEMMA_THOUGHT_START.length);
			openThinking(state, "rawToken");
			continue;
		}

		if (
			matchedToken === GEMMA_THOUGHT_END ||
			matchedToken === GEMMA_THOUGHT_END_ALT
		) {
			state.rawBuffer = state.rawBuffer.slice(matchedToken.length);
			closeThinking(state);
		}
	}
}

function renderSegments(segments: StreamSegment[], finalize: boolean): string {
	const state: RenderState = {
		output: "",
		mode: "answer",
		isThinking: false,
		thinkingSource: null,
		rawBuffer: "",
	};

	for (const segment of segments) {
		if (segment.kind === "thought") {
			consumeRawText(state, "", true);
			openThinking(state, "explicit");
			emitText(state, segment.text);
			continue;
		}

		if (state.mode === "thought" && state.thinkingSource === "explicit") {
			consumeRawText(state, "", true);
			closeThinking(state);
		}

		consumeRawText(state, segment.text, false);
	}

	consumeRawText(state, "", finalize);

	if (finalize) {
		closeThinking(state);
	}

	return state.output;
}

function responseToSegments(
	response?: GeminiResponseLike | null
): StreamSegment[] {
	return getResponseParts(response)
		.filter(
			(part): part is GeminiPartLike & { text: string } =>
				typeof part.text === "string" && part.text.length > 0
		)
		.map(part =>
			part.thought === true
				? { kind: "thought" as const, text: part.text }
				: { kind: "rawText" as const, text: part.text }
		);
}

export function extractGeminiDisplayText(
	response?: GeminiResponseLike | null
): string {
	const normalizedText = renderSegments(responseToSegments(response), true);
	return stripThinkingTags(normalizedText);
}

export class GeminiThinkingStreamFormatter {
	private segments: StreamSegment[] = [];
	private renderedText = "";

	pushResponse(response?: GeminiResponseLike | null): string {
		this.segments.push(...responseToSegments(response));

		const nextRenderedText = renderSegments(this.segments, false);
		const delta = nextRenderedText.slice(this.renderedText.length);
		this.renderedText = nextRenderedText;

		return delta;
	}

	flush(): string {
		const nextRenderedText = renderSegments(this.segments, true);
		const delta = nextRenderedText.slice(this.renderedText.length);
		this.renderedText = nextRenderedText;

		return delta;
	}
}
