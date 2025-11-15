/**
 * Mango-Go Plugin Template
 *
 * This is a template for creating new plugins. Copy this file and plugin.json
 * to create your own plugin.
 *
 * Required: All three exports (search, getChapters, getPageURLs)
 * Pattern: Use dependency injection - mango API is passed as parameter
 */


/**
 * Searches for series/manga.
 *
 * @param {string} query - Search query string
 * @param {object} mango - Mango API object with http, log, config, utils
 * @returns {Promise<Array>} Array of SearchResult objects
 */
exports.search = async (query, mango) => {
  mango.log.info(`Searching for: ${query}`);

  try {
    const baseUrl = mango.config.base_url || "https://api.example.com";
    const url = `${baseUrl}/search?q=${encodeURIComponent(query)}`;

    mango.log.debug(`Making request to: ${url}`);
    const response = await mango.http.get(url);

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    // Transform API response to SearchResult format
    const results = response.data.results || response.data.data || [];

    return results.map(item => ({
      title: item.title || item.name || "Untitled",
      cover_url: item.coverUrl || item.cover_url || item.thumbnail || "",
      identifier: item.id || item.identifier || String(Math.random())
    }));

  } catch (error) {
    mango.log.error(`Search failed: ${error.message}`);
    throw new Error(`Failed to search: ${error.message}`);
  }
};

/**
 * Gets list of chapters for a series.
 *
 * @param {string} seriesId - Series identifier from search result
 * @param {object} mango - Mango API object
 * @returns {Promise<Array>} Array of ChapterResult objects
 */
exports.getChapters = async (seriesId, mango) => {
  mango.log.info(`Fetching chapters for series: ${seriesId}`);

  try {
    const baseUrl = mango.config.base_url || "https://api.example.com";
    const url = `${baseUrl}/series/${seriesId}/chapters`;

    const response = await mango.http.get(url);

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    const chapters = response.data.chapters || response.data.data || [];

    return chapters.map(ch => ({
      identifier: ch.id || ch.identifier || String(Math.random()),
      title: ch.title || ch.name || `Chapter ${ch.number || ch.chapter || "?"}`,
      volume: String(ch.volume || ch.vol || ""),
      chapter: String(ch.chapter || ch.number || "0"),
      pages: ch.pages || ch.pageCount || 0,
      language: ch.language || ch.lang || "en",
      group_id: ch.groupId || ch.group_id || "",
      published_at: ch.publishedAt || ch.published_at || new Date().toISOString()
    }));

  } catch (error) {
    mango.log.error(`GetChapters failed: ${error.message}`);
    throw new Error(`Failed to get chapters: ${error.message}`);
  }
};

/**
 * Gets URLs for all pages in a chapter.
 *
 * @param {string} chapterId - Chapter identifier from getChapters result
 * @param {object} mango - Mango API object
 * @returns {Promise<Array<string>>} Array of image URLs
 */
exports.getPageURLs = async (chapterId, mango) => {
  mango.log.info(`Fetching page URLs for chapter: ${chapterId}`);

  try {
    const baseUrl = mango.config.base_url || "https://api.example.com";
    const url = `${baseUrl}/chapters/${chapterId}/pages`;

    const response = await mango.http.get(url);

    if (response.status !== 200) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    // Extract page URLs from response
    const pages = response.data.pages || response.data.data || [];

    if (pages.length === 0) {
      throw new Error("No pages found for chapter");
    }

    // If pages are objects with URLs
    if (typeof pages[0] === 'object') {
      return pages.map(page => page.url || page.imageUrl || page.src);
    }

    // If pages are already URLs
    return pages;

  } catch (error) {
    mango.log.error(`GetPageURLs failed: ${error.message}`);
    throw new Error(`Failed to get page URLs: ${error.message}`);
  }
};

