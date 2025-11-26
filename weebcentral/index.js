/**
 * WeebCentral Plugin for Mango-Go
 * Downloads manga from WeebCentral (https://weebcentral.com)
 */

const BASE_URL = "https://weebcentral.com";
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
 * Searches for manga on WeebCentral
 * @param {string} query - Search query
 * @param {object} mango - Mango API object
 */
exports.search = async (query, mango) => {
  mango.log.info(`Searching WeebCentral for: ${query}`);

  try {
    const searchURL = `${BASE_URL}/search/simple?location=main`;
    const formData = `text=${encodeURIComponent(query)}`;

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "HX-Request": "true",
      "HX-Trigger": "quick-search-input",
      "HX-Trigger-Name": "text",
      "HX-Target": "quick-search-result",
      "HX-Current-URL": `${BASE_URL}/`,
      Referer: `${BASE_URL}/`,
      Origin: BASE_URL,
    };

    const response = await mango.http.post(searchURL, formData, { headers });

    if (response.status !== 200) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    // Parse HTML response
    let html = response.data;

    // Handle case where response.data might be a string or object
    if (typeof html !== "string") {
      if (html && typeof html.toString === "function") {
        html = html.toString();
      } else {
        mango.log.warn(
          "Unexpected response format, attempting to parse as string"
        );
        html = String(html || "");
      }
    }

    if (!html || html.trim().length === 0) {
      mango.log.info("Empty response from search");
      return [];
    }

    // Use utils.parseHTML if available, otherwise fall back to regex parsing
    let doc = null;
    if (mango.utils && mango.utils.parseHTML) {
      doc = mango.utils.parseHTML(html);
    } else {
      throw new Error("parseHTML not available in mango.utils");
    }

    if (!doc) {
      throw new Error("Failed to parse HTML response");
    }

    const results = [];
    const links = doc.querySelectorAll("#quick-search-result > div > a");

    // Also try alternative selectors in case the structure changed
    let searchLinks = links;
    if (!searchLinks || searchLinks.length === 0) {
      searchLinks = doc.querySelectorAll("#quick-search-result a");
    }
    if (!searchLinks || searchLinks.length === 0) {
      searchLinks = doc.querySelectorAll(".search-result a, [data-series-id]");
    }

    for (let i = 0; i < searchLinks.length; i++) {
      const link = searchLinks[i];
      const href = link.getAttribute("href");
      if (!href) continue;

      // Extract title
      const titleElement = link.querySelector(".flex-1");
      let title = titleElement ? titleElement.textContent.trim() : "";

      // Fallback: try to get title from link text or other elements
      if (!title) {
        title = link.textContent?.trim() || "";
      }
      if (!title) {
        const titleSpan = link.querySelector("span, div");
        title = titleSpan ? titleSpan.textContent.trim() : "";
      }

      // Extract image
      let image = "";
      const source = link.querySelector("source");
      if (source && source.getAttribute) {
        image =
          source.getAttribute("srcset") || source.getAttribute("src") || "";
        // Extract first URL from srcset if it's a responsive image
        if (image.includes(",")) {
          image = image.split(",")[0].trim().split(" ")[0];
        }
      }
      if (!image) {
        const img = link.querySelector("img");
        if (img && img.getAttribute) {
          image = img.getAttribute("src") || img.getAttribute("data-src") || "";
        }
      }

      // Extract manga ID from link (format: /series/{id}/ or /series/{id})
      let idPart = "";
      const parts = href.split("/series/");
      if (parts.length > 1) {
        const subparts = parts[1].split("/");
        idPart = subparts[0];
      } else {
        // Try alternative format: might be just the ID or different path
        const match = href.match(/\/series\/([^\/]+)/);
        if (match && match[1]) {
          idPart = match[1];
        }
      }

      if (idPart && title) {
        results.push({
          title: title || "Untitled",
          cover_url: image,
          identifier: idPart,
        });
      }
    }

    if (results.length === 0) {
      mango.log.info("No results found");
      return [];
    }

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
    const chapterURL = `${BASE_URL}/series/${seriesIdentifier}/full-chapter-list`;

    const headers = {
      "HX-Request": "true",
      "HX-Target": "chapter-list",
      "HX-Current-URL": `${BASE_URL}/series/${seriesIdentifier}`,
      Referer: `${BASE_URL}/series/${seriesIdentifier}`,
    };

    const response = await mango.http.get(chapterURL, { headers });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch chapters: ${response.statusText}`);
    }

    // Parse HTML response
    const html = response.data;

    if (!mango.utils || !mango.utils.parseHTML) {
      throw new Error("parseHTML not available in mango.utils");
    }
    const doc = mango.utils.parseHTML(html);

    const chapters = [];
    const chapterRegex = /(\d+(?:\.\d+)?)/;
    const chapterItems = doc.querySelectorAll("div.flex.items-center");

    for (let i = 0; i < chapterItems.length; i++) {
      const item = chapterItems[i];
      const a = item.querySelector("a");
      if (!a) continue;

      const chapterLink = a.getAttribute("href");
      if (!chapterLink) continue;

      // Extract chapter title
      let chapterTitle = "";
      const titleSpan = a.querySelector("span.grow > span");
      if (titleSpan && titleSpan.textContent) {
        chapterTitle = titleSpan.textContent.trim();
      }

      // Extract chapter number
      let chapterNumber = "";
      const match = chapterTitle.match(chapterRegex);
      if (match && match[1]) {
        chapterNumber = cleanChapterNumber(match[1]);
      }

      // Extract chapter ID from URL (format: /chapters/{id})
      let chapterId = "";
      const parts = chapterLink.split("/chapters/");
      if (parts.length > 1) {
        chapterId = parts[1];
      }

      // Extract published date
      let publishedAt = "";
      const timeTag = item.querySelector("time");
      if (timeTag && timeTag.getAttribute) {
        const datetime = timeTag.getAttribute("datetime");
        if (datetime) {
          publishedAt = datetime;
        }
      }

      if (chapterId) {
        chapters.push({
          identifier: chapterId,
          title: chapterTitle,
          chapter: chapterNumber,
          published_at: publishedAt,
        });
      }
    }

    if (chapters.length === 0) {
      throw new Error("No chapters found");
    }

    // Reverse to ascending order
    chapters.reverse();

    // Sort by chapter number
    chapters.sort((a, b) => {
      const aNum = parseFloat(a.chapter) || 0;
      const bNum = parseFloat(b.chapter) || 0;
      return aNum - bNum;
    });

    mango.log.info(`Found ${chapters.length} chapters`);
    return chapters;
  } catch (error) {
    mango.log.error(`GetChapters failed: ${error.message}`);
    throw error;
  }
};

/**
 * Gets the page URLs for a chapter
 * @param {string} chapterIdentifier - Chapter ID
 * @param {object} mango - Mango API object
 */
exports.getPageURLs = async (chapterIdentifier, mango) => {
  mango.log.info(`Fetching page URLs for chapter: ${chapterIdentifier}`);

  try {
    const pageURL = `${BASE_URL}/chapters/${chapterIdentifier}/images?is_prev=False&reading_style=long_strip`;

    const headers = {
      "HX-Request": "true",
      "HX-Current-URL": `${BASE_URL}/chapters/${chapterIdentifier}`,
      Referer: `${BASE_URL}/chapters/${chapterIdentifier}`,
    };

    const response = await mango.http.get(pageURL, { headers });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch page URLs: ${response.statusText}`);
    }

    // Parse HTML response
    const html = response.data;

    if (!mango.utils || !mango.utils.parseHTML) {
      throw new Error("parseHTML not available in mango.utils");
    }
    const doc = mango.utils.parseHTML(html);

    const pages = [];
    let images = doc.querySelectorAll("section.flex-1 img");

    if (images.length === 0) {
      images = doc.querySelectorAll("img");
    }

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const src = img.getAttribute("src");
      if (src && src.trim() !== "") {
        // Extract origin from image URL for proper referer
        let imageOrigin = "";
        let imageReferer = `${BASE_URL}/chapters/${chapterIdentifier}`;
        try {
          const urlObj = new URL(src);
          imageOrigin = urlObj.origin;
          // Some CDNs require referer to match their domain
          // Try using the image domain as referer first
          imageReferer = `${imageOrigin}/`;
        } catch (e) {
          // If URL parsing fails, use BASE_URL as fallback
          imageOrigin = BASE_URL;
        }

        // WeebCentral images require proper headers when fetching
        // Use proxy URLs to include the necessary headers
        const proxyUrl = constructProxyUrl(src, {
          referer: imageReferer,
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          origin: imageOrigin,
        });
        pages.push(proxyUrl);
      }
    }

    if (pages.length === 0) {
      throw new Error("No pages found");
    }

    mango.log.info(`Found ${pages.length} pages (using proxy URLs)`);
    return pages;
  } catch (error) {
    mango.log.error(`GetPageURLs failed: ${error.message}`);
    throw error;
  }
};

/**
 * Cleans chapter number string
 * @param {string} chapterStr - Chapter number string
 * @returns {string} Cleaned chapter number
 */
function cleanChapterNumber(chapterStr) {
  let cleaned = chapterStr.replace(/^0+/, "");
  if (cleaned === "") {
    return "0";
  }
  return cleaned;
}

