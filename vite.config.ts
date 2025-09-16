import MillionCompiler from "@million/lint";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    // Only enable Million in development for faster builds
    process.env.NODE_ENV === 'development' ? MillionCompiler.vite() : null,
    react({
      // Optimize React for production
      jsxRuntime: 'automatic',
    }),
    process.env.NODE_ENV === 'development' ? runtimeErrorOverlay() : null,
    themePlugin()
  ].filter(Boolean),
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  
  root: path.resolve(__dirname, "client"),
  
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    
    // Aggressive optimization for maximum speed
    minify: 'esbuild', // Faster than terser
    cssMinify: true,
    
    rollupOptions: {
      output: {
        // Manual chunking for optimal loading
        manualChunks: {
          // Vendor chunk for better caching
          vendor: ['react', 'react-dom'],
          // UI components chunk
          ui: ['lucide-react', 'framer-motion'],
        },
      },
    },
    
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    
    // Enable source maps only in development
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Optimize for modern browsers
    target: 'esnext',
    
    // Compression and optimization
    reportCompressedSize: false, // Faster builds
  },
  
  // Optimize dev server
  server: {
    hmr: {
      overlay: false, // Faster HMR
    },
  },
  
  // Build performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@million/lint'], // Exclude from pre-bundling in prod
  },
});
