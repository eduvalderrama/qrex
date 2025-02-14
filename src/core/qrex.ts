import type { ErrorCorrectionLevelBit, MaskPatternType, Segment } from "../types/qrex.type";
import type { QRData, QrexOptions, QrContent } from "../types/qrex.type";
import { AlignmentPattern } from "./alignment-pattern";
import { BitBuffer } from "./bit-buffer";
import { BitMatrix } from "./bit-matrix";
import { ECCode } from "./error-correction-code";
import { ECLevel } from "./error-correction-level";
import { FinderPattern } from "./finder-pattern";
import { FormatInfo } from "./format-info";
import { MaskPattern } from "./mask-pattern";
import { Mode } from "./mode";
import { ReedSolomonEncoder } from "./reed-solomon-encoder";
import { Segments } from "./segments";
import { CoreUtils } from "./utils";
import { Version } from "./version";

/**
 * Add finder patterns bits to matrix
 */
function setupFinderPattern(matrix: BitMatrix, version: number) {
  const size = matrix.size;
  const pos = FinderPattern.getPositions(version);

  for (let i = 0; i < pos.length; i++) {
    const row = pos[i][0];
    const col = pos[i][1];

    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || size <= row + r) continue;

      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || size <= col + c) continue;

        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix.set(row + r, col + c, Number(true), true);
        } else {
          matrix.set(row + r, col + c, Number(false), true);
        }
      }
    }
  }
}

/**
 * Add timing pattern bits to matrix
 *
 * Note: this function must be called before {@link setupAlignmentPattern}
 */
function setupTimingPattern(matrix: BitMatrix) {
  const size = matrix.size;

  for (let r = 8; r < size - 8; r++) {
    const value = r % 2 === 0;
    matrix.set(r, 6, Number(value), true);
    matrix.set(6, r, Number(value), true);
  }
}

/**
 * Add alignment patterns bits to matrix
 *
 * Note: this function must be called after {@link setupTimingPattern}
 */
function setupAlignmentPattern(matrix: BitMatrix, version: number) {
  const pos = AlignmentPattern.getPositions(version);

  for (let i = 0; i < pos.length; i++) {
    const row = pos[i][0];
    const col = pos[i][1];

    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
          matrix.set(row + r, col + c, Number(true), true);
        } else {
          matrix.set(row + r, col + c, Number(false), true);
        }
      }
    }
  }
}

/**
 * Add version info bits to matrix
 */
function setupVersionInfo(matrix: BitMatrix, version: number) {
  const size = matrix.size;
  const bits = Version.getEncodedBits(version);
  let row: number;
  let col: number;
  let mod: boolean;

  for (let i = 0; i < 18; i++) {
    row = Math.floor(i / 3);
    col = (i % 3) + size - 8 - 3;
    mod = ((bits >> i) & 1) === 1;

    matrix.set(row, col, Number(mod), true);
    matrix.set(col, row, Number(mod), true);
  }
}

/**
 * Add format info bits to matrix
 */
function setupFormatInfo(
  matrix: BitMatrix,
  errorCorrectionLevel: ErrorCorrectionLevelBit,
  maskPattern: MaskPatternType,
) {
  const size = matrix.size;
  const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
  let i: number;
  let mod: boolean;

  for (i = 0; i < 15; i++) {
    mod = ((bits >> i) & 1) === 1;

    // vertical
    if (i < 6) {
      matrix.set(i, 8, Number(mod), true);
    } else if (i < 8) {
      matrix.set(i + 1, 8, Number(mod), true);
    } else {
      matrix.set(size - 15 + i, 8, Number(mod), true);
    }

    // horizontal
    if (i < 8) {
      matrix.set(8, size - i - 1, Number(mod), true);
    } else if (i < 9) {
      matrix.set(8, 15 - i - 1 + 1, Number(mod), true);
    } else {
      matrix.set(8, 15 - i - 1, Number(mod), true);
    }
  }

  // fixed module
  matrix.set(size - 8, 8, 1, true);
}

