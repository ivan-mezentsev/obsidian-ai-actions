import {
	nextInputSource,
	getInputSourceMeta,
	type InputSource,
} from "./inputSource";

describe("nextInputSource", () => {
	it("cycles in order CURSOR -> CLIPBOARD -> ALL -> CURSOR", () => {
		let s: InputSource = "CURSOR";
		s = nextInputSource(s);
		expect(s).toBe("CLIPBOARD");
		s = nextInputSource(s);
		expect(s).toBe("ALL");
		s = nextInputSource(s);
		expect(s).toBe("CURSOR");
	});

	it("meta provides aria and iconKey per state", () => {
		const m1 = getInputSourceMeta("CURSOR");
		expect(m1.label).toBe("Input selected text by cursor");
		expect(m1.aria.toLowerCase()).toContain(
			"input selected text by cursor"
		);
		expect(m1.iconKey).toBe("cursor");

		const m2 = getInputSourceMeta("CLIPBOARD");
		expect(m2.label).toBe("Input text from clipboard");
		expect(m2.aria.toLowerCase()).toContain("input text from clipboard");
		expect(m2.iconKey).toBe("clipboard");

		const m3 = getInputSourceMeta("ALL");
		expect(m3.label).toBe("Select the whole document");
		expect(m3.aria.toLowerCase()).toContain("select the whole document");
		expect(m3.iconKey).toBe("all");
	});
});
