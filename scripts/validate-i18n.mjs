#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const I18N_DIR = join(ROOT, "i18n");
const PUBLIC_DIR = join(ROOT, "public");
const TRANSLATIONS_DIR = join(PUBLIC_DIR, "i18n", "translations");
const GENERATED_MARKER = "<!-- GENERATED FILE. DO NOT EDIT DIRECTLY.";
const errors = [];

const unchangedAllowlist = new Set([
  "&emsp;",
  "&nbsp;",
  "April",
  "Audio &nbsp;",
  "August",
  "Balance Error Scoring System",
  "Baseline",
  "CISG",
  "Code",
  "Concentration",
  "Concentration (X/5)",
  "Confusion.",
  "Date",
  "December",
  "FAQ",
  "Full SCAT6",
  "Glasgow Coma Scale",
  "Glasgow Coma Scale (X/15)",
  "MIT",
  "Member",
  "N/A",
  "Name",
  "No",
  "NO",
  "November",
  "OK",
  "Optional",
  "Orientation",
  "Orientation (X/5)",
  "open source",
  "Power Systems Airex Balance Pad 81000",
  "SCAT6",
  "SCAT6™",
  "SCAT6 Web",
  "September",
  "Source",
  "Sources",
  "Sport/Team/School:",
  "Team/School",
]);
const localeUnchangedAllowlist = {
  lb: new Set(["Dominant Hand", "Dominant Hand:"]),
};

