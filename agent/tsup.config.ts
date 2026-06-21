import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  // Workspace package exports raw .ts - bundle it so `node dist/index.js` works without tsx.
  noExternal: ["@orbit/shared"],
});
