import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const domainHttpsKeyPath = resolve(projectRoot, '.cert/atvardovsky.dev-key.pem');
const domainHttpsCertPath = resolve(projectRoot, '.cert/atvardovsky.dev-cert.pem');
const localhostHttpsKeyPath = resolve(projectRoot, '.cert/localhost-key.pem');
const localhostHttpsCertPath = resolve(projectRoot, '.cert/localhost-cert.pem');
const useHttps = process.env.VITE_DISABLE_HTTPS !== 'true';
const httpsKeyPath =
  process.env.VITE_HTTPS_KEY_PATH ??
  (existsSync(domainHttpsKeyPath) && existsSync(domainHttpsCertPath)
    ? domainHttpsKeyPath
    : localhostHttpsKeyPath);
const httpsCertPath =
  process.env.VITE_HTTPS_CERT_PATH ??
  (existsSync(domainHttpsKeyPath) && existsSync(domainHttpsCertPath)
    ? domainHttpsCertPath
    : localhostHttpsCertPath);
const https =
  useHttps && existsSync(httpsKeyPath) && existsSync(httpsCertPath)
    ? {
        key: readFileSync(httpsKeyPath),
        cert: readFileSync(httpsCertPath),
      }
    : undefined;

const apiProxy = {
  target: 'http://127.0.0.1:3000',
  changeOrigin: false,
  secure: false,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5137,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'atvardovsky.dev',
      'www.atvardovsky.dev',
      '193.34.144.203',
    ],
    https,
    proxy: {
      '/auth': apiProxy,
      '/student-profile': apiProxy,
      '/tutor': apiProxy,
      '/admin': apiProxy,
      '/usage': apiProxy,
      '/webrtc': apiProxy,
      '/health': apiProxy,
    },
  },
});
