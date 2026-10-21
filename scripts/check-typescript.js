// The repository builds and tests with the TypeScript it pins (5.x, from
// node_modules after `pnpm install --frozen-lockfile`): TypeScript 6
// deprecates this tsconfig's moduleResolution ("Node"), which the CommonJS
// build needs. Stop at once, with the reason, if another one is resolved.
const { version } = require("typescript");
if (!version.startsWith("5.")) {
  console.error(
    `TypeScript ${version} was resolved; this repository pins 5.x (package.json). ` +
      "Run `pnpm install --frozen-lockfile` and use npm test / npm run build (or npx tsc from node_modules).",
  );
  process.exit(1);
}
