/**
 * Webtoons Plugin for Mango-Go
 * Downloads webtoons from webtoons.com
 */

const BASE_URL = "https://www.webtoons.com";
const MOBILE_URL = "https://m.webtoons.com";
const SEARCH_URL = "https://www.webtoons.com/en/search/immediate?keyword=";
const SEARCH_PARAMS = "&q_enc=UTF-8&st=1&r_format=json&r_enc=UTF-8";
const THUMBNAIL_URL = "https://webtoon-phinf.pstatic.net";
const PROXY_BASE_URL = "http://localhost:8080/api/proxy/resource";

/**
 * Constructs a proxy URL for an image resource
 * @param {string} imageUrl - The original image URL to proxy
 * @param {object} options - Optional headers and configuration
 * @param {string} options.referer - Referer header value
 * @param {string} options.userAgent - User-Agent header value
 * @param {string} options.origin - Origin header value
 * @returns {string} The proxy URL
 */
function constructProxyUrl(imageUrl, options = {}) {
  const params = [];
  params.push("url=" + encodeURIComponent(imageUrl));

  if (options.referer) {
    params.push("referer=" + encodeURIComponent(options.referer));
  }

  if (options.userAgent) {
    params.push("user-agent=" + encodeURIComponent(options.userAgent));
  }

  if (options.origin) {
    params.push("origin=" + encodeURIComponent(options.origin));
  }

  return PROXY_BASE_URL + "?" + params.join("&");
}

/**
 * Returns plugin metadata
 */
exports.getInfo = () => ({
  id: "webtoons",
  name: "Webtoons",
  version: "1.0.0",
});

/**
 * Searches for webtoons
 * @param {string} query - Search query
 * @param {object} mango - Mango API object
 */
exports.search = async (query, mango) => {
  mango.log.info(`Searching Webtoons for: ${query}`);

  try {
    const searchUrl = SEARCH_URL + encodeURIComponent(query) + SEARCH_PARAMS;
    const headers = { Referer: BASE_URL + "/" };

    const response = await mango.http.get(searchUrl, { headers: headers });

    if (response.status !== 200) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const search = response.data;

    if (!search.result || search.result.total === 0) {
      mango.log.info("No results found");
      return [];
    }

    const searchedItems = search.result.searchedList || [];
    const results = searchedItems
      .filter((item) => item.titleNo != null)
      .map((item) => {
        // Construct cover URL properly
        let coverUrl = "";
        const thumbnail = item.thumbnailImage2 || item.thumbnailMobile;
        if (thumbnail) {
          // Thumbnails from API are usually paths like "/thumbnail/icon_webtoon/6795/..."
          // or full URLs. Handle both cases
          if (
            thumbnail.startsWith("http://") ||
            thumbnail.startsWith("https://")
          ) {
            coverUrl = thumbnail;
          } else {
            // Ensure path starts with / for proper URL construction
            const thumbPath = thumbnail.startsWith("/")
              ? thumbnail
              : "/" + thumbnail;
            coverUrl = THUMBNAIL_URL + thumbPath;
          }
        }

        // If cover URL is from webtoons, proxy it through Mango-Go to add referer header
        let finalCoverUrl = coverUrl;
        if (coverUrl && coverUrl.includes("webtoon-phinf.pstatic.net")) {
          // Use the generic resource proxy for cover images
          // This adds necessary headers (Referer) to bypass restrictions
          finalCoverUrl = constructProxyUrl(coverUrl, {
            referer: BASE_URL + "/",
          });
          // Remove the protocol and host for relative URL (used in frontend)
          finalCoverUrl = finalCoverUrl.replace("http://localhost:8080", "");
        }

        return {
          title: item.title || "Untitled",
          cover_url: finalCoverUrl,
          identifier: String(item.titleNo),
        };
      });

    mango.log.info(`Found ${results.length} results`);
    return results;
  } catch (error) {
    mango.log.error(`Search failed: ${error.message}`);
    throw new Error(`Failed to search: ${error.message}`);
  }
};

/**
 * Gets chapters for a webtoon
 * @param {string} seriesId - Series identifier (titleNo)
 * @param {object} mango - Mango API object
 */
