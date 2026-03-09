"use client"

import { useRef, useCallback, useImperativeHandle, forwardRef, useState } from "react"
import { EditorContent, EditorContext, useEditor, type Editor } from "@tiptap/react"
import { NodeSelection, TextSelection } from "@tiptap/pm/state"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Image } from "@tiptap/extension-image"

// --- UI Primitives ---
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import { ColorHighlightPopover } from "@/components/tiptap-ui/color-highlight-popover"
import { LinkPopover } from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Lib ---
import { MAX_FILE_SIZE, focusNextNode } from "@/lib/tiptap-utils"

// --- Context ---
import { useLocale } from "@/contexts/LocaleContext"

// --- Types ---
import type { MarkdownMessagePayload, ComposerDraft, UploadImageFn } from "../types"
import { editorToMarkdown } from "../utils/markdown"

export interface RichToolbarConfig {
  /** Show undo/redo buttons */
  undoRedo?: boolean
  /** Show heading dropdown */
  heading?: boolean
  /** Show list dropdown */
  list?: boolean
  /** Show blockquote button */
  blockquote?: boolean
  /** Show code block button */
  codeBlock?: boolean
  /** Show bold button */
  bold?: boolean
  /** Show italic button */
  italic?: boolean
  /** Show strikethrough button */
  strike?: boolean
  /** Show inline code button */
  code?: boolean
  /** Show underline button */
  underline?: boolean
  /** Show highlight button */
  highlight?: boolean
  /** Show link button */
  link?: boolean
  /** Show superscript button */
  superscript?: boolean
  /** Show subscript button */
  subscript?: boolean
  /** Show text align buttons */
  textAlign?: boolean
  /** Show image upload button */
  image?: boolean
}

const defaultToolbarConfig: RichToolbarConfig = {
  undoRedo: true,
  heading: true,
  list: true,
  blockquote: true,
  codeBlock: true,
  bold: true,
  italic: true,
  strike: true,
  code: true,
  underline: true,
  highlight: true,
  link: true,
  superscript: false,
  subscript: false,
  textAlign: true,
  image: true,
}

export interface RichEditorProps {
  placeholder?: string
  disabled?: boolean
  uploadImage?: UploadImageFn
  onUploadingChange?: (count: number) => void
  onSend?: () => void
  onChange?: () => void
  sendKeymap?: 'enter' | 'ctrlEnter' | 'cmdEnter'
  /** Toolbar configuration */
  toolbarConfig?: RichToolbarConfig
}

export interface RichEditorRef {
  editor: Editor | null
  focus: () => void
  clear: () => void
  exportPayload: () => MarkdownMessagePayload | null
  importMarkdown: (markdown: string) => void
  getDraft: () => ComposerDraft
  setDraft: (draft: ComposerDraft) => void
  setText: (text: string) => void
  insertText: (text: string) => void
  isUploading: () => boolean
}

