import Anthropic from '@anthropic-ai/sdk';
import type { MealPlan, WeekPlan, DayPlan, Meal, MealIngredient, MealType } from '../types';
import { DAY_LABELS } from '../types';

const EXTRACT_PROMPT = `Sei un assistente che analizza piani alimentari di nutrizionisti.
Analizza questo documento PDF e estrai TUTTI i pasti, organizzati per settimana e giorno.

Per ogni pasto identifica:
- tipo: SOLO uno tra: "colazione", "spuntino_mattina", "pranzo", "spuntino_pomeriggio", "cena"
- name: nome descrittivo del piatto (es. "Riso con piselli e formaggio")
- ingredients: lista ingredienti con quantità e unità (es. g, ml, pz)

IMPORTANTE: Rispondi SOLO con JSON valido, niente altro. Usa questa struttura esatta:
{
  "weeks": [
    {
      "weekNumber": 1,
      "days": [
        {
          "dayLabel": "Lunedì",
          "dayIndex": 0,
          "meals": [
            {
              "type": "colazione",
              "name": "Latte e biscotti integrali",
              "ingredients": [
                { "name": "Latte parzialmente scremato", "quantity": 200, "unit": "ml" },
                { "name": "Biscotti integrali", "quantity": 30, "unit": "g" }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Giorni: Lunedì=0, Martedì=1, Mercoledì=2, Giovedì=3, Venerdì=4, Sabato=5, Domenica=6.
Se il piano non è diviso per settimane, metti tutto nella settimana 1.
Se un tipo pasto non è presente in un giorno, non includerlo.`;

export interface ParseProgress {
  status: 'reading' | 'uploading' | 'parsing' | 'done' | 'error';
  message: string;
  chars?: number; // caratteri ricevuti in streaming
}

export async function parseMealPlanPDF(
  apiKey: string,
  pdfFile: File,
  householdId: string,
  profileId: string,
  onProgress: (p: ParseProgress) => void
): Promise<MealPlan> {
  onProgress({ status: 'reading', message: 'Lettura PDF in corso...' });

  // Leggi il PDF come base64
  const base64 = await fileToBase64(pdfFile);

  onProgress({ status: 'parsing', message: 'Analisi del piano in corso...', chars: 0 });

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  // Streaming: haiku-4-5 è 3-4× più veloce di sonnet per estrazione JSON strutturata
  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          } as Anthropic.DocumentBlockParam,
          {
            type: 'text',
            text: EXTRACT_PROMPT,
          },
        ],
      },
    ],
  });

  // Aggiorna il progresso in tempo reale mentre arrivano i token
  let accumulated = '';
  stream.on('text', (text) => {
    accumulated += text;
    onProgress({
      status: 'parsing',
      message: 'Analisi del piano in corso...',
      chars: accumulated.length,
    });
  });

  const finalMsg = await stream.finalMessage();

  // Usa il testo dallo streaming; se vuoto fallback sulla finalMessage
  let rawText = accumulated.trim();
  if (!rawText) {
    rawText = finalMsg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();
  }

  // 1. Rimuovi eventuali markdown code fences
  let jsonText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // 2. Fallback: estrai il blocco JSON principale { ... } dal testo
  if (!jsonText.startsWith('{')) {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) jsonText = match[0];
  }

  let parsed: { weeks: Array<{
    weekNumber: number;
    days: Array<{
      dayLabel: string;
      dayIndex: number;
      meals: Array<{
        type: string;
        name: string;
        ingredients: Array<{ name: string; quantity: number; unit: string }>;
      }>;
    }>;
  }> };

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error('JSON non valido ricevuto da Claude.\nstop_reason:', finalMsg.stop_reason, '\nRisposta:', jsonText.slice(0, 500));
    if (finalMsg.stop_reason === 'max_tokens') {
      throw new Error('Il PDF è troppo lungo: prova con un piano più corto o carica solo una settimana alla volta.');
    }
    throw new Error('Impossibile interpretare la risposta di Claude. Controlla la console per dettagli.');
  }

  onProgress({ status: 'done', message: 'Piano analizzato con successo!' });

  // Converti nel formato MealPlan interno
  const now = new Date().toISOString();
  const weeks: WeekPlan[] = parsed.weeks.map(week => ({
    weekNumber: week.weekNumber,
    days: week.days.map(day => {
      const dayPlan: DayPlan = {
        id: crypto.randomUUID(),
        dayLabel: DAY_LABELS[day.dayIndex] ?? day.dayLabel,
        dayIndex: day.dayIndex,
        meals: day.meals.map(meal => {
          const m: Meal = {
            id: crypto.randomUUID(),
            type: (meal.type as MealType) ?? 'pranzo',
            name: meal.name,
            ingredients: meal.ingredients.map(ing => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
            }) as MealIngredient),
            completed: false,
            substitutions: [],
          };
          return m;
        }),
      };
      return dayPlan;
    }),
  }));

  const mealPlan: MealPlan = {
    id: crypto.randomUUID(),
    householdId,
    profileId,
    pdfName: pdfFile.name,
    weeks,
    createdAt: now,
    updatedAt: now,
  };

  return mealPlan;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Rimuovi il prefisso data:...;base64,
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
