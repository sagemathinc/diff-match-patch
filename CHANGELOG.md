# Changelogs

## Unreleased

- Fixed: `patch_make` (and `diff_toDelta`, `diff_prettyHtml`) no longer lose an edit when two texts differ only in the high surrogate before a shared low surrogate (for example "\ud83d\ude00" to "\ud83e\ude00"). The surrogate cleanup carried one high surrogate for both texts, so it dropped one of two different ones: the patch was empty and applying it left the old text, in every mode (time, unlimited or any work budget). It now carries one per text, moves a shared low surrogate into both edits when they differ, and returns a new array instead of changing its input. Diffs that split no pair are unchanged.
- Fixed: under a work budget, `diff_main` always checks equality and strips the common prefix and suffix, charging that step after it runs instead of paying ahead. A small edit to a long text (for example one line of 800 KB under a 25M limit) is no longer the whole text deleted and inserted; if the strip spends the budget, the diff is the prefix and suffix kept and the trivial diff of the middle. With enough budget, output is unchanged; the work done is still at most the limit plus one step.

## @cocalc/diff-match-patch 1.1.0

- Added: `diffWorkLimit`, a deterministic work budget for diffs in place of the wall-clock `diffTimeout`, so the same texts always give the same diff and patch (#1). With no limit set, output is byte-identical to 1.0.1.
- Changed: `patch_make` assembles patches in linear time, with byte-identical output (#2).
- Added: releases are published from GitHub Actions with npm trusted publishing (`.github/workflows/publish.yml`).

## 1.1.2 - August 26, 2025

- Changed: Tweak readme.

## 1.1.1 - August 26, 2025

- Changed: Upgrade packages.

## 1.0.8 - November 17, 2020

- Changed: Make diff_linesToChars and diff_charsToLines public.

## 1.0.7 - June 02, 2020

- Changed: Upgrade packages.

## 1.0.6 - December 17, 2019

- Changed: Upgrade packages.

## 1.0.4 - July 22, 2019

- Changed: Upgrade packages.

## 1.0.1 - March 01, 2019

- Fixed: Fixed the definitions of public members.

- Changed: Tweaked the readme file.

## 1.0.0 - March 01, 2019

- First release with all tests passed.
