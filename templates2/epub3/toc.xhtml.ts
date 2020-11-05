import { IPubOptions } from "../../lib/helpers/";
import { EOL } from 'os';
import { encodeXML } from 'entities';

export const createTocXhtmlStr = ({ title, content, tocTitle, lang }: Partial<IPubOptions>) => (`
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
    <title>${encodeXML(title)}</title>
    <meta charset="UTF-8" />
    <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
<h1 class="h1">${tocTitle}</h1>
  <nav id="toc" epub:type="toc">
    <ol>
      ${renderContents(content)}
    </ol>
  </nav>
</body>
</html>
`).trim();

const renderContents = (ctx: IPubOptions['content']) => ctx.map((cs, index) => (
  ((!cs.excludeFromToc && cs.beforeToc) || (!cs.excludeFromToc && !cs.beforeToc)) && renderOlItem({
    href: cs.href,
    title: cs.title,
    author: cs.author,
    url: cs.url,
    index
  })
)).join(EOL);

const renderOlItem = ({ href, author, index, title, url }: { href: string, author: string | string[], index: number, title: string, url: string; }) => (`
      <li class="table-of-content" >
          <a href="${href}">${title || ('Chapter ' + (1 + index))}</a>
      </li>
`).trim().concat(EOL);