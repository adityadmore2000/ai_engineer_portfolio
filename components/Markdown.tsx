import ReactMarkdown from "react-markdown";
import { rehypeTextSize } from "@/lib/utils/rehype-text-size";

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
      <ReactMarkdown rehypePlugins={[rehypeTextSize]}>{children}</ReactMarkdown>
    </div>
  );
}
