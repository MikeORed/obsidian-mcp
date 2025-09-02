# Project Structure & Organization

## Directory Layout

```
obsidian-mcp/
├── src/                    # Source code
│   ├── main.ts            # CLI entry point & vault validation
│   ├── server.ts          # MCP server implementation
│   ├── types.ts           # TypeScript type definitions
│   ├── tools/             # Tool implementations
│   │   ├── create-note/
│   │   ├── read-note/
│   │   ├── edit-note/
│   │   ├── delete-note/
│   │   ├── move-note/
│   │   ├── search-vault/
│   │   ├── add-tags/
│   │   ├── remove-tags/
│   │   ├── rename-tag/
│   │   ├── list-all-tags/
│   │   ├── search-by-tags/
│   │   ├── create-directory/
│   │   └── list-available-vaults/
│   ├── utils/             # Shared utilities
│   │   ├── errors.ts      # Error handling utilities
│   │   ├── files.ts       # File system operations
│   │   ├── path.ts        # Path validation & security
│   │   ├── responses.ts   # Response formatting
│   │   ├── schema.ts      # Schema handling utilities
│   │   ├── security.ts    # Rate limiting & monitoring
│   │   ├── tags.ts        # Tag manipulation utilities
│   │   ├── tool-factory.ts # Tool creation utilities
│   │   └── vault-resolver.ts # Vault path resolution
│   ├── resources/         # MCP resource handlers
│   └── prompts/           # MCP prompt implementations
├── build/                 # Compiled output
├── docs/                  # Documentation
│   ├── creating-tools.md  # Tool development guide
│   └── tool-examples.md   # Implementation examples
├── out/                   # Additional build artifacts
└── node_modules/          # Dependencies
```

## Code Organization Patterns

### Tool Structure

Each tool follows a consistent pattern:

- **Directory**: `src/tools/{tool-name}/index.ts`
- **Schema Definition**: Zod schema with descriptions
- **Core Function**: Private async implementation
- **Factory Export**: Public factory function accepting vault map
- **Error Handling**: Standardized error conversion
- **Response Formatting**: Consistent response structure

### Utility Organization

- **Domain-Specific**: Utilities grouped by functionality (files, tags, paths)
- **Cross-Cutting**: Security, errors, and responses span multiple domains
- **Factory Pattern**: Tool and schema creation utilities
- **Validation**: Path security and input validation utilities

### Type Definitions

- **Centralized**: All shared types in `src/types.ts`
- **Tool Types**: Input/output interfaces for tools
- **Operation Results**: Standardized result structures
- **MCP Types**: Protocol-specific interfaces

## Naming Conventions

### Files & Directories

- **kebab-case**: All file and directory names
- **Descriptive**: Names clearly indicate purpose
- **Consistent**: Similar functionality uses similar naming

### Code Elements

- **camelCase**: Variables, functions, properties
- **PascalCase**: Classes, interfaces, types
- **UPPER_SNAKE_CASE**: Constants and environment variables
- **Prefixes**: Utility functions often prefixed by domain (e.g., `validateVaultPath`)

### Tool Naming

- **Verb-Noun**: Tools named as actions (e.g., `create-note`, `search-vault`)
- **Hyphenated**: Multi-word tools use hyphens
- **Descriptive**: Names clearly indicate tool purpose

## Import/Export Patterns

### ES Modules

- **Explicit Extensions**: All imports include `.js` extension
- **Named Exports**: Prefer named exports over default
- **Barrel Exports**: Avoid index.ts barrel files
- **Direct Imports**: Import specific functions, not entire modules

### Dependency Management

- **Peer Dependencies**: MCP SDK as peer dependency
- **Minimal Dependencies**: Only essential runtime dependencies
- **Dev Dependencies**: Build and type dependencies separate

## Security Patterns

### Path Validation

- **Vault Boundaries**: All paths validated against vault root
- **No Traversal**: Path traversal attacks prevented
- **Absolute Paths**: Internal paths always absolute
- **Sanitization**: User inputs sanitized before use

### Input Validation

- **Schema-First**: All inputs validated via Zod schemas
- **Strict Schemas**: Use `.strict()` to prevent extra properties
- **Descriptive Errors**: Validation errors include helpful messages
- **JSON Schema**: Schemas convertible to JSON Schema for MCP

### Error Handling

- **Centralized**: Common error patterns in utility functions
- **MCP Compliant**: All errors converted to MCP error format
- **Actionable**: Error messages guide user toward resolution
- **Security**: No sensitive information leaked in errors

## Development Guidelines

### Adding New Tools

1. Create directory under `src/tools/`
2. Implement following the established pattern
3. Use existing utilities for common operations
4. Register in server initialization
5. Update documentation if needed

### Modifying Utilities

- Consider impact on existing tools
- Maintain backward compatibility
- Update type definitions if needed
- Test with multiple tools

### Error Handling

- Use utility functions for common error types
- Convert all errors to MCP format
- Provide specific, actionable error messages
- Log detailed errors to stderr, user-friendly to stdout