function fail(message) {
  errors.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${path}: ${error.message}`);
    return null;
  }
}

function sortedKeys(value) {
  return Object.keys(value ?? {}).sort();
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tokens(value) {
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort();
}

function entities(value) {
  return [...value.matchAll(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi)]
    .map((match) => match[0].toLowerCase())
    .sort();
}

function htmlTags(value) {
  return [...value.matchAll(/<\/?[a-z][^>]*>/gi)]
    .map((match) => match[0].replace(/\s+/g, " "))
    .sort();
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateEntry(localeCode, section, key, expected, actual) {
  const location = `${localeCode}.${section}.${key}`;
  if (!actual || typeof actual !== "object") {
    fail(`${location}: missing entry`);
    return;
  }
  if (actual.source !== expected.source)
    fail(`${location}: source does not match English catalog`);
  if (!sameArray(actual.locations, expected.locations))
    fail(`${location}: locations do not match English catalog`);
  if (typeof actual.value !== "string" || !actual.value.trim()) {
    fail(`${location}: value must be a non-empty string`);
    return;
  }
  if (!sameArray(tokens(actual.source), tokens(actual.value)))
    fail(`${location}: {{placeholder}} names must be preserved exactly`);
  if (!sameArray(entities(actual.source), entities(actual.value)))
    fail(`${location}: HTML entities must be preserved exactly`);
  if (!sameArray(htmlTags(actual.source), htmlTags(actual.value)))
    fail(`${location}: HTML tags and their attributes must be preserved exactly`);
  if (key.startsWith("html_attr.") && actual.value.includes('"'))
    fail(`${location}: translated double quote would break the generated attribute`);
  if (
    localeCode !== languages.default &&
    actual.value === actual.source &&
    !key.startsWith("runtime.lang.name.") &&
    !unchangedAllowlist.has(actual.source) &&
    !localeUnchangedAllowlist[localeCode]?.has(actual.source)
  ) {
    fail(`${location}: untranslated value (add only genuine proper/technical names to the allowlist)`);
  }
}

const languages = readJson(join(I18N_DIR, "languages.json"));
const catalog = readJson(join(I18N_DIR, "catalog.en.json"));
if (!languages || !catalog) process.exitCode = 1;

if (languages && catalog) {
  const configuredCodes = languages.supported.map((language) => language.code);
  if (new Set(configuredCodes).size !== configuredCodes.length)
    fail("i18n/languages.json: language codes must be unique");
  if (!configuredCodes.includes(languages.default))
    fail("i18n/languages.json: default language must be supported");

  const defaultPath = join(TRANSLATIONS_DIR, `${languages.default}.json`);
  const defaultLocale = readJson(defaultPath);
  if (defaultLocale) {
    const catalogKeys = sortedKeys(catalog.entries);
    if (!sameArray(sortedKeys(defaultLocale.entries), catalogKeys))
      fail(`${defaultPath}: entry keys do not match i18n/catalog.en.json`);

    for (const language of languages.supported) {
      const { code } = language;
      const htmlLang = language.htmlLang ?? code;
      const dir = language.dir ?? "ltr";
      if (!code || typeof code !== "string")
        fail("i18n/languages.json: every language needs a string code");
      if (!language.label || typeof language.label !== "string")
        fail(`${code}: every language needs a string label`);
      try {
        Intl.getCanonicalLocales(htmlLang);
      } catch {
        fail(`${code}: htmlLang ${JSON.stringify(htmlLang)} is not a valid BCP 47 tag`);
      }
      if (dir !== "ltr" && dir !== "rtl")
        fail(`${code}: dir must be either "ltr" or "rtl"`);

      const localePath = join(TRANSLATIONS_DIR, `${code}.json`);
      if (!existsSync(localePath)) {
        fail(`${localePath}: missing translation file`);
        continue;
      }
      const locale = readJson(localePath);
      if (!locale) continue;
      if (locale.meta?.language !== code)
        fail(`${localePath}: meta.language must be ${JSON.stringify(code)}`);

      for (const section of ["entries", "runtime"]) {
        const expectedSection =
          section === "entries" ? catalog.entries : defaultLocale.runtime;
        const expectedKeys = sortedKeys(expectedSection);
        const actualKeys = sortedKeys(locale[section]);
        if (!sameArray(actualKeys, expectedKeys)) {
          const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
          const extra = actualKeys.filter((key) => !expectedKeys.includes(key));
          if (missing.length) fail(`${code}.${section}: missing keys: ${missing.join(", ")}`);
          if (extra.length) fail(`${code}.${section}: unexpected keys: ${extra.join(", ")}`);
        }
        for (const key of expectedKeys)
          validateEntry(code, section, key, expectedSection[key], locale[section]?.[key]);
      }

      for (const selectorLanguage of languages.supported) {
        const key = `runtime.lang.name.${selectorLanguage.code}`;
        if (!locale.runtime?.[key]) fail(`${code}.runtime: missing selector label ${key}`);
      }

      const outputPath =
        code === languages.default
          ? join(PUBLIC_DIR, "index.html")
          : join(PUBLIC_DIR, code, "index.html");
      if (!existsSync(outputPath)) {
        fail(`${outputPath}: missing generated page`);
        continue;
      }
      const html = readFileSync(outputPath, "utf8");
      if (!html.startsWith(GENERATED_MARKER))
        fail(`${outputPath}: missing generated-file marker`);
      const htmlOpen = new RegExp(
        `<html[^>]*\\blang="${regexEscape(htmlLang)}"[^>]*\\bdir="${dir}"[^>]*>`,
        "i"
      );
      if (!htmlOpen.test(html))
        fail(`${outputPath}: expected <html lang="${htmlLang}" dir="${dir}">`);
      if (!html.includes(`language: ${JSON.stringify(code)}`))
        fail(`${outputPath}: embedded runtime language does not match ${code}`);
      if (!html.includes(`htmlLang: ${JSON.stringify(htmlLang)}`))
        fail(`${outputPath}: embedded htmlLang does not match ${htmlLang}`);
      if (!html.includes(`dir: ${JSON.stringify(dir)}`))
        fail(`${outputPath}: embedded direction does not match ${dir}`);
    }
  }

  const sourceFiles = [
    ...readdirSync(PUBLIC_DIR)
      .filter((name) => name.endsWith(".js"))
      .map((name) => join(PUBLIC_DIR, name)),
    ...readdirSync(join(PUBLIC_DIR, "util"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => join(PUBLIC_DIR, "util", name)),
  ];
  const usedRuntimeKeys = new Set();
  for (const path of sourceFiles) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(
      /(?:\b(?:t|tf)|__scat6T|__scat6Format)\s*\(\s*["'](runtime\.[^"']+)["']/g
    ))
      usedRuntimeKeys.add(match[1]);
  }
  const definedRuntimeKeys = new Set(
    sortedKeys(readJson(join(TRANSLATIONS_DIR, `${languages.default}.json`))?.runtime)
  );
  for (const key of usedRuntimeKeys)
    if (!definedRuntimeKeys.has(key)) fail(`runtime key used by JavaScript but undefined: ${key}`);
}

if (errors.length) {
  console.error(`i18n validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("i18n validation passed.");
}
