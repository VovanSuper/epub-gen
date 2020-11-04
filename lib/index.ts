import path from 'path';
import fs from 'fs';
import ejs from 'ejs';
import cheerio from 'cheerio';
import entities from 'entities';
import request from 'superagent';
require('superagent-proxy')(request);
import { normalizeSync as removeDiacritics } from 'normalize-diacritics';
import mime from 'mime';
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
    this.options = options;

    if (output) {
      this.options.output = output;
    }

    if (!this.options.output) {
      console.error(new Error('No Output Path'));
      throw new Error('No output path');
    }

    if (!options.title || !options.content) {
      console.error(new Error('Title and content are both required'));
      throw new Error('Title and content are both required');
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
      ...options
    };

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

    if (isString(this.options.author)) {
      this.options.author = [this.options.author];
    }
    if (isEmpty(this.options.author)) {
      this.options.author = ['anonymous'];
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

  render(): Promise<void> {
    if (this.options.verbose) {
      console.log('Generating Template Files.....');
    }
    return new Promise(async (resolve, reject) => {
      try {
        await this.generateTempFile();
        if (this.options.verbose) {
          console.log('Downloading Images...');
        }
        await this.downloadAllImage();
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
        resolve(_res);
        if (this.options.verbose) {
          return console.log('Done.');
        }
      }
      catch (err) {
        reject(err);
      }
    });
  }

  generateTempFile(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.options.tempDir)) {
        fs.mkdirSync(this.options.tempDir);
      }
      fs.mkdirSync(this.uuid);
      fs.mkdirSync(path.resolve(this.uuid, './OEBPS'));
      if (!this.options.css) {
        this.options.css = fs.readFileSync(path.resolve(__dirname, '../templates/template.css'), { encoding: 'utf-8' });
      }
      fs.writeFileSync(path.resolve(this.uuid, './OEBPS/style.css'), this.options.css);
      if (this.options.fonts.length) {
        fs.mkdirSync(path.resolve(this.uuid, './OEBPS/fonts'));
        this.options.fonts = this.options.fonts.map((font) => {
          if (!fs.existsSync(font)) {
            reject(new Error('Custom font not found at ' + font + '.'));
            return;
          }
          const filename = path.basename(font);
          fs.copyFileSync(font, path.resolve(this.uuid, './OEBPS/fonts/' + filename));
          return filename;
        });
      }
      this.options.content.forEach((content) => {
        let data = `${this.options.docHeader}
        <head>
        <meta charset="UTF-8" />
        <title>${entities.encodeXML(content.title || '')}</title>
        <link rel="stylesheet" type="text/css" href="style.css" />
        </head>
        <body>\
`;
        data +=
          content.title && this.options.appendChapterTitles
            ? `<h1>${entities.encodeXML(content.title)}</h1>`
            : "";
        data +=
          content.title && content.author && content.author.length
            ? `<p class='epub-author'>${entities.encodeXML(
              content.author.join(", ")
            )}</p>`
            : "";
        data +=
          content.title && content.url
            ? `<p class='epub-link'><a href='${content.url}'>${content.url}</a></p>`
            : "";
        data += `${content.data}</body></html>`;
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

      const opfPath =
        this.options.customOpfTemplatePath ||
        path.resolve(
          __dirname,
          `../templates/epub${this.options.version}/content.opf.ejs`
        );
      if (!fs.existsSync(opfPath)) {
        return reject(new Error('Custom file to OPF template not found.'));
      }

      const ncxTocPath =
        this.options.customNcxTocTemplatePath ||
        path.resolve(__dirname, '../templates/toc.ncx.ejs');
      if (!fs.existsSync(ncxTocPath)) {
        return reject(new Error('Custom file the NCX toc template not found.'));
      }

      const htmlTocPath =
        this.options.customHtmlTocTemplatePath ||
        path.resolve(
          __dirname,
          `../templates/epub${this.options.version}/toc.xhtml.ejs`
        );
      if (!fs.existsSync(htmlTocPath)) {
        return reject(new Error('Custom file to HTML toc template not found.'));
      }
      return Promise.all([
        new Promise(resolve => (ejs.renderFile(opfPath, this.options, (e, str) => resolve(str)))),
        new Promise(resolve => (ejs.renderFile(ncxTocPath, this.options, (e, str) => resolve(str)))),
        new Promise(resolve => (ejs.renderFile(htmlTocPath, this.options, (e, str) => resolve(str))))
      ]).then(([data1, data2, data3]) => {
        fs.writeFileSync(path.resolve(this.uuid, './OEBPS/content.opf'), data1);
        fs.writeFileSync(path.resolve(this.uuid, './OEBPS/toc.ncx'), data2);
        fs.writeFileSync(path.resolve(this.uuid, './OEBPS/toc.xhtml'), data3);
        return resolve();
      },
        (err) => {
          console.error(err);
          return reject(err);
        }
      );
    });
  }

  makeCover(): Promise<void> {
    return new Promise((resolve, reject) => {
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36';
      if (this.options.cover) {
        const destPath = path.resolve(
          this.uuid,
          './OEBPS/cover.' + this.options._coverExtension
        );
        let writeStream = null;
        //TODO: To be excluded (But how to grab http based images)?
        if (this.options.cover.slice(0, 4) === 'http') {
          writeStream = request
            .get(this.options.cover)
            .set({ 'User-Agent': userAgent });
          writeStream.pipe(fs.createWriteStream(destPath));
        } else {
          writeStream = fs.createReadStream(this.options.cover);
          writeStream.pipe(fs.createWriteStream(destPath));
        }

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

  getImage(options: IImage): Promise<IImage | null> {
    //{id, url, mediaType}
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36';
    if (!options.url && typeof options !== 'string') {
      console.warn('No {Options.url} provided ..');
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const filename = path.resolve(
        this.uuid,
        './OEBPS/images/' + options.id + '.' + options.extension
      );
      if (options.url.indexOf('file://') === 0) {
        const auxpath = options.url.substr(7);
        fs.copyFileSync(auxpath, filename);
        return resolve(options);
      } else {
        let requestAction;
        //TODO: To be excluded (But how to grab http based images)?
        if (options.url.indexOf('http') === 0) {
          requestAction = request.get(options.url).set({
            'User-Agent': userAgent
          });
          requestAction.pipe(fs.createWriteStream(filename));
        } else {
          requestAction = fs.createReadStream(path.resolve(options.dir, options.url));
          requestAction.pipe(fs.createWriteStream(filename));
        }
        requestAction.on('error', (err) => {
          if (this.options.verbose) {
            console.error(
              '[Download Error]',
              'Error while downloading',
              options.url,
              err
            );
          }
          fs.unlinkSync(filename);
          return reject(err);
        });

        requestAction.on('end', () => {
          if (this.options.verbose) {
            console.log('[Download Success]', options.url);
          }
          return resolve(options);
        });
      }
    });
  }

  downloadAllImage(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.options.images?.length) {
        resolve();
      } else {
        fs.mkdirSync(path.resolve(this.uuid, './OEBPS/images'));
        const deferArray: Array<Promise<unknown>> = [];
        this.options.images.forEach((image) =>
          deferArray.push(this.getImage(image))
        );
        Promise.all(deferArray).then(() => resolve());
      }
    });
  }

  genEpub(): Promise<void> {
    // Thanks to Paul Bradley
    // http://www.bradleymedia.org/gzip-markdown-epub/ (404 as of 28.07.2016)
    // Web Archive URL:
    // http://web.archive.org/web/20150521053611/http://www.bradleymedia.org/gzip-markdown-epub
    // or Gist:
    // https://gist.github.com/cyrilis/8d48eef37fbc108869ac32eb3ef97bca

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
