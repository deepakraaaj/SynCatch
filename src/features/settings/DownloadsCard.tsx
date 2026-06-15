import { useEffect, useState } from 'react';
import {
  Smartphone,
  MonitorDown,
  Terminal,
  Download,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { cn } from '../../lib/cn';
import { isTauriApp } from '../../lib/tauri';

const REPO = 'deepakraaaj/SynCatch';
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

type PlatformId = 'android' | 'windows' | 'linux';

interface PlatformMeta {
  id: PlatformId;
  label: string;
  fileLabel: string;
  /** Matches the release asset filename so we can resolve the latest URL. */
  matches: (assetName: string) => boolean;
  icon: typeof Smartphone;
  steps: string[];
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: 'android',
    label: 'Android',
    fileLabel: 'APK',
    matches: (name) => name.endsWith('.apk'),
    icon: Smartphone,
    steps: [
      'Download the .apk to your phone (or scan the QR code below).',
      'Open it — Android will ask to allow installs from this source.',
      'Tap “Install”, then open SynCatch from your app drawer.',
    ],
  },
  {
    id: 'windows',
    label: 'Windows',
    fileLabel: 'EXE',
    matches: (name) => name.endsWith('.exe'),
    icon: MonitorDown,
    steps: [
      'Download the .exe setup file.',
      'Run it — if SmartScreen appears, click “More info” → “Run anyway”.',
      'Follow the installer, then launch SynCatch from the Start menu.',
    ],
  },
  {
    id: 'linux',
    label: 'Linux',
    fileLabel: 'DEB',
    matches: (name) => name.endsWith('.deb'),
    icon: Terminal,
    steps: [
      'Download the .deb package.',
      'Install it: sudo apt install ./SynCatch_*.deb',
      'Launch SynCatch from your applications menu.',
    ],
  },
];

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ResolvedRelease {
  version: string;
  urls: Partial<Record<PlatformId, string>>;
}

function qrSrc(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(data)}`;
}

export function DownloadsCard() {
  const onWeb = !isTauriApp();
  const [release, setRelease] = useState<ResolvedRelease | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openGuide, setOpenGuide] = useState<PlatformId | null>(null);
  const [copied, setCopied] = useState<PlatformId | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
        const data = (await res.json()) as { tag_name?: string; assets?: ReleaseAsset[] };
        const assets = data.assets ?? [];

        const urls: Partial<Record<PlatformId, string>> = {};
        for (const platform of PLATFORMS) {
          const asset = assets.find((a) => platform.matches(a.name.toLowerCase()));
          if (asset) urls[platform.id] = asset.browser_download_url;
        }

        if (!cancelled) {
          setRelease({ version: data.tag_name ?? 'latest', urls });
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const apkUrl = release?.urls.android;
  const versionLabel = release?.version ?? (loadFailed ? '' : 'latest');

  const handleCopy = async (id: PlatformId, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600);
    } catch {
      // Clipboard can be blocked; the visible URL stays selectable as a fallback.
    }
  };

  return (
    <Card className="rounded-[34px] p-6">
      <SectionHeading
        title="Get the apps"
        detail={
          versionLabel
            ? `Latest release ${versionLabel} · install SynCatch on every device`
            : 'Install SynCatch on every device'
        }
        action={
          <a
            className="inline-flex items-center gap-1.5 rounded-full border border-borderSoft/40 bg-panel/60 px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-borderStrong/40 hover:text-text-primary"
            href={RELEASES_PAGE}
            target="_blank"
            rel="noreferrer"
          >
            All releases
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          const url = release?.urls[platform.id];
          const guideOpen = openGuide === platform.id;

          return (
            <div
              key={platform.id}
              className="flex flex-col rounded-[24px] border border-borderSoft/30 bg-panel/32 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{platform.label}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                    {platform.fileLabel}
                  </p>
                </div>
              </div>

              {url ? (
                <p className="mt-3 truncate font-mono text-[11px] text-text-muted" title={url}>
                  {url.replace('https://', '')}
                </p>
              ) : (
                <p className="mt-3 text-[11px] text-text-muted">
                  {loadFailed ? 'Couldn’t reach GitHub — open all releases.' : 'Resolving latest…'}
                </p>
              )}

              {/* On the web build there's no native installer to launch — lead with a
                  big scan-to-install QR; the download link is the small fallback. */}
              {onWeb && platform.id === 'android' && apkUrl ? (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-[18px] border border-borderSoft/20 bg-white/5 p-3">
                  <div className="flex aspect-square w-full max-w-[200px] items-center justify-center overflow-hidden rounded-[16px] bg-white p-2">
                    <img
                      alt="QR code to download the SynCatch Android app"
                      className="h-full w-full"
                      src={qrSrc(apkUrl)}
                    />
                  </div>
                  <p className="text-center text-xs text-text-secondary">
                    Scan with your phone’s camera to install
                  </p>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => window.open(url ?? RELEASES_PAGE, '_blank', 'noopener')}
                  size="sm"
                  type="button"
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download
                </Button>
                {url ? (
                  <Button
                    onClick={() => void handleCopy(platform.id, url)}
                    size="sm"
                    type="button"
                    variant="secondary"
                    aria-label={`Copy ${platform.label} download link`}
                  >
                    {copied === platform.id ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                ) : null}
              </div>

              <button
                className="mt-3 flex items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                onClick={() => setOpenGuide(guideOpen ? null : platform.id)}
                type="button"
                aria-expanded={guideOpen}
              >
                How to install
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', guideOpen && 'rotate-180')}
                />
              </button>

              {guideOpen ? (
                <ol className="mt-2 space-y-1.5 border-t border-borderSoft/20 pt-2 text-xs text-text-secondary">
                  {platform.steps.map((step, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="font-mono text-text-muted">{index + 1}.</span>
                      <span className="min-w-0 break-words">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-bold text-text-primary sm:text-lg">{title}</h2>
        {detail ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary sm:text-sm">{detail}</p>
        ) : null}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
