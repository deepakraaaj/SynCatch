import { Card } from '../../components/ui/card';
import { ChatPanel } from './ChatPanel';

export function AssistantView() {
  return (
    <div className="mx-auto h-[calc(100vh-9rem)] max-w-3xl">
      <Card className="h-full overflow-hidden rounded-[28px] border-borderSoft/20 p-0">
        <ChatPanel />
      </Card>
    </div>
  );
}
