import ReactMarkdown from "react-markdown";

/**
 * Renders Markdown text coming from Sanity `markdown` fields.
 *
 * Supports bullet lists, bold, italic, and inline code via react-markdown.
 * The `.prose-content` class (see app/globals.css) provides readable typography.
 */
export function Markdown({
  children,
  className = ""
}: {
  children?: string | null;
  className?: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <div className={`prose-content ${className}`.trim()}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
