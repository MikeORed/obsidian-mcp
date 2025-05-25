/**
 * Pagination utility for Obsidian MCP tools
 *
 * This utility provides functions and types for implementing pagination
 * across various tools that return potentially large result sets.
 */

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Pagination metadata for responses
 */
export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Generic wrapper for paginated responses
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMetadata;
}

/**
 * Paginate an array of results
 *
 * @param items The array of items to paginate
 * @param page The current page number (1-based)
 * @param pageSize The number of items per page
 * @returns A slice of the items for the current page
 */
export function paginateResults<T>(
  items: T[],
  page: number,
  pageSize: number
): T[] {
  // Ensure valid pagination parameters
  const validPage = Math.max(1, page);
  const validPageSize = Math.max(1, pageSize);

  // Calculate start and end indices
  const startIndex = (validPage - 1) * validPageSize;
  const endIndex = Math.min(startIndex + validPageSize, items.length);

  // Return the slice of items for the current page
  return items.slice(startIndex, endIndex);
}

/**
 * Create pagination metadata
 *
 * @param totalItems The total number of items
 * @param page The current page number (1-based)
 * @param pageSize The number of items per page
 * @returns Pagination metadata
 */
export function createPaginationMetadata(
  totalItems: number,
  page: number,
  pageSize: number
): PaginationMetadata {
  // Ensure valid pagination parameters
  const validPageSize = Math.max(1, pageSize);
  const totalPages = Math.ceil(totalItems / validPageSize);
  const validPage = Math.min(Math.max(1, page), Math.max(1, totalPages));

  return {
    page: validPage,
    pageSize: validPageSize,
    totalPages,
    totalItems,
    hasNextPage: validPage < totalPages,
    hasPreviousPage: validPage > 1,
  };
}

/**
 * Create a paginated response
 *
 * @param allItems The array of all items
 * @param page The current page number (1-based)
 * @param pageSize The number of items per page
 * @returns A paginated response with items and pagination metadata
 */
export function createPaginatedResponse<T>(
  allItems: T[],
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const paginatedItems = paginateResults(allItems, page, pageSize);
  const metadata = createPaginationMetadata(allItems.length, page, pageSize);

  return {
    items: paginatedItems,
    pagination: metadata,
  };
}

/**
 * Format pagination information for display in responses
 *
 * @param pagination The pagination metadata
 * @returns A formatted string with pagination information
 */
export function formatPaginationInfo(pagination: PaginationMetadata): string {
  const { page, totalPages, totalItems } = pagination;

  if (totalPages <= 1) {
    return `${totalItems} item${totalItems !== 1 ? "s" : ""}`;
  }

  return `Page ${page} of ${totalPages} (${totalItems} total item${
    totalItems !== 1 ? "s" : ""
  })`;
}

/**
 * Create pagination navigation links
 *
 * @param pagination The pagination metadata
 * @returns A formatted string with navigation links
 */
export function formatPaginationNavigation(
  pagination: PaginationMetadata
): string {
  const { page, totalPages, hasNextPage, hasPreviousPage } = pagination;

  if (totalPages <= 1) {
    return "";
  }

  const parts = [`Page ${page} of ${totalPages}`];

  if (hasNextPage) {
    parts.push(`Use page: ${page + 1} for next page`);
  }

  if (hasPreviousPage) {
    parts.push(`Use page: ${page - 1} for previous page`);
  }

  return parts.join(" | ");
}
