import express from 'express';
import { randomUUID } from 'node:crypto';
import { AgentCard, AGENT_CARD_PATH, Message } from '@a2a-js/sdk';
import { AgentEvent, DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { ParachuteCoordinator } from './agents.js';
import { log } from './log.js';
import { isMain, listen, closeServer } from './runtime.js';

export function createAgentCard(baseUrl) {
  return AgentCard.fromJSON({
    name: 'Parachute S.A.', version: '1.0.0',
    description: 'Sistema multiagente determinista: coordinador, agente de FAQ y agente de citas.',
    supportedInterfaces: [{ url: `${baseUrl}/a2a`, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ['text/plain'], defaultOutputModes: ['text/plain'],
    skills: [
      { id: 'faq', name: 'Preguntas frecuentes', description: 'Horario, contacto y política de cancelación/reprogramación.', tags: ['faq', 'soporte'], examples: ['¿Cuál es su horario?', '¿Cómo puedo cancelar una cita?'] },
      { id: 'appointments', name: 'Agendar citas', description: 'Reserva con fecha AAAA-MM-DD y hora HH:MM en Guatemala.', tags: ['calendario', 'citas'], examples: ['Agendar cita el 2026-10-19 a las 10:00 para asesoría.'] },
    ],
  });
}

export function createA2aApp({ baseUrl, mcpUrl }) {
  const coordinator = new ParachuteCoordinator(mcpUrl);
  const executor = {
    async execute(context, bus) {
      const requestId = context.userMessage.messageId;
      const text = context.userMessage.parts.filter(p => p.content?.$case === 'text').map(p => p.content.value).join('\n');
      const validationError = !text.trim() || text.length > 4000
        ? 'Envía una consulta de texto de 1 a 4000 caracteres.' : null;
      log('A2A', 'message.received', { requestId, text });
      try {
        if (validationError) throw new Error(validationError);
        const result = await coordinator.run(text, requestId);
        bus.publish(AgentEvent.message(Message.fromJSON({
          messageId: randomUUID(), contextId: context.contextId, role: 'ROLE_AGENT',
          parts: [{ text: result.answer }], metadata: { toolCalls: result.toolCalls, agents: result.agents },
        })));
        log('A2A', 'message.completed', { requestId, agents: result.agents, tools: result.toolCalls.map(t => t.name) });
      } catch (error) {
        log('A2A', 'message.error', { requestId, error: error.message });
        bus.publish(AgentEvent.message(Message.fromJSON({
          messageId: randomUUID(), contextId: context.contextId, role: 'ROLE_AGENT',
          parts: [{ text: validationError || 'No pude procesar la consulta. Verifica el servidor MCP y los logs e intenta nuevamente.' }], metadata: { error: true },
        })));
      } finally { bus.finished(); }
    },
    async cancelTask() { throw new Error('Este agente responde mensajes inmediatos; no crea tareas cancelables.'); },
  };
  const handler = new DefaultRequestHandler(createAgentCard(baseUrl), new InMemoryTaskStore(), executor);
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ service: 'A2A', status: 'ok' }));
  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: handler }));
  app.use('/a2a', jsonRpcHandler({ requestHandler: handler, userBuilder: UserBuilder.noAuthentication }));
  return app;
}

if (isMain(import.meta.url)) {
  const port = Number(process.env.A2A_PORT || 3000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const mcpUrl = process.env.MCP_URL || 'http://127.0.0.1:3001/mcp';
  const server = await listen(createA2aApp({ baseUrl, mcpUrl }), port);
  log('A2A', 'server.ready', { url: `${baseUrl}/a2a`, agentCard: `${baseUrl}/${AGENT_CARD_PATH}`, mcpUrl });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await closeServer(server); });
}