/**
 * Add encoded data bits to matrix
 */
function setupData(matrix: BitMatrix, data: Uint8Array) {
  const size = matrix.size;
  let inc = -1;
  let row = size - 1;
  let bitIndex = 7;
  let byteIndex = 0;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;

    while (true) {
      for (let c = 0; c < 2; c++) {
        if (!matrix.isReserved(row, col - c)) {
          let dark = false;

          if (byteIndex < data.length) {
            dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
          }

          matrix.set(row, col - c, Number(dark));
          bitIndex--;

          if (bitIndex === -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }

      row += inc;

      if (row < 0 || size <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }
}

/**
 * Create encoded codewords from data input
 */
function createData(version: number, errorCorrectionLevel: ErrorCorrectionLevelBit, segments: Segment[]) {
  // Prepare data buffer
  const buffer = new BitBuffer();

  for (const data of segments) {
    // prefix data with mode indicator (4 bits)
    buffer.put(data.mode.bit, 4);

    // Prefix data with character count indicator.
    // The character count indicator is a string of bits that represents the
    // number of characters that are being encoded.
    // The character count indicator must be placed after the mode indicator
    // and must be a certain number of bits long, depending on the QR version
    // and data mode
    // @see {@link Mode.getCharCountIndicator}.
    buffer.put(data.getLength!(), Mode.getCharCountIndicator(data.mode, version));

    // add binary data sequence to buffer
    data.write!(buffer);
  }

  // Calculate required number of bits
  const totalCodewords = CoreUtils.getSymbolTotalCodewords(version);
  const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
  const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;

  // Add a terminator.
  // If the bit string is shorter than the total number of required bits,
  // a terminator of up to four 0s must be added to the right side of the string.
  // If the bit string is more than four bits shorter than the required number of bits,
  // add four 0s to the end.
  if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
    buffer.put(0, 4);
  }

  // If the bit string is fewer than four bits shorter, add only the number of 0s that
  // are needed to reach the required number of bits.

  // After adding the terminator, if the number of bits in the string is not a multiple of 8,
  // pad the string on the right with 0s to make the string's length a multiple of 8.
  while (buffer.getLengthInBits() % 8 !== 0) {
    buffer.putBit(0);
  }

  // Add pad bytes if the string is still shorter than the total number of required bits.
  // Extend the buffer to fill the data capacity of the symbol corresponding to
  // the Version and Error Correction Level by adding the Pad Codewords 11101100 (0xEC)
  // and 00010001 (0x11) alternately.
  const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
  for (let i = 0; i < remainingByte; i++) {
    buffer.put(i % 2 ? 0x11 : 0xec, 8);
  }

  return createCodewords(buffer, version, errorCorrectionLevel);
}

/**
 * Encode input data with Reed-Solomon and return codewords with
 * relative error correction bits
 */
function createCodewords(bitBuffer: BitBuffer, version: number, errorCorrectionLevel: ErrorCorrectionLevelBit) {
  // Total codewords for this QR code version (Data + Error correction)
  const totalCodewords = CoreUtils.getSymbolTotalCodewords(version);

  // Total number of error correction codewords
  const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);

  // Total number of data codewords
  const dataTotalCodewords = totalCodewords - ecTotalCodewords;

  // Total number of blocks
  const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);

  // Calculate how many blocks each group should contain
  const blocksInGroup2 = totalCodewords % ecTotalBlocks;
  const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;

  const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);

  const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
  const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;

  // Number of EC codewords is the same for both groups
  const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;

  // Initialize a Reed-Solomon encoder with a generator polynomial of degree ecCount
  const rs = new ReedSolomonEncoder(ecCount);

  let offset = 0;
  const dcData = new Array(ecTotalBlocks);
  const ecData = new Array(ecTotalBlocks);
  let maxDataSize = 0;
  const buffer = new Uint8Array(bitBuffer.buffer);

  // Divide the buffer into the required number of blocks
  for (let b = 0; b < ecTotalBlocks; b++) {
    const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;

    // extract a block of data from buffer
    dcData[b] = buffer.slice(offset, offset + dataSize);

    // Calculate EC codewords for this data block
    ecData[b] = rs.encode(dcData[b]);

    offset += dataSize;
    maxDataSize = Math.max(maxDataSize, dataSize);
  }

  // Create final data
  // Interleave the data and error correction codewords from each block
  const data = new Uint8Array(totalCodewords);
  let index = 0;
  let i: number;
  let r: number;

  // Add data codewords
  for (i = 0; i < maxDataSize; i++) {
    for (r = 0; r < ecTotalBlocks; r++) {
      if (i < dcData[r].length) {
        data[index++] = dcData[r][i];
      }
    }
  }

  // Apped EC codewords
  for (i = 0; i < ecCount; i++) {
    for (r = 0; r < ecTotalBlocks; r++) {
      data[index++] = ecData[r][i];
    }
  }

  return data;
}

