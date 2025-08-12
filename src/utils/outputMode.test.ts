import {
	toggleOutputMode,
	getOutputModeMeta,
	type OutputMode,
} from "./outputMode";

describe("toggleOutputMode", () => {
	it("toggles in order replace -> append -> replace", () => {
		let m: OutputMode = "replace";
		m = toggleOutputMode(m);
		expect(m).toBe("append");
		m = toggleOutputMode(m);
		expect(m).toBe("replace");
	});
});

describe("getOutputModeMeta", () => {
	it("returns correct meta for replace mode", () => {
		const meta = getOutputModeMeta("replace");
		expect(meta.label).toBe("Replace");
		expect(meta.aria.toLowerCase()).toContain("replace");
		expect(meta.iconKey).toBe("replace");
	});

	it("returns correct meta for append mode", () => {
		const meta = getOutputModeMeta("append");
		expect(meta.label).toBe("Append");
		expect(meta.aria.toLowerCase()).toContain("append");
		expect(meta.iconKey).toBe("append");
	});
});
