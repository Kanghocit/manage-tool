/** PM2 process for production API. FE is served by Nginx from fe/dist. */
module.exports = {
  apps: [
    {
      name: 'manage-tool-api',
      cwd: './be',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
