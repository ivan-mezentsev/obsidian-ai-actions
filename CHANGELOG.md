## Changelog

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
