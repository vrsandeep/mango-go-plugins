/**
 * Unit tests for WeebCentral plugin
 *
 * Run with: npm test (requires Node.js 18+)
 * Or: node --test index.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Load the plugin
const plugin = require('./index.js');

// Mock mango API object
const createMockMango = (overrides = {}) => {
  // Mock document object for HTML parsing
  const createMockElement = (tagName, attributes = {}, children = []) => {
    return {
      tagName: tagName,
      getAttribute: (name) => attributes[name] || null,
      textContent: children.map(c => c.textContent || '').join(''),
      querySelector: (selector) => {
        // Simple mock selector - just return first child if it matches
        for (const child of children) {
          if (child.tagName === selector.replace('.', '').replace('#', '')) {
            return child;
          }
        }
        return null;
      },
      querySelectorAll: (selector) => {
        // Return all matching children
        const matches = [];
        for (const child of children) {
          if (child.tagName === selector.replace('.', '').replace('#', '')) {
            matches.push(child);
          }
        }
        return matches;
      }
    };
  };

  const mockMango = {
    http: {
      get: async (url, options) => {
        throw new Error('http.get not mocked');
      },
      post: async (url, body, options) => {
        throw new Error('http.post not mocked');
      },
      ...overrides.http
    },
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      ...overrides.log
    },
    config: {
      ...overrides.config
    },
    state: {
      get: (key) => undefined,
      set: (key, value) => {},
      getAll: () => ({}),
      clear: () => {},
      ...overrides.state
    },
    utils: {
      sanitizeFilename: (name) => name.replace(/[^a-zA-Z0-9.-]/g, '_'),
      parseHTML: (html) => {
        // Return a mock document object
        return {
          querySelector: (selector) => {
            if (overrides.utils && overrides.utils.parseHTML && typeof overrides.utils.parseHTML === 'function') {
              const doc = overrides.utils.parseHTML(html);
              if (doc && doc.querySelector) {
                return doc.querySelector(selector);
              }
            }
            if (overrides.parseHTML && overrides.parseHTML.querySelector) {
              return overrides.parseHTML.querySelector(selector);
            }
            return null;
          },
          querySelectorAll: (selector) => {
            if (overrides.utils && overrides.utils.parseHTML && typeof overrides.utils.parseHTML === 'function') {
              const doc = overrides.utils.parseHTML(html);
              if (doc && doc.querySelectorAll) {
                return doc.querySelectorAll(selector);
              }
            }
            if (overrides.parseHTML && overrides.parseHTML.querySelectorAll) {
              return overrides.parseHTML.querySelectorAll(selector);
            }
            return [];
          }
        };
      },
      ...overrides.utils
    },
    ...overrides
  };

  return mockMango;
};

describe("WeebCentral Plugin Tests", () => {
  describe("search", () => {
    test("returns search results for valid query", async () => {
      const mockLinks = [
        {
          getAttribute: (name) => {
            if (name === 'href') return '/series/test-manga-123/';
            return null;
          },
          querySelector: (selector) => {
            if (selector === '.flex-1') {
              return { textContent: 'Test Manga' };
            }
            if (selector === 'source') {
              return null;
            }
            if (selector === 'img') {
              return { getAttribute: () => 'https://example.com/cover.jpg' };
            }
            return null;
          }
        }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          post: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              if (selector === '#quick-search-result > div > a') {
                return mockLinks;
              }
              return [];
            }
          })
        }
      });

      const results = await plugin.search("test", mockMango);

      assert.ok(Array.isArray(results), "Results should be an array");
      assert.strictEqual(results.length, 1, "Should return 1 result");
      assert.strictEqual(results[0].title, "Test Manga", "Title should match");
      assert.strictEqual(
        results[0].identifier,
        "test-manga-123",
        "Identifier should be extracted from URL"
      );
      assert.strictEqual(
        results[0].cover_url,
        "https://example.com/cover.jpg",
        "Cover URL should match"
      );
    });

    test("returns empty array when no results found", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          post: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: () => []
          })
        }
      });

      const results = await plugin.search("nonexistent", mockMango);

      assert.ok(Array.isArray(results), "Results should be an array");
      assert.strictEqual(results.length, 0, "Should return empty array");
    });

    test("handles API errors gracefully", async () => {
      const mockMango = createMockMango({
        http: {
          post: async () => ({
            status: 500,
            statusText: "Internal Server Error",
          }),
        },
      });

      await assert.rejects(
        async () => await plugin.search("test", mockMango),
        /Search failed/,
        "Should throw error for non-200 status"
      );
    });

    test("handles network errors", async () => {
      const mockMango = createMockMango({
        http: {
          post: async () => {
            throw new Error("Network error");
          },
        },
      });

      await assert.rejects(
        async () => await plugin.search("test", mockMango),
        /Network error|Search failed/,
        "Should throw error for network failures"
      );
    });

    test("filters out items without valid ID", async () => {
      const mockLinks = [
        {
          getAttribute: (name) => {
            if (name === 'href') return '/series/valid-id/';
            return null;
          },
          querySelector: (selector) => {
            if (selector === '.flex-1') {
              return { textContent: 'Valid Manga' };
            }
            return null;
          }
        },
        {
          getAttribute: (name) => {
            if (name === 'href') return '/invalid-url';
            return null;
          },
          querySelector: (selector) => {
            if (selector === '.flex-1') {
              return { textContent: 'Invalid Manga' };
            }
            return null;
          }
        }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          post: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              if (selector === '#quick-search-result > div > a') {
                return mockLinks;
              }
              return [];
            }
          })
        }
      });

      const results = await plugin.search("test", mockMango);

      assert.strictEqual(results.length, 1, "Should filter out invalid items");
      assert.strictEqual(
        results[0].identifier,
        "valid-id",
        "Should keep valid items"
      );
    });

    test("handles missing image gracefully", async () => {
      const mockLinks = [
        {
          getAttribute: (name) => {
            if (name === 'href') return '/series/test-123/';
            return null;
          },
          querySelector: (selector) => {
            if (selector === '.flex-1') {
              return { textContent: 'Test Manga' };
            }
            // No source or img elements
            return null;
          }
        }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          post: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              if (selector === '#quick-search-result > div > a') {
                return mockLinks;
              }
              return [];
            }
          })
        }
      });

      const results = await plugin.search("test", mockMango);

      assert.strictEqual(results.length, 1, "Should return result");
      assert.strictEqual(
        results[0].cover_url,
        "",
        "Should have empty cover_url when no image"
      );
    });
  });

  describe("getChapters", () => {
    test("returns chapter list for valid series", async () => {
      const mockChapterItems = [
        {
          querySelector: (selector) => {
            if (selector === 'a') {
              return {
                getAttribute: (name) => {
                  if (name === 'href') return '/chapters/chapter-123';
                  return null;
                },
                querySelector: (selector) => {
                  if (selector === 'span.grow > span') {
                    return { textContent: 'Chapter 1' };
                  }
                  return null;
                }
              };
            }
            if (selector === 'time') {
              return {
                getAttribute: (name) => {
                  if (name === 'datetime') return '2024-01-01T00:00:00Z';
                  return null;
                }
              };
            }
            return null;
          }
        },
        {
          querySelector: (selector) => {
            if (selector === 'a') {
              return {
                getAttribute: (name) => {
                  if (name === 'href') return '/chapters/chapter-456';
                  return null;
                },
                querySelector: (selector) => {
                  if (selector === 'span.grow > span') {
                    return { textContent: 'Chapter 2' };
                  }
                  return null;
                }
              };
            }
            if (selector === 'time') {
              return {
                getAttribute: (name) => {
                  if (name === 'datetime') return '2024-01-08T00:00:00Z';
                  return null;
                }
              };
            }
            return null;
          }
        }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              if (selector === 'div.flex.items-center') {
                return mockChapterItems;
              }
              return [];
            }
          })
        }
      });

      const chapters = await plugin.getChapters("series-123", mockMango);

      assert.ok(Array.isArray(chapters), "Chapters should be an array");
      assert.strictEqual(chapters.length, 2, "Should return 2 chapters");
      assert.strictEqual(
        chapters[0].identifier,
        "chapter-123",
        "Should extract chapter ID from URL"
      );
      assert.strictEqual(
        chapters[0].title,
        "Chapter 1",
        "Should extract title"
      );
      assert.strictEqual(
        chapters[0].chapter,
        "1",
        "Should extract chapter number"
      );
      assert.strictEqual(
        chapters[0].published_at,
        "2024-01-01T00:00:00Z",
        "Should extract published date"
      );
    });

    test("handles empty chapter list", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: () => []
          })
        }
      });

      await assert.rejects(
        async () => await plugin.getChapters("series-123", mockMango),
        /No chapters found/,
        "Should throw error when no chapters"
      );
    });

    test("handles API errors", async () => {
      const mockMango = createMockMango({
        http: {
          get: async () => ({
            status: 500,
            statusText: "Internal Server Error",
            data: null,
          }),
        },
      });

      await assert.rejects(
        async () => await plugin.getChapters("series-123", mockMango),
        /Failed to fetch chapters/,
        "Should throw error for API failure"
      );
    });

    test("sorts chapters by chapter number", async () => {
      const mockChapterItems = [
        {
          querySelector: (selector) => {
            if (selector === 'a') {
              return {
                getAttribute: () => '/chapters/ch2',
                querySelector: () => ({ textContent: 'Chapter 2' })
              };
            }
            return null;
          }
        },
        {
          querySelector: (selector) => {
            if (selector === 'a') {
              return {
                getAttribute: () => '/chapters/ch1',
                querySelector: () => ({ textContent: 'Chapter 1' })
              };
            }
            return null;
          }
        }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              if (selector === 'div.flex.items-center') {
                return mockChapterItems;
              }
              return [];
            }
          })
        }
      });

      const chapters = await plugin.getChapters("series-123", mockMango);

      assert.strictEqual(chapters.length, 2, "Should return 2 chapters");
      // After reverse and sort, should be in ascending order
      assert.strictEqual(
        chapters[0].chapter,
        "1",
        "First chapter should be chapter 1"
      );
      assert.strictEqual(
        chapters[1].chapter,
        "2",
        "Second chapter should be chapter 2"
      );
    });
  });

  describe("getPageURLs", () => {
    test("returns page URLs for valid chapter", async () => {
      const mockImages = [
        { getAttribute: () => 'https://example.com/page1.jpg' },
        { getAttribute: () => 'https://example.com/page2.jpg' },
        { getAttribute: () => 'https://example.com/page3.jpg' }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              if (selector === 'section.flex-1 img') {
                return mockImages;
              }
              return [];
            }
          })
        }
      });

      const urls = await plugin.getPageURLs("chapter-123", mockMango);

      assert.ok(Array.isArray(urls), "URLs should be an array");
      assert.strictEqual(urls.length, 3, "Should return 3 page URLs");
      // URLs are now proxy URLs, so check for proxy format
      assert.ok(
        urls[0].includes("/api/proxy/resource"),
        "Should use proxy URL format"
      );
      // Decode to check for original URL content
      const decodedUrl = decodeURIComponent(urls[0]);
      assert.ok(
        decodedUrl.includes("page1.jpg"),
        "Should include original image URL in proxy"
      );
    });

    test("falls back to all img tags when section.flex-1 img not found", async () => {
      const mockImages = [
        { getAttribute: () => 'https://example.com/page1.jpg' },
        { getAttribute: () => 'https://example.com/page2.jpg' }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      let selectorCallCount = 0;
      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              selectorCallCount++;
              if (selector === 'section.flex-1 img') {
                return []; // First selector returns empty
              }
              if (selector === 'img') {
                return mockImages; // Fallback selector returns images
              }
              return [];
            }
          })
        }
      });

      const urls = await plugin.getPageURLs("chapter-123", mockMango);

      assert.ok(Array.isArray(urls), "URLs should be an array");
      assert.strictEqual(urls.length, 2, "Should return 2 page URLs");
      assert.strictEqual(
        selectorCallCount,
        2,
        "Should try both selectors"
      );
    });

    test("handles empty page list", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: () => []
          })
        }
      });

      await assert.rejects(
        async () => await plugin.getPageURLs("chapter-123", mockMango),
        /No pages found/,
        "Should throw error when no pages found"
      );
    });

    test("handles HTTP errors", async () => {
      const mockMango = createMockMango({
        http: {
          get: async () => ({
            status: 500,
            statusText: "Internal Server Error",
            data: null,
          }),
        },
      });

      await assert.rejects(
        async () => await plugin.getPageURLs("chapter-123", mockMango),
        /Failed to fetch page URLs/,
        "Should throw error for HTTP error status"
      );
    });

    test("handles network errors", async () => {
      const mockMango = createMockMango({
        http: {
          get: async () => {
            throw new Error("Network error");
          },
        },
      });

      await assert.rejects(
        async () => await plugin.getPageURLs("chapter-123", mockMango),
        /Network error|GetPageURLs failed|Failed to fetch page URLs/,
        "Should throw error for network failures"
      );
    });

    test("filters out empty src attributes", async () => {
      const mockImages = [
        { getAttribute: () => 'https://example.com/page1.jpg' },
        { getAttribute: () => '' }, // Empty src
        { getAttribute: () => '   ' }, // Whitespace only
        { getAttribute: () => 'https://example.com/page2.jpg' }
      ];

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: "<html>...</html>"
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
        utils: {
          parseHTML: (html) => ({
            querySelectorAll: (selector) => {
              if (selector === 'section.flex-1 img') {
                return mockImages;
              }
              return [];
            }
          })
        }
      });

      const urls = await plugin.getPageURLs("chapter-123", mockMango);

      assert.strictEqual(urls.length, 2, "Should filter out empty src attributes");
      // URLs are now proxy URLs
      const decodedUrl0 = decodeURIComponent(urls[0]);
      const decodedUrl1 = decodeURIComponent(urls[1]);
      assert.ok(
        decodedUrl0.includes("page1.jpg"),
        "Should keep valid URLs"
      );
      assert.ok(
        decodedUrl1.includes("page2.jpg"),
        "Should keep valid URLs"
      );
    });
  });
});

