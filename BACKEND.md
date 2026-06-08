# DocuMind - Roadmap del backend RAG (por fases)

> **Estado actual:** el frontend funciona con **datos simulados** (ver `src/data/sample.ts`
> y `send()` en `src/App.tsx`). Este documento es el plan para conectar un **backend RAG real**
> con **Claude Sonnet**, de a poco, sin romper la demo en vivo.
>
> Cada fase se hace en **un chat nuevo** (de Claude Code), en orden. Pega el **Bloque común** +
> la **Fase N**. Se trabaja en la rama `feat/backend` y se prueba en una URL **preview** de
> Vercel; recién al final de la Fase 4 se mergea a `main` (producción).

---

## Decisiones de arquitectura (cheap & honest)
- **Backend:** funciones serverless de **Vercel** en la carpeta `api/` del mismo repo (un solo
  deploy, free tier). Sin migrar a Next.js.
- **LLM:** Claude **Sonnet** vía `@anthropic-ai/sdk`. Usar el skill `claude-api` (id de modelo
  vigente + streaming + prompt caching). La API key vive **solo en el servidor**.
- **Corpus fijo:** los 4 documentos actuales, movidos a `shared/corpus.ts` como única fuente
  de verdad (lo usan el drawer del frontend y la API → no se desincronizan los textos).
- **Retrieval:** embeddings **gratis** (mismo modelo offline y en runtime) + similitud coseno
  **en memoria**. Sin base de datos hasta la Fase 5.
- **Citas:** se construyen desde el texto del corpus (no de lo que invente el modelo). El
  `snippet` debe ser substring exacto del contenido de la página (lo usa el resaltado del drawer).
- **Bilingüe (es/en):** el frontend envía el idioma; se responde y cita en ese idioma.
- **Seguridad/costo:** key solo en server, rate-limit, tope de gasto en consola, prompt caching.

## Costo (referencia)
- Una consulta RAG ≈ 2-3k tokens in + ~300 out → **~$0.01 con Sonnet** (centavos con Haiku).
- Con **$10 de crédito** alcanza para cientos de consultas Sonnet → sobra para una demo.
- Desarrollar/probar con **Haiku** (centavos) y dejar **Sonnet** para la demo final.

## El arco
1. **Fase 1** - Backend + respuestas reales de Claude (sin streaming, sin retrieval).
2. **Fase 2** - Streaming real.
3. **Fase 3** - Retrieval real (RAG: embeddings + top-k).
4. **Fase 4** - Seguridad, costo y cierre honesto (merge a producción).
5. **Fase 5** *(opcional)* - Subida real de documentos (con base vectorial).

## Antes de la Fase 1 (one-time, lo haces tú)
1. Crea la API key en la consola de Anthropic y **pon un límite de gasto** (ej. $5).
2. Guárdala en `app/.env.local` como `ANTHROPIC_API_KEY=...` y en Vercel → Settings → Environment Variables.
3. `npm i -g vercel` y `vercel link` (para correr el backend local con `vercel dev`).

---

