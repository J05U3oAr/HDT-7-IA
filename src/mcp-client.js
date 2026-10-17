import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function withTools(url, callback) {
  const client = new Client({ name: 'parachute-multiagent', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    const invoke = async (name, args) => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 10000 });
      const text = result.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
      let output;
      try { output = JSON.parse(text); } catch { throw new Error(`La herramienta ${name} devolvió una respuesta inválida: ${text}`); }
      // Los rechazos de negocio del calendario son respuestas válidas para el usuario.
      if (result.isError && output?.ok !== false) throw new Error(`Error MCP en ${name}`);
      return { name, input: args, output, is_error: Boolean(result.isError) };
    };
    return await callback(invoke);
  } finally {
    await client.close();
  }
}
