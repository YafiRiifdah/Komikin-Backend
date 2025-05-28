const axios = require('axios');

const mangadexApi = axios.create({
  baseURL: 'https://api.mangadex.org',
});

// --- Bagian Cache ---
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit
// --- Akhir Bagian Cache ---

const searchManga = async (params = {}) => {
  // ... (kode searchManga tetap sama seperti di Canvas sebelumnya) ...
  try {
    const defaultParams = {
      limit: params.limit || 20,
      'includes[]': ['cover_art', 'author', 'artist'],
      'contentRating[]': ['safe', 'suggestive'],
    };
    const requestParams = { ...defaultParams, ...params };
    if(params.limit === undefined) requestParams.limit = defaultParams.limit;

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
    return { results: formattedData, limit: response.data.limit, offset: response.data.offset, total: response.data.total };
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
  const cacheKey = 'genresList';
  const cachedData = cache.get(cacheKey);
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL_MS * 12)) {
    console.log(`>>> Mengambil '${cacheKey}' dari cache`);
    return cachedData.data;
  }
  console.log(`>>> Mengambil '${cacheKey}' dari MangaDex API (cache miss atau expired)`);
  try {
    const response = await mangadexApi.get('/manga/tag');
    const data = response.data.data.map(tag => ({ id: tag.id, name: tag.attributes.name.en, group: tag.attributes.group })).filter(tag => tag.name);
    cache.set(cacheKey, { data: data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error('Error fetching genres:', error.response ? error.response.data : error.message);
    throw new Error('Gagal mengambil daftar genre.');
  }
};

const getMangaFeed = async (mangaId, params = {}) => {
  console.log(`[mangadexService.getMangaFeed] DITERIMA - Manga ID: ${mangaId}, Params Asli:`, JSON.stringify(params)); // <-- Log Awal Service
  try {
    const defaultParams = {
      'translatedLanguage[]': ['id', 'en'],
      'order[volume]': 'asc',
      'order[chapter]': 'asc',
      'includes[]': ['scanlation_group'],
      limit: 500, // Default limit yang tinggi untuk feed
      offset: 0,   // Default offset
    };
    // Gabungkan params dari controller, prioritaskan params dari controller
    const requestParams = { 
        ...defaultParams, 
        ...params 
    };
    // Pastikan limit dan offset yang valid jika dikirim dari controller
    if (params.limit !== undefined) requestParams.limit = Number(params.limit) || defaultParams.limit;
    if (params.offset !== undefined) requestParams.offset = Number(params.offset) || defaultParams.offset;


    console.log(`[mangadexService.getMangaFeed] MEMANGGIL MangaDex API /manga/${mangaId}/feed dengan requestParams:`, JSON.stringify(requestParams)); // <-- Log Sebelum Axios
    const response = await mangadexApi.get(`/manga/${mangaId}/feed`, { params: requestParams });
    console.log(`[mangadexService.getMangaFeed] BERHASIL dapat response dari MangaDex API, Status: ${response.status}, Jumlah data: ${response.data.data.length}`); // <-- Log Setelah Axios

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
    // Ini log yang penting jika panggilan Axios gagal
    const errorDetails = error.isAxiosError && error.response ? error.response.data : error.message;
    console.error(`[mangadexService.getMangaFeed] ERROR saat fetch dari MangaDex - Manga ID: ${mangaId}:`, errorDetails);
    console.error(`[mangadexService.getMangaFeed] ERROR STACK:`, error.stack);
    throw new Error('Gagal mengambil daftar chapter.'); // Error ini yang akan dikirim ke controller
  }
};

const getChapterPages = async (chapterId) => {
  // ... (kode getChapterPages tetap sama seperti di Canvas sebelumnya) ...
  try {
    console.log(`[mangadexService.getChapterPages] Requesting pages for chapterId: ${chapterId}`);
    const serverResponse = await mangadexApi.get(`/at-home/server/${chapterId}`);
    console.log(`[mangadexService.getChapterPages] Got server response for chapterId: ${chapterId}`);
    const { baseUrl, chapter } = serverResponse.data;
    const { hash, data, dataSaver } = chapter;
    const pages = data.map(pageFile => `${baseUrl}/data/${hash}/${pageFile}`);
    const pagesSaver = dataSaver.map(pageFile => `${baseUrl}/data-saver/${hash}/${pageFile}`);
    return { id: chapterId, baseUrl, hash, pages, pagesSaver };
  } catch (error) {
     const errorDetails = error.isAxiosError && error.response ? error.response.data : error.message;
     console.error(`[mangadexService.getChapterPages] Error fetching pages for chapter ${chapterId}:`, errorDetails);
     console.error(`[mangadexService.getChapterPages] ERROR STACK:`, error.stack);
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