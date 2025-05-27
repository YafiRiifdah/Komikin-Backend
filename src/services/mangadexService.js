const axios = require('axios');

const mangadexApi = axios.create({
  baseURL: 'https://api.mangadex.org',
});

// --- Bagian Cache ---
const cache = new Map(); // Gunakan Map untuk menyimpan cache
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache Time-To-Live: 5 menit (dalam milidetik)
// --- Akhir Bagian Cache ---

const searchManga = async (params = {}) => {
  try {
    const defaultParams = {
      limit: params.limit || 20,
      'includes[]': ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive'],
    };
    const requestParams = { ...defaultParams, ...params };
    if(params.limit === undefined) requestParams.limit = defaultParams.limit;

    // Log untuk debugging jika ada parameter ids[]
    if (requestParams['ids[]']) {
        console.log("DEBUG [mangadexService.searchManga]: Fetching manga by IDs:", requestParams['ids[]']);
    }

    const response = await mangadexApi.get('/manga', { params: requestParams });

    const formattedData = response.data.data.map(manga => {
        const coverArt = manga.relationships.find(rel => rel.type === 'cover_art');
        const author = manga.relationships.find(rel => rel.type === 'author');
        const artist = manga.relationships.find(rel => rel.type === 'artist');

        const coverFileName = coverArt ? coverArt.attributes.fileName : 'no-cover.jpg';
        let coverUrl = `https://placehold.co/256x362/222/fff?text=No+Cover`;
        if (manga.id && coverFileName !== 'no-cover.jpg') {
            coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg`;
        }

        return {
            id: manga.id,
            title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'N/A',
            description: (manga.attributes.description.en || manga.attributes.description.id || 'No description available.').substring(0, 200) + '...',
            status: manga.attributes.status,
            year: manga.attributes.year,
            tags: manga.attributes.tags.map(tag => tag.attributes.name.en).filter(name => name),
            coverUrl: coverUrl,
            author: author ? author.attributes.name : 'Unknown',
            artist: artist ? artist.attributes.name : 'Unknown',
            latestUploadedChapter: manga.attributes.latestUploadedChapter,
        };
    });

    return {
        results: formattedData,
        limit: response.data.limit,
        offset: response.data.offset,
        total: response.data.total,
    };

  } catch (error) {
    console.error('Error fetching manga from MangaDex:', error.response ? error.response.data : error.message);
    throw new Error('Gagal mengambil data manga dari MangaDex.');
  }
};

const getLatestUpdates = async (limit = 20, offset = 0) => {
  const cacheKey = `latestManga_limit${limit}_offset${offset}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL_MS)) {
    console.log(`>>> Mengambil '${cacheKey}' dari cache`);
    return cachedData.data;
  }

  console.log(`>>> Mengambil '${cacheKey}' dari MangaDex API (cache miss atau expired)`);
  const data = await searchManga({ 'order[latestUploadedChapter]': 'desc', limit, offset });
  cache.set(cacheKey, { data: data, timestamp: Date.now() });
  return data;
};

const getPopularManga = async (limit = 20, offset = 0) => {
  const cacheKey = `popularManga_limit${limit}_offset${offset}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL_MS)) {
    console.log(`>>> Mengambil '${cacheKey}' dari cache`);
    return cachedData.data;
  }

  console.log(`>>> Mengambil '${cacheKey}' dari MangaDex API (cache miss atau expired)`);
  const data = await searchManga({ 'order[followedCount]': 'desc', limit, offset });
  cache.set(cacheKey, { data: data, timestamp: Date.now() });
  return data;
};

const getGenres = async () => {
  const cacheKey = 'genresList'; // Genre biasanya tidak berubah terlalu sering
  const cachedData = cache.get(cacheKey);

  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL_MS * 12)) { // Cache genre lebih lama, misal 1 jam
    console.log(`>>> Mengambil '${cacheKey}' dari cache`);
    return cachedData.data;
  }

  console.log(`>>> Mengambil '${cacheKey}' dari MangaDex API (cache miss atau expired)`);
  try {
    const response = await mangadexApi.get('/manga/tag');
    const data = response.data.data.map(tag => ({
        id: tag.id,
        name: tag.attributes.name.en,
        group: tag.attributes.group,
    })).filter(tag => tag.name);
    cache.set(cacheKey, { data: data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error('Error fetching genres:', error.response ? error.response.data : error.message);
    throw new Error('Gagal mengambil daftar genre.');
  }
};

const getMangaFeed = async (mangaId, params = {}) => {
  // Caching untuk feed bisa lebih kompleks karena parameternya banyak
  // Untuk sekarang, kita biarkan tanpa cache, atau Anda bisa membuat cacheKey yang lebih canggih
  try {
    const defaultParams = {
      limit: params.limit || 500,
      offset: params.offset || 0,
      'translatedLanguage[]': ['id', 'en'],
      'order[volume]': 'asc',
      'order[chapter]': 'asc',
      'includes[]': ['scanlation_group'],
    };
    const requestParams = { ...defaultParams, ...params };
    if(params.limit === undefined) requestParams.limit = defaultParams.limit;
    if(params.offset === undefined) requestParams.offset = defaultParams.offset;

    const response = await mangadexApi.get(`/manga/${mangaId}/feed`, { params: requestParams });

    return response.data.data.map(chapter => {
        const scanGroup = chapter.relationships.find(rel => rel.type === 'scanlation_group');
        return {
            id: chapter.id,
            volume: chapter.attributes.volume,
            chapter: chapter.attributes.chapter,
            title: chapter.attributes.title,
            language: chapter.attributes.translatedLanguage,
            pages: chapter.attributes.pages,
            publishAt: chapter.attributes.publishAt,
            scanlationGroup: scanGroup ? scanGroup.attributes.name : 'Unknown',
        };
    });
  } catch (error) {
    console.error(`Error fetching feed for manga ${mangaId}:`, error.message);
    throw new Error('Gagal mengambil daftar chapter.');
  }
};

const getChapterPages = async (chapterId) => {
  // Data halaman chapter biasanya unik per request dan tidak ideal untuk di-cache lama
  // karena URL dari /at-home/server bisa berubah.
  try {
    const serverResponse = await mangadexApi.get(`/at-home/server/${chapterId}`);
    const { baseUrl, chapter } = serverResponse.data;
    const { hash, data, dataSaver } = chapter;

    const pages = data.map(pageFile => `${baseUrl}/data/${hash}/${pageFile}`);
    const pagesSaver = dataSaver.map(pageFile => `${baseUrl}/data-saver/${hash}/${pageFile}`);

    return {
        id: chapterId,
        baseUrl: baseUrl,
        hash: hash,
        pages: pages,
        pagesSaver: pagesSaver,
    };
  } catch (error) {
       console.error(`Error fetching pages for chapter ${chapterId}:`, error.message);
       throw new Error('Gagal mengambil halaman chapter.');
  }
};

module.exports = {
  searchManga,
  getLatestUpdates,
  getPopularManga,
  getGenres,
  getMangaFeed,
  getChapterPages,
};
