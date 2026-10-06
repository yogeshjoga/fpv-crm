/** Renders plain job-description text: blank lines separate paragraphs, lines starting with "- " become bullets. */
export function JobText({ text }: { text: string }) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (!blocks.length) return null;
  return (
    <div className="space-y-3 text-sm leading-relaxed text-neutral-700">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const bullets = lines.filter((l) => /^\s*[-•*]\s+/.test(l));
        // A short first line followed by bullets reads as a heading.
        if (bullets.length && bullets.length < lines.length && !/^\s*[-•*]\s+/.test(lines[0])) {
          return (
            <div key={i}>
              <div className="font-semibold text-neutral-900">{lines[0]}</div>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {lines.slice(1).map((l, j) => (
                  <li key={j}>{l.replace(/^\s*[-•*]\s+/, '')}</li>
                ))}
              </ul>
            </div>
          );
        }
        if (bullets.length === lines.length) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^\s*[-•*]\s+/, '')}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}
