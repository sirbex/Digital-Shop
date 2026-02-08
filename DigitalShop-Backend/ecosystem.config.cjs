/**
 * PM2 Ecosystem Configuration
 * 
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.cjs
 *   pm2 status
 *   pm2 logs digitalshop-api
 *   pm2 restart digitalshop-api
 *   pm2 stop digitalshop-api
 *
 * Auto-start on boot:
 *   pm2 startup
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'digitalshop-api',
      script: 'dist/server.js',
      cwd: __dirname,

      // Environment
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 8340,
      },

      // Process management
      instances: 1,               // Single instance (PostgreSQL handles concurrency)
      exec_mode: 'fork',          // Fork mode (use 'cluster' only if stateless)
      autorestart: true,           // Auto-restart on crash
      watch: false,                // Do NOT watch files in production
      max_restarts: 10,            // Max restarts before stopping
      min_uptime: '10s',           // Min uptime to be considered started
      restart_delay: 4000,         // Wait 4s between restarts

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // Memory management
      max_memory_restart: '500M',  // Restart if memory exceeds 500MB

      // Graceful shutdown
      kill_timeout: 5000,          // Wait 5s for graceful shutdown
      listen_timeout: 8000,        // Wait 8s for app to be ready
    },
  ],
};
