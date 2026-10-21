import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { TraderJourneyPassport } from './TraderJourneyPassport';
import { TradigoLogo } from './TradigoLogo';
import LiveRoomPage from '../LiveRoomPage';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(() => new Promise(() => {})),
  },
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ canonicalUser: null })),
}));

const currentDir = dirname(fileURLToPath(import.meta.url));
const readProjectFile = (relativePath: string) => readFileSync(resolve(currentDir, relativePath), 'utf8');
const indexCss = readProjectFile('../../index.css');
const passportCss = readProjectFile('./tradigo-passport.css');
const liveRoomSource = readProjectFile('../LiveRoomPage.tsx');
const indexHtml = readProjectFile('../../../index.html');
const brandMarkSvg = readProjectFile('../../../public/brand-mark.svg');
const faviconSvg = readProjectFile('../../../public/favicon.svg');

const passportSession = {
  coachName: 'Maya Chen',
  topic: 'Reading market structure',
  durationMinutes: 30,
  scheduledAt: '2026-08-25T12:00:00.000Z',
  learningRecord: {
    learningGoal: 'Slow down before entering a position',
    conceptsReviewed: 'Structure and invalidation',
    evidenceDiscussed: 'Two marked-up examples',
    practiceSteps: 'Annotate one chart before the next session',
  },
};

const originalMatchMedia = window.matchMedia;

function setTheme(theme: 'light' | 'dark') {
  document.documentElement.className = theme;
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const lightest = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darkest = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lightest + 0.05) / (darkest + 0.05);
}

function themeToken(themeBlock: string, token: string) {
  const value = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`).exec(themeBlock)?.[1];
  expect(value, `${token} must be a six-digit color token`).toBeTruthy();
  return value!;
}

describe('Live Point brand visual contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
    document.documentElement.className = '';
    window.matchMedia = originalMatchMedia;
  });

  it.each(['light', 'dark'] as const)('keeps the Signal mark and wordmark present in the %s theme', (theme) => {
    setTheme(theme);
    render(<TradigoLogo />);

    expect(screen.getByRole('img', { name: 'Tradigo live point mark' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tradigo')).toHaveTextContent('tradigo');
    expect(document.documentElement).toHaveClass(theme);

    const themeBlock = theme === 'light'
      ? /:root\s*\{([\s\S]*?)\n\s*\}/.exec(indexCss)?.[1]
      : /\.dark\s*\{([\s\S]*?)\n\s*\}/.exec(indexCss)?.[1];
    expect(themeBlock).toBeTruthy();
    expect(themeBlock).toContain('--brand-blue:');
    expect(themeBlock).toContain('--brand-coral:');
    expect(themeBlock).toContain('--primary: var(--brand-blue)');

    const blue = themeToken(themeBlock!, '--brand-blue');
    const coral = themeToken(themeBlock!, '--brand-coral');
    const background = themeToken(themeBlock!, '--background');
    expect(contrastRatio(blue, background)).toBeGreaterThanOrEqual(theme === 'light' ? 2.8 : 4.5);
    expect(contrastRatio(coral, background)).toBeGreaterThanOrEqual(theme === 'light' ? 2.8 : 4.5);
  });

  it('keeps the passport mark and shared blue/coral token bridge intact', () => {
    render(<TraderJourneyPassport session={passportSession} />);

    expect(document.querySelector('.tg-passport-cover-mark')).toBeInTheDocument();
    expect(passportCss).toContain('--tg-brass:var(--brand-blue,#2c8af2)');
    expect(passportCss).toContain('--tg-coral:var(--brand-coral,#f5695d)');
  });

  it('keeps blue and coral assigned to the live-room loading context', () => {
    render(
      <MemoryRouter initialEntries={['/sessions/session-1/live']}>
        <Routes>
          <Route path="/sessions/:sessionId/live" element={<LiveRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('status-room-loading')).toBeInTheDocument();
    expect(liveRoomSource).toContain('text-[var(--room-blue)]');
    expect(liveRoomSource).toContain('text-[var(--room-coral)]');
    expect(indexCss).toContain('--room-blue: var(--brand-blue)');
    expect(indexCss).toContain('--room-coral: var(--brand-coral)');
    expect(apiClient.get).toHaveBeenCalledWith('/api/sessions/session-1');
    expect(useAuthStore).toHaveBeenCalled();
  });

  it('keeps both public SVG assets on the approved Signal palette', () => {
    for (const svg of [brandMarkSvg, faviconSvg]) {
      expect(svg).toMatch(/<svg\b/);
      expect(svg).toContain('#2C8AF2');
      expect(svg).toContain('#F5695D');
    }

    expect(faviconSvg).toMatch(/<svg[^>]+width="180"[^>]+height="180"/);
    expect(faviconSvg).toContain('fill="#0A172C"');
    expect(indexHtml.match(/rel="icon"/g)).toHaveLength(1);
    expect(indexHtml).toContain('href="/favicon.svg"');
  });
});