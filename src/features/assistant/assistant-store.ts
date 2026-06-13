import { create } from 'zustand';
import { cerebrasChat, isCerebrasConfigured, type ChatMessage } from '../../lib/cerebras';
import { ASSISTANT_TOOL_DEFINITIONS, executeTool } from './assistant-tools';
import { toLocalDateString } from '../journal/journal-helpers';

// What we show in the UI (a cleaned-up view of the conversation).
export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // human-readable list of actions the assistant took on this turn
  actions?: string[];
}

interface AssistantStore {
  open: boolean;
  messages: UiMessage[];
  sending: boolean;
  error: string | null;
  // full wire history (includes system + tool messages) kept separately
  history: ChatMessage[];

  setOpen: (open: boolean) => void;
  toggle: () => void;
  clear: () => void;
  send: (text: string) => Promise<void>;
}

const MAX_TOOL_ROUNDS = 5;

function systemPrompt(): string {
  return [
    'You are the in-app assistant for SynCatch, a personal productivity app.',
    `Today is ${toLocalDateString(new Date())}.`,
    'The app has Missions (projects), Tasks (with lanes: inbox/now/next/later/done), Focus sessions (timers), and a Journal (best_moment, manifestation, regret, lesson + daily mood/gratitude).',
    'You can take real actions using the provided tools — create/update/complete/delete tasks, manage missions, log journal entries, set mood/gratitude, and start/stop focus sessions.',
    'Guidance:',
    '- When the user asks to change data, USE the tools rather than just describing what to do.',
    '- To act on an existing task, first call list_tasks (or get_today_summary) to find its id, then act.',
    '- Confirm what you did in one short, friendly sentence. Do not invent data you did not retrieve.',
    '- If a request is ambiguous or destructive (delete), ask a brief clarifying question instead of guessing.',
  ].join('\n');
}

function describeAction(name: string, result: unknown): string {
  const r = (result ?? {}) as Record<string, any>;
  if (r.error) return `⚠️ ${name}: ${r.error}`;
  switch (name) {
    case 'create_task': return `Created task “${r.title}”`;
    case 'complete_task': return `Completed “${r.title}”`;
    case 'update_task': return `Updated “${r.title}”`;
    case 'delete_task': return `Deleted “${r.title}”`;
    case 'create_mission': return `Created mission “${r.title}”`;
    case 'create_journal_entry': return `Logged a ${String(r.kind).replace('_', ' ')} entry`;
    case 'set_mood_and_gratitude': return `Saved mood/gratitude for ${r.entry_date}`;
    case 'start_focus_session': return `Started focus on “${r.task}” (${r.minutes}m)`;
    case 'stop_focus_session': return `Stopped the focus session`;
    default: return '';
  }
}

let idCounter = 0;
const nextId = () => `msg-${Date.now()}-${idCounter++}`;

export const useAssistantStore = create<AssistantStore>((set, get) => ({
  open: false,
  messages: [],
  sending: false,
  error: null,
  history: [],

  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  clear: () => set({ messages: [], history: [], error: null }),

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().sending) return;

    if (!isCerebrasConfigured()) {
      set({ error: 'AI is not configured. Add VITE_CEREBRAS_API_KEY to .env.local and restart.' });
      return;
    }

    const userMsg: UiMessage = { id: nextId(), role: 'user', content: trimmed };
    // seed the wire history with a system prompt on first turn
    const baseHistory = get().history.length === 0
      ? [{ role: 'system', content: systemPrompt() } as ChatMessage]
      : get().history;

    const history: ChatMessage[] = [...baseHistory, { role: 'user', content: trimmed }];

    set((s) => ({
      messages: [...s.messages, userMsg],
      sending: true,
      error: null,
      history,
    }));

    const actions: string[] = [];

    try {
      let rounds = 0;
      let finalText = '';

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const result = await cerebrasChat(history, ASSISTANT_TOOL_DEFINITIONS);

        // record the assistant turn (with any tool calls) in wire history
        history.push({
          role: 'assistant',
          content: result.content,
          tool_calls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
        });

        if (result.toolCalls.length === 0) {
          finalText = result.content ?? '';
          break;
        }

        // execute each requested tool and append results
        for (const call of result.toolCalls) {
          let args: Record<string, any> = {};
          try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            args = {};
          }
          const toolResult = await executeTool(call.function.name, args);
          const label = describeAction(call.function.name, toolResult);
          if (label) actions.push(label);
          history.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(toolResult),
          });
        }
      }

      if (!finalText) {
        finalText = actions.length > 0 ? 'Done.' : 'I couldn\'t complete that — try rephrasing.';
      }

      set((s) => ({
        messages: [
          ...s.messages,
          { id: nextId(), role: 'assistant', content: finalText, actions: actions.length ? actions : undefined },
        ],
        sending: false,
        history,
      }));
    } catch (error) {
      set((s) => ({
        sending: false,
        error: error instanceof Error ? error.message : 'Assistant failed',
        messages: [
          ...s.messages,
          {
            id: nextId(),
            role: 'assistant',
            content: 'Something went wrong reaching the AI service.',
            actions: actions.length ? actions : undefined,
          },
        ],
      }));
    }
  },
}));
