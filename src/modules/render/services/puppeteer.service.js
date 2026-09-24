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

// Convierte la imagen del logo local a Base64 para Puppeteer
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
    await page.setViewport({ width: 1080, height: 1350 });
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

module.exports = { generarImagenTasa };
