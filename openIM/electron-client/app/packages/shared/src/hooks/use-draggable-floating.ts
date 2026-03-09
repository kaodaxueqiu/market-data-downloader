"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import type React from "react"

type DragPosition = { x: number; y: number }

type InitialPositionContext = {
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  margin: number
}

type InitialPosition = DragPosition | ((context: InitialPositionContext) => DragPosition)

export interface UseDraggableFloatingOptions {
  enabled?: boolean
  margin?: number
  initialPosition?: InitialPosition
  shouldStartDrag?: (event: React.PointerEvent<HTMLElement>) => boolean
}

export interface UseDraggableFloatingResult {
  dragRef: React.RefObject<HTMLDivElement>
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  recalculate: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const defaultInitialPosition = ({
  width,
  height,
  viewportWidth,
  viewportHeight,
  margin,
}: InitialPositionContext): DragPosition => ({
  x: Math.max((viewportWidth - width) / 2, margin),
  y: Math.max(viewportHeight - height - margin, margin),
})

export function useDraggableFloating({
  enabled = true,
  margin = 24,
  initialPosition,
  shouldStartDrag,
}: UseDraggableFloatingOptions): UseDraggableFloatingResult {
  const dragRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const dragStartRef = useRef<{
    x: number
    y: number
    originX: number
    originY: number
  } | null>(null)
  const posRef = useRef<DragPosition>({ x: 0, y: 0 })
  const sizeRef = useRef({ width: 0, height: 0 })
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<DragPosition | null>(null)
  const initialPositionSetRef = useRef(false)

  const resolveInitialPosition = useCallback(
    (context: InitialPositionContext): DragPosition => {
      if (typeof initialPosition === "function") {
        return initialPosition(context)
      }
      if (initialPosition) return initialPosition
      return defaultInitialPosition(context)
    },
    [initialPosition]
  )

  const clampPosition = useCallback(
    (pos: DragPosition) => {
      if (typeof window === "undefined") return pos
      const maxX = Math.max(window.innerWidth - sizeRef.current.width - margin, margin)
      const maxY = Math.max(window.innerHeight - sizeRef.current.height - margin, margin)
      return {
        x: clamp(pos.x, margin, maxX),
        y: clamp(pos.y, margin, maxY),
      }
    },
    [margin]
  )

  const applyPosition = useCallback((pos: DragPosition) => {
    posRef.current = pos
    if (dragRef.current) {
      dragRef.current.style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(
        pos.y
      )}px, 0)`
    }
  }, [])

  const schedulePosition = useCallback(
    (pos: DragPosition) => {
      pendingRef.current = pos
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          if (pendingRef.current) {
            applyPosition(pendingRef.current)
            pendingRef.current = null
          }
        })
      }
    },
    [applyPosition]
  )

  const flushPendingPosition = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (pendingRef.current) {
      applyPosition(pendingRef.current)
      pendingRef.current = null
    }
  }, [applyPosition])

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return
    flushPendingPosition()
    draggingRef.current = false
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (pointerIdRef.current !== null && dragRef.current) {
      try {
        dragRef.current.releasePointerCapture(pointerIdRef.current)
      } catch {
        // Ignore release errors for non-captured pointers.
      }
    }
    pointerIdRef.current = null
    dragStartRef.current = null
  }, [flushPendingPosition])

  const measureSize = useCallback(() => {
    const el = dragRef.current
    if (!el || typeof window === "undefined") return
    const rect = el.getBoundingClientRect()
    sizeRef.current = { width: rect.width, height: rect.height }
  }, [])

  useLayoutEffect(() => {
    if (!enabled) return
    measureSize()
    if (!sizeRef.current.width || !sizeRef.current.height || typeof window === "undefined") return
    const context = {
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      margin,
    }
    const nextPos = initialPositionSetRef.current
      ? clampPosition(posRef.current)
      : clampPosition(resolveInitialPosition(context))
    applyPosition(nextPos)
    initialPositionSetRef.current = true
  }, [applyPosition, clampPosition, enabled, margin, measureSize, resolveInitialPosition])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const handleResize = () => {
      measureSize()
      applyPosition(clampPosition(posRef.current))
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [applyPosition, clampPosition, enabled, measureSize])

  useEffect(() => {
    if (enabled) return
    endDrag()
    initialPositionSetRef.current = false
    if (dragRef.current) {
      dragRef.current.style.transform = ""
    }
  }, [enabled, endDrag])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || !event.isPrimary || event.button !== 0) return
      if (shouldStartDrag && !shouldStartDrag(event)) {
        return
      }
      if (!shouldStartDrag) {
        const target = event.target as HTMLElement | null
        if (target?.closest("button") || target?.closest("[data-drag-ignore]")) {
          return
        }
      }
      const el = dragRef.current
      if (!el) return
      pointerIdRef.current = event.pointerId
      try {
        el.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors for unsupported pointer environments.
      }
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        originX: posRef.current.x,
        originY: posRef.current.y,
      }
      draggingRef.current = true

      const handleMove = (moveEvent: PointerEvent) => {
        if (!draggingRef.current || pointerIdRef.current !== moveEvent.pointerId) return
        if (moveEvent.buttons === 0) {
          endDrag()
          return
        }
        const start = dragStartRef.current
        if (!start) return
        const deltaX = moveEvent.clientX - start.x
        const deltaY = moveEvent.clientY - start.y
        const nextPos = clampPosition({
          x: start.originX + deltaX,
          y: start.originY + deltaY,
        })
        schedulePosition(nextPos)
        moveEvent.preventDefault()
      }

      const handleUp = (upEvent: PointerEvent) => {
        if (pointerIdRef.current !== upEvent.pointerId) return
        endDrag()
      }

      window.addEventListener("pointermove", handleMove, { passive: false })
      window.addEventListener("pointerup", handleUp)
      window.addEventListener("pointercancel", handleUp)
      cleanupRef.current = () => {
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)
        window.removeEventListener("pointercancel", handleUp)
      }
      event.preventDefault()
    },
    [clampPosition, enabled, endDrag, schedulePosition, shouldStartDrag]
  )

  const recalculate = useCallback(() => {
    if (!enabled || typeof window === "undefined") return
    measureSize()
    if (!sizeRef.current.width || !sizeRef.current.height) return
    const nextPos = clampPosition(posRef.current)
    applyPosition(nextPos)
  }, [applyPosition, clampPosition, enabled, measureSize])

  return { dragRef, onPointerDown, recalculate }
}
