import "./MarkdownRenderer.scss";

import { Image } from "antd";
import React, { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

import CacheImage from "@/components/CacheImage";
import { useUserStore } from "@/store";

interface MarkdownRendererProps {
  markdown: string;
  className?: string;
}

const blockTags = new Set([
  "div",
  "img",
  "table",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "section",
  "article",
  "figure",
]);

const resolveCachedImageSrc = (src?: string) => {
  if (!src) return src;
  if (!window.electronAPI || src.match(/^blob:/)) return src;
  if (!src.match(/^https?:\/\//) && !src.match(/^file:\/\//)) {
    return `file://${src}`;
  }
  const cachePath = useUserStore.getState().imageCache[src];
  if (cachePath && window.electronAPI?.fileExists(cachePath)) {
    return `file://${cachePath}`;
  }
  return src;
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown, className }) => {
  const [copyStates, setCopyStates] = React.useState<{ [key: string]: string }>({});
  const blockTags = new Set([
    "div",
    "img",
    "table",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "section",
    "article",
    "figure",
  ]);

  const copyToClipboard = useCallback((code: string, blockId: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopyStates((prev) => ({ ...prev, [blockId]: "已复制！" }));
        setTimeout(() => {
          setCopyStates((prev) => ({ ...prev, [blockId]: "复制" }));
        }, 2000);
      })
      .catch((err) => {
        console.error("复制失败:", err);
        setCopyStates((prev) => ({ ...prev, [blockId]: "复制失败" }));
        setTimeout(() => {
          setCopyStates((prev) => ({ ...prev, [blockId]: "复制" }));
        }, 2000);
      });
  }, []);

  const renderLink = useCallback(
    ({
      href,
      children,
      className: linkClassName,
      ...props
    }: React.ComponentPropsWithoutRef<"a">) => {
      if (!href) {
        return <span>{children}</span>;
      }

      const combinedClassName = linkClassName ? `link-el ${linkClassName}` : "link-el";

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={combinedClassName}
          {...props}
        >
          {children}
        </a>
      );
    },
    [],
  );

  return (
    <div className={`markdown-renderer ${className || ""}`}>
      <Image.PreviewGroup>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            p({ node, children, ...props }) {
              const nodeChildren = (
                node as { children?: Array<{ type?: string; tagName?: string }> }
              )?.children;
              const hasBlockChildFromNode = Boolean(
                nodeChildren?.some(
                  (child) =>
                    child.type === "element" &&
                    child.tagName &&
                    blockTags.has(child.tagName),
                ),
              );
              const hasBlockChildFromChildren = React.Children.toArray(children).some(
                (child) =>
                  React.isValidElement(child) &&
                  (child.type === CacheImage ||
                    child.type === "div" ||
                    child.type === "img"),
              );
              const hasBlockChild = hasBlockChildFromNode || hasBlockChildFromChildren;
              if (hasBlockChild) {
                return (
                  <div className="markdown-paragraph" {...props}>
                    {children}
                  </div>
                );
              }
              return <p {...props}>{children}</p>;
            },
            a: renderLink,
            img({ src, alt }) {
              if (!src) return null;
              const resolvedSrc = resolveCachedImageSrc(src);
              return (
                <CacheImage
                  src={resolvedSrc}
                  alt={alt ?? ""}
                  className="markdown-image cursor-zoom-in"
                  preview={{ src: resolvedSrc }}
                />
              );
            },
            // @ts-ignore
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              // eslint-disable-next-line
              const code = String(children).replace(/\n$/, "");
              const blockId = code.slice(0, 20); // 使用代码前20个字符作为唯一标识

              if (!inline && match) {
                // 确保该代码块有初始复制状态
                if (!copyStates[blockId]) {
                  setCopyStates((prev) => ({ ...prev, [blockId]: "复制" }));
                }
                const language = className
                  ? className.replace("language-", "")
                  : "plaintext";
                return (
                  <div className="code-block-wrapper">
                    <div className="code-block-header">
                      <span className="code-language">{match[1]}</span>
                      <button
                        className="copy-button"
                        onClick={() => copyToClipboard(code, blockId)}
                        aria-label="复制代码"
                      >
                        {copyStates[blockId] || "复制"}
                      </button>
                    </div>
                    <SyntaxHighlighter
                      style={atomOneDark}
                      language={language}
                      showLineNumbers
                    >
                      {/* eslint-disable-next-line */}
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  </div>
                );
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </Image.PreviewGroup>
    </div>
  );
};

export default MarkdownRenderer;
