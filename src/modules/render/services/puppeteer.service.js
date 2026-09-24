const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

const templatePath = path.join(__dirname, '../templates/tasa.hbs');
const templateSource = fs.readFileSync(templatePath, 'utf8');
const compiledTemplate = handlebars.compile(templateSource);

/**
 * Renderiza el HTML y genera un Buffer JPEG de la imagen en memoria (1080x1350)
 */
async function generarImagenTasa(datosSocio) {
  const html = compiledTemplate(datosSocio);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1080,
      height: 1350,
      deviceScaleFactor: 1
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const imageBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 90,
      clip: { x: 0, y: 0, width: 1080, height: 1350 }
    });

    return imageBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generarImagenTasa
};
