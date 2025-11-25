const UTF8_NORMALIZATION_MAP: Record<string, string> = {
  '\u00C3\u00C2\u00B3': 'ó',
  '\u00C3\u00C2\u00A9': 'é',
  '\u00C3\u00C2\u00AD': 'í',
  '\u00C3\u00C2\u00A1': 'á',
  '\u00C3\u00C2\u00BA': 'ú',
  '\u00C3\u00C2\u0093': 'Ó',
  '\u00C3\u00C2\u0089': 'É',
  '\u00C3\u00C2\u008D': 'Í',
  '\u00C3\u00C2\u0081': 'Á',
  '\u00C3\u00C2\u009A': 'Ú',
  
  '\u00C3\u00B3': 'ó',
  '\u00C3\u00A9': 'é',
  '\u00C3\u00AD': 'í',
  '\u00C3\u00A1': 'á',
  '\u00C3\u00BA': 'ú',
  '\u00C3\u0093': 'Ó',
  '\u00C3\u0089': 'É',
  '\u00C3\u008D': 'Í',
  '\u00C3\u0081': 'Á',
  '\u00C3\u009A': 'Ú',
  
  '\u00C3\u00C2\u00B1': 'ñ',
  '\u00C3\u00C2\u0091': 'Ñ',
  '\u00C3\u00B1': 'ñ',
  '\u00C3\u0091': 'Ñ',
  
  '\u00C3\u00C2\u00AA': 'ª',
  '\u00C2\u00BA': 'º',
  '\u00C2\u00AA': 'ª',
  
  '\u00C2 ': ' ',
  '\u00C2': '',
  
  '\u00C2\u00B4': "'",
  '\u2018': "'",
  '\u2019': "'",
  '\u201C': '"',
  '\u201D': '"',

  'Andaluc\u00EDa': 'Andalucía',
  'Salobre\u00F1a': 'Salobreña',
  'M\u00E1laga': 'Málaga',
  'C\u00E1diz': 'Cádiz',
  'C\u00F3rdoba': 'Córdoba',
  'Almer\u00EDa': 'Almería',
  'Ja\u00E9n': 'Jaén',

  'Garc\u00EDa': 'García',
  'Mart\u00EDnez': 'Martínez',
  'Rodr\u00EDguez': 'Rodríguez',
  'G\u00F3mez': 'Gómez',
  'S\u00E1nchez': 'Sánchez',
  'L\u00F3pez': 'López',
  'Hern\u00E1ndez': 'Hernández',
  'P\u00E9rez': 'Pérez',

  'n.\u00BA': 'n.º',
  'N.\u00BA': 'N.º',

  '\u00B4\u00B4': '"',
  '``': '"',
  '\uFFFD\uFFFD': '"',
  "''": '"',

  '\u00a0': ' ',
  '\u2013': '-',
  '\u2014': '—',

  '\n': ' ',
  '\r': '',
  '\t': ' '
}

export function normalizeUTF8(text: string): string {
  if (!text) return text

  let normalized = text

  for (const [corrupted, correct] of Object.entries(UTF8_NORMALIZATION_MAP)) {
    normalized = normalized.split(corrupted).join(correct)
  }

  normalized = normalized.normalize('NFC')

  normalized = normalized.replace(/[\x00-\x1F\x7F-\x9F]/g, '')

  normalized = normalized.replace(/\ufffd/g, '')

  normalized = normalized.replace(/\s+/g, ' ')

  normalized = normalized.trim()

  return normalized
}

export function hasCorruptedUTF8(text: string): boolean {
  if (!text) return false

  if (text.includes('\uFFFD') || text.includes('\ufffd')) return true

  for (const corrupted of Object.keys(UTF8_NORMALIZATION_MAP)) {
    if (text.includes(corrupted)) return true
  }

  return false
}

export function normalizeObjectText<T extends Record<string, any>>(
  obj: T,
  fields: Array<keyof T>
): T {
  const normalized = { ...obj }

  for (const field of fields) {
    if (typeof normalized[field] === 'string') {
      normalized[field] = normalizeUTF8(normalized[field] as string) as any
    }
  }

  return normalized
}

export interface NormalizationCorrection {
  from: string
  to: string
}

export interface NormalizationReport {
  hadCorruption: boolean
  corrections: NormalizationCorrection[]
}

export function getNormalizationReport(
  originalText: string,
  normalizedText: string
): NormalizationReport {
  const corrections: NormalizationCorrection[] = []

  if (originalText === normalizedText) {
    return { hadCorruption: false, corrections: [] }
  }

  for (const [corrupted, correct] of Object.entries(UTF8_NORMALIZATION_MAP)) {
    if (originalText.includes(corrupted)) {
      corrections.push({ from: corrupted, to: correct })
    }
  }

  return {
    hadCorruption: true,
    corrections
  }
}
