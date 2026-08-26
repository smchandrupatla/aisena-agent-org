// Regression test for the exact bug that broke the Task Detail and Postgres
// Viewer pages in production: the Dockerfile's multi-stage COPY only listed
// top-level *.html/*.js/*.css/*.json globs, silently dropping the modules/
// subdirectory (and favicon.svg) from the final image even though the source
// tree and local dev server had them. This test statically parses every HTML
// page and every JS module for local asset references, then simulates the
// Dockerfile's COPY rules to verify each referenced file would actually land
// in the built image.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOCKERFILE_PATH = path.join(SITE_DIR, 'Dockerfile');

function isLocalReference(ref) {
  if (!ref) return false;
  if (/^(https?:)?\/\//.test(ref)) return false; // external URL
  if (ref.startsWith('#') || ref.startsWith('mailto:') || ref.startsWith('data:')) return false;
  return true;
}

function normalizeRootRelative(ref) {
  // Site pages sometimes use a root-absolute reference (e.g. "/favicon.svg")
  // which the server resolves relative to the served directory, same as "./x".
  return ref.replace(/^\//, '');
}

/** Parses the Dockerfile's runner-stage COPY lines into a predicate for "is this relative path present in the final image?" */
function buildImageContentChecker(dockerfileText) {
  const copyLines = [...dockerfileText.matchAll(/COPY --from=builder \/app\/(\S+)/g)].map(m => m[1]);
  const wildcardExtensions = new Set();
  const explicitDirs = [];
  const explicitFiles = new Set();

  for (const source of copyLines) {
    if (source.endsWith('/')) {
      explicitDirs.push(source.replace(/\/$/, ''));
    } else if (source.startsWith('*.')) {
      wildcardExtensions.add(source.slice(1)); // ".html", ".js", etc.
    } else {
      explicitFiles.add(source);
    }
  }

  return function isIncluded(relativePath) {
    if (explicitFiles.has(relativePath)) return true;
    if (explicitDirs.some(dir => relativePath === dir || relativePath.startsWith(`${dir}/`))) return true;
    const ext = path.extname(relativePath);
    // Wildcard globs (e.g. *.js) only match files directly at the app root, not subdirectories.
    if (wildcardExtensions.has(ext) && !relativePath.includes('/')) return true;
    return false;
  };
}

function collectHtmlReferences(htmlFiles) {
  const refs = new Set();
  // Only <script src="..."> and <link href="..."> need to exist as static
  // files in the image; <a href> can legitimately point at server routes
  // (e.g. /prompts, /api/...) that aren't files on disk at all.
  const tagPattern = /<(script|link)\b[^>]*\b(?:src|href)\s*=\s*"([^"]+)"[^>]*>/gi;
  for (const file of htmlFiles) {
    const content = readFileSync(path.join(SITE_DIR, file), 'utf-8');
    for (const match of content.matchAll(tagPattern)) {
      const ref = match[2];
      if (isLocalReference(ref)) refs.add(normalizeRootRelative(ref));
    }
  }
  return refs;
}

function collectJsImportReferences(jsFiles) {
  const refs = new Set();
  const importPattern = /from\s+['"](\.[^'"]+)['"]/g;
  for (const file of jsFiles) {
    const content = readFileSync(path.join(SITE_DIR, file), 'utf-8');
    for (const match of content.matchAll(importPattern)) {
      const resolved = path.posix.normalize(path.posix.join(path.dirname(file), match[1]));
      refs.add(resolved);
    }
  }
  return refs;
}

describe('deploy asset parity (Dockerfile vs. referenced files)', () => {
  const allEntries = readdirSync(SITE_DIR, { withFileTypes: true });
  const htmlFiles = allEntries.filter(e => e.isFile() && e.name.endsWith('.html')).map(e => e.name);
  const rootJsFiles = allEntries.filter(e => e.isFile() && e.name.endsWith('.js')).map(e => e.name);
  const moduleJsFiles = readdirSync(path.join(SITE_DIR, 'modules'))
    .filter(f => f.endsWith('.js'))
    .map(f => path.posix.join('modules', f));

  const dockerfileText = readFileSync(DOCKERFILE_PATH, 'utf-8');
  const isIncludedInImage = buildImageContentChecker(dockerfileText);

  test('Dockerfile copies the modules/ directory', () => {
    assert.match(dockerfileText, /COPY --from=builder \/app\/modules\/ /);
  });

  test('every local asset referenced by an HTML page ships in the built image', () => {
    // Known pre-existing issue, out of scope for this change: index.html has a
    // <script src="../../main.js"> pointing at the *repo-root* main.js (a
    // separate, unrelated/orphaned scaffold), which resolves outside the
    // service's own directory and can never be copied into this image no
    // matter how the Dockerfile is written. Flagged separately; not fixed here.
    const KNOWN_PRE_EXISTING_EXCEPTIONS = new Set(['../../main.js']);
    const refs = collectHtmlReferences(htmlFiles);
    const missing = [...refs].filter(ref => !isIncludedInImage(ref) && !KNOWN_PRE_EXISTING_EXCEPTIONS.has(ref));
    assert.deepEqual(missing, [], `These HTML-referenced assets would 404 in the built image: ${missing.join(', ')}`);
  });

  test('every relative ES module import (top-level + modules/) ships in the built image', () => {
    const refs = collectJsImportReferences([...rootJsFiles, ...moduleJsFiles]);
    const missing = [...refs].filter(ref => !isIncludedInImage(ref));
    assert.deepEqual(missing, [], `These JS module imports would 404 in the built image: ${missing.join(', ')}`);
  });

  test('task.html and postgres-viewer.html actually reference their module-based scripts', () => {
    // Sanity check that the scan above has real signal (isn't just an empty set).
    const refs = collectHtmlReferences(['task.html', 'postgres-viewer.html']);
    assert.ok(refs.has('task.js'));
    assert.ok(refs.has('main.js'));
  });
});
