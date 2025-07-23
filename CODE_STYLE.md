# Code Style and Linting Setup

This project uses **Prettier** for code formatting and **ESLint** for code linting, configured to work seamlessly together following Obsidian plugin development best practices.

## Configuration

### Prettier Configuration (`.prettierrc`)
- **Tabs**: Uses tabs for indentation (4 spaces wide) to match Obsidian's style
- **Semicolons**: Always uses semicolons
- **Quotes**: Uses double quotes by default
- **Trailing commas**: ES5 compatible trailing commas
- **Line endings**: LF (Unix-style)
- **Print width**: 80 characters

### ESLint Configuration (`eslint.config.mjs`)
- **TypeScript support**: Full TypeScript linting with `@typescript-eslint`
- **Prettier integration**: Uses `eslint-config-prettier` to disable conflicting rules
- **Obsidian compatibility**: Follows Obsidian plugin development standards

### EditorConfig (`.editorconfig`)
- **Tabs**: 4-space wide tabs
- **Line endings**: LF
- **Final newline**: Always insert
- **Charset**: UTF-8

## Available Scripts

### Code Style (Prettier)
```bash
# Check code style issues
npm run cs

# Fix code style issues automatically  
npm run cs:fix
```

### Linting (ESLint)
```bash
# Check for linting issues
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Combined
```bash
# Fix both linting and formatting issues
npm run format
```

## VS Code Integration

The project includes VS Code settings (`.vscode/settings.json`) that:
- **Format on save**: Automatically formats files when saved
- **ESLint auto-fix**: Runs ESLint fixes on save
- **Tab settings**: Uses tabs with 4-space width
- **Final newlines**: Ensures files end with newline
- **Trim whitespace**: Removes trailing whitespace

### Required VS Code Extensions
For full functionality, install:
- **ESLint**: `ms-vscode.vscode-eslint`
- **Prettier**: `esbenp.prettier-vscode` (optional, can use CLI)

## File Exclusions

### Prettier (`.prettierignore`)
- `node_modules/`
- `main.js` (build output)
- `references/` (external code)
- Documentation files (`.md`)
- Package files (`package-lock.json`, `versions.json`)

### ESLint (`eslint.config.mjs`)
- Test files and mocks
- Build outputs
- External references

## Compatibility

This setup is designed to be compatible with:
- **Obsidian plugin guidelines**: Follows official style recommendations
- **TypeScript**: Full support with proper typing
- **Svelte**: Component formatting support
- **Jest**: Test file handling

## Development Workflow

1. **Before committing**: Run `npm run format` to ensure consistent style
2. **During development**: VS Code will auto-format and fix issues on save
3. **CI/CD**: Add `npm run cs` and `npm run lint` to your build pipeline

## Troubleshooting

### Prettier not working in VS Code
- Ensure the Prettier extension is installed
- Check that `.prettierrc` exists in project root
- Verify `"prettier.requireConfig": true` in VS Code settings

### ESLint conflicts with Prettier
- Configuration includes `eslint-config-prettier` to prevent conflicts
- If issues persist, check that it's listed last in the ESLint extends array

### Files not being formatted
- Check if file is listed in `.prettierignore`
- Verify file extension is supported
- For new file types, add parser configuration to `.prettierrc`
