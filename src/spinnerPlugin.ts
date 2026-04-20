import {
	EditorState,
	RangeSetBuilder,
	StateEffect,
	StateField,
	type Extension,
} from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import type { DecorationSet, PluginValue } from "@codemirror/view";
import { processThinkingTags } from "./utils/thinking-tags";

const THINKING_VISIBLE_LINES = 5;

type SpinnerEntryState = {
	isEndOfLine: boolean;
	displayText: string;
	isThinking: boolean;
	thinkingText: string;
};

type SpinnerDecorationState = {
	entries: Map<number, SpinnerEntryState>;
	decorations: DecorationSet;
};

const showSpinnerEffect = StateEffect.define<{
	position: number;
	isEndOfLine: boolean;
}>();

const hideSpinnerEffect = StateEffect.define<{
	position: number;
}>();

const updateSpinnerContentEffect = StateEffect.define<{
	position: number;
	displayText: string;
}>();

const updateSpinnerThinkingEffect = StateEffect.define<{
	position: number;
	isThinking: boolean;
	thinkingText: string;
}>();

class LoaderWidget extends WidgetType {
	static readonly element: HTMLSpanElement = document.createElement("span");

	static {
		this.element.addClasses(["ai-actions-loading", "ai-actions-dots"]);
	}

	toDOM(_view: EditorView): HTMLElement {
		return LoaderWidget.element.cloneNode(true) as HTMLElement;
	}

	eq(_other: WidgetType): boolean {
		return true;
	}
}

class ThinkingWidget extends WidgetType {
	constructor(private text: string) {
		super();
	}

	eq(other: ThinkingWidget) {
		return other.text === this.text;
	}

	toDOM(_view: EditorView): HTMLElement {
		const container = document.createElement("div");
		container.addClass("ai-actions-thinking-container");

		const panel = document.createElement("div");
		panel.addClass("ai-actions-thinking-panel");
		panel.style.setProperty(
			"--ai-actions-thinking-lines",
			String(THINKING_VISIBLE_LINES)
		);

		const header = document.createElement("div");
		header.addClass("ai-actions-thinking-header");

		const title = document.createElement("span");
		title.addClass("ai-actions-thinking");
		title.textContent = "Thinking";
		title.setAttribute("data-text", "Thinking");

		const content = document.createElement("div");
		content.addClass("ai-actions-thinking-content");
		content.textContent = this.text;

		header.append(title);
		panel.append(header, content);
		container.append(panel);

		this.scheduleScrollToBottom(content);

		return container;
	}

	updateDOM(dom: HTMLElement): boolean {
		const contentElement = dom.querySelector(
			".ai-actions-thinking-content"
		);

		if (!(contentElement instanceof HTMLElement)) {
			return false;
		}

		if (contentElement.textContent !== this.text) {
			contentElement.textContent = this.text;
		}

		this.scheduleScrollToBottom(contentElement);
		return true;
	}

	private scheduleScrollToBottom(contentElement: HTMLElement) {
		const scroll = () => {
			contentElement.scrollTop = contentElement.scrollHeight;
		};

		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(scroll);
		} else {
			setTimeout(scroll, 0);
		}
	}
}

class ContentWidget extends WidgetType {
	constructor(private text: string) {
		super();
	}

	eq(other: ContentWidget) {
		return other.text === this.text;
	}

	toDOM(_view: EditorView): HTMLElement {
		const dom = document.createElement("div");
		dom.addClass("ai-actions-content");
		this.renderContent(dom, "");
		return dom;
	}

	updateDOM(dom: HTMLElement): boolean {
		const previousText = dom.dataset.aiActionsContentText ?? "";
		this.renderContent(dom, previousText);
		return true;
	}

	private renderContent(dom: HTMLElement, previousText: string) {
		const canAppend =
			previousText.length > 0 && this.text.startsWith(previousText);
		const stableText = canAppend ? previousText : this.text;
		const appendedText = canAppend
			? this.text.slice(previousText.length)
			: "";

		dom.textContent = stableText;

		if (appendedText) {
			const lastSpan = document.createElement("span");
			lastSpan.textContent = appendedText;
			dom.appendChild(lastSpan);
		}

		dom.dataset.aiActionsContentText = this.text;
	}
}

const createSpinnerEntry = (isEndOfLine: boolean): SpinnerEntryState => ({
	isEndOfLine,
	displayText: "",
	isThinking: false,
	thinkingText: "",
});

const buildDecorations = (
	entries: Map<number, SpinnerEntryState>
): DecorationSet => {
	const builder = new RangeSetBuilder<Decoration>();

	entries.forEach((entry, position) => {
		const inlineWidget = entry.isThinking
			? new LoaderWidget()
			: entry.displayText
				? new ContentWidget(entry.displayText)
				: new LoaderWidget();

		builder.add(
			position,
			position,
			Decoration.widget({
				widget: inlineWidget,
				side: entry.isEndOfLine ? 1 : -1,
			})
		);

		if (entry.isThinking && entry.thinkingText) {
			builder.add(
				position,
				position,
				Decoration.widget({
					widget: new ThinkingWidget(entry.thinkingText),
					side: 1,
					block: true,
				})
			);
		}
	});

	return builder.finish();
};

