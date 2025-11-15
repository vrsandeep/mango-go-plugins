# Contributing Plugins to Mango-Go

Thank you for contributing a plugin! This guide will help you create a plugin that follows best practices.

## Plugin Development Guide

### Prerequisites

- Basic JavaScript knowledge
- Understanding of HTTP requests and JSON APIs
- Familiarity with the source website you're creating a plugin for

### Creating a Plugin

1. **Copy the Template**
   ```bash
   cp -r template my-plugin-name
   cd my-plugin-name
   ```

2. **Edit `plugin.json`**
   - Set unique `id` (lowercase, alphanumeric, hyphens)
   - Set `name` and `description`
   - Define any configuration options in `config` section

3. **Implement `index.js`**
   - Implement all required exports (see API Reference)
   - Use dependency injection pattern (mango API passed as parameter)
   - Add error handling
   - Add logging for debugging

4. **Test Your Plugin**
   - Write unit tests (Node.js built-in test runner, Jest, or Vitest)
   - Test with mock mango API (see template example)
   - Verify all functions work correctly
   - Run tests with `npm test` or `node --test index.test.js`

5. **Documentation**
   - Create README.md with usage instructions
   - Document any API quirks or special handling
   - Include example search queries if helpful

6. **Submit Your Plugin**
   - Create a pull request to this repository
   - Ensure code is clean and well-documented
   - Include unit tests (strongly recommended)

## Plugin Structure

Each plugin is a directory containing:

```
plugin-name/
├── plugin.json    # Plugin manifest (required)
├── index.js       # Plugin code (required)
├── package.json   # Node.js package metadata (optional)
├── index.test.js  # Unit tests (optional, recommended)
├── *.test.js      # Additional test files (optional)
└── README.md      # Plugin documentation (optional)
```

See the [template](./template/) directory for a complete example.
See the [webtoons](./webtoons/) plugin for a complete example with all files.

## Plugin API Reference

### Required Exports

#### Plugin Metadata

Plugin metadata is provided by `plugin.json` and `repository.json`.

**plugin.json** should contain:
- `id` (required)
- `api_version` (required)
- `entry_point` (optional, defaults to "index.js")
- `config` (optional, plugin-specific configuration)

All other metadata (name, version, description, author, license, plugin_type, capabilities) should be set in `repository.json`.

#### `search(query, mango)`
Search for series/manga.

**Parameters:**
- `query` (string) - Search query
- `mango` (object) - Mango API object

**Returns:** Array of `SearchResult` objects

```javascript
exports.search = async (query, mango) => {
  const response = await mango.http.get(`https://api.example.com/search?q=${query}`);
  return response.data.results.map(item => ({
    title: item.title,
    cover_url: item.coverUrl,
    identifier: item.id
  }));
};
```

#### `getChapters(seriesId, mango)`
Get list of chapters for a series.

**Parameters:**
- `seriesId` (string) - Series identifier from search result
- `mango` (object) - Mango API object

**Returns:** Array of `ChapterResult` objects

```javascript
exports.getChapters = async (seriesId, mango) => {
  const response = await mango.http.get(`https://api.example.com/series/${seriesId}/chapters`);
  return response.data.chapters.map(ch => ({
    identifier: ch.id,
    title: ch.title || `Chapter ${ch.number}`,
    volume: ch.volume || "",
    chapter: ch.number || "0",
    pages: ch.pageCount || 0,
    language: ch.language || "en",
    group_id: "",  // Optional: translation group
    published_at: ch.publishedAt || new Date().toISOString()
  }));
};
```

**Note:** If the API supports pagination (cursor-based or page-based), handle it to fetch all chapters:

```javascript
exports.getChapters = async (seriesId, mango) => {
  const allChapters = [];
  let cursor = null;

  do {
    const url = cursor
      ? `https://api.example.com/series/${seriesId}/chapters?cursor=${cursor}`
      : `https://api.example.com/series/${seriesId}/chapters`;

    const response = await mango.http.get(url);
    const chapters = response.data.chapters || response.data.result.chapters;
    allChapters.push(...chapters);
    cursor = response.data.nextCursor || null;
  } while (cursor !== null);

  return allChapters.map(ch => ({ /* ... */ }));
};
```

#### `getPageURLs(chapterId, mango)`
Get URLs for all pages in a chapter.

**Parameters:**
- `chapterId` (string) - Chapter identifier from getChapters result (must be parseable)
- `mango` (object) - Mango API object

**Returns:** Array of image URLs (strings)

**Note:** The `chapterId` you return from `getChapters` will be passed to this function. Design it to contain all information needed to fetch the chapter pages. Common patterns:
- `id{seriesId}ch{chapterId}` - Simple format
- `id{seriesId}viewerLink{viewerLink}chNum{num}` - When viewer URL is needed (see webtoons plugin)
- Include any necessary parameters (episode number, slug, etc.) in a parseable format

```javascript
exports.getPageURLs = async (chapterId, mango) => {
  const response = await mango.http.get(`https://api.example.com/chapters/${chapterId}/pages`);
  return response.data.pages.map(page => page.imageUrl);
};
```

### Mango API Object

The `mango` object provides:

```javascript
mango = {
  // HTTP client
  http: {
    async get(url, options?) => Promise<Response>
    async post(url, body?, options?) => Promise<Response>
  },

  // Logging
  log: {
    info(message, ...args)
    warn(message, ...args)
    error(message, ...args)
    debug(message, ...args)
  },

  // Plugin configuration
  config: {
    [key: string]: any  // Values from plugin.json config section
  },

  // Utilities
  utils: {
    sanitizeFilename(name) => string
    parseHTML(html) => Document  // Simplified goquery API
  }
}
```

### HTTP Response Format

```javascript
{
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  data: { /* parsed JSON */ },
  text: () => string  // Raw response text
}
```

## Testing

### Unit Testing

Create test files using Node.js built-in test runner, Jest, Vitest, or similar. The template includes an example using Node.js built-in test runner:

```javascript
// index.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const plugin = require('./index.js');

