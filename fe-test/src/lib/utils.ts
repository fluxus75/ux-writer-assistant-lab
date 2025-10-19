/**
 * Format datetime string to MM-DD HH:mm format
 * @param dateString ISO datetime string
 * @returns Formatted string like "01-15 14:30"
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}-${day} ${hours}:${minutes}`;
}

/**
 * Truncate text to specified length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text with "..." if needed
 */
export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
