const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname);
const code = fs.readFileSync(path.join(dir, 'repo/js/doc-manager.js'), 'utf8');

// Careful minification preserving string content
let min = code;

// Remove single-line comments (but not // in URLs or strings)
min = min.replace(/(?<![:"'])\/\/.*$/gm, '');

// Remove block comments
min = min.replace(/\/\*[\s\S]*?\*\//g, '');

// Collapse newlines and multiple spaces
min = min.replace(/\s*\n\s*/g, ' ');
min = min.replace(/  +/g, ' ');

// Trim
min = min.trim();

console.log('Minified length:', min.length);

// Verify no </script> in content
if (min.includes('</script>')) {
  console.error('ERROR: contains </script>');
  process.exit(1);
}

// Verify no ]]>
if (min.includes(']]>')) {
  console.error('ERROR: contains ]]>');
  process.exit(1);
}

// Build the wrapped script
const wrapped = '<script>//<![CDATA[' + min + '//]]></script>';
console.log('Wrapped length:', wrapped.length);

// Now replace in XML
const xmlPath = path.join(dir, 'fp-smart-blogger-theme.xml');
let xml = fs.readFileSync(xmlPath, 'utf8');

const startMarker = '<script>//<![CDATA[\nvar LOCAL_DOCS_KEY';
const startIdx = xml.indexOf(startMarker);
if (startIdx === -1) {
  console.error('Start marker not found in XML');
  process.exit(1);
}

// Find end: look for '//]]>' then '</script>' from the end of the file backwards
// The inline block's end is the last '</script>' before '</body>'
const bodyIdx = xml.indexOf('</body>');
if (bodyIdx === -1) {
  console.error('</body> not found');
  process.exit(1);
}

// Find the '</script>' just before '</body>'
const lastScriptClose = xml.lastIndexOf('</script>', bodyIdx);
if (lastScriptClose === -1) {
  console.error('</script> before </body> not found');
  process.exit(1);
}

// Check if this '</script>' is preceded by '//]]>'
const beforeClose = xml.substring(lastScriptClose - 10, lastScriptClose);
console.log('Chars before last </script>:', JSON.stringify(beforeClose));

// The end of our block is after this '</script>'
const endIdx = lastScriptClose + '</script>'.length;

console.log('Old block: chars', startIdx, 'to', endIdx, '(' + (endIdx - startIdx) + ' chars)');
console.log('New block length:', wrapped.length);

xml = xml.substring(0, startIdx) + wrapped + xml.substring(endIdx);
fs.writeFileSync(xmlPath, xml, 'utf8');
console.log('Done. New XML length:', xml.length);