/**
 * Build QR Code symbol
 */
function createSymbol(
  data: QrContent,
  errorCorrectionLevel: ErrorCorrectionLevelBit,
  maskPattern?: MaskPatternType,
  version?: number,
): QRData {
  let estimatedVersion = version;

  if (!estimatedVersion) {
    const rawSegments = Segments.rawSplit(data);

    // Estimate best version that can contain raw splitted segments
    estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
  }

  // Build optimized segments
  // If estimated version is undefined, try with the highest version
  const segments = Segments.fromString(data, estimatedVersion || 40);

  // Get the min version that can contain data
  const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);

  // If no version is found, data cannot be stored
  if (!bestVersion) {
    throw new Error("The amount of data is too big to be stored in a QR Code");
  }

  // If not specified, use min version as default
  if (!version) {
    version = bestVersion;

    // Check if the specified version can contain the data
  } else if (version < bestVersion) {
    throw new Error(
      `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ${bestVersion}.
`,
    );
  }

  const dataBits = createData(version, errorCorrectionLevel, segments);

  // Allocate matrix buffer
  const moduleCount = CoreUtils.getSymbolSize(version);
  const modules = new BitMatrix(moduleCount);

  // Add function modules
  setupFinderPattern(modules, version);
  setupTimingPattern(modules);
  setupAlignmentPattern(modules, version);

  // Add temporary dummy bits for format info just to set them as reserved.
  // This is needed to prevent these bits from being masked by {@link MaskPattern.applyMask}
  // since the masking operation must be performed only on the encoding region.
  // These blocks will be replaced with correct values later in code.
  setupFormatInfo(modules, errorCorrectionLevel, 0);

  if (version >= 7) {
    setupVersionInfo(modules, version);
  }

  // Add data codewords
  setupData(modules, dataBits);

  if (Number.isNaN(maskPattern)) {
    // Find best mask pattern
    maskPattern = MaskPattern.getBestMask(modules, setupFormatInfo.bind(null, modules, errorCorrectionLevel));
  }

  // Apply mask pattern
  MaskPattern.applyMask(maskPattern!, modules);

  // Replace format info bits with correct values
  setupFormatInfo(modules, errorCorrectionLevel, maskPattern!);

  return {
    modules: modules,
    version: version,
    errorCorrectionLevel: errorCorrectionLevel,
    maskPattern: maskPattern!,
    segments: segments,
  };
}

/**
 * QR Code create
 */
function create(data: QrContent, options?: QrexOptions) {
  if (typeof data === "undefined" || data === "") {
    throw new Error("No input text");
  }

  let errorCorrectionLevel = ECLevel.M;
  let version: number | undefined;
  let mask: MaskPatternType | undefined;

  if (options) {
    // Use higher error correction level as default
    errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
    version = Version.from(options.version);
    mask = MaskPattern.from(options.maskPattern);

    if (options.toSJISFunc) {
      CoreUtils.setToSJISFunction(options.toSJISFunc);
    }
  }

  return createSymbol(data, errorCorrectionLevel, mask, version);
}

export const Qrex = {
  create,
};
