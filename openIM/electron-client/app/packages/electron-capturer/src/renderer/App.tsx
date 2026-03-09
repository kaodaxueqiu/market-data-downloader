import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Line,
  Text as KonvaText,
  Label,
  Tag,
  Arrow,
} from "react-konva";
import Konva from "konva";
import "konva/lib/filters/Pixelate";
import {
  ArrowRight,
  Eraser,
  Grid3X3,
  MousePointer2,
  Pencil,
  Square,
  Type,
} from "lucide-react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Vector2d } from "konva/lib/types";
import type {
  Dimensions,
  OverlayInitPayload,
  OverlayTexts,
} from "../shared/ipc";
import { ScreenshotToolbar, type ToolItem } from "./toolbar";

const palette = [
  "#22d3ee",
  "#f97316",
  "#22c55e",
  "#e11d48",
  "#facc15",
  "#94a3b8",
  "#a855f7",
];
const mosaicPixelSize = 12;
const eraserCursor = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="none" stroke="black" stroke-width="2"/><circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="1"/></svg>'
)}") 12 12, crosshair`;
type Tool = "select" | "rect" | "arrow" | "pen" | "text" | "mosaic" | "eraser";
const toolbarToolsBase: ToolItem<Tool>[] = [
  {
    id: "select",
    label: "框选/调整",
    icon: <MousePointer2 className="size-4" />,
    shortcut: "V",
  },
  {
    id: "rect",
    label: "矩形",
    icon: <Square className="size-4" />,
    shortcut: "R",
  },
  {
    id: "arrow",
    label: "箭头",
    icon: <ArrowRight className="size-4" />,
    shortcut: "A",
  },
  {
    id: "pen",
    label: "画笔",
    icon: <Pencil className="size-4" />,
    shortcut: "P",
  },
  {
    id: "text",
    label: "文字",
    icon: <Type className="size-4" />,
    shortcut: "T",
  },
  {
    id: "mosaic",
    label: "马赛克",
    icon: <Grid3X3 className="size-4" />,
    shortcut: "M",
  },
  {
    id: "eraser",
    label: "橡皮擦",
    icon: <Eraser className="size-4" />,
    shortcut: "E",
  },
];

type Box = Dimensions & { x: number; y: number };
type SelectionHandleId = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
type SelectionHandle = {
  id: SelectionHandleId;
  x: number;
  y: number;
  cursor: string;
};

type Stroke = {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
};
type RectShape = Box & { id: string; color: string; strokeWidth: number };
type ArrowShape = {
  id: string;
  points: [number, number, number, number];
  color: string;
  strokeWidth: number;
};
type TextShape = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
};
type MosaicBlock = Box & { id: string; color: string };
type TextEditor = {
  id: string;
  stageX: number;
  stageY: number;
  viewportX: number;
  viewportY: number;
  imageX: number;
  imageY: number;
  value: string;
  color: string;
};

const TEXT_INPUT_WIDTH = 200;
const TEXT_INPUT_HEIGHT = 32;
type Point = { x: number; y: number };

type DrawingState =
  | { mode: "selecting"; anchor: Point }
  | { mode: "move"; offsetX: number; offsetY: number }
  | { mode: "resize"; handle: SelectionHandle; startBox: Box }
  | { mode: "pen"; activeId: string }
  | { mode: "rect"; activeId: string }
  | { mode: "arrow"; activeId: string }
  | { mode: "mosaic"; activeId: string }
  | { mode: "eraser" }
  | { mode: "text-drag"; id: string }
  | { mode: null };

type ImageLayout = {
  scaledWidth: number;
  scaledHeight: number;
  offsetX: number;
  offsetY: number;
};
type AnnotationState = {
  strokes: Stroke[];
  rects: RectShape[];
  arrows: ArrowShape[];
  texts: TextShape[];
  mosaics: MosaicBlock[];
};
type SelectionState = { selection: Box | null; selectionReady: boolean };
type AnnotationAction =
  | { kind: "stroke"; item: Stroke }
  | { kind: "rect"; item: RectShape }
  | { kind: "arrow"; item: ArrowShape }
  | { kind: "text"; item: TextShape }
  | { kind: "text-move"; id: string; from: Point; to: Point }
  | { kind: "mosaic"; item: MosaicBlock }
  | { kind: "erase"; removed: Partial<AnnotationState> }
  | { kind: "reset"; prev: AnnotationState; prevSelection: SelectionState };

const defaultTexts: OverlayTexts = {
  escHint: "按 Esc 退出截屏",
  loading: "等待加载截图…",
  textPlaceholder: "输入标注文字后回车",
  statusReady: "拖拽选择区域，使用工具栏标注，点击确认保存。",
  toolbar: {
    color: "选择颜色",
    strokeWidth: "线宽",
    undo: "撤销",
    redo: "重做",
    copy: "复制到剪贴板",
    save: "保存图片",
    cancel: "取消 (Esc)",
    confirm: "完成 (Enter)",
  },
};

const mergeTexts = (incoming?: Partial<OverlayTexts>): OverlayTexts => ({
  ...defaultTexts,
  ...incoming,
  toolLabels: { ...(incoming?.toolLabels || defaultTexts.toolLabels || {}) },
  toolbar: { ...defaultTexts.toolbar, ...(incoming?.toolbar || {}) },
});

const makeId = (): string => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
};

const createImageFromSource = (
  src?: string | null
): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const normalizeBox = (box: Box | null): Box | null => {
  if (!box) return box;
  const next = { ...box };
  if (next.width < 0) {
    next.x = next.x + next.width;
    next.width = Math.abs(next.width);
  }
  if (next.height < 0) {
    next.y = next.y + next.height;
    next.height = Math.abs(next.height);
  }
  return next;
};

const pointInBox = (point: Point, box: Box | null): boolean => {
  if (!box) return false;
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
};

const handlePositions = (box: Box | null): SelectionHandle[] => {
  if (!box) return [];
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return [
    { id: "nw", x: box.x, y: box.y, cursor: "nwse-resize" },
    { id: "n", x: cx, y: box.y, cursor: "ns-resize" },
    { id: "ne", x: box.x + box.width, y: box.y, cursor: "nesw-resize" },
    { id: "w", x: box.x, y: cy, cursor: "ew-resize" },
    { id: "e", x: box.x + box.width, y: cy, cursor: "ew-resize" },
    { id: "sw", x: box.x, y: box.y + box.height, cursor: "nesw-resize" },
    { id: "s", x: cx, y: box.y + box.height, cursor: "ns-resize" },
    {
      id: "se",
      x: box.x + box.width,
      y: box.y + box.height,
      cursor: "nwse-resize",
    },
  ];
};

