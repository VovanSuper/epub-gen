import { EpubOptions } from "../../lib/helpers/";
import { EOL } from 'os';
import { encodeXML } from 'entities';

const date = new Date();
const year = date.getFullYear();
const month = date.getMonth() + 1;
const day = date.getDate();
const stringDate = "" + year + "-" + month + "-" + day;

export const createContentOpfStr = (
  {
    id,
    title,
    publisher,
    author,
    lang,
    cover,
    _coverExtension,
    _coverMediaType,
    images,
    fonts,
    content
  }: Partial<EpubOptions>
) => (`
<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf"
         version="3.0"
         unique-identifier="BookId"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:dcterms="http://purl.org/dc/terms/"
         xml:lang="en"
         xmlns:media="http://www.idpf.org/epub/vocab/overlays/#"
         prefix="ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/">

    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
              xmlns:opf="http://www.idpf.org/2007/opf">

        <dc:identifier id="BookId">${id}</dc:identifier>
        <meta refines="#BookId" property="identifier-type" scheme="onix:codelist5">22</meta>
        <meta property="dcterms:identifier" id="meta-identifier">BookId</meta>
        <dc:title>${encodeXML(title!)}</dc:title>
        <meta property="dcterms:title" id="meta-title">${encodeXML(title!)}</meta>
        <dc:language>${lang || 'en'}</dc:language>
        <meta property="dcterms:language" id="meta-language">${lang || 'en'}</meta>
        <meta property="dcterms:modified">${(new Date()).toISOString().split('.')[0] + 'Z'}</meta>
        <dc:creator id="creator">${(Array.isArray(author) && !!author.length) ? encodeXML(author.join(',')) : author}</dc:creator>
        <meta refines="#creator" property="file-as">${(Array.isArray(author) && !!author.length) ? encodeXML(author.join(',')) : author}</meta>
        <meta property="dcterms:publisher">${encodeXML(publisher!) || 'anonymous'}</meta>
        <dc:publisher>${encodeXML(publisher!) || 'anonymous'}</dc:publisher>
        
        <meta property="dcterms:date">${stringDate}</meta>
        <dc:date>${stringDate}</dc:date>
        <meta property="dcterms:rights">All rights reserved</meta>
        <dc:rights>Copyright &#x00A9; ${year} by ${encodeXML(publisher!) || 'anonymous'}</dc:rights>
        <meta name="cover" content="image_cover"/>
        <meta name="generator" content="epub-gen" />
        <meta property="ibooks:specified-fonts">true</meta>

    </metadata>

    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
        <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" />
        <item id="css" href="style.css" media-type="text/css" />

        ${(!!cover && renderItem({ id: 'image_cover', href: 'cover.' + _coverExtension, mediaType: _coverMediaType! }))}

        ${images?.map((image, index) => (renderItem({ id: 'image_' + index, href: 'images/' + image.id + '.' + image.extension, mediaType: image.mediaType! }))).join(EOL)}

        ${content?.map((content, index) => (renderItem({ id: 'content_' + index + '_' + content.id, href: content.href!, mediaType: 'application/xhtml+xml' }))).join(EOL)}
        
        ${fonts?.map((font, index) => (renderItem({ id: 'font_' + index, href: 'fonts/' + font, mediaType: 'application/x-font-ttf' }))).join(EOL)}

    </manifest>

    <spine toc="ncx">
        ${content?.map((sc, index) => {
  if (sc.beforeToc && !sc.excludeFromToc)
    return renderItemRef({ idref: 'content_' + index + '_' + sc.id });
}).join(EOL)}
        
        <itemref idref="toc" />
        ${content?.map((sc, index) => {
  if (!sc.beforeToc && !sc.excludeFromToc)
    return renderItemRef({ idref: 'content_' + index + '_' + sc.id });
}).join(EOL)}
    </spine>
    <guide>
    <reference type="text" title="Table of Content" href="toc.xhtml"/>
</guide>
</package>
  `
).trim();

const renderItem = ({ id, href, mediaType }: { id: string, href: string, mediaType: string; }) => (`
<item id="${id}" href="${href}" media-type="${mediaType}" />
`).trim();

const renderItemRef = ({ idref }: { idref: string; }) => `<itemref idref="${idref}"/>`;