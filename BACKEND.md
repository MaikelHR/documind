# DocuMind - Roadmap del backend RAG (por fases) · 100% gratis con Gemini

> **Estado actual:** la **Fase 1 ya está hecha** (backend real con Google **Gemini**, gratis).
> El frontend llama a `/api/chat` y, si la API falla, cae al banco de respuestas simulado
> (así la demo nunca se rompe). El resto de fases (2-5) siguen pendientes.
>
> Cada fase se hace en **un chat nuevo** (Claude Code), en orden, en la rama `feat/backend`.
> Se prueba en una URL **preview** de Vercel; al final de la Fase 4 se mergea a `main`.

---

## Decisiones de arquitectura (gratis & honesto)
- **Backend:** funciones serverless de **Vercel** en `api/` del mismo repo (un solo deploy, free tier).
- **LLM:** Google **Gemini** (`gemini-2.5-flash`) vía `@google/genai`. **Free tier, sin tarjeta.**
- **Embeddings (Fase 3):** **Gemini** `text-embedding-004` (gratis) -> un solo proveedor y una sola
  key para generación Y retrieval.
- **Corpus fijo:** los 4 documentos, en `shared/corpus.ts` (única fuente de verdad; lo usan el
  drawer del frontend y la API).
- **Retrieval (Fase 3):** embeddings + similitud coseno **en memoria**. Sin base de datos hasta la Fase 5.
- **Citas:** se construyen en el servidor desde el texto del corpus (no de lo que invente el modelo);
  el `snippet` es substring exacto de la página (lo usa el resaltado del drawer).
- **Bilingüe (es/en):** el frontend envía el idioma; se responde y cita en ese idioma.
- **Secretos:** `GEMINI_API_KEY` vive SOLO en el servidor (`api/`), nunca en el cliente.

## Costo
- **Gemini free tier = $0** (sin tarjeta). Tiene límites de peticiones/min y por día, suficientes
  para una demo de portafolio. La Fase 4 agrega rate-limit propio por las dudas.

## El arco
1. **Fase 1** ✅ HECHA - Backend + respuestas reales de Gemini (sin streaming, sin retrieval).
2. **Fase 2** - Streaming real.
3. **Fase 3** - Retrieval real (RAG: embeddings + top-k).
4. **Fase 4** - Seguridad, costo y cierre honesto (merge a producción).
5. **Fase 5** *(opcional)* - Subida real de documentos (con base vectorial).

