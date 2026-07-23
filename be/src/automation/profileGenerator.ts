const CHROME_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

export type GeneratedProfileInput = {
  name: string;
  userAgent?: string;
  proxyUrl?: string;
  viewportWidth?: number;
  viewportHeight?: number;
};

export function parseProxyLines(text?: string): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function generateProfiles(options: {
  count: number;
  namePrefix: string;
  proxyLines?: string[];
  randomizeFingerprint?: boolean;
}): GeneratedProfileInput[] {
  const { count, namePrefix, proxyLines = [], randomizeFingerprint = true } = options;
  const profiles: GeneratedProfileInput[] = [];

  for (let i = 1; i <= count; i += 1) {
    const viewport = VIEWPORTS[(i - 1) % VIEWPORTS.length];
    const userAgent = CHROME_USER_AGENTS[(i - 1) % CHROME_USER_AGENTS.length];
    const proxyUrl = proxyLines.length ? proxyLines[(i - 1) % proxyLines.length] : undefined;

    profiles.push({
      name: `${namePrefix.trim()} ${i}`,
      ...(randomizeFingerprint
        ? {
            userAgent,
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
          }
        : {}),
      ...(proxyUrl ? { proxyUrl } : {}),
    });
  }

  return profiles;
}
