const cors = require('cors');
const express = require('express');
const path = require('path');

const deviceRoutes = require('./routes/deviceRoutes');

let server = null;

function buildCorsOptions() {
  const origin = process.env.CORS_ORIGIN || '*';

  return {
    origin,
  };
}

function buildHttpApp(options = {}) {
  const app = express();
  const publicDir = options.publicDir || path.join(__dirname, '..', 'public');
  const frontendDir = options.frontendDir || path.join(__dirname, '..', '..', 'frontend', 'dist');

  app.use(cors(buildCorsOptions()));
  app.use(express.json());
  app.use(deviceRoutes);
  app.use(express.static(frontendDir));
  app.use(express.static(publicDir));
  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/') || request.path === '/health') {
      next();
      return;
    }

    response.sendFile(path.join(frontendDir, 'index.html'), (error) => {
      if (!error) {
        return;
      }

      response.sendFile(path.join(publicDir, 'index.html'));
    });
  });

  return app;
}

function startHttpServer() {
  const app = buildHttpApp();
  const port = Number.parseInt(process.env.HTTP_PORT || '3001', 10);
  const host = process.env.HTTP_HOST || null;

  const onListening = () => {
    const displayHost = host || 'localhost';
    console.log(`REST API listening on http://${displayHost}:${port}`);
    console.log(`Dashboard available at http://${displayHost}:${port}/`);
  };
  server = host ? app.listen(port, host, onListening) : app.listen(port, onListening);

  return server;
}

function closeHttpServer() {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      server = null;
      console.log('REST API server closed');
      resolve();
    });
  });
}

module.exports = {
  buildHttpApp,
  startHttpServer,
  closeHttpServer,
};
