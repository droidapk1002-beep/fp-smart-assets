const fs = require('fs');
const code = fs.readFileSync('repo/js/doc-manager.js', 'utf8');

// Strip template literal backticks and ${...} for inline HTML
let min = code
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*\n\s*/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim();

// Wrap in CDATA
const wrapped = '<script>//<![CDATA[' + min + '//]]></script>';

const xmlPath = 'fp-smart-blogger-theme.xml';
let xml = fs.readFileSync(xmlPath, 'utf8');

// Find and replace the inline doc-manager block
// It starts with '<script>//<![CDATA[\nvar LOCAL_DOCS_KEY'
// and ends with '//]]>\n</script>'
const startMarker = '<script>//<![CDATA[\nvar LOCAL_DOCS_KEY';
const startIdx = xml.indexOf(startMarker);
if (startIdx === -1) { console.error('Start marker not found'); process.exit(1); }

// Find the end: look for '//]]>' followed by newline and '</script>'
const endSearchFrom = startIdx + 100; // skip past the start
let endIdx = -1;
// Search for the pattern: a line that is just '//]]>' followed by a line '</script>'
const endPattern = /\n\/\/\]\]>\n<\/script>/;
const searchRegion = xml.substring(endSearchFrom);
const endMatch = searchRegion.match(endPattern);
if (!endMatch) {
  // Try without newline
  const altPattern = /\n\/\/\]\]>\n?\s*<\/script>/;
  const altMatch = searchRegion.match(altPattern);
  if (!altMatch) {
    console.error('End marker not found');
    process.exit(1);
  }
  endIdx = endSearchFrom + altMatch.index + altMatch[0].length;
} else {
  endIdx = endSearchFrom + endMatch.index + endMatch[0].length;
}

console.log('Old block: chars', startIdx, 'to', endIdx, '(' + (endIdx - startIdx) + ' chars)');
console.log('New block length:', wrapped.length);

xml = xml.substring(0, startIdx) + wrapped + xml.substring(endIdx);
fs.writeFileSync(xmlPath, xml, 'utf8');
console.log('Done. New XML length:', xml.length);
