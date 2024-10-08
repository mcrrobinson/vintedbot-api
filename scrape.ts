import fs from 'fs';

interface Brand {
    id: number;
    title: string;
}

export const FRONTEND_URL = "https://www.vinted.co.uk";
export const API_URL = "https://www.vinted.co.uk/api/v2";
export const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36"
  };

export async function getCookie(): Promise<string> {
    const response = await fetch(FRONTEND_URL, {
      method: 'GET',
      headers: HEADERS,
      credentials: 'include'
    });

    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      const sessionCookie = cookies.split(',').map((cookie) => cookie.trim()).find((cookie: string) => cookie.startsWith("_vinted_fr_session"));
      if(!sessionCookie){
        throw Error("wasn't able to find cookie in string, contained cookies: " + cookies)
      }
      return sessionCookie.split(';')[0].split('=')[1];
    } else {
      throw Error("set cookie wasn't found in header")
    }
}

export async function getPopularBrands(cookie: string) {
    // Get an array of letters from A to Z
    const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

    const brands = alphabet.map(async (letter) => {
        const response = await fetch(`${API_URL}/brands/popular?letter=${letter}`, {
            method: 'GET',
            headers: {
                ...HEADERS,
                'Cookie': `_vinted_fr_session=${cookie}`
            }
        });
    
        const data = await response.json();
        return data.brands.map((brand: Brand) => { return { id: brand.id, title: brand.title } });
    });


    return (await Promise.all(brands)).flat();
}

export async function getItems(cookie: string, page: number = 1, session_id: string = "") {
  const time = Math.floor(Date.now() / 1000);
  const endpoint = `catalog/items?page=1&per_page=96&time=${time}}&search_text=&catalog_ids=34&price_to=50&currency=GBP&order=newest_first&size_ids=1642&brand_ids=53&status_ids=6&color_ids=&patterns_ids=&material_ids=`;
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
        ...HEADERS,
        'Cookie': `_vinted_fr_session=${cookie}`
    }
  })

  if (!response.ok) {
    throw Error(`Failed to fetch items, status code: ${response.status}`);
  }

  if(response.status !== 200){
    throw Error(`Failed to fetch items, status code: ${response.status}`);
  }

  return await response.json();
}

const now = Math.floor(Date.now() / 1000);


interface Result {
  items: {
    id: number;
    title: string;
    url: string;
    photo: {
      high_resolution:{
        timestamp: number
      }
    }
  }
  
  pagination: {
    current_page:number;
    total_pages:number;
    total_entries:number;
    per_page:number;
  }
  search_tracking_params: {
    search_session_id: string;
  }
}
getCookie().then(async (cookie) => {
  try {
    const res1: Result = await getItems(cookie, 1);
    if(res1.pagination.total_pages === 0){
      console.log("No items found");
      return;
    }

    const maxPages = 10;
    const totalPages = Math.min(res1.pagination.total_pages, maxPages);
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const items = await Promise.all(pages.map(async (page) => {
      return getItems(cookie, page, `&search_session_id=${res1.search_tracking_params.search_session_id}`);
    }));

    const removeBefore1Hour = now - 3600;
    const filteredItems = items
      .flatMap(item => item.items)
      .filter(item => item.photo.high_resolution.timestamp > removeBefore1Hour)
      .sort((a, b) => b.photo.high_resolution.timestamp - a.photo.high_resolution.timestamp)
      .map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        created: new Date(item.photo.high_resolution.timestamp * 1000).toLocaleString()
      }));

    fs.writeFileSync('items.json', JSON.stringify(filteredItems, null, 2));
  } catch (error) {
    console.error(error);
  }
});
