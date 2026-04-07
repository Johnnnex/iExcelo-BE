/**
 * Strips TipTap HTML output and markdown from message content to produce
 * a plain-text preview suitable for chatroom list rows and notifications.
 *
 * Called immediately when a message arrives so every downstream consumer
 * (WS broadcast, notification service, email) gets consistent clean text.
 */
export function buildPreview(content: string, maxLen = 100): string {
  return (
    content
      // Block-level tags → space (so adjacent paragraphs/divs don't merge words)
      .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, ' ')
      .replace(/<(br|hr)\s*\/?>/gi, ' ')
      // HTML images → "(Image)" with surrounding spaces so text doesn't merge
      .replace(/<img[^>]*>/gi, ' (Image) ')
      // Markdown images → "(Image)"
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' (Image) ')
      // Markdown links → link text only
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Bold / italic
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Inline code
      .replace(/`([^`]+)`/g, '$1')
      // Heading markers
      .replace(/^#+\s+/gm, '')
      // All remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Common HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      // Collapse whitespace / newlines
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen)
  );
}
