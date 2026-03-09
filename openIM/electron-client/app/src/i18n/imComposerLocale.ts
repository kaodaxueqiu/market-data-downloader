import type { IMComposerLocale } from "@openim/im-composer";
import type { TFunction } from "i18next";

const translate = (t: TFunction, key: string, fallback: string) => {
  const value = t(key, { defaultValue: fallback, returnNull: false });
  return typeof value === "string" ? value : fallback;
};

export const getIMComposerLocale = (t: TFunction): IMComposerLocale => ({
  // Basic
  placeholderPlain: translate(t, "chat.composer.placeholderPlain", "Type a message..."),
  placeholderRich: translate(t, "chat.composer.placeholderRich", "Write something..."),
  mentionNoResults: translate(t, "chat.composer.mentionNoResults", "No results found"),
  mentionLoading: translate(t, "chat.composer.mentionLoading", "Loading..."),
  mentionError: translate(t, "chat.composer.mentionError", "Failed to load"),
  removeAttachment: translate(t, "chat.composer.removeAttachment", "Remove"),
  removeQuote: translate(t, "chat.composer.removeQuote", "Remove quote"),
  uploadFailed: translate(t, "chat.composer.uploadFailed", "Upload failed"),
  uploading: translate(t, "chat.composer.uploading", "Uploading..."),

  // Toolbar buttons
  undo: translate(t, "chat.composer.undo", "Undo"),
  redo: translate(t, "chat.composer.redo", "Redo"),
  heading: translate(t, "chat.composer.heading", "Heading"),
  heading1: translate(t, "chat.composer.heading1", "Heading 1"),
  heading2: translate(t, "chat.composer.heading2", "Heading 2"),
  heading3: translate(t, "chat.composer.heading3", "Heading 3"),
  heading4: translate(t, "chat.composer.heading4", "Heading 4"),
  paragraph: translate(t, "chat.composer.paragraph", "Paragraph"),
  list: translate(t, "chat.composer.list", "List"),
  bulletList: translate(t, "chat.composer.bulletList", "Bullet List"),
  orderedList: translate(t, "chat.composer.orderedList", "Ordered List"),
  taskList: translate(t, "chat.composer.taskList", "Task List"),
  blockquote: translate(t, "chat.composer.blockquote", "Blockquote"),
  codeBlock: translate(t, "chat.composer.codeBlock", "Code Block"),
  bold: translate(t, "chat.composer.bold", "Bold"),
  italic: translate(t, "chat.composer.italic", "Italic"),
  strike: translate(t, "chat.composer.strike", "Strikethrough"),
  code: translate(t, "chat.composer.code", "Code"),
  underline: translate(t, "chat.composer.underline", "Underline"),
  highlight: translate(t, "chat.composer.highlight", "Highlight"),
  removeHighlight: translate(t, "chat.composer.removeHighlight", "Remove Highlight"),
  link: translate(t, "chat.composer.link", "Link"),
  linkPlaceholder: translate(t, "chat.composer.linkPlaceholder", "Paste a link..."),
  applyLink: translate(t, "chat.composer.applyLink", "Apply"),
  openLink: translate(t, "chat.composer.openLink", "Open in new window"),
  removeLink: translate(t, "chat.composer.removeLink", "Remove link"),
  superscript: translate(t, "chat.composer.superscript", "Superscript"),
  subscript: translate(t, "chat.composer.subscript", "Subscript"),
  alignLeft: translate(t, "chat.composer.alignLeft", "Align Left"),
  alignCenter: translate(t, "chat.composer.alignCenter", "Align Center"),
  alignRight: translate(t, "chat.composer.alignRight", "Align Right"),
  alignJustify: translate(t, "chat.composer.alignJustify", "Justify"),
  insertImage: translate(t, "chat.composer.insertImage", "Insert Image"),
  uploadImage: translate(t, "chat.composer.uploadImage", "Upload Image"),
  clickToUpload: translate(t, "chat.composer.clickToUpload", "Click to upload"),
  orDragAndDrop: translate(t, "chat.composer.orDragAndDrop", "or drag and drop"),
  maxFiles: translate(
    t,
    "chat.composer.maxFiles",
    "Maximum {limit} file(s), {size}MB each",
  ),
  clearAll: translate(t, "chat.composer.clearAll", "Clear All"),
});
