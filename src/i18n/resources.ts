/* DocuMind — i18n resource bundles (es primary, en secondary).
   Ported verbatim from the handoff `i18n.jsx`. Placeholders use single
   braces ({q}, {n}, …); i18next is configured for single-brace interpolation
   in config.ts so these strings can be reused as-is. */

export const es = {
  /* topbar */
  theme: 'Tema', toLight: 'Cambiar a claro', toDark: 'Cambiar a oscuro', langLabel: 'Idioma',
  /* sidebar */
  newChat: 'Nuevo chat', searchPh: 'Buscar documentos…', sources: 'Fuentes',
  noMatch: 'Ningún documento coincide con “{q}”.',
  pages: 'páginas', note: 'Nota', indexed: 'Indexado', indexing: 'Indexando',
  dzDrag: 'Suelta para subir', dzIdle: 'Arrastra archivos aquí, o ', dzBrowse: 'explora',
  dzFormats: 'PDF · DOCX · MD · TXT — hasta 40MB',
  /* composer */
  askPh: 'Pregunta lo que sea sobre tus documentos…', answering: 'DocuMind está respondiendo…',
  groundedAcross: 'Fundamentado en {n} {s}', sourceN: 'fuente', sourcesN: 'fuentes',
  send: 'enviar', newLine: 'nueva línea', tryLabel: 'Prueba',
  /* empty state */
  emptyEye: 'Espacio · 0 fuentes',
  emptyH1a: 'Convierte documentos en ', emptyH1em: 'respuestas en las que confiar.',
  emptySub: 'Agrega un archivo y DocuMind lo lee de principio a fin, indexa cada página y responde tus preguntas —con cada afirmación ligada al pasaje exacto del que proviene.',
  noFiles: '¿Sin archivos a la mano?', loadSample: 'Cargar un espacio de ejemplo',
  /* chat header */
  newWorkspace: 'Nuevo espacio', workspaceTitle: 'Revisión trimestral y políticas',
  sourcesIndexed: '{n} {s} {ind}', indexedF: 'indexada', indexedP: 'indexadas',
  grounded: 'Fundamentado', newChatTitle: 'Nuevo chat',
  /* thread empty */
  teH: 'Pregunta lo que sea sobre tus {n} {s}.',
  teP: 'Las respuestas se componen solo de tus documentos indexados, con citas a la página exacta.',
  /* message */
  you: 'Tú', copy: 'Copiar', copied: 'Copiado', regenerate: 'Regenerar', everyCited: 'Cada afirmación citada',
  /* retrieval */
  rSearch: 'Buscando en', rDocs: 'documentos', rRetrieved: 'Recuperé',
  rPassage: 'pasaje relevante por búsqueda híbrida', rPassages: 'pasajes relevantes por búsqueda híbrida',
  rReading: 'Leyendo', rComposing: 'Componiendo respuesta fundamentada…', rSourcesWord: 'fuentes',
  /* sources / cite */
  sourcesLabel: 'Fuentes', open: 'Abrir', pageShort: 'pág. {n}',
  /* drawer */
  pageOf: 'Página {p} de {total}', citedAs: 'citado como [{n}]',
  verified: 'Pasaje verificado en la fuente', pp: 'pp.',
  /* landing */
  lpTag: 'Inteligencia documental, fundamentada',
  lpH1a: 'Pregunta a tus documentos.', lpH1b: 'Obtén respuestas que ', lpH1em: 'muestran su trabajo.',
  lpSub: 'DocuMind lee tus PDFs, especificaciones y notas, y responde en lenguaje claro —con cada afirmación rastreada hasta la página exacta de la que proviene.',
  lpOpen: 'Abrir el espacio de trabajo', lpSee: 'Ver una respuesta en vivo',
  lpM1: 'Formatos de archivo', lpM2: 'Al primer token', lpM3: 'Afirmaciones citadas',
  lpHowEye: 'Cómo funciona', lpHowH1: 'De la carga a una respuesta citada', lpHowH2: 'en tres pasos deliberados.',
  lpS1t: 'Agrega tus documentos', lpS1p: 'Suelta PDFs, especificaciones y notas en Markdown. Cada página se procesa e indexa para recuperación —sin configuración, sin esquemas.',
  lpS2t: 'Pregunta en lenguaje natural', lpS2p: 'Consulta toda tu biblioteca a la vez. La búsqueda híbrida trae los pasajes que de verdad responden, no solo coincidencias de palabras.',
  lpS3t: 'Verifica cada afirmación', lpS3p: 'Cada enunciado lleva una fuente. Un clic abre el documento original con el pasaje exacto resaltado.',
  lpFootNote: 'Un concepto de portafolio · construido con React, TypeScript y Tailwind',
  lpCardTitle: 'Revisión trimestral', lpCardSrc: '4 fuentes',
  lpQ: '¿Cuáles fueron los ingresos del Q3?', lpRetr: 'Leí Reporte Financiero Q3 · pág. 4, 7',
  lpDoc: 'Reporte Financiero Q3.pdf',
  lpAns1: 'Los ingresos del Q3 alcanzaron ', lpAns2: ', +19% interanual', lpAns3: ', con el margen bruto expandiéndose a ',
};

