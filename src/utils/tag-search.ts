import { parse as parseYaml } from "yaml";
import { parseNote } from "./tags.js";
import { promises as fs } from "fs";
import path from "path";
import { getAllMarkdownFiles } from "./files.js";
import { safeJoinPath } from "./path.js";
import { normalizeTag, matchesTagPattern, isParentTag } from "./tags.js";

/**
 * Represents a tag occurrence in a file with metadata
 */
export interface TagOccurrence {
  tag: string; // The original tag as found in the file
  normalized: string; // The normalized version of the tag
  location: "frontmatter" | "content"; // Where the tag was found
  line?: number; // Line number for content tags
  context?: string; // Surrounding text for content tags
}

/**
 * Represents a hierarchical tag structure
 */
export interface TagHierarchy {
  tag: string; // The tag name
  count: number; // Number of occurrences
  files: string[]; // Files where this tag appears
  children: TagHierarchy[]; // Child tags
}

/**
 * Options for tag extraction
 */
export interface TagExtractionOptions {
  normalize?: boolean; // Whether to normalize tags
  includeContext?: boolean; // Whether to include context for content tags
  contextLines?: number; // Number of context lines to include
}

/**
 * Options for tag matching
 */
export interface TagMatchOptions {
  operator: "AND" | "OR"; // How to combine multiple tags
  includeHierarchy: boolean; // Whether to include child/parent tags
  location: "frontmatter" | "content" | "both"; // Where to search
  caseSensitive: boolean; // Whether to perform case-sensitive search
}

/**
 * Options for file processing
 */
export interface FileProcessingOptions {
  path?: string; // Subfolder path to limit scope
  extractOptions?: TagExtractionOptions; // Options for tag extraction
}

/**
 * Extract tags with metadata from a file's content
 */
export function extractTagsWithMetadata(
  content: string,
  options: TagExtractionOptions = {}
): TagOccurrence[] {
  const {
    normalize = true,
    includeContext = false,
    contextLines = 1,
  } = options;

  const tagOccurrences: TagOccurrence[] = [];
  const parsed = parseNote(content);

  // Extract frontmatter tags
  if (parsed.hasFrontmatter && parsed.frontmatter.tags) {
    const frontmatterTags = Array.isArray(parsed.frontmatter.tags)
      ? parsed.frontmatter.tags
      : [parsed.frontmatter.tags];

    frontmatterTags.forEach((tag) => {
      // Handle tags with or without # prefix
      const cleanTag = String(tag).replace(/^#/, "");
      tagOccurrences.push({
        tag: cleanTag,
        normalized: normalize ? normalizeTag(cleanTag) : cleanTag,
        location: "frontmatter",
      });
    });
  }

  // REMOVING THIS SECTION FOR NOW, Content hash detection cannot be easily trusted to represent tags
  // // Extract content tags
  // const lines = parsed.content.split("\n");
  // let inCodeBlock = false;
  // let inHtmlComment = false;

  // lines.forEach((line, index) => {
  //   // Skip code blocks and HTML comments
  //   if (line.trim().startsWith("```")) {
  //     inCodeBlock = !inCodeBlock;
  //     return;
  //   }
  //   if (line.includes("<!--")) inHtmlComment = true;
  //   if (line.includes("-->")) inHtmlComment = false;
  //   if (inCodeBlock || inHtmlComment) return;

  //   // Match hashtags
  //   const tagMatches = line.match(/(?<!`)#[a-zA-Z0-9][a-zA-Z0-9/]*(?!`)/g);
  //   if (tagMatches) {
  //     tagMatches.forEach((match) => {
  //       const tag = match.slice(1); // Remove # prefix

  //       let context = "";
  //       if (includeContext) {
  //         // Get surrounding lines for context
  //         const startLine = Math.max(0, index - contextLines);
  //         const endLine = Math.min(lines.length - 1, index + contextLines);
  //         context = lines.slice(startLine, endLine + 1).join("\n");
  //       }

  //       tagOccurrences.push({
  //         tag,
  //         normalized: normalize ? normalizeTag(tag) : tag,
  //         location: "content",
  //         line: index + 1,
  //         context: includeContext ? context : undefined,
  //       });
  //     });
  //   }
  // });

  return tagOccurrences;
}

/**
 * Check if a file's tags match the search criteria
 */
export function matchesTagCriteria(
  fileTags: TagOccurrence[],
  searchTags: string[],
  options: TagMatchOptions
): boolean {
  const {
    operator = "AND",
    includeHierarchy = false,
    location = "both",
    caseSensitive = false,
  } = options;

  // Filter tags by location if needed
  const filteredTags = fileTags.filter(
    (tag) => location === "both" || tag.location === location
  );

  // Normalize search tags
  const normalizedSearchTags = searchTags.map((tag) =>
    caseSensitive ? tag.replace(/^#/, "") : normalizeTag(tag)
  );

  // For AND operator, all search tags must match
  if (operator === "AND") {
    return normalizedSearchTags.every((searchTag) => {
      return filteredTags.some((fileTag) => {
        const tagToCompare = caseSensitive ? fileTag.tag : fileTag.normalized;

        // Direct match
        if (tagToCompare === searchTag) return true;

        // Hierarchical match if enabled
        if (includeHierarchy) {
          // Check if search tag is a parent of file tag
          if (isParentTag(searchTag, tagToCompare)) return true;

          // Check if file tag is a parent of search tag
          if (isParentTag(tagToCompare, searchTag)) return true;
        }

        return false;
      });
    });
  }

  // For OR operator, at least one search tag must match
  return normalizedSearchTags.some((searchTag) => {
    return filteredTags.some((fileTag) => {
      const tagToCompare = caseSensitive ? fileTag.tag : fileTag.normalized;

      // Direct match
      if (tagToCompare === searchTag) return true;

      // Hierarchical match if enabled
      if (includeHierarchy) {
        // Check if search tag is a parent of file tag
        if (isParentTag(searchTag, tagToCompare)) return true;

        // Check if file tag is a parent of search tag
        if (isParentTag(tagToCompare, searchTag)) return true;
      }

      return false;
    });
  });
}

/**
 * Build a hierarchical structure of tags
 */
export function buildTagHierarchy(
  tagMap: Map<string, { count: number; files: string[] }>
): TagHierarchy[] {
  const hierarchy: TagHierarchy[] = [];
  const tagEntries = Array.from(tagMap.entries());

  // Sort tags by count (descending)
  tagEntries.sort((a, b) => b[1].count - a[1].count);

  // First pass: create all tag nodes
  const tagNodes = new Map<string, TagHierarchy>();
  tagEntries.forEach(([tag, data]) => {
    tagNodes.set(tag, {
      tag,
      count: data.count,
      files: data.files,
      children: [],
    });
  });

  // Second pass: build hierarchy
  tagEntries.forEach(([tag]) => {
    const parts = tag.split("/");

    // Skip root-level tags (no hierarchy)
    if (parts.length === 1) {
      hierarchy.push(tagNodes.get(tag)!);
      return;
    }

    // Find parent tag
    let parentPath = parts.slice(0, -1).join("/");
    const parentNode = tagNodes.get(parentPath);

    if (parentNode) {
      // Add as child to parent
      parentNode.children.push(tagNodes.get(tag)!);
    } else {
      // No parent found, add to root
      hierarchy.push(tagNodes.get(tag)!);
    }
  });

  return hierarchy;
}

/**
 * Process all files in a vault to extract tags
 */
export async function processFilesForTags(
  vaultPath: string,
  options: FileProcessingOptions = {}
): Promise<Map<string, TagOccurrence[]>> {
  const {
    path: subPath,
    extractOptions = { normalize: true, includeContext: false },
  } = options;

  // Use safeJoinPath for path safety
  const searchDir = subPath ? safeJoinPath(vaultPath, subPath) : vaultPath;
  const files = await getAllMarkdownFiles(vaultPath, searchDir);

  const fileTagsMap = new Map<string, TagOccurrence[]>();

  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8");
      const relativePath = path.relative(vaultPath, file);
      const tagOccurrences = extractTagsWithMetadata(content, extractOptions);

      if (tagOccurrences.length > 0) {
        fileTagsMap.set(relativePath, tagOccurrences);
      }
    } catch (err) {
      console.error(`Error processing file ${file}:`, err);
      // Continue with other files
    }
  }

  return fileTagsMap;
}

