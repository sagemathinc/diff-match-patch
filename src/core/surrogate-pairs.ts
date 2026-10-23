// Code from https://github.com/google/diff-match-patch/pull/80
// but converted to typescript, etc.

import { DiffOperation } from "../types";
import type { Diff, HalfMatchArray, PatchApplyArray } from "../types";

/**
 * Rearrange diff boundaries that split Unicode surrogate pairs.
 *
 * A diff ending in a high surrogate carries it to the next diff of the
 * same text: a delete's to the next delete or equality (text1), an
 * insert's to the next insert or equality (text2), an equality's to both.
 * An equality takes a carry only if both texts carry the same one; if they
 * differ (for example DELETE "\ud83d", INSERT "\ud83e", EQUAL "\ude00"),
 * the equality's leading low surrogate is shared, so each text's carry and
 * that low surrogate end the run's delete and insert instead. So both texts
 * are always exactly what the diffs say, and no edit is lost (the old
 * single carry dropped one of two different high surrogates, so the
 * patch lost the edit). Empty diffs are removed. Returns a new array; the
 * input is not changed.
 *
 * Diffs of well-formed text that split no pair come out as they went in
 * (less empty diffs). A lone high surrogate can change shape: at the end of
 * the input, DELETE "\ud83d", INSERT "\ud83d" becomes EQUAL "\ud83d". Both
 * texts are still exact; a lone surrogate is never made serializable.
 *
 * @param {!Array.<!diff_match_patch.Diff>} diffs Array of diff tuples.
 */
export function cleanupSplitSurrogates(diffs: Diff[]): Diff[] {
  const out: Diff[] = [];
  // What text1 and text2 carry to their next diff.
  let carry1 = "";
  let carry2 = "";
  // Where the edits since the last equality are in out (-1: none).
  let lastDelete = -1;
  let lastInsert = -1;

  // Add text to the end of the run's last delete (op -1) or insert (op 1),
  // or as a new one.
  const toRun = (op: DiffOperation, text: string) => {
    const at = op === DiffOperation.DIFF_DELETE ? lastDelete : lastInsert;
    if (at >= 0) {
      out[at][1] += text;
    } else {
      out.push([op, text]);
      if (op === DiffOperation.DIFF_DELETE) lastDelete = out.length - 1;
      else lastInsert = out.length - 1;
    }
  };

  for (const [op, data] of diffs) {
    // An empty diff is skipped: it splits nothing, and an empty equality
    // must not end a run before a carry's low surrogate (astra
    // CORR-DMP-STRIP-2: INSERT "\ud83d", EQUAL "", INSERT "\ude00").
    if (!data) continue;
    if (op === DiffOperation.DIFF_EQUAL) {
      let text = data;
      if (carry1 !== carry2) {
        // The texts carry different high surrogates (or only one does):
        // they end the run, each with the shared low surrogate after it.
        const low = text && isLowSurrogate(text[0]) ? text[0] : "";
        if (carry1 || low) toRun(DiffOperation.DIFF_DELETE, carry1 + low);
        if (carry2 || low) toRun(DiffOperation.DIFF_INSERT, carry2 + low);
        text = text.slice(low.length);
      } else {
        text = carry1 + text;
      }
      carry1 = carry2 = "";
      if (text && isHighSurrogate(text[text.length - 1])) {
        carry1 = carry2 = text[text.length - 1];
        text = text.slice(0, -1);
      }
      if (text) {
        out.push([op, text]);
        lastDelete = lastInsert = -1;
      }
    } else {
      const deleting = op === DiffOperation.DIFF_DELETE;
      let text = (deleting ? carry1 : carry2) + data;
      let carry = "";
      if (text && isHighSurrogate(text[text.length - 1])) {
        carry = text[text.length - 1];
        text = text.slice(0, -1);
      }
      if (deleting) carry1 = carry;
      else carry2 = carry;
      // An edit is kept as it is (never merged with another).
      if (text) {
        out.push([op, text]);
        if (deleting) lastDelete = out.length - 1;
        else lastInsert = out.length - 1;
      }
    }
  }
  // What is still carried ends its text (a lone high surrogate at the end).
  if (carry1 === carry2) {
    if (carry1) out.push([DiffOperation.DIFF_EQUAL, carry1]);
  } else {
    if (carry1) toRun(DiffOperation.DIFF_DELETE, carry1);
    if (carry2) toRun(DiffOperation.DIFF_INSERT, carry2);
  }
  return out;
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
