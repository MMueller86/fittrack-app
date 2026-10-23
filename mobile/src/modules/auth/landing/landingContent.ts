export interface LandingSlideContent {
  id: 'capture' | 'recipes' | 'progress' | 'insights';
  lead: string;
  accent: string;
  body: string;
}

export const LANDING_SLIDES: readonly LandingSlideContent[] = [
  {
    id: 'capture',
    lead: 'Weniger tippen.',
    accent: 'Mehr genießen.',
    body: 'Beschreib deine Mahlzeit.\nDie KI schätzt die Nährwerte für dich.',
  },
  {
    id: 'recipes',
    lead: 'Dein Geschmack.',
    accent: 'Deine Rezeptsammlung.',
    body: 'Eigene Rezepte und Community-Ideen.\nDirekt ins Tagebuch übernehmen.',
  },
  {
    id: 'progress',
    lead: 'Heute im Blick.',
    accent: 'Dein Ziel im Fokus.',
    body: 'Kalorien, Makros und Gewicht.\nEntdecke deinen Fortschritt.',
  },
  {
    id: 'insights',
    lead: 'Mehr als Zahlen.',
    accent: 'Dein Aha-Moment.',
    body: 'Deine KI-Insights für Tag und Woche.\nVerstehe, was für dich funktioniert.',
  },
];
