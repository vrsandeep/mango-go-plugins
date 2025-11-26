/**
 * MangaDex Plugin for Mango-Go
 * Downloads manga from MangaDex (https://mangadex.org)
 */

const API_BASE_URL = "https://api.mangadex.org";
const COVER_ART_BASE_URL = "https://uploads.mangadex.org";
const MANGA_DEX_BASE_URL = "https://mangadex.org";
const PROXY_BASE_URL = "http://localhost:8080/api/proxy/resource";

/**
 * Constructs a proxy URL for an image resource
 * @param {string} imageUrl - The original image URL to proxy
 * @param {object} options - Optional headers and configuration
 * @param {string} options.referer - Referer header value
 * @returns {string} The proxy URL
 */
function constructProxyUrl(imageUrl, options = {}) {
  const params = [];
  params.push("url=" + encodeURIComponent(imageUrl));

  if (options.referer) {
    params.push("referer=" + encodeURIComponent(options.referer));
  }

  return PROXY_BASE_URL + "?" + params.join("&");
}

/**
 * Searches for manga on MangaDex
 * @param {string} query - Search query
 * @param {object} mango - Mango API object
 */
exports.search = async (query, mango) => {
  mango.log.info(`Searching MangaDex for: ${query}`);

  try {
    const url = `${API_BASE_URL}/manga?title=${encodeURIComponent(
      query
    )}&limit=25&includes[]=cover_art`;

    // Get timeout from config (in milliseconds) and convert to seconds
    const timeoutMs = mango.config?.timeout || 20000;
    const timeoutSec = timeoutMs / 1000;

    const response = await mango.http.get(url, { timeout: timeoutSec });

    if (response.status !== 200) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const apiResponse = response.data;
    if (
      !apiResponse ||
      !apiResponse.data ||
      !Array.isArray(apiResponse.data) ||
      apiResponse.data.length === 0
    ) {
      mango.log.info("No results found");
      return [];
    }

    // Build a map of cover art from included array for quick lookup
    const coverArtMap = new Map();
    if (apiResponse.included && Array.isArray(apiResponse.included)) {
      for (const item of apiResponse.included) {
        if (item.type === "cover_art" && item.id) {
          const fileName =
            item.attributes?.fileName || item.attributes?.file_name || "";
          if (fileName) {
            coverArtMap.set(item.id, fileName);
          }
        }
      }
    }

    const results = apiResponse.data
      .filter((mangaData) => {
        // Filter out invalid entries
        return (
          mangaData &&
          mangaData.attributes &&
          mangaData.attributes.title &&
          mangaData.id
        );
      })
      .map((mangaData) => {
        // Get title (prefer English, fallback to first available)
        let title = "";
        if (
          mangaData.attributes &&
          mangaData.attributes.title &&
          typeof mangaData.attributes.title === "object"
        ) {
          if (mangaData.attributes.title.en) {
            title = mangaData.attributes.title.en;
          } else {
            const titleKeys = Object.keys(mangaData.attributes.title);
            if (titleKeys.length > 0) {
              title = mangaData.attributes.title[titleKeys[0]] || "";
            }
          }
        }

        // Find cover art
        let coverFileName = "";

        // First, check if cover art is directly in relationships with attributes (legacy format)
        for (const rel of mangaData.relationships || []) {
          if (rel.type === "cover_art") {
            if (rel.attributes?.fileName || rel.attributes?.file_name) {
              coverFileName =
                rel.attributes.fileName || rel.attributes.file_name;
              break;
            }
            // If no attributes, try to find in included array by ID
            if (rel.id && coverArtMap.has(rel.id)) {
              coverFileName = coverArtMap.get(rel.id);
              break;
            }
          }
        }

        // Construct cover URL
        let coverURL = "";
        if (coverFileName && mangaData.id) {
          const originalCoverURL = `${COVER_ART_BASE_URL}/covers/${mangaData.id}/${coverFileName}.256.jpg`;
          // Use proxy URL to ensure proper headers (Referer) are sent
          coverURL = constructProxyUrl(originalCoverURL, {
            referer: `${MANGA_DEX_BASE_URL}/`,
          });
          // Remove the protocol and host for relative URL (used in frontend)
          coverURL = coverURL.replace("http://localhost:8080", "");
        }

        return {
          title: title || "Untitled",
          cover_url: coverURL,
          identifier: mangaData.id || "",
        };
      });

    mango.log.info(`Found ${results.length} results`);
    return results;
  } catch (error) {
    mango.log.error(`Search failed: ${error.message}`);
    throw error;
  }
};

