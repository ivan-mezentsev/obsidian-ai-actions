import type { AIModel } from "../types";

export interface FilterableDropdownOption {
	value: string;
	label: string;
	model: AIModel;
}

export class FilterableDropdown {
	private containerEl: HTMLElement;
	private options: FilterableDropdownOption[];
	private filteredOptions: FilterableDropdownOption[];
	private selectedValue: string;
	private isOpen: boolean = false;
	private highlightedIndex: number = -1;
	private onChange: (value: string) => void;
	private dropdownDirection: "down" | "up" = "down";

	private dropdownEl: HTMLElement;
	private inputEl: HTMLInputElement;
	private arrowEl: HTMLElement;
	private optionsEl: HTMLElement;
	private documentClickHandler: (e: Event) => void;
	private resizeHandler: () => void;
	private scrollHandler: () => void;
	private positionUpdateInterval: number | null = null;

	constructor(
		containerEl: HTMLElement,
		options: FilterableDropdownOption[],
		selectedValue: string,
		onChange: (value: string) => void
	) {
		this.containerEl = containerEl;
		this.options = options;
		this.filteredOptions = [...options];
		this.selectedValue = selectedValue;
		this.onChange = onChange;

		this.createDropdown();
		this.bindEvents();
	}

	private createDropdown() {
		// Create dropdown container
		this.dropdownEl = this.containerEl.createDiv(
			"ai-actions-filterable-dropdown"
		);

		// Create input element
		this.inputEl = this.dropdownEl.createEl("input", {
			cls: "ai-actions-filterable-dropdown-input",
			attr: {
				type: "text",
				placeholder: "Search models...",
				readonly: "true",
				inputmode: "text",
				autocomplete: "off",
				autocorrect: "off",
				autocapitalize: "off",
				spellcheck: "false",
			},
		});

		// Create arrow
		this.arrowEl = this.dropdownEl.createDiv(
			"ai-actions-filterable-dropdown-arrow"
		);

		// Create options container attached to body to escape modal overflow
		this.optionsEl = document.body.createDiv(
			"ai-actions-filterable-dropdown-options"
		);
		this.optionsEl.style.position = "fixed";
		this.optionsEl.style.display = "none";
		this.optionsEl.style.zIndex = "10000";

		// Set initial value
		this.updateInputValue();
		this.renderOptions();
	}

	private bindEvents() {
		// Click on input to toggle dropdown
		this.inputEl.addEventListener("click", e => {
			e.preventDefault();
			this.makeInputEditable();
			this.toggleDropdown();
		});

		// Touch events for mobile
		this.inputEl.addEventListener(
			"touchstart",
			e => {
				// Only prevent default if necessary to avoid passive listener warnings
				if (!this.isOpen) {
					e.preventDefault();
				}
				this.makeInputEditable();
				this.openDropdown();
			},
			{ passive: false }
		);

		// Focus on input - make it editable
		this.inputEl.addEventListener("focus", () => {
			this.makeInputEditable();
		});

		// Input change for filtering
		this.inputEl.addEventListener("input", e => {
			const target = e.target as HTMLInputElement;
			this.filterOptions(target.value);
			this.openDropdown();
		});

		// Blur - close dropdown if clicking outside
		this.inputEl.addEventListener("blur", () => {
			// Delay to allow option click to register
			setTimeout(() => {
				this.closeDropdown();
				this.inputEl.setAttribute("readonly", "true");
				this.updateInputValue();
			}, 150);
		});

		// Keyboard navigation
		this.inputEl.addEventListener("keydown", e => {
			if (!this.isOpen) {
				if (e.key === "ArrowDown" || e.key === "Enter") {
					e.preventDefault();
					this.openDropdown();
				}
				return;
			}

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					this.highlightNext();
					break;
				case "ArrowUp":
					e.preventDefault();
					this.highlightPrevious();
					break;
				case "Enter":
					e.preventDefault();
					this.selectHighlighted();
					break;
				case "Escape":
					e.preventDefault();
					this.closeDropdown();
					break;
			}
		});

		// Click outside to close
		this.documentClickHandler = (e: Event) => {
			const target = e.target as Node;
			if (
				!this.dropdownEl.contains(target) &&
				!this.optionsEl.contains(target)
			) {
				this.closeDropdown();
			}
		};
		document.addEventListener("click", this.documentClickHandler);

		// Handle viewport changes (resize, orientation change, keyboard show/hide)
		this.resizeHandler = () => {
			if (this.isOpen) {
				this.positionDropdown();
			}
		};
		window.addEventListener("resize", this.resizeHandler);
		window.addEventListener("orientationchange", this.resizeHandler);

