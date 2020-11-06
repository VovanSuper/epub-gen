import path from 'path';
import fs from 'fs';
import cheerio from 'cheerio';
import entities from 'entities';
import { normalizeSync as removeDiacritics } from 'normalize-diacritics';
import mime from 'mime';
import { URL } from 'url';
import archiver from 'archiver';
import { v4 } from 'uuid';
import rimraf from 'rimraf';

import { EpubOptions, IPubOptions, isEmpty, isString, IImage, allowedAttributes, allowedXhtml11Tags, toId } from './helpers';

class EPub {
  options: EpubOptions;
  name: string;
  id: string;
  uuid: string;

  constructor(options: IPubOptions, output: string) {
    if (!output) {
      console.error(new Error('No Output Path'));
      throw new Error('No output path');
    }

    this.options = {
      description: options.title,
      publisher: 'anonymous',
      author: ['anonymous'],
      tocTitle: 'Table Of Contents',
      appendChapterTitles: true,
      date: new Date().toISOString(),
      lang: 'en',
      fonts: [],
      customOpfTemplatePath: null,
      customNcxTocTemplatePath: null,
      customHtmlTocTemplatePath: null,
      version: 3,
      output,
      ...options
    };

    if (!options.title || !options.content) {
      console.error(new Error('Title and content are both required'));
      throw new Error('Title and content are both required');
    }

    if (this.options.version === 2) {
      this.options.docHeader = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${this.options.lang}">\
`;
    } else {
      this.options.docHeader = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${this.options.lang}">\
`;
    }

    if (isEmpty(this.options.author)) {
      this.options.author = ['anonymous'];
    }
    if (isString(this.options.author)) {
      this.options.author = [this.options.author];
    }
    if (!this.options.tempDir) {
      this.options.tempDir = path.resolve(__dirname, '../tempDir/');
    }
    this.id = v4();
    this.uuid = path.resolve(this.options.tempDir, this.id);
    this.options.uuid = this.uuid;
    this.options.id = this.id;
    this.options.images = [];
    this.options.content = this.options.content.map((content, index) => {
      if (!content.filename) {
        const normalizedTitle = removeDiacritics(content.title || 'no title');
        const titleSlug = toId(normalizedTitle);
        content.href = `${index}_${titleSlug}.xhtml`;
        content.filePath = path.resolve(
          this.uuid,
          `./OEBPS/${index}_${titleSlug}.xhtml`
        );
      } else {
        content.href = content.filename.match(/\.xhtml$/)
          ? content.filename
          : `${content.filename}.xhtml`;
        if (content.filename.match(/\.xhtml$/)) {
          content.filePath = path.resolve(
            this.uuid,
            `./OEBPS/${content.filename}`
          );
        } else {
          content.filePath = path.resolve(
            this.uuid,
            `./OEBPS/${content.filename}.xhtml`
          );
        }
      }

      content.id = `item_${index}`;
      content.dir = path.dirname(content.filePath);
      if (!content.excludeFromToc) {
        content.excludeFromToc = false;
      }
      if (!content.beforeToc) {
        content.beforeToc = false;
      }

      //fix Author Array
      content.author =
        content.author && isString(content.author)
          ? [content.author]
          : !content.author || !Array.isArray(content.author)
            ? []
            : content.author;




      let $ = cheerio.load(content.data, {
        lowerCaseTags: true,
        recognizeSelfClosing: true,
      });

      // Only body innerHTML is allowed
      if ($('body').length) {
        $ = cheerio.load($('body').html(), {
          lowerCaseTags: true,
          recognizeSelfClosing: true,
        });
      }
      $($('*').get().reverse()).each((elemIndex, elem) => {
        const attrs = elem.attribs;
        if (['img', 'br', 'hr'].includes(this.name)) {
          if (this.name === 'img') {
            $(this).attr('alt', $(this).attr('alt') || 'image-placeholder');
          }
        }

        for (let k in attrs) {
          const v = attrs[k];
          if (allowedAttributes.includes(k)) {
            if (k === 'type') {
              if (this.name !== 'script') {
                $(this).removeAttr(k);
              }
            }
          } else {
            $(this).removeAttr(k);
          }
        }
        if (this.options.version === 2) {
          if (allowedXhtml11Tags.includes(this.name)) {
          } else {
            if (this.options.verbose) {
              console.log(
                'Warning (content[' + index + ']):',
                this.name,
                'tag isn\'t allowed on EPUB 2/XHTML 1.1 DTD.'
              );
            }
            const child = $(this).html();
            return $(this).replaceWith($('<div>' + child + '</div>'));
          }
        }
      });

      $('img').each((index, elem) => {
        let extension, id, image;
        const url = $(elem).attr('src');
        if ((image = this.options.images.find((element) => element.url === url))) {
          ({ id } = image);
          ({ extension } = image);
        } else {
          id = v4();
          const mediaType = mime.getType(url.replace(/\?.*/, ''));
          extension = mime.getExtension(mediaType);
          const { dir } = content;
          this.options.images.push({ id, url, dir, mediaType, extension });
        }
        return $(elem).attr('src', `images/${id}.${extension}`);
      });
      content.data = $.xml();
      return content;
    });

    if (this.options.cover) {
      this.options._coverMediaType = mime.getType(this.options.cover);
      this.options._coverExtension = mime.getExtension(
        this.options._coverMediaType
      );
    }

  }

