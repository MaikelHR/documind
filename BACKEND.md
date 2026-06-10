# DocuMind - Roadmap del backend RAG (por fases) · 100% gratis con Gemini

> **Estado actual (2026-06-09): Fases 1, 4a, 3 y 2 HECHAS, verificadas y en producción**
> (documind-lake.vercel.app): respuestas reales de Gemini con retrieval semántico (embed +
> coseno top-4), streaming SSE token a token con Stop real, citas exactas reconstruidas en el
> server, rate-limit por IP + tope diario. Si la API falla, el frontend cae al banco simulado.
>
> Pendiente: solo la **Fase 5 (uploads reales)**.
>
> Cada fase se hace en **un chat nuevo** (Claude Code), en la rama `feat/backend`, y se
> verifica/mergea a `main` en el chat de verificación. OJO: los previews de Vercel tienen
> Deployment Protection (401 sin sesión del navegador) -> la verificación por terminal se hace
> con tests locales del handler (mock req/res + key de .env.local) y el live-test en prod.

---

## Decisiones de arquitectura (gratis & honesto)
- **Backend:** funciones serverless de **Vercel** en `api/` del mismo repo (un solo deploy, free tier).
- **LLM:** Google **Gemini** (`gemini-2.5-flash`) **via REST con `fetch`** (NO el SDK; ver gotchas).
- **Embeddings (Fase 3):** Gemini `gemini-embedding-001` (gratis), también por REST -> una sola key.
  (`text-embedding-004`, el plan original, fue retirado de la API: devuelve 404 en 2026.)
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
6. Verificar `api/chat.ts` aparte (no lo cubre `tsc -b`); el `--resolveJsonModule` es
   necesario desde la Fase 3 (importa `shared/corpus.embeddings.json`):
   `npx tsc --ignoreConfig --noEmit --skipLibCheck --strict --verbatimModuleSyntax --module nodenext --moduleResolution nodenext --resolveJsonModule --target es2022 --lib es2022,dom api/chat.ts`
7. (Fase 3) Si cambia el texto del corpus hay que re-correr `npm run embed` y commitear
   el JSON; un chunk editado sin re-embeber simplemente queda fuera del retrieval
   (match exacto por docId/page/lang/text), nunca se cita con un vector viejo.

## Costo
- **Gemini free tier = $0** (sin tarjeta). Tiene límites por minuto y por día, suficientes para
  una demo de portafolio. La Fase 4a agrega rate-limit propio para proteger esa cuota.

## El arco
1. **Fase 1** ✅ HECHA - respuestas reales de Gemini con citas.
2. **Fase 4a** ✅ HECHA - rate-limit por IP + tope diario; `@google/genai` desinstalado.
3. **Fase 3** ✅ HECHA - retrieval real (gemini-embedding-001 768d + coseno top-4; `npm run embed`).
4. **Fase 2** ✅ HECHA - streaming SSE real con Stop real y renumeración de [[n]] al vuelo.
5. **Fase 5** - Subida real de documentos (con base vectorial). ÚNICA pendiente.

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

## ✅ Fase 3 - Retrieval real (RAG) - HECHA (prompt original, como referencia)
```
Implementa el retrieval real (lee shared/corpus.ts y api/chat.ts primero).
1. Crea scripts/embed-corpus.mjs (script Node que corro UNA vez localmente con la key en .env.local): por cada chunk del corpus llama por REST a https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent (key en header x-goog-api-key) y guarda los vectores en shared/corpus.embeddings.json (junto a docId/page/lang). Agrega el comando como npm script "embed".
2. En api/chat.ts: embebe la pregunta (mismo endpoint REST) -> similitud coseno en memoria contra los chunks del MISMO idioma -> top-k (k=4) -> pasa SOLO esos pasajes numerados a Gemini (en vez de todo el corpus). Las citas se construyen desde esos top-k (invariante de substring intacto).
3. Devuelve también en la respuesta JSON qué documentos se recuperaron, y conecta los "retrieval steps" del UI (componente Retrieval) para que muestren los documentos REALMENTE recuperados, no la lista fija.
Verificación: preguntas de temas distintos recuperan documentos distintos; las citas siguen abriendo la página exacta en el drawer; si la pregunta no tiene que ver con el corpus, el modelo lo dice sin inventar. build+lint+type-check nodenext en verde, commit, push (preview).
Nota: el corpus es chico; el objetivo es la arquitectura RAG correcta, no la escala.
```

