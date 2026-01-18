import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { sendChatMessage, getChatHistory } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatBoxProps {
  lectureId?: string;
  videoTitle?: string;
  className?: string;
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | Date;
}

const ChatBox = ({ lectureId, videoTitle, className = '' }: ChatBoxProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history when component mounts
  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const history = await getChatHistory(user.id, 20);
        if (history && Array.isArray(history)) {
          setMessages(
            history.map((msg) => ({
              role: (msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user') as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setError('Failed to load chat history');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        user.id,
        inputValue,
        lectureId,
        videoTitle
      );

      if (response) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      // Remove the user message if there was an error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <Card className={`p-6 bg-gradient-to-br from-slate-50 to-slate-100 ${className}`}>
        <p className="text-center text-slate-600">Please log in to use chat</p>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="border-b px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="font-semibold text-slate-800">AI Assistant</h3>
        {videoTitle && (
          <p className="text-xs text-slate-600 mt-1">{videoTitle}</p>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-slate-500">
              <p className="font-medium">Start a conversation</p>
              <p className="text-sm mt-1">Ask questions about the video content</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.role === 'user'
                        ? 'text-blue-100'
                        : 'text-slate-600'
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="border-t p-4 bg-slate-50 flex gap-2"
      >
        <Input
          type="text"
          placeholder="Ask a question..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          size="sm"
          className="bg-blue-500 hover:bg-blue-600"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </Button>
      </form>
    </Card>
  );
};

export default ChatBox;
