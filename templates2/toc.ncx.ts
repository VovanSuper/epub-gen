import { IPubOptions, EpubOptions } from "../lib/helpers/";
import { EOL } from 'os';

let _index = 0;

export const createTocStr = ({ id, title, author, content, tocTitle }: Partial<EpubOptions>) => (`
<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${id}" />
    <meta name="dtb:generator" content="epub-gen"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${title}</text>
  </docTitle>
  <docAuthor>
    <text>${author}</text>
  </docAuthor>
  <navMap>
    ${renderContentStrBeforeToc({ content })}

    <navPoint id="toc" playOrder="${_index++}" class="chapter">
      <navLabel>
        <text>${tocTitle}</text>
      </navLabel>
      <content src="toc.xhtml"/>
    </navPoint>

    ${renderContentStrAfterToc({ content })}
  </navMap>
</ncx>
  `
).trim();

const renderContentStrBeforeToc = ({ content }: Partial<IPubOptions>) => content.map((sc, index) => {
  if (!sc.excludeFromToc && sc.beforeToc) {
    return renderContentLine({ index, id: sc.id, title: sc.title, href: sc.href });
  }
}).join(EOL);

const renderContentStrAfterToc = ({ content }: Partial<IPubOptions>) => content.map((sc, index) => {
  if (!sc.excludeFromToc && !sc.beforeToc) {
    return renderContentLine({ index, id: sc.id, title: sc.title, href: sc.href });
  }
}).join(EOL);

const renderContentLine = ({ index, id, title, href }: { index: number, id: string, title: string, href: string; }) => (`
  <navPoint id="content_${index}_${id}" playOrder=${_index++} class="chapter">
    <navLabel>
      <text>${(1 + index) + ". " + (title || "Chapter " + (1 + index))}</text>
    </navLabel>
    <content src=${href} />
  </navPoint>
`);