import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  List,
  ListOrdered,
  Minus,
  Link2,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '../../lib/cn';

// Lightweight contentEditable rich-text editor. Stores HTML. Plays nicely with
// the theme tokens and works across desktop + mobile (Android WebView /
// WebKitGTK) using execCommand, which is still broadly supported.

export function isHtmlContent(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Turn legacy plain-text notes into safe HTML so they keep rendering.
function toEditableHtml(value: string): string {
  if (!value) return '';
  if (isHtmlContent(value)) return value;
  return escapeHtml(value).replace(/\n/g, '<br>');
}

type ToolbarAction = {
  icon: typeof Bold;
  label: string;
  run: () => void;
};

function ToolbarButton({ icon: Icon, label, run }: ToolbarAction) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Prevent the editor from losing selection/focus when the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-text-primary/8 hover:text-text-primary active:bg-text-primary/12"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function EditorSurface({
  editorRef,
  html,
  onInput,
  placeholder,
  fullscreen,
  exec,
  insertHtml,
  className,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  html: string;
  onInput: () => void;
  placeholder?: string;
  fullscreen: boolean;
  exec: (command: string, value?: string) => void;
  insertHtml: (snippet: string) => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          insertHtml(`<img src="${reader.result}" alt="" style="max-width:100%;border-radius:12px;margin:8px 0;" />`);
        }
      };
      reader.readAsDataURL(file);
    },
    [insertHtml],
  );

  const addLink = useCallback(() => {
    const url = window.prompt('Link URL');
    if (url) exec('createLink', url);
  }, [exec]);

  const addImageUrl = useCallback(() => {
    const url = window.prompt('Image URL (or use the upload button)');
    if (url) {
      insertHtml(`<img src="${url}" alt="" style="max-width:100%;border-radius:12px;margin:8px 0;" />`);
    }
  }, [insertHtml]);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-borderSoft/25 px-1 py-1">
        <ToolbarButton icon={Bold} label="Bold" run={() => exec('bold')} />
        <ToolbarButton icon={Italic} label="Italic" run={() => exec('italic')} />
        <ToolbarButton icon={Underline} label="Underline" run={() => exec('underline')} />
        <span className="mx-1 h-5 w-px bg-borderSoft/30" />
        <ToolbarButton icon={Heading2} label="Heading" run={() => exec('formatBlock', '<h3>')} />
        <ToolbarButton icon={List} label="Bulleted list" run={() => exec('insertUnorderedList')} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" run={() => exec('insertOrderedList')} />
        <ToolbarButton icon={Minus} label="Divider" run={() => insertHtml('<hr />')} />
        <span className="mx-1 h-5 w-px bg-borderSoft/30" />
        <ToolbarButton icon={Link2} label="Add link" run={addLink} />
        <ToolbarButton icon={ImageIcon} label="Image from URL" run={addImageUrl} />
        <ToolbarButton
          icon={ImageIcon}
          label="Upload image"
          run={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={onInput}
          onPaste={(e) => {
            // Paste images from clipboard as inline data URLs.
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                  e.preventDefault();
                  handleImageFile(file);
                  return;
                }
              }
            }
          }}
          className={cn(
            'rte-content min-h-full w-full px-4 py-3 text-[14px] leading-relaxed text-text-primary outline-none',
            fullscreen ? 'min-h-full' : 'min-h-[200px]',
          )}
          // The initial value is set imperatively in the hook to avoid React
          // fighting the cursor on every keystroke.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const inlineRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Seed the editors with the (possibly legacy plain-text) value once.
  const initialHtml = useRef(toEditableHtml(value)).current;

  const activeRef = fullscreen ? fullscreenRef : inlineRef;

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    // Reflect the change after execCommand mutates the DOM.
    const el = (fullscreen ? fullscreenRef : inlineRef).current;
    if (el) onChange(el.innerHTML);
  }, [fullscreen, onChange]);

  const insertHtml = useCallback((snippet: string) => {
    document.execCommand('insertHTML', false, snippet);
    const el = (fullscreen ? fullscreenRef : inlineRef).current;
    if (el) onChange(el.innerHTML);
  }, [fullscreen, onChange]);

  const handleInput = useCallback(() => {
    const el = activeRef.current;
    if (el) onChange(el.innerHTML);
  }, [activeRef, onChange]);

  // When toggling fullscreen, copy the latest HTML into the editor that's
  // about to become visible so content stays in sync between the two surfaces.
  useEffect(() => {
    const el = (fullscreen ? fullscreenRef : inlineRef).current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = toEditableHtml(value);
    }
    if (fullscreen) {
      fullscreenRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  return (
    <>
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-[18px] border border-borderSoft/30 bg-panel2/40',
          fullscreen && 'invisible',
          className,
        )}
      >
        <EditorSurface
          editorRef={inlineRef}
          html={initialHtml}
          onInput={handleInput}
          placeholder={placeholder}
          fullscreen={false}
          exec={exec}
          insertHtml={insertHtml}
        />
        <div className="flex justify-end border-t border-borderSoft/20 px-2 py-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFullscreen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-text-primary/8 hover:text-text-primary"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Expand
          </button>
        </div>
      </div>

      {fullscreen
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex flex-col bg-panel pb-[env(safe-area-inset-bottom)]">
              <div className="flex shrink-0 items-center justify-between border-b border-borderSoft/25 px-4 py-3">
                <p className="text-sm font-semibold text-text-primary">Notepad</p>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setFullscreen(false)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-text-primary/8 hover:text-text-primary"
                >
                  <Minimize2 className="h-4 w-4" /> Done
                </button>
              </div>
              <EditorSurface
                editorRef={fullscreenRef}
                html={initialHtml}
                onInput={handleInput}
                placeholder={placeholder}
                fullscreen
                exec={exec}
                insertHtml={insertHtml}
                className="flex-1"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// Renders saved note content (HTML or legacy plain text) for display surfaces.
export function RichTextContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (isHtmlContent(content)) {
    return (
      <div
        className={cn('rte-content', className)}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return <p className={cn('whitespace-pre-wrap', className)}>{content}</p>;
}