## ✅ Fase 2 - Streaming real - HECHA (prompt original, como referencia)
```
Implementa el streaming real (lee api/chat.ts, src/lib/api.ts y App.tsx primero).
1. Nuevo endpoint o modo en api/chat.ts usando el endpoint REST de streaming: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse (fetch + AbortController igual que ahora; parsea los eventos SSE "data:"). Reenvía el texto al cliente como stream (res.write con chunks; recuerda que el handler es Node-style, puedes escribir directo a res con content-type text/event-stream) y, al terminar, un último evento con el JSON de cites calculado sobre el texto completo acumulado.
2. Frontend: consume el stream (fetch + ReadableStream), acumula y revela el texto en vivo reutilizando la UI de cursor/streaming actual (reemplaza el reveal simulado por los chunks reales; sigue parseando [[n]]). Al cerrar: fija cites, fase done, Sources + drawer como hoy.
3. El botón Stop debe abortar la petición real (AbortController del cliente) y finalizar mostrando la respuesta parcial.
Verificación: el texto fluye en tiempo real, Stop corta de verdad, citas/drawer correctos en es y en. build+lint+type-check nodenext en verde, commit, push (preview).
```

## 🟦 Fase 5 - Subida real de documentos (ÚNICA PENDIENTE)

> **Vector DB = Supabase (Postgres + pgvector, free tier) + keep-alive automático.**
> El free tier de Supabase se pausa tras ~7 días sin actividad en la base (restore manual
> en el dashboard) -> esta fase incluye un **Cron Job de Vercel** que hace una consulta
> trivial cada día, así el proyecto nunca llega a pausarse y nadie tiene que acordarse.
>
> **Antes (one-time, lo hace el usuario):** crear proyecto gratis en https://supabase.com,
> habilitar la extensión vector (SQL editor: `create extension if not exists vector;`) y
> poner `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en Vercel (Production+Preview,
> Sensitive) y en `.env.local`. La service-role key es SOLO de servidor, como la de Gemini.

> **El esquema SQL YA está aplicado en Supabase** (el usuario lo corrió en el SQL Editor).
> NO lo rediseñes: conforma el código a él. Es exactamente este:
>
> ```sql
> create extension if not exists vector;
> create table if not exists user_chunks (
>   id bigint generated always as identity primary key,
>   session_id text not null, doc_id text not null, doc_name text not null,
>   ext text not null default 'PDF', pages int not null, page int not null,
>   lang text not null, text text not null, embedding vector(768) not null,
>   created_at timestamptz not null default now()
> );
> create index if not exists user_chunks_embedding_idx on user_chunks using hnsw (embedding vector_cosine_ops);
> create index if not exists user_chunks_session_idx on user_chunks (session_id, doc_id, page);
> create index if not exists user_chunks_created_idx on user_chunks (created_at);
> alter table user_chunks enable row level security;  -- sin políticas: solo service_role entra
> create or replace function match_user_chunks(query_embedding vector(768), session text, qlang text, k int default 4)
> returns table (doc_id text, doc_name text, pages int, page int, text text, score float)
> language sql stable as $$
>   select c.doc_id, c.doc_name, c.pages, c.page, c.text, 1 - (c.embedding <=> query_embedding) as score
>   from user_chunks c where c.session_id = session and c.lang = qlang
>   order by c.embedding <=> query_embedding limit k;
> $$;
> ```

```
Implementa la subida real de documentos.
1. Persistencia: Supabase (Postgres + pgvector, free tier) vía la REST de PostgREST con fetch (sin SDK, mismo espíritu que Gemini; si el SDK @supabase/supabase-js resulta más simple, se permite SOLO en api/). El esquema YA EXISTE (bloque sql de arriba): tabla user_chunks + rpc match_user_chunks. Inserts: POST $SUPABASE_URL/rest/v1/user_chunks. RPC: POST $SUPABASE_URL/rest/v1/rpc/match_user_chunks. OJO headers: la SUPABASE_SERVICE_ROLE_KEY configurada es del formato NUEVO de Supabase (sb_secret_..., ~41 chars, NO es un JWT) -> se manda SOLO en el header `apikey`; NO la pongas en `Authorization: Bearer` (PostgREST espera un JWT ahí y daría 401). Keys SOLO en el servidor.
2. api/ingest.ts (handler Node-style, imports .js, config maxDuration 60): recibe { sessionId, name, data (PDF en base64) } -> límite 4 MB (el body de una función Vercel admite ~4.5 MB) -> extrae texto por página (dependencia permitida: unpdf, serverless-friendly) -> chunk por párrafo (mismo criterio que shared/corpus.ts) -> embed con gemini-embedding-001 (REST, RETRIEVAL_DOCUMENT, outputDimensionality 768 - MISMOS valores que api/chat.ts) -> insert por lote a user_chunks. Responde { docId, name, pages, chunks }. Rate-limit propio (p. ej. 3 uploads/día por IP) reutilizando el patrón de api/chat.ts. Limpieza sin cron: en cada ingest borra los user_chunks con created_at > 7 días (uploads de demo = efímeros; documéntalo en el README).
3. KEEP-ALIVE (evita la pausa por inactividad del free tier): api/keepalive.ts (handler Node-style) que hace una consulta trivial a user_chunks (p. ej. select id limit 1) y responde 200; + vercel.json con { "crons": [{ "path": "/api/keepalive", "schedule": "0 12 * * *" }] } (el plan Hobby permite crons diarios). Protégelo: si existe process.env.CRON_SECRET, exige el header Authorization: Bearer $CRON_SECRET (Vercel lo manda solo en sus crons) y responde 401 si no coincide.
4. Alcance por visitante SIN auth: el frontend genera un sessionId aleatorio persistido en localStorage ('dm-session') y lo manda en /api/ingest y /api/chat. Los docs subidos solo se recuperan para su session_id; el corpus fijo es global.
5. api/chat.ts: además del top-k del corpus fijo, llama al rpc match_user_chunks con el MISMO vector de la pregunta (filtrado por session_id + lang); mezcla ambos rankings por score (coseno en ambos) y toma el top-4 global. Las citas de docs subidos llevan docId/page/snippet desde la fila (el snippet ES el texto del chunk, invariante intacto). Si Supabase no responde (p. ej. recién despertando), degrada con gracia: responde solo con el corpus fijo, sin romper.
6. UI - PUNTO CRÍTICO: el SourceDrawer hoy renderiza páginas desde shared/corpus.ts (pageParagraphs), que NO conoce los docs subidos. Para docs subidos recupera los párrafos de la página desde user_chunks (expón GET /api/page?sessionId&docId&page o incluye pageParas en la cite que devuelve /api/chat) y renderízala igual (título + párrafos + <mark> por indexOf). Sin esto las citas de uploads no abren nada.
7. Conecta el DropZone real (src/components/DropZone.tsx + addDoc en App.tsx): subir archivo -> POST /api/ingest con progreso real (sube/indexando/indexed); al indexar, el doc aparece en el sidebar como fuente consultable con sus páginas reales. Mantén addDoc() simulado SOLO como fallback sin backend (vite dev), igual que el banco de respuestas.
Verificación: subo un PDF real, se indexa, pregunto algo que solo está en ese PDF -> respuesta con cita [n] que abre el drawer en la página correcta con el pasaje resaltado; en otra ventana/incógnito (otro sessionId) ese doc NO aparece ni se recupera; los 4 docs del corpus siguen funcionando igual; GET /api/keepalive responde 200 (y 401 sin secret si CRON_SECRET está puesto); build+lint+type-check nodenext en verde (también api/ingest.ts y api/keepalive.ts), commit, push.
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
api/keepalive.ts             # (Fase 5) cron diario de Vercel: query trivial, Supabase nunca se pausa
shared/corpus.ts             # los 4 docs en chunks (lo usan frontend y API)
shared/corpus.embeddings.json# (Fase 3) vectores precalculados del corpus
scripts/embed-corpus.mjs     # (Fase 3) offline, corre una vez
.env.local                   # GEMINI_API_KEY - NO se sube (gitignored)
```

## Para el CV
Ya puedes decir con honestidad: **"RAG completo con citas verificables: retrieval semántico
(embeddings Gemini + coseno top-k), streaming SSE en tiempo real y rate-limiting - React +
TypeScript + Tailwind, serverless en Vercel."**
Al cerrar la **Fase 5** puedes sumarle: **"con ingesta de documentos del usuario (Postgres + pgvector)"**.
