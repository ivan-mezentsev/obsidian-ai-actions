// Input source cycling logic extracted for testability
// Allowed values
export type InputSource = "CURSOR" | "CLIPBOARD" | "ALL";

// Cycle through CURSOR -> CLIPBOARD -> ALL -> CURSOR
export function nextInputSource(current: InputSource): InputSource {
	if (current === "CURSOR") return "CLIPBOARD";
	if (current === "CLIPBOARD") return "ALL";
	return "CURSOR";
}

export type InputSourceIconKey = "cursor" | "clipboard" | "all";

export function getInputSourceMeta(source: InputSource): {
	label: string;
	aria: string;
	iconKey: InputSourceIconKey;
} {
	switch (source) {
		case "CURSOR":
			return {
				label: "Input selected text by cursor",
				aria: "Input selected text by cursor (click to toggle)",
				iconKey: "cursor",
			};
		case "CLIPBOARD":
			return {
				label: "Input text from clipboard",
				aria: "Input text from clipboard (click to toggle)",
				iconKey: "clipboard",
			};
		case "ALL":
		default:
			return {
				label: "Select the whole document",
				aria: "Select the whole document (click to toggle)",
				iconKey: "all",
			};
	}
}
