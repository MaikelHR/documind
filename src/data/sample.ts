/* DocuMind — bilingual sample data. Strings shaped { es, en }.
   Snippets are EXACT substrings of their same-language page content so the
   drawer highlight matches in both languages. Ported from the handoff data.jsx. */

import type { Bilingual, Doc, Lang, RawCite } from '../types';

export const DOCS: Doc[] = [
  {
    id: 'd1', ext: 'PDF', pages: 24, kind: 'pdf', indexed: true,
    name: { es: 'Reporte Financiero Q3.pdf', en: 'Q3 Financial Report.pdf' },
    content: {
      es: {
        4: [
          'Resumen de Ingresos y Desempeño',
          'Los ingresos totales del tercer trimestre alcanzaron los $48.2M, lo que representa un crecimiento interanual del 19% y un aumento secuencial del 11% respecto al trimestre anterior. Los ingresos por suscripción constituyeron el 84% del total, reforzando el giro continuo hacia ingresos recurrentes.',
          'La retención neta de ingresos se mantuvo en 121%, impulsada principalmente por la expansión de asientos en cuentas enterprise y la mayor adopción de planes premium.',
        ],
        7: [
          'Márgenes y Eficiencia Operativa',
          'El margen bruto se expandió a 78.4% en el Q3, frente al 74.1% del Q2, reflejando una mejor utilización de la infraestructura y una mezcla de producto más favorable hacia planes de suscripción de mayor margen.',
          'Los gastos operativos crecieron 6% secuencialmente, mucho más lento que los ingresos, generando el primer trimestre de la compañía con resultado operativo positivo de $3.1M.',
        ],
      },
      en: {
        4: [
          'Revenue & Performance Summary',
          'Total revenue for the third quarter reached $48.2M, representing 19% year-over-year growth and a sequential increase of 11% over the prior quarter. Subscription revenue accounted for 84% of the total, underscoring the continued shift toward recurring revenue streams.',
          'Net revenue retention held at 121%, driven primarily by seat expansion within enterprise accounts and increased adoption of premium tiers.',
        ],
        7: [
          'Margins & Operating Efficiency',
          'Gross margin expanded to 78.4% in Q3, up from 74.1% in Q2, reflecting improved infrastructure utilization and a favorable shift in product mix toward higher-margin subscription tiers.',
          "Operating expenses grew 6% sequentially, materially slower than revenue, producing the company's first quarter of positive operating income at $3.1M.",
        ],
      },
    },
  },
  {
    id: 'd2', ext: 'PDF', pages: 58, kind: 'pdf', indexed: true,
    name: { es: 'Manual del Empleado 2025.pdf', en: 'Employee Handbook 2025.pdf' },
    content: {
      es: {
        12: [
          'Sección 4 — Trabajo Flexible y Remoto',
          'Todos los empleados de tiempo completo pueden trabajar de forma remota hasta tres días por semana sin aprobación previa del manager. Los esquemas totalmente remotos están disponibles según el rol y requieren la autorización del líder de equipo y de Operaciones de Personal.',
          'Las horas centrales de colaboración se definen de 10:00 a 15:00 en la zona horaria registrada del empleado, durante las cuales se espera que el personal esté disponible.',
        ],
        13: [
          'Equipo y Estipendio de Oficina en Casa',
          'Los empleados remotos son elegibles para un estipendio único de oficina en casa de $1,200 y una asignación mensual recurrente de internet de $60, procesados a través del flujo de gastos estándar.',
          'El equipo comprado con fondos de la empresa permanece como propiedad de la empresa y debe devolverse al término de la relación laboral.',
        ],
      },
      en: {
        12: [
          'Section 4 — Flexible & Remote Work',
          'All full-time employees may work remotely up to three days per week without prior manager approval. Fully remote arrangements are available by role and require sign-off from both the team lead and People Operations.',
          "Core collaboration hours are defined as 10:00–15:00 in the employee's registered time zone, during which staff are expected to be reachable.",
        ],
        13: [
          'Equipment & Home Office Stipend',
          'Remote employees are eligible for a one-time home-office stipend of $1,200 and a recurring monthly internet allowance of $60, processed through the standard expense workflow.',
          'Equipment purchased with company funds remains company property and must be returned upon separation.',
        ],
      },
    },
  },
  {
    id: 'd3', ext: 'PDF', pages: 12, kind: 'pdf', indexed: true,
    name: { es: 'Atlas — Especificación de Producto.pdf', en: 'Atlas — Product Spec.pdf' },
    content: {
      es: {
        3: [
          '1.2 — Objetivos y No-Objetivos',
          'Atlas está diseñado para ingerir formatos de documento heterogéneos y devolver respuestas fundamentadas con atribución de fuente verificable. Cada afirmación generada debe corresponder a un pasaje recuperable; la generación sin fundamento se trata como un defecto.',
          'Los no-objetivos para la v1 incluyen la edición colaborativa en tiempo real y el OCR multilingüe, ambos diferidos a un hito posterior.',
        ],
        8: [
          '3.4 — Modelo de Recuperación y Citas',
          'El sistema recupera los k pasajes más relevantes por consulta mediante búsqueda híbrida densa-dispersa, y luego restringe al modelo de lenguaje a citar únicamente del conjunto recuperado. Cada cita lleva un identificador de documento, un ancla de página y un desplazamiento de carácter.',
          'El presupuesto de latencia para la recuperación de extremo a extremo y el primer token es de 800ms en el percentil 95.',
        ],
      },
      en: {
        3: [
          '1.2 — Goals & Non-Goals',
          'Atlas is designed to ingest heterogeneous document formats and return grounded answers with verifiable source attribution. Every generated claim must map to a retrievable passage; ungrounded generation is treated as a defect.',
          'Non-goals for v1 include real-time collaborative editing and multi-language OCR, both of which are deferred to a later milestone.',
        ],
        8: [
          '3.4 — Retrieval & Citation Model',
          'The system retrieves the top-k passages per query using hybrid dense-sparse search, then constrains the language model to cite only from the retrieved set. Each citation carries a document identifier, page anchor, and character offset.',
          'Latency budget for end-to-end retrieval and first token is 800ms at the 95th percentile.',
        ],
      },
    },
  },
  {
    id: 'd4', ext: 'MD', pages: 'Note', kind: 'md', indexed: true,
    name: { es: 'Notas — Sync de Estrategia.md', en: 'Notes — Strategy Sync.md' },
    content: {
      es: {
        1: [
          'Sync de Estrategia — 14 de marzo',
          'Decisión: priorizar la experiencia de citas como el diferenciador central para el próximo release. La confianza es el producto; la respuesta solo vale tanto como su capacidad de mostrar su trabajo.',
          'Acciones: lanzar chips de fuente inline, agregar un panel de resaltado a nivel de pasaje, e instrumentar el clic en las citas como métrica de engagement principal.',
        ],
      },
      en: {
        1: [
          'Strategy Sync — March 14',
          'Decision: prioritize the citation experience as the core differentiator for the next release. Trust is the product; the answer is only as good as its ability to show its work.',
          'Action items: ship inline source chips, add a passage-level highlight panel, and instrument click-through on citations as a primary engagement metric.',
        ],
      },
    },
  },
];