const hitHandle = (
  point: Point,
  box: Box | null,
  tolerance = 10
): SelectionHandle | null => {
  if (!box) return null;
  const handles = handlePositions(box);
  const hit = handles.find(
    (h) =>
      Math.abs(point.x - h.x) <= tolerance &&
      Math.abs(point.y - h.y) <= tolerance
  );
  return hit || null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const resizeSelection = (
  startBox: Box,
  handle: SelectionHandle,
  point: Point,
  bounds: Dimensions
): Box => {
  const minSize = 12;
  const right = startBox.x + startBox.width;
  const bottom = startBox.y + startBox.height;
  let x1 = startBox.x;
  let y1 = startBox.y;
  let x2 = right;
  let y2 = bottom;

  if (handle.id.includes("w")) {
    x1 = clamp(point.x, 0, right - minSize);
  }
  if (handle.id.includes("e")) {
    x2 = clamp(point.x, startBox.x + minSize, bounds.width);
  }
  if (handle.id.includes("n")) {
    y1 = clamp(point.y, 0, bottom - minSize);
  }
  if (handle.id.includes("s")) {
    y2 = clamp(point.y, startBox.y + minSize, bounds.height);
  }

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

const cursorForHandle = (handle?: SelectionHandle | null): string =>
  handle?.cursor || "crosshair";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const measureTextSize = (text: string): { width: number; height: number } => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: 0, height: 0 };
  ctx.font =
    'bold 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const metrics = ctx.measureText(text);
  const height =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 24;
  return { width: metrics.width, height };
};

const distancePointToSegment = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = clamp(t, 0, 1);
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
};

const isPointNearStroke = (
  p: Point,
  points: number[],
  threshold: number
): boolean => {
  for (let i = 0; i < points.length - 2; i += 2) {
    const a: Point = { x: points[i], y: points[i + 1] };
    const b: Point = { x: points[i + 2], y: points[i + 3] };
    if (distancePointToSegment(p, a, b) <= threshold) return true;
  }
  return false;
};

