"use client"

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"

// --- Hooks ---
import { useIsBreakpoint } from "@openim/shared"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { CornerDownLeftIcon } from "@/components/tiptap-icons/corner-down-left-icon"
import { ExternalLinkIcon } from "@/components/tiptap-icons/external-link-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"
import { TrashIcon } from "@/components/tiptap-icons/trash-icon"

// --- Tiptap UI ---
import type { UseLinkPopoverConfig } from "@/components/tiptap-ui/link-popover"
import { isSelectionInLink, useLinkPopover } from "@/components/tiptap-ui/link-popover"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/tiptap-ui-primitive/popover"
import { Separator } from "@/components/tiptap-ui-primitive/separator"
import {
  Card,
  CardBody,
  CardItemGroup,
} from "@/components/tiptap-ui-primitive/card"
import { Input, InputGroup } from "@/components/tiptap-ui-primitive/input"

export interface LinkMainProps {
  /**
   * The URL to set for the link.
   */
  url: string
  /**
   * Function to update the URL state.
   */
  setUrl: React.Dispatch<React.SetStateAction<string | null>>
  /**
   * Function to set the link in the editor.
   */
  setLink: () => void
  /**
   * Function to remove the link from the editor.
   */
  removeLink: () => void
  /**
   * Function to open the link.
   */
  openLink: () => void
  /**
   * Whether the link is currently active in the editor.
   */
  isActive: boolean
  /**
   * Placeholder text for the input
   */
  placeholder?: string
  /**
   * Tooltip for apply button
   */
  applyTooltip?: string
  /**
   * Tooltip for open link button
   */
  openTooltip?: string
  /**
   * Tooltip for remove link button
   */
  removeTooltip?: string
}

export interface LinkPopoverProps
  extends Omit<ButtonProps, "type">,
    UseLinkPopoverConfig {
  /**
   * Callback for when the popover opens or closes.
   */
  onOpenChange?: (isOpen: boolean) => void
  /**
   * Whether to automatically open the popover when a link is active.
   * @default true
   */
  autoOpenOnLinkActive?: boolean
  /**
   * Placeholder text for the input
   */
  placeholder?: string
  /**
   * Tooltip for apply button
   */
  applyTooltip?: string
  /**
   * Tooltip for open link button
   */
  openTooltip?: string
  /**
   * Tooltip for remove link button
   */
  removeTooltip?: string
}

/**
 * Link button component for triggering the link popover
 */
export const LinkButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        type="button"
        className={className}
        data-style="ghost"
        role="button"
        tabIndex={-1}
        aria-label="Link"
        tooltip="Link"
        ref={ref}
        {...props}
      >
        {children || <LinkIcon className="tiptap-button-icon" />}
      </Button>
    )
  }
)

LinkButton.displayName = "LinkButton"

/**
 * Main content component for the link popover
 */
const LinkMain: React.FC<LinkMainProps> = ({
  url,
  setUrl,
  setLink,
  removeLink,
  openLink,
  isActive,
  placeholder = "Paste a link...",
  applyTooltip = "Apply link",
  openTooltip = "Open in new window",
  removeTooltip = "Remove link",
}) => {
  const isMobile = useIsBreakpoint()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      setLink()
    }
  }

  return (
    <Card
      style={{
        ...(isMobile ? { boxShadow: "none", border: 0 } : {}),
      }}
    >
      <CardBody
        style={{
          ...(isMobile ? { padding: 0 } : {}),
        }}
      >
        <CardItemGroup orientation="horizontal">
          <InputGroup>
            <Input
              ref={inputRef}
              type="url"
              placeholder={placeholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </InputGroup>

          <ButtonGroup orientation="horizontal">
            <Button
              type="button"
              onClick={setLink}
              title={applyTooltip}
              disabled={!url && !isActive}
              data-style="ghost"
            >
              <CornerDownLeftIcon className="tiptap-button-icon" />
            </Button>
          </ButtonGroup>

          <Separator />

          <ButtonGroup orientation="horizontal">
            <Button
              type="button"
              onClick={openLink}
              title={openTooltip}
              disabled={!url && !isActive}
              data-style="ghost"
            >
              <ExternalLinkIcon className="tiptap-button-icon" />
            </Button>

            <Button
              type="button"
              onClick={removeLink}
              title={removeTooltip}
              disabled={!url && !isActive}
              data-style="ghost"
            >
              <TrashIcon className="tiptap-button-icon" />
            </Button>
          </ButtonGroup>
        </CardItemGroup>
      </CardBody>
    </Card>
  )
}