export const en: typeof es = {
  theme: 'Theme', toLight: 'Switch to light', toDark: 'Switch to dark', langLabel: 'Language',
  newChat: 'New chat', searchPh: 'Search documents…', sources: 'Sources',
  noMatch: 'No documents match “{q}”.',
  pages: 'pages', note: 'Note', indexed: 'Indexed', indexing: 'Indexing',
  dzDrag: 'Release to upload', dzIdle: 'Drag files here, or ', dzBrowse: 'browse',
  dzFormats: 'PDF · DOCX · MD · TXT — up to 40MB',
  askPh: 'Ask anything about your documents…', answering: 'DocuMind is answering…',
  groundedAcross: 'Grounded across {n} {s}', sourceN: 'source', sourcesN: 'sources',
  send: 'send', newLine: 'new line', tryLabel: 'Try',
  emptyEye: 'Workspace · 0 sources',
  emptyH1a: 'Turn documents into ', emptyH1em: 'answers you can trust.',
  emptySub: 'Add a file and DocuMind reads it end to end, indexes every page, and answers your questions — with each claim traced to the exact passage it came from.',
  noFiles: 'No files handy?', loadSample: 'Load a sample workspace',
  newWorkspace: 'New workspace', workspaceTitle: 'Quarterly review & policy Q&A',
  sourcesIndexed: '{n} {s} {ind}', indexedF: 'indexed', indexedP: 'indexed',
  grounded: 'Grounded', newChatTitle: 'New chat',
  teH: 'Ask anything about your {n} {s}.',
  teP: 'Answers are composed only from your indexed documents, with citations to the exact page.',
  you: 'You', copy: 'Copy', copied: 'Copied', regenerate: 'Regenerate', everyCited: 'Every claim cited',
  rSearch: 'Searching across', rDocs: 'documents', rRetrieved: 'Retrieved',
  rPassage: 'relevant passage by hybrid search', rPassages: 'relevant passages by hybrid search',
  rReading: 'Reading', rComposing: 'Composing grounded answer…', rSourcesWord: 'sources',
  sourcesLabel: 'Sources', open: 'Open', pageShort: 'p. {n}',
  pageOf: 'Page {p} of {total}', citedAs: 'cited as [{n}]',
  verified: 'Passage verified in source', pp: 'pp.',
  lpTag: 'Document intelligence, grounded',
  lpH1a: 'Ask your documents.', lpH1b: 'Get answers that ', lpH1em: 'show their work.',
  lpSub: 'DocuMind reads your PDFs, specs, and notes, then answers in plain language — with every claim traced back to the exact page it came from.',
  lpOpen: 'Open the workspace', lpSee: 'See a live answer',
  lpM1: 'File formats', lpM2: 'To first token', lpM3: 'Cited claims',
  lpHowEye: 'How it works', lpHowH1: 'From upload to a cited answer', lpHowH2: 'in three deliberate steps.',
  lpS1t: 'Add your documents', lpS1p: 'Drop in PDFs, specs, and Markdown notes. Each page is parsed and indexed for retrieval — no setup, no schemas.',
  lpS2t: 'Ask in plain language', lpS2p: 'Question your whole library at once. Hybrid search pulls the passages that actually answer you, not just keyword hits.',
  lpS3t: 'Verify every claim', lpS3p: 'Each statement carries a source. One click opens the original document with the exact passage highlighted.',
  lpFootNote: 'A portfolio concept · built with React, TypeScript & Tailwind',
  lpCardTitle: 'Quarterly review', lpCardSrc: '4 sources',
  lpQ: 'What was our Q3 revenue?', lpRetr: 'Read Q3 Financial Report · p. 4, 7',
  lpDoc: 'Q3 Financial Report.pdf',
  lpAns1: 'Q3 revenue reached ', lpAns2: ', up 19% year-over-year', lpAns3: ', with gross margin expanding to ',
};

export const resources = {
  es: { translation: es },
  en: { translation: en },
};
