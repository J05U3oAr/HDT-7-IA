export function log(service, event, details = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), service, event, ...details }));
}