## Antes de seguir (one-time, lo haces tú)
1. Consigue una API key **gratis** de Gemini en **https://aistudio.google.com/apikey** (solo cuenta Google, sin tarjeta).
2. Ponla en Vercel: proyecto `documind` → Settings → Environment Variables → `GEMINI_API_KEY` (Production + Preview).
3. CLI de Vercel: `npm i -g vercel`, `vercel login`, `vercel link` (proyecto `documind`).
4. Tráela a local: dentro de `app/` corre `vercel env pull .env.local` (crea el archivo con tu key; ya está gitignored).
5. Probar local con backend: `vercel dev` (sirve front + `/api`, normalmente en http://localhost:3000).

---

## 🔁 Bloque común (pégalo arriba de cada fase)
```
Contexto: Proyecto "DocuMind" (Q&A sobre documentos con citas). Stack: Vite + React 19 + TypeScript + Tailwind. Ruta: D:\Vibecodeadas\DocuMind\design_handoff_documind\app (repo github.com/MaikelHR/documind, deploy en Vercel: documind-lake.vercel.app). El backend RAG es GRATIS con Google Gemini (@google/genai). La Fase 1 ya está hecha (api/chat.ts + shared/corpus.ts). Hay un roadmap en BACKEND.md (léelo).

Reglas (cúmplelas estrictamente):
- Trabaja en la rama feat/backend (haz `git checkout feat/backend`). NUNCA rompas main ni la demo de producción.
- Secretos SOLO en funciones del servidor (api/). La GEMINI_API_KEY jamás en el bundle del cliente.
- LLM = Google Gemini via @google/genai (modelo gemini-2.5-flash). Embeddings = Gemini text-embedding-004 (gratis). NO uses APIs de pago.
- NO migres a Next.js ni reescribas el frontend; solo conecta lo necesario. No agregues dependencias fuera de las indicadas.
- Lee el código actual ANTES de editar. Mantén el patrón y el estilo existentes.
- Invariante de citas: el `snippet` debe ser substring EXACTO del contenido de esa página (lo usa el resaltado del drawer con indexOf). Las citas se construyen desde el corpus, no de lo que invente el modelo.
- App bilingüe: el frontend envía el idioma (es/en); responde y cita en ese idioma.
- Al terminar: `npm run build` y `npm run lint` en verde, y commit en feat/backend con mensaje claro. Si hay ambigüedad, elige el default simple y sigue (no preguntes de más).
```

---

## ✅ Fase 1 - Backend + respuestas reales (HECHA)
Ya implementado: `shared/corpus.ts` (corpus compartido), `api/chat.ts` (función Vercel que arma el
prompt con los pasajes numerados, llama a Gemini `gemini-2.5-flash` y reconstruye las citas desde el
corpus), `src/lib/api.ts` + `send()` en `src/App.tsx` llamando a `/api/chat` con fallback al mock.
Para probar: pon `GEMINI_API_KEY` (pasos de arriba), corre `vercel dev` y pregunta algo.

## 🟩 Fase 2 - Streaming real
```
Implementa la FASE 2 (la 1 ya está; lee api/chat.ts, src/lib/api.ts y src/App.tsx).
1. Convierte /api/chat a streaming con ai.models.generateContentStream(...) de @google/genai: emite el texto en tiempo real (Web ReadableStream / SSE) y, al cerrar, un último evento con el JSON de `cites` (recálculalas sobre el texto completo acumulado, manteniendo el invariante de substring).
2. Frontend: consume el stream, acumula y revela el texto en vivo reutilizando la UI de cursor/streaming actual (reemplaza el reveal simulado por chunks reales; sigue parseando [[n]]). Al terminar: fija cites, fase done, Sources + drawer.
3. El botón Stop debe abortar la petición real (AbortController) y finalizar la respuesta parcial.
Verificación (con `vercel dev`): el texto fluye token a token, Stop corta de verdad, citas/drawer correctos. build+lint verde, commit, push (preview).
```

## 🟩 Fase 3 - Retrieval real (RAG)
```
Implementa la FASE 3 (lee shared/corpus.ts y api/chat.ts).
1. Embeddings con Gemini text-embedding-004 (gratis, misma GEMINI_API_KEY) usando ai.models.embedContent(...).
2. Crea `scripts/embed-corpus.ts` (script offline que corro una vez con npm): vectoriza cada chunk del corpus -> `shared/corpus.embeddings.json`.
3. En api/chat.ts: embebe la pregunta -> similitud coseno en memoria contra los chunks del mismo idioma -> top-k (k=4) -> pasa SOLO esos pasajes a Gemini (en vez de todo el corpus). Construye `cites` desde esos top-k (invariante de substring).
4. Conecta los "retrieval steps" del UI para que reflejen los documentos REALMENTE recuperados (no la lista fija).
Verificación: preguntas distintas traen pasajes distintos; las citas abren la página exacta. build+lint verde, commit, push (preview).
Nota: corpus chico; el objetivo es la arquitectura correcta de RAG.
```

## 🟩 Fase 4 - Seguridad, costo y cierre honesto
```
Implementa la FASE 4.
1. Rate-limit por IP + tope diario global (Upstash Redis free, o contador in-memory simple). Al agotarse, responde "demo agotada por hoy" SIN llamar al modelo.
2. max_tokens razonable, manejo de errores con estado claro en la UI, y (opcional) context caching de Gemini para el prompt del corpus.
3. Actualiza el "model chip" de la UI: que muestre el modelo real (Gemini), no "Sonnet 4.5".
4. Actualiza README.md: "RAG funcional con citas (Google Gemini, free tier)"; cambia la nota de "demo simulada" por "RAG real sobre un corpus fijo".
5. Tras verificar en preview, mergea feat/backend a main (actualiza la demo en producción).
Verificación: rate-limit corta bien; sin errores en consola; README correcto; prod en vivo funciona. Dame los comandos de merge/push.
```

## 🟦 Fase 5 *(opcional)* - Subida real de documentos
```
Implementa la FASE 5 (solo si 1-4 están sólidas en main).
1. Persistencia: Supabase (Postgres + pgvector, free tier). URL/keys SOLO en el servidor.
2. `api/ingest.ts`: recibe PDF -> extrae texto por página -> chunk -> embed (Gemini text-embedding-004) -> upsert a pgvector { docId, page, text, embedding }.
3. Conecta el DropZone real (src/components/DropZone.tsx): subir archivo -> POST /api/ingest -> al indexar, el doc aparece como fuente real consultable. Quita la animación simulada de addDoc().
4. /api/chat: el retrieval consulta pgvector (no solo el JSON estático), filtrando por los docs del usuario.
Verificación: subo un PDF, se indexa, pregunto y cita ese PDF con su página. build+lint verde, commit, push, merge.
```

---

## Estructura objetivo (al terminar)
```
api/chat.ts                  # función Vercel: retrieve + Gemini (stream) + cites
api/ingest.ts                # (Fase 5) subir PDF -> parse -> chunk -> embed -> pgvector
shared/corpus.ts             # los 4 docs en chunks (lo usan frontend y API)
shared/corpus.embeddings.json
scripts/embed-corpus.ts      # offline, corre una vez
.env.local                   # GEMINI_API_KEY - NO se sube (gitignored)
```

## Para el CV
Al cerrar la **Fase 4** ya puedes decir, con total honestidad:
**"RAG funcional con citas (Google Gemini) - React + TypeScript + Tailwind, desplegado en Vercel."**
