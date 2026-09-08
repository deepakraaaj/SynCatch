import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';
export type ToastActionType = 'save' | 'delete' | 'create' | 'update' | 'info' | 'error';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: ToastActionType;
  durationMs?: number;
}

export interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
  action: ToastActionType;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const toastTimers = new Map<string, number>();

function getToastId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clearToastTimer(id: string) {
  const timer = toastTimers.get(id);
  if (timer) {
    window.clearTimeout(timer);
    toastTimers.delete(id);
  }
}

function scheduleToastRemoval(id: string, durationMs: number) {
  clearToastTimer(id);
  const timer = window.setTimeout(() => {
    useToastStore.getState().dismiss(id);
  }, durationMs);
  toastTimers.set(id, timer);
}

function inferAction(input: ToastInput): ToastActionType {
  if (input.action) return input.action;
  const lower = input.title.toLowerCase();
  if (lower.includes('delet') || lower.includes('remov')) return 'delete';
  if (lower.includes('sav') || lower.includes('done')) return 'save';
  if (lower.includes('creat') || lower.includes('add') || lower.includes('new')) return 'create';
  if (lower.includes('updat') || lower.includes('edit')) return 'update';
  if (input.tone === 'error') return 'error';
  return 'info';
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (toast) => {
    const action = inferAction(toast);
    const item: ToastItem = {
      id: getToastId(),
      title: toast.title,
      description: toast.description,
      tone:
        toast.tone
        ?? (action === 'create' || action === 'save' ? 'success' : action === 'error' ? 'error' : 'info'),
      action,
      durationMs:
        toast.durationMs
        ?? (toast.tone === 'error' ? 5200 : toast.tone === 'success' ? 3400 : 3800),
    };

    set((state) => ({
      toasts: [...state.toasts, item].slice(-4),
    }));
    scheduleToastRemoval(item.id, item.durationMs);

    return item.id;
  },

  dismiss: (id) => {
    clearToastTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  clear: () => {
    toastTimers.forEach((timer) => window.clearTimeout(timer));
    toastTimers.clear();
    set({ toasts: [] });
  },
}));

export function showToast(toast: ToastInput) {
  return useToastStore.getState().push(toast);
}

export function showSuccessToast(title: string, description?: string) {
  return showToast({ title, description, tone: 'success' });
}

export function showInfoToast(title: string, description?: string) {
  return showToast({ title, description, tone: 'info' });
}

export function showErrorToast(title: string, description?: string) {
  return showToast({ title, description, tone: 'error' });
}

export function showDeleteToast(title: string, description?: string) {
  return showToast({ title, description, tone: 'info', action: 'delete' });
}

