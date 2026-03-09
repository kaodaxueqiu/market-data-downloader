import { useCallback, useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import type { MarkType, ResolvedPos } from "@tiptap/pm/model"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Lib ---
import {
  isMarkInSchema,
  isNodeTypeSelected,
  sanitizeUrl,
} from "@/lib/tiptap-utils"

/**
 * Configuration for the link popover functionality
 */
export interface UseLinkPopoverConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether to hide the link popover when not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called when the link is set.
   */
  onSetLink?: () => void
}

/**
 * Configuration for the link handler functionality
 */
export interface LinkHandlerProps {
  /**
   * The Tiptap editor instance.
   */
  editor: Editor | null
  /**
   * Callback function called when the link is set.
   */
  onSetLink?: () => void
}

/**
 * Checks if a link can be set in the current editor state
 */
export function canSetLink(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false

  // The third argument 'true' checks whether the current selection is inside an image caption, and prevents setting a link there
  // If the selection is inside an image caption, we can't set a link
  if (isNodeTypeSelected(editor, ["image"], true)) return false
  return editor.can().setMark("link")
}

/**
 * Checks if a link is currently active in the editor
 */
export function isSelectionInLink(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false

  const { state } = editor
  const { selection, schema, doc } = state
  const linkMark = schema.marks.link

  if (!linkMark) return false

  if (!selection.empty) {
    return doc.rangeHasMark(selection.from, selection.to, linkMark)
  }

  const { nodeBefore, nodeAfter } = selection.$from
  const linkInBefore =
    !!nodeBefore?.isText && nodeBefore.marks.some((mark) => mark.type === linkMark)
  const linkInAfter =
    !!nodeAfter?.isText && nodeAfter.marks.some((mark) => mark.type === linkMark)

  if (linkInBefore && !linkInAfter) {
    return false
  }

  return linkInBefore || linkInAfter
}

function getMarkRange($pos: ResolvedPos, markType: MarkType) {
  const { parent, parentOffset } = $pos
  const start = parent.childAfter(parentOffset)
  const end = parent.childBefore(parentOffset)

  let node = start.node
  let index = start.index
  let offset = start.offset

  if (!node || !markType.isInSet(node.marks)) {
    if (!end.node || !markType.isInSet(end.node.marks)) {
      return null
    }
    node = end.node
    index = end.index
    offset = end.offset
  }

  let from = $pos.start() + offset
  let to = from + node.nodeSize

  let i = index - 1
  while (i >= 0) {
    const child = parent.child(i)
    if (!markType.isInSet(child.marks)) break
    from -= child.nodeSize
    i -= 1
  }

  i = index + 1
  while (i < parent.childCount) {
    const child = parent.child(i)
    if (!markType.isInSet(child.marks)) break
    to += child.nodeSize
    i += 1
  }

  return { from, to }
}

export function isLinkActive(editor: Editor | null): boolean {
  return isSelectionInLink(editor)
}

/**
 * Determines if the link button should be shown
 */
export function shouldShowLinkButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  const linkInSchema = isMarkInSchema("link", editor)

  if (!linkInSchema || !editor) {
    return false
  }

  if (hideWhenUnavailable && !editor.isActive("code")) {
    return canSetLink(editor)
  }

  return true
}

/**
 * Custom hook for handling link operations in a Tiptap editor
 */
