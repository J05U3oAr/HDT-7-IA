import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { connectAgent, sendText } from './a2a-client.js';

try {
  const url = process.env.A2A_URL || 'http://127.0.0.1:3000';
  const client = await connectAgent(url);
  const card = await client.getAgentCard();
  console.log(`Conectado por A2A a ${card.name} (${url})`);
  console.log(`Habilidades: ${card.skills.map(s => s.name).join(', ')}`);
  const ask = async text => {
    const result = await sendText(client, text);
    console.log(`Parachute: ${result.answer}`);
    if (result.metadata?.agents) console.log(`Agentes: ${result.metadata.agents.join(' → ')}`);
    if (result.metadata?.toolCalls) console.log(`Herramientas MCP: ${result.metadata.toolCalls.map(t => `${t.name}${t.is_error ? ' (rechazada)' : ''}`).join(', ')}`);
    if (result.metadata?.error) process.exitCode = 1;
  };
  if (process.argv.includes('--demo')) {
    for (const text of ['¿Cuál es su horario de atención?', 'Agendar cita el 2026-10-19 a las 10:00 para asesoría.', 'Agendar cita el 2026-10-19 a las 10:00 para asesoría.', '¿Con cuánto tiempo puedo cancelar una cita?']) {
      console.log(`\nTú: ${text}`);
      await ask(text);
    }
  } else if (process.argv.length > 2) {
    await ask(process.argv.slice(2).join(' '));
  } else {
    const terminal = createInterface({ input: stdin, output: stdout });
    console.log('Escribe una consulta o salir. Para citas incluye fecha y hora en el mismo mensaje.');
    try {
      while (true) {
        const text = await terminal.question('\nTú: ');
        if (text.trim().toLowerCase() === 'salir') break;
        if (text.trim()) {
          try { await ask(text); } catch (error) { console.error(`Error de consulta: ${error.message}`); }
        }
      }
    } finally { terminal.close(); }
  }
} catch (error) {
  console.error(`No se pudo conectar con A2A: ${error.message}. Inicia primero npm.cmd run mcp y npm.cmd run a2a.`);
  process.exitCode = 1;
}
