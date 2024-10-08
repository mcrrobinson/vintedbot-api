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

getCookie().then(cookie => {
    getPopularBrands(cookie)

    // Write to file
    .then((brands) => {
        fs.writeFileSync('brands.json', JSON.stringify({brandFilter: {items: brands}}, null, 2));
    })
});