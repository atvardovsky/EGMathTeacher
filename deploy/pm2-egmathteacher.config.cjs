module.exports = {
  apps: [
    {
      name: 'egmathteacher-api',
      cwd: '<TARGET_REPOSITORY_ROOT>/apps/api',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