/**
 * Gets the list of chapters for a manga series
 * @param {string} seriesIdentifier - Manga ID
 * @param {object} mango - Mango API object
 */
exports.getChapters = async (seriesIdentifier, mango) => {
  mango.log.info(`Fetching chapters for series: ${seriesIdentifier}`);

  try {
    const allChapters = [];
    let offset = 0;
    const limit = 500;

    // Get timeout from config (in milliseconds) and convert to seconds
    const timeoutMs = mango.config?.timeout || 20000;
    const timeoutSec = timeoutMs / 1000;

    while (true) {
      const url = `${API_BASE_URL}/manga/${seriesIdentifier}/feed?limit=${limit}&offset=${offset}&order[volume]=desc&order[chapter]=desc&translatedLanguage[]=en`;
      const response = await mango.http.get(url, { timeout: timeoutSec });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch chapters: ${response.statusText}`);
      }

      const apiResponse = response.data;
      if (!apiResponse.data || apiResponse.data.length === 0) {
        break;
      }

      for (const chapterData of apiResponse.data) {
        const attrs = chapterData.attributes;
        const title = formatChapterTitle(attrs);

        allChapters.push({
          identifier: chapterData.id,
          title: title,
          volume: attrs.volume || "",
          chapter: attrs.chapter || "",
          pages: attrs.pages || 0,
          language: attrs.translatedLanguage || "",
          published_at: attrs.publishAt
            ? new Date(attrs.publishAt).toISOString()
            : "",
        });
      }

      if (apiResponse.data.length < limit) {
        break; // No more pages
      }
      offset += limit;
    }

    // Reverse to get ascending order (API returns descending)
    allChapters.reverse();

    mango.log.info(`Found ${allChapters.length} chapters`);
    return allChapters;
  } catch (error) {
    mango.log.error(`GetChapters failed: ${error.message}`);
    throw error;
  }
};

/**
 * Formats chapter title from attributes
 * @param {object} attrs - Chapter attributes
 * @returns {string} Formatted chapter title
 */
function formatChapterTitle(attrs) {
  const parts = [];
  if (attrs.volume) {
    parts.push(`Vol. ${attrs.volume}`);
  }
  if (attrs.chapter) {
    parts.push(`Ch. ${attrs.chapter}`);
  }
  if (attrs.title) {
    parts.push(attrs.title);
  }
  return parts.join(" ");
}

/**
 * Gets the page URLs for a chapter
 * @param {string} chapterIdentifier - Chapter ID
 * @param {object} mango - Mango API object
 */
exports.getPageURLs = async (chapterIdentifier, mango) => {
  mango.log.info(`Fetching page URLs for chapter: ${chapterIdentifier}`);

  try {
    const url = `${API_BASE_URL}/at-home/server/${chapterIdentifier}`;

    // Get timeout from config (in milliseconds) and convert to seconds
    const timeoutMs = mango.config?.timeout || 20000;
    const timeoutSec = timeoutMs / 1000;

    const response = await mango.http.get(url, { timeout: timeoutSec });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch page URLs: ${response.statusText}`);
    }

    const apiResponse = response.data;
    const baseURL = apiResponse.baseUrl;
    const hash = apiResponse.chapter.hash;
    const pageFiles = apiResponse.chapter.data || [];

    // MangaDex requires Referer header when fetching images
    // Use proxy URLs to include the necessary headers
    const pageURLs = pageFiles.map((pageFile) => {
      const imageUrl = `${baseURL}/data/${hash}/${pageFile}`;
      return constructProxyUrl(imageUrl, {
        referer: `${MANGA_DEX_BASE_URL}/`,
      });
    });

    mango.log.info(`Found ${pageURLs.length} pages (using proxy URLs)`);
    return pageURLs;
  } catch (error) {
    mango.log.error(`GetPageURLs failed: ${error.message}`);
    throw error;
  }
};

