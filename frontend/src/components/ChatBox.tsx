import { useMemo, useState, useEffect, useRef } from 'react';
import { Send, Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  sendChatMessage,
  getChatHistory,
  getChatSessions,
  createChatSession,
  deleteChatSession,
} from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

interface ChatSession {
  session_id: string;
  title?: string;
  updated_at?: string;
}

const makeDefaultChatTitle = (videoTitle?: string) => {
  const base = (videoTitle || 'New chat').trim();
  const clipped = base.length > 40 ? `${base.slice(0, 40)}…` : base;
  const time = new Date().toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${clipped} · ${time}`;
};

const ChatBox = ({ lectureId, videoTitle, className = '' }: ChatBoxProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const defaultTitle = useMemo(() => makeDefaultChatTitle(videoTitle), [videoTitle]);

  // Load available sessions when component mounts
  useEffect(() => {
    if (!user) return;

    const loadSessions = async () => {
      try {
        setIsLoadingSessions(true);
        const s = await getChatSessions(user.id);
        setSessions(Array.isArray(s) ? s : []);

        // Default to most recent session (if any)
        if (!activeSessionId && s && s.length > 0) {
          setActiveSessionId(s[0].session_id);
        }
      } catch (err) {
        console.error('Failed to load chat sessions:', err);
        setError('Failed to load chat sessions');
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load chat history for the active session
  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);
        setError(null);

        if (!activeSessionId) {
          setMessages([]);
          return;
        }

        const history = await getChatHistory(user.id, activeSessionId, 50);
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
  }, [user, activeSessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !user) return;

    // Only allow sending messages within an explicitly created session.
    // New chats should be created via the +New button.
    if (!activeSessionId) {
      setError('Create a new chat first');
      openNewChat();
      return;
    }

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
      const result = await sendChatMessage(
        user.id,
        inputValue,
        lectureId,
        videoTitle,
        activeSessionId
      );

      if (result?.response) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Refresh sessions list so the UI shows the new/updated session title ordering
      try {
        const s = await getChatSessions(user.id);
        setSessions(Array.isArray(s) ? s : []);
      } catch {
        // ignore
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

  const openNewChat = () => {
    setNewChatTitle(defaultTitle);
    setIsNewChatOpen(true);
  };

  const handleCreateNewChat = async () => {
    if (!user) return;
    const title = newChatTitle.trim() || defaultTitle;

    try {
      setIsCreatingChat(true);
      setError(null);

      const session = await createChatSession(user.id, title, lectureId, videoTitle);
      setIsNewChatOpen(false);
      setMessages([]);
      setActiveSessionId(session.session_id || null);

      const s = await getChatSessions(user.id);
      setSessions(Array.isArray(s) ? s : []);
    } catch (err) {
      console.error('Failed to create chat session:', err);
      setError('Failed to create chat session');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleDeleteActiveChat = async () => {
    if (!user || !activeSessionId) return;

    const deletingId = activeSessionId;
    try {
      setIsDeletingChat(true);
      setError(null);

      await deleteChatSession(user.id, deletingId);

      setSessions((prev) => {
        const nextSessions = prev.filter((s) => s.session_id !== deletingId);

        // If we deleted the active session, switch to next-most-recent (or empty)
        if (deletingId === activeSessionId) {
          setActiveSessionId(nextSessions.length > 0 ? nextSessions[0].session_id : null);
          setMessages([]);
        }

        return nextSessions;
      });

      const s = await getChatSessions(user.id);
      setSessions(Array.isArray(s) ? s : []);
    } catch (err) {
      console.error('Failed to delete chat session:', err);
      setError('Failed to delete chat session');
    } finally {
      setIsDeletingChat(false);
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-600">Chats</p>
            {videoTitle ? (
              <p className="mt-0.5 text-xs text-slate-500 truncate">{videoTitle}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openNewChat}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={!activeSessionId || isDeletingChat || isLoadingSessions}
                  aria-label="Delete selected chat"
                  title={activeSessionId ? 'Delete selected chat' : 'Select a chat to delete'}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the chat session and its messages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingChat}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteActiveChat}
                    disabled={isDeletingChat}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeletingChat ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      'Delete'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Select
            value={activeSessionId ?? undefined}
            onValueChange={(value) => setActiveSessionId(value)}
            disabled={isLoadingSessions || sessions.length === 0}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={sessions.length === 0 ? 'No chats yet' : 'Select a chat'} />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.session_id} value={s.session_id}>
                  {s.title || s.session_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New chat</DialogTitle>
            <DialogDescription>
              Give this chat a name (or keep the suggested one).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              placeholder={defaultTitle}
              disabled={isCreatingChat}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewChatOpen(false)}
              disabled={isCreatingChat}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateNewChat} disabled={isCreatingChat}>
              {isCreatingChat ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ChatBox;
