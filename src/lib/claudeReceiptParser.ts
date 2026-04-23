import Anthropic from '@anthropic-ai/sdk';
import type { PantryItem, PantryCategory, PantryUnit, ReceiptParsedItem } from '../types';

// ─── Normalizzazione (condivisa con pantrySync) ───────────────────────────────

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const RECEIPT_PROMPT = `Sei un assistente che analizza foto di scontrini della spesa italiani.
Estrai TUTTI gli articoli alimentari presenti nello scontrino.
Per ogni articolo identifica:
- name: nome dell'alimento (pulito, in italiano, senza codici o abbreviazioni. Es: "PAST.BARI.500" → "Pasta")
- category: ESATTAMENTE uno tra: "Cereali & pasta", "Legumi", "Verdure & ortaggi", "Frutta", "Carne & pesce", "Latticini & uova", "Condimenti & oli", "Bevande", "Altro"
- quantity: numero (default 1 se non specificato esplicitamente)
- unit: ESATTAMENTE uno tra: "g", "kg", "ml", "L", "pz", "conf"
  Regole: liquidi (acqua, succhi, latte) → ml o L; prodotti a peso (carne, frutta) → g o kg; confezioni (pasta, riso, biscotti) → conf; prodotti sfusi (uova, frutta) → pz
- price: prezzo unitario in euro come numero decimale (es. 1.49), oppure null se non leggibile

Ignora articoli NON alimentari: detersivi, cosmetici, sacchetti, igiene personale, tabacchi.
Se il totale non è un articolo, ignoralo.
Rispondi SOLO con JSON valido, nessun testo aggiuntivo, nessun commento.

Formato risposta:
{"items":[{"name":"Pasta","category":"Cereali & pasta","quantity":1,"unit":"conf","price":1.29}]}`;

// ─── Tipi interni ─────────────────────────────────────────────────────────────

type RawItem = {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cleanJSON(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function getMediaType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const supported: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
  };
  return supported[file.type] ?? 'image/jpeg';
}

function findExistingItem(name: string, pantryItems: PantryItem[]): PantryItem | undefined {
  const norm = normalizeName(name);
  return (
    pantryItems.find(p => normalizeName(p.name) === norm) ??
    pantryItems.find(p => {
      const pn = normalizeName(p.name);
      return pn.includes(norm) || norm.includes(pn);
    })
  );
}

// ─── Parsing singola immagine ─────────────────────────────────────────────────

async function parseOneImage(
  client: Anthropic,
  file: File
): Promise<RawItem[]> {
  const base64 = await fileToBase64(file);
  const mediaType = getMediaType(file);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: RECEIPT_PROMPT },
        ],
      },
    ],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return [];

  try {
    const parsed = JSON.parse(cleanJSON(textBlock.text));
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    console.warn('Receipt JSON parse failed:', textBlock.text);
    return [];
  }
}

// ─── Deduplicazione ───────────────────────────────────────────────────────────

function deduplicateItems(items: RawItem[]): RawItem[] {
  const map = new Map<string, RawItem>();
  for (const item of items) {
    const key = normalizeName(item.name);
    if (map.has(key)) {
      const existing = map.get(key)!;
      map.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        price: existing.price ?? item.price,
      });
    } else {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

// ─── Funzione principale ──────────────────────────────────────────────────────

export async function parseReceiptImages(
  apiKey: string,
  files: File[],
  existingPantryItems: PantryItem[],
  onProgress: (done: number, total: number) => void
): Promise<ReceiptParsedItem[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let done = 0;
  const rawResults = await Promise.all(
    files.map(async file => {
      const items = await parseOneImage(client, file);
      done++;
      onProgress(done, files.length);
      return items;
    })
  );

  const allRaw = rawResults.flat();
  const deduplicated = deduplicateItems(allRaw);

  return deduplicated.map(raw => {
    const existing = findExistingItem(raw.name, existingPantryItems);
    return {
      id: crypto.randomUUID(),
      name: raw.name,
      category: (raw.category as PantryCategory) ?? 'Altro',
      quantity: raw.quantity > 0 ? raw.quantity : 1,
      unit: (raw.unit as PantryUnit) ?? 'pz',
      price: raw.price ?? undefined,
      include: true,
      existingPantryItemId: existing?.id,
    } satisfies ReceiptParsedItem;
  });
}