const createSpinnerDecorationState = (
	entries: Map<number, SpinnerEntryState>
): SpinnerDecorationState => ({
	entries,
	decorations: buildDecorations(entries),
});

const spinnerStateField = StateField.define<SpinnerDecorationState>({
	create() {
		return createSpinnerDecorationState(new Map());
	},
	update(value, transaction) {
		let entries = value.entries;
		let changed = false;

		const ensureMutableEntries = () => {
			if (!changed) {
				entries = new Map(entries);
				changed = true;
			}
		};

		for (const effect of transaction.effects) {
			if (effect.is(showSpinnerEffect)) {
				const current = entries.get(effect.value.position);
				const nextEntry = createSpinnerEntry(effect.value.isEndOfLine);

				if (
					!current ||
					current.isEndOfLine !== nextEntry.isEndOfLine ||
					current.displayText !== nextEntry.displayText ||
					current.isThinking !== nextEntry.isThinking ||
					current.thinkingText !== nextEntry.thinkingText
				) {
					ensureMutableEntries();
					entries.set(effect.value.position, nextEntry);
				}
				continue;
			}

			if (effect.is(hideSpinnerEffect)) {
				if (entries.has(effect.value.position)) {
					ensureMutableEntries();
					entries.delete(effect.value.position);
				}
				continue;
			}

			if (effect.is(updateSpinnerContentEffect)) {
				const current = entries.get(effect.value.position);
				if (!current || current.isThinking) {
					continue;
				}

				if (current.displayText !== effect.value.displayText) {
					ensureMutableEntries();
					entries.set(effect.value.position, {
						...current,
						displayText: effect.value.displayText,
					});
				}
				continue;
			}

			if (effect.is(updateSpinnerThinkingEffect)) {
				const current = entries.get(effect.value.position);
				if (!current) {
					continue;
				}

				if (
					current.isThinking !== effect.value.isThinking ||
					current.thinkingText !== effect.value.thinkingText
				) {
					ensureMutableEntries();
					entries.set(effect.value.position, {
						...current,
						isThinking: effect.value.isThinking,
						thinkingText: effect.value.thinkingText,
					});
				}
			}
		}

		return changed ? createSpinnerDecorationState(entries) : value;
	},
	provide(field) {
		return EditorView.decorations.from(field, value => value.decorations);
	},
});

export class SpinnerPlugin implements PluginValue {
	constructor(private editorView: EditorView) {
		void this.editorView;
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
		const result = processThinkingTags(text);
		const thinkingText =
			typeof result.thinkingText === "string" ? result.thinkingText : "";

		// Update thinking state
		this.showThinking(result.isThinking, thinkingText, position);

		// Only update visible content if there's content to show
		if (result.displayText.trim()) {
			const displayText = processFunc
				? processFunc(result.displayText)
				: result.displayText;
			this.updateContent(displayText, position);
		}
	}

	show(position: number): () => void {
		const isEndOfLine = this.isPositionAtEndOfLine(
			this.editorView.state,
			position
		);
		this.editorView.dispatch({
			effects: showSpinnerEffect.of({
				position,
				isEndOfLine,
			}),
		});
		return () => this.hide(position);
	}

	hide(position: number) {
		this.editorView.dispatch({
			effects: hideSpinnerEffect.of({ position }),
		});
	}

	showThinking(enabled: boolean, thinkingText = "", position?: number) {
		const normalizedThinkingText = this.normalizeThinkingText(thinkingText);
		const effects = this.getTargetPositions(position).map(targetPosition =>
			updateSpinnerThinkingEffect.of({
				position: targetPosition,
				isThinking: enabled,
				thinkingText: normalizedThinkingText,
			})
		);

		if (effects.length) {
			this.editorView.dispatch({ effects });
		}
	}

	updateContent(text: string, position?: number) {
		const effects = this.getTargetPositions(position)
			.filter(targetPosition => {
				const entry = this.getSpinnerEntries().get(targetPosition);
				return Boolean(entry && !entry.isThinking);
			})
			.map(targetPosition =>
				updateSpinnerContentEffect.of({
					position: targetPosition,
					displayText: text,
				})
			);

		if (effects.length) {
			this.editorView.dispatch({ effects });
		}
	}

	update(_update: ViewUpdate) {
		return;
	}

	private getSpinnerState(): SpinnerDecorationState {
		return this.editorView.state.field(spinnerStateField);
	}

	private getSpinnerEntries(): Map<number, SpinnerEntryState> {
		return this.getSpinnerState().entries;
	}

	private getTargetPositions(position?: number): number[] {
		if (position !== undefined) {
			return this.getSpinnerEntries().has(position) ? [position] : [];
		}

		return [...this.getSpinnerEntries().keys()];
	}

	private normalizeThinkingText(text: string): string {
		return text.replace(/^\n+/, "").replace(/\n+$/, "");
	}

	private isPositionAtEndOfLine(
		state: EditorState,
		position: number
	): boolean {
		return position === state.doc.lineAt(position).to;
	}
}

export const spinnerPlugin = ViewPlugin.fromClass(SpinnerPlugin);

export const spinnerEditorExtension: Extension = [
	spinnerStateField,
	spinnerPlugin,
];