## 🔁 Bloque común (pégalo arriba de cada fase)
```
Contexto: Proyecto "DocuMind" (Q&A sobre documentos con citas). Stack: Vite + React 19 + TypeScript + Tailwind. Ruta: D:\Vibecodeadas\DocuMind\design_handoff_documind\app (repo github.com/MaikelHR/documind, deploy en Vercel: documind-lake.vercel.app). Hoy el frontend funciona con DATOS SIMULADOS (ver src/data/sample.ts y la función send() en src/App.tsx); estoy conectando un backend RAG real con Claude Sonnet, por fases. Hay un roadmap en BACKEND.md (léelo).

Reglas (cúmplelas estrictamente):
- Trabaja en la rama feat/backend (créala desde main si no existe; haz `git checkout feat/backend` si ya existe). NUNCA rompas main ni la demo de producción.
- La ANTHROPIC_API_KEY (y cualquier secreto) vive SOLO en funciones del servidor (carpeta api/). Jamás en el bundle del cliente.
- Para todo lo de Anthropic usa el skill `claude-api` (id de modelo Sonnet vigente, streaming y prompt caching correctos).
- NO migres a Next.js ni reescribas el frontend; solo conecta lo necesario. No agregues dependencias fuera de las indicadas.
- Lee el código actual ANTES de editar. Mantén el patrón y el estilo existentes.
- Invariante de citas: el `snippet` de cada cita debe ser un substring EXACTO del contenido de esa página (lo usa el resaltado del drawer con indexOf). Las citas se construyen desde el texto del corpus, no de lo que invente el modelo.
- App bilingüe: el frontend envía el idioma actual (es/en); responde y cita en ese idioma.
- Al terminar: `npm run build` y `npm run lint` en verde, y haz commit en feat/backend con un mensaje claro. Si algo es ambiguo, elige el default más simple y sigue (no me preguntes de más).
```

---

## 🟩 Fase 1 - Backend + respuestas reales (sin streaming, sin retrieval)
```
Implementa la FASE 1.
1. Crea/usa la rama feat/backend. Instala @anthropic-ai/sdk.
2. Extrae el corpus a un módulo compartido `shared/corpus.ts`: una lista de chunks { docId, page, lang, text } derivada EXACTAMENTE de DOCS en src/data/sample.ts (mismos textos). Refactoriza el drawer/frontend y la API para que ambos usen este módulo (single source of truth, sin desincronizar textos).
3. Crea `api/chat.ts` (función Vercel): recibe { question, lang }. Arma un prompt con los pasajes del corpus de ese idioma, numerados [1..N], + instrucciones: "responde SOLO con base en estos pasajes, en {lang}, y marca cada afirmación con [[n]] citando el número del pasaje". Llama a Claude Sonnet (sin streaming aún). Devuelve { text, cites } con cites = [{ n, docId, page, snippet }], snippet = texto EXACTO del pasaje citado (respeta el invariante de citas).
4. Frontend (src/App.tsx): cambia send() para llamar a fetch('/api/chat', { question, lang }) en vez de la simulación. Mantén las 3 fases (thinking mientras espera → pinta el texto con el parser [[n]] existente → grid de fuentes). regen() usa el mismo endpoint. Deja pickAnswer() como fallback si la API falla.
Verificación: corro `vercel dev`; pregunto algo fuera del guion (ej. "¿cuántas páginas tiene el manual del empleado?") y debe responder de verdad, con citas correctas, y el drawer abre la página citada. Deja build+lint verde, commitea y dame el comando para pushear (quiero la URL preview de Vercel).
NO implementes streaming ni retrieval todavía.
```

## 🟩 Fase 2 - Streaming real
```
Implementa la FASE 2 (la 1 ya está en feat/backend; léela primero: api/chat.ts y src/App.tsx).
1. Convierte /api/chat a streaming (SSE o Web ReadableStream) usando el streaming del SDK de Anthropic (skill claude-api). Emite el texto en tiempo real y, al cerrar, un último evento con el JSON de `cites`.
2. Frontend: consume el stream, acumula y revela el texto en vivo reutilizando la UI de cursor/streaming actual (reemplaza el intervalo falso por los chunks reales; sigue parseando [[n]] para que las citas caigan en su lugar). Al terminar: fija cites, fase done, muestra Sources + drawer.
3. El botón Stop debe abortar la petición real (AbortController) y finalizar la respuesta parcial.
Verificación (con `vercel dev`): el texto fluye token a token, Stop corta de verdad, y las citas/drawer siguen correctos. build+lint verde, commit, y dame el push para ver el preview.
```

