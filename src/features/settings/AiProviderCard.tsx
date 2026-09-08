import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, Bot, CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { cn } from '../../lib/cn';
import {
  PROVIDERS,
  chatWithProvider,
  getDefaultProviderId,
  getModel,
  isProviderConfigured,
  resolveActiveProvider,
  type ProviderId,
} from '../../lib/ai/client';
import { useSettingsStore } from './settings-store';
import { showErrorToast, showSuccessToast } from '../toasts/toast-store';

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-base font-bold text-text-primary sm:text-lg">{title}</h2>
        {detail ? <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary sm:text-sm">{detail}</p> : null}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

// The assistant can use any configured provider in the registry.
export function AiProviderCard() {
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const setAiProvider = useSettingsStore((s) => s.setAiProvider);

  const { providerId: activeProviderId, model: activeModel } = useMemo(
    () => resolveActiveProvider(aiProvider, aiModel),
    [aiProvider, aiModel],
  );

  const [testingId, setTestingId] = useState<ProviderId | null>(null);
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail'>>({});

  const configuredCount = PROVIDERS.filter((p) => isProviderConfigured(p.id)).length;

  function selectProvider(id: ProviderId) {
    setAiProvider(id, getModel(id));
  }

  function selectModel(id: ProviderId, model: string) {
    setAiProvider(id, model);
  }

  async function testProvider(id: ProviderId, model: string) {
    setTestingId(id);
    try {
      await chatWithProvider(
        id,
        model,
        [{ role: 'user', content: 'Reply with just the word "ok".' }],
        undefined,
        { maxTokens: 16 },
      );
      setTestResult((prev) => ({ ...prev, [id]: 'ok' }));
      showSuccessToast('Connection works', `${PROVIDERS.find((p) => p.id === id)?.label} responded successfully.`);
    } catch (error) {
      setTestResult((prev) => ({ ...prev, [id]: 'fail' }));
      showErrorToast(
        'Connection failed',
        error instanceof Error ? error.message : 'Could not reach the provider.',
      );
    } finally {
      setTestingId(null);
    }
  }

  return (
    <Card className="rounded-[22px] p-3.5 sm:rounded-[24px] sm:p-5">
      <SectionHeading
        action={<Badge tone="accent">{configuredCount} configured</Badge>}
        title="AI assistant"
        detail="Choose between Mistral, Groq, and Gemini using the credentials in .env.local."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const configured = isProviderConfigured(provider.id);
          const active = provider.id === activeProviderId;
          const isDefault = !configured && provider.id === getDefaultProviderId();
          const model = active ? activeModel : getModel(provider.id);
          const result = testResult[provider.id];

          return (
            <div
              key={provider.id}
              className={cn(
                'flex flex-col gap-3 rounded-[17px] border p-3 transition-colors sm:rounded-[20px] sm:p-4',
                active
                  ? 'border-accent/45 bg-accent/8 shadow-[0_16px_38px_rgb(var(--accent)/0.16)]'
                  : 'border-borderSoft/30 bg-panel/32',
              )}
            >
              <button
                type="button"
                onClick={() => configured && selectProvider(provider.id)}
                disabled={!configured}
                className={cn(
                  'flex items-start gap-3 text-left',
                  !configured && 'cursor-not-allowed opacity-60',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                    active ? 'bg-accent/20 text-accent' : 'bg-panel2/70 text-text-muted',
                  )}
                >
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">{provider.label}</p>
                    {active ? (
                      <Badge tone="accent">Active</Badge>
                    ) : isDefault ? null : configured ? null : (
                      <Badge tone="neutral">No key</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-secondary/80">{provider.hint}</p>
                  {!configured && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-warning">
                      <CircleAlert className="h-3 w-3 shrink-0" />
                      {provider.requiresApiKey
                        ? `Set ${provider.id.toUpperCase()}_API_KEY in .env.local`
                        : 'Not reachable — start it locally first'}
                    </p>
                  )}
                </div>
              </button>

              {configured && (
                <div className="flex flex-wrap items-center gap-2 border-t border-borderSoft/20 pt-3">
                  <select
                    value={model}
                    onChange={(e) => selectModel(provider.id, e.target.value)}
                    onClick={() => !active && selectProvider(provider.id)}
                    className="h-9 flex-1 min-w-0 rounded-full border border-borderSoft/35 bg-panel2/70 px-3 text-[12px] text-text-primary outline-none focus:border-accent/40"
                  >
                    {provider.models.includes(model) ? null : <option value={model}>{model}</option>}
                    {provider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={testingId === provider.id}
                    onClick={() => void testProvider(provider.id, model)}
                    className="h-9 shrink-0 rounded-full px-3 text-[12px]"
                  >
                    {testingId === provider.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : result === 'ok' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : result === 'fail' ? (
                      <CircleAlert className="h-3.5 w-3.5 text-danger" />
                    ) : (
                      <Activity className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5">Test</span>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
