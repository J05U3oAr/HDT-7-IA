# Guion de demostración — HDT 7

Duración sugerida: 4 a 6 minutos. Abre tres terminales dentro de `HDT-7` y aumenta el tamaño de letra para que se lean los logs. Usa datos de ejemplo. Reinicia MCP antes de empezar para tener el calendario vacío.

## 1. Presentación y arquitectura — 40 segundos

Muestra el diagrama del README y explica:

> Esta implementación parte del agente de citas y FAQ de HDT-6. Tiene un coordinador, un agente de preguntas frecuentes y un agente de citas. Un servidor MCP concentra sus herramientas. Un servidor A2A expone el sistema como un solo agente Parachute con dos habilidades. La terminal es un cliente A2A.

Aclara que se conservó el funcionamiento determinista original y que no se requieren claves de API.

## 2. Iniciar MCP — 40 segundos

En la terminal 1:

```powershell
npm.cmd run mcp
```

Muestra `server.ready`, el puerto 3001 y `transport: Streamable HTTP`. Abre `src/mcp-server.js` y señala las dos herramientas registradas: `knowledge_search_faq` y `calendar_create_appointment`.

Explica que la base de conocimiento y el calendario se ejecutan en este servidor, y que los especialistas los consumen por HTTP.

## 3. Iniciar A2A y descubrir habilidades — 40 segundos

En la terminal 2:

```powershell
npm.cmd run a2a
```

Muestra `server.ready`. Puedes abrir en el navegador:

```text
http://127.0.0.1:3000/.well-known/agent-card.json
```

Señala el nombre Parachute, la interfaz JSON-RPC y las habilidades `faq` y `appointments`.

## 4. Interacción de terminal y logs — 2 minutos

En la terminal 3:

```powershell
npm.cmd run client
```

Muestra el mensaje de conexión A2A y las habilidades descubiertas. Ejecuta las siguientes consultas manualmente y alterna entre las tres terminales para mostrar los logs de cada una:

| Consulta | Qué mostrar |
| --- | --- |
| `¿Cuál es su horario de atención?` | Respuesta de FAQ; A2A muestra `message.received` y delegación a `faq`; MCP muestra `tool.start` y `tool.end` de `knowledge_search_faq`. |
| `Agendar cita el 2026-10-19 a las 10:00 para asesoría.` | Confirmación `PC-0001`; A2A delega a `appointments`; MCP registra `calendar_create_appointment`, argumentos y resultado exitoso. |
| Repite exactamente la consulta anterior. | Se rechaza el horario ocupado; MCP registra `isError: true`; la terminal informa el rechazo. |
| `¿Con cuánto tiempo puedo cancelar una cita?` | Devuelve la política de 24 horas; solo consulta FAQ, sin crear otra cita. |

Si prefieres enviar estas cuatro consultas automáticamente, usa `npm.cmd run demo` en lugar del cliente interactivo. Recuerda mostrar ambos servidores durante la ejecución.

## 5. Pruebas y cierre — 40 segundos

Escribe `salir` en el cliente y ejecuta:

```powershell
npm.cmd test
```

Muestra el resultado de las 14 pruebas aprobadas. Los tests usan otros puertos y su propio calendario, por lo que no interfieren con los servidores de la demostración.

Explica las limitaciones: calendario en memoria, fecha y hora en el mismo mensaje y política de cancelación informativa. Muestra el repositorio publicado y los archivos principales.

## Antes de entregar

- El video muestra MCP ejecutándose y registrando llamadas a ambas herramientas.
- El video muestra A2A ejecutándose y registrando recepción, delegación y finalización.
- La terminal interactúa mediante A2A y obtiene respuestas.
- El repositorio incluye `package.json`, `package-lock.json`, `src/`, `test/`, README y este guion.
- El enlace del video y el repositorio son accesibles para el docente.
