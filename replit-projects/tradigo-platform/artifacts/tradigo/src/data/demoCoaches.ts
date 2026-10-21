import { CoachMarketplaceDTO } from '../types';

/**
 * A small local catalog keeps the marketplace useful while infrastructure is
 * being configured. The API takes over automatically as soon as it returns
 * real marketplace records.
 */
export const demoCoaches: CoachMarketplaceDTO[] = [
  {
    id: 'demo-coach-maya',
    displayName: 'Maya Chen',
    avatarUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=256&q=80',
    headline: 'Structure-first price action coach',
    bio: 'I help traders replace impulsive entries with a repeatable process for reading structure, planning risk, and reviewing execution.',
    markets: ['FOREX', 'INDICES'],
    supportedInstruments: ['FOREX', 'INDICES'],
    specialties: ['MARKET_STRUCTURE', 'ENTRY_TIMING', 'RISK_MANAGEMENT'],
    languages: ['English', 'Mandarin'],
    yearsOfExperience: 8,
    hourlyRateCents: 14500,
    instantRatePerMinuteCents: 242,
    currency: 'USD',
    verificationStatus: 'FULLY_VERIFIED' as any,
    ratingAverage: 4.9,
    ratingCount: 128,
  },
  {
    id: 'demo-coach-omar',
    displayName: 'Omar Haddad',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&q=80',
    headline: 'Risk management for serious traders',
    bio: 'Build a risk framework that protects your account and gives your best setups room to work. Practical, calm, and journal-driven.',
    markets: ['CRYPTO', 'EQUITIES'],
    supportedInstruments: ['CRYPTO', 'EQUITIES'],
    specialties: ['RISK_MANAGEMENT', 'TRADE_REVIEW', 'PSYCHOLOGY'],
    languages: ['English', 'Arabic'],
    yearsOfExperience: 11,
    hourlyRateCents: 12000,
    instantRatePerMinuteCents: 200,
    currency: 'USD',
    verificationStatus: 'FULLY_VERIFIED' as any,
    ratingAverage: 4.8,
    ratingCount: 94,
  },
  {
    id: 'demo-coach-elena',
    displayName: 'Elena Rossi',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&q=80',
    headline: 'Trade reviews that turn into a playbook',
    bio: 'Bring your charts and journal. We will find the patterns behind your wins and losses, then turn them into clear rules.',
    markets: ['EQUITIES', 'OPTIONS'],
    supportedInstruments: ['EQUITIES', 'OPTIONS'],
    specialties: ['TRADE_REVIEW', 'STRATEGY', 'GENERAL_COACHING'],
    languages: ['English', 'Italian'],
    yearsOfExperience: 6,
    hourlyRateCents: 9500,
    instantRatePerMinuteCents: 158,
    currency: 'USD',
    verificationStatus: 'IDENTITY_VERIFIED' as any,
    ratingAverage: 4.7,
    ratingCount: 67,
  },
  {
    id: 'demo-coach-james',
    displayName: 'James Okafor',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&q=80',
    headline: 'From beginner to confident execution',
    bio: 'A patient guide for traders who want to understand the why behind a setup—not just copy an entry.',
    markets: ['FOREX', 'COMMODITIES'],
    supportedInstruments: ['FOREX', 'COMMODITIES'],
    specialties: ['GENERAL_COACHING', 'MARKET_STRUCTURE', 'PSYCHOLOGY'],
    languages: ['English'],
    yearsOfExperience: 5,
    hourlyRateCents: 8000,
    instantRatePerMinuteCents: 133,
    currency: 'USD',
    verificationStatus: 'IDENTITY_VERIFIED' as any,
    ratingAverage: 4.6,
    ratingCount: 41,
  },
];

export function getDemoCoach(id: string) {
  return demoCoaches.find((coach) => coach.id === id);
}