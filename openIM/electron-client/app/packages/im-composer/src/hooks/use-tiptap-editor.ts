import type { Editor } from "@tiptap/react"
import { useCurrentEditor, useEditorState } from "@tiptap/react"
import { useMemo } from "react"

/**
 * Hook that provides access to a Tiptap editor instance.
 *
 * Accepts an optional editor instance directly, or falls back to retrieving
 * the editor from the Tiptap context if available. This allows components
 * to work both when given an editor directly and when used within a Tiptap
 * editor context.
 *
 * @param providedEditor - Optional editor instance to use instead of the context editor
 * @returns The provided editor or the editor from context, whichever is available
 */
export function useTiptapEditor(providedEditor?: Editor | null): {
  editor: Editor | null
} {
  const { editor: coreEditor } = useCurrentEditor()
  const mainEditor = useMemo(
    () => providedEditor || coreEditor,
    [providedEditor, coreEditor]
  )

  // useEditorState listens to editor "transaction" events via Tiptap and
  // forces a re-render when the editor updates, so toolbar controls stay in sync.
  // It should only be used to select small, comparable values (not deep state).
  // NOTE: We select `transactionNumber` so every transaction changes the selected value
  // and triggers a UI update, without deep-equality on complex objects.
  // This is a coarse-grained approach and may cause frequent re-renders.
  useEditorState({
    editor: mainEditor,
    selector(context) {
      return { transactionNumber: context.transactionNumber }
    },
  })

  return { editor: mainEditor || null }
}
