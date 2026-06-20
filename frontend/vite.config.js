import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 백엔드(FastAPI)는 8000 포트. /api 요청은 dev 서버가 프록시.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
