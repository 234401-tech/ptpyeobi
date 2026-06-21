import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 백엔드(FastAPI)는 8000 포트. /api 요청은 dev 서버가 프록시.
export default defineConfig({
  plugins: [react()],
  // run.bat 이 미리 출력한 헤더(여비뚝딱/프론트엔드/팀원 접속/백엔드 API) 가
  // Vite 시작 시 지워지지 않도록 화면 클리어 비활성화.
  clearScreen: false,
  server: {
    // PORT 환경변수 우선 (Claude preview 자동할당). 미지정 시 5173.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
