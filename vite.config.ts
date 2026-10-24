import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 纯静态站点：base 使用相对路径，dist/ 可放到任意子目录或静态托管。
 * 没有任何后端请求，所有数据只存在浏览器 localStorage。
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5190,
    strictPort: true,
    // 忽略测试产物与 npm/pnpm 的临时目录：Windows 上这些临时文件被占用时
    // 会让 chokidar 抛出 EBUSY 并直接崩掉 dev server。
    watch: {
      ignored: [
        '**/dist/**',
        '**/.e2e-out/**',
        '**/.layout-out/**',
        '**/.selftest-tmp/**',
        '**/node_modules/**',
        '**/.*.tmpdir/**',
        '**/.package.json.*.tmpdir/**',
      ],
    },
  },
  preview: { host: '127.0.0.1', port: 4190, strictPort: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
