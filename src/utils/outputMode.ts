// Output mode metadata for UI
// Allowed values
export type OutputMode = "replace" | "append";

export type OutputModeIconKey = "replace" | "append";

// Cycle through replace <-> append
export function toggleOutputMode(current: OutputMode): OutputMode {
	return current === "replace" ? "append" : "replace";
}

export function getOutputModeMeta(mode: OutputMode): {
	label: string;
	aria: string;
	iconKey: OutputModeIconKey;
} {
	switch (mode) {
		case "append":
			return {
				label: "Append",
				aria: "Append (click to toggle)",
				iconKey: "append",
			};
		case "replace":
		default:
			return {
				label: "Replace",
				aria: "Replace (click to toggle)",
				iconKey: "replace",
			};
	}
}
