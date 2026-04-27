const fs = require('fs');

const raw = fs.readFileSync('c:/AstraNET/ASNT-frontend/astra-bhumi.html', 'utf-8');

const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
let inner = bodyMatch ? bodyMatch[1] : raw;

// Clean out scripts
inner = inner.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

// JSX conversions
let jsx = inner.replace(/class=/g, 'className=');

// Convert inline styles
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

// Self-closing tags
jsx = jsx.replace(/<(img|input|br|hr|source|link|meta) ([^>]*)(?<!\/)>/gi, '<$1 $2 />');
jsx = jsx.replace(/<(img|input|br|hr|source)>/gi, '<$1 />');

fs.writeFileSync('c:/AstraNET/tmp-bhumi-jsx.txt', jsx);
console.log("Wrote Bhumi JSX to tmp-bhumi-jsx.txt");
