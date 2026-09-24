const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

let compiledTemplate = null;

function getTemplate() {
  if (!compiledTemplate) {
    const templatePath = path.join(__dirname, '../templates/tasa.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    compiledTemplate = handlebars.compile(templateSource);
  }
  return compiledTemplate;
}

function getLogoBase64() {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-fundablock.png');
    if (fs.existsSync(logoPath)) {
      return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  } catch (err) {
    console.error('[Puppeteer Service ⚠️] Error al cargar logo-fundablock.png:', err.message);
  }
  return null;
}

async function generarImagenTasa(datosSocio) {
  const template = getTemplate();
  const logoBase64 = getLogoBase64();

  const html = template({
    ...datosSocio,
    logo_src: logoBase64
  });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    // Ancho fijo de 1080px y altura inicial flexible
    await page.setViewport({ width: 1080, height: 800 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Captura dinámica del alto exacto del contenedor
    const container = await page.$('#app-container');
    const imageBuffer = await container.screenshot({
      type: 'jpeg',
      quality: 90
    });

    return imageBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generarImagenTasa };
