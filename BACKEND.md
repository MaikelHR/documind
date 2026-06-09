# DocuMind - Roadmap del backend RAG (por fases) · 100% gratis con Gemini

> **Estado actual (2026-06-09):** **Fase 1 HECHA y mergeada a `main`** - producción
> (documind-lake.vercel.app) ya responde con Gemini real, fundamentado y con citas exactas.
> También está hecho, adelantado de la Fase 4: model chip "Gemini 2.5 Flash", README honesto
> y el merge a main. Si la API falla, el frontend cae al banco simulado (la demo nunca se rompe).
>
> Pendiente: **Fase 4a (rate-limit)** → **Fase 3 (retrieval real)** → **Fase 2 (streaming)** →
> **Fase 5 (uploads, opcional)**. Ese es el orden recomendado: el rate-limit protege la cuota
> gratis YA; el retrieval es lo de más valor técnico para el CV.
>
> Cada fase se hace en **un chat nuevo** (Claude Code), en la rama `feat/backend`, se prueba
> en la URL **preview** de Vercel y, verificada, se mergea a `main` (fast-forward).

---

## Decisiones de arquitectura (gratis & honesto)
- **Backend:** funciones serverless de **Vercel** en `api/` del mismo repo (un solo deploy, free tier).
- **LLM:** Google **Gemini** (`gemini-2.5-flash`) **via REST con `fetch`** (NO el SDK; ver gotchas).
- **Embeddings (Fase 3):** Gemini `text-embedding-004` (gratis), también por REST -> una sola key.
- **Corpus fijo:** los 4 documentos, en `shared/corpus.ts` (única fuente de verdad; lo usan el
  drawer del frontend y la API).
- **Retrieval (Fase 3):** embeddings + similitud coseno **en memoria**. Sin base de datos hasta la Fase 5.
- **Citas:** se construyen en el servidor desde el texto del corpus (no de lo que invente el modelo);
  el `snippet` es substring exacto de la página (lo usa el resaltado del drawer).
- **Bilingüe (es/en):** el frontend envía el idioma; se responde y cita en ese idioma.
- **Secretos:** `GEMINI_API_KEY` vive SOLO en el servidor (`api/`), nunca en el cliente.

## ⚠️ Gotchas aprendidos a golpes en la Fase 1 (NO repetirlos)
1. **Handler estilo Node `(req, res)` con `res.status().json()`** - NUNCA la firma web
   `(req: Request) => Response`: el runtime de Vercel la invoca como `(req,res)`, ignora el
   `Response` devuelto y la función cuelga 60s (`FUNCTION_INVOCATION_TIMEOUT`).
2. **Imports relativos con extensión `.js` explícita** en `api/` y `shared/` (ESM nativo de
   Node; sin extensión da `ERR_MODULE_NOT_FOUND` en runtime y TS2835 en el build).
3. **NO usar el SDK `@google/genai`**: en Vercel su `generateContent` se colgaba e ignoraba su
   timeout. Se llama a la API REST con `fetch` + `AbortController` (25s), key en el header
   `x-goog-api-key` (nunca en la URL). El paquete ya fue desinstalado (Fase 4a).
4. **`generationConfig.thinkingConfig.thinkingBudget: 0`** - el thinking automático de
   2.5-flash se dispara con prompts grandes y agota el tiempo. Con 0 responde en ~1s.
5. El free tier da **503 "high demand" intermitente** -> ya hay reintentos (x3, backoff corto).
6. Verificar `api/chat.ts` aparte (no lo cubre `tsc -b`):
   `npx tsc --ignoreConfig --noEmit --skipLibCheck --strict --verbatimModuleSyntax --module nodenext --moduleResolution nodenext --target es2022 --lib es2022,dom api/chat.ts`

## Costo
- **Gemini free tier = $0** (sin tarjeta). Tiene límites por minuto y por día, suficientes para
  una demo de portafolio. La Fase 4a agrega rate-limit propio para proteger esa cuota.

## El arco
1. **Fase 1** ✅ HECHA y en producción - respuestas reales de Gemini con citas.
2. **Fase 4a** - Rate-limit + limpieza (corta, hazla primero: protege la cuota).
3. **Fase 3** - Retrieval real (RAG: embeddings + top-k). La de más valor para el CV.
4. **Fase 2** - Streaming real (pulido UX).
5. **Fase 5** *(opcional)* - Subida real de documentos (con base vectorial).

