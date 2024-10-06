import { Catalog, CodeMap } from './defs';
const fs = require('fs');

const data = fs.readFileSync('mapping.json', 'utf8');
const parsed = JSON.parse(data);

const catalogs = parsed.map.initalizerResponseJson.dtos.catalogs.map((catalog: any) => {
    return new Catalog(catalog)
});

const codeMap = new CodeMap(catalogs, parsed.map.initalizerResponseJson.dtos.dynamicFilters);

// Write to catalogs.json
fs.writeFileSync('code.json', JSON.stringify(codeMap), 'utf8');