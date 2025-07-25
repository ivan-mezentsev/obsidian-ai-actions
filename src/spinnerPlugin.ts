import { RangeSetBuilder, EditorState } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import type { DecorationSet, PluginValue } from "@codemirror/view";

class LoaderWidget extends WidgetType {
	static readonly element: HTMLSpanElement = document.createElement("span");

	static {
		this.element.addClasses(["ai-actions-loading", "ai-actions-dots"]);
	}

	toDOM(_view: EditorView): HTMLElement {
		return LoaderWidget.element.cloneNode(true) as HTMLElement;
	}
}

class ThinkingWidget extends WidgetType {
	private static createDOMStructure(): HTMLElement {
		const container = document.createElement("div");
		container.addClass("ai-actions-thinking-container");

		// Add a line break element
		container.appendChild(document.createElement("br"));

		const textElement = document.createElement("span");
		textElement.addClass("ai-actions-thinking");
		textElement.textContent = "Thinking";
		textElement.setAttribute("data-text", "Thinking");

		container.appendChild(textElement);
		return container;
	}

	toDOM(_view: EditorView): HTMLElement {
		return ThinkingWidget.createDOMStructure();
	}
}

class ContentWidget extends WidgetType {
	private dom: HTMLElement | null = null;

	constructor(private text: string) {
		super();
	}

	eq(other: ContentWidget) {
		return other.text === this.text;
	}

	updateText(newText: string) {
		if (this.dom && this.text !== newText) {
			const addedText = newText.slice(this.text.length);

			this.dom.textContent = newText.slice(0, -addedText.length);
			let lastSpan = this.dom.querySelector("span:last-child");
			if (!lastSpan) {
				lastSpan = document.createElement("span");
				this.dom.appendChild(lastSpan);
			}
			lastSpan.textContent = addedText;

			this.text = newText;
		}
	}

	toDOM(_view: EditorView): HTMLElement {
		if (!this.dom) {
			this.dom = document.createElement("div");
			this.dom.addClass("ai-actions-content");
			this.updateText(this.text);
		}
		return this.dom;
	}
}

/**
 * Processed result of handling text with thinking tags
 */
interface ProcessedThinkingResult {
	// Whether we're in thinking mode
	isThinking: boolean;

	// The text to display (without thinking content)
	displayText: string;
}

export class SpinnerPlugin implements PluginValue {
	decorations: DecorationSet;
	private positions: Map<
		number,
		{ isEndOfLine: boolean; widget: WidgetType; isThinking: boolean }
	>;

	constructor(private editorView: EditorView) {
		this.positions = new Map();
		this.decorations = Decoration.none;
	}

	/**
	 * Process text with potential <think> tags and update UI accordingly
	 *
	 * @param text Raw text that may include <think> tags
	 * @param processFunc Optional function to process the display text
	 * @param position Optional position to update specific spinner
	 * @returns void
	 */
	processText(
		text: string,
		processFunc?: (text: string) => string,
		position?: number
	) {
		const result = this.processThinkingTags(text);

		// Update thinking state
		this.showThinking(result.isThinking, position);

		// Only update visible content if there's content to show
		if (result.displayText.trim()) {
			const displayText = processFunc
				? processFunc(result.displayText)
				: result.displayText;
			this.updateContent(displayText, position);
		}
	}

	/**
	 * Process text with potential <think> tags
	 *
	 * @param text Raw text that may contain <think> tags
	 * @returns Object with parsed thinking state and display text
	 */
	private processThinkingTags(text: string): ProcessedThinkingResult {
		let displayText = text;
		let isThinking = false;
		let start = displayText.indexOf("<think>");
		while (start !== -1) {
			const end = displayText.indexOf("</think>", start + 7);
			if (end === -1) {
				displayText = displayText.slice(0, start).trim();
				isThinking = true;
				break;
			} else {
				displayText =
					displayText.slice(0, start) + displayText.slice(end + 8);
			}
			start = displayText.indexOf("<think>", start);
		}
		return { isThinking, displayText };
	}

	show(position: number): () => void {
		const isEndOfLine = this.isPositionAtEndOfLine(
			this.editorView.state,
			position
		);
		this.positions.set(position, {
			isEndOfLine,
			widget: new LoaderWidget(),
			isThinking: false,
		});
		this.updateDecorations();
		return () => this.hide(position);
	}

	hide(position: number) {
		this.positions.delete(position);
		this.updateDecorations();
	}

	showThinking(enabled: boolean, position?: number) {
		let updated = false;

		const updatePosition = (data: {
			widget: WidgetType;
			isThinking: boolean;
		}) => {
			if (enabled && !data.isThinking) {
				data.widget = new ThinkingWidget();
				data.isThinking = true;
				updated = true;
			} else if (!enabled && data.isThinking) {
				data.widget = new LoaderWidget();
				data.isThinking = false;
				updated = true;
			}
		};

		if (position !== undefined) {
			const data = this.positions.get(position);
			if (data) updatePosition(data);
		} else {
			this.positions.forEach(updatePosition);
		}

		if (updated) {
			this.updateDecorations();
		}
	}

	updateContent(text: string, position?: number) {
		let updated = false;
		const updatePosition = (data: {
			widget: WidgetType;
			isThinking: boolean;
		}) => {
			// Don't update content while in thinking mode
			if (data.isThinking) return;

			if (data.widget instanceof LoaderWidget) {
				data.widget = new ContentWidget(text);
				updated = true;
			} else if (data.widget instanceof ContentWidget) {
				data.widget.updateText(text);
				updated = true;
			}
		};

		if (position !== undefined) {
			const data = this.positions.get(position);
			if (data) updatePosition(data);
		} else {
			this.positions.forEach(updatePosition);
		}

		if (updated) {
			this.updateDecorations();
		}
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.updateDecorations();
		}
	}

	private updateDecorations() {
		const builder = new RangeSetBuilder<Decoration>();
		this.positions.forEach((data, position) => {
			builder.add(
				position,
				position,
				Decoration.widget({
					widget: data.widget,
					side: data.isEndOfLine ? 1 : -1,
				})
			);
		});
		this.decorations = builder.finish();
		this.editorView.requestMeasure();
	}

	private isPositionAtEndOfLine(
		state: EditorState,
		position: number
	): boolean {
		return position === state.doc.lineAt(position).to;
	}
}

export const spinnerPlugin = ViewPlugin.fromClass(SpinnerPlugin, {
	decorations: v => v.decorations,
});
