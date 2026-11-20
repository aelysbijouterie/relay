// Appel Gemini (palier gratuit) avec réponse JSON structurée, nouvelle tentative et modèle de secours.
// Utilisé par « Reformuler avec l'IA » (cartes). Le tri des mails a sa propre version dans lib/mail/analyze.ts.

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest']
type ThinkMode = 'level' | 'budget' | 'none'
const THINK_ORDER: ThinkMode[] = ['level', 'budget', 'none']
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface GeminiError extends Error { status?: number }

export async function geminiJson(prompt: string, schema: object, opts: { deadline?: number; maxOutputTokens?: number } = {}): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY
  if (!key) { const e: GeminiError = new Error('Clé GEMINI_API_KEY absente dans Vercel'); e.status = 500; throw e }
  const deadline = opts.deadline ?? Date.now() + 25000

  const call = (model: string, think: ThinkMode) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(Math.max(4000, Math.min(15000, deadline - Date.now() - 2000))),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        ...(think === 'level' ? { thinkingConfig: { thinkingLevel: 'minimal' } } : think === 'budget' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  })

  let last: Response | null = null
  let lastErr: unknown = null
  for (const model of [MODEL, ...FALLBACK_MODELS.filter(m => m !== MODEL)]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if ((last || lastErr) && Date.now() > deadline - 8000) break
      try {
        let r: Response | null = null
        for (const think of THINK_ORDER) { r = await call(model, think); if (r.status !== 400) break }
        if (!r) break
        if (r.ok) {
          const data = await r.json()
          const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
          if (!text) throw new Error('Réponse IA vide')
          return JSON.parse(text)
        }
        last = r
        if (![429, 500, 502, 503, 504].includes(r.status)) break
        await sleep(attempt === 0 ? 2000 : 0)
      } catch (e) { lastErr = e; break }
    }
  }
  const err: GeminiError = new Error(last ? `IA indisponible (${last.status})` : 'IA injoignable : délai dépassé')
  err.status = last?.status ?? 504
  throw err
}
