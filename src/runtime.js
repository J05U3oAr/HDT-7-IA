import { pathToFileURL } from 'node:url';

export function isMain(meta) {
  return Boolean(process.argv[1]) && meta === pathToFileURL(process.argv[1]).href;
}

export async function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

export async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeIdleConnections();
  });
}