exports.getChapters = async (seriesId, mango) => {
  mango.log.info(`Fetching chapters for series: ${seriesId}`);

  try {
    const allEpisodes = [];
    let cursor = 0;
    const pageSize = 100;

    // Fetch all episodes with pagination
    do {
      let episodesApiUrl = `${MOBILE_URL}/api/v1/webtoon/${seriesId}/episodes?pageSize=${pageSize}&cursor=${cursor}`;

      mango.log.debug(`Fetching episodes from: ${episodesApiUrl}`);

      const episodesResponse = await mango.http.get(episodesApiUrl);

      if (episodesResponse.status !== 200) {
        throw new Error(
          `Episodes API returned status ${episodesResponse.status}: ${episodesResponse.statusText}`
        );
      }

      if (!episodesResponse.data) {
        throw new Error("Episodes API returned no data");
      }

      const responseData = episodesResponse.data;

      if (!responseData.success) {
        throw new Error("Episodes API returned success=false");
      }

      if (
        !responseData.result ||
        !responseData.result.episodeList ||
        !Array.isArray(responseData.result.episodeList)
      ) {
        throw new Error("Invalid API response structure");
      }

      const episodes = responseData.result.episodeList;
      allEpisodes.push(...episodes);

      mango.log.debug(
        `Fetched ${episodes.length} episodes (total: ${allEpisodes.length})`
      );

      // Check if there's a next page
      cursor = responseData.result.nextCursor || null;
    } while (cursor !== null);

    if (allEpisodes.length === 0) {
      mango.log.warn("No episodes found");
      return [];
    }

    mango.log.info(`Found ${allEpisodes.length} episodes from API`);

    // Parse episodes into chapters
    const chapters = allEpisodes.map((episode) => {
      // Extract episode number
      const episodeNo = episode.episodeNo || "0";

      // Extract title
      const title = episode.episodeTitle || `Episode ${episodeNo}`;

      // Extract date from exposureDateMillis
      let publishedAt = new Date().toISOString();
      if (episode.exposureDateMillis) {
        try {
          const date = new Date(episode.exposureDateMillis);
          if (!isNaN(date.getTime())) {
            publishedAt = date.toISOString();
          }
        } catch (e) {
          // Use default if date parsing fails
        }
      }

      // Create chapter identifier: id{titleNo}viewerLink{viewerLink}chNum{num}
      const chapterId =
        `id${seriesId}viewerLink${episode.viewerLink}chNum${episodeNo}`.replace(
          /-/g,
          "_"
        );

      return {
        identifier: chapterId,
        title: String(title).trim(),
        volume: "",
        chapter: String(episodeNo),
        pages: 0,
        language: "en",
        group_id: "",
        published_at: publishedAt,
      };
    });

    // Sort by chapter number (ascending)
    chapters.sort((a, b) => {
      const aNum = parseFloat(a.chapter) || 0;
      const bNum = parseFloat(b.chapter) || 0;
      return aNum - bNum;
    });

    mango.log.info(`Successfully parsed ${chapters.length} chapters`);
    return chapters;
  } catch (error) {
    mango.log.error(`GetChapters failed: ${error.message}`);
    throw new Error(`Failed to get chapters: ${error.message}`);
  }
};

/**
 * Gets page URLs for a chapter
 * @param {string} chapterId - Chapter identifier
 * @param {object} mango - Mango API object
 */
exports.getPageURLs = async (chapterId, mango) => {
  mango.log.info(`Fetching page URLs for chapter: ${chapterId}`);

  // Parse chapter ID: id{titleNo}ch{slug}num{num}
  const idMatch = chapterId.match(/id(\d+)viewerLink(.+)chNum(.+)/);
  if (!idMatch) {
    throw new Error("Invalid chapter ID format");
  }

  const mangaID = idMatch[1];
  const viewerLink = idMatch[2];
  // const chapterNum = idMatch[3].replace(/_/g, ".");

  // Construct viewer URL - try mobile first since API is from mobile
  let finalUrl;
  let baseUrl = BASE_URL;

  if (viewerLink.startsWith("http://") || viewerLink.startsWith("https://")) {
    finalUrl = viewerLink;
    // Extract base URL from absolute URL
    const urlMatch = viewerLink.match(/^(https?:\/\/[^/]+)/);
    if (urlMatch) {
      baseUrl = urlMatch[1];
    }
  } else {
    finalUrl =
      BASE_URL + (viewerLink.startsWith("/") ? viewerLink : "/" + viewerLink);
  }

  mango.log.debug(`Fetching viewer URL: ${finalUrl}`);

  const resp = await mango.http.get(finalUrl);

  if (resp.status === 200) {
    // Parse HTML to extract images
    const html = resp.text();

    // Extract _imageList div content
    const imageListDivMatch = html.match(
      /<div[^>]*id=["']_imageList["'][^>]*>([\s\S]*?)<\/div>/i
    );

    if (!imageListDivMatch) {
      throw new Error("_imageList div not found in chapter viewer");
    }

    const imageListContent = imageListDivMatch[1];

    // Extract image URLs with data-url attribute from _imageList div only
    const imageListRegex = /<img[^>]+data-url=["']([^"']+)["']/gi;
    const imageUrls = [];
    let imgMatch;

    while ((imgMatch = imageListRegex.exec(imageListContent)) !== null) {
      imageUrls.push(imgMatch[1]);
    }

    if (imageUrls.length === 0) {
      throw new Error("No images found in _imageList div");
    }

    // Convert image URLs to proxy URLs
    // This ensures proper headers (Referer) are sent when downloading
    const proxyUrls = imageUrls.map((imageUrl) => {
      return constructProxyUrl(imageUrl, {
        referer: BASE_URL + "/",
      });
    });

    mango.log.info(`Found ${proxyUrls.length} pages (using proxy URLs)`);
    return proxyUrls;
  } else {
    throw new Error(
      `Failed to get chapter viewer: ${resp.status} ${resp.statusText}`
    );
  }
};
