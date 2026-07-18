const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'images');
const files = [];

function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const full = path.join(d, f);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(jpg|jpeg|png|gif)$/i.test(f)) files.push(full);
  }
}
walk(dir);

console.log(`Found ${files.length} images to compress...`);

(async () => {
  for (const file of files) {
    try {
      const before = fs.statSync(file).size;
      const ext = path.extname(file).toLowerCase();
      let pipeline = sharp(file).resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true });
      if (ext === '.png') pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
      else pipeline = pipeline.jpeg({ quality: 75, mozjpeg: true });
      await pipeline.toFile(file + '.tmp');
      fs.renameSync(file + '.tmp', file);
      const after = fs.statSync(file).size;
      const saved = Math.round((1 - after / before) * 100);
      if (saved > 0) console.log(`${path.basename(file)}: ${Math.round(before/1024)}KB -> ${Math.round(after/1024)}KB (${saved}% smaller)`);
    } catch (e) {
      console.error(`Failed: ${path.basename(file)} - ${e.message}`);
    }
  }
  const total = fs.readdirSync(dir, { recursive: true })
    .filter(f => fs.statSync(path.join(dir, f)).isFile())
    .reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
  console.log(`\nDone! Total size now: ${Math.round(total/1024/1024)}MB`);
})();