  public get promise() {
    return this.render();
  }

  async render(): Promise<void> {
    if (this.options.verbose) {
      console.log('Generating Template Files.....');
    }
    try {
      await this.generateTempFile();
      if (this.options.verbose) {
        console.log('Downloading Images...');
      }
      this.downloadAllImage();
      if (this.options.verbose) {
        console.log('Making Cover...');
      }
      await this.makeCover();
      if (this.options.verbose) {
        console.log('Generating Epub Files...');
      }
      let _res = await this.genEpub();
      if (this.options.verbose) {
        console.log('About to finish...');
      }
      if (this.options.verbose) {
        return console.log('Done.');
      }
      return _res;
    }
    catch (err) {
      throw new Error(err);
    }
  }

  async generateTempFile(): Promise<void> {
    try {
      if (!fs.existsSync(this.options.tempDir)) {
        fs.mkdirSync(this.options.tempDir);
      }
      fs.mkdirSync(this.uuid);
      fs.mkdirSync(path.resolve(this.uuid, './OEBPS'));
      if (!this.options.css) {
        this.options.css = fs.readFileSync(path.resolve(__dirname, '../templates2/template.css'), { encoding: 'utf-8' });
      }
      fs.writeFileSync(path.resolve(this.uuid, './OEBPS/style.css'), this.options.css);
      if (this.options.fonts.length) {
        fs.mkdirSync(path.resolve(this.uuid, './OEBPS/fonts'));
        this.options.fonts = this.options.fonts.map((font) => {
          if (!fs.existsSync(font)) {
            throw new Error('Custom font not found at ' + font + '.');
            return;
          }
          const filename = path.basename(font);
          fs.copyFileSync(font, path.resolve(this.uuid, './OEBPS/fonts/' + filename));
          return filename;
        });
      }
      this.options.content.forEach((content) => {
        let dataHead = `${this.options.docHeader}
        <head>
        <meta charset="UTF-8" />
        <title>${entities.encodeXML(content.title || '')}</title>
        <link rel="stylesheet" type="text/css" href="style.css" />
        </head>
        <body>\
`;
        let cTitle =
          content.title && this.options.appendChapterTitles
            ? `<h1>${entities.encodeXML(content.title)}</h1>`
            : "";
        let cAuthor =
          content.title && content.author && content.author.length
            ? `<p class='epub-author'>${entities.encodeXML(
              Array.isArray(content.author) ? content.author.join(", ") : content.author
            )}</p>`
            : "";
        let cUrl =
          content.title && content.url
            ? `<p class='epub-link'><a href='${content.url}'>${content.url}</a></p>`
            : "";
        let data = [dataHead, cTitle, cAuthor, cUrl, `${content.data}</body></html>`].join('');
        return fs.writeFileSync(content.filePath, data);
      });

      // write meta-inf/container.xml
      fs.mkdirSync(this.uuid + '/META-INF');
      fs.writeFileSync(
        `${this.uuid}/META-INF/container.xml`,
        '<?xml version="1.0" encoding="UTF-8" ?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
      );

      if (this.options.version === 2) {
        // write meta-inf/com.apple.ibooks.display-options.xml [from pedrosanta:xhtml#6]
        fs.writeFileSync(
          `${this.uuid}/META-INF/com.apple.ibooks.display-options.xml`,
          `\
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<display_options>
  <platform name="*">
    <option name="specified-fonts">true</option>
  </platform>
</display_options>\
`
        );
      }

      const opfPathTs = path.resolve(
        __dirname,
        `../templates2/epub${this.options.version}/content.opf.ts`
      );
      if (!fs.existsSync(opfPathTs)) {
        throw new Error('Custom file to OPF template not found.');
      }

      const ncxTocPathTs = path.resolve(__dirname, '../templates2/toc.ncx.ts');
      if (!fs.existsSync(ncxTocPathTs)) {
        throw new Error('Custom file the NCX toc template not found.');
      }

      const htmlTocPathTs = path.resolve(
        __dirname,
        `../templates2/epub${this.options.version}/toc.xhtml.ts`
      );
      if (!fs.existsSync(htmlTocPathTs)) {
        throw new Error('Custom file to HTML toc template not found.');
      }
      return await Promise.all([
        new Promise(resolve => import(opfPathTs).then(m => resolve(m.createContentOpfStr(this.options)))),
        new Promise(resolve => import(ncxTocPathTs).then(m => resolve(m.createTocStr(this.options)))),
        new Promise(resolve => import(htmlTocPathTs).then(m => resolve(m.createTocXhtmlStr(this.options)))),
      ]).then(([data1, data2, data3]) => {
        fs.writeFileSync(path.resolve(this.uuid, './OEBPS/content.opf'), data1);
        fs.writeFileSync(path.resolve(this.uuid, './OEBPS/toc.ncx'), data2);
        fs.writeFileSync(path.resolve(this.uuid, './OEBPS/toc.xhtml'), data3);
        return void 0;
      });

    } catch (e) {
      console.error(e);
      throw new Error(e);
    }
  }

