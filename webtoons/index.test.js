/**
 * Unit tests for Webtoons plugin
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

describe('Webtoons Plugin Tests', () => {
  describe('getInfo', () => {
    test('returns correct plugin info', () => {
      const info = plugin.getInfo();

      assert.ok(info, 'getInfo should return an object');
      assert.strictEqual(info.id, 'webtoons', 'ID should be "webtoons"');
      assert.strictEqual(info.name, 'Webtoons', 'Name should be "Webtoons"');
      assert.ok(info.version, 'Should have a version');
    });
  });

  describe('search', () => {
    test('returns search results for valid query', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          result: {
            total: 1,
            searchedList: [
              {
                titleNo: 6795,
                title: 'unOrdinary',
                authorNameList: ['uru-chan'],
                representGenre: 'Drama',
                thumbnailImage2: '/thumbnail/icon_webtoon/6795/thumbnail_icon_webtoon_6795.jpg'
              }
            ]
          }
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse
        }
      });

      const results = await plugin.search('unordinary', mockMango);

      assert.ok(Array.isArray(results), 'Results should be an array');
      assert.strictEqual(results.length, 1, 'Should return 1 result');
      assert.strictEqual(results[0].title, 'unOrdinary', 'Title should match');
      assert.strictEqual(results[0].identifier, '6795', 'Identifier should be titleNo as string');
      assert.ok(results[0].cover_url, 'Should have cover_url');
      // Check that webtoons cover URLs are proxied
      if (results[0].cover_url.includes('webtoon-phinf.pstatic.net')) {
        assert.ok(results[0].cover_url.includes('/api/proxy/resource'), 'Webtoons cover should be proxied');
        assert.ok(results[0].cover_url.includes('referer='), 'Proxy URL should include referer');
      }
    });

    test('returns empty array when no results found', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          result: {
            total: 0,
            searchedList: []
          }
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse
        }
      });

      const results = await plugin.search('nonexistent', mockMango);

      assert.ok(Array.isArray(results), 'Results should be an array');
      assert.strictEqual(results.length, 0, 'Should return empty array');
    });

    test('handles API errors gracefully', async () => {
      const mockMango = createMockMango({
        http: {
          get: async () => ({
            status: 500,
            statusText: 'Internal Server Error'
          })
        }
      });

      await assert.rejects(
        async () => await plugin.search('test', mockMango),
        /Search failed/,
        'Should throw error for non-200 status'
      );
    });

    test('handles network errors', async () => {
      const mockMango = createMockMango({
        http: {
          get: async () => {
            throw new Error('Network error');
          }
        }
      });

      await assert.rejects(
        async () => await plugin.search('test', mockMango),
        /Failed to search/,
        'Should throw error for network failures'
      );
    });

    test('filters out items without titleNo', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          result: {
            total: 2,
            searchedList: [
              {
                titleNo: 6795,
                title: 'unOrdinary',
                thumbnailImage2: '/thumb.jpg'
              },
              {
                titleNo: null,
                title: 'Invalid Item'
              }
            ]
          }
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse
        }
      });

      const results = await plugin.search('test', mockMango);

      assert.strictEqual(results.length, 1, 'Should filter out invalid items');
      assert.strictEqual(results[0].title, 'unOrdinary', 'Should keep valid items');
    });

    test('handles missing thumbnail gracefully', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          result: {
            total: 1,
            searchedList: [
              {
                titleNo: 6795,
                title: 'unOrdinary',
                thumbnailImage2: null,
                thumbnailMobile: null
              }
            ]
          }
        }
      };

      const mockMango = createMockMango({
        http: {
          get: async () => mockResponse
        }
      });

      const results = await plugin.search('test', mockMango);

      assert.strictEqual(results.length, 1, 'Should return result');
      assert.strictEqual(results[0].cover_url, '', 'Should have empty cover_url when no thumbnail');
    });
  });

  describe("getChapters", () => {
    test("returns chapter list for valid series", async () => {
      const episodesApiResponse = {
        status: 200,
        statusText: "OK",
        data: {
          success: true,
          result: {
            episodeList: [
              {
                episodeNo: 1,
                episodeTitle: "Episode 1",
                viewerLink:
                  "/en/super-hero/unordinary/episode-1/viewer?title_no=6795&episode_no=1",
                exposureDateMillis: 1464048000000,
                thumbnail: "/thumbnail1.jpg",
                displayUp: false,
                hasBgm: false,
              },
              {
                episodeNo: 2,
                episodeTitle: "Episode 2",
                viewerLink:
                  "/en/super-hero/unordinary/episode-2/viewer?title_no=6795&episode_no=2",
                exposureDateMillis: 1464652800000,
                thumbnail: "/thumbnail2.jpg",
                displayUp: false,
                hasBgm: false,
              },
            ],
            nextCursor: null,
          },
        },
      };

      const mockMango = createMockMango({
        http: {
          get: async (url) => {
            if (url.includes("/api/v1/webtoon/6795/episodes")) {
              return episodesApiResponse;
            }
            throw new Error(`Unexpected URL: ${url}`);
          },
        },
      });

      const chapters = await plugin.getChapters("6795", mockMango);

      assert.ok(Array.isArray(chapters), "Chapters should be an array");
      assert.strictEqual(chapters.length, 2, "Should return 2 chapters");
      // The identifier format is id{seriesId}viewerLink{viewerLink}chNum{num} with hyphens replaced by underscores
      assert.ok(
        chapters[0].identifier.includes("id6795viewerLink"),
        "Should generate correct identifier prefix"
      );
      assert.ok(
        chapters[0].identifier.includes("chNum1"),
        "Should include chapter number in identifier"
      );
      assert.strictEqual(
        chapters[0].title,
        "Episode 1",
        "Should extract title"
      );
      assert.strictEqual(
        chapters[0].chapter,
        "1",
        "Should extract chapter number"
      );
    });

    test("handles pagination", async () => {
      const firstPageResponse = {
        status: 200,
        statusText: "OK",
        data: {
          success: true,
          result: {
            episodeList: [
              {
                episodeNo: 1,
                episodeTitle: "Episode 1",
                viewerLink:
                  "/en/super-hero/unordinary/episode-1/viewer?title_no=6795&episode_no=1",
                exposureDateMillis: 1464048000000,
                thumbnail: "/thumbnail1.jpg",
                displayUp: false,
                hasBgm: false,
              },
            ],
            nextCursor: 100,
          },
        },
      };

      const secondPageResponse = {
        status: 200,
        statusText: "OK",
        data: {
          success: true,
          result: {
            episodeList: [
              {
                episodeNo: 2,
                episodeTitle: "Episode 2",
                viewerLink:
                  "/en/super-hero/unordinary/episode-2/viewer?title_no=6795&episode_no=2",
                exposureDateMillis: 1464652800000,
                thumbnail: "/thumbnail2.jpg",
                displayUp: false,
                hasBgm: false,
              },
            ],
            nextCursor: null,
          },
        },
      };

      let callCount = 0;
      const mockMango = createMockMango({
        http: {
          get: async (url) => {
            callCount++;
            if (url.includes("cursor=0")) {
              return firstPageResponse;
            } else if (url.includes("cursor=100")) {
              return secondPageResponse;
            }
            throw new Error(`Unexpected URL: ${url}`);
          },
        },
      });

      const chapters = await plugin.getChapters("6795", mockMango);

      assert.ok(Array.isArray(chapters), "Chapters should be an array");
      assert.strictEqual(
        chapters.length,
        2,
        "Should return 2 chapters from pagination"
      );
      assert.strictEqual(
        callCount,
        2,
        "Should make 2 API calls for pagination"
      );
      // Chapters should be sorted by episode number
      assert.strictEqual(
        chapters[0].chapter,
        "1",
        "First chapter should be episode 1"
      );
      assert.strictEqual(
        chapters[1].chapter,
        "2",
        "Second chapter should be episode 2"
      );
    });

    test("handles empty episode list", async () => {
      const emptyResponse = {
        status: 200,
        statusText: "OK",
        data: {
          success: true,
          result: {
            episodeList: [],
            nextCursor: null,
          },
        },
      };

      const mockMango = createMockMango({
        http: {
          get: async () => emptyResponse,
        },
      });

      const chapters = await plugin.getChapters("6795", mockMango);

      assert.ok(Array.isArray(chapters), "Chapters should be an array");
      assert.strictEqual(
        chapters.length,
        0,
        "Should return empty array when no episodes"
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
        async () => await plugin.getChapters("6795", mockMango),
        /Episodes API returned status/,
        "Should throw error for API failure"
      );
    });

    test("handles invalid API response", async () => {
      const invalidResponse = {
        status: 200,
        statusText: "OK",
        data: {
          success: false,
        },
      };

      const mockMango = createMockMango({
        http: {
          get: async () => invalidResponse,
        },
      });

      await assert.rejects(
        async () => await plugin.getChapters("6795", mockMango),
        /Episodes API returned success=false/,
        "Should throw error for invalid response"
      );
    });
  });

  describe("getPageURLs", () => {
    test("returns page URLs for valid chapter", async () => {
      const viewerLink =
        "/en/super-hero/unordinary/episode-1/viewer?title_no=6795&episode_no=1";
      const chapterId = `id6795viewerLink${viewerLink}chNum1`.replace(
        /-/g,
        "_"
      );

      const viewerHtml = `
        <html>
          <body>
            <div class="subj_info">
              <a href="/en/super-hero/unordinary/list">unOrdinary</a>
              <span class="subj_episode">Episode 1</span>
            </div>
            <div id="_imageList">
              <img data-url="https://webtoon-phinf.pstatic.net/image1.jpg" />
              <img data-url="https://webtoon-phinf.pstatic.net/image2.jpg" />
              <img data-url="https://webtoon-phinf.pstatic.net/image3.jpg" />
            </div>
          </body>
        </html>
      `;

      const mockMango = createMockMango({
        http: {
          get: async (url) => {
            if (url.includes("viewer")) {
              const response = {
                status: 200,
                statusText: "OK",
                data: viewerHtml,
              };
              // Add text() method to response object
              response.text = function () {
                return viewerHtml;
              };
              return response;
            }
            throw new Error(`Unexpected URL: ${url}`);
          },
        },
      });

      const urls = await plugin.getPageURLs(chapterId, mockMango);

      assert.ok(Array.isArray(urls), "URLs should be an array");
      assert.strictEqual(urls.length, 3, "Should return 3 page URLs");
      assert.ok(
        urls[0].includes("image1.jpg"),
        "Should extract correct image URLs"
      );
      assert.ok(
        urls[1].includes("image2.jpg"),
        "Should extract second image URL"
      );
      assert.ok(
        urls[2].includes("image3.jpg"),
        "Should extract third image URL"
      );
    });

    test("handles invalid chapter ID format", async () => {
      const mockMango = createMockMango();

      await assert.rejects(
        async () => await plugin.getPageURLs("invalid-id", mockMango),
        /Invalid chapter ID format/,
        "Should throw error for invalid chapter ID"
      );
    });

    test("handles missing _imageList div", async () => {
      const viewerLink =
        "/en/super-hero/unordinary/episode-1/viewer?title_no=6795&episode_no=1";
      const chapterId = `id6795viewerLink${viewerLink}chNum1`.replace(
        /-/g,
        "_"
      );

      const viewerHtmlWithoutImageList = `
        <html>
          <body>
            <div class="subj_info">
              <a href="/en/super-hero/unordinary/list">unOrdinary</a>
            </div>
          </body>
        </html>
      `;

      const mockMango = createMockMango({
        http: {
          get: async () => {
            const response = {
              status: 200,
              statusText: "OK",
              data: viewerHtmlWithoutImageList,
            };
            response.text = function () {
              return viewerHtmlWithoutImageList;
            };
            return response;
          },
        },
      });

      await assert.rejects(
        async () => await plugin.getPageURLs(chapterId, mockMango),
        /_imageList div not found/,
        "Should throw error when _imageList div is missing"
      );
    });

    test("handles empty _imageList div", async () => {
      const viewerLink =
        "/en/super-hero/unordinary/episode-1/viewer?title_no=6795&episode_no=1";
      const chapterId = `id6795viewerLink${viewerLink}chNum1`.replace(
        /-/g,
        "_"
      );

      const emptyViewerHtml = `
        <html>
          <body>
            <div id="_imageList"></div>
          </body>
        </html>
      `;

      const mockMango = createMockMango({
        http: {
          get: async () => {
            const response = {
              status: 200,
              statusText: "OK",
              data: emptyViewerHtml,
            };
            response.text = function () {
              return emptyViewerHtml;
            };
            return response;
          },
        },
      });

      await assert.rejects(
        async () => await plugin.getPageURLs(chapterId, mockMango),
        /No images found in _imageList div/,
        "Should throw error when no images found in _imageList div"
      );
    });

    test("handles HTTP errors", async () => {
      const viewerLink =
        "/en/super-hero/unordinary/episode-1/viewer?title_no=6795&episode_no=1";
      const chapterId = `id6795viewerLink${viewerLink}chNum1`.replace(
        /-/g,
        "_"
      );

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
        async () => await plugin.getPageURLs(chapterId, mockMango),
        /Failed to get chapter viewer/,
        "Should throw error for HTTP error status"
      );
    });
  });
});

