
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  resolve: {
    alias: {
      // Ensure proper resolution of react-is which is often required by charting libraries
      'react-is': 'react-is'
    }
  },
  build: {
    // Reverted to default minifier (esbuild) to resolve type errors in terserOptions
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
          'charts': ['recharts']
        }
      }
    }
  }
});
