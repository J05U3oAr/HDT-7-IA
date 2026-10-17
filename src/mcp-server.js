import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import calendar from './tools/calendar.cjs';
import knowledge from './tools/knowledge-base.cjs';
import { log } from './log.js';
import { isMain, listen, closeServer } from './runtime.js';

function createToolServer() {
  const server = new McpServer({ name: 'parachute-tools', version: '1.0.0' });
  function register(name, description, inputSchema, operation, isError = () => false) {
    server.registerTool(name, { description, inputSchema }, async input => {
      log('MCP', 'tool.start', { tool: name, input });
      try {
        const output = operation(input);
        const failed = isError(output);
        log('MCP', 'tool.end', { tool: name, output, isError: failed });
        return { content: [{ type: 'text', text: JSON.stringify(output) }], isError: failed };
      } catch (error) {
        log('MCP', 'tool.error', { tool: name, error: error.message });
        return { content: [{ type: 'text', text: error.message }], isError: true };
      }
    });
  }
  register('knowledge_search_faq', 'Consulta las FAQ oficiales de Parachute: horario, cancelación y contacto.',
    { question: z.string().min(1).max(4000) }, ({ question }) => ({ faq: knowledge.searchFaq(question) }));
  register('calendar_create_appointment', 'Crea una cita de lunes a viernes entre 08:00 y 17:00, hora de Guatemala.',
    { date: z.string(), time: z.string(), reason: z.string().min(1).max(1000) },
    calendar.createAppointment, output => !output.ok);
  return server;
}

export function createMcpApp() {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ service: 'MCP', status: 'ok' }));
  app.post('/mcp', async (req, res) => {
    // Cada petición tiene su transporte; el calendario vive en el proceso servidor.
    const server = createToolServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      log('MCP', 'request.error', { error: error.message });
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Error interno MCP' } });
    }
  });
  app.all('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').end());
  return app;
}

if (isMain(import.meta.url)) {
  const port = Number(process.env.MCP_PORT || 3001);
  const server = await listen(createMcpApp(), port);
  log('MCP', 'server.ready', { url: `http://127.0.0.1:${port}/mcp`, transport: 'Streamable HTTP' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await closeServer(server); });
}
