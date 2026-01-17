import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Inject data-source attribute for AI agent source location
          "./scripts/babel-plugin-jsx-source-location.cjs",
        ],
      },
    }),
    tailwindcss(),
    viteSingleFile(),
  ],
  resolve: { 
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ['react', 'react-dom'],
  },
  base: "./",
  build: { 
    outDir: "dist", 
    emptyOutDir: true,
    assetsInlineLimit: 100000000, // 100MB, force inline all assets
  },
});
