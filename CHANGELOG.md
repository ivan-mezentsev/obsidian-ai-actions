# Changelog

## 0.7.5 - 2026-01-07

- reduce dead code
- improve error handling

## 0.7.4 - 2026-01-06

- reduce dead code

## 0.7.3 - 2025-08-27

- fix(QuickPromptBox): synchronize control size with dropdown input height

## 0.7.2 - 2025-08-22

- fix(QuickPromptEditModal): update description for LLM setting
- Updated package descriptions

## 0.7.1 - 2025-08-20

- fix(QuickPromptBox): ensure selected model is synced after loading (#37)

## 0.7.0 - 2025-08-13

- style(QuickPromptBox): update aria-label and button colors for accessibility
- feat(QuickPromptBox): enhance focus management within prompt box
- feat(QuickPromptBox): enhance accessibility for submit button
- feat: implement input source handling

## 0.6.1 - 2025-08-08

- fix(build): enable minification by adding missing TypeScript and CSS loaders to esbuild
- fix(vscode): update ESLint extension recommendation

## 0.6.0 - 2025-07-29

- Introduced systemPromptSupport parameter in OllamaLLM, OpenAILLM, and OpenRouterLLM to control the usage of system prompts.
- Updated autocomplete methods to conditionally include system prompts based on the new parameter.
- Enhanced unit tests for OpenAILLM and OpenRouterLLM to verify behavior with systemPromptSupport.
- Adjusted PluginAIProvidersLLM to accommodate the new parameter and ensure consistent message formatting.
- Migrated existing settings to include systemPromptSupport with a default value of true.
- Updated UI components to allow users to toggle system prompt support in model settings.
- Removed deprecated settings related to testing mode and default model for cleaner configuration.

## 0.5.9 - 2025-07-27

- refactor: improve touch event handling for mobile in FilterableDropdown
- refactor: clean up esbuild configuration and remove unnecessary autocorrect attribute from QuickPromptBox
- refactor: update esbuild configuration and dependencies; enhance QuickPromptBox component
- refactor(tests): implement MockResponse and MockReadableStreamReader for improved testing utilities
- refactor(tests): update ESLint rules for mock files and adjust tsconfig exclusions
- refactor(test): enhance mock AI providers service and type definitions
- refactor(test): streamline TextDecoder and TextEncoder setup for Node.js environment

## 0.5.8 - 2025-07-26

- style(eslint): format eslint config for better readability
- refactor(thinking-tags): extract thinking tags logic to utils module
- refactor(thinking-tags): improve thinking tags processing logic
- refactor: rename unused parameters with underscore prefix
- fix(eslint): update rules for no-unused-vars and ban-ts-comment
- test(OllamaLLM): add comprehensive tests for OllamaLLM functionality
- test(LMStudioLLM): add comprehensive tests for LMStudioLLM functionality
- test(AnthropicLLM): add comprehensive tests for AnthropicLLM functionality
- test(PluginAIProvidersLLM): add comprehensive tests for PluginAIProvidersLLM functionality
- test(GroqLLM): add comprehensive unit tests for GroqLLM functionality
- test(OpenRouterLLM): add comprehensive unit tests for OpenRouterLLM functionality
- chore: add overrides for glob inflight and test-exclude dependencies in package.json

## 0.5.7 - 2025-07-25

- refactor: update QuickPromptBox to use Platform for OS detection and improve dynamic placeholder logic
- refactor: update button labels and section names for clarity in settings
- refactor: replace header elements with Setting components for improved UI consistency
- fix: standardize capitalization in UI labels and messages
- feat: add OpenAI test implementation

## 0.5.6 - 2025-07-24

- chore: update dependencies
- refactor: improve type safety and test coverage in handler
- feat: integrate Prettier and ESLint with configuration and scripts for code formatting and linting
- refactor: add modelDropdown property and cleanup in ActionEditModal and QuickPromptEditModal
- refactor: clean up imports and improve type usage across multiple files
- refactor: improve code readability and remove 'any' type usage in LLM classes
- refactor: replace 'any' types with specific types across multiple LLM classes
- Replace 'any' types with proper interfaces for plugin and clipboard handling
- Add type safety for Obsidian app commands and error handling
- Improve error handling consistency by removing redundant try-catch blocks
- feat: update ESLint config and clean imports in action and FilterableDropdown components

## 0.5.5 - 2025-07-22

- feat: add applyFinalFormatToDisplay method for result formatting after streaming
- feat: add default location parameter to action result handling and update panel behavior
- feat(ui): add touch event support for mobile devices in action panel
- feat: enhance ESLint configuration with additional global variables and improve type safety in action event handling
- build(eslint): extend typescript eslint rules
- build: migrate eslint config to flat config format
- refactor: centralize streaming logic with improved error handling
- feat(README): update clipboard paste description and add Quick Prompt command section
- feat(styles): add border to model selection modal for improved visibility

## 0.5.4 - 2025-07-20

- feat(FilterableDropdown): add position monitoring for mobile devices during dropdown interactions

## 0.5.3 - 2025-07-20

- feat(modal): implement model selection modal and integrate with action handler

## 0.5.2 - 2025-07-19

- feat: integrate FilterableDropdown into ModelEditModal and update styles for dropdown positioning
- feat: enhance LLM classes to support callback functionality for result handling in both streaming and non-streaming modes
- fix(QuickPromptBox): ensure selected model is available after loading
- feat: refactor autocomplete methods to support streaming and callback functionality across various LLM implementations
- feat: add Jest testing framework and setup for GeminiLLM
- feat: add support for optional user prompts in autocomplete streaming methods

## 0.5.1 - 2025-07-13

- feat(gemini): enhance autocompleteStreaming to support system instructions for compatible models
- fix(handler): validate clipboard content before returning it

## 0.5.0 - 2025-07-13

- feat(handler): add clipboard support for text input

## 0.4.3 - 2025-07-13

- feat(mobile): add virtual keyboard auto-hide on mobile devices

## 0.4.2 - 2025-07-12

- fix: update action button labels to uppercase and adjust cancel button styles

## 0.4.1 - 2025-07-12

- fix: improve text formatting and escape key handling

## 0.4.0 - 2025-07-12

- feat(ai-providers): integrate plugin AI providers support

## 0.3.5 - 2025-07-09

- refactor(quick-prompt): simplify positioning logic by using direct CSS properties

## 0.3.4 - 2025-07-08

- fix(FilterableDropdown): clear filter when closing drop down
- fix(FilterableDropdown): clear filter after selection to show all options
- feat: add dynamic dropdown direction calculation for FilterableDropdown component
- feat: implement filterable dropdown component for model selection in action editors

## 0.3.3 - 2025-07-06

- feat: enhance dynamic positioning for quick prompt box and update related styles

## 0.3.2 - 2025-07-05

- refactor: remove debugMode parameter from LLM constructors and settings

## 0.3.1 - 2025-07-04

- fix: disable useNativeFetch by default to support streaming

## 0.3.0 - 2025-07-04

- style(ActionResultPanel): adjust button dimensions and padding for consistency
- refactor(action-result): change panel positioning to fixed top-left
- refactor(ActionResultPanel): replace buttons with div elements and simplify styles
- feat(action-handler): replace modal with svelte panel for action results

## 0.2.4 - 2025-07-03

- refactor(handler): Add app.workspace.updateOptions() calls after UI operations

## 0.2.3 - 2025-07-03

- fix: maintain editor focus during quick prompt operations

## 0.2.2 - 2025-07-03

- Replace custom Gemini API implementation with the official SDK to simplify maintenance and improve reliability.

## 0.2.1 - 2025-07-01

- feat(model-editor): auto-update display name when model is selected
- feat(provider-editor): auto-update provider name when type changes
- chore: upgrade openai dependency
- feat(anthropic): add support for anthropic ai provider

## 0.2.0 - 2025-06-24

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

## 0.1.3 - 2025-06-24

- Small fixes

## 0.1.0 - 2025-06-22

- Fork of the original project [obsidian-ai-editor](https://github.com/buszk/obsidian-ai-editor) by [Zekun Shen (buszk)](https://github.com/buszk)
- Added support for different providers based on the example project [obsidian-ai-providers](https://github.com/pfrankov/obsidian-ai-providers) by [Pavel Frankov](https://github.com/pfrankov)
- Added Debug mode