// Create a mock mango API
const createMockMango = (overrides = {}) => ({
  http: {
    get: async () => { throw new Error('http.get not mocked'); },
    post: async () => { throw new Error('http.post not mocked'); },
    ...overrides.http
  },
  log: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    ...overrides.log
  },
  config: { ...overrides.config },
  state: {
    get: () => undefined,
    set: () => {},
    getAll: () => ({}),
    clear: () => {},
    ...overrides.state
  },
  utils: {
    sanitizeFilename: (name) => name.replace(/[^a-zA-Z0-9.-]/g, '_'),
    ...overrides.utils
  }
});

describe('My Plugin', () => {

  test('search works correctly', async () => {
    const mockMango = createMockMango({
      http: {
        get: async () => ({
          status: 200,
          statusText: 'OK',
          data: { results: [{ id: '1', title: 'Test', coverUrl: 'cover.jpg' }] }
        })
      }
    });

    const results = await plugin.search('test', mockMango);
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 1);
  });
});
```

Run tests with:
```bash
npm test
# or
node --test index.test.js
```

See the [webtoons plugin tests](./webtoons/index.test.js) for a complete example.

### Best Practices

1. **Dependency Injection**: Always accept `mango` as a parameter, never use global variables
2. **Error Handling**: Wrap API calls in try-catch, throw meaningful errors with context
3. **Logging**: Use `mango.log` for debugging information (info, warn, error, debug)
4. **Input Validation**: Validate inputs before making API calls
5. **Rate Limiting**: Be respectful - add delays if needed, handle rate limit responses gracefully
6. **Pagination**: Handle pagination properly to fetch all chapters/episodes
7. **Documentation**: Comment complex logic, document API quirks in README
8. **Testing**: Write unit tests for all exported functions
9. **URL Handling**: Support both relative and absolute URLs, handle redirects properly
10. **Error Messages**: Provide helpful error messages for debugging

### Common Patterns

**HTML Parsing (if parseHTML available):**
```javascript
const response = await mango.http.get(url);
const html = response.text();
// Option 1: Use parseHTML if available
if (mango.utils.parseHTML) {
  const doc = mango.utils.parseHTML(html);
  const titles = doc.find('.title').map(el => el.text());
} else {
  // Option 2: Use regex for simple parsing (Phase 1)
  const titleMatch = html.match(/<h1[^>]*>([^<]+)</);
  const title = titleMatch ? titleMatch[1].trim() : '';
}
```

**HTML Parsing with Regex (Fallback):**
```javascript
// Extract content from specific div
const response = await mango.http.get(url);
const html = response.text();

// Extract div by ID
const divMatch = html.match(/<div[^>]*id=["']myDiv["'][^>]*>([\s\S]*?)<\/div>/i);
if (divMatch) {
  const divContent = divMatch[1];
  // Extract data from divContent using regex
  const dataUrlRegex = /data-url=["']([^"']+)["']/gi;
  const urls = [];
  let match;
  while ((match = dataUrlRegex.exec(divContent)) !== null) {
    urls.push(match[1]);
  }
}
```

**Error Handling:**
```javascript
exports.search = async (query, mango) => {
  try {
    const response = await mango.http.get(`...`);
    if (response.status !== 200) {
      throw new Error(`API returned ${response.status}`);
    }
    return parseResults(response.data);
  } catch (error) {
    mango.log.error('Search failed:', error);
    throw new Error(`Failed to search: ${error.message}`);
  }
};
```

**Configuration:**
```javascript
// plugin.json
{
  "config": {
    "base_url": {
      "type": "string",
      "default": "https://api.example.com"
    }
  }
}

// index.js
exports.search = async (query, mango) => {
  const baseUrl = mango.config.base_url;
  const response = await mango.http.get(`${baseUrl}/search?q=${query}`);
  // ...
};
```

## Submission Guidelines

1. **Code Quality**
   - Clean, readable code
   - Proper error handling
   - Meaningful variable names
   - Comments for complex logic

2. **Documentation**
   - README.md with usage instructions
   - Description of any special configuration
   - Known limitations or quirks

3. **Testing**
   - Unit tests (if possible)
   - Tested with real API (verify it works)

4. **License**
   - Include license file or specify in plugin.json
   - MIT, Apache 2.0, or compatible license preferred

5. **Naming**
   - Plugin ID should be descriptive and unique
   - Directory name should match plugin ID

## Plugin Review Process

1. Pull request is created
2. Code review for quality and security
3. Testing verification
4. Merge if approved
5. Plugin becomes available to community

## Examples

Check out the existing plugins for reference:

- **[Webtoons Plugin](./webtoons/)** - Complete example with:
  - API-based chapter fetching with pagination
  - HTML parsing for image extraction
  - Comprehensive unit tests
  - Full documentation

- **[Template Plugin](./template/)** - Minimal starting template

## Questions?

- Open an issue in this repository
- Check existing plugins for examples
- Review the [template](./template/) directory for a starter template

## License

By contributing, you agree that your plugin will be made available under an open source license (MIT recommended).

