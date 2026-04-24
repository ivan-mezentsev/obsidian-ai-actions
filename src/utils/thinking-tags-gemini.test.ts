import {
	extractGeminiDisplayText,
	GeminiThinkingStreamFormatter,
} from "./thinking-tags-gemini";

describe("thinking-tags-gemini", () => {
	describe("extractGeminiDisplayText", () => {
		it("should ignore explicit thought parts and keep visible answer text", () => {
			const response = {
				candidates: [
					{
						content: {
							parts: [
								{ text: "Internal reasoning", thought: true },
								{ text: "Fallback answer" },
							],
						},
					},
				],
			};

			expect(extractGeminiDisplayText(response)).toBe("Fallback answer");
		});

		it("should concatenate only non-thought text parts", () => {
			const response = {
				candidates: [
					{
						content: {
							parts: [
								{ text: "Internal reasoning", thought: true },
								{ text: "Visible" },
								{ text: " answer" },
							],
						},
					},
				],
			};

			expect(extractGeminiDisplayText(response)).toBe("Visible answer");
		});

		it("should strip documented Gemma thought channel text from final display", () => {
			const response = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "<|channel>thought\nhidden<channel|>Visible answer",
								},
							],
						},
					},
				],
			};

			expect(extractGeminiDisplayText(response)).toBe("Visible answer");
		});
	});

	describe("GeminiThinkingStreamFormatter", () => {
		it("should emit think markers for explicit thought parts to preserve spinner flow", () => {
			const formatter = new GeminiThinkingStreamFormatter();

			expect(
				formatter.pushResponse({
					candidates: [
						{
							content: {
								parts: [{ text: "Thinking...", thought: true }],
							},
						},
					],
				})
			).toBe("<think>Thinking...");

			expect(
				formatter.pushResponse({
					candidates: [
						{
							content: {
								parts: [{ text: "Visible answer" }],
							},
						},
					],
				})
			).toBe("</think>Visible answer");

			expect(formatter.flush()).toBe("");
		});

		it("should normalize documented Gemma channel flow across streaming chunks", () => {
			const formatter = new GeminiThinkingStreamFormatter();

			expect(
				formatter.pushResponse({
					candidates: [
						{
							content: {
								parts: [{ text: "<|channel>thought\nhidden" }],
							},
						},
					],
				})
			).toBe("<think>\nhidden");

			expect(
				formatter.pushResponse({
					candidates: [
						{
							content: {
								parts: [{ text: "<channel|>Visible answer" }],
							},
						},
					],
				})
			).toBe("</think>Visible answer");

			expect(formatter.flush()).toBe("");
		});

		it("should close a pending thinking block on flush", () => {
			const formatter = new GeminiThinkingStreamFormatter();

			expect(
				formatter.pushResponse({
					candidates: [
						{
							content: {
								parts: [{ text: "Thinking...", thought: true }],
							},
						},
					],
				})
			).toBe("<think>Thinking...");

			expect(formatter.flush()).toBe("</think>");
		});

		it("should return empty string when response contains only thought text", () => {
			const response = {
				candidates: [
					{
						content: {
							parts: [
								{
									text: "Internal reasoning",
									thought: true,
								},
							],
						},
					},
				],
			};

			expect(extractGeminiDisplayText(response)).toBe("");
		});
	});
});
