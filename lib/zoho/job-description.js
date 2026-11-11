
const headings = ['Job Summary', 'Job Overview', 'About the Role', 'Key Responsibilities', 'Responsibilities',
  'Requirements', 'Qualifications & Experience', 'Qualifications and Experience', 'Qualifications',
  'Education', 'Preferred Industry Exposure', 'Skills Required', 'Required Skills', 'Benefits'];
const pattern = headings.slice().sort((a, b) => b.length - a.length).join('|');
const headingLine = new RegExp(`^(?:${pattern}|Experience)\\s*:?$`);

/** Read rich source text as inert data. Only React text nodes are ever rendered. */
function sourceText(value) {
  if (!/<\/?[a-z][^>]*>/i.test(value) || typeof DOMParser === 'undefined') return value;
  const doc = new DOMParser().parseFromString(value, 'text/html');
  function visit(node) {
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1) return '';
    const element = node, tag = element.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'form'].includes(tag)) return '';
    if (tag === 'br') return '\n';
    const content = Array.from(node.childNodes).map(visit).join('');
    if (tag === 'li') return `• ${content.trim()}\n`;
    if (/^h[1-6]$/.test(tag) || (['b', 'strong'].includes(tag) && headingLine.test(content.trim())))
      return `\n\n# ${content.trim()}\n\n`;
    if (['p', 'ul', 'ol', 'section', 'article'].includes(tag)) return `\n\n${content}\n\n`;
    if (['div', 'tr'].includes(tag)) return content.endsWith('\n') ? content : `${content}\n`;
    if (['td', 'th'].includes(tag)) return `${content}\t`;
    return content;
  }
  return visit(doc.body);
}

export function jobDescriptionBlocks(value) {
  const original = (typeof value === 'string' ? value : '');
  const rich = /<\/?[a-z][^>]*>/i.test(original);
  let text = sourceText(original).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
  if (!text) return [];
  // Some exports flatten rich text. Recover only explicit, case-sensitive labels
  // when several known section labels exist; never infer new job requirements.
  const labels = new RegExp(`(^|\\s)(${pattern})(?=\\s|:|$)`, 'g');
  const matches = [...text.matchAll(labels)];
  if (!rich && (matches.length >= 2 || (matches.length === 1 && matches[0].index === 0)))
    text = text.replace(labels, (_, space, heading) => `\n\n${heading}\n\n`);
  text = text.replace(/(^|\s|[.!?])Experience\s*:?\s*(?=[•●▪])/g, '$1\n\nExperience\n\n');
  text = text.replace(/[^\S\n]+[•●▪][ \t]*/g, '\n• ');
  const blocks = [];
  let paragraph = [], items = [];
  const flush = () => {
    if (paragraph.length) { blocks.push({type:'paragraph',text:paragraph.join('\n')}); paragraph=[]; }
    if (items.length) { blocks.push({type:'list',items}); items=[]; }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (headingLine.test(line) || /^#{1,6}\s+/.test(line)) { flush(); blocks.push({type:'heading',text:line.replace(/^#{1,6}\s+/, '').replace(/\s*:$/, '')}); continue; }
    const bullet = line.match(/^(?:[•●▪]|[-*]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      if (paragraph.length) flush();
      items.push(bullet[1]);
    } else if (items.length) items[items.length - 1] += ` ${line}`;
    else paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Compact text for the clamped preview; no markup or hidden executable content. */
export function jobDescriptionText(value) {
  return jobDescriptionBlocks(value).map(block => block.type === 'list' ? block.items.join(' • ') : block.text).join('\n\n');
}
