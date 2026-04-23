import Anthropic from '@anthropic-ai/sdk';
import type { Meal, MealIngredient, UserProfile } from '../types';

function getEffectiveIngredients(meal: Meal): MealIngredient[] {
  return meal.ingredients.map(ing => {
    const sub = meal.substitutions.find(s => s.originalIngredient.name === ing.name);
    return sub ? sub.replacementIngredient : ing;
  });
}

const DIET_LABELS: Record<string, string> = {
  onnivoro: 'onnivoro',
  vegetariano: 'vegetariano',
  vegano: 'vegano',
  pescetariano: 'pescetariano',
  flexitariano: 'flexitariano',
};

function buildPrompt(meal: Meal, profile: UserProfile, servings: number): string {
  const ingredients = getEffectiveIngredients(meal);
  const ingredientList = ingredients
    .map(i => `- ${i.name}: ${i.quantity} ${i.unit}`)
    .join('\n');

  const profileParts: string[] = [];
  if (profile.diet) profileParts.push(`Tipo di dieta: ${DIET_LABELS[profile.diet] ?? profile.diet}`);
  if (profile.intolleranze.length > 0) profileParts.push(`Intolleranze/allergie: ${profile.intolleranze.join(', ')}`);
  if (profile.obiettivi.length > 0) profileParts.push(`Obiettivi nutrizionali: ${profile.obiettivi.join(', ')}`);

  const profileSection = profileParts.length > 0
    ? `\n\n**Profilo dell'utente:**\n${profileParts.join('\n')}\nAdatta la ricetta rispettando rigorosamente le intolleranze e le preferenze dietetiche indicate.`
    : '';

  return `Sei un nutrizionista e chef esperto. Crea una ricetta dettagliata e appetitosa per il seguente pasto del piano alimentare:

**Pasto**: ${meal.name}

**Ingredienti disponibili**:
${ingredientList}${profileSection}

La ricetta deve essere per **${servings} person${servings === 1 ? 'a' : 'e'}**. Adatta le quantità di tutti gli ingredienti di conseguenza.

Rispondi in italiano. USA SOLO questo formato — è vietato usare tabelle markdown, simboli |, o HTML:

## ⏱ Preparazione
Una riga sintetica: tempo prep, cottura, difficoltà. Esempio: "Prep: 10 min · Cottura: 20 min · Facile"

## 🧂 Ingredienti
Lista puntata con trattino per ogni ingrediente, quantità precise per ${servings} person${servings === 1 ? 'a' : 'e'}:
- 180 g petto di pollo
- 1 cucchiaio olio EVO
Se ci sono sostituzioni rispetto al piano originale, scrivi "(sostituito)" accanto all'ingrediente.

## 👨‍🍳 Procedimento
Passaggi numerati (1. 2. 3. ...) chiari e dettagliati. Includi temperature e tempi di cottura.

## 💡 Consigli
Due o tre suggerimenti puntati (-) su presentazione, varianti o conservazione.`;
}

export async function* generateRecipe(
  apiKey: string,
  meal: Meal,
  profile: UserProfile,
  servings = 2,
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: buildPrompt(meal, profile, servings),
      },
    ],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
