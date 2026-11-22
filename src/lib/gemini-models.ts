export const defaultGeminiModel = 'gemini-3.5-flash-lite'
export const geminiModelHeader = 'x-finctl-gemini-model'

export const geminiModels = {
  [defaultGeminiModel]: {
    name: '3.5 Flash-Lite',
    cost: 'Low cost',
    rates: '$0.30 input · $2.50 output',
    paidOnly: false,
    thinkingLevel: 'MINIMAL',
    maxOutputTokens: 256,
  },
  'gemini-4-hydrogen': {
    name: '4 Hydrogen',
    cost: 'Medium cost',
    rates: '$1.50 input · $7.50 output',
    paidOnly: false,
    thinkingLevel: 'LOW',
    maxOutputTokens: 1024,
  },
  'gemini-4-neon': {
    name: '4 Neon',
    cost: 'High cost',
    rates: '$3.00 input · $15.00 output',
    paidOnly: true,
    thinkingLevel: 'LOW',
    maxOutputTokens: 1024,
  },
} as const

export type GeminiModel = keyof typeof geminiModels

export function isGeminiModel(model: string): model is GeminiModel {
  return Object.hasOwn(geminiModels, model)
}
