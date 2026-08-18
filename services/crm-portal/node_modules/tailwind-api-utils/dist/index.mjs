import fs from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { getPackageInfoSync, resolveModule } from 'local-pkg';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import fs$1 from 'node:fs';
import EnhancedResolve from 'enhanced-resolve';

const REGEX_SPECIAL = /[\\^$.*+?()[\]{}|]/g;
const REGEX_HAS_SPECIAL = new RegExp(REGEX_SPECIAL.source);
function toSource(source) {
  source = Array.isArray(source) ? source : [source];
  source = source.map((item) => item instanceof RegExp ? item.source : item);
  return source.join("");
}
function pattern(source) {
  return new RegExp(toSource(source), "g");
}
function any(sources) {
  return `(?:${sources.map(toSource).join("|")})`;
}
function optional(source) {
  return `(?:${toSource(source)})?`;
}
function escape(string) {
  return string && REGEX_HAS_SPECIAL.test(string) ? string.replace(REGEX_SPECIAL, "\\$&") : string || "";
}

function splitAtTopLevelOnly(input, separator) {
  const stack = [];
  const parts = [];
  let lastPos = 0;
  let isEscaped = false;
  for (let idx = 0; idx < input.length; idx++) {
    const char = input[idx];
    if (stack.length === 0 && char === separator[0] && !isEscaped) {
      if (separator.length === 1 || input.slice(idx, idx + separator.length) === separator) {
        parts.push(input.slice(lastPos, idx));
        lastPos = idx + separator.length;
      }
    }
    isEscaped = isEscaped ? false : char === "\\";
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
    } else if (char === ")" && stack[stack.length - 1] === "(" || char === "]" && stack[stack.length - 1] === "[" || char === "}" && stack[stack.length - 1] === "{") {
      stack.pop();
    }
  }
  parts.push(input.slice(lastPos));
  return parts;
}