const RichToolbar = ({ config }: { config: RichToolbarConfig }) => {
  const locale = useLocale()

  return (
    <Toolbar className="im-rich-toolbar">
      {config.undoRedo && (
        <ToolbarGroup>
          <UndoRedoButton action="undo" tooltip={locale.undo} />
          <UndoRedoButton action="redo" tooltip={locale.redo} />
        </ToolbarGroup>
      )}

      {config.undoRedo && (config.heading || config.list || config.blockquote || config.codeBlock) && <ToolbarSeparator />}

      {(config.heading || config.list || config.blockquote || config.codeBlock) && (
        <ToolbarGroup>
          {config.heading && (
            <HeadingDropdownMenu
              levels={[1, 2, 3, 4]}
              tooltip={locale.heading}
              labels={{
                heading1: locale.heading1,
                heading2: locale.heading2,
                heading3: locale.heading3,
                heading4: locale.heading4,
                paragraph: locale.paragraph,
              }}
            />
          )}
          {config.list && (
            <ListDropdownMenu
              types={["bulletList", "orderedList"]}
              tooltip={locale.list}
              labels={{
                bulletList: locale.bulletList,
                orderedList: locale.orderedList,
                taskList: locale.taskList,
              }}
            />
          )}
          {config.blockquote && <BlockquoteButton tooltip={locale.blockquote} />}
          {config.codeBlock && <CodeBlockButton tooltip={locale.codeBlock} />}
        </ToolbarGroup>
      )}

      {(config.heading || config.list || config.blockquote || config.codeBlock) &&
       (config.bold || config.italic || config.strike || config.code || config.underline || config.highlight || config.link) &&
       <ToolbarSeparator />}

      {(config.bold || config.italic || config.strike || config.code || config.underline || config.highlight || config.link) && (
        <ToolbarGroup>
          {config.bold && <MarkButton type="bold" tooltip={locale.bold} />}
          {config.italic && <MarkButton type="italic" tooltip={locale.italic} />}
          {config.strike && <MarkButton type="strike" tooltip={locale.strike} />}
          {config.code && <MarkButton type="code" tooltip={locale.code} />}
          {config.underline && <MarkButton type="underline" tooltip={locale.underline} />}
          {config.highlight && <ColorHighlightPopover tooltip={locale.highlight} removeTooltip={locale.removeHighlight} />}
          {config.link && (
            <LinkPopover
              tooltip={locale.link}
              placeholder={locale.linkPlaceholder}
              applyTooltip={locale.applyLink}
              openTooltip={locale.openLink}
              removeTooltip={locale.removeLink}
            />
          )}
        </ToolbarGroup>
      )}

      {(config.superscript || config.subscript) && <ToolbarSeparator />}

      {(config.superscript || config.subscript) && (
        <ToolbarGroup>
          {config.superscript && <MarkButton type="superscript" tooltip={locale.superscript} />}
          {config.subscript && <MarkButton type="subscript" tooltip={locale.subscript} />}
        </ToolbarGroup>
      )}

      {config.textAlign && <ToolbarSeparator />}

      {config.textAlign && (
        <ToolbarGroup>
          <TextAlignButton align="left" tooltip={locale.alignLeft} />
          <TextAlignButton align="center" tooltip={locale.alignCenter} />
          <TextAlignButton align="right" tooltip={locale.alignRight} />
          <TextAlignButton align="justify" tooltip={locale.alignJustify} />
        </ToolbarGroup>
      )}

      {config.image && <ToolbarSeparator />}

      {config.image && (
        <ToolbarGroup>
          <ImageUploadButton tooltip={locale.insertImage} />
        </ToolbarGroup>
      )}

      <Spacer />
    </Toolbar>
  )
}

