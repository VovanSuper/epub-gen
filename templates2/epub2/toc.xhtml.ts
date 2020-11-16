import { IPubOptions } from "../../lib/helpers/";
import { EOL } from 'os';
import { encodeXML } from 'entities';

export const createTocXhtmlStr = ({ title, content, tocTitle, lang }: Partial<IPubOptions>) => (`
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xml:lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>${encodeXML(title!)}</title>
    <meta charset="UTF-8" />
    <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
<h1 class="h1">${tocTitle}</h1>
  ${renderContents(content)}
</body>
</html>
`).trim();

const renderContents = (ctx: IPubOptions['content']) => ctx?.map((cs, index) => (
  !cs.excludeFromToc && renderTableOfContentsItem({
    href: cs.href!,
    title: cs.title,
    author: cs.author!,
    url: cs.url!,
    index
  })
)).join(EOL);

const renderTableOfContentsItem = ({ href, author, index, title, url }: { href: string, author: string | string[], index: number, title: string, url: string; }) => (`
  <p class="table-of-content">
    <a href="${href}">
      ${((1 + index) + '. ' + title) || ('Chapter ' + (1 + index))}
        ${(Array.isArray(author) && !!author.length) ?
          '- <small class="toc-author">' + author.join(',') + '</small>'
          : ''
        }
    </a>
  </p>
`).trim().concat(EOL);