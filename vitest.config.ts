import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "src/lib/split3mf/**/*.test.ts",
      "src/lib/fastener/**/*.test.ts",
      "src/lib/imageTools/**/*.test.ts",
      "src/lib/threeMfAnalyzer/**/*.test.ts",
      "src/lib/medal/**/*.test.ts",
      "src/lib/pencilPersonal/**/*.test.ts",
      "src/lib/penHolder/**/*.test.ts",
      "src/lib/estojoBorracha/**/*.test.ts",
      "src/lib/thermoform/**/*.test.ts",
      "src/lib/cakeTopper/**/*.test.ts",
      "src/lib/__tests__/paintEncoding.test.ts",
      "src/lib/__tests__/puzzlePaintBake.test.ts",
      "src/lib/__tests__/puzzlePalette.test.ts",
      "src/lib/__tests__/threeMfPaintExport.test.ts",
      "src/hooks/**/*.test.ts",
    ],
    globals: false,
  },
});