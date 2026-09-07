/**
 * PM2 sozlamasi.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs hozirol
 *   pm2 save && pm2 startup      # server qayta yuklansa avtomatik ishga tushadi
 *
 * Yuk oshganda: `instances` ni oshiring (BOT_MODE=webhook bo'lishi SHART).
 * Sessiya, navbat va qulflar PostgreSQL'da bo'lgani uchun bir nechta nusxa
 * bir-biriga xalaqit bermaydi.
 */
module.exports = {
  apps: [
    {
      name: "hozirol",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "600M",
      env: { NODE_ENV: "production" },
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
      // Qayta ishga tushishda ma'lumot yo'qolmasligi uchun
      // (index.ts dagi graceful shutdown 10 soniyada ulguradi)
      kill_timeout: 12000,
    },
  ],
};
