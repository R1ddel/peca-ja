/**
 * O Metro não sabe abrir "cloudflare:sockets".
 * Este arquivo pede o soquete só quando o servidor publicado atende o pedido.
 */
function loadSockets() {
  const spec = 'cloudflare:' + 'sockets';
  const g = globalThis;
  const req = g['require'] || g.$$require_external;
  if (typeof req !== 'function') {
    throw new Error('require ausente para sockets');
  }
  return req(spec);
}

function connect(address, options) {
  const mod = loadSockets();
  const open = mod && (mod.connect || (mod.default && mod.default.connect));
  if (typeof open !== 'function') {
    throw new Error('socket sem connect');
  }
  return open(address, options);
}

module.exports = { connect };
module.exports.connect = connect;