export const RichEditor = forwardRef<RichEditorRef, RichEditorProps>(function RichEditor(
  {
    placeholder = "Write something...",
    disabled = false,
    uploadImage,
    onUploadingChange,
    onSend,
    onChange,
    sendKeymap = 'enter',
    toolbarConfig,
  },
  ref
) {
  const locale = useLocale()
  const uploadingCountRef = useRef(0)
  const [pasteUploads, setPasteUploads] = useState<Map<string, { name: string; size: number; progress: number }>>(new Map())
  const mergedToolbarConfig = { ...defaultToolbarConfig, ...toolbarConfig }

  const handleImageUpload = useCallback(async (
    file: File,
    onProgress?: (event: { progress: number }) => void,
    abortSignal?: AbortSignal
  ): Promise<string> => {
    if (!uploadImage) {
      throw new Error("No upload handler provided")
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`)
    }

    uploadingCountRef.current++
    onUploadingChange?.(uploadingCountRef.current)

    try {
      if (abortSignal?.aborted) {
        throw new Error("Upload cancelled")
      }

      const result = await uploadImage(file, (event) => {
        onProgress?.(event)
      })
      onProgress?.({ progress: 100 })
      return result.url
    } finally {
      uploadingCountRef.current--
      onUploadingChange?.(uploadingCountRef.current)
    }
  }, [uploadImage, onUploadingChange])

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        class: "im-rich-editor-content",
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement
        const { state } = view

        // Handle image click - select the image node on single click
        if (target.tagName === 'IMG') {
          const { doc } = state
          let imagePos = -1

          doc.descendants((node, nodePos) => {
            if (node.type.name === 'image' && imagePos === -1) {
              if (pos >= nodePos && pos <= nodePos + node.nodeSize) {
                imagePos = nodePos
                return false
              }
            }
            return true
          })

          if (imagePos >= 0) {
            const tr = state.tr.setSelection(NodeSelection.create(doc, imagePos))
            view.dispatch(tr)
            return true
          }
        }

        // If currently a NodeSelection (e.g., image selected), clicking elsewhere should create TextSelection
        if (state.selection instanceof NodeSelection) {
          const $pos = state.doc.resolve(pos)
          const tr = state.tr.setSelection(TextSelection.near($pos))
          view.dispatch(tr)
          view.focus()
          return true
        }

        return false
      },
      handlePaste: (view, event) => {
        if (!uploadImage) return false

        const items = event.clipboardData?.items
        if (!items) return false

        const imageFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) imageFiles.push(file)
          }
        }

        // Only handle if there are image files
        if (imageFiles.length === 0) return false

        // Prevent default paste behavior for images
        event.preventDefault()

        // Upload each image with progress tracking
        imageFiles.forEach((file) => {
          const uploadId = crypto.randomUUID()

          // Add to paste uploads state
          setPasteUploads(prev => {
            const next = new Map(prev)
            next.set(uploadId, { name: file.name, size: file.size, progress: 0 })
            return next
          })

          const uploadWithProgress = async () => {
            try {
              const url = await handleImageUpload(file, (event) => {
                setPasteUploads(prev => {
                  const next = new Map(prev)
                  const item = next.get(uploadId)
                  if (item) {
                    next.set(uploadId, { ...item, progress: event.progress })
                  }
                  return next
                })
              })
              // Insert image using the same method as toolbar upload
              if (editor) {
                const pos = editor.state.selection.from
                editor
                  .chain()
                  .focus()
                  .insertContentAt(pos, {
                    type: 'image',
                    attrs: { src: url },
                  })
                  .run()
                focusNextNode(editor)
              }
            } catch (error) {
              console.error('Failed to upload pasted image:', error)
            } finally {
              // Remove from paste uploads state
              setPasteUploads(prev => {
                const next = new Map(prev)
                next.delete(uploadId)
                return next
              })
            }
          }
          uploadWithProgress()
        })

        return true
      },
      handleDrop: (view, event) => {
        if (!uploadImage) return false

        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false

        const imageFiles = Array.from(files).filter(file =>
          file.type.startsWith('image/')
        )

        // Only handle if there are image files
        if (imageFiles.length === 0) return false

        // Prevent default drop behavior for images
        event.preventDefault()

        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })

        imageFiles.forEach(async (file) => {
          try {
            const url = await handleImageUpload(file)
            const node = view.state.schema.nodes.image.create({ src: url })
            const transaction = view.state.tr.insert(
              coordinates?.pos ?? view.state.selection.from,
              node
            )
            view.dispatch(transaction)
          } catch (error) {
            console.error('Failed to upload dropped image:', error)
          }
        })

        return true
      },
      handleKeyDown: (view, event) => {
        // Handle send keymap
        const isMod = event.metaKey || event.ctrlKey

        if (event.key === 'Enter' && !event.shiftKey) {
          if (sendKeymap === 'enter' && !isMod) {
            event.preventDefault()
            onSend?.()
            return true
          }
          if (sendKeymap === 'ctrlEnter' && event.ctrlKey) {
            event.preventDefault()
            onSend?.()
            return true
          }
          if (sendKeymap === 'cmdEnter' && event.metaKey) {
            event.preventDefault()
            onSend?.()
            return true
          }
        }
        return false
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Typography,
      Superscript,
      Subscript,
      Selection,
      Placeholder.configure({
        placeholder,
      }),
      Image,
      ...(uploadImage ? [
        ImageUploadNode.configure({
          accept: "image/*",
          maxSize: MAX_FILE_SIZE,
          limit: 3,
          upload: handleImageUpload,
          onError: (error) => console.error("Upload failed:", error),
          locale: {
            clickToUpload: locale.clickToUpload,
            orDragAndDrop: locale.orDragAndDrop,
            maxFiles: locale.maxFiles,
            clearAll: locale.clearAll,
            uploading: locale.uploading,
          },
        }),
      ] : []),
    ],
    onUpdate: () => {
      onChange?.()
    },
  })

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    editor,

    focus: () => {
      editor?.commands.focus()
    },

    clear: () => {
      editor?.commands.clearContent()
    },

    exportPayload: (): MarkdownMessagePayload | null => {
      if (!editor) return null
      if (uploadingCountRef.current > 0) return null

      const markdown = editorToMarkdown(editor)
      if (!markdown.trim()) return null

      return {
        type: 'markdown',
        markdown,
      }
    },

    importMarkdown: (markdown: string) => {
      if (editor) {
        editor.commands.setContent(markdown)
      }
    },

    getDraft: (): ComposerDraft => {
      return {
        mode: 'rich',
        json: editor?.getJSON(),
      }
    },

    setDraft: (draft: ComposerDraft) => {
      if (draft.json && editor) {
        editor.commands.setContent(draft.json)
      }
    },

    setText: (text: string) => {
      editor?.commands.setContent(text)
    },

    insertText: (text: string) => {
      editor?.commands.insertContent(text)
    },

    isUploading: () => uploadingCountRef.current > 0,
  }), [editor])

  return (
    <div className="im-rich-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <RichToolbar config={mergedToolbarConfig} />
        <div className="im-rich-editor-container">
          <EditorContent
            editor={editor}
            role="presentation"
          />
        </div>
        {/* Paste upload progress indicator */}
        {pasteUploads.size > 0 && (
          <div className="im-paste-upload-progress tiptap-image-upload">
            {Array.from(pasteUploads.entries()).map(([id, { name, size, progress }]) => (
              <div key={id} className="tiptap-image-upload-preview">
                <div
                  className="tiptap-image-upload-progress"
                  style={{ width: `${progress}%` }}
                />
                <div className="tiptap-image-upload-preview-content">
                  <div className="tiptap-image-upload-file-info">
                    <div className="tiptap-image-upload-file-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.1953 4.41771C10.3478 4.08499 9.43578 3.94949 8.5282 4.02147C7.62062 4.09345 6.74133 4.37102 5.95691 4.83316C5.1725 5.2953 4.50354 5.92989 4.00071 6.68886C3.49788 7.44783 3.17436 8.31128 3.05465 9.2138C2.93495 10.1163 3.0222 11.0343 3.3098 11.8981C3.5974 12.7619 4.07781 13.5489 4.71463 14.1995C5.10094 14.5942 5.09414 15.2274 4.69945 15.6137C4.30476 16 3.67163 15.9932 3.28532 15.5985C2.43622 14.731 1.79568 13.6816 1.41221 12.5299C1.02875 11.3781 0.91241 10.1542 1.07201 8.95084C1.23162 7.74748 1.66298 6.59621 2.33343 5.58425C3.00387 4.57229 3.89581 3.72617 4.9417 3.10998C5.98758 2.4938 7.15998 2.1237 8.37008 2.02773C9.58018 1.93176 10.7963 2.11243 11.9262 2.55605C13.0561 2.99968 14.0703 3.69462 14.8919 4.58825C15.5423 5.29573 16.0585 6.11304 16.4177 7.00002H17.4999C18.6799 6.99991 19.8288 7.37933 20.7766 8.08222C21.7245 8.78515 22.4212 9.7743 22.7637 10.9036C23.1062 12.0328 23.0765 13.2423 22.6788 14.3534C22.2812 15.4644 21.5367 16.4181 20.5554 17.0736C20.0962 17.3803 19.4752 17.2567 19.1684 16.7975C18.8617 16.3382 18.9853 15.7172 19.4445 15.4105C20.069 14.9934 20.5427 14.3865 20.7958 13.6794C21.0488 12.9724 21.0678 12.2027 20.8498 11.4841C20.6318 10.7655 20.1885 10.136 19.5853 9.6887C18.9821 9.24138 18.251 8.99993 17.5001 9.00002H15.71C15.2679 9.00002 14.8783 8.70973 14.7518 8.28611C14.4913 7.41374 14.0357 6.61208 13.4195 5.94186C12.8034 5.27164 12.0427 4.75043 11.1953 4.41771Z" fill="currentColor"/>
                        <path d="M11 14.4142V21C11 21.5523 11.4477 22 12 22C12.5523 22 13 21.5523 13 21V14.4142L15.2929 16.7071C15.6834 17.0976 16.3166 17.0976 16.7071 16.7071C17.0976 16.3166 17.0976 15.6834 16.7071 15.2929L12.7078 11.2936C12.7054 11.2912 12.703 11.2888 12.7005 11.2864C12.5208 11.1099 12.2746 11.0008 12.003 11L12 11L11.997 11C11.8625 11.0004 11.7343 11.0273 11.6172 11.0759C11.502 11.1236 11.3938 11.1937 11.2995 11.2864C11.297 11.2888 11.2946 11.2912 11.2922 11.2936L7.29289 15.2929C6.90237 15.6834 6.90237 16.3166 7.29289 16.7071C7.68342 17.0976 8.31658 17.0976 8.70711 16.7071L11 14.4142Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <div className="tiptap-image-upload-details">
                      <span className="tiptap-image-upload-text">{name}</span>
                      <span className="tiptap-image-upload-subtext">
                        {size === 0 ? "0 Bytes" : (() => {
                          const k = 1024
                          const sizes = ["Bytes", "KB", "MB", "GB"]
                          const i = Math.floor(Math.log(size) / Math.log(k))
                          return `${parseFloat((size / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="tiptap-image-upload-actions">
                    <span className="tiptap-image-upload-progress-text">{progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </EditorContext.Provider>
    </div>
  )
})
