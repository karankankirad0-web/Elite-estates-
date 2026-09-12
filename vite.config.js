import { defineConfig } from 'vite';
import { resolve } from 'path';

// Multi-page app: the public marketing site plus two standalone admin pages.
// Customers never see /admin/* — it is not linked from the public nav.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        adminLogin: resolve(__dirname, 'admin/login.html'),
        adminDashboard: resolve(__dirname, 'admin/dashboard.html')
      }
    }
  }
});
