import { randomUUID } from 'node:crypto';
import { Message } from '@a2a-js/sdk';
import { ClientFactory } from '@a2a-js/sdk/client';

export async function connectAgent(baseUrl) {
  return new ClientFactory().createFromUrl(baseUrl);
}

export async function sendText(client, text) {
  const result = await client.sendMessage({
    message: Message.fromJSON({ messageId: randomUUID(), role: 'ROLE_USER', parts: [{ text }] }),
  }, { signal: AbortSignal.timeout(20000) });
  if (!('parts' in result)) throw new Error('El servidor devolvió una tarea inesperada.');
  return {
    answer: result.parts.filter(p => p.content?.$case === 'text').map(p => p.content.value).join('\n'),
    metadata: result.metadata,
  };
}
