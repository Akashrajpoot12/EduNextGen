import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split heavy libraries into their own cacheable chunks instead of one
        // ~3.2MB monolith. face-api/TensorFlow only loads on the (lazy) Face AI route.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("face-api.js") || id.includes("@tensorflow")) return "faceapi";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("leaflet")) return "maps";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("react-router")) return "router";
        },
      },
    },
  },
})
