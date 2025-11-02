/**
 * Example unit tests for plugin
 *
 * Run with: npm test (requires Jest/Vitest)
 * Or: node --test index.test.js (Node.js 18+)
 */

const plugin = require('./index.js');

// Mock mango API object
const createMockMango = (overrides = {}) => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    ...overrides.http
  },
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    ...overrides.log
  },
  config: {
    base_url: "https://api.example.com",
    ...overrides.config
  },
  utils: {
    sanitizeFilename: (name) => name.replace(/[^a-zA-Z0-9.-]/g, '_'),
    parseHTML: jest.fn(),
    ...overrides.utils
  }
});

describe('Plugin Template Tests', () => {
  let mockMango;

  beforeEach(() => {
    mockMango = createMockMango();
    jest.clearAllMocks();
  });

  describe('getInfo', () => {
    test('returns correct plugin info', () => {
      const info = plugin.getInfo();

      expect(info).toHaveProperty('id');
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
      expect(info.id).toBe('template');
    });
  });

  describe('search', () => {
    test('returns search results', async () => {
      const mockResults = {
        status: 200,
        data: {
          results: [
            {
              id: '1',
              title: 'Test Manga',
              coverUrl: 'https://example.com/cover.jpg'
            }
          ]
        }
      };

      mockMango.http.get.mockResolvedValue(mockResults);

      const results = await plugin.search('test', mockMango);

      expect(mockMango.http.get).toHaveBeenCalledWith(
        expect.stringContaining('test')
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('identifier');
      expect(results[0]).toHaveProperty('cover_url');
    });

    test('handles API errors gracefully', async () => {
      mockMango.http.get.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(plugin.search('test', mockMango)).rejects.toThrow();
      expect(mockMango.log.error).toHaveBeenCalled();
    });

    test('handles network errors', async () => {
      mockMango.http.get.mockRejectedValue(new Error('Network error'));

      await expect(plugin.search('test', mockMango)).rejects.toThrow('Failed to search');
    });
  });

  describe('getChapters', () => {
    test('returns chapter list', async () => {
      const mockChapters = {
        status: 200,
        data: {
          chapters: [
            {
              id: 'ch1',
              title: 'Chapter 1',
              number: 1,
              volume: 1,
              pages: 20,
              publishedAt: '2024-01-01T00:00:00Z'
            }
          ]
        }
      };

      mockMango.http.get.mockResolvedValue(mockChapters);

      const chapters = await plugin.getChapters('series-1', mockMango);

      expect(chapters).toHaveLength(1);
      expect(chapters[0]).toHaveProperty('identifier');
      expect(chapters[0]).toHaveProperty('title');
      expect(chapters[0]).toHaveProperty('chapter');
    });
  });

  describe('getPageURLs', () => {
    test('returns page URLs', async () => {
      const mockPages = {
        status: 200,
        data: {
          pages: [
            'https://example.com/page1.jpg',
            'https://example.com/page2.jpg'
          ]
        }
      };

      mockMango.http.get.mockResolvedValue(mockPages);

      const urls = await plugin.getPageURLs('ch1', mockMango);

      expect(urls).toHaveLength(2);
      expect(urls[0]).toContain('page1.jpg');
    });

    test('handles empty page list', async () => {
      mockMango.http.get.mockResolvedValue({
        status: 200,
        data: { pages: [] }
      });

      await expect(plugin.getPageURLs('ch1', mockMango)).rejects.toThrow('No pages found');
    });
  });
});