/**
 * Aggregate tags from all files
 */
export function aggregateTags(
  fileTagsMap: Map<string, TagOccurrence[]>
): Map<string, { count: number; files: string[] }> {
  const tagMap = new Map<string, { count: number; files: string[] }>();

  for (const [file, tags] of fileTagsMap.entries()) {
    // Track unique tags per file to avoid counting duplicates within the same file
    const uniqueTagsInFile = new Set<string>();

    for (const tag of tags) {
      const normalizedTag = tag.normalized;
      uniqueTagsInFile.add(normalizedTag);
    }

    // Update global tag counts
    for (const tag of uniqueTagsInFile) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { count: 0, files: [] });
      }

      const tagData = tagMap.get(tag)!;
      tagData.count++;
      tagData.files.push(file);
    }
  }

  return tagMap;
}

/**
 * Format tag hierarchy for display
 */
export function formatTagHierarchy(
  hierarchy: TagHierarchy[],
  level: number = 0
): string {
  let result = "";
  const indent = "  ".repeat(level);

  for (const node of hierarchy) {
    result += `${indent}- ${node.tag} (${node.count})\n`;

    if (node.children.length > 0) {
      result += formatTagHierarchy(node.children, level + 1);
    }
  }

  return result;
}

/**
 * Get matching tags from a file
 */
export function getMatchingTags(
  fileTags: TagOccurrence[],
  searchTags: string[],
  options: TagMatchOptions
): TagOccurrence[] {
  const {
    includeHierarchy = false,
    location = "both",
    caseSensitive = false,
  } = options;

  // Filter tags by location if needed
  const filteredTags = fileTags.filter(
    (tag) => location === "both" || tag.location === location
  );

  // Normalize search tags
  const normalizedSearchTags = searchTags.map((tag) =>
    caseSensitive ? tag.replace(/^#/, "") : normalizeTag(tag)
  );

  return filteredTags.filter((fileTag) => {
    const tagToCompare = caseSensitive ? fileTag.tag : fileTag.normalized;

    return normalizedSearchTags.some((searchTag) => {
      // Direct match
      if (tagToCompare === searchTag) return true;

      // Hierarchical match if enabled
      if (includeHierarchy) {
        // Check if search tag is a parent of file tag
        if (isParentTag(searchTag, tagToCompare)) return true;

        // Check if file tag is a parent of search tag
        if (isParentTag(tagToCompare, searchTag)) return true;
      }

      return false;
    });
  });
}