interface RawUserSeed {
  id: string;
  role: 'user';
  time: string;
  text: Bilingual<string>;
}
interface RawAiSeed {
  id: string;
  role: 'ai';
  time: string;
  text: Bilingual<string>;
  cites: RawCite[];
}
export type RawSeed = RawUserSeed | RawAiSeed;

export const SEED: RawSeed[] = [
  {
    id: 'm1', role: 'user', time: '09:41',
    text: {
      es: '¿Cuáles fueron nuestros ingresos del Q3 y cómo se movió el margen bruto frente al Q2?',
      en: 'What was our Q3 revenue, and how did gross margin move versus Q2?',
    },
  },
  {
    id: 'm2', role: 'ai', time: '09:41',
    text: {
      es: 'Los ingresos totales del Q3 llegaron a **$48.2M** —un alza *interanual del 19%* y 11% secuencial, con las suscripciones representando el 84% de la mezcla.[[1]] En rentabilidad, **el margen bruto se expandió a 78.4%**, un salto importante desde el 74.1% del Q2, apoyado por mejor utilización de infraestructura y una mezcla de producto más rica.[[2]]',
      en: "Q3 total revenue came in at **$48.2M** — up *19% year-over-year* and 11% sequentially, with subscriptions making up 84% of the mix.[[1]] On profitability, **gross margin expanded to 78.4%**, a meaningful jump from 74.1% in Q2, helped by better infrastructure utilization and a richer product mix.[[2]]",
    },
    cites: [
      { n: 1, docId: 'd1', page: 4, snippet: { es: 'Los ingresos totales del tercer trimestre alcanzaron los $48.2M, lo que representa un crecimiento interanual del 19%', en: 'Total revenue for the third quarter reached $48.2M, representing 19% year-over-year growth' } },
      { n: 2, docId: 'd1', page: 7, snippet: { es: 'El margen bruto se expandió a 78.4% en el Q3, frente al 74.1% del Q2', en: 'Gross margin expanded to 78.4% in Q3, up from 74.1% in Q2' } },
    ],
  },
];

