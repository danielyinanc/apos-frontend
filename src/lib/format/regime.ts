export type Tone = 'positive' | 'negative' | 'neutral' | 'caution';

// The one legitimate place pack vocabulary appears: a map from observed
// regime VALUE literals to a neutral tone, with an unconditional fallback.
// It does not branch on pack id or capability id, so a pack this map has
// never seen still renders (as 'neutral'), it just doesn't get color-coded.
const TONE: Record<string, Tone> = {
  bull: 'positive',
  rising: 'positive',
  bear: 'negative',
  falling: 'negative',
  neutral: 'neutral',
  tightening: 'caution',
};

export function toneOf(value: string): Tone {
  return TONE[value.toLowerCase()] ?? 'neutral';
}
