import type React from 'react';
import { cn } from '@/renderer/lib/utils';
import {
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Download,
  Redo2,
  Undo2,
  X
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/renderer/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip';
import { useState } from 'react';

export type ToolItem<T extends string> = {
  id: T;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
};

export type ToolbarLabels = {
  color: string;
  strokeWidth: string;
  undo: string;
  redo: string;
  copy: string;
  save: string;
  cancel: string;
  confirm: string;
};

export type ScreenshotToolbarProps<T extends string> = {
  toolOptions: ToolItem<T>[];
  activeTool: T;
  onToolChange: (tool: T) => void;
  colors: string[];
  activeColor: string;
  onColorChange: (color: string) => void;
  strokeWidthOptions: number[];
  strokeWidth: number;
  minStrokeWidth?: number;
  maxStrokeWidth?: number;
  onStrokeWidthChange: (width: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onCopy?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  labels?: Partial<ToolbarLabels>;
  disableSubmit?: boolean;
  disableCopy?: boolean;
  disableSave?: boolean;
};

export function ScreenshotToolbar<T extends string>({
  toolOptions,
  activeTool,
  onToolChange,
  colors,
  activeColor,
  onColorChange,
  strokeWidthOptions,
  strokeWidth,
  minStrokeWidth,
  maxStrokeWidth,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = true,
  onCopy,
  onSave,
  onCancel,
  onConfirm,
  labels,
  disableSubmit,
  disableCopy,
  disableSave
}: ScreenshotToolbarProps<T>) {
  const mergedLabels: ToolbarLabels = {
    color: '选择颜色',
    strokeWidth: '线宽',
    undo: '撤销',
    redo: '重做',
    copy: '复制到剪贴板',
    save: '保存图片',
    cancel: '取消 (Esc)',
    confirm: '完成 (Enter)',
    ...labels
  };
  const strokeCandidates = strokeWidthOptions.length ? strokeWidthOptions : [strokeWidth];
  const strokeMin = minStrokeWidth ?? Math.min(...strokeCandidates);
  const strokeMax = maxStrokeWidth ?? Math.max(...strokeCandidates);
  const undoDisabled = !onUndo || !canUndo;
  const redoDisabled = !onRedo || !canRedo;
  const copyDisabled = !onCopy || disableCopy;
  const saveDisabled = !onSave || disableSave;
  const confirmDisabled = disableSubmit || !onConfirm;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (copied) return
    onCopy?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <TooltipProvider delayDuration={180}>
      <div className="inline-flex items-center gap-1 rounded-xl bg-toolbar-bg border border-toolbar-border p-1.5 shadow-lg">
        <div className="flex items-center gap-0.5">
          {toolOptions.map((tool) => {
            const active = activeTool === tool.id;
            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onToolChange(tool.id)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg transition-all duration-150',
                      active
                        ? 'bg-toolbar-active text-white shadow'
                        : 'text-toolbar-text-muted hover:bg-toolbar-hover hover:text-toolbar-text'
                    )}
                    aria-pressed={active}
                    aria-label={tool.label}
                  >
                    {tool.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2">
                  <span>{tool.label}</span>
                  {tool.shortcut && (
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                      {tool.shortcut}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="mx-1 h-6 w-px bg-toolbar-border" />

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-toolbar-text-muted hover:bg-toolbar-hover hover:text-toolbar-text transition-colors"
              aria-label={mergedLabels.color}
            >
              <div
                className="size-5 rounded-md border border-toolbar-border shadow-sm"
                style={{ backgroundColor: activeColor }}
              />
              <ChevronDown className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-auto p-3 bg-toolbar-bg border-toolbar-border">
            <div className="grid grid-cols-5 gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onColorChange(color)}
                className={cn(
                  'size-7 rounded-md border transition-transform hover:scale-110',
                  activeColor === color
                    ? 'border-toolbar-active ring-2 ring-toolbar-active ring-offset-1 ring-offset-toolbar-bg'
                    : 'border-toolbar-border'
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`${mergedLabels.color} ${color}`}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-toolbar-text-muted hover:bg-toolbar-hover hover:text-toolbar-text transition-colors"
              aria-label={mergedLabels.strokeWidth}
            >
              <div className="flex items-center justify-center size-5">
                <div
                  className="rounded-full bg-toolbar-text"
                  style={{
                    width: strokeWidth + 4,
                    height: strokeWidth + 4
                  }}
                />
              </div>
              <ChevronDown className="size-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-auto p-3 bg-toolbar-bg border-toolbar-border">
            <div className="flex items-center gap-3 px-1 pb-2 text-sm text-toolbar-text">
              <span className="text-toolbar-text-muted">{mergedLabels.strokeWidth}</span>
              <input
                type="range"
                min={strokeMin}
                max={strokeMax}
                value={strokeWidth}
                onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
              />
              <span className="font-medium tabular-nums">{strokeWidth}px</span>
            </div>
            <div className="flex gap-3">
              {strokeWidthOptions.map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => onStrokeWidthChange(width)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg transition-colors',
                    strokeWidth === width ? 'bg-toolbar-active' : 'hover:bg-toolbar-hover'
                  )}
                  aria-label={`线宽 ${width}`}
                >
                  <div
                    className={cn('rounded-full', strokeWidth === width ? 'bg-white' : 'bg-toolbar-text')}
                    style={{
                      width: width + 4,
                      height: width + 4
                    }}
                  />
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-6 w-px bg-toolbar-border" />

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                  onClick={onUndo}
                  disabled={undoDisabled}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-toolbar-text-muted transition-colors',
                    undoDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-toolbar-hover hover:text-toolbar-text'
                  )}
                aria-label={mergedLabels.undo}
              >
                <Undo2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>{mergedLabels.undo}</span>
              <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">⌘Z</kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                  onClick={onRedo}
                  disabled={redoDisabled}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-toolbar-text-muted transition-colors',
                    redoDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-toolbar-hover hover:text-toolbar-text'
                  )}
                aria-label={mergedLabels.redo}
              >
                <Redo2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>{mergedLabels.redo}</span>
              <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                ⌘⇧Z
              </kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-6 w-px bg-toolbar-border" />

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                  onClick={handleCopy}
                  disabled={copyDisabled}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-toolbar-text-muted transition-colors',
                    copyDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-toolbar-hover hover:text-toolbar-text'
                  )}
                aria-label={mergedLabels.copy}
              >
                {copied ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{mergedLabels.copy}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                  onClick={onSave}
                  disabled={saveDisabled}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-toolbar-text-muted transition-colors',
                    saveDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-toolbar-hover hover:text-toolbar-text'
                  )}
                aria-label={mergedLabels.save}
              >
                <Download className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{mergedLabels.save}</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-1 h-6 w-px bg-toolbar-border" />

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCancel}
                className="flex size-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label={mergedLabels.cancel}
              >
                <X className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{mergedLabels.cancel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                  onClick={onConfirm}
                  disabled={confirmDisabled}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-green-500 hover:bg-green-50 hover:text-green-600 transition-colors',
                    confirmDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-green-500'
                  )}
                aria-label={mergedLabels.confirm}
              >
                <Check className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{mergedLabels.confirm}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
