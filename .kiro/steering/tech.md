# Technology Stack

## Runtime & Build System

- **Runtime**: Node.js 16+ (Bun for development)
- **Language**: TypeScript with ES2020 target
- **Module System**: ES Modules (type: "module")
- **Build Tool**: Bun build system
- **Package Manager**: NPM (with Bun lockfile)

## Core Dependencies

- **MCP SDK**: `@modelcontextprotocol/sdk` - Model Context Protocol implementation
- **Validation**: `zod` + `zod-to-json-schema` - Runtime type validation and JSON Schema generation
- **YAML Processing**: `yaml` - For parsing Obsidian configuration files

## Development Dependencies

- **TypeScript**: Latest TypeScript compiler
- **Node Types**: `@types/node` for Node.js type definitions
- **Bun Types**: `@types/bun` for Bun-specific APIs

## Common Commands

### Development

```bash
# Install dependencies
npm install

# Build the project
npm run build
# or
bun build ./src/main.ts --outdir build --target node && chmod +x build/main.js

# Start the server (after build)
npm start
# or
bun build/main.js

# Development with MCP inspector
npm run inspect
# or
bunx @modelcontextprotocol/inspector bun ./build/main.js
```

### Testing & Debugging

```bash
# Run with specific vault paths
node build/main.js /path/to/vault1 /path/to/vault2

# Debug with MCP inspector
bunx @modelcontextprotocol/inspector bun ./build/main.js
```

### Publishing

```bash
# Prepare for publishing (builds automatically)
npm run prepublishOnly
```

## Architecture Patterns

- **Tool Factory Pattern**: Each tool is created via factory functions that accept vault configurations
- **Schema-First Validation**: All inputs validated using Zod schemas with JSON Schema generation
- **Utility-Based**: Common functionality extracted into utility modules
- **Error Boundary**: Centralized error handling with MCP-compliant error responses
- **Security Layers**: Rate limiting, path validation, and connection monitoring

## File Organization

- **Entry Point**: `src/main.ts` - CLI argument processing and server initialization
- **Server Core**: `src/server.ts` - MCP server implementation and request handling
- **Tools**: `src/tools/*/index.ts` - Individual tool implementations
- **Utilities**: `src/utils/*.ts` - Shared functionality and helpers
- **Types**: `src/types.ts` - TypeScript type definitions
- **Resources**: `src/resources/` - MCP resource handlers
- **Prompts**: `src/prompts/` - MCP prompt implementations
