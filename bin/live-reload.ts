export const liveReloadCode = `
(() => {
  const origins = ORIGIN_URL;
  const wsUrls = Array.isArray(origins) 
    ? origins.map(origin => {
        const protocol = origin.startsWith('https') ? 'wss' : 'ws';
        return \`\${protocol}://\${origin.replace(/^https?:\\/\\//, '')}/_reload\`;
      })
    : [\`WS_PROTOCOL://localhost:PORT_NUMBER/_reload\`];

  function connectWebSocket(url) {
    const ws = new WebSocket(url);
    ws.addEventListener('message', () => location.reload());
    ws.addEventListener('close', () => {
      // Try to reconnect after a delay
      setTimeout(() => connectWebSocket(url), 1000);
    });
    return ws;
  }

  // Connect to all available WebSocket URLs
  wsUrls.forEach(url => connectWebSocket(url));
})();
`;