## 🟩 Fase 3 - Retrieval real (RAG)
```
Implementa la FASE 3 (lee shared/corpus.ts y api/chat.ts actuales).
1. Embeddings GRATIS, usando el MISMO modelo offline y en runtime (recomendado: Google text-embedding-004 free tier, o Voyage). La key del proveedor de embeddings va SOLO en el servidor.
2. Crea `scripts/embed-corpus.ts` (script offline que corro una vez con npm): vectoriza cada chunk del corpus y guarda `shared/corpus.embeddings.json`.
3. En api/chat.ts: embebe la pregunta del usuario → similitud coseno en memoria contra los chunks del mismo idioma → top-k (k=4) → pasa SOLO esos pasajes a Claude Sonnet (en vez de todo el corpus). Construye `cites` desde esos top-k (respeta el invariante de substring).
4. Conecta los "retrieval steps" del UI para que reflejen los documentos REALMENTE recuperados (no la lista fija actual).
Verificación: preguntas distintas traen pasajes distintos; las citas siguen abriendo la página exacta. build+lint verde, commit, push para preview.
Nota: el corpus es chico, así que el retrieval casi no cambia la respuesta; el objetivo es la arquitectura correcta y escalable de RAG.
```

## 🟩 Fase 4 - Seguridad, costo y cierre honesto
```
Implementa la FASE 4.
1. Rate-limit por IP + un tope diario global (usa Upstash Redis free tier, o un contador in-memory simple si prefieres no añadir dependencias). Al agotarse, responde "demo agotada por hoy" SIN llamar al modelo.
2. Activa prompt caching del system prompt/contexto (skill claude-api), fija un max_tokens razonable, y maneja errores con un estado claro en la UI.
3. Actualiza el "model chip" de la UI para que muestre el modelo real que se usa (coherencia/honestidad).
4. Actualiza README.md: ahora es "RAG funcional con citas (Claude Sonnet)"; cambia la nota de "demo con datos simulados" por "RAG real sobre un corpus fijo".
5. Tras verificar todo en el preview, mergea feat/backend a main para actualizar la demo en producción.
Verificación: el rate-limit corta correctamente; cero errores en consola; README correcto; la URL de producción funciona en vivo. Dame los comandos de merge/push.
```

## 🟦 Fase 5 *(opcional, la más grande)* - Subida real de documentos
```
Implementa la FASE 5 (solo si las fases 1-4 ya están sólidas en main).
1. Persistencia: Supabase (Postgres + pgvector, free tier). URL y key SOLO en el servidor.
2. Crea `api/ingest.ts`: recibe un PDF → extrae texto por página → divide en chunks → genera embeddings (mismo modelo de la Fase 3) → upsert a pgvector con { docId, page, text, embedding }.
3. Conecta el DropZone real (src/components/DropZone.tsx): subir archivo → POST /api/ingest → cuando termina la indexación, el documento aparece como fuente real y consultable. Reemplaza la animación simulada de addDoc() por progreso real.
4. /api/chat: el retrieval ahora consulta pgvector (no solo el JSON estático), filtrando por los documentos del usuario.
Verificación: subo un PDF nuevo, se indexa, pregunto sobre él y la respuesta cita ese PDF con su página. build+lint verde, commit, push, merge.
```

---

## Estructura objetivo (al terminar)
```
api/chat.ts                  # función Vercel: retrieve + Claude (stream) + cites
api/ingest.ts                # (Fase 5) subir PDF -> parse -> chunk -> embed -> pgvector
shared/corpus.ts             # los 4 docs en chunks (lo usan frontend y API)
shared/corpus.embeddings.json
shared/retrieve.ts           # coseno en memoria
scripts/embed-corpus.ts      # offline, corre una vez
.env.local                   # ANTHROPIC_API_KEY (+ embeddings key) - NO se sube
```

## Para el CV
Al cerrar la **Fase 4** ya puedes decir, con total honestidad:
**"RAG funcional con citas (Claude Sonnet) - React + TypeScript + Tailwind, desplegado en Vercel."**