		// Handle scroll events that might affect positioning
		this.scrollHandler = () => {
			if (this.isOpen) {
				this.positionDropdown();
			}
		};
		document.addEventListener("scroll", this.scrollHandler, true);
	}

	private filterOptions(query: string) {
		if (!query.trim()) {
			this.filteredOptions = [...this.options];
		} else {
			const lowerQuery = query.toLowerCase();
			this.filteredOptions = this.options.filter(option =>
				option.label.toLowerCase().includes(lowerQuery)
			);
		}
		this.highlightedIndex = -1;
		this.renderOptions();
	}

	private renderOptions() {
		this.optionsEl.empty();

		if (this.filteredOptions.length === 0) {
			const noOptionsEl = this.optionsEl.createDiv(
				"ai-actions-filterable-dropdown-no-options"
			);
			noOptionsEl.textContent = "No models found";
			return;
		}

		this.filteredOptions.forEach((option, index) => {
			const optionEl = this.optionsEl.createDiv(
				"ai-actions-filterable-dropdown-option"
			);
			optionEl.textContent = option.label;
			optionEl.setAttribute("data-value", option.value);

			if (option.value === this.selectedValue) {
				optionEl.addClass("is-selected");
			}

			if (index === this.highlightedIndex) {
				optionEl.addClass("is-highlighted");
			}

			optionEl.addEventListener("click", () => {
				this.selectOption(option.value);
			});

			optionEl.addEventListener("mouseenter", () => {
				this.highlightedIndex = index;
				this.updateHighlight();
			});
		});
	}

	private selectOption(value: string) {
		this.selectedValue = value;
		this.onChange(value);
		this.closeDropdown();
		this.updateInputValue();
		// Clear filter to show all options on next open
		this.filteredOptions = [...this.options];
		this.renderOptions();
	}

	private selectHighlighted() {
		if (
			this.highlightedIndex >= 0 &&
			this.highlightedIndex < this.filteredOptions.length
		) {
			this.selectOption(
				this.filteredOptions[this.highlightedIndex].value
			);
		}
	}

	private highlightNext() {
		if (this.filteredOptions.length === 0) return;
		this.highlightedIndex =
			(this.highlightedIndex + 1) % this.filteredOptions.length;
		this.updateHighlight();
	}

	private highlightPrevious() {
		if (this.filteredOptions.length === 0) return;
		this.highlightedIndex =
			this.highlightedIndex <= 0
				? this.filteredOptions.length - 1
				: this.highlightedIndex - 1;
		this.updateHighlight();
	}

	private updateHighlight() {
		const optionEls = this.optionsEl.querySelectorAll(
			".ai-actions-filterable-dropdown-option"
		);
		optionEls.forEach((el, index) => {
			el.toggleClass("is-highlighted", index === this.highlightedIndex);
		});
	}

	private toggleDropdown() {
		if (this.isOpen) {
			this.closeDropdown();
		} else {
			this.openDropdown();
		}
	}

	private openDropdown() {
		this.isOpen = true;
		this.dropdownEl.addClass("is-open");
		this.highlightedIndex = -1;

		// Position dropdown relative to input
		this.positionDropdown();

		// Show dropdown
		this.optionsEl.style.display = "block";

		// Start position monitoring for mobile devices
		this.startPositionMonitoring();

		this.renderOptions();
	}

	private positionDropdown() {
		const rect = this.dropdownEl.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;
		const dropdownHeight = Math.min(
			200,
			this.filteredOptions.length * 32 + 8
		);

		// Set position and size
		this.optionsEl.style.left = rect.left + "px";
		this.optionsEl.style.width = rect.width + "px";
		this.optionsEl.style.maxHeight = "200px";
		this.optionsEl.style.overflowY = "auto";

		// Determine direction
		if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
			// Open upward
			this.dropdownDirection = "up";
			this.optionsEl.style.bottom = viewportHeight - rect.top + 2 + "px";
			this.optionsEl.style.top = "auto";
			this.optionsEl.addClass(
				"ai-actions-filterable-dropdown-options--up"
			);
			this.optionsEl.removeClass(
				"ai-actions-filterable-dropdown-options--down"
			);
		} else {
			// Open downward
			this.dropdownDirection = "down";
			this.optionsEl.style.top = rect.bottom + 2 + "px";
			this.optionsEl.style.bottom = "auto";
			this.optionsEl.addClass(
				"ai-actions-filterable-dropdown-options--down"
			);
			this.optionsEl.removeClass(
				"ai-actions-filterable-dropdown-options--up"
			);
		}
	}

	private closeDropdown() {
		this.isOpen = false;
		this.dropdownEl.removeClass("is-open");
		this.optionsEl.style.display = "none";

		// Stop position monitoring
		this.stopPositionMonitoring();

		// Clear filter to show all options on next open
		this.filteredOptions = [...this.options];
	}

	private updateInputValue() {
		const selectedOption = this.options.find(
			opt => opt.value === this.selectedValue
		);
		if (selectedOption) {
			this.inputEl.value = selectedOption.label;
		} else {
			this.inputEl.value = "";
		}
	}

	public setValue(value: string) {
		this.selectedValue = value;
		this.updateInputValue();
		this.renderOptions();
	}

	private makeInputEditable() {
		this.inputEl.removeAttribute("readonly");
		this.inputEl.focus();
		// For mobile devices, delay the selection to ensure keyboard is up
		setTimeout(() => {
			this.inputEl.select();
		}, 100);
	}

	private startPositionMonitoring() {
		// Stop any existing monitoring
		this.stopPositionMonitoring();

		// For mobile devices, continuously monitor position changes
		// This helps handle cases where the modal shifts due to keyboard appearance
		if (this.isMobileDevice()) {
			this.positionUpdateInterval = window.setInterval(() => {
				if (this.isOpen) {
					this.positionDropdown();
				}
			}, 100); // Check every 100ms
		}
	}

	private stopPositionMonitoring() {
		if (this.positionUpdateInterval !== null) {
			clearInterval(this.positionUpdateInterval);
			this.positionUpdateInterval = null;
		}
	}

	private isMobileDevice(): boolean {
		// Check if device is likely mobile based on screen size and touch capability
		return window.innerWidth <= 768 || "ontouchstart" in window;
	}

	public destroy() {
		// Stop position monitoring
		this.stopPositionMonitoring();

		// Remove event listeners
		if (this.documentClickHandler) {
			document.removeEventListener("click", this.documentClickHandler);
		}
		if (this.resizeHandler) {
			window.removeEventListener("resize", this.resizeHandler);
			window.removeEventListener("orientationchange", this.resizeHandler);
		}
		if (this.scrollHandler) {
			document.removeEventListener("scroll", this.scrollHandler, true);
		}

		// Remove elements
		this.dropdownEl.remove();
		this.optionsEl.remove();
	}
}
