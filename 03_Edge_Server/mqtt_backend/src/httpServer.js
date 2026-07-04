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

function startHttpServer() {
  const app = express();
  const port = Number.parseInt(process.env.HTTP_PORT || '3001', 10);
  const publicDir = path.join(__dirname, '..', 'public');

  app.use(cors(buildCorsOptions()));
  app.use(express.json());
  app.use(deviceRoutes);
  app.get('/', (request, response) => {
    response.sendFile(path.join(publicDir, 'index.html'));
  });
  app.use(express.static(publicDir));

  server = app.listen(port, () => {
    console.log(`REST API listening on http://localhost:${port}`);
    console.log(`Dashboard available at http://localhost:${port}/`);
  });

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
  startHttpServer,
  closeHttpServer,
};
