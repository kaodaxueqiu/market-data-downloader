import React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

/**
 * React NodeView component for rendering quote nodes in the editor.
 */
export function QuoteNodeView({ node, editor, selected }: NodeViewProps) {
  const { title, content } = node.attrs;

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editor.chain().removeQuote().focus('end').run();
  };

  return (
    <NodeViewWrapper
      className={`im-quote-node ${selected ? 'im-quote-node--selected' : ''}`}
      data-type="quote"
      contentEditable={false}
    >
      <div className="im-quote-node__content">
        <span className="im-quote-node__title">{title}</span>
        <span className="im-quote-node__text">{content}</span>
      </div>
      <button
        type="button"
        className="im-quote-node__remove-btn"
        onClick={handleRemove}
        contentEditable={false}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>
    </NodeViewWrapper>
  );
}
