import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { createTool } from "../../utils/tool-factory.js";
import {
  processFilesForTags,
  aggregateTags,
  buildTagHierarchy,
  formatTagHierarchy,
} from "../../utils/tag-search.js";
import {
  PaginationMetadata,
  createPaginatedResponse,
  formatPaginationNavigation,
} from "../../utils/pagination.js";

// Input validation schema with descriptions
const schema = z
  .object({
    vault: z
      .string()
      .min(1, "Vault name cannot be empty")
      .describe("Name of the vault to scan for tags"),
    path: z
      .string()
      .optional()
      .describe("Optional subfolder path within the vault to limit scan scope"),
    includeCount: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to include usage count for each tag (default: true)"),
    includeHierarchy: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to organize tags hierarchically (default: false)"),
    includeLocations: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Whether to include file locations for each tag (default: false)"
      ),
    limit: z
      .number()
      .optional()
      .default(100)
      .describe(
        "Maximum number of tags to return (default: 100, use 0 for all)"
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
      .default(20)
      .describe("Number of tags per page (max: 50)"),
  })
  .strict();

type ListAllTagsInput = z.infer<typeof schema>;

interface TagListResult {
  success: boolean;
  message: string;
  totalTags: number;
  tags: Array<{
    tag: string;
    count: number;
    files?: string[];
  }>;
  hierarchicalView?: string;
  pagination?: PaginationMetadata;
}

async function listAllTags(
  vaultPath: string,
  options: ListAllTagsInput
): Promise<TagListResult> {
  try {
    // Process all files in the vault to extract tags
    const fileTagsMap = await processFilesForTags(vaultPath, {
      path: options.path,
      extractOptions: {
        normalize: true,
        includeContext: false,
      },
    });

    // Aggregate tags from all files
    const tagMap = aggregateTags(fileTagsMap);

    // Convert to array for sorting and limiting
    const tagArray = Array.from(tagMap.entries()).map(([tag, data]) => ({
      tag,
      count: data.count,
      files: options.includeLocations ? data.files : undefined,
    }));

    // Sort by count (descending)
    tagArray.sort((a, b) => b.count - a.count);

    // Apply limit if specified (limit takes precedence over pagination)
    let filteredTags =
      options.limit > 0 ? tagArray.slice(0, options.limit) : tagArray;

    // Apply pagination if not using limit or if limit is larger than a page
    let pagination: PaginationMetadata | undefined;
    if (options.limit === 0 || options.limit > options.pageSize) {
      const paginatedResponse = createPaginatedResponse(
        filteredTags,
        options.page,
        options.pageSize
      );
      filteredTags = paginatedResponse.items;
      pagination = paginatedResponse.pagination;
    }

    // Build hierarchical view if requested
    let hierarchicalView: string | undefined;
    if (options.includeHierarchy) {
      const hierarchy = buildTagHierarchy(tagMap);
      hierarchicalView = formatTagHierarchy(hierarchy);
    }

    return {
      success: true,
      message: `Found ${tagArray.length} unique tags in vault${
        options.path ? ` (path: ${options.path})` : ""
      }`,
      totalTags: tagArray.length,
      tags: filteredTags,
      hierarchicalView,
      pagination,
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error listing tags: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function createListAllTagsTool(vaults: Map<string, string>) {
  return createTool<ListAllTagsInput>(
    {
      name: "list-all-tags",
      description: `List all tags used in a vault with usage statistics.

Examples:
- Basic usage: { "vault": "my-vault" }
- With subfolder: { "vault": "my-vault", "path": "projects/active" }
- With hierarchy: { "vault": "my-vault", "includeHierarchy": true }
- With file locations: { "vault": "my-vault", "includeLocations": true }
- Limited results: { "vault": "my-vault", "limit": 10 }
- Pagination: { "vault": "my-vault", "page": 2, "pageSize": 20 }`,
      schema,
      handler: async (args, vaultPath, _vaultName) => {
        const result = await listAllTags(vaultPath, args);

        // Format the response
        let message = `${result.message}\n\n`;

        if (result.tags.length === 0) {
          message += "No tags found.";
        } else {
          // Add most used tags section
          message += "Most used tags:\n";
          result.tags.forEach((tag) => {
            message += `- ${tag.tag} (${tag.count} occurrence${
              tag.count !== 1 ? "s" : ""
            })`;

            // Add file locations if requested
            if (args.includeLocations && tag.files && tag.files.length > 0) {
              message += "\n  Found in:";
              // Limit the number of files shown to avoid excessive output
              const filesToShow = tag.files.slice(0, 5);
              filesToShow.forEach((file) => {
                message += `\n  - ${file}`;
              });

              // Indicate if there are more files
              if (tag.files.length > 5) {
                message += `\n  - ... and ${tag.files.length - 5} more files`;
              }
            }

            message += "\n";
          });

          // Add hierarchical view if requested
          if (result.hierarchicalView) {
            message += "\nHierarchical structure:\n";
            message += result.hierarchicalView;
          }

          // Add pagination information if available
          if (result.pagination) {
            message += "\n\n" + formatPaginationNavigation(result.pagination);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: message.trim(),
            },
          ],
        };
      },
    },
    vaults
  );
}
