import { z } from "zod";
import { SearchResult, SearchOperationResult } from "../../types.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { validateVaultPath } from "../../utils/path.js";
import { createTool } from "../../utils/tool-factory.js";
import {
  processFilesForTags,
  matchesTagCriteria,
  getMatchingTags,
  TagMatchOptions,
} from "../../utils/tag-search.js";
import { createToolResponse } from "../../utils/responses.js";
import {
  PaginationMetadata,
  createPaginatedResponse,
  formatPaginationNavigation,
} from "../../utils/pagination.js";
import { promises as fs } from "fs";
import path from "path";

// Input validation schema with descriptions
const schema = z
  .object({
    vault: z
      .string()
      .min(1, "Vault name cannot be empty")
      .describe("Name of the vault to search in"),
    tags: z
      .array(z.string())
      .min(1, "At least one tag must be specified")
      .describe("Array of tags to search for (e.g., ['Character', 'Deity'])"),
    operator: z
      .enum(["AND", "OR"])
      .optional()
      .default("AND")
      .describe("How to combine multiple tags (default: AND)"),
    includeHierarchy: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Whether to include child/parent tags in search (default: false)"
      ),
    location: z
      .enum(["frontmatter", "content", "both"])
      .optional()
      .default("both")
      .describe("Where to search for tags (default: both)"),
    path: z
      .string()
      .optional()
      .describe(
        "Optional subfolder path within the vault to limit search scope"
      ),
    caseSensitive: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to perform case-sensitive search (default: false)"),
    includeContent: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to include note content in results (default: false)"),
    includeContext: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Whether to include context around matched tags (default: true)"
      ),
    // Pagination parameters
    page: z
      .number()
      .int()
      .min(1)
      .optional()
      .default(1)
      .describe("Page number to return (starting from 1)"),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Number of results per page (max: 50)"),
  })
  .strict();

type SearchByTagsInput = z.infer<typeof schema>;

interface TagSearchResult extends SearchResult {
  matchedTags: Array<{
    tag: string;
    location: string;
    line?: number;
    context?: string;
  }>;
}

interface TagSearchOperationResult extends SearchOperationResult {
  results: TagSearchResult[];
  pagination?: PaginationMetadata;
}

async function searchByTags(
  vaultPath: string,
  options: SearchByTagsInput
): Promise<TagSearchOperationResult> {
  try {
    // Process all files in the vault to extract tags
    const fileTagsMap = await processFilesForTags(vaultPath, {
      path: options.path,
      extractOptions: {
        normalize: true,
        includeContext: options.includeContext,
        contextLines: 2,
      },
    });

    const matchOptions: TagMatchOptions = {
      operator: options.operator,
      includeHierarchy: options.includeHierarchy,
      location: options.location,
      caseSensitive: options.caseSensitive,
    };

    const allResults: TagSearchResult[] = [];
    let totalMatches = 0;

    // Check each file for matching tags
    for (const [filePath, fileTags] of fileTagsMap.entries()) {
      // Check if file matches the tag criteria
      if (matchesTagCriteria(fileTags, options.tags, matchOptions)) {
        // Get the specific tags that matched
        const matchedTags = getMatchingTags(
          fileTags,
          options.tags,
          matchOptions
        );

        // Format matched tags for the result
        const formattedMatches = matchedTags.map((tag) => ({
          tag: tag.tag,
          location: tag.location,
          line: tag.line,
          context: tag.context,
        }));

        // Create search matches for the result
        const searchMatches = matchedTags.map((tag) => ({
          line: tag.line || 0,
          text: tag.context || `Tag: ${tag.tag} (${tag.location})`,
        }));

        // Get file content if requested
        let content: string | undefined;
        if (options.includeContent) {
          try {
            content = await fs.readFile(
              path.join(vaultPath, filePath),
              "utf-8"
            );
          } catch (err) {
            console.error(`Error reading file ${filePath}:`, err);
          }
        }

        allResults.push({
          file: filePath,
          content,
          matches: searchMatches,
          matchedTags: formattedMatches,
        });

        totalMatches += matchedTags.length;
      }
    }

    // Apply pagination
    const { items: paginatedResults, pagination } = createPaginatedResponse(
      allResults,
      options.page,
      options.pageSize
    );

    return {
      success: true,
      message: `Found ${
        allResults.length
      } notes matching tags: [${options.tags.join(", ")}] (${
        options.operator
      } operator)`,
      results: paginatedResults,
      totalMatches,
      matchedFiles: allResults.length,
      pagination,
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error searching by tags: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function createSearchByTagsTool(vaults: Map<string, string>) {
  return createTool<SearchByTagsInput>(
    {
      name: "search-by-tags",
      description: `Search for notes with specific tags.

Examples:
- Basic search: { "vault": "my-vault", "tags": ["Character"] }
- Multiple tags (AND): { "vault": "my-vault", "tags": ["Character", "Deity"] }
- Multiple tags (OR): { "vault": "my-vault", "tags": ["Character", "Deity"], "operator": "OR" }
- With hierarchy: { "vault": "my-vault", "tags": ["status"], "includeHierarchy": true }
- Specific location: { "vault": "my-vault", "tags": ["project"], "location": "frontmatter" }
- With content: { "vault": "my-vault", "tags": ["Character"], "includeContent": true }
- Pagination: { "vault": "my-vault", "tags": ["Character"], "page": 2, "pageSize": 10 }`,
      schema,
      handler: async (args, vaultPath, _vaultName) => {
        const result = await searchByTags(vaultPath, args);

        // Format the response
        let message = `${result.message}\n\n`;

        if (result.results.length === 0) {
          message += "No matching notes found.";
        } else {
          result.results.forEach((file, index) => {
            message += `${index + 1}. ${file.file}\n`;

            // Group tags by location
            const frontmatterTags = file.matchedTags
              .filter((tag) => tag.location === "frontmatter")
              .map((tag) => tag.tag);

            const contentTags = file.matchedTags.filter(
              (tag) => tag.location === "content"
            );

            // Show frontmatter tags
            if (frontmatterTags.length > 0) {
              message += `   - Tags in frontmatter: ${frontmatterTags.join(
                ", "
              )}\n`;
            }

            // Show content tags with context
            if (contentTags.length > 0) {
              message += `   - Tags in content:\n`;
              contentTags.forEach((tag) => {
                message += `     - ${tag.tag}`;
                if (tag.line) {
                  message += ` (line ${tag.line})`;
                }
                message += "\n";

                if (tag.context) {
                  // Format context with indentation
                  const formattedContext = tag.context
                    .split("\n")
                    .map((line) => `       ${line}`)
                    .join("\n");
                  message += `${formattedContext}\n`;
                }
              });
            }

            // Add separator between files
            message += "\n";
          });

          // Add pagination information if available
          if (result.pagination) {
            message += "\n" + formatPaginationNavigation(result.pagination);
          }
        }

        return createToolResponse(message.trim());
      },
    },
    vaults
  );
}