/**
 * Link content component for standalone use
 */
export const LinkContent: React.FC<{
  editor?: Editor | null
}> = ({ editor }) => {
  const linkPopover = useLinkPopover({
    editor,
  })

  return <LinkMain {...linkPopover} />
}

/**
 * Link popover component for Tiptap editors.
 *
 * For custom popover implementations, use the `useLinkPopover` hook instead.
 */
export const LinkPopover = forwardRef<HTMLButtonElement, LinkPopoverProps>(
  (
    {
      editor: providedEditor,
      hideWhenUnavailable = false,
      onSetLink,
      onOpenChange,
      autoOpenOnLinkActive = true,
      onClick,
      children,
      placeholder,
      applyTooltip,
      openTooltip,
      removeTooltip,
      ...buttonProps
    },
    ref
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = useState(false)
    const [isSelectionInsideLink, setIsSelectionInsideLink] = useState(false)
    const suppressAutoOpenRef = useRef(false)
    const focusTimeoutRef = useRef<number | null>(null)

    const {
      isVisible,
      canSet,
      isActive,
      url,
      setUrl,
      setLink,
      removeLink,
      openLink,
      label,
      Icon,
    } = useLinkPopover({
      editor,
      hideWhenUnavailable,
      onSetLink,
    })

    const handleOnOpenChange = useCallback(
      (nextIsOpen: boolean) => {
        setIsOpen(nextIsOpen)
        onOpenChange?.(nextIsOpen)
      },
      [onOpenChange]
    )

    const focusEditorSoon = useCallback(() => {
      if (!editor) return
      if (focusTimeoutRef.current) {
        window.clearTimeout(focusTimeoutRef.current)
      }
      focusTimeoutRef.current = window.setTimeout(() => {
        editor.view.focus()
      }, 0)
    }, [editor])

    const handleSetLink = useCallback(() => {
      setLink()
      suppressAutoOpenRef.current = true
      setIsOpen(false)
      focusEditorSoon()
    }, [setLink, focusEditorSoon])

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        setIsOpen(!isOpen)
      },
      [onClick, isOpen]
    )

    useEffect(() => {
      if (!editor) return

      const updateSelectionState = () => {
        setIsSelectionInsideLink(isSelectionInLink(editor))
      }

      updateSelectionState()
      editor.on("selectionUpdate", updateSelectionState)

      return () => {
        editor.off("selectionUpdate", updateSelectionState)
      }
    }, [editor])

    useEffect(() => {
      if (autoOpenOnLinkActive && isSelectionInsideLink) {
        if (suppressAutoOpenRef.current) {
          suppressAutoOpenRef.current = false
          return
        }
        setIsOpen(true)
      }
    }, [autoOpenOnLinkActive, isSelectionInsideLink])

    useEffect(() => {
      if (!isOpen) {
        focusEditorSoon()
      }
    }, [isOpen, focusEditorSoon])

    useEffect(() => {
      return () => {
        if (focusTimeoutRef.current) {
          window.clearTimeout(focusTimeoutRef.current)
        }
      }
    }, [])

    if (!isVisible) {
      return null
    }

    return (
      <Popover open={isOpen} onOpenChange={handleOnOpenChange}>
        <PopoverTrigger asChild>
          <LinkButton
            disabled={!canSet}
            data-active-state={isActive ? "on" : "off"}
            data-disabled={!canSet}
            aria-label={label}
            aria-pressed={isActive}
            onClick={handleClick}
            {...buttonProps}
            ref={ref}
          >
            {children ?? <Icon className="tiptap-button-icon" />}
          </LinkButton>
        </PopoverTrigger>

        <PopoverContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            focusEditorSoon()
          }}
        >
          <LinkMain
            url={url}
            setUrl={setUrl}
            setLink={handleSetLink}
            removeLink={removeLink}
            openLink={openLink}
            isActive={isActive}
            placeholder={placeholder}
            applyTooltip={applyTooltip}
            openTooltip={openTooltip}
            removeTooltip={removeTooltip}
          />
        </PopoverContent>
      </Popover>
    )
  }
)

LinkPopover.displayName = "LinkPopover"

export default LinkPopover
