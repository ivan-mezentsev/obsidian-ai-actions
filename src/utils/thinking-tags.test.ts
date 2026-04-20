import { processThinkingTags, stripThinkingTags } from "./thinking-tags";

describe("thinking-tags", () => {
	it("returns visible text unchanged when there are no think tags", () => {
		expect(processThinkingTags("Visible answer")).toEqual({
			isThinking: false,
			displayText: "Visible answer",
			thinkingText: "",
		});
	});

	it("extracts streamed reasoning from an open think block", () => {
		expect(processThinkingTags("Answer<think>step 1\nstep 2")).toEqual({
			isThinking: true,
			displayText: "Answer",
			thinkingText: "step 1\nstep 2",
		});
	});

	it("removes complete think blocks from visible output", () => {
		expect(processThinkingTags("A<think>hidden</think>B")).toEqual({
			isThinking: false,
			displayText: "AB",
			thinkingText: "",
		});
		expect(stripThinkingTags("A<think>hidden</think>B")).toBe("AB");
	});

	it("keeps streaming the latest open think block after closed ones", () => {
		expect(
			processThinkingTags(
				"Before<think>hidden</think>After<think>live reasoning"
			)
		).toEqual({
			isThinking: true,
			displayText: "BeforeAfter",
			thinkingText: "live reasoning",
		});
	});
});
