const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'egmathteacher-api',
      cwd: path.join(projectRoot, 'apps/api'),
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
