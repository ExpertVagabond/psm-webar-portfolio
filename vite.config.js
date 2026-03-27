import { defineConfig } from 'vite'
export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mediapipe/tasks-vision')) return 'mediapipe';
          if (id.includes('three/examples/jsm')) return 'three-addons';
          if (id.includes('node_modules/three')) return 'three-core';
        },
      },
    },
  },
  server: { port: 3005 },
})