  makeCover(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.options.cover) {
        const destPath = path.resolve(
          this.uuid,
          './OEBPS/cover.' + this.options._coverExtension
        );
        let writeStream = null;
        //NOTE: Excluded http protocol implementation (to grab http based cover)
        let resolvedCover = path.resolve(this.options.cover);
        writeStream = fs.createReadStream(resolvedCover);
        writeStream.pipe(fs.createWriteStream(destPath));


        writeStream.on('end', () => {
          if (this.options.verbose) {
            console.log('[Success] cover image downloaded successfully!');
          }
          return resolve();
        });
        writeStream.on('error', (err) => {
          console.error('Error', err);
          return reject(err);
        });
      } else {
        resolve();
      }
    });
  }

  getImage(options: IImage): IImage | null {
    if (!options.url && typeof options !== 'string') {
      console.warn('No {Options.url} provided ..');
      return null;
    }
    const filename = path.resolve(
      this.uuid,
      './OEBPS/images/' + options.id + '.' + options.extension
    );
    let url = new URL(options.url);
    if (url.protocol !== 'file:') {
      throw new Error(`Support only "file:" protocol for assets::  ${options.url}`);
    }
    // if (options.url.indexOf('file://') === 0) {
    let { hostname, pathname } = url;
    // let auxpath = options.url.substr(7);
    const auxpath = path.resolve(path.join(hostname, pathname));
    if (!fs.existsSync(auxpath)) {
      console.error('NO SUCH Image FILE:  ', auxpath);
    }
    fs.copyFileSync(auxpath, filename);
    return options;
  }

  downloadAllImage(): unknown {
    try {
      if (!this.options.images?.length) {
        return;
      } else {
        fs.mkdirSync(path.resolve(this.uuid, './OEBPS/images'));
        const deferArray = [];
        this.options.images.forEach((image) =>
          deferArray.push(this.getImage(image))
        );
        return deferArray;
      }
    } catch (e) {
      console.error(e);
      throw new Error(e);
    }
  }

  genEpub(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cwd = this.uuid;

      const archive = archiver('zip', { zlib: { level: 9 } });
      const output = fs.createWriteStream(this.options.output);
      if (this.options.verbose) {
        console.log('Zipping temp dir to', this.options.output);
      }
      archive.append('application/epub+zip', { store: true, name: 'mimetype' });
      archive.directory(cwd + '/META-INF', 'META-INF');
      archive.directory(cwd + '/OEBPS', 'OEBPS');
      archive.pipe(output);
      archive.on('end', () => {
        if (this.options.verbose) {
          console.log('Done zipping, clearing temp dir...');
        }
        return rimraf(cwd, (err) => {
          if (err) {
            return reject(err);
          } else {
            return resolve();
          }
        });
      });
      archive.on('error', (err) => reject(err));
      return archive.finalize();
    });
  }
}

module.exports = EPub;
