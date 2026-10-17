import { withTools } from './mcp-client.js';
import { log } from './log.js';

export function extractAppointmentDetails(message) {
  const date = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  const time = message.match(/\b([01]\d|2[0-3]):[0-5]\d\b/)?.[0];
  const reason = message.match(/(?:por|para|motivo)\s+(.+?)(?:[.!?]|$)/i)?.[1]?.trim() || 'Consulta general';
  return { date, time, reason };
}

export class FaqAgent {
  async run(message, invoke) {
    const call = await invoke('knowledge_search_faq', { question: message });
    return { faq: call.output.faq, toolCalls: [call] };
  }
}

export class AppointmentAgent {
  async run(message, invoke) {
    const details = extractAppointmentDetails(message);
    if (!details.date || !details.time) {
      return { answer: 'Para agendar una cita necesito la fecha (AAAA-MM-DD) y la hora (HH:MM).', toolCalls: [] };
    }
    const call = await invoke('calendar_create_appointment', details);
    const result = call.output;
    if (!result.ok) return { answer: `No pude agendar la cita: ${result.error}`, toolCalls: [call] };
    const a = result.appointment;
    return { answer: `Cita agendada correctamente para el ${a.date} a las ${a.time}. Motivo: ${a.reason}. Confirmación: ${a.id}.`, toolCalls: [call] };
  }
}

export class ParachuteCoordinator {
  constructor(mcpUrl) {
    this.mcpUrl = mcpUrl;
    this.faqAgent = new FaqAgent();
    this.appointmentAgent = new AppointmentAgent();
  }

  async run(message, requestId) {
    return withTools(this.mcpUrl, async invoke => {
      const agents = ['coordinator', 'faq'];
      log('A2A', 'agent.delegate', { requestId, agent: 'faq' });
      // Conserva la prioridad de las FAQ de HDT-6, incluida cancelar/reprogramar.
      const faqResult = await this.faqAgent.run(message, invoke);
      if (faqResult.faq) return { answer: faqResult.faq.answer, toolCalls: faqResult.toolCalls, agents };
      if (/(agendar|agenda|reservar|cita)/i.test(message)) {
        agents.push('appointments');
        log('A2A', 'agent.delegate', { requestId, agent: 'appointments' });
        const result = await this.appointmentAgent.run(message, invoke);
        return { ...result, toolCalls: [...faqResult.toolCalls, ...result.toolCalls], agents };
      }
      return {
        answer: 'No tengo información confirmada sobre esa consulta. Puedes escribir a soporte@parachute.example.',
        toolCalls: faqResult.toolCalls, agents,
      };
    });
  }
}
