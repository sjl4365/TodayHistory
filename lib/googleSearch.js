import axios from 'axios';
// import { GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID } from '@env';

const GOOGLE_SEARCH_API_KEY=""
const GOOGLE_SEARCH_ENGINE_ID=""

export async function fetchImageForContent(searchQuery, maxResults = 3) {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('⚠️ Google Search API credentials not configured');
    return null;
  }

  try {
    // 검색어 정제 (너무 길면 첫 50자만)
    const cleanQuery = searchQuery.replace(/[•\n]/g, ' ').trim().slice(0, 50);
    
    console.log('🔎 Original query (full):', searchQuery);
    console.log('🔎 Clean query (will use):', cleanQuery);
    console.log('📏 Query length:', cleanQuery.length);
    
    const baseUrl = 'https://www.googleapis.com/customsearch/v1';
    const params = new URLSearchParams({
      key: GOOGLE_SEARCH_API_KEY,
      cx: GOOGLE_SEARCH_ENGINE_ID,
      q: cleanQuery,
      searchType: 'image',
      num: maxResults.toString(),
      imgSize: 'large',
      safe: 'active',
      fileType: 'jpg,png',
    });

    const fullUrl = `${baseUrl}?${params.toString()}`;
    
    console.log('📡 Full API URL:', fullUrl);

    // fetch 사용 (React Native 네이티브)
    const response = await Promise.race([
      fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      )
    ]);

    console.log('✅ Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('✅ Found images:', data?.items?.length || 0);

    if (data?.items?.length > 0) {
      const imageUrl = data.items[0].link;
      console.log('🖼️ Selected image:', imageUrl);
      return imageUrl;
    }

    console.warn('⚠️ No images found in response');
    return null;
  } catch (error) {
    console.error('❌ Google Image Search failed:', error.message);
    console.error('Error details:', error);
    return null;
  }
}