export default function App() {
  const stageRef = useRef<Konva.Stage | null>(null);

  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState<Dimensions>({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<string>(palette[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [rects, setRects] = useState<RectShape[]>([]);
  const [arrows, setArrows] = useState<ArrowShape[]>([]);
  const [texts, setTexts] = useState<TextShape[]>([]);
  const [mosaics, setMosaics] = useState<MosaicBlock[]>([]);
  const [actions, setActions] = useState<AnnotationAction[]>([]);
  const [redoStack, setRedoStack] = useState<AnnotationAction[]>([]);
  const [selection, setSelection] = useState<Box | null>(null); // 存在“图片坐标系”下
  const [selectionReady, setSelectionReady] = useState(false);
  const [textEditor, setTextEditor] = useState<TextEditor | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    mode: null,
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState("crosshair");
  const [locale, setLocale] = useState<OverlayTexts>(defaultTexts);
  const [toolbarWidth, setToolbarWidth] = useState<number>(0);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const textDragStartRef = useRef<Point | null>(null);
  const stageNodeRef = useRef<Konva.Stage | null>(null);
  const textDraggingRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);
  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };
  const hasAnnotations =
    strokes.length > 0 ||
    rects.length > 0 ||
    arrows.length > 0 ||
    texts.length > 0 ||
    mosaics.length > 0;

  const resetSelectionState = () => {
    setSelection(null);
    setSelectionReady(false);
    setTextEditor(null);
    setDrawingState({ mode: null });
    setCursor("crosshair");
  };

  const resetHistory = () => {
    setActions([]);
    setRedoStack([]);
  };

  const applyAnnotationState = (state: AnnotationState) => {
    setStrokes(state.strokes);
    setRects(state.rects);
    setArrows(state.arrows);
    setTexts(state.texts);
    setMosaics(state.mosaics);
  };

  const recordAction = (action: AnnotationAction) => {
    setActions((prev) => [...prev, action]);
    setRedoStack([]);
  };

  const removeById = <T extends { id: string }>(items: T[], id: string): T[] =>
    items.filter((item) => item.id !== id);

  const undoAction = (action: AnnotationAction) => {
    switch (action.kind) {
      case "stroke":
        setStrokes((prev) => removeById(prev, action.item.id));
        break;
      case "rect":
        setRects((prev) => removeById(prev, action.item.id));
        break;
      case "arrow":
        setArrows((prev) => removeById(prev, action.item.id));
        break;
      case "text":
        setTexts((prev) => removeById(prev, action.item.id));
        break;
      case "text-move":
        setTexts((prev) =>
          prev.map((item) =>
            item.id === action.id
              ? { ...item, x: action.from.x, y: action.from.y }
              : item
          )
        );
        break;
      case "mosaic":
        setMosaics((prev) => removeById(prev, action.item.id));
        break;
      case "erase": {
        const removed = action.removed;
        if (removed.strokes?.length)
          setStrokes((prev) => [...prev, ...clone(removed.strokes || [])]);
        if (removed.rects?.length)
          setRects((prev) => [...prev, ...clone(removed.rects || [])]);
        if (removed.arrows?.length)
          setArrows((prev) => [...prev, ...clone(removed.arrows || [])]);
        if (removed.texts?.length)
          setTexts((prev) => [...prev, ...clone(removed.texts || [])]);
        if (removed.mosaics?.length)
          setMosaics((prev) => [...prev, ...clone(removed.mosaics || [])]);
        break;
      }
      case "reset":
        applyAnnotationState(action.prev);
        setSelection(action.prevSelection.selection);
        setSelectionReady(action.prevSelection.selectionReady);
        break;
      default:
        break;
    }
    setDrawingState({ mode: null });
  };

  const redoAction = (action: AnnotationAction) => {
    switch (action.kind) {
      case "stroke":
        setStrokes((prev) => [...prev, clone(action.item)]);
        break;
      case "rect":
        setRects((prev) => [...prev, clone(action.item)]);
        break;
      case "arrow":
        setArrows((prev) => [...prev, clone(action.item)]);
        break;
      case "text":
        setTexts((prev) => [...prev, clone(action.item)]);
        break;
      case "text-move":
        setTexts((prev) =>
          prev.map((item) =>
            item.id === action.id
              ? { ...item, x: action.to.x, y: action.to.y }
              : item
          )
        );
        break;
      case "mosaic":
        setMosaics((prev) => [...prev, clone(action.item)]);
        break;
      case "erase": {
        const removed = action.removed;
        if (removed.strokes?.length)
          setStrokes((prev) =>
            prev.filter(
              (item) => !removed.strokes?.some((r) => r.id === item.id)
            )
          );
        if (removed.rects?.length)
          setRects((prev) =>
            prev.filter((item) => !removed.rects?.some((r) => r.id === item.id))
          );
        if (removed.arrows?.length)
          setArrows((prev) =>
            prev.filter(
              (item) => !removed.arrows?.some((r) => r.id === item.id)
            )
          );
        if (removed.texts?.length)
          setTexts((prev) =>
            prev.filter((item) => !removed.texts?.some((r) => r.id === item.id))
          );
        if (removed.mosaics?.length)
          setMosaics((prev) =>
            prev.filter(
              (item) => !removed.mosaics?.some((r) => r.id === item.id)
            )
          );
        break;
      }
      case "reset":
        setStrokes([]);
        setRects([]);
        setArrows([]);
        setTexts([]);
        setMosaics([]);
        setSelection(null);
        setSelectionReady(false);
        setStatus("标注已清空");
        setTool("select");
        break;
      default:
        break;
    }
    setDrawingState({ mode: null });
  };

  const selectionBox = useMemo(() => normalizeBox(selection), [selection]);
  const loadImageFromPayload = async (
    payload: OverlayInitPayload
  ): Promise<HTMLImageElement | null> => {
    if (payload.dataBuffer) {
      revokeObjectUrl();
      const blob = new Blob([payload.dataBuffer], {
        type: payload.imageMime || "image/jpeg",
      });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      return createImageFromSource(url);
    }
    return createImageFromSource(payload.dataUrl || null);
  };

  // overlay 实际几何尺寸（Stage 尺寸）
  const geometry = useMemo<Dimensions>(() => {
    const width = displaySize.width;
    const height = displaySize.height;
    return { width, height };
  }, [displaySize]);

  // 把整张 screenshot 缩放进 overlay，保证整图可见
  const renderScale = useMemo<number>(() => {
    if (!bgImage) return 1;
    const stageWidth = geometry.width || bgImage.width;
    const stageHeight = geometry.height || bgImage.height;
    return Math.min(stageWidth / bgImage.width, stageHeight / bgImage.height);
  }, [bgImage, geometry]);

  // 缩放后的图片尺寸 + 居中偏移（图片坐标系从 (0,0) 开始）
  const imageLayout = useMemo<ImageLayout>(() => {
    if (!bgImage)
      return { scaledWidth: 0, scaledHeight: 0, offsetX: 0, offsetY: 0 };
    const scaledWidth = bgImage.width * renderScale;
    const scaledHeight = bgImage.height * renderScale;
    const offsetX = (geometry.width - scaledWidth) / 2;
    const offsetY = (geometry.height - scaledHeight) / 2; // 想贴顶可以改成 0
    return { scaledWidth, scaledHeight, offsetX, offsetY };
  }, [bgImage, renderScale, geometry]);

  const { scaledWidth, scaledHeight, offsetX, offsetY } = imageLayout;
  const imageBounds = useMemo<Dimensions>(
    () => ({ width: scaledWidth, height: scaledHeight }),
    [scaledWidth, scaledHeight]
  );

  useEffect(() => {
    const handleResize = () =>
      setDisplaySize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseOverlay();
      }
    };
    window.addEventListener("keydown", escHandler);
    return () => window.removeEventListener("keydown", escHandler);
  }, []);

  useEffect(() => {
    if (!window.electronCapturer?.onOverlayInit) return;
    const stop = window.electronCapturer.onOverlayInit(
      async (payload: OverlayInitPayload) => {
        const mergedTexts = mergeTexts(payload?.texts);
        setLocale(mergedTexts);

        if (payload?.displayBounds) {
          setDisplaySize({
            width: payload.displayBounds.width,
            height: payload.displayBounds.height,
          });
        } else if (payload?.size) {
          setDisplaySize({
            width: payload.size.width,
            height: payload.size.height,
          });
        }

        const img = await loadImageFromPayload(payload);
        if (img) {
          setBgImage(img);
          setStatus(mergedTexts.statusReady || defaultTexts.statusReady || "");
          setStrokes([]);
          setRects([]);
          setArrows([]);
          setTexts([]);
          setMosaics([]);
          setSelection(null);
          setSelectionReady(false);
          resetHistory();
          try {
            setTimeout(() => window.electronCapturer?.notifyReady(), 50);
          } catch (err) {
            console.warn("notifyReady failed", err);
          }
        }
      }
    );
    return () => {
      if (typeof stop === "function") stop();
      revokeObjectUrl();
    };
  }, []);

  const handleCloseOverlay = () => {
    if (window.electronCapturer?.closeOverlay) {
      window.electronCapturer.closeOverlay();
    } else {
      window.close();
    }
  };

  const handleUndo = () => {
    setActions((prev) => {
      if (!prev.length) return prev;
      const action = prev[prev.length - 1];
      undoAction(action);
      setRedoStack((redoPrev) => [...redoPrev, action]);
      return prev.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      const action = prev[prev.length - 1];
      redoAction(action);
      setActions((actionPrev) => [...actionPrev, action]);
      return prev.slice(0, -1);
    });
  };

  // 工具函数：从 Stage pointer 坐标转换为“图片坐标系”
  const getImagePoint = (stagePoint: Vector2d): Point => {
    // 先映射到图片坐标，再限制在图片边界内
    const local = {
      x: stagePoint.x - offsetX,
      y: stagePoint.y - offsetY,
    };
    return {
      x: clamp(local.x, 0, imageBounds.width),
      y: clamp(local.y, 0, imageBounds.height),
    };
  };

  const commitTextInput = () => {
    if (!textEditor) return;
    const value = textEditor.value.trim();
    if (value) {
      const item = {
        id: makeId(),
        x: textEditor.imageX,
        y: textEditor.imageY,
        text: value,
        color: textEditor.color,
      };
      setTexts((prev) => [...prev, item]);
      recordAction({ kind: "text", item });
    }
    setTextEditor(null);
  };

  const cancelTextInput = () => setTextEditor(null);

  const findHitAnnotation = (p: Point) => {
    const hitBox = (box: Box | null, tolerance = 3) => {
      const n = normalizeBox(box);
      if (!n) return false;
      return (
        p.x >= n.x - tolerance &&
        p.x <= n.x + n.width + tolerance &&
        p.y >= n.y - tolerance &&
        p.y <= n.y + n.height + tolerance
      );
    };

    for (let i = texts.length - 1; i >= 0; i -= 1) {
      const item = texts[i];
      const size = measureTextSize(item.text || "");
      const box: Box = {
        x: item.x,
        y: item.y,
        width: size.width + 12,
        height: size.height + 12,
      };
      if (hitBox(box, 2)) return { kind: "text" as const, item };
    }

    for (let i = strokes.length - 1; i >= 0; i -= 1) {
      const item = strokes[i];
      if (isPointNearStroke(p, item.points, Math.max(6, item.strokeWidth))) {
        return { kind: "stroke" as const, item };
      }
    }

    for (let i = mosaics.length - 1; i >= 0; i -= 1) {
      const item = mosaics[i];
      if (hitBox(item)) return { kind: "mosaic" as const, item };
    }

    for (let i = arrows.length - 1; i >= 0; i -= 1) {
      const item = arrows[i];
      const [x1, y1, x2, y2] = item.points;
      if (
        distancePointToSegment(p, { x: x1, y: y1 }, { x: x2, y: y2 }) <=
        Math.max(8, item.strokeWidth)
      ) {
        return { kind: "arrow" as const, item };
      }
    }

    for (let i = rects.length - 1; i >= 0; i -= 1) {
      const item = rects[i];
      if (hitBox(item)) return { kind: "rect" as const, item };
    }

    return null;
  };

  const eraseAtPoint = (p: Point): boolean => {
    const hit = findHitAnnotation(p);
    if (!hit) return false;
    const removed: Partial<AnnotationState> = {};

    switch (hit.kind) {
      case "text":
        removed.texts = [clone(hit.item)];
        setTexts((prev) => removeById(prev, hit.item.id));
        break;
      case "stroke":
        removed.strokes = [clone(hit.item)];
        setStrokes((prev) => removeById(prev, hit.item.id));
        break;
      case "mosaic":
        removed.mosaics = [clone(hit.item)];
        setMosaics((prev) => removeById(prev, hit.item.id));
        break;
      case "arrow":
        removed.arrows = [clone(hit.item)];
        setArrows((prev) => removeById(prev, hit.item.id));
        break;
      case "rect":
        removed.rects = [clone(hit.item)];
        setRects((prev) => removeById(prev, hit.item.id));
        break;
      default:
        break;
    }

    recordAction({ kind: "erase", removed });
    return true;
  };

  const handlePointerDown = (event: KonvaEventObject<MouseEvent>) => {
    const button = event?.evt?.button;
    if (button === 2) {
      event.evt.preventDefault();
      event.evt.stopPropagation();
      if (selectionReady) {
        if (hasAnnotations) return;
        resetSelectionState();
        setStatus("");
        return;
      }
      handleCloseOverlay();
      return;
    }

    if (button !== 0) return;

    if (!bgImage || !scaledWidth || !scaledHeight) return;
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;

    if (textDraggingRef.current) return;
    const targetName = event.target?.name?.();
    const targetId = (event.target as any)?.attrs?.["data-id"] as
      | string
      | undefined;

    const p = getImagePoint(point); // 图片坐标系下的点击位置
    const hitText = findHitAnnotation(p);

    if (tool === "select" && hitText?.kind === "text") {
      startDragText(hitText.item.id);
      return;
    }

    if (
      (tool === "select" || tool === "text") &&
      targetName === "text-shape" &&
      targetId
    ) {
      startDragText(targetId);
      return;
    }

    if (tool === "select") {
      if (drawingState.mode === "text-drag") return;
      textDragStartRef.current = null;
      const handle = hitHandle(p, selectionBox);
      if (handle && selectionBox) {
        setDrawingState({ mode: "resize", handle, startBox: selectionBox });
        setCursor(cursorForHandle(handle));
        return;
      }
      if (selectionBox && pointInBox(p, selectionBox)) {
        setDrawingState({
          mode: "move",
          offsetX: p.x - selectionBox.x,
          offsetY: p.y - selectionBox.y,
        });
        setCursor("grabbing");
        return;
      }
      setSelection({ x: p.x, y: p.y, width: 0, height: 0 });
      setDrawingState({ mode: "selecting", anchor: p });
      setCursor("crosshair");
      return;
    }

    if (!selectionBox) return; // 未框选前不允许标注
    if (!pointInBox(p, selectionBox)) return;

    if (tool === "text") {
      if (hitText?.kind === "text") {
        startDragText(hitText.item.id);
        return;
      }
      if (textEditor) commitTextInput();
      const sel = selectionBox;
      const minLeft = sel ? sel.x : 0;
      const maxLeft = sel
        ? sel.x + sel.width - TEXT_INPUT_WIDTH
        : geometry.width - TEXT_INPUT_WIDTH;
      const minTop = sel ? sel.y : 0;
      const maxTop = sel
        ? sel.y + sel.height - TEXT_INPUT_HEIGHT
        : geometry.height - TEXT_INPUT_HEIGHT;
      const clampedImageLeft = clamp(p.x, minLeft, Math.max(minLeft, maxLeft));
      const clampedImageTop = clamp(
        p.y - TEXT_INPUT_HEIGHT / 2,
        minTop,
        Math.max(minTop, maxTop)
      );
      const stageLeft = clampedImageLeft + offsetX;
      const stageTop = clampedImageTop + offsetY;
      const rect = stageRef.current?.container()?.getBoundingClientRect();
      const viewportX = rect ? rect.left + stageLeft : stageLeft;
      const viewportY = rect ? rect.top + stageTop : stageTop;
      setTextEditor({
        id: makeId(),
        stageX: stageLeft,
        stageY: stageTop,
        viewportX,
        viewportY,
        imageX: clampedImageLeft,
        imageY: clampedImageTop,
        value: "",
        color,
      });
      return;
    }

    if (tool === "eraser") {
      eraseAtPoint(p);
      setDrawingState({ mode: "eraser" });
      return;
    }

    if (tool === "pen") {
      const id = makeId();
      setStrokes((prev) => [
        ...prev,
        { id, points: [p.x, p.y], color, strokeWidth },
      ]);
      setDrawingState({ mode: "pen", activeId: id });
      return;
    }

    if (tool === "rect") {
      const id = makeId();
      setRects((prev) => [
        ...prev,
        { id, x: p.x, y: p.y, width: 0, height: 0, color, strokeWidth },
      ]);
      setDrawingState({ mode: "rect", activeId: id });
      return;
    }

    if (tool === "arrow") {
      const id = makeId();
      setArrows((prev) => [
        ...prev,
        { id, points: [p.x, p.y, p.x, p.y], color, strokeWidth },
      ]);
      setDrawingState({ mode: "arrow", activeId: id });
      return;
    }

    if (tool === "mosaic") {
      const id = makeId();
      setMosaics((prev) => [
        ...prev,
        {
          id,
          x: p.x,
          y: p.y,
          width: 1,
          height: 1,
          color: "rgba(15,23,42,0.6)",
        },
      ]);
      setDrawingState({ mode: "mosaic", activeId: id });
    }
  };

  const handlePointerMove = (event: KonvaEventObject<MouseEvent>) => {
    if (!bgImage || !scaledWidth || !scaledHeight) return;
    const stage = event.target.getStage();
    const point = stage?.getPointerPosition();
    if (!point) return;

    if (drawingState.mode === "text-drag") return;

    const p = getImagePoint(point); // 图片坐标
    const pClamped = selectionBox
      ? {
          x: clamp(p.x, selectionBox.x, selectionBox.x + selectionBox.width),
          y: clamp(p.y, selectionBox.y, selectionBox.y + selectionBox.height),
        }
      : p;

    if (tool === "select") {
      if (drawingState.mode === "selecting") {
        setSelection({
          x: drawingState.anchor.x,
          y: drawingState.anchor.y,
          width: p.x - drawingState.anchor.x,
          height: p.y - drawingState.anchor.y,
        });
        return;
      }

      if (drawingState.mode === "move" && selectionBox) {
        const newX = clamp(
          p.x - drawingState.offsetX,
          0,
          imageBounds.width - selectionBox.width
        );
        const newY = clamp(
          p.y - drawingState.offsetY,
          0,
          imageBounds.height - selectionBox.height
        );
        setSelection({ ...selectionBox, x: newX, y: newY });
        return;
      }

      if (drawingState.mode === "resize" && drawingState.startBox) {
        const resized = resizeSelection(
          drawingState.startBox,
          drawingState.handle,
          p,
          imageBounds
        );
        setSelection(resized);
        return;
      }

      const handle = hitHandle(p, selectionBox);
      if (handle) {
        setCursor(cursorForHandle(handle));
      } else if (selectionBox && pointInBox(p, selectionBox)) {
        setCursor("move");
      } else {
        setCursor("crosshair");
      }
      return;
    }

    if (tool === "eraser" && drawingState.mode === "eraser") {
      eraseAtPoint(p);
      setCursor(eraserCursor);
      return;
    }

    if (tool === "pen" && drawingState.mode === "pen") {
      setStrokes((prev) =>
        prev.map((stroke) =>
          stroke.id === drawingState.activeId
            ? { ...stroke, points: [...stroke.points, pClamped.x, pClamped.y] }
            : stroke
        )
      );
      return;
    }

    if (tool === "rect" && drawingState.mode === "rect") {
      setRects((prev) =>
        prev.map((rect) =>
          rect.id === drawingState.activeId
            ? {
                ...rect,
                width: pClamped.x - rect.x,
                height: pClamped.y - rect.y,
              }
            : rect
        )
      );
    }

    if (tool === "arrow" && drawingState.mode === "arrow") {
      setArrows((prev) =>
        prev.map((arrow) =>
          arrow.id === drawingState.activeId
            ? {
                ...arrow,
                points: [
                  arrow.points[0],
                  arrow.points[1],
                  pClamped.x,
                  pClamped.y,
                ] as ArrowShape["points"],
              }
            : arrow
        )
      );
      return;
    }

    if (tool === "mosaic" && drawingState.mode === "mosaic") {
      setMosaics((prev) =>
        prev.map((block) =>
          block.id === drawingState.activeId
            ? {
                ...block,
                width: pClamped.x - block.x,
                height: pClamped.y - block.y,
              }
            : block
        )
      );
    }
  };

  const handlePointerUp = (_event: KonvaEventObject<MouseEvent>) => {
    if (drawingState.mode === "text-drag") {
      setDrawingState({ mode: null });
      textDraggingRef.current = false;
      return;
    }

    if (drawingState.mode === "pen" && drawingState.activeId) {
      const stroke = strokes.find((item) => item.id === drawingState.activeId);
      if (stroke) {
        if (stroke.points.length < 4) {
          setStrokes((prev) =>
            prev.filter((item) => item.id !== drawingState.activeId)
          );
        } else {
          recordAction({ kind: "stroke", item: clone(stroke) });
        }
      }
    }

    if (drawingState.mode === "rect" && drawingState.activeId) {
      const rect = rects.find((item) => item.id === drawingState.activeId);
      const normalized = rect ? normalizeBox(rect) : null;
      if (!normalized || normalized.width < 4 || normalized.height < 4) {
        setRects((prev) =>
          prev.filter((item) => item.id !== drawingState.activeId)
        );
      } else if (rect) {
        recordAction({ kind: "rect", item: clone(rect) });
      }
    }

    if (drawingState.mode === "arrow" && drawingState.activeId) {
      const arrow = arrows.find((item) => item.id === drawingState.activeId);
      if (arrow) {
        const [x1, y1, x2, y2] = arrow.points;
        const distance = Math.hypot(x2 - x1, y2 - y1);
        if (distance < 4) {
          setArrows((prev) =>
            prev.filter((item) => item.id !== drawingState.activeId)
          );
        } else {
          recordAction({ kind: "arrow", item: clone(arrow) });
        }
      }
    }

    if (drawingState.mode === "mosaic" && drawingState.activeId) {
      const mosaic = mosaics.find((item) => item.id === drawingState.activeId);
      const normalized = mosaic ? normalizeBox(mosaic) : null;
      if (!normalized || normalized.width < 4 || normalized.height < 4) {
        setMosaics((prev) =>
          prev.filter((item) => item.id !== drawingState.activeId)
        );
      } else if (mosaic) {
        recordAction({ kind: "mosaic", item: clone(mosaic) });
      }
    }

    setDrawingState({ mode: null });
    if (tool === "select") {
      const box = normalizeBox(selection);
      if (box && Math.abs(box.width) < 5 && Math.abs(box.height) < 5) {
        // 轻点视为全图：以图片缩放后区域为准
        const fullWidth = imageBounds.width || geometry.width;
        const fullHeight = imageBounds.height || geometry.height;
        setSelection({ x: 0, y: 0, width: fullWidth, height: fullHeight });
        setSelectionReady(true);
      } else if (box && box.width >= 4 && box.height >= 4) {
        setSelection(box);
        setSelectionReady(true);
      } else {
        setSelection(null);
        setSelectionReady(false);
      }
      setCursor("crosshair");
    }
  };

  const renderCaptureImage = (): string | null => {
    if (!bgImage) return null;
    const scale = renderScale || 1;
    const box = selectionBox;
    const hasValidBox = !!box && box.width > 4 && box.height > 4;

    // box 是“图片坐标系”，直接除以 scale 就是原始 screenshot 坐标
    const crop = hasValidBox
      ? {
          x: box.x / scale,
          y: box.y / scale,
          width: box.width / scale,
          height: box.height / scale,
        }
      : null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setError("无法创建画布上下文");
      return null;
    }

    if (crop) {
      canvas.width = crop.width;
      canvas.height = crop.height;
      ctx.drawImage(
        bgImage,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );
    } else {
      canvas.width = bgImage.width;
      canvas.height = bgImage.height;
      ctx.drawImage(bgImage, 0, 0);
    }

    const toOriginX = (x: number) => x / scale - (crop ? crop.x : 0);
    const toOriginY = (y: number) => y / scale - (crop ? crop.y : 0);

    // 矩形
    rects.forEach((rect) => {
      const n = normalizeBox(rect);
      if (!n) return;
      const x = toOriginX(n.x);
      const y = toOriginY(n.y);
      const w = n.width / scale;
      const h = n.height / scale;

      ctx.save();
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = rect.strokeWidth;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    });

    // 箭头
    const drawArrow = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      widthValue: number
    ) => {
      const headLen = 18;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(widthValue, 3);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    arrows.forEach((arrow) => {
      const [vx1, vy1, vx2, vy2] = arrow.points;
      const x1 = toOriginX(vx1);
      const y1 = toOriginY(vy1);
      const x2 = toOriginX(vx2);
      const y2 = toOriginY(vy2);
      drawArrow(x1, y1, x2, y2, arrow.color, arrow.strokeWidth);
    });

    mosaics.forEach((block) => {
      const n = normalizeBox(block);
      if (!n) return;
      const x = toOriginX(n.x);
      const y = toOriginY(n.y);
      const w = n.width / scale;
      const h = n.height / scale;
      const sampleCanvas = document.createElement("canvas");
      const pixelSize = 12;
      const sampleWidth = Math.max(1, Math.round(w / pixelSize));
      const sampleHeight = Math.max(1, Math.round(h / pixelSize));
      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      const sampleCtx = sampleCanvas.getContext("2d");
      if (!sampleCtx) return;
      sampleCtx.imageSmoothingEnabled = false;
      sampleCtx.drawImage(
        bgImage,
        n.x / scale,
        n.y / scale,
        w,
        h,
        0,
        0,
        sampleWidth,
        sampleHeight
      );
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sampleCanvas, 0, 0, sampleWidth, sampleHeight, x, y, w, h);
      ctx.restore();
    });

    strokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 4) return;

      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      for (let i = 0; i < stroke.points.length; i += 2) {
        const vx = stroke.points[i];
        const vy = stroke.points[i + 1];
        const x = toOriginX(vx);
        const y = toOriginY(vy);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    });

    texts.forEach((item) => {
      const x = toOriginX(item.x);
      const y = toOriginY(item.y);
      const maxWidth = selectionBox
        ? Math.max(20, selectionBox.x + selectionBox.width - item.x)
        : canvas.width - x - 10;
      const font =
        'bold 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const displayText = ellipsizeText(item.text, maxWidth, font);
      ctx.save();
      ctx.font = font;
      ctx.fillStyle = item.color;
      ctx.textBaseline = "top";
      ctx.fillText(displayText, x, y, maxWidth);
      ctx.restore();
    });

    return canvas.toDataURL("image/png");
  };

  const handleSave = async () => {
    if (!bgImage) return;
    const api = window.electronCapturer;
    if (!api?.saveCapture) {
      setError("未检测到保存 API，确认 preload 暴露了 saveCapture。");
      return;
    }

    const toggleTop = async (on: boolean) => {
      try {
        if (on) await window.electronCapturer?.raiseOverlay?.();
        else await window.electronCapturer?.lowerOverlay?.();
      } catch (err) {
        console.warn("toggle top failed", err);
      }
    };

    const dataUrl = renderCaptureImage();
    if (!dataUrl) return;

    await toggleTop(false);
    const result = await api.saveCapture(dataUrl);
    if (!result?.canceled) {
      setStatus(`已保存到 ${result.filePath}`);
      handleCloseOverlay();
      return;
    }
    await toggleTop(true);
  };

  const handleCopy = async () => {
    const dataUrl = renderCaptureImage();
    if (!dataUrl) return;
    if (!navigator.clipboard?.write) {
      setError("当前环境不支持写入剪贴板");
      return;
    }
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      setStatus("已复制到剪贴板");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`复制失败: ${message}`);
    }
  };

  const handleConfirm = async () => {
    const dataUrl = renderCaptureImage();
    if (!dataUrl) return;
    await window.electronCapturer?.emitCaptureResult?.(dataUrl);
    handleCloseOverlay();
  };

  const selectionLabel = selectionBox
    ? `${Math.round(selectionBox.width / (renderScale || 1))} × ${Math.round(
        selectionBox.height / (renderScale || 1)
      )}`
    : "";
  const canUndo = actions.length > 0;
  const canRedo = redoStack.length > 0;
  const toolbarTools = useMemo<ToolItem<Tool>[]>(() => {
    if (!locale.toolLabels) return toolbarToolsBase;
    return toolbarToolsBase.map((tool) => ({
      ...tool,
      label: locale.toolLabels?.[tool.id] || tool.label,
    }));
  }, [locale.toolLabels]);

  const toolbarPosition = useMemo(() => {
    if (!selectionBox) return null;
    const padding = 12;
    const width = toolbarWidth || 820;
    const baseX = selectionBox.x + offsetX;
    const baseY = selectionBox.y + offsetY;
    const x = clamp(
      baseX + selectionBox.width / 2 - width / 2,
      12,
      geometry.width - width - 12
    );
    const y = clamp(
      baseY + selectionBox.height + padding,
      12,
      geometry.height - 76
    );
    return { x, y, width };
  }, [selectionBox, geometry, offsetX, offsetY, toolbarWidth]);

  useEffect(() => {
    if (!toolbarRef.current) return;
    const measure = () => {
      const rect = toolbarRef.current?.getBoundingClientRect();
      if (rect) setToolbarWidth(Math.ceil(rect.width));
    };
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, [selectionReady, tool, color, strokeWidth]);

  useEffect(() => {
    if (!textEditor || !textInputRef.current) return;
    const handle = requestAnimationFrame(() => {
      textInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(handle);
  }, [textEditor?.id]);

  const clampTextPosition = (item: TextShape, p: Point): Point => {
    if (!selectionBox) return p;
    const padding = 6;
    const maxWidth = maxTextWidth(item);
    const measured = measureTextSize(item.text).width + padding * 2;
    const effectiveWidth = Math.min(maxWidth, measured);
    const measuredHeight = measureTextSize(item.text).height + padding * 2;
    const maxX = selectionBox.x + selectionBox.width - effectiveWidth;
    const maxY = selectionBox.y + selectionBox.height - measuredHeight;
    return {
      x: clamp(p.x, selectionBox.x, Math.max(selectionBox.x, maxX)),
      y: clamp(p.y, selectionBox.y, Math.max(selectionBox.y, maxY)),
    };
  };

  const handleTextDragStart = (id: string) => {
    const target = texts.find((t) => t.id === id);
    if (target) {
      textDragStartRef.current = { x: target.x, y: target.y };
    }
  };

  const handleTextDragEnd = (id: string, evt: KonvaEventObject<DragEvent>) => {
    const start = textDragStartRef.current;
    if (!start) return;
    const node = evt.target;
    const newPos: Point = {
      x: node.x() - offsetX,
      y: node.y() - offsetY,
    };
    const item = texts.find((t) => t.id === id);
    const clamped = clampTextPosition(
      item || { id, x: start.x, y: start.y, text: "", color },
      newPos
    );
    setTexts((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, x: clamped.x, y: clamped.y } : item
      )
    );
    if (clamped.x !== start.x || clamped.y !== start.y) {
      recordAction({ kind: "text-move", id, from: start, to: clamped });
    }
    textDragStartRef.current = null;
    node.position({ x: clamped.x + offsetX, y: clamped.y + offsetY });
    textDraggingRef.current = false;
    setCursor(tool === "text" ? "text" : "crosshair");
  };

  const startDragText = (id: string) => {
    handleTextDragStart(id);
    setDrawingState({ mode: "text-drag", id });
    textDraggingRef.current = true;
    const node =
      stageNodeRef.current?.findOne<Konva.Node>(`[data-id="${id}"]`) ||
      stageNodeRef.current?.findOne<Konva.Node>(`#text-${id}`);
    if (node && typeof (node as any).startDrag === "function") {
      (node as any).startDrag();
    }
  };

  const maxTextWidth = (item: TextShape): number => {
    if (!selectionBox) return geometry.width;
    const rightLimit = selectionBox.x + selectionBox.width;
    return Math.max(20, rightLimit - item.x);
  };

  const ellipsizeText = (
    text: string,
    maxWidth: number,
    font: string
  ): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return text;
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let low = 0;
    let high = text.length;
    const ellipsis = "…";
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = text.slice(0, mid) + ellipsis;
      if (ctx.measureText(candidate).width <= maxWidth) low = mid + 1;
      else high = mid;
    }
    return text.slice(0, low - 1) + ellipsis;
  };

  useEffect(() => {
    if (tool === "eraser") setCursor(eraserCursor);
    else if (tool === "text") setCursor("text");
    else setCursor("crosshair");
  }, [tool]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-950/90 text-slate-100 backdrop-blur-sm">
      <div className="absolute left-4 top-3 text-xs text-slate-300/80">
        {locale.escHint || defaultTexts.escHint}
      </div>
      {status && (
        <div className="absolute left-4 top-8 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-100 shadow-md shadow-sky-900/35">
          {status}
        </div>
      )}
      {error && (
        <div className="absolute left-4 top-20 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 shadow-md shadow-rose-900/35">
          {error}
        </div>
      )}

      {bgImage ? (
        <>
          <div className="relative flex-1 min-h-0 overflow-hidden bg-[#01060f]">
            <Stage
              width={geometry.width}
              height={geometry.height}
              ref={(node) => {
                stageRef.current = node;
                stageNodeRef.current = node as unknown as Konva.Stage | null;
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onContextMenu={(e) => e.evt.preventDefault()}
              className="bg-[#01060f]"
              style={{ cursor: tool === "eraser" ? eraserCursor : cursor }}
            >
              <Layer listening={false}>
                <KonvaImage
                  image={bgImage}
                  x={offsetX}
                  y={offsetY}
                  width={scaledWidth}
                  height={scaledHeight}
                  listening={false}
                />
              </Layer>
              <Layer listening={false} name="mask-layer">
                <Rect
                  width={geometry.width}
                  height={geometry.height}
                  fill="rgba(0,0,0,0.45)"
                />
                {selectionBox && (
                  <Rect
                    x={selectionBox.x + offsetX}
                    y={selectionBox.y + offsetY}
                    width={selectionBox.width}
                    height={selectionBox.height}
                    fill="rgba(0,0,0,0.45)"
                    globalCompositeOperation="destination-out"
                  />
                )}
              </Layer>
              <Layer>
                {rects.map((rect) => {
                  const normalized = normalizeBox(rect);
                  if (!normalized) return null;
                  return (
                    <Rect
                      key={rect.id}
                      x={normalized.x + offsetX}
                      y={normalized.y + offsetY}
                      width={normalized.width}
                      height={normalized.height}
                      stroke={rect.color}
                      strokeWidth={rect.strokeWidth}
                    />
                  );
                })}
                {arrows.map((arrow) => (
                  <Arrow
                    key={arrow.id}
                    points={[
                      arrow.points[0] + offsetX,
                      arrow.points[1] + offsetY,
                      arrow.points[2] + offsetX,
                      arrow.points[3] + offsetY,
                    ]}
                    stroke={arrow.color}
                    fill={arrow.color}
                    strokeWidth={Math.max(arrow.strokeWidth, 3)}
                    pointerLength={18}
                    pointerWidth={12}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}
                {mosaics.map((block) => {
                  const normalized = normalizeBox(block);
                  if (
                    !normalized ||
                    normalized.width < 2 ||
                    normalized.height < 2
                  )
                    return null;
                  const safeScale = renderScale || 1;
                  return (
                    <KonvaImage
                      key={block.id}
                      x={normalized.x + offsetX}
                      y={normalized.y + offsetY}
                      width={normalized.width}
                      height={normalized.height}
                      image={bgImage}
                      crop={{
                        x: normalized.x / safeScale,
                        y: normalized.y / safeScale,
                        width: normalized.width / safeScale,
                        height: normalized.height / safeScale,
                      }}
                      filters={[Konva.Filters.Pixelate]}
                      pixelSize={mosaicPixelSize}
                      listening={false}
                      stroke="#0ea5e9"
                      strokeWidth={1}
                      ref={(node) => {
                        if (
                          node &&
                          normalized.width > 2 &&
                          normalized.height > 2
                        ) {
                          node.clearCache();
                          node.cache();
                          node.getLayer()?.batchDraw();
                        }
                      }}
                    />
                  );
                })}
                {strokes.map((stroke) => {
                  const pts = stroke.points;
                  const shifted = [];
                  for (let i = 0; i < pts.length; i += 2) {
                    shifted.push(pts[i] + offsetX, pts[i + 1] + offsetY);
                  }
                  return (
                    <Line
                      key={stroke.id}
                      points={shifted}
                      stroke={stroke.color}
                      strokeWidth={stroke.strokeWidth}
                      tension={0.35}
                      lineCap="round"
                      lineJoin="round"
                    />
                  );
                })}
                {texts.map((item) => (
                  <KonvaText
                    key={item.id}
                    id={`text-${item.id}`}
                    name="text-shape"
                    data-id={item.id}
                    x={item.x + offsetX}
                    y={item.y + offsetY}
                    text={item.text}
                    fontSize={20}
                    fontStyle="700"
                    fill={item.color}
                    width={maxTextWidth(item)}
                    wrap="none"
                    ellipsis
                    draggable={tool === "select" || tool === "text"}
                    padding={6}
                    dragBoundFunc={(pos) => {
                      const clamped = clampTextPosition(item, {
                        x: pos.x - offsetX,
                        y: pos.y - offsetY,
                      });
                      return { x: clamped.x + offsetX, y: clamped.y + offsetY };
                    }}
                    onDragStart={() => handleTextDragStart(item.id)}
                    onDragEnd={(e) => handleTextDragEnd(item.id, e)}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      startDragText(item.id);
                    }}
                  />
                ))}
              </Layer>
              <Layer name="selection-layer">
                {selectionBox && (
                  <>
                    <Rect
                      x={selectionBox.x + offsetX}
                      y={selectionBox.y + offsetY}
                      width={selectionBox.width}
                      height={selectionBox.height}
                      stroke="#38bdf8"
                      strokeWidth={2}
                    />
                    {handlePositions(selectionBox).map((handle) => (
                      <Rect
                        key={handle.id}
                        x={handle.x + offsetX - 5}
                        y={handle.y + offsetY - 5}
                        width={10}
                        height={10}
                        fill="#0ea5e9"
                        stroke="#e0f2fe"
                        strokeWidth={1}
                      />
                    ))}
                    {selectionLabel && (
                      <Label
                        x={selectionBox.x + offsetX + 8}
                        y={Math.max(selectionBox.y + offsetY - 28, 4)}
                        listening={false}
                      >
                        <Tag fill="rgba(15,23,42,0.75)" cornerRadius={6} />
                        <KonvaText
                          text={selectionLabel}
                          fontSize={14}
                          fontStyle="600"
                          fill="#e2e8f0"
                          padding={6}
                        />
                      </Label>
                    )}
                  </>
                )}
              </Layer>
            </Stage>
          </div>
          {textEditor &&
            createPortal(
              <div className="pointer-events-none fixed inset-0 z-9999">
                <div
                  className="pointer-events-auto absolute"
                  style={{
                    left: textEditor.viewportX,
                    top: textEditor.viewportY,
                  }}
                >
                  <input
                    ref={textInputRef}
                    value={textEditor.value}
                    onChange={(e) =>
                      setTextEditor((prev) =>
                        prev ? { ...prev, value: e.target.value } : prev
                      )
                    }
                    onBlur={commitTextInput}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitTextInput();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelTextInput();
                      }
                    }}
                    className="rounded-md border border-white/30 bg-slate-900/90 px-2 py-1 text-sm text-white shadow-md outline-none focus:border-sky-400"
                    placeholder={
                      locale.textPlaceholder || defaultTexts.textPlaceholder
                    }
                    style={{ color: textEditor.color, minWidth: 160 }}
                  />
                </div>
              </div>,
              document.body
            )}

          {toolbarPosition && selectionReady && (
            <div
              className="absolute translate-y-4"
              ref={toolbarRef}
              style={{ left: toolbarPosition.x, top: toolbarPosition.y }}
            >
              <ScreenshotToolbar
                toolOptions={toolbarTools}
                activeTool={tool}
                onToolChange={setTool}
                colors={palette}
                activeColor={color}
                onColorChange={setColor}
                strokeWidthOptions={[2, 4, 6, 8, 10, 12]}
                strokeWidth={strokeWidth}
                minStrokeWidth={1}
                maxStrokeWidth={12}
                onStrokeWidthChange={setStrokeWidth}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                onCopy={handleCopy}
                onSave={handleSave}
                onCancel={handleCloseOverlay}
                onConfirm={handleConfirm}
                labels={locale.toolbar}
                disableSubmit={!selectionReady}
                disableCopy={!bgImage}
                disableSave={!bgImage}
              />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-200">
          {locale.loading || defaultTexts.loading}
        </div>
      )}
    </div>
  );
}
