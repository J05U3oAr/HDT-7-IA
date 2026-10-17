const FAQS = [
  {
    topic: 'horario',
    keywords: ['horario', 'atienden', 'atención', 'abren'],
    answer: 'Nuestro horario de atención es de lunes a viernes, de 08:00 a 17:00 (hora de Guatemala).',
  },
  {
    topic: 'cancelacion',
    keywords: ['cancelar', 'cancelación', 'reprogramar', 'reprogramación'],
    answer: 'Puedes cancelar o reprogramar una cita con al menos 24 horas de anticipación.',
  },
  {
    topic: 'contacto',
    keywords: ['contacto', 'correo', 'email', 'soporte'],
    answer: 'Puedes escribir a soporte@parachute.example para recibir ayuda.',
  },
];

function searchFaq(question) {
  const normalized = question.toLocaleLowerCase('es-GT');
  const faq = FAQS.find(({ keywords }) => keywords.some((word) => normalized.includes(word)));
  return faq || null;
}

module.exports = { searchFaq };
