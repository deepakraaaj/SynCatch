import { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/button';
import { useAssistantStore } from './assistant-store';

const SUGGESTIONS = [
  'What did I do today?',
  'Add a task to review the budget tomorrow',
  'Start a 25 minute focus on my top task',
  'Log a best moment: shipped the new feature',
];

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const messages = useAssistantStore((s) => s.messages);
  const sending = useAssistantStore((s) => s.sending);
  const error = useAssistantStore((s) => s.error);
  const send = useAssistantStore((s) => s.send);
  const clear = useAssistantStore((s) => s.clear);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const submit = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    void send(text);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary">Talk to MissionControl</p>
              <p className="mt-1 text-[13px] text-text-secondary/70 max-w-xs">
                Ask about your day, or tell me to create tasks, start a focus timer, or log your journal.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-borderSoft/30 bg-panel/40 px-3 py-1.5 text-[12px] font-medium text-text-secondary/80 transition-colors hover:border-accent/40 hover:text-text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed',
                m.role === 'user'
                  ? 'bg-accent text-accent-contrast rounded-br-md'
                  : 'bg-panel/60 border border-borderSoft/25 text-text-primary rounded-bl-md',
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-borderSoft/20 pt-2">
                  {m.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[12px] text-text-secondary/80">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-borderSoft/25 bg-panel/60 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted/70"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-borderSoft/25 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message your assistant…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-borderSoft/30 bg-panel/40 px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted/50 focus:border-accent/40 focus:outline-none"
          />
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={!input.trim() || sending}
            className="h-11 w-11 shrink-0 rounded-2xl p-0"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {messages.length > 0 && !compact && (
          <button
            type="button"
            onClick={clear}
            className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-text-muted/60 transition-colors hover:text-danger"
          >
            <Trash2 className="h-3 w-3" /> Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}
