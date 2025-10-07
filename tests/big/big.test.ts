import { readFileSync } from "node:fs";
import { DiffMatchPatch } from "../../src/core";

describe("diff large strings", () => {
  it.skip("diffs a 2 million character shift", () => {
    const one = "x".repeat(2e6);
    const two = "a" + one.slice(0, -1);
    const dmp = new DiffMatchPatch();
    dmp.diffTimeout = 0.5;
    const p = dmp.diff_main(one, two);
  });

  it.skip("loads two largs strings from files and computes their diff, confirming that DiffTimeout works", () => {
    console.log(require("path").resolve("."));
    const one = readFileSync("tests/big/1.txt", "utf8");
    const two = readFileSync("tests/big/2.txt", "utf8");
    const dmp = new DiffMatchPatch();
    dmp.diffTimeout = 0.5;
    const p = dmp.diff_main(one, two);
  });
});
