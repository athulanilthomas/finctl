export const categoryLabels = {
  dining: 'Food & dining',
  groceries: 'Groceries',
  shopping: 'Shopping',
  transport: 'Transport & fuel',
  travel: 'Travel',
  bills: 'Bills & utilities',
  entertainment: 'Entertainment',
  health: 'Health',
  education: 'Education',
  housing: 'Housing',
  installments: 'Installments',
  uncategorized: 'Uncategorized',
} as const

export type Category = keyof typeof categoryLabels

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && Object.hasOwn(categoryLabels, value)
}

export const categories = Object.keys(categoryLabels).filter(isCategory)

const merchantRules: [Category, RegExp][] = [
  ['groceries', /\b(?:instamart|blinkit|zepto|big\s?basket|dmart|jiomart|grocery|groceries|supermarket)\b/i],
  ['entertainment', /\b(?:netflix|spotify|hotstar|bookmyshow|amazon prime|prime video|pvr)\b/i],
  ['dining', /\b(?:swiggy|zomato|starbucks|dominos|domino's|mcdonald'?s|cafe|restaurant|pizzeria|bakery)\b/i],
  ['transport', /\b(?:uber|ola cabs|ola money|rapido|fastag|indian oil|iocl|bharat petroleum|hpcl|petrol|fuel)\b/i],
  ['travel', /\b(?:irctc|makemytrip|goibibo|air india|indigo airlines|airbnb|booking\.com|hotel|airways)\b/i],
  ['bills', /\b(?:airtel|jio recharge|reliance jio|act fibernet|bescom|electricity|broadband|mobile recharge)\b/i],
  ['health', /\b(?:pharmacy|hospital|medplus|netmeds|pharmeasy|diagnostics|clinic)\b/i],
  ['education', /\b(?:udemy|coursera|school fees|tuition)\b/i],
  ['housing', /\b(?:rent payment|housing rent)\b/i],
  ['installments', /\b(?:emi principal|principal amount emi)\b/i],
  ['shopping', /\b(?:amazon(?! pay\b)|amzn|flipkart|myntra|ajio|nykaa|ikea|decathlon)\b/i],
]

export function stripMerchantMetadata(description: string) {
  return description
    .replace(/^(?:UPI|POS|ECOM)\s*[-:/ ]\s*/i, '')
    .replace(/\(\s*(?:REF|REFERENCE|UTR|RRN|TXN|AUTH)\b[^)]*\)/gi, ' ')
    .replace(/\s+\b(?:REF|REFERENCE|UTR|RRN|TXN|AUTH|MID|TID)\s*[:#-]?\s*[A-Z0-9-]*\d[A-Z0-9-]*\s*$/i, '')
    .replace(/\s+\b(?:USD|EUR|GBP|AED|AUD|CAD|SGD|JPY|INR)\s+[\d,.]+$/i, '')
    .replace(/\s+\d{5,}$/g, '')
    .replace(/\s+(?:POS|ECOM)\s*$/i, '')
}

export function merchantKey(description: string) {
  return stripMerchantMetadata(description.normalize('NFKC').trim())
    .replace(/\b(?:ref|txn|utr)\s*[:#-]?\s*\d+\b/gi, ' ')
    .replace(/[\w.+-]+@[\w.-]+|\b\d{5,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .toUpperCase()
}

export function categorize(merchant: string): Category {
  return merchantRules.find(([, pattern]) => pattern.test(merchant))?.[0] ?? 'uncategorized'
}
