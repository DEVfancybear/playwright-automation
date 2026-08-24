'use strict';

// Playwright MCP loads --init-page with require() and calls the default export
// as func(page). Keep this CommonJS adapter tiny so Node 20 does not need to
// synchronously require the ESM implementation.
module.exports.default = async function initMcpAuthBridge(page) {
  const { default: init } = await import('./mcp-auth-init.mjs');
  return init(page);
};
