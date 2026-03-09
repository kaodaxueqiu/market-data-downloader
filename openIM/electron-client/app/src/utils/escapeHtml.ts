/**
 * Escapes HTML special characters to prevent HTML injection.
 */
export function escapeHtml(text: string): string {
  if (!text) return "";

  const placeholders: string[] = [];
  const PLACEHOLDER_PREFIX = "__HTML_PLACEHOLDER_";
  let sanitizedText = text;

  const storePlaceholder = (fragment: string) => {
    const placeholder = `${PLACEHOLDER_PREFIX}${placeholders.length}__`;
    placeholders.push(fragment);
    return placeholder;
  };

  const preserveMentionsWithoutDom = (raw: string) => {
    const mentionPattern =
      /<span\b[^>]*class=["'][^"']*\bim-mention-blot\b[^"']*["'][^>]*>/gi;
    const lowerRaw = raw.toLowerCase();
    let rebuilt = "";
    let lastIndex = 0;

    const extractMentionSpan = (startIndex: number) => {
      let cursor = startIndex;
      let depth = 0;
      while (cursor < raw.length) {
        if (lowerRaw.startsWith("<span", cursor)) {
          depth++;
          const closeIdx = raw.indexOf(">", cursor);
          if (closeIdx === -1) return null;
          cursor = closeIdx + 1;
          continue;
        }
        if (lowerRaw.startsWith("</span>", cursor)) {
          depth--;
          cursor += 7;
          if (depth === 0) {
            return cursor;
          }
          continue;
        }
        cursor++;
      }
      return null;
    };

    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(raw)) !== null) {
      const start = match.index;
      const spanEnd = extractMentionSpan(start);
      if (!spanEnd) {
        continue;
      }
      const fragment = raw.slice(start, spanEnd);
      const placeholder = storePlaceholder(fragment);
      rebuilt += raw.slice(lastIndex, start) + placeholder;
      lastIndex = spanEnd;
      mentionPattern.lastIndex = spanEnd;
    }

    if (lastIndex > 0) {
      rebuilt += raw.slice(lastIndex);
      return rebuilt;
    }
    return raw;
  };

  const preserveEmojiWithoutDom = (raw: string) => {
    const emojiPattern = /<img\b[^>]*class=["'][^"']*\bemojione\b[^"']*["'][^>]*>/gi;
    return raw.replace(emojiPattern, (match) => storePlaceholder(match));
  };

  const containsMention = sanitizedText.includes("im-mention-blot");
  const containsEmoji = sanitizedText.includes("emojione");

  if ((containsMention || containsEmoji) && typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = sanitizedText;
    const targetNodes = Array.from(
      container.querySelectorAll("span.im-mention-blot, img.emojione, img.im-emojione"),
    );
    targetNodes.forEach((node) => {
      const placeholder = storePlaceholder((node as HTMLElement).outerHTML);
      node.outerHTML = placeholder;
    });
    sanitizedText = container.innerHTML;
  } else {
    if (containsMention) {
      sanitizedText = preserveMentionsWithoutDom(sanitizedText);
    }
    if (containsEmoji) {
      sanitizedText = preserveEmojiWithoutDom(sanitizedText);
    }
  }

  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  // Do not escape '/' so that URL patterns remain linkifiable after escaping
  let escaped = sanitizedText.replace(/[&<>"']/g, (char) => map[char] || char);

  placeholders.forEach((fragment, index) => {
    const placeholder = `${PLACEHOLDER_PREFIX}${index}__`;
    escaped = escaped.replace(placeholder, fragment);
  });

  return escaped;
}
