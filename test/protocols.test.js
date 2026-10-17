import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpApp } from '../src/mcp-server.js';
import { createA2aApp } from '../src/a2a-server.js';
import { connectAgent, sendText } from '../src/a2a-client.js';
import { listen, closeServer } from '../src/runtime.js';
import calendar from '../src/tools/calendar.cjs';

let mcpServer, a2aServer, mcpUrl, a2aUrl, client;
before(async () => {
  mcpServer = await listen(createMcpApp(), 0);
  mcpUrl = `http://127.0.0.1:${mcpServer.address().port}/mcp`;
  const outer = express();
  a2aServer = await listen(outer, 0);
  a2aUrl = `http://127.0.0.1:${a2aServer.address().port}`;
  outer.use(createA2aApp({ baseUrl: a2aUrl, mcpUrl }));
  client = await connectAgent(a2aUrl);
});
beforeEach(() => calendar.resetCalendar());
after(async () => {
  if (a2aServer) await closeServer(a2aServer);
  if (mcpServer) await closeServer(mcpServer);
});

test('descubre una sola Agent Card A2A con ambas habilidades', async () => {
  const card = await client.getAgentCard();
  assert.equal(card.name, 'Parachute S.A.');
  assert.deepEqual(card.skills.map(s => s.id), ['faq', 'appointments']);
  assert.equal(card.supportedInterfaces[0].protocolVersion, '1.0');
});

test('MCP negocia Streamable HTTP y publica las dos herramientas', async () => {
  const mcp = new Client({ name: 'test', version: '1.0.0' });
  try {
    await mcp.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
    const tools = await mcp.listTools();
    assert.deepEqual(tools.tools.map(t => t.name).sort(), ['calendar_create_appointment', 'knowledge_search_faq']);
    const invalid = await mcp.callTool({ name: 'knowledge_search_faq', arguments: {} });
    assert.equal(invalid.isError, true);
  } finally { await mcp.close(); }
});

test('responde horario mediante A2A y una llamada MCP real', async () => {
  const result = await sendText(client, '¿Cuál es su horario de atención?');
  assert.match(result.answer, /lunes a viernes, de 08:00 a 17:00/);
  assert.equal(result.metadata.toolCalls[0].name, 'knowledge_search_faq');
  assert.deepEqual(result.metadata.agents, ['coordinator', 'faq']);
});

test('delega la cita al especialista y ejecuta el calendario por MCP', async () => {
  const result = await sendText(client, 'Agendar cita el 2026-10-19 a las 10:00 para asesoría.');
  assert.match(result.answer, /Cita agendada correctamente/);
  assert.match(result.answer, /PC-0001/);
  assert.deepEqual(result.metadata.agents, ['coordinator', 'faq', 'appointments']);
  assert.equal(result.metadata.toolCalls[1].name, 'calendar_create_appointment');
});

test('mantiene el calendario entre diferentes mensajes y rechaza duplicados', async () => {
  await sendText(client, 'Agendar cita el 2026-10-19 a las 10:00');
  const result = await sendText(client, 'Agendar cita el 2026-10-19 a las 10:00');
  assert.match(result.answer, /ya está ocupado/);
  assert.equal(result.metadata.toolCalls[1].is_error, true);
});

test('dos clientes concurrentes no pueden reservar el mismo horario', async () => {
  const other = await connectAgent(a2aUrl);
  const results = await Promise.all([client, other].map(c => sendText(c, 'Agendar cita el 2026-10-19 a las 11:00')));
  assert.equal(results.filter(r => /Cita agendada correctamente/.test(r.answer)).length, 1);
  assert.equal(results.filter(r => /ya está ocupado/.test(r.answer)).length, 1);
});

test('cancelar una cita consulta la política sin reservar', async () => {
  const result = await sendText(client, '¿Cómo puedo cancelar o reprogramar una cita?');
  assert.match(result.answer, /24 horas/);
  assert.equal(result.metadata.toolCalls.length, 1);
  assert.equal(result.metadata.agents.includes('appointments'), false);
});

test('solicita fecha y hora sin ejecutar el calendario', async () => {
  const result = await sendText(client, 'Quiero agendar una cita');
  assert.match(result.answer, /AAAA-MM-DD/);
  assert.equal(result.metadata.toolCalls.some(t => t.name === 'calendar_create_appointment'), false);
});

test('rechaza fines de semana y horas fuera de atención', async () => {
  for (const details of ['2026-10-18 a las 10:00', '2026-10-19 a las 17:00', '2026-10-19 a las 07:59']) {
    const result = await sendText(client, `Agendar cita el ${details}`);
    assert.match(result.answer, /No pude agendar/);
    assert.equal(result.metadata.toolCalls[1].is_error, true);
  }
});

test('rechaza fechas inexistentes en lugar de normalizarlas', async () => {
  const result = await sendText(client, 'Agendar cita el 2026-02-30 a las 10:00');
  assert.match(result.answer, /La fecha no existe/);
});

test('una pregunta desconocida no inventa información', async () => {
  const result = await sendText(client, '¿Cuál es el precio de un avión?');
  assert.match(result.answer, /No tengo información confirmada/);
});

test('explica la validación de texto sin atribuir el problema a MCP', async () => {
  for (const text of ['   ', 'a'.repeat(4001)]) {
    const result = await sendText(client, text);
    assert.equal(result.metadata.error, true);
    assert.match(result.answer, /1 a 4000 caracteres/);
    assert.doesNotMatch(result.answer, /servidor MCP/);
  }
});

test('la terminal funciona como cliente A2A en un proceso separado', async () => {
  const child = spawn(process.execPath, ['src/cli.js', '¿Cuál es su correo de contacto?'], {
    env: { ...process.env, A2A_URL: a2aUrl }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const code = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  assert.equal(code, 0, output);
  assert.match(output, /Conectado por A2A/);
  assert.match(output, /soporte@parachute.example/);
  assert.match(output, /knowledge_search_faq/);
});

test('si MCP falla, A2A informa el error sin simular una respuesta exitosa', async () => {
  const outer = express();
  const broken = await listen(outer, 0);
  const baseUrl = `http://127.0.0.1:${broken.address().port}`;
  outer.use(createA2aApp({ baseUrl, mcpUrl: `${a2aUrl}/no-es-mcp` }));
  try {
    const brokenClient = await connectAgent(baseUrl);
    const result = await sendText(brokenClient, '¿Cuál es su horario?');
    assert.equal(result.metadata.error, true);
    assert.match(result.answer, /Verifica el servidor MCP/);
  } finally { await closeServer(broken); }
});