export interface Answer {
  text: Bilingual<string>;
  cites: RawCite[];
}
interface AnswerBankEntry extends Answer {
  match: string[];
}

export const ANSWER_BANK: AnswerBankEntry[] = [
  {
    match: ['remote', 'work from home', 'wfh', 'office', 'hybrid', 'remoto', 'trabajo', 'oficina', 'híbrido', 'hibrido', 'casa', 'estipendio'],
    text: {
      es: 'Los empleados de tiempo completo pueden trabajar de forma remota **hasta tres días por semana** sin aprobación del manager; los esquemas totalmente remotos requieren el visto bueno del líder de equipo y de Operaciones de Personal.[[1]] También hay un *estipendio único de $1,200 para oficina en casa* más $60 mensuales de internet.[[2]]',
      en: "Full-time employees can work remotely **up to three days a week** without manager approval, while fully remote setups need sign-off from the team lead and People Ops.[[1]] There's also a *one-time $1,200 home-office stipend* plus a $60 monthly internet allowance.[[2]]",
    },
    cites: [
      { n: 1, docId: 'd2', page: 12, snippet: { es: 'Todos los empleados de tiempo completo pueden trabajar de forma remota hasta tres días por semana sin aprobación previa del manager', en: 'All full-time employees may work remotely up to three days per week without prior manager approval' } },
      { n: 2, docId: 'd2', page: 13, snippet: { es: 'un estipendio único de oficina en casa de $1,200 y una asignación mensual recurrente de internet de $60', en: 'a one-time home-office stipend of $1,200 and a recurring monthly internet allowance of $60' } },
    ],
  },
  {
    match: ['citation', 'cite', 'source', 'attribution', 'ground', 'retriev', 'how does atlas', 'how it works', 'cita', 'fuente', 'atribu', 'fundament', 'recuper', 'atlas'],
    text: {
      es: 'Atlas recupera los **k pasajes más relevantes** con búsqueda híbrida densa-dispersa, y luego obliga al modelo a *citar solo de ese conjunto recuperado* —cada cita lleva un id de documento, ancla de página y desplazamiento de carácter.[[1]] Y algo clave: cada afirmación debe corresponder a un pasaje real; la generación sin fundamento se trata como un defecto.[[2]]',
      en: 'Atlas retrieves the **top-k passages** with hybrid dense-sparse search, then forces the model to *cite only from that retrieved set* — each citation carries a document id, page anchor, and character offset.[[1]] Crucially, every claim must map to a real passage; ungrounded generation is treated as a defect.[[2]]',
    },
    cites: [
      { n: 1, docId: 'd3', page: 8, snippet: { es: 'restringe al modelo de lenguaje a citar únicamente del conjunto recuperado. Cada cita lleva un identificador de documento, un ancla de página y un desplazamiento de carácter', en: 'constrains the language model to cite only from the retrieved set. Each citation carries a document identifier, page anchor, and character offset' } },
      { n: 2, docId: 'd3', page: 3, snippet: { es: 'Cada afirmación generada debe corresponder a un pasaje recuperable; la generación sin fundamento se trata como un defecto', en: 'Every generated claim must map to a retrievable passage; ungrounded generation is treated as a defect' } },
    ],
  },
  {
    match: ['margin', 'profit', 'operating', 'expense', 'margen', 'rentab', 'operativo', 'gasto', 'utilidad'],
    text: {
      es: 'El margen bruto alcanzó **78.4%** en el Q3 (desde 74.1%), y como los gastos operativos crecieron apenas 6% —mucho más lento que los ingresos— la compañía registró su *primer trimestre con resultado operativo positivo* de $3.1M.[[1]]',
      en: "Gross margin reached **78.4%** in Q3 (up from 74.1%), and because operating expenses grew just 6% — far slower than revenue — the company posted its *first quarter of positive operating income* at $3.1M.[[1]]",
    },
    cites: [
      { n: 1, docId: 'd1', page: 7, snippet: { es: 'generando el primer trimestre de la compañía con resultado operativo positivo de $3.1M', en: "producing the company's first quarter of positive operating income at $3.1M" } },
    ],
  },
  {
    match: ['priorit', 'strategy', 'differentiat', 'roadmap', 'next release', 'focus', 'priorid', 'estrategia', 'diferenciad', 'sync', 'enfoque', 'release', 'decidi'],
    text: {
      es: 'El sync de estrategia definió una prioridad clara: hacer de la **experiencia de citas el diferenciador central** del próximo release —el marco fue *“la confianza es el producto.”*[[1]] Acciones concretas: lanzar chips de fuente inline, agregar un panel de resaltado a nivel de pasaje, y medir el clic en citas como métrica principal.[[2]]',
      en: 'The strategy sync landed on one clear priority: make the **citation experience the core differentiator** for the next release — the framing was *“trust is the product.”*[[1]] Concrete actions: ship inline source chips, add a passage-level highlight panel, and track citation click-through as a primary metric.[[2]]',
    },
    cites: [
      { n: 1, docId: 'd4', page: 1, snippet: { es: 'priorizar la experiencia de citas como el diferenciador central para el próximo release', en: 'prioritize the citation experience as the core differentiator for the next release' } },
      { n: 2, docId: 'd4', page: 1, snippet: { es: 'lanzar chips de fuente inline, agregar un panel de resaltado a nivel de pasaje, e instrumentar el clic en las citas', en: 'ship inline source chips, add a passage-level highlight panel, and instrument click-through on citations' } },
    ],
  },
];

