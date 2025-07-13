## Changelog

### 0.5.1 - 2025-07-13
- feat(gemini): enhance autocompleteStreaming to support system instructions for compatible models
- fix(handler): validate clipboard content before returning it

### 0.5.0 - 2025-07-13
- feat(handler): add clipboard support for text input

### 0.4.3 - 2025-07-13
- feat(mobile): add virtual keyboard auto-hide on mobile devices

### 0.4.2 - 2025-07-12
- fix: update action button labels to uppercase and adjust cancel button styles

### 0.4.1 - 2025-07-12
- fix: improve text formatting and escape key handling

### 0.4.0 - 2025-07-12
- feat(ai-providers): integrate plugin AI providers support

### 0.3.5 - 2025-07-09
- refactor(quick-prompt): simplify positioning logic by using direct CSS properties

### 0.3.4 - 2025-07-08
- fix(FilterableDropdown): clear filter when closing drop down
- fix(FilterableDropdown): clear filter after selection to show all options
- feat: add dynamic dropdown direction calculation for FilterableDropdown component
- feat: implement filterable dropdown component for model selection in action editors

### 0.3.3 - 2025-07-06
- feat: enhance dynamic positioning for quick prompt box and update related styles

### 0.3.2 - 2025-07-05
- refactor: remove debugMode parameter from LLM constructors and settings

### 0.3.1 - 2025-07-04
- fix: disable useNativeFetch by default to support streaming

### 0.3.0 - 2025-07-04
- style(ActionResultPanel): adjust button dimensions and padding for consistency
- refactor(action-result): change panel positioning to fixed top-left
- refactor(ActionResultPanel): replace buttons with div elements and simplify styles
- feat(action-handler): replace modal with svelte panel for action results

### 0.2.4 - 2025-07-03
- refactor(handler): Add app.workspace.updateOptions() calls after UI operations

### 0.2.3 - 2025-07-03
- fix: maintain editor focus during quick prompt operations

### 0.2.2 - 2025-07-03
- Replace custom Gemini API implementation with the official SDK to simplify maintenance and improve reliability.

### 0.2.1 - 2025-07-01
- feat(model-editor): auto-update display name when model is selected
- feat(provider-editor): auto-update provider name when type changes
- chore: upgrade openai dependency
- feat(anthropic): add support for anthropic ai provider

### 0.2.0 - 2025-06-24
- refactor(QuickPromptBox): replace mode dropdown with toggle button
- feat(quick-prompt): display provider name with model in selection
- feat(quick-prompt): add output mode selection for prompt processing
- refactor(ui): improve textarea styling and auto-resize logic
- feat(quick-prompt): improve textarea auto-resize and positioning
- chore: update dependencies to fix deprecation warnings
- feat: add spinner based on the example project [obsidian-local-gpt](https://github.com/pfrankov/obsidian-local-gpt) by [Pavel Frankov](https://github.com/pfrankov) 
- feat: add quick prompt feature with svelte UI
- refactor: update type imports to use verbatimModuleSyntax
- perf: implement streaming with user prompt for all LLM providers
- style: update UI styles for modal and spinner components
- docs: update README with new features and screenshots
- build: add svelte and related dependencies to package.json
- ci: update tsconfig to include svelte files

### 0.1.3 - 2025-06-24
- Small fixes

### 0.1.0 - 2025-06-22
- Fork of the original project [obsidian-ai-editor](https://github.com/buszk/obsidian-ai-editor) by [Zekun Shen (buszk)](https://github.com/buszk)
- Added support for different providers based on the example project [obsidian-ai-providers](https://github.com/pfrankov/obsidian-ai-providers) by [Pavel Frankov](https://github.com/pfrankov)
- Added Debug mode
