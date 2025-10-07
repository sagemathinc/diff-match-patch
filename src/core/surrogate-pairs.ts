// Code from https://github.com/google/diff-match-patch/pull/80
// but converted to typescript, etc.

import type { Diff, HalfMatchArray, PatchApplyArray } from "../types";

/**
 * Rearrange diff boundaries that split Unicode surrogate pairs.
 *
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */
// mutates diff in place.
export function cleanupSplitSurrogates(diffs: Diff[]): Diff[] {
  var lastEnd;
  for (var x = 0; x < diffs.length; x++) {
    var thisDiff = diffs[x];
    var thisTop = thisDiff[1][0];
    var thisEnd = thisDiff[1][thisDiff[1].length - 1];

    if (0 === thisDiff[1].length) {
      diffs.splice(x--, 1);
      continue;
    }

    if (thisEnd && isHighSurrogate(thisEnd)) {
      lastEnd = thisEnd;
      thisDiff[1] = thisDiff[1].slice(0, -1);
    }

    if (
      lastEnd &&
      thisTop &&
      isHighSurrogate(lastEnd) &&
      isLowSurrogate(thisTop)
    ) {
      thisDiff[1] = lastEnd + thisDiff[1];
    }

    if (0 === thisDiff[1].length) {
      diffs.splice(x--, 1);
      continue;
    }
  }

  return diffs;
}

function isHighSurrogate(c: string): boolean {
  var v = c.charCodeAt(0);
  return v >= 0xd800 && v <= 0xdbff;
}

function isLowSurrogate(c: string): boolean {
  var v = c.charCodeAt(0);
  return v >= 0xdc00 && v <= 0xdfff;
}

function digit16(c: string): number {
  switch (c) {
    case "0":
      return 0;
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    case "6":
      return 6;
    case "7":
      return 7;
    case "8":
      return 8;
    case "9":
      return 9;
    case "A":
    case "a":
      return 10;
    case "B":
    case "b":
      return 11;
    case "C":
    case "c":
      return 12;
    case "D":
    case "d":
      return 13;
    case "E":
    case "e":
      return 14;
    case "F":
    case "f":
      return 15;
    default:
      throw new Error("Invalid hex-code");
  }
}

/**
 * Decode URI-encoded string but allow for encoded surrogate halves
 *
 * diff_match_patch needs this relaxation of the requirements because
 * not all libraries and versions produce valid URI strings in toDelta
 * and we don't want to crash this code when the input is valid input
 * but at the same time invalid utf-8
 *
 * @example: decodeURI( 'abcd%3A %F0%9F%85%B0' ) = 'abcd: \ud83c\udd70'
 * @example: decodeURI( 'abcd%3A %ED%A0%BC' ) = 'abcd: \ud83c'
 *
 * @cite: @mathiasbynens utf8.js at https://github.com/mathiasbynens/utf8.js
 *
 * @param {String} text input string encoded by encodeURI() or equivalent
 * @return {String}
 */
function decodeURI(text: string): string {
  try {
    return decodeURI(text);
  } catch (e) {
    var i = 0;
    var decoded = "";

    while (i < text.length) {
      if (text[i] !== "%") {
        decoded += text[i++];
        continue;
      }

      // start a percent-sequence
      var byte1 = (digit16(text[i + 1]) << 4) + digit16(text[i + 2]);
      if ((byte1 & 0x80) === 0) {
        decoded += String.fromCharCode(byte1);
        i += 3;
        continue;
      }

      if ("%" !== text[i + 3]) {
        throw new URIError("URI malformed");
      }

      var byte2 = (digit16(text[i + 4]) << 4) + digit16(text[i + 5]);
      if ((byte2 & 0xc0) !== 0x80) {
        throw new URIError("URI malformed");
      }
      byte2 = byte2 & 0x3f;
      if ((byte1 & 0xe0) === 0xc0) {
        decoded += String.fromCharCode(((byte1 & 0x1f) << 6) | byte2);
        i += 6;
        continue;
      }

      if ("%" !== text[i + 6]) {
        throw new URIError("URI malformed");
      }

      var byte3 = (digit16(text[i + 7]) << 4) + digit16(text[i + 8]);
      if ((byte3 & 0xc0) !== 0x80) {
        throw new URIError("URI malformed");
      }
      byte3 = byte3 & 0x3f;
      if ((byte1 & 0xf0) === 0xe0) {
        // unpaired surrogate are fine here
        decoded += String.fromCharCode(
          ((byte1 & 0x0f) << 12) | (byte2 << 6) | byte3,
        );
        i += 9;
        continue;
      }

      if ("%" !== text[i + 9]) {
        throw new URIError("URI malformed");
      }

      var byte4 = (digit16(text[i + 10]) << 4) + digit16(text[i + 11]);
      if ((byte4 & 0xc0) !== 0x80) {
        throw new URIError("URI malformed");
      }
      byte4 = byte4 & 0x3f;
      if ((byte1 & 0xf8) === 0xf0) {
        var codePoint =
          ((byte1 & 0x07) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;
        if (codePoint >= 0x010000 && codePoint <= 0x10ffff) {
          decoded += String.fromCharCode(
            (((codePoint & 0xffff) >>> 10) & 0x3ff) | 0xd800,
          );
          decoded += String.fromCharCode(0xdc00 | (codePoint & 0xffff & 0x3ff));
          i += 12;
          continue;
        }
      }

      throw new URIError("URI malformed");
    }

    return decoded;
  }
}