---

## 🔁 Bloque común (pégalo arriba de cada fase)
```
Contexto: Proyecto "DocuMind" (Q&A sobre documentos con citas). Stack: Vite + React 19 + TypeScript + Tailwind. Ruta: D:\Vibecodeadas\DocuMind\design_handoff_documind\app (git root = app/; repo github.com/MaikelHR/documind; prod en Vercel: documind-lake.vercel.app). El backend YA FUNCIONA en producción: api/chat.ts llama a Gemini gemini-2.5-flash por REST y reconstruye las citas desde shared/corpus.ts. Lee BACKEND.md ANTES de tocar nada, en especial la sección "Gotchas aprendidos a golpes" - esas reglas son obligatorias.

Reglas (cúmplelas estrictamente):
- Trabaja en la rama feat/backend (`git checkout feat/backend`; está sincronizada con main). NUNCA rompas main/producción: se mergea solo al final, verificado.
- Handler de api/: estilo Node (req, res) con res.status().json(). Imports relativos SIEMPRE con extensión .js. Llamadas a Gemini por REST con fetch + AbortController (sigue el patrón exacto de api/chat.ts); NO uses el SDK @google/genai ni agregues dependencias nuevas salvo las que la fase indique.
- Secretos SOLO en el servidor: GEMINI_API_KEY jamás en el bundle del cliente ni en URLs.
- NO migres a Next.js ni reescribas el frontend; solo conecta lo necesario. Lee el código actual ANTES de editar y mantén el estilo existente.
- Invariante de citas: el `snippet` debe ser substring EXACTO del contenido de esa página (el drawer lo resalta con indexOf). Las citas se construyen desde el corpus, no de lo que escriba el modelo.
- App bilingüe: el frontend envía lang (es/en); responde y cita en ese idioma.
- Al terminar: `npm run build` y `npm run lint` en verde + el type-check nodenext de api/ que está en BACKEND.md; commit claro en feat/backend y push (genera preview). NO mergees a main: eso se verifica y hace en otro chat.
```

---

## ✅ Fase 1 - Backend + respuestas reales (HECHA, en producción)
`shared/corpus.ts` (corpus compartido) + `api/chat.ts` (Vercel function: prompt con pasajes
numerados → Gemini REST → citas reconstruidas del corpus) + `src/lib/api.ts` y `send()` en
`App.tsx` llamando a `/api/chat` con fallback al mock. Chip "Gemini 2.5 Flash" y README al día.

## 🟥 Fase 4a - Rate-limit + limpieza (HAZLA PRIMERO - protege la cuota gratis)
```
Implementa el rate-limit del endpoint /api/chat (lee api/chat.ts primero).
1. Límite por IP (p. ej. 10 preguntas/min) + tope diario global (p. ej. 300/día) con un contador in-memory simple en el módulo (Map ip->timestamps + contador con fecha; documenta que con varias instancias serverless es best-effort, suficiente para una demo). NO agregues Redis ni dependencias.
2. Al exceder: HTTP 429 con { error: 'rate_limited' }. Frontend (src/lib/api.ts + App.tsx): si llega 429, muestra el mensaje "Demo agotada por hoy, intenta más tarde" (es/en vía i18n) en lugar de caer silenciosamente al mock.
3. Limpieza: desinstala la dependencia @google/genai (npm uninstall, ya no se usa - la llamada es REST directa).
Verificación: spamear >10 requests/min devuelve 429 y la UI muestra el aviso; una pregunta normal sigue funcionando igual. build+lint+type-check nodenext en verde, commit, push (preview).
```

