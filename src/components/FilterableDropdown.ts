import { Setting } from "obsidian";
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
    
    private dropdownEl: HTMLElement;
    private inputEl: HTMLInputElement;
    private arrowEl: HTMLElement;
    private optionsEl: HTMLElement;

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
        this.dropdownEl = this.containerEl.createDiv("ai-actions-filterable-dropdown");
        
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
                spellcheck: "false"
            }
        });
        
        // Create arrow
        this.arrowEl = this.dropdownEl.createDiv("ai-actions-filterable-dropdown-arrow");
        
        // Create options container
        this.optionsEl = this.dropdownEl.createDiv("ai-actions-filterable-dropdown-options");
        
        // Set initial value
        this.updateInputValue();
        this.renderOptions();
    }

    private bindEvents() {
        // Click on input to toggle dropdown
        this.inputEl.addEventListener("click", (e) => {
            e.preventDefault();
            this.makeInputEditable();
            this.toggleDropdown();
        });

        // Touch events for mobile
        this.inputEl.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.makeInputEditable();
            this.openDropdown();
        });

        // Focus on input - make it editable
        this.inputEl.addEventListener("focus", () => {
            this.makeInputEditable();
        });

        // Input change for filtering
        this.inputEl.addEventListener("input", (e) => {
            const target = e.target as HTMLInputElement;
            this.filterOptions(target.value);
            this.openDropdown();
        });

        // Blur - close dropdown if clicking outside
        this.inputEl.addEventListener("blur", (e) => {
            // Delay to allow option click to register
            setTimeout(() => {
                this.closeDropdown();
                this.inputEl.setAttribute("readonly", "true");
                this.updateInputValue();
            }, 150);
        });

        // Keyboard navigation
        this.inputEl.addEventListener("keydown", (e) => {
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
        document.addEventListener("click", (e) => {
            if (!this.dropdownEl.contains(e.target as Node)) {
                this.closeDropdown();
            }
        });
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
            const noOptionsEl = this.optionsEl.createDiv("ai-actions-filterable-dropdown-no-options");
            noOptionsEl.textContent = "No models found";
            return;
        }

        this.filteredOptions.forEach((option, index) => {
            const optionEl = this.optionsEl.createDiv("ai-actions-filterable-dropdown-option");
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
        this.renderOptions();
    }

    private selectHighlighted() {
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredOptions.length) {
            this.selectOption(this.filteredOptions[this.highlightedIndex].value);
        }
    }

    private highlightNext() {
        if (this.filteredOptions.length === 0) return;
        this.highlightedIndex = (this.highlightedIndex + 1) % this.filteredOptions.length;
        this.updateHighlight();
    }

    private highlightPrevious() {
        if (this.filteredOptions.length === 0) return;
        this.highlightedIndex = this.highlightedIndex <= 0 
            ? this.filteredOptions.length - 1 
            : this.highlightedIndex - 1;
        this.updateHighlight();
    }

    private updateHighlight() {
        const optionEls = this.optionsEl.querySelectorAll(".ai-actions-filterable-dropdown-option");
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
        this.renderOptions();
    }

    private closeDropdown() {
        this.isOpen = false;
        this.dropdownEl.removeClass("is-open");
    }

    private updateInputValue() {
        const selectedOption = this.options.find(opt => opt.value === this.selectedValue);
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

    public destroy() {
        this.dropdownEl.remove();
    }
}