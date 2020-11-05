import { IPubOptions, EpubOptions } from "../../lib/helpers/";
import { EOL } from 'os';
import { encodeXML } from 'entities';

export const createContentOpfStr = (
    { id,
        title,
        description,
        publisher,
        author,
        date,
        lang,
        cover,
        _coverExtension,
        _coverMediaType,
        images,
        fonts,
        content
    }: Partial<EpubOptions>) => (`
<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf"
         version="2.0"
         unique-identifier="BookId">

    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
              xmlns:opf="http://www.idpf.org/2007/opf">

        <dc:identifier id="BookId" opf:scheme="URN">${id}</dc:identifier>
        <dc:title>${encodeXML(title)}</dc:title>
        <dc:description>${encodeXML(description)}</dc:description>
        <dc:publisher>${publisher || 'anonymous'}</dc:publisher>
        <dc:creator opf:role="aut" opf:file-as="${Array.isArray(author) ? encodeXML(author.join(",")) : author}" >${Array.isArray(author) ? encodeXML(author.join(",")) : author}</dc:creator>
        <dc:date opf:event="modification">${date}</dc:date>
        <dc:language>${lang || 'en'}</dc:language>
        <meta name="cover" content="image_cover" />
        <meta name="generator" content="epub-gen" />

    </metadata>

    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
        <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" />
        <item id="css" href="style.css" media-type="text/css" />

        ${(!!cover && renderItem({ id: 'image_cover', href: 'cover.' + _coverExtension, mediaType: _coverMediaType }))}
        
        ${images.map((image, index) => (renderItem({ id: 'image_' + index, href: 'images/' + image.id + '.' + image.extension, mediaType: image.mediaType }))).join(EOL)}

        ${content.map((content, index) => (renderItem({ id: 'content_' + index + '_' + content.id, href: content.href, mediaType: 'application/xhtml+xml' }))).join(EOL)}
        
        ${fonts.map((font, index) => (renderItem({ id: 'font_' + index, href: 'fonts/' + font, mediaType: 'application/x-font-ttf' }))).join(EOL)}

    </manifest>

    <spine toc="ncx">
        ${content.map((sc, index) => {
        if (sc.beforeToc && !sc.excludeFromToc) return renderItemRef({ idref: 'content_' + index + '_' + sc.id });
    }).join(EOL)}
        <itemref idref="toc" />
        ${content.map((sc, index) => {
        if (!sc.beforeToc && !sc.excludeFromToc) return renderItemRef({ idref: 'content_' + index + '_' + sc.id });
    }).join(EOL)}
    </spine>
    <guide />
</package>
  `
    );

const renderItem = ({ id, href, mediaType }: { id: string, href: string, mediaType: string; }) => (`
<item id="${id}" href="${href}" media-type="${mediaType}" />
`);

const renderItemRef = ({ idref }: { idref: string; }) => `<itemref idref="${idref}"/>`;