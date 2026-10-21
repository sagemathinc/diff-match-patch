# Changelogs

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