## 🟩 Fase 3 - Retrieval real (RAG) - la de más valor para el CV
```
Implementa el retrieval real (lee shared/corpus.ts y api/chat.ts primero).
1. Crea scripts/embed-corpus.mjs (script Node que corro UNA vez localmente con la key en .env.local): por cada chunk del corpus llama por REST a https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent (key en header x-goog-api-key) y guarda los vectores en shared/corpus.embeddings.json (junto a docId/page/lang). Agrega el comando como npm script "embed".
2. En api/chat.ts: embebe la pregunta (mismo endpoint REST) -> similitud coseno en memoria contra los chunks del MISMO idioma -> top-k (k=4) -> pasa SOLO esos pasajes numerados a Gemini (en vez de todo el corpus). Las citas se construyen desde esos top-k (invariante de substring intacto).
3. Devuelve también en la respuesta JSON qué documentos se recuperaron, y conecta los "retrieval steps" del UI (componente Retrieval) para que muestren los documentos REALMENTE recuperados, no la lista fija.
Verificación: preguntas de temas distintos recuperan documentos distintos; las citas siguen abriendo la página exacta en el drawer; si la pregunta no tiene que ver con el corpus, el modelo lo dice sin inventar. build+lint+type-check nodenext en verde, commit, push (preview).
Nota: el corpus es chico; el objetivo es la arquitectura RAG correcta, no la escala.
```

## 🟩 Fase 2 - Streaming real
```
Implementa el streaming real (lee api/chat.ts, src/lib/api.ts y App.tsx primero).
1. Nuevo endpoint o modo en api/chat.ts usando el endpoint REST de streaming: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse (fetch + AbortController igual que ahora; parsea los eventos SSE "data:"). Reenvía el texto al cliente como stream (res.write con chunks; recuerda que el handler es Node-style, puedes escribir directo a res con content-type text/event-stream) y, al terminar, un último evento con el JSON de cites calculado sobre el texto completo acumulado.
2. Frontend: consume el stream (fetch + ReadableStream), acumula y revela el texto en vivo reutilizando la UI de cursor/streaming actual (reemplaza el reveal simulado por los chunks reales; sigue parseando [[n]]). Al cerrar: fija cites, fase done, Sources + drawer como hoy.
3. El botón Stop debe abortar la petición real (AbortController del cliente) y finalizar mostrando la respuesta parcial.
Verificación: el texto fluye en tiempo real, Stop corta de verdad, citas/drawer correctos en es y en. build+lint+type-check nodenext en verde, commit, push (preview).
```

## 🟦 Fase 5 *(opcional)* - Subida real de documentos
```
Implementa la subida real de documentos (solo si las fases anteriores están sólidas en main).
1. Persistencia: Supabase (Postgres + pgvector, free tier). URL/keys SOLO en el servidor.
2. api/ingest.ts (handler Node-style, imports .js): recibe PDF -> extrae texto por página -> chunk -> embed (text-embedding-004 por REST) -> upsert a pgvector { docId, page, text, embedding }.
3. Conecta el DropZone real (src/components/DropZone.tsx): subir archivo -> POST /api/ingest -> al indexar, el doc aparece como fuente real consultable. Quita la animación simulada de addDoc().
4. api/chat.ts: el retrieval consulta pgvector (además del corpus fijo), filtrando por los docs del usuario.
Verificación: subo un PDF, se indexa, pregunto y cita ese PDF con su página. build+lint+type-check en verde, commit, push.
```

---

## Después de cada fase: verificación y merge (en el chat de verificación)
1. Probar la URL **preview** de `feat/backend` (la da Vercel al pushear).
2. Si todo bien: `git checkout main && git merge --ff-only feat/backend && git push origin main`
   (despliega producción) y `git checkout feat/backend`.
3. Si algo falla, se arregla en `feat/backend` - producción nunca se entera.

## Estructura objetivo (al terminar)
```
api/chat.ts                  # Vercel fn (Node-style): retrieve + Gemini REST (stream) + cites
api/ingest.ts                # (Fase 5) subir PDF -> parse -> chunk -> embed -> pgvector
shared/corpus.ts             # los 4 docs en chunks (lo usan frontend y API)
shared/corpus.embeddings.json# (Fase 3) vectores precalculados del corpus
scripts/embed-corpus.mjs     # (Fase 3) offline, corre una vez
.env.local                   # GEMINI_API_KEY - NO se sube (gitignored)
```

## Para el CV
Ya puedes decir con honestidad: **"Asistente de documentos con respuestas fundamentadas y
citas verificables (Google Gemini), React + TypeScript + Tailwind, serverless en Vercel."**
Al cerrar la **Fase 3** puedes sumarle: **"con retrieval semántico (RAG: embeddings + top-k)"**.
