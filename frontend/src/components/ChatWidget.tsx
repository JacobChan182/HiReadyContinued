import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChatBox from '@/components/ChatBox';

interface ChatWidgetProps {
  lectureId?: string;
  videoTitle?: string;
}

const STORAGE_KEY = 'nmt.chatWidget.open';

const ChatWidget = ({ lectureId, videoTitle }: ChatWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setIsOpen(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    } catch {
      // ignore
    }
  }, [isOpen]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="mb-3 w-[400px] max-w-[calc(100vw-2rem)] h-[680px] max-h-[calc(100vh-6rem)] shadow-2xl rounded-xl overflow-hidden border bg-background">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-800">AI Assistant</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-[calc(100%-41px)]">
            <ChatBox lectureId={lectureId} videoTitle={videoTitle} className="h-full border-0 shadow-none" />
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="h-12 w-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </div>
  );
};

export default ChatWidget;
