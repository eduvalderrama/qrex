// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let toSJISFunction: (arg0: any) => any;
const CODEWORDS_COUNT = [
  0, // Not used
  26,
  44,
  70,
  100,
  134,
  172,
  196,
  242,
  292,
  346,
  404,
  466,
  532,
  581,
  655,
  733,
  815,
  901,
  991,
  1085,
  1156,
  1258,
  1364,
  1474,
  1588,
  1706,
  1828,
  1921,
  2051,
  2185,
  2323,
  2465,
  2611,
  2761,
  2876,
  3034,
  3196,
  3362,
  3532,
  3706,
];

/**
 * Returns the QR Code size for the specified version
 *
 * @param  {Number} version QR Code version
 * @return {Number}         size of QR code
 */
function getSymbolSize(version: number): number {
  if (!version) throw new Error('"version" cannot be null or undefined');
  if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40');
  return version * 4 + 17;
}

/**
 * Returns the total number of codewords used to store data and EC information.
 *
 * @param  {Number} version QR Code version
 * @return {Number}         Data length in bits
 */
function getSymbolTotalCodewords(version: number): number {
  return CODEWORDS_COUNT[version];
}

/**
 * Encode data with Bose-Chaudhuri-Hocquenghem
 */
function getBCHDigit(data: number) {
  let digit = 0;
  let value = data;

  while (value !== 0) {
    digit++;
    value >>>= 1;
  }

  return digit;
}

function setToSJISFunction(f) {
  if (typeof f !== "function") {
    throw new Error('"toSJISFunc" is not a valid function.');
  }

  toSJISFunction = f;
}

function isKanjiModeEnabled() {
  return typeof toSJISFunction !== "undefined";
}

function toSJIS(kanji) {
  return toSJISFunction(kanji);
}

export const CoreUtils = {
  getSymbolSize,
  getSymbolTotalCodewords,
  getBCHDigit,
  setToSJISFunction,
  isKanjiModeEnabled,
  toSJIS,
};
