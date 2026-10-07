// Renders one tutor reply as markdown with KaTeX math (KaTeX CSS is global
// via src/styles/global.css). Raw HTML and images are never rendered; links
// open in a new tab.
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { normalizeMathDelimiters } from '@lib/tutor/math-delims';

export default function TutorMarkdown({ text }: { text: string }) {
  return (
    <div className="break-words leading-relaxed [&_.katex-display]:overflow-x-auto [&_a]:text-accent [&_a]:underline [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
        disallowedElements={['img']}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </div>
  );
}
