import React from 'react';
import type { QuoteInfo } from '../types';

export interface QuoteBarProps {
  /** Quote information */
  quote: QuoteInfo;
  /** Called when remove button is clicked */
  onRemove: () => void;
  /** Remove button label */
  removeLabel?: string;
}

/**
 * Quote message bar component.
 */
export function QuoteBar({ quote, onRemove, removeLabel = 'Remove quote' }: QuoteBarProps) {
  return (
    <div className="im-quote-bar">
      <div className="im-quote-bar__content">
        <span className="im-quote-bar__title">{quote.title}</span>
        <span className="im-quote-bar__text">{quote.content}</span>
      </div>
      <button
        type="button"
        className="im-quote-bar__remove-btn"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}
