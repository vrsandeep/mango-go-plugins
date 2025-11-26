/**
 * Unit tests for MangaDex plugin
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
      ...overrides.utils
    }
  };

  return mockMango;
};

describe("MangaDex Plugin Tests", () => {
  describe("search", () => {
    test("returns search results for valid query", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: [
            {
              id: "manga-123",
              type: "manga",
              attributes: {
                title: {
                  en: "Test Manga",
                  ja: "テスト漫画"
                }
              },
              relationships: [
                {
                  type: "cover_art",
                  attributes: {
                    fileName: "cover.jpg"
                  }
                }
              ]
            }
          ]
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const results = await plugin.search("test", mockMango);

      assert.ok(Array.isArray(results), "Results should be an array");
      assert.strictEqual(results.length, 1, "Should return 1 result");
      assert.strictEqual(results[0].title, "Test Manga", "Title should match");
      assert.strictEqual(
        results[0].identifier,
        "manga-123",
        "Identifier should be manga ID"
      );
      assert.ok(
        results[0].cover_url.includes("manga-123"),
        "Cover URL should include manga ID"
      );
      assert.ok(
        results[0].cover_url.includes("cover.jpg"),
        "Cover URL should include filename"
      );
    });

    test("falls back to first available title when English is missing", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: [
            {
              id: "manga-456",
              type: "manga",
              attributes: {
                title: {
                  ja: "日本語タイトル",
                  ko: "한국어 제목"
                }
              },
              relationships: []
            }
          ]
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const results = await plugin.search("test", mockMango);

      assert.strictEqual(results.length, 1, "Should return 1 result");
      assert.ok(
        results[0].title === "日本語タイトル" || results[0].title === "한국어 제목",
        "Should use first available title"
      );
    });

    test("returns empty array when no results found", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: []
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const results = await plugin.search("nonexistent", mockMango);

      assert.ok(Array.isArray(results), "Results should be an array");
      assert.strictEqual(results.length, 0, "Should return empty array");
    });

    test("handles API errors gracefully", async () => {
      const mockMango = createMockMango({
        http: {
          get: async () => ({
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
          get: async () => {
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

    test("handles missing cover art gracefully", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: [
            {
              id: "manga-789",
              type: "manga",
              attributes: {
                title: {
                  en: "No Cover Manga"
                }
              },
              relationships: []
            }
          ]
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const results = await plugin.search("test", mockMango);

      assert.strictEqual(results.length, 1, "Should return result");
      assert.strictEqual(
        results[0].cover_url,
        "",
        "Should have empty cover_url when no cover art"
      );
    });

    test("filters out entries with missing attributes", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: [
            {
              id: "manga-valid",
              type: "manga",
              attributes: {
                title: {
                  en: "Valid Manga"
                }
              },
              relationships: []
            },
            {
              id: "manga-invalid",
              type: "manga",
              attributes: null
            },
            {
              id: "manga-no-title",
              type: "manga",
              attributes: {
                title: null
              }
            },
            {
              id: "manga-no-attributes",
              type: "manga"
            }
          ]
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const results = await plugin.search("test", mockMango);

      assert.strictEqual(results.length, 1, "Should filter out invalid entries");
      assert.strictEqual(
        results[0].identifier,
        "manga-valid",
        "Should keep only valid entries"
      );
    });
  });

  describe("getChapters", () => {
    test("returns chapter list for valid series", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: [
            // API returns in descending order (chapter 2 first, then chapter 1)
            {
              id: "chapter-2",
              type: "chapter",
              attributes: {
                title: "Chapter 2",
                volume: "1",
                chapter: "2",
                pages: 22,
                translatedLanguage: "en",
                publishAt: "2024-01-08T00:00:00Z"
              }
            },
            {
              id: "chapter-1",
              type: "chapter",
              attributes: {
                title: "Chapter 1",
                volume: "1",
                chapter: "1",
                pages: 20,
                translatedLanguage: "en",
                publishAt: "2024-01-01T00:00:00Z"
              }
            }
          ]
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const chapters = await plugin.getChapters("manga-123", mockMango);

      assert.ok(Array.isArray(chapters), "Chapters should be an array");
      assert.strictEqual(chapters.length, 2, "Should return 2 chapters");
      // After reverse, chapters are in ascending order
      assert.strictEqual(
        chapters[0].identifier,
        "chapter-1",
        "Should have correct identifier (first chapter after reverse)"
      );
      assert.strictEqual(
        chapters[1].identifier,
        "chapter-2",
        "Should have correct identifier (second chapter after reverse)"
      );
      assert.strictEqual(
        chapters[0].title,
        "Vol. 1 Ch. 1 Chapter 1",
        "Should format title correctly"
      );
      assert.strictEqual(chapters[0].volume, "1", "Should extract volume");
      assert.strictEqual(chapters[0].chapter, "1", "Should extract chapter");
      assert.strictEqual(chapters[0].pages, 20, "Should extract pages");
      assert.strictEqual(
        chapters[0].language,
        "en",
        "Should extract language"
      );
    });

    test("handles pagination", async () => {
      // Create exactly 500 chapters for first page to trigger pagination
      // API returns in descending order, so first page: [500, 499, ..., 2, 1]
      const firstPageChapters = [];
      for (let i = 500; i >= 1; i--) {
        firstPageChapters.push({
          id: `chapter-${i}`,
          type: "chapter",
          attributes: {
            title: `Chapter ${i}`,
            volume: "1",
            chapter: String(i),
            pages: 20,
            translatedLanguage: "en",
            publishAt: "2024-01-01T00:00:00Z"
          }
        });
      }

      const firstPageResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: firstPageChapters
        }
      };

      // Second page would have older chapters (1000, 999, ..., 502, 501) in descending order
      // But for simplicity, just return one chapter
      const secondPageResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: [
            {
              id: "chapter-501",
              type: "chapter",
              attributes: {
                title: "Chapter 501",
                volume: "1",
                chapter: "501",
                pages: 20,
                translatedLanguage: "en",
                publishAt: "2024-01-01T00:00:00Z"
              }
            }
          ]
        }
      };

      let callCount = 0;
      const mockMango = createMockMango({
        http: {
          get: async (url) => {
            callCount++;
            if (url.includes("offset=0")) {
              return firstPageResponse;
            } else if (url.includes("offset=500")) {
              return secondPageResponse;
            } else {
              // Return empty to stop pagination
              return {
                status: 200,
                statusText: "OK",
                data: { data: [] }
              };
            }
          },
        },
      });

      const chapters = await plugin.getChapters("manga-123", mockMango);

      assert.ok(Array.isArray(chapters), "Chapters should be an array");
      assert.strictEqual(
        chapters.length,
        501,
        "Should return 501 chapters from pagination"
      );
      // After reverse, chapters should be in ascending order
      // Collected: [500, 499, ..., 2, 1, 501]
      // After reverse: [501, 1, 2, ..., 499, 500]
      assert.ok(
        chapters.some(ch => ch.chapter === "1"),
        "Should contain chapter 1"
      );
      assert.ok(
        chapters.some(ch => ch.chapter === "501"),
        "Should contain chapter 501"
      );
      assert.strictEqual(
        callCount,
        2,
        "Should make 2 API calls (first page with 500 items triggers pagination, second page with 1 item stops pagination)"
      );
    });

    test("handles empty chapter list", async () => {
      const emptyResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: []
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => emptyResponse,
        },
      });

      const chapters = await plugin.getChapters("manga-123", mockMango);

      assert.ok(Array.isArray(chapters), "Chapters should be an array");
      assert.strictEqual(
        chapters.length,
        0,
        "Should return empty array when no chapters"
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
        async () => await plugin.getChapters("manga-123", mockMango),
        /Failed to fetch chapters/,
        "Should throw error for API failure"
      );
    });

    test("formats chapter title correctly", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          data: [
            {
              id: "chapter-1",
              type: "chapter",
              attributes: {
                title: "Special Chapter",
                volume: "2",
                chapter: "10.5",
                pages: 15,
                translatedLanguage: "en",
                publishAt: "2024-01-01T00:00:00Z"
              }
            }
          ]
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const chapters = await plugin.getChapters("manga-123", mockMango);

      assert.strictEqual(
        chapters[0].title,
        "Vol. 2 Ch. 10.5 Special Chapter",
        "Should format title with all parts"
      );
    });
  });

  describe("getPageURLs", () => {
    test("returns page URLs for valid chapter", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          baseUrl: "https://s2.mangadex.org",
          chapter: {
            hash: "abc123",
            data: ["page1.jpg", "page2.jpg", "page3.jpg"],
          },
        },
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const urls = await plugin.getPageURLs("chapter-123", mockMango);

      assert.ok(Array.isArray(urls), "URLs should be an array");
      assert.strictEqual(urls.length, 3, "Should return 3 page URLs");
      // URLs are now proxy URLs, so check for proxy format
      assert.ok(
        urls[0].includes("/api/proxy/resource"),
        "Should use proxy URL format"
      );
      // Hash and filename will be in the encoded URL parameter
      const decodedUrl = decodeURIComponent(urls[0]);
      assert.ok(decodedUrl.includes("abc123"), "Should include hash in URL");
      assert.ok(
        decodedUrl.includes("page1.jpg"),
        "Should include page filename"
      );
      assert.ok(
        urls[0].startsWith("http://") || urls[0].startsWith("https://"),
        "Should be a full URL"
      );
    });

    test("handles empty page list", async () => {
      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          baseUrl: "https://s2.mangadex.org",
          chapter: {
            hash: "abc123",
            data: []
          }
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse,
        },
      });

      const urls = await plugin.getPageURLs("chapter-123", mockMango);

      assert.ok(Array.isArray(urls), "URLs should be an array");
      assert.strictEqual(urls.length, 0, "Should return empty array");
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
  });
});

