/*
Rewrite of the tests from https://github.com/google/diff-match-patch/pull/80
using jest/typescript.
*/
import { DiffOperation } from "../../src/types";
const { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } = DiffOperation;
import { DiffMatchPatch } from "../../src/core";

describe("tests of surrogate pairs (unicode)", () => {
  const dmp = new DiffMatchPatch();

  it("toDelta", () => {
    const diffs = [
      [DIFF_EQUAL, "\ud83d\ude4b\ud83d"],
      [DIFF_INSERT, "\ude4c\ud83d"],
      [DIFF_EQUAL, "\ude4b"],
    ];
    const delta = dmp.diff_toDelta(diffs);
    expect(delta).toEqual("=2\t+%F0%9F%99%8C\t=2");
  });

  it("Unicode - splitting surrogates: Inserting similar surrogate pair at beginning", () => {
    expect(
      dmp.diff_toDelta([
        [DIFF_INSERT, "\ud83c\udd71"],
        [DIFF_EQUAL, "\ud83c\udd70\ud83c\udd71"],
      ]),
    ).toEqual(
      dmp.diff_toDelta(
        dmp.diff_main(
          "\ud83c\udd70\ud83c\udd71",
          "\ud83c\udd71\ud83c\udd70\ud83c\udd71",
        ),
      ),
    );
  });

  it("applies some random edits to string and returns new, edited string", () => {
    const originalText = `U+1F17x	🅰️	🅱️		🅾️	🅿️ safhawifhkw
    U+1F18x															🆎
    0	1	2	3	4	5	6	7	8	9	A	B	C	D	E	F
    U+1F19x		🆑	🆒	🆓	🆔	🆕	🆖	🆗	🆘	🆙	🆚
    U+1F20x		🈁	🈂️							sfss.,_||saavvvbbds
    U+1F21x	🈚
    U+1F22x			🈯
    U+1F23x			🈲	🈳	🈴	🈵	🈶	🈷️	🈸	🈹	🈺
    U+1F25x	🉐	🉑
    U+1F30x	🌀	🌁	🌂	🌃	🌄	🌅	🌆	🌇	🌈	🌉	🌊	🌋	🌌	🌍	🌎	🌏
    U+1F31x	🌐	🌑	🌒	🌓	🌔	🌕	🌖	🌗	🌘	🌙	🌚	🌛	🌜	🌝	🌞	`;

    function applyRandomTextEdit(text) {
      let textArr = [...text];
      let r = Math.random();
      if (r < 1 / 3) {
        // swap
        let swapCount = Math.floor(Math.random() * 5);
        for (let i = 0; i < swapCount; i++) {
          let swapPos1 = Math.floor(Math.random() * textArr.length);
          let swapPos2 = Math.floor(Math.random() * textArr.length);
          let char1 = textArr[swapPos1];
          let char2 = textArr[swapPos2];
          textArr[swapPos1] = char2;
          textArr[swapPos2] = char1;
        }
      } else if (r < 2 / 3) {
        // remove
        let removeCount = Math.floor(Math.random() * 5);
        for (let i = 0; i < removeCount; i++) {
          let removePos = Math.floor(Math.random() * textArr.length);
          textArr[removePos] = "";
        }
      } else {
        // add
        let addCount = Math.floor(Math.random() * 5);
        for (let i = 0; i < addCount; i++) {
          let addPos = Math.floor(Math.random() * textArr.length);
          let addFromPos = Math.floor(Math.random() * textArr.length);
          textArr[addPos] = textArr[addPos] + textArr[addFromPos];
        }
      }
      return textArr.join("");
    }

    for (let i = 0; i < 1e4; i++) {
      const newText = applyRandomTextEdit(originalText);
      // just check this doesn't crash:
      dmp.diff_toDelta(dmp.diff_main(originalText, newText));

      // make a patch and confirm that patching does what it should:
      const patch = dmp.patch_make(originalText, newText);
      const [patchedText] = dmp.patch_apply(patch, originalText);
      expect(patchedText).toEqual(newText);
    }
  });

  it("Inserting similar surrogate pair in the middle works", () => {
    expect(
      dmp.diff_toDelta([
        [DIFF_EQUAL, "\ud83c\udd70"],
        [DIFF_INSERT, "\ud83c\udd70"],
        [DIFF_EQUAL, "\ud83c\udd71"],
      ]),
    ).toEqual(
      dmp.diff_toDelta(
        dmp.diff_main(
          "\ud83c\udd70\ud83c\udd71",
          "\ud83c\udd70\ud83c\udd70\ud83c\udd71",
        ),
      ),
    );
  });

  // assuming `dmp` and DIFF_* are in scope

  const expectDeltaEq = (lhsDiff: any, rhsDiff: any) => {
    // Ensure neither side crashes when converted to delta
    expect(() => dmp.diff_toDelta(lhsDiff)).not.toThrow();
    expect(() => dmp.diff_toDelta(rhsDiff)).not.toThrow();

    // And ensure the deltas are identical
    const left = dmp.diff_toDelta(lhsDiff);
    const right = dmp.diff_toDelta(rhsDiff);
    expect(left).toEqual(right);
  };

  describe("surrogate pair handling and delta equivalence", () => {
    it("Inserting similar surrogate pair in the middle works", () => {
      expect(
        dmp.diff_toDelta([
          [DIFF_EQUAL, "\ud83c\udd70"],
          [DIFF_INSERT, "\ud83c\udd70"],
          [DIFF_EQUAL, "\ud83c\udd71"],
        ]),
      ).toEqual(
        dmp.diff_toDelta(
          dmp.diff_main(
            "\ud83c\udd70\ud83c\udd71",
            "\ud83c\udd70\ud83c\udd70\ud83c\udd71",
          ),
        ),
      );
    });

    it("Deleting similar surrogate pair at the beginning does not crash and matches delta", () => {
      expectDeltaEq(
        [
          [DIFF_DELETE, "\ud83c\udd71"],
          [DIFF_EQUAL, "\ud83c\udd70\ud83c\udd71"],
        ],
        dmp.diff_main(
          "\ud83c\udd71\ud83c\udd70\ud83c\udd71",
          "\ud83c\udd70\ud83c\udd71",
        ),
      );
    });

    it("Deleting similar surrogate pair in the middle does not crash and matches delta", () => {
      expectDeltaEq(
        [
          [DIFF_EQUAL, "\ud83c\udd70"],
          [DIFF_DELETE, "\ud83c\udd72"],
          [DIFF_EQUAL, "\ud83c\udd71"],
        ],
        dmp.diff_main(
          "\ud83c\udd70\ud83c\udd72\ud83c\udd71",
          "\ud83c\udd70\ud83c\udd71",
        ),
      );
    });

    it("Swap surrogate pair (delete A insert B) equals separating halves (EQUAL high, then low halves)", () => {
      expectDeltaEq(
        [
          [DIFF_DELETE, "\ud83c\udd70"],
          [DIFF_INSERT, "\ud83c\udd71"],
        ],
        [
          [DIFF_EQUAL, "\ud83c"],
          [DIFF_DELETE, "\udd70"],
          [DIFF_INSERT, "\udd71"],
        ],
      );
    });

    it("Swap surrogate pair (insert A delete B) equals separating halves (EQUAL high, then low halves)", () => {
      expectDeltaEq(
        [
          [DIFF_INSERT, "\ud83c\udd70"],
          [DIFF_DELETE, "\ud83c\udd71"],
        ],
        [
          [DIFF_EQUAL, "\ud83c"],
          [DIFF_INSERT, "\udd70"],
          [DIFF_DELETE, "\udd71"],
        ],
      );
    });

    it("Empty diff groups are ignored in delta", () => {
      expectDeltaEq(
        [
          [DIFF_EQUAL, "abcdef"],
          [DIFF_DELETE, ""],
          [DIFF_INSERT, "ghijk"],
        ],
        [
          [DIFF_EQUAL, "abcdef"],
          [DIFF_INSERT, "ghijk"],
        ],
      );
    });
  });
});
