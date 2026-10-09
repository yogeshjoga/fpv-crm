import React from 'react';

const SAFE_URL = /^(https?:\/\/|\/|#|mailto:)/i;

/** Inline markdown: `code`, **bold**, *italic*, ![alt](url), [text](url). Anything else is plain text. */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(!\[[^\]]*\]\([^)\s]+\))|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) out.push(<code key={key} className="rounded bg-black/[0.06] px-1 py-0.5 text-[0.85em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith('![')) {
      const [, alt, url] = /!\[([^\]]*)\]\(([^)\s]+)\)/.exec(tok)!;
      if (SAFE_URL.test(url)) out.push(<img key={key} src={url} alt={alt} className="my-2 max-w-full rounded-lg" />);
    } else {
      const [, label, url] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(tok)!;
      out.push(
        SAFE_URL.test(url) ? (
          <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{label}</a>
        ) : (
          label
        ),
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Approximate preview of the markdown the website renders. Supports headings, lists, quotes, code blocks, rules, links and images. */
export function MarkdownPreview({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="my-3 overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">{code.join('\n')}</pre>);
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? 'mt-5 mb-2 text-2xl font-semibold' : level === 2 ? 'mt-4 mb-2 text-xl font-semibold' : 'mt-3 mb-1 text-lg font-semibold';
      blocks.push(React.createElement(`h${level}`, { key: k++, className: cls }, inline(h[2], `h${k}`)));
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) { blocks.push(<hr key={k++} className="my-4 border-neutral-200" />); i++; continue; }

    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={k++} className="my-3 border-l-4 border-neutral-300 pl-3 text-neutral-600">{inline(quote.join(' '), `q${k}`)}</blockquote>);
      continue;
    }

    const ul = /^\s*[-*]\s+/;
    const ol = /^\s*\d+\.\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''));
      const children = items.map((t, n) => <li key={n}>{inline(t, `l${k}-${n}`)}</li>);
      blocks.push(
        ordered
          ? <ol key={k++} className="my-3 list-decimal space-y-1 pl-6">{children}</ol>
          : <ul key={k++} className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
      );
      continue;
    }

    const para: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|---+$|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++} className="my-3 leading-relaxed">{inline(para.join(' '), `p${k}`)}</p>);
  }

  return <div className="text-sm text-neutral-800">{blocks}</div>;
}
