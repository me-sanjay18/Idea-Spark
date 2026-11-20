import { Check, CheckCheck, MessageSquare, Send, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getErrorMessage } from '../api/client';
import { Avatar, EmptyState } from '../components/ui/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

export default function MessagingPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [typingName, setTypingName] = useState('');
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const isInitialScrollRef = useRef(true);
  const forceScrollBottomRef = useRef(false);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations');
      const list = res.data.data.conversations || [];
      setConversations(list);
      if (!conversationId && list.length > 0) {
        navigate(`/messages/${list[0]._id}`, { replace: true });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingList(false);
    }
  }, [conversationId, navigate, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!conversationId) {
      setActiveConv(null);
      setMessages([]);
      return;
    }

    isInitialScrollRef.current = true;
    setLoadingThread(true);
    api
      .get(`/messages/conversations/${conversationId}/messages`)
      .then((res) => {
        setActiveConv(res.data.data.conversation);
        setMessages(res.data.data.messages || []);
        setConversations((prev) =>
          prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
        );
        refreshMe();
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoadingThread(false));
  }, [conversationId, refreshMe, toast]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || loadingThread) return;

    if (isInitialScrollRef.current) {
      el.scrollTop = el.scrollHeight;
      isInitialScrollRef.current = false;
      forceScrollBottomRef.current = false;
      return;
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (forceScrollBottomRef.current || distanceFromBottom < 150) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      forceScrollBottomRef.current = false;
    }
  }, [messages.length, loadingThread]);

  useEffect(() => {
    if (!socket || !conversationId) return undefined;

    function joinConversationRoom() {
      socket.emit('conversation:join', conversationId);
    }

    if (socket.connected) {
      joinConversationRoom();
    }
    socket.on('connect', joinConversationRoom);

    function onNewMessage(msg) {
      const msgConvId = String(msg.conversation?._id || msg.conversation);
      if (msgConvId === String(conversationId)) {
        setMessages((prev) =>
          prev.some((m) => String(m._id) === String(msg._id)) ? prev : [...prev, msg]
        );
        api.patch(`/messages/conversations/${conversationId}/read`).catch(() => {});
      } else {
        fetchConversations();
      }
    }

    function onMessagesRead({ conversationId: readConvId, userId }) {
      if (String(readConvId) === String(conversationId)) {
        setMessages((prev) =>
          prev.map((m) =>
            (m.readBy || []).some((r) => String(r.user) === String(userId))
              ? m
              : { ...m, readBy: [...(m.readBy || []), { user: userId, readAt: new Date() }] }
          )
        );
      }
    }

    function onTyping({ conversationId: cId, user: typer, isTyping }) {
      if (String(cId) === String(conversationId) && String(typer._id) !== String(user?._id)) {
        setTypingName(isTyping ? typer.name : '');
      }
    }

    socket.on('message:new', onNewMessage);
    socket.on('messages:read', onMessagesRead);
    socket.on('typing:update', onTyping);

    return () => {
      socket.off('connect', joinConversationRoom);
      socket.off('message:new', onNewMessage);
      socket.off('messages:read', onMessagesRead);
      socket.off('typing:update', onTyping);
    };
  }, [socket, conversationId, fetchConversations, user?._id]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !conversationId) return;
    const content = draft.trim();
    setDraft('');
    forceScrollBottomRef.current = true;
    inputRef.current?.focus({ preventScroll: true });
    socket?.emit('typing:stop', { conversationId });

    try {
      const res = await api.post(`/messages/conversations/${conversationId}/messages`, {
        content,
      });
      const created = res.data.data.message;
      setMessages((prev) =>
        prev.some((m) => String(m._id) === String(created._id)) ? prev : [...prev, created]
      );
      fetchConversations();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function getConversationLabel(conv) {
    if (conv.type === 'team') {
      return conv.title || conv.idea?.title || 'Team Workspace Chat';
    }
    const other = (conv.participants || []).find((p) => String(p._id) !== String(user?._id));
    return other?.name || 'Direct Conversation';
  }

  function getOtherParticipant(conv) {
    return (conv.participants || []).find((p) => String(p._id) !== String(user?._id));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171717]">Messages</h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Real-time Socket.IO conversations with accepted collaborators and authorized builders.
        </p>
      </div>

      {loadingList ? (
        <div className="h-[34rem] rounded-3xl bg-white border border-slate-200 animate-pulse" />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Join a collaboration workspace or message a public idea creator from their profile to begin chatting."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 rounded-3xl border border-slate-200 bg-white shadow-2xs overflow-hidden min-h-[36rem]">
          {/* Left Conversations Sidebar */}
          <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-64 md:max-h-[38rem]">
            {conversations.map((conv) => {
              const selected = conv._id === conversationId;
              const other = getOtherParticipant(conv);
              return (
                <button
                  key={conv._id}
                  type="button"
                  onClick={() => navigate(`/messages/${conv._id}`)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 transition ${
                    selected ? 'bg-[#6E05F2]/[0.06]' : 'hover:bg-slate-50'
                  }`}
                >
                  {conv.type === 'team' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2057E8]/10 text-[#2057E8] shrink-0">
                      <Users className="h-5 w-5" />
                    </div>
                  ) : (
                    <Avatar user={other} size="sm" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#171717] truncate">
                        {getConversationLabel(conv)}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="rounded-full bg-[#6E05F2] px-2 py-0.5 text-[10px] font-bold text-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {conv.lastMessage?.content || 'Start chatting...'}
                    </p>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Right Chat Thread */}
          <section className="md:col-span-8 flex flex-col h-[34rem] md:h-[38rem]">
            {!activeConv || loadingThread ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                {loadingThread ? 'Loading messages...' : 'Select a conversation'}
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#171717]">
                      {getConversationLabel(activeConv)}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {activeConv.type === 'team'
                        ? `${activeConv.participants?.length || 1} workspace members`
                        : 'Authorized Direct Conversation'}
                    </p>
                  </div>
                  {typingName && (
                    <span className="text-xs font-medium text-[#6E05F2] animate-pulse">
                      {typingName} is typing...
                    </span>
                  )}
                </div>

                <div
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[#F8F9FC]/60"
                >
                  {messages.map((msg) => {
                    const mine = String(msg.sender?._id || msg.sender) === String(user?._id);
                    const readByOthers = (msg.readBy || []).some(
                      (r) => String(r.user) !== String(user?._id)
                    );
                    return (
                      <div
                        key={msg._id}
                        className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                          <span>{mine ? 'You' : msg.sender?.name}</span>
                          <span>•</span>
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                            msg.systemMessage
                              ? 'bg-slate-200/70 text-slate-600 text-xs italic'
                              : mine
                              ? 'brand-gradient-bg text-white'
                              : 'bg-white border border-slate-200 text-[#171717]'
                          }`}
                        >
                          {msg.content}
                        </div>
                        {mine && !msg.systemMessage && (
                          <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                            {readByOthers ? (
                              <>
                                <CheckCheck className="h-3 w-3 text-[#2057E8]" /> Read
                              </>
                            ) : (
                              <>
                                <Check className="h-3 w-3" /> Sent
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleSend}
                  className="border-t border-slate-100 bg-white px-4 py-3 flex items-center gap-2.5"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      socket?.emit('typing:start', { conversationId });
                    }}
                    placeholder="Write a message..."
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#6E05F2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5b04c9]"
                  >
                    <Send className="h-4 w-4" /> Send
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

