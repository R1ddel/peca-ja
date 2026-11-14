const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const perfHooksShim = path.resolve(__dirname, 'shims/perf-hooks.js');
const socketsShim = path.resolve(__dirname, 'shims/cloudflare-sockets.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'perf_hooks' || moduleName === 'node:perf_hooks') {
    return { type: 'sourceFile', filePath: perfHooksShim };
  }
  if (moduleName === 'cloudflare:sockets') {
    return { type: 'sourceFile', filePath: socketsShim };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
