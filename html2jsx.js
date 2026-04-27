const fs = require('fs');

const raw = fs.readFileSync('c:/AstraNET/ASNT-frontend/astra-solar-v2.html', 'utf-8');

// Extract the contents of the body tag
const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
if (!bodyMatch) {
    console.error("No body found");
    process.exit(1);
}
let inner = bodyMatch[1];

// Remove script tags
inner = inner.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

// Convert class to className
let jsx = inner.replace(/class=/g, 'className=');

// Convert inline styles like style="width: 100%" to style={{width: '100%'}}
jsx = jsx.replace(/style="([^"]*)"/gi, (match, p1) => {
    const parts = p1.split(';').filter(p => p.trim());
    const styleObj = {};
    for (const part of parts) {
        const [k, v] = part.split(':');
        if (k && v) {
            const camelKey = k.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            styleObj[camelKey] = v.trim();
        }
    }
    return `style={${JSON.stringify(styleObj)}}`;
});

// Close void tags
jsx = jsx.replace(/<(img|input|br|hr|source) ([^>]*)(?<!\/)>/gi, '<$1 $2 />');
jsx = jsx.replace(/<(img|input|br|hr|source)>/gi, '<$1 />');

// Comments
jsx = jsx.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

// Convert specific SVG things if any (like stop-color)
jsx = jsx.replace(/stop-color/g, 'stopColor');
jsx = jsx.replace(/stop-opacity/g, 'stopOpacity');
jsx = jsx.replace(/stroke-width/g, 'strokeWidth');
jsx = jsx.replace(/stroke-dasharray/g, 'strokeDasharray');
jsx = jsx.replace(/stroke-linecap/g, 'strokeLinecap');
jsx = jsx.replace(/stroke-linejoin/g, 'strokeLinejoin');

fs.writeFileSync('c:/AstraNET/tmp-jsx.txt', jsx);
console.log("Wrote JSX to c:/AstraNET/tmp-jsx.txt");
