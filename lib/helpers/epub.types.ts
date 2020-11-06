interface IPubOptions {
  /**
   * @param {string} title - Title of the book
   */
  title?: string;
  /**
   * @param {(string | Array<string>)} author - Name of the author for the book, string or array, eg. "Alice" or ["Alice", "Bob"]
   */
  author?: string | string[];
  /**
   * @param {string} publisher - Publisher name (optional)
   */
  publisher?: string;
  /**
   * @param {string} cover - Book cover image (optional), File path (absolute path) or web url, eg. "http://abc.com/book-cover.jpg" or "/User/Alice/images/book-cover.jpg"
   */
  cover?: string;
  /**
   * @param {string} output - Out put path (absolute path), you can also path output as the second argument when use new , eg: new Epub(options, output)
   */
  output: string;
  /**
   * @param {number} [version="3"] - You can specify the version of the generated EPUB, 
   * 3 the latest version (http://idpf.org/epub/30) or 2 the previous version (http://idpf.org/epub/201, for better compatibility with older readers).
   *  If not specified, will fallback to 3.
   */
  version?: 2 | 3;
  /**
   * @param {number} css - If you really hate our css, you can pass css string to replace our default style. eg: "body{background: #000}"
   */
  css: string;
  /**
   * @param {(string | Array<string>)} fonts - Array of (absolute) paths to custom fonts to include on the book so they can be used on custom css. Ex: if you configure the array to fonts: ['/path/to/Merriweather.ttf'] you can use the following on the custom CSS:

      @font-face {
          font-family: "Merriweather";
          font-style: normal;
          font-weight: normal;
          src : url("./fonts/Merriweather.ttf");
      }
   */
  fonts?: string[];
  /**
   * @param {string} [lang="en"] - Language of the book in 2 letters code (optional). If not specified, will fallback to en.
   */
  lang?: string;
  /**
   * @param {string} tocTitle - Title of the table of contents. If not specified, will fallback to Table Of Contents.
   */
  tocTitle?: string;
  /**
   * @param {boolean} appendChapterTitles - Automatically append the chapter title at the beginning of each contents. You can disable that by specifying false.
   */
  appendChapterTitles?: boolean;
  /**
   * @optional
   * @param {string} customOpfTemplatePath - Optional. For advanced customizations: absolute path to an OPF template.
   */
  customOpfTemplatePath?: string | null;
  /**
   * @optional
   * @param {string} customNcxTocTemplatePath -  Optional. For advanced customizations: absolute path to a NCX toc template.
   */
  customNcxTocTemplatePath?: string | null;
  /**
   * @optional
   * @param {string} customHtmlTocTemplatePath -  Optional. For advanced customizations: absolute path to a NCX toc template.
   */
  customHtmlTocTemplatePath?: string | null;
  /**
   * @optional
   * @param {Array<object>} content -  Book Chapters content. It's should be an array of objects. eg. [{title: "Chapter 1",data: "<div>..."}, {data: ""},...]
   */
  content?: Array<{
    title: string,
    data: string;
    filename?: string;
    filePath?: string;
    href?: string;
    id?: string;
    dir?: string;
    excludeFromToc?: boolean;
    beforeToc?: boolean;
    author?: string | string[];
    css?: string;
    url?: string;
  }>;
  /**
   * @param {string} description
   */
  description?: string;
  /**
   * @param {string | Date} date
   */
  date?: string;
}

interface IOptsInternal {
  id: string;
  uuid?: string;
  images?: Array<IImage>;
  docHeader?: string;
  tempDir: string | undefined;
  verbose: boolean;
  _coverMediaType: string | null;
  _coverExtension: string | null;
}

interface IImage {
  id?: string;
  url?: string;
  dir?: string;
  mediaType?: string;
  extension: string;
}

type EpubOptions = IPubOptions & Partial<IOptsInternal>;

export { IOptsInternal, IPubOptions, EpubOptions, IImage };