// Thumbnail class in TypeScript
class Thumbnail {
    type: string | null;
    url: string | null;
    width: number | null;
    height: number | null;
    original_size: boolean | null;

    constructor(thumbnail: { [key: string]: any }) {
        this.type = thumbnail.type || null;
        this.url = thumbnail.url || null;
        this.width = thumbnail.width || null;
        this.height = thumbnail.height || null;
        this.original_size = thumbnail.original_size || null;
    }
}

// Photo class in TypeScript
class Photo {
    id: number | null;
    width: number | null;
    height: number | null;
    url: string | null;
    dominant_color: string | null;
    dominant_color_opaque: string | null;
    thumbnails: Thumbnail[];
    is_suspicious: boolean;
    full_size_url: string | null;

    constructor(photoData: { [key: string]: any }) {
        this.id = photoData.id || null;
        this.width = photoData.width || null;
        this.height = photoData.height || null;
        this.url = photoData.url || null;
        this.dominant_color = photoData.dominant_color || null;
        this.dominant_color_opaque = photoData.dominant_color_opaque || null;
        this.thumbnails = photoData.thumbnails ? photoData.thumbnails.map((thumbnail: any) => new Thumbnail(thumbnail)) : [];
        this.is_suspicious = photoData.is_suspicious || false;
        this.full_size_url = photoData.full_size_url || null;
    }
}

// Item class in TypeScript
export class ItemType {
    id: number;
    title: string;
    price: number;
    is_visible: boolean;
    discount: any;
    currency: string | null;
    brand_title: string | null;
    url: string | null;
    photo: Photo;
    favourite_count: number | null;
    // is_favourite: boolean; // commented as in the original Python code
    total_item_price: number | null;
    view_count: number | null;
    size_title: string | null;
    status: string | null;

    constructor(item: { [key: string]: any }) {
        this.id = item.id || null;
        this.title = item.title || null;
        this.price = item.price || null;
        this.is_visible = item.is_visible || false;
        this.discount = item.discount || null;
        this.currency = item.currency || null;
        this.brand_title = item.brand_title || null;
        this.url = item.url || null;
        this.photo = new Photo(item.photo || {});
        this.favourite_count = item.favourite_count || null;
        // this.is_favourite = item.is_favourite || false; // commented as in the original code
        this.total_item_price = item.total_item_price || null;
        this.view_count = item.view_count || null;
        this.size_title = item.size_title || null;
        this.status = item.status || null;
    }
}


export class Catalog {
    title: string;
    code: string;
    id: number;
    catalogs: Catalog[] | null;
    size_group_id: number | null;

    constructor(entry: Catalog) {
        if (!entry.id) {
            throw new Error('id key not found in json');
        }
        
        if (!entry.title) {
            throw new Error('title key not found in json');
        }
        
        if (!entry.code) {
            throw new Error('code key not found in json');
        }
        
        this.title = entry.title;
        this.code = entry.code;
        this.id = entry.id;
        this.catalogs = entry.catalogs ? entry.catalogs.map(catalog => new Catalog(catalog)) : null;
        this.size_group_id = entry.size_group_id || null;
    }
}

// We only want the id and title from the size option.
class Size {
    id: number;
    title: string;

    constructor(sizeOption: {id: number, title: string}) {
        this.id = sizeOption.id;
        this.title = sizeOption.title;
    }
}

// Sizes grouped into groups defined by the catalog id.
class SizeGroup {
    id: number;
    title: string;
    sizes: Size[];

    constructor(group: { id: number, title: string, options: Size[] }) {
        this.id = group.id;
        this.title = group.title;
        this.sizes = group.options = group.options.map(size => new Size(size));
    }
}



class SizeFilter {
    sizes: SizeGroup[];

    constructor(options: any[]) {
        this.sizes = [];
        this.extractGroups(options);
    }

    // Get the groups of sizes from the options.
    private extractGroups(options: {type: string, options: any[]}[]) {
        for (const option of options) {
            if (option.type === 'group') {
                this.sizes.push(new SizeGroup(option as any));
            } else if (option.options) {
                this.extractGroups(option.options);
            }
        }
    }

    getSizeGroupById(id: number): SizeGroup | null {
        return this.sizes.find(size => size.id === id) || null;
    }
}

class Item {
    id: number;
    title: string;

    constructor(item: { id: number; title: string }) {
        this.id = item.id;
        this.title = item.title;
    }
}

class GenericFilter<T extends Item> {
    items: T[];

    constructor(options: Array<{ id: number; title: string }>, ItemClass: new (item: { id: number; title: string }) => T) {
        this.items = options.map(item => new ItemClass(item));
    }

    getNameFromId(id: number): string | null {
        const item = this.items.find(item => item.id === id);
        return item ? item.title : null;
    }
}

// Usage:
class Brand extends Item {}
class Condition extends Item {}
class Color extends Item {}
class Material extends Item {}

export class CodeMap {
    catalogs: Catalog[];
    sizeFilter: SizeFilter;
    brandFilter: GenericFilter<Brand>;
    conditionFilter: GenericFilter<Condition>;
    colorFilter: GenericFilter<Color>;
    materialFilter: GenericFilter<Material>;

    constructor(catalogs: Catalog[], dynamicFilters: {id: number, code: string, title: string, options: any[]}[]) {
        this.catalogs = this.flattenCatalogs(catalogs);

        const sizeFilter = dynamicFilters.find(filter => filter.code === 'size')?.options;
        if (!sizeFilter) throw new Error("Size filter not found in dynamic");
        this.sizeFilter = new SizeFilter(sizeFilter);

        const brandData = dynamicFilters.find(filter => filter.code === 'brand')?.options;
        if(!brandData) throw new Error("Brand filter not found in dynamic filters");
        this.brandFilter = new GenericFilter<Brand>(brandData, Brand);

        const conditionData = dynamicFilters.find(filter => filter.code === 'status')?.options;
        if(!conditionData) throw new Error("Condition filter not found in dynamic filters");
        this.conditionFilter = new GenericFilter<Condition>(conditionData, Condition);

        const colorData = dynamicFilters.find(filter => filter.code === 'color')?.options;
        if(!colorData) throw new Error("Color filter not found in dynamic filters");
        this.colorFilter = new GenericFilter<Color>(colorData, Color);

        const materialData = dynamicFilters.find(filter => filter.code === 'material')?.options;
        if(!materialData) throw new Error("Material filter not found in dynamic filters");
        this.materialFilter = new GenericFilter<Material>(materialData, Material);
    }

    private flattenCatalogs(catalogs: Catalog[]): Catalog[] {
        const result: Catalog[] = [];
        catalogs.forEach(cat => {
            result.push(cat);
            if (cat.catalogs) {
                result.push(...this.flattenCatalogs(cat.catalogs));
            }
        });
        return result;
    }

    getCatalogById(id: number): Catalog | null {
        return this.catalogs.find(catalog => catalog.id === id) || null;
    }

    getCatalogByCode(code: string): Catalog | null {
        return this.catalogs.find(catalog => catalog.code === code) || null;
    }

    getCatalogByTitle(title: string): Catalog | null {
        return this.catalogs.find(catalog => catalog.title === title) || null;
    }
}


export interface Alert {
    id: number;
    name: string;
    min_price: number;
    max_price: number;
    sizes: number[];
    condition: number[];
    keywords: string[];
    brands: number[];
    user_id: number;
    colour: number[];
}

export interface AlertResult {
    id: number;
    url: string;
    title: string;
    photo_url: string;
    alert_id: number;
}