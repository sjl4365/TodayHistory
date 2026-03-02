export async function fetchWikipediaImage(searchQuery, language = 'en') {
  if (!searchQuery || typeof searchQuery !== 'string') {
    console.warn('Invalid search query for Wikipedia');
    return null;
  }

  const langMap = {
    ko: 'ko.wikipedia.org',
    ja: 'ja.wikipedia.org',
    en: 'en.wikipedia.org',
  };
  const domain = langMap[language] || langMap.en;

  try {
    const cleanQuery = searchQuery.trim();
    console.log(`Wikipedia search: "${cleanQuery}" (${language})`);

    // 1단계: 검색어로 페이지 제목 찾기
    const searchUrl = `https://${domain}/w/api.php?` + new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: cleanQuery,
      format: 'json',
      srlimit: '1',
      origin: '*',
    });

    const searchResponse = await Promise.race([
      fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Histree/1.0 (Educational History App)',
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), 8000)
      )
    ]);

    if (!searchResponse.ok) {
      throw new Error(`Wikipedia search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const searchResults = searchData?.query?.search || [];

    if (searchResults.length === 0) {
      console.warn(`No Wikipedia page found for "${cleanQuery}"`);
      return null;
    }

    const pageTitle = searchResults[0].title;
    console.log(`Found page: "${pageTitle}"`);

    // ✅ 검색어와 페이지 제목이 실제로 일치하는지 확인
    // 단순 리스트 검색 결과(관련 없는 페이지)인 경우 이미지 가져오지 않음
    const normalize = (str) => str.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    const queryNorm = normalize(cleanQuery);
    const titleNorm = normalize(pageTitle);

    const isTitleMatch =
      titleNorm === queryNorm ||
      titleNorm.includes(queryNorm) ||
      queryNorm.includes(titleNorm);

    if (!isTitleMatch) {
      console.warn(
        `Page title "${pageTitle}" does not match query "${cleanQuery}" — skipping image fetch`
      );
      return null;
    }

    // 2단계: 페이지의 대표 이미지 가져오기
    const imageUrl = `https://${domain}/w/api.php?` + new URLSearchParams({
      action: 'query',
      titles: pageTitle,
      prop: 'pageimages',
      format: 'json',
      pithumbsize: '800',
      origin: '*',
    });

    const imageResponse = await Promise.race([
      fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Histree/1.0 (Educational History App)',
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Image fetch timeout')), 8000)
      )
    ]);

    if (!imageResponse.ok) {
      throw new Error(`Wikipedia image fetch failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    const pages = imageData?.query?.pages || {};
    const pageId = Object.keys(pages)[0];

    if (!pageId || pageId === '-1') {
      console.warn('Page not found');
      return null;
    }

    const thumbnail = pages[pageId]?.thumbnail?.source;

    if (thumbnail) {
      console.log(`Wikipedia image found: ${thumbnail}`);
      return thumbnail;
    }

    console.warn('No image available for this page');
    return null;

  } catch (error) {
    console.error('Wikipedia API error:', error.message);
    return null;
  }
}

export async function fetchWikipediaImageFromAnchors(anchorTexts, language = 'en') {
  if (!Array.isArray(anchorTexts) || anchorTexts.length === 0) {
    console.warn('No anchor texts provided');
    return null;
  }

  const validAnchors = anchorTexts.filter(
    anchor => anchor && typeof anchor === 'string' && anchor.trim()
  );

  if (validAnchors.length === 0) {
    console.warn('No valid anchor texts found');
    return null;
  }

  console.log(`Trying ${validAnchors.length} anchor text(s):`, validAnchors);

  for (let i = 0; i < validAnchors.length; i++) {
    const anchor = validAnchors[i];
    console.log(`Attempting anchor text ${i + 1}/${validAnchors.length}: "${anchor}"`);

    const imageUrl = await fetchWikipediaImage(anchor, language);

    if (imageUrl) {
      console.log(`Success with anchor text ${i + 1}: "${anchor}"`);
      return imageUrl;
    } else {
      console.log(`Failed with anchor text ${i + 1}: "${anchor}"`);
    }
  }

  console.warn(`No Wikipedia images found from any of ${validAnchors.length} anchor text(s)`);
  return null;
}