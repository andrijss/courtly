import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.glb"],
  server: {
    port: 5173,
    allowedHosts: ["localhost", "127.0.0.1", "a78c-92-253-236-253.ngrok-free.app"],
  }
});
