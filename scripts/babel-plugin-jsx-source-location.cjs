/**
 * Babel plugin to inject data-source attribute into JSX elements
 * This helps AI agents locate source code from DOM elements
 *
 * Only injects into native HTML/SVG elements to avoid conflicts with
 * libraries like React Three Fiber that use custom JSX elements.
 */
module.exports = function babelPluginJsxSourceLocation({ types: t }) {
  // HTML tags (from html-tags package)
  const HTML_TAGS = new Set([
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
    'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
    'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
    'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
    'em', 'embed',
    'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
    'i', 'iframe', 'img', 'input', 'ins',
    'kbd',
    'label', 'legend', 'li', 'link',
    'main', 'map', 'mark', 'math', 'menu', 'menuitem', 'meta', 'meter',
    'nav', 'noscript',
    'object', 'ol', 'optgroup', 'option', 'output',
    'p', 'param', 'picture', 'pre', 'progress',
    'q',
    'rb', 'rp', 'rt', 'rtc', 'ruby',
    's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
    'u', 'ul',
    'var', 'video',
    'wbr',
  ]);

  // SVG tags (from svg-tag-names package)
  const SVG_TAGS = new Set([
    'svg',
    'a', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate', 'animateColor', 'animateMotion', 'animateTransform',
    'circle', 'clipPath', 'color-profile', 'cursor',
    'defs', 'desc',
    'ellipse',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
    'filter', 'font', 'font-face', 'font-face-format', 'font-face-name', 'font-face-src', 'font-face-uri', 'foreignObject',
    'g', 'glyph', 'glyphRef',
    'hkern',
    'image',
    'line', 'linearGradient',
    'marker', 'mask', 'metadata', 'missing-glyph', 'mpath',
    'path', 'pattern', 'polygon', 'polyline',
    'radialGradient', 'rect',
    'set', 'stop', 'switch', 'symbol',
    'text', 'textPath', 'tref', 'tspan',
    'use',
    'view', 'vkern',
  ]);

  // Combined native tags
  const NATIVE_TAGS = new Set([...HTML_TAGS, ...SVG_TAGS]);

  // Skip files from node_modules
  const shouldSkipFile = (filename) => {
    if (!filename) return true;
    return filename.includes('node_modules');
  };

  // Get relative path from project root
  const getRelativePath = (filename, cwd) => {
    if (!filename || !cwd) return filename;
    if (filename.startsWith(cwd)) {
      return filename.slice(cwd.length + 1); // +1 for the trailing slash
    }
    return filename;
  };

  // Check if element already has data-source attribute
  const hasDataSourceAttr = (attributes) => {
    return attributes.some(
      (attr) =>
        t.isJSXAttribute(attr) &&
        t.isJSXIdentifier(attr.name, { name: 'data-source' })
    );
  };

  // Skip Fragment, other special elements, and non-native elements
  const shouldSkipElement = (name) => {
    // Skip member expressions like React.Fragment, Foo.Bar
    if (t.isJSXMemberExpression(name)) {
      return true;
    }

    if (t.isJSXIdentifier(name)) {
      const tagName = name.name;

      // Skip React built-in components
      const skipList = ['Fragment', 'Suspense', 'StrictMode'];
      if (skipList.includes(tagName)) {
        return true;
      }

      // Only process native HTML/SVG elements
      // Skip custom elements (React components, R3F elements like mesh/boxGeometry, etc.)
      if (!NATIVE_TAGS.has(tagName)) {
        return true;
      }
    }

    return false;
  };

  return {
    name: 'jsx-source-location',
    visitor: {
      JSXOpeningElement(path, state) {
        const { filename } = state;

        // Skip node_modules
        if (shouldSkipFile(filename)) {
          return;
        }

        // Skip Fragment etc
        if (shouldSkipElement(path.node.name)) {
          return;
        }

        // Skip if already has data-source
        if (hasDataSourceAttr(path.node.attributes)) {
          return;
        }

        // Get location info
        const { line, column } = path.node.loc?.start || {};
        if (!line) {
          return;
        }

        // Get relative path
        const cwd = state.cwd || process.cwd();
        const relativePath = getRelativePath(filename, cwd);

        // Create data-source attribute: "src/pages/Home.tsx:42:8"
        // Format: {filePath}:{line}:{column}
        const col = column !== undefined ? column + 1 : 1; // Convert 0-based to 1-based
        const sourceValue = `${relativePath}:${line}:${col}`;
        const dataSourceAttr = t.jsxAttribute(
          t.jsxIdentifier('data-source'),
          t.stringLiteral(sourceValue)
        );

        // Add to element attributes
        path.node.attributes.push(dataSourceAttr);
      },
    },
  };
};
