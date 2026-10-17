const appointments = new Map();
let nextId = 1;

function createAppointment({ date, time, reason }) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { ok: false, error: 'La fecha u hora no tiene un formato válido.' };
  }
  // Date normaliza fechas imposibles; comparar evita aceptar, por ejemplo, febrero 30.
  const day = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
    return { ok: false, error: 'La fecha no existe en el calendario.' };
  }
  const start = new Date(`${date}T${time}:00-06:00`);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: 'La fecha u hora no tiene un formato válido.' };
  }

  const weekDay = start.getUTCDay();
  const hour = Number(time.slice(0, 2));
  if (weekDay === 0 || weekDay === 6 || hour < 8 || hour >= 17) {
    return { ok: false, error: 'Solo hay citas de lunes a viernes entre 08:00 y 17:00 (hora de Guatemala).' };
  }

  const slot = `${date}T${time}`;
  if ([...appointments.values()].some((appointment) => appointment.slot === slot)) {
    return { ok: false, error: 'Ese horario ya está ocupado.' };
  }

  const appointment = {
    id: `PC-${String(nextId++).padStart(4, '0')}`,
    date,
    time,
    reason,
    slot,
  };
  appointments.set(appointment.id, appointment);
  return { ok: true, appointment };
}

function resetCalendar() {
  appointments.clear();
  nextId = 1;
}

module.exports = { createAppointment, resetCalendar };