export function useLinkHandler(props: LinkHandlerProps) {
  const { editor, onSetLink } = props
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!editor) return

    // Get URL immediately on mount
    const { href } = editor.getAttributes("link")

    if (isLinkActive(editor) && url === null) {
      setUrl(href || "")
    }
  }, [editor, url])

  useEffect(() => {
    if (!editor) return

    const updateLinkState = () => {
      const { href } = editor.getAttributes("link")
      setUrl(href || "")
    }

    editor.on("selectionUpdate", updateLinkState)
    return () => {
      editor.off("selectionUpdate", updateLinkState)
    }
  }, [editor])

  const setLink = useCallback(() => {
    if (!url || !editor) return

    const { selection } = editor.state
    const isEmpty = selection.empty

    let chain = editor.chain().focus()

    chain = chain.extendMarkRange("link").setLink({ href: url })

    if (isEmpty) {
      chain = chain.insertContent({ type: "text", text: url })
    }

    chain.run()

    const linkMark = editor.schema.marks.link
    if (linkMark) {
      const { state } = editor
      const range = getMarkRange(state.selection.$from, linkMark)
      if (range) {
        const $after = state.doc.resolve(range.to)
        const nodeAfter = $after.nodeAfter
        const nextChar = nodeAfter?.isText ? nodeAfter.text?.[0] : null
        const hasPlainSpace =
          nextChar === " " && !nodeAfter?.marks.some((mark) => mark.type === linkMark)

        let tr = state.tr
        if (hasPlainSpace) {
          tr = tr.setSelection(TextSelection.create(state.doc, range.to + 1))
        } else {
          tr = tr.insertText(" ", range.to)
          tr = tr.removeMark(range.to, range.to + 1, linkMark)
          tr = tr.setSelection(TextSelection.create(tr.doc, range.to + 1))
        }
        tr.setMeta("addToHistory", false)
        editor.view.dispatch(tr)
      }

      const tr = editor.state.tr.removeStoredMark(linkMark)
      tr.setMeta("addToHistory", false)
      editor.view.dispatch(tr)
    }

    const scheduleFocus =
      typeof globalThis.requestAnimationFrame === "function"
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (cb: FrameRequestCallback) => globalThis.setTimeout(cb, 0)
    scheduleFocus(() => {
      editor.view.focus()
    })

    setUrl(null)

    onSetLink?.()
  }, [editor, onSetLink, url])

  const removeLink = useCallback(() => {
    if (!editor) return
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .unsetLink()
      .setMeta("preventAutolink", true)
      .run()
    setUrl("")
  }, [editor])

  const openLink = useCallback(
    (target: string = "_blank", features: string = "noopener,noreferrer") => {
      if (!url) return

      const safeUrl = sanitizeUrl(url, window.location.href)
      if (safeUrl !== "#") {
        window.open(safeUrl, target, features)
      }
    },
    [url]
  )

  return {
    url: url || "",
    setUrl,
    setLink,
    removeLink,
    openLink,
  }
}

/**
 * Custom hook for link popover state management
 */
export function useLinkState(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}) {
  const { editor, hideWhenUnavailable = false } = props

  const canSet = canSetLink(editor)
  const isActive = isLinkActive(editor)

  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      setIsVisible(
        shouldShowLinkButton({
          editor,
          hideWhenUnavailable,
        })
      )
    }

    handleSelectionUpdate()

    editor.on("selectionUpdate", handleSelectionUpdate)

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate)
    }
  }, [editor, hideWhenUnavailable])

  return {
    isVisible,
    canSet,
    isActive,
  }
}

/**
 * Main hook that provides link popover functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MyLinkButton() {
 *   const { isVisible, canSet, isActive, Icon, label } = useLinkPopover()
 *
 *   if (!isVisible) return null
 *
 *   return <button disabled={!canSet}>Link</button>
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedLinkButton() {
 *   const { isVisible, canSet, isActive, Icon, label } = useLinkPopover({
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onSetLink: () => console.log('Link set!')
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <MyButton
 *       disabled={!canSet}
 *       aria-label={label}
 *       aria-pressed={isActive}
 *     >
 *       <Icon />
 *       {label}
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useLinkPopover(config?: UseLinkPopoverConfig) {
  const {
    editor: providedEditor,
    hideWhenUnavailable = false,
    onSetLink,
  } = config || {}

  const { editor } = useTiptapEditor(providedEditor)

  const { isVisible, canSet, isActive } = useLinkState({
    editor,
    hideWhenUnavailable,
  })

  const linkHandler = useLinkHandler({
    editor,
    onSetLink,
  })

  return {
    isVisible,
    canSet,
    isActive,
    label: "Link",
    Icon: LinkIcon,
    ...linkHandler,
  }
}
