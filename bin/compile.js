const path = require('path');
const fs = require('fs-extra'); 
const fm = require('front-matter');
const md = require('markdown-it')({
  html: true,
  linkify: true,
});
const minify = require('html-minifier').minify;
const glob = require('glob-fs')({ gitignore: true });
const nunjucks = require('nunjucks');
const slug = require('slug');
const loader = new nunjucks.FileSystemLoader(path.resolve(__dirname, '..', 'templates'));
const env = new nunjucks.Environment(loader, {
  trimBlocks: true,
  lstripBlocks: true,
});
const COMPILED_SITE_PATH = path.resolve(__dirname, '..', '_site'); 

const sitemap = [];

async function compile() {
  const files = await glob.readdirPromise('content/*.md');
  files.forEach((file) => {
    const contents = fs.readFileSync(file).toString();
    prepareSitemap(path.basename(file, '.md'), fm(contents));
  });

  sitemap.sort(sortOrder).forEach((config) => config.sections = config.sections.sort(sortOrder));
  sitemap.forEach((config) => {
    const sections = [config]
      .concat(config.sections)
      .map(renderConfig)
      .join('');
    const html = env.render('base.njk', { sections, sitemap, title: config.page });
    const pageContent = minify(html, { collapseWhitespace: true });
    const pageFileName = `${COMPILED_SITE_PATH}/${config.filename}.html`;
    fs.ensureFileSync(pageFileName);
    fs.writeFileSync(pageFileName, pageContent, { encoding: 'utf8' });
  });
}

function renderConfig(config) {
  const { markdown, slug } = config;
  const id = slug ? `id="${slug}"` : '';
  return `<section ${id} class="content-section">${md.render(markdown)}</section>`;
}

function sortOrder(a, b) {
  return Number(a.order) - Number(b.order);
}

function prepareSitemap(filename, { attributes, body }) {
  if (!attributes.anchor) {
    sitemap.push(Object.assign(attributes, { filename, markdown: body, sections: [] }));
  } else {
    attributes.slug = slug(attributes.anchor).toLowerCase();
    let existingPage = sitemap.find(({ page }) => page === attributes.page);
    if (!existingPage) {
      existingPage = { page: attributes.page, sections: [], filename };
      sitemap.push(existingPage);
    }
    existingPage.sections.push(Object.assign(attributes, { markdown: body }));
  }
}

compile();