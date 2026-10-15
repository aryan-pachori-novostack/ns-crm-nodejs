const http = require('http');
const path = require('path');
global.appRoot = path.resolve(__dirname);
const app = require('./app');
const { initSocket } = require('./api/services/socket-services');
const port = normalizePort(process.env.PORT || 3001);
const Sentry = require('@sentry/node');
require('./instrument.js');

Sentry.setupExpressErrorHandler(app)
const server = http.createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

initSocket(server);

// The banker-mailbox IMAP connection is opened lazily on first use, per mailbox
// (see api/services/gmail-imap-manager.js) — no startup warm-connect.

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error
  }
  let bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
  };
};
function onListening() {
  let addr = server.address()
  let bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port
  console.error('Listening on ' + bind)
};

function normalizePort(val) {
  let port = parseInt(val, 10)
  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
};

module.exports = server;