export const DEFAULT_ANSWER: Answer = {
  text: {
    es: 'Según tus documentos indexados, la señal más fuerte está en el **reporte del Q3**: ingresos de $48.2M con márgenes expandiéndose a 78.4%.[[1]] Si buscas algo más específico, prueba preguntar por la *política de trabajo remoto* o *cómo Atlas fundamenta sus citas* —traeré los pasajes exactos.[[2]]',
    en: "Based on your indexed documents, the strongest signal is in the **Q3 report**: revenue of $48.2M with margins expanding to 78.4%.[[1]] If you're after something more specific, try asking about the *remote-work policy* or *how Atlas grounds its citations* — I'll pull the exact passages.[[2]]",
  },
  cites: [
    { n: 1, docId: 'd1', page: 4, snippet: { es: 'Los ingresos totales del tercer trimestre alcanzaron los $48.2M', en: 'Total revenue for the third quarter reached $48.2M' } },
    { n: 2, docId: 'd3', page: 8, snippet: { es: 'restringe al modelo de lenguaje a citar únicamente del conjunto recuperado', en: 'constrains the language model to cite only from the retrieved set' } },
  ],
};

export const SUGGESTIONS: Bilingual<string[]> = {
  es: [
    'Resume los resultados financieros del Q3',
    '¿Cuál es la política de trabajo remoto?',
    '¿Cómo maneja Atlas las citas?',
    '¿Qué decidimos en el sync de estrategia?',
  ],
  en: [
    'Summarize the Q3 financial results',
    "What's the remote work policy?",
    'How does Atlas handle citations?',
    'What did we decide in the strategy sync?',
  ],
};

export const UPLOAD_NAMES: Record<Lang, string[]> = {
  es: ['Actualización a Inversionistas — Abril.pdf', 'Checklist de Onboarding.pdf', 'Whitepaper de Seguridad.pdf', 'Roadmap 2026.md', 'Entrevistas a Clientes.pdf', 'Guía de Marca.pdf'],
  en: ['Investor Update — April.pdf', 'Onboarding Checklist.pdf', 'Security Whitepaper.pdf', 'Roadmap 2026.md', 'Customer Interviews.pdf', 'Brand Guidelines.pdf'],
};

export function pickAnswer(q: string): Answer {
  const s = (q || '').toLowerCase();
  for (const a of ANSWER_BANK) {
    if (a.match.some((m) => s.includes(m))) return a;
  }
  return DEFAULT_ANSWER;
}

export function docById(id: string): Doc | undefined {
  return DOCS.find((d) => d.id === id);
}
