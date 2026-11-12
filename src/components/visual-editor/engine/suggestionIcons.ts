import type { Icon } from '@wikimedia/codex-icons'
import {
  cdxIconImage,
  cdxIconLink,
  cdxIconPuzzle,
  cdxIconQuotes,
  cdxIconRobot,
  cdxIconTextStyle,
} from '@wikimedia/codex-icons'

import type { SuggestionTypeId } from './checks'

/**
 * Writing & tone (new, not in Codex): text lines with a pencil. Drawn on the
 * Codex 20×20 grid, single-colour fill, 2px strokes, like the Codex icons.
 */
export const cdxIconWritingTone: Icon =
  '<path d="M1 3h12v2H1zm0 5h9v2H1zm0 5h5v2H1z"/><path d="m16.6 7.4 2 2-1.6 1.6-2-2zm-3 3 2 2-5.4 5.4-2.7.7.7-2.7z"/>'

export type SuggestionCategory = 'citations' | 'links' | 'formatting' | 'images' | 'writing' | 'ai' | 'templates'

/** Contextual icon per category ("Contextual icons" in Mock settings → Other settings). */
export const CATEGORY_ICONS: Record<SuggestionCategory, Icon> = {
  citations: cdxIconQuotes,
  links: cdxIconLink,
  formatting: cdxIconTextStyle,
  images: cdxIconImage,
  writing: cdxIconWritingTone,
  ai: cdxIconRobot,
  templates: cdxIconPuzzle,
}

export const SUGGESTION_CATEGORY: Record<SuggestionTypeId, SuggestionCategory> = {
  addReference: 'citations',
  citationNeeded: 'citations',
  convertReference: 'citations',
  disambiguation: 'links',
  duplicateLink: 'links',
  externalLink: 'links',
  suggestedLink: 'links',
  yearLink: 'links',
  redirect: 'links',
  doubleBold: 'formatting',
  headingLevel: 'formatting',
  fakeHeading: 'formatting',
  imageCaption: 'images',
  'textMatch-cliches': 'writing',
  'textMatch-relative-time-ref': 'writing',
  'textMatch-editorializing': 'writing',
  tone: 'writing',
  leadLength: 'writing',
  'textMatch-potential-LLM': 'ai',
  llmSuggestion: 'ai',
  requiredTemplateParam: 'templates',
}

export function contextualIcon(type: string): Icon | null {
  const category = SUGGESTION_CATEGORY[type as SuggestionTypeId]
  return category ? CATEGORY_ICONS[category] : null
}