function defaultExtractor(context) {
  const patterns = Array.from(buildRegExps(context));
  return (content) => {
    const results = [];
    for (const pattern of patterns) {
      for (const result of content.match(pattern) ?? []) {
        results.push(clipAtBalancedParens(result));
      }
    }
    for (const result of results.slice()) {
      const segments = splitAtTopLevelOnly(result, ".");
      for (let idx = 0; idx < segments.length; idx++) {
        const segment = segments[idx];
        if (idx >= segments.length - 1) {
          results.push(segment);
          continue;
        }
        const next = Number(segments[idx + 1]);
        if (Number.isNaN(next)) {
          results.push(segment);
        } else {
          idx++;
        }
      }
    }
    return results;
  };
}
function* buildRegExps(context) {
  const separator = context.tailwindConfig.separator;
  const prefix = context.tailwindConfig.prefix !== "" ? optional(pattern([/-?/, escape(context.tailwindConfig.prefix)])) : "";
  const utility = any([
    // Arbitrary properties (without square brackets)
    /\[[^\s:'"`]+:[^\s[\]]+\]/,
    // Arbitrary properties with balanced square brackets
    // This is a targeted fix to continue to allow theme()
    // with square brackets to work in arbitrary properties
    // while fixing a problem with the regex matching too much
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    /\[[^\s:'"`\]]+:\S+?\[\S+\]\S+?\]/,
    // Utilities
    pattern([
      // Utility Name / Group Name
      any([
        /-?\w+/,
        // This is here to make sure @container supports everything that other utilities do
        /@\w+/
      ]),
      // Normal/Arbitrary values
      optional(
        any([
          pattern([
            // Arbitrary values
            any([
              /-(?:\w+-)*\['\S+'\]/,
              /-(?:\w+-)*\["\S+"\]/,
              /-(?:\w+-)*\[`\S+`\]/,
              /-(?:\w+-)*\[(?:[^\s[\]]+\[[^\s[\]]+\])*[^\s:[\]]+\]/
            ]),
            // Not immediately followed by an `{[(`
            /(?![{([]\])/,
            // optionally followed by an opacity modifier
            /(?:\/[^\s'"`\\><$]*)?/
          ]),
          pattern([
            // Arbitrary values
            any([
              /-(?:\w+-)*\['\S+'\]/,
              /-(?:\w+-)*\["\S+"\]/,
              /-(?:\w+-)*\[`\S+`\]/,
              /-(?:\w+-)*\[(?:[^\s[\]]+\[[^\s[\]]+\])*[^\s[\]]+\]/
            ]),
            // Not immediately followed by an `{[(`
            /(?![{([]\])/,
            // optionally followed by an opacity modifier
            /(?:\/[^\s'"`\\$]*)?/
          ]),
          // Normal values w/o quotes — may include an opacity modifier
          /[-/][^\s'"`\\$={><]*/
        ])
      )
    ])
  ]);
  const variantPatterns = [
    // Without quotes
    any([
      // This is here to provide special support for the `@` variant
      pattern([/@\[[^\s"'`]+\](\/[^\s"'`]+)?/, separator]),
      // With variant modifier (e.g.: group-[..]/modifier)
      pattern([/([^\s"'`[\\]+-)?\[[^\s"'`]+\]\/[\w-]+/, separator]),
      pattern([/([^\s"'`[\\]+-)?\[[^\s"'`]+\]/, separator]),
      pattern([/[^\s"'`[\\]+/, separator])
    ]),
    // With quotes allowed
    any([
      // With variant modifier (e.g.: group-[..]/modifier)
      pattern([/([^\s"'`[\\]+-)?\[[^\s`]+\]\/[\w-]+/, separator]),
      pattern([/([^\s"'`[\\]+-)?\[[^\s`]+\]/, separator]),
      pattern([/[^\s`[\\]+/, separator])
    ])
  ];
  for (const variantPattern of variantPatterns) {
    yield pattern([
      // Variants
      "((?=((",
      variantPattern,
      ")+))\\2)?",
      // Important (optional)
      /!?/,
      prefix,
      utility
    ]);
  }
  yield /[^<>"'`\s.(){}[\]#=%$][^<>"'`\s(){}[\]#=%$]*[^<>"'`\s.(){}[\]#=%:$]/g;
}
const SPECIALS = /([[\]'"`])([^[\]'"`])?/g;
const ALLOWED_CLASS_CHARACTERS = /[^"'`\s<>\]]+/;
function clipAtBalancedParens(input) {
  if (!input.includes("-[")) {
    return input;
  }
  let depth = 0;
  const openStringTypes = [];
  let matches = input.matchAll(SPECIALS);
  matches = Array.from(matches).flatMap((match) => {
    const [, ...groups] = match;
    return groups.map(
      (group, idx) => Object.assign([], match, {
        index: match.index + idx,
        0: group
      })
    );
  });
  for (const match of matches) {
    const char = match[0];
    const inStringType = openStringTypes[openStringTypes.length - 1];
    if (char === inStringType) {
      openStringTypes.pop();
    } else if (char === "'" || char === '"' || char === "`") {
      openStringTypes.push(char);
    }
    if (inStringType) {
      continue;
    } else if (char === "[") {
      depth++;
      continue;
    } else if (char === "]") {
      depth--;
      continue;
    }
    if (depth < 0) {
      return input.substring(0, match.index - 1);
    }
    if (depth === 0 && !ALLOWED_CLASS_CHARACTERS.test(char)) {
      return input.substring(0, match.index);
    }
  }
  return input;
}

const _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
let jiti = null;
let currentPath;
async function importModule(path, pwd) {
  if (currentPath !== pwd) {
    currentPath = pwd;
    jiti = null;
  }
  jiti ??= createJiti(pwd || _dirname, { moduleCache: false, fsCache: false });
  return await jiti.import(path);
}

const DEPENDENCY_PATTERNS = [
  /import[\s\S]*?['"](.{3,}?)['"]/gi,
  /import[\s\S]*from[\s\S]*?['"](.{3,}?)['"]/gi,
  /export[\s\S]*from[\s\S]*?['"](.{3,}?)['"]/gi,
  /require\(['"`](.+)['"`]\)/gi
];
const JS_EXTENSIONS = /* @__PURE__ */ new Set([".js", ".cjs", ".mjs"]);
const JS_RESOLUTION_ORDER = ["", ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts", ".jsx", ".tsx"];
const TS_RESOLUTION_ORDER = ["", ".ts", ".cts", ".mts", ".tsx", ".js", ".cjs", ".mjs", ".jsx"];
async function resolveWithExtension(file, extensions) {
  for (const ext of extensions) {
    const full = `${file}${ext}`;
    const stats = await fs.stat(full).catch(() => null);
    if (stats?.isFile())
      return full;
  }
  for (const ext of extensions) {
    const full = `${file}/index${ext}`;
    const exists = await fs.access(full).then(
      () => true,
      () => false
    );
    if (exists) {
      return full;
    }
  }
  return null;
}
async function traceDependencies(seen, filename, base, ext) {
  const extensions = JS_EXTENSIONS.has(ext) ? JS_RESOLUTION_ORDER : TS_RESOLUTION_ORDER;
  const absoluteFile = await resolveWithExtension(path.resolve(base, filename), extensions);
  if (absoluteFile === null)
    return;
  if (seen.has(absoluteFile))
    return;
  seen.add(absoluteFile);
  base = path.dirname(absoluteFile);
  ext = path.extname(absoluteFile);
  const contents = await fs.readFile(absoluteFile, "utf-8");
  const promises = [];
  for (const pattern of DEPENDENCY_PATTERNS) {
    for (const match of contents.matchAll(pattern)) {
      if (!match[1]?.startsWith("."))
        continue;
      promises.push(traceDependencies(seen, match[1], base, ext));
    }
  }
  await Promise.all(promises);
}
async function getModuleDependencies(absoluteFilePath) {
  const seen = /* @__PURE__ */ new Set();
  await traceDependencies(
    seen,
    absoluteFilePath,
    path.dirname(absoluteFilePath),
    path.extname(absoluteFilePath)
  );
  return Array.from(seen);
}

async function loadModule(id, base, onDependency, customJsResolver) {
  if (id[0] !== ".") {
    const resolvedPath2 = await resolveJsId(id, base);
    if (!resolvedPath2) {
      throw new Error(`Could not resolve '${id}' from '${base}'`);
    }
    const module2 = await importModule(pathToFileURL(resolvedPath2).href);
    return {
      base: dirname(resolvedPath2),
      module: module2.default ?? module2
    };
  }
  const resolvedPath = await resolveJsId(id, base);
  if (!resolvedPath) {
    throw new Error(`Could not resolve '${id}' from '${base}'`);
  }
  const [module, moduleDependencies] = await Promise.all([
    importModule(`${pathToFileURL(resolvedPath).href}?id=${Date.now()}`),
    getModuleDependencies(resolvedPath)
  ]);
  for (const file of moduleDependencies) {
  }
  return {
    base: dirname(resolvedPath),
    module: module.default ?? module
  };
}
async function loadStylesheet(id, base, onDependency, cssResolver2) {
  const resolvedPath = await resolveCssId(id, base);
  if (!resolvedPath)
    throw new Error(`Could not resolve '${id}' from '${base}'`);
  const file = await fs.readFile(resolvedPath, "utf-8");
  return {
    base: path.dirname(resolvedPath),
    content: file
  };
}
const cssResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem: new EnhancedResolve.CachedInputFileSystem(fs$1, 4e3),
  useSyncFileSystemCalls: true,
  extensions: [".css"],
  mainFields: ["style"],
  conditionNames: ["style"]
});
async function resolveCssId(id, base, customCssResolver) {
  return runResolver(cssResolver, id, base);
}
const esmResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem: new EnhancedResolve.CachedInputFileSystem(fs$1, 4e3),
  useSyncFileSystemCalls: true,
  extensions: [".js", ".json", ".node", ".ts"],
  conditionNames: ["node", "import"]
});
const cjsResolver = EnhancedResolve.ResolverFactory.createResolver({
  fileSystem: new EnhancedResolve.CachedInputFileSystem(fs$1, 4e3),
  useSyncFileSystemCalls: true,
  extensions: [".js", ".json", ".node", ".ts"],
  conditionNames: ["node", "require"]
});
async function resolveJsId(id, base, customJsResolver) {
  return runResolver(esmResolver, id, base).catch(() => runResolver(cjsResolver, id, base));
}
function runResolver(resolver, id, base) {
  return new Promise(
    (resolve, reject) => resolver.resolve({}, base, id, {}, (err, result) => {
      if (err)
        return reject(err);
      resolve(result);
    })
  );
}

class TailwindUtils {
  isV4;
  packageInfo;
  context = null;
  extractor = null;
  constructor(options) {
    this.packageInfo = getPackageInfoSync("tailwindcss", options);
    if (!this.packageInfo) {
      throw new Error("Could not find tailwindcss");
    }
    this.isV4 = !!this.packageInfo.version?.startsWith("4");
  }
  async loadConfig(configPathOrContent, options) {
    if (this.isV4) {
      await this.loadConfigV4(configPathOrContent, options);
    } else {
      this.loadConfigV3(configPathOrContent, options);
    }
  }
  async loadConfigV4(configPathOrContent, options) {
    const pwd = options?.pwd ?? (typeof configPathOrContent === "string" ? path.dirname(configPathOrContent) : void 0);
    const packageResolvingOptions = { paths: pwd ? [pwd] : void 0 };
    const tailwindLibPath = resolveModule("tailwindcss", packageResolvingOptions);
    if (!tailwindLibPath)
      throw new Error("Could not resolve tailwindcss");
    const tailwindMod = await importModule(tailwindLibPath, pwd);
    const { __unstable__loadDesignSystem } = tailwindMod;
    const defaultCSSThemePath = resolveModule("tailwindcss/theme.css", packageResolvingOptions);
    if (!defaultCSSThemePath)
      throw new Error("Could not resolve tailwindcss theme");
    const defaultCSSTheme = await fs.readFile(defaultCSSThemePath, "utf-8");
    const css = typeof configPathOrContent === "string" ? await fs.readFile(configPathOrContent, "utf-8") : "";
    this.context = await __unstable__loadDesignSystem(
      `${defaultCSSTheme}
${css}`,
      {
        base: pwd,
        async loadModule(id, base) {
          return loadModule(id, base);
        },
        async loadStylesheet(id, base) {
          return loadStylesheet(id, base);
        }
      }
    );
    const extractorContext = {
      tailwindConfig: {
        separator: ":",
        prefix: options?.prefix ?? ""
      }
    };
    if (this.context) {
      this.context.tailwindConfig = extractorContext.tailwindConfig;
    }
    this.extractor = defaultExtractor(extractorContext);
  }
  loadConfigV3(configPathOrContent, options) {
    const pwd = options?.pwd ?? (typeof configPathOrContent === "string" ? path.dirname(configPathOrContent) : void 0);
    const packageResolvingOptions = { paths: pwd ? [pwd] : void 0 };
    const tailwindLibPath = resolveModule("tailwindcss", packageResolvingOptions);
    if (!tailwindLibPath)
      throw new Error("Could not resolve tailwindcss");
    const { createContext } = require(
      path.resolve(tailwindLibPath, "../lib/setupContextUtils.js")
    );
    const resolveConfig = require(
      path.resolve(tailwindLibPath, "../../resolveConfig.js")
    );
    const { defaultExtractor } = require(
      path.resolve(tailwindLibPath, "../lib/defaultExtractor.js")
    );
    const loadConfig = require(
      path.resolve(tailwindLibPath, "../../loadConfig.js")
    );
    this.context = createContext(resolveConfig(
      typeof configPathOrContent === "string" ? loadConfig(configPathOrContent) : configPathOrContent
    ));
    const extractorContext = {
      tailwindConfig: {
        separator: options?.separator ?? "-",
        prefix: options?.prefix ?? ""
      }
    };
    if (this.context?.tailwindConfig?.separator) {
      extractorContext.tailwindConfig.separator = this.context.tailwindConfig.separator;
    }
    if (this.context?.tailwindConfig?.prefix) {
      extractorContext.tailwindConfig.prefix = this.context.tailwindConfig.prefix;
    }
    this.extractor = defaultExtractor(extractorContext);
  }
  isValidClassName(className) {
    const input = Array.isArray(className) ? className : [className];
    const res = this.context?.getClassOrder(input);
    if (!res) {
      throw new Error("Failed to get class order");
    }
    return Array.isArray(className) ? res.map((r) => r[1] !== null) : res[0][1] !== null;
  }
  getSortedClassNames(className) {
    const res = this.context?.getClassOrder(className);
    if (!res) {
      throw new Error("Failed to get class order");
    }
    return res.sort(([nameA, a], [nameZ, z]) => {
      if (nameA === "..." || nameA === "\u2026")
        return 1;
      if (nameZ === "..." || nameZ === "\u2026")
        return -1;
      if (a === z)
        return 0;
      if (a === null)
        return -1;
      if (z === null)
        return 1;
      return bigSign(a - z);
    }).map(([name]) => name);
  }
  extract(content) {
    if (!this.extractor) {
      throw new Error("Extractor is not available");
    }
    return this.extractor(content);
  }
}
function bigSign(bigIntValue) {
  return Number(bigIntValue > 0n) - Number(bigIntValue < 0n);
}

export { TailwindUtils };
