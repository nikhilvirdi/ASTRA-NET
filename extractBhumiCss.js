const fs = require('fs');
const raw = fs.readFileSync('c:/AstraNET/ASNT-frontend/astra-bhumi.html', 'utf-8');

const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/i);
if(styleMatch) {
    fs.writeFileSync('c:/AstraNET/frontend/src/pages/Earth.css', styleMatch[1]);
    console.log("Wrote Earth.css");
}
