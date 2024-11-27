const numeric = "[0-9]+";
const alphanumeric = "[A-Z $%*+\\-./:]+";
let kanji =
  "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|" +
  "[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|" +
  "[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|" +
  "[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
kanji = kanji.replace(/\\/g, "\\\\").replace(/u/g, "\\u");

const byte = `(?:(?![A-Z0-9 $%*+\\-./:]|${kanji})(?:.|[\r\n]))+`;

const KANJI = new RegExp(kanji, "g");
const BYTE_KANJI = /[^A-Z0-9 $%*+\-.\/:]+/g;
const BYTE = new RegExp(byte, "g");
const NUMERIC = new RegExp(numeric, "g");
const ALPHANUMERIC = new RegExp(alphanumeric, "g");

const TEST_KANJI = new RegExp(`^${kanji}$`);
const TEST_NUMERIC = new RegExp(`^${numeric}$`);
const TEST_ALPHANUMERIC = /^[A-Z0-9 $%*+\-.\/:]+$/;

function testKanji(str: string) {
  return TEST_KANJI.test(str);
}

function testNumeric(str: string) {
  return TEST_NUMERIC.test(str);
}

function testAlphanumeric(str: string) {
  return TEST_ALPHANUMERIC.test(str);
}

export const Regex = {
  KANJI,
  BYTE_KANJI,
  BYTE,
  NUMERIC,
  ALPHANUMERIC,
  testKanji,
  testNumeric,
  testAlphanumeric,
};