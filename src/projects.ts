export interface ProjectConfig {
  slug: string;
  title: string;
  description: string;
  spa?: boolean;
  vanity?: string;
  emoji: string;
}

export const PROJECTS: ProjectConfig[] = [
  {
    slug: 'tusk',
    title: 'tusk',
    description: 'A k9s-style terminal UI for real-time PostgreSQL monitoring and management.',
    emoji: '🐘',
  },
  {
    slug: 'inferenced',
    title: 'inferenced',
    description: 'Developer endpoint management for the AI era — observe, govern, and optimize inference.',
    emoji: '⚡',
  },
  {
    slug: 'pickleball',
    title: 'pickleball',
    description: 'Tournament scheduler — generate optimally balanced rounds for any number of players.',
    spa: true,
    emoji: '🏓',
  },
];
