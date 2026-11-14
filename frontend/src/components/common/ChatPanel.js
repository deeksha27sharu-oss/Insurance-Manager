import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChatPanel } from "../../context/ChatPanelContext";
import { FiX, FiSend, FiUser, FiBriefcase, FiArrowLeft } from "react-icons/fi";
import { apiGet, apiPost, apiPut } from "../../api/client";
import { useSocketEvent } from "../../hooks/useSocketEvents";

export default function ChatPanel() {
  const { isOpen, activePolicyId, activeUserId, activeUserName, showBackButton, openChat, setActiveChatUser, closeChat } = useChatPanel();
  const { role, user } = useAuth();

  const isInboxView = isOpen && !activeUserId;

  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);

  const processedMsgIds = useRef(new Set());

  useEffect(() => {
    if (!isOpen || !isInboxView) return;
    apiGet("/chat/contacts")
      .then(res => setContacts(res.contacts || []))
      .catch(console.error);
  }, [isOpen, isInboxView]);

  useEffect(() => {
    if (!isOpen || isInboxView || !activeUserId) return;
    
    apiGet(`/chat/${activePolicyId || "general"}/${activeUserId}`)
      .then(res => setMessages(res.messages || []))
      .catch(console.error);

    apiPut(`/chat/read/${activeUserId}`, {}).catch(console.error);

    setContacts((prev) => 
      prev.map(c => String(c.id) === String(activeUserId) ? { ...c, unread: 0 } : c)
    );
  }, [isOpen, isInboxView, activeUserId, activePolicyId]);

  useSocketEvent("chat:message", (newMsg) => {
    if (!isOpen) return;
    if (processedMsgIds.current.has(newMsg._id)) return;
    processedMsgIds.current.add(newMsg._id);

    if (isInboxView) {
      setContacts((prev) => {
        const updated = prev.map(c => {
          if (String(c.id) === String(newMsg.senderId) || String(c.id) === String(newMsg.clientId) || String(c.id) === String(newMsg.agentId)) {
            const isSender = String(newMsg.senderId) === String(c.id);
            const isMe = String(newMsg.senderId) === String(user?.userId);
            
            if (String(newMsg.clientId) === String(c.id) || String(newMsg.agentId) === String(c.id)) {
              return { 
                ...c, 
                unread: (!isMe && isSender) ? (c.unread || 0) + 1 : c.unread,
                lastMessageText: newMsg.text,
                lastMessageSender: isMe ? "You: " : "",
                lastMessageTime: new Date(newMsg.createdAt).getTime()
              };
            }
          }
          return c;
        });
        return [...updated].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      });
      return;
    }
    const participants = [String(newMsg.clientId), String(newMsg.agentId)];
    if (participants.includes(String(user?.userId)) && participants.includes(String(activeUserId))) {
      setMessages((prev) => {
        if (prev.some(m => m._id === newMsg._id)) return prev;
        return [...prev, newMsg];
      });
      
      if (String(newMsg.senderId) !== String(user?.userId)) {
        apiPut(`/chat/read/${activeUserId}`, {}).catch(console.error);
      }
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeChat(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeChat]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !activeUserId) return;

    setInputValue("");
    try {
      await apiPost("/chat", {
        policyId: activePolicyId || "general",
        targetId: activeUserId,
        text,
      });
    } catch (err) {
      console.error("Failed to send", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const activeContact = useMemo(() => {
    return contacts.find(c => String(c.id) === String(activeUserId));
  }, [contacts, activeUserId]);

  if (!isOpen) return null;

  const headerTitle = isInboxView 
    ? "Messages" 
    : (activeContact?.name || activeUserName || "Chat");

  return (
    <>
      <div className={`chat-panel-backdrop ${isOpen ? "is-open" : ""}`} onClick={closeChat} />
      <aside className={`chat-panel ${isOpen ? "is-open" : ""}`} role="dialog">
        
        <div className="chat-panel-header">
          <div className="chat-panel-header-left">
            {!isInboxView && showBackButton && (
              <button onClick={() => setActiveChatUser(null)} className="chat-panel-clear" title="Back to Inbox">
                <FiArrowLeft />
              </button>
            )}
            <div className="chat-panel-header-text">
              <h2 className="chat-panel-title">{headerTitle}</h2>
              <span className="chat-panel-subtitle">
                {isInboxView ? "Inbox" : activeContact?.type || "Chat"}
              </span>
            </div>
          </div>
          <button className="chat-panel-close" onClick={closeChat}><FiX /></button>
        </div>

        {isInboxView && (
          <div className="chat-inbox">
            {contacts.length === 0 ? (
              <div className="chat-panel-empty">
                <p>No contacts available.</p>
              </div>
            ) : (
              <ul className="chat-inbox-list">
                {contacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`chat-inbox-item ${c.unread > 0 ? "is-unread" : ""}`}
                      onClick={() => openChat(null, c.id, true, c.name)}
                    >
                      <div className="chat-inbox-avatar">{c.name[0].toUpperCase()}</div>
                      <div className="chat-inbox-body">
                        <div className="chat-inbox-row">
                          <span className="chat-inbox-name">{c.name}</span>
                          <span className="chat-inbox-time">{formatTime(c.lastMessageTime)}</span>
                        </div>
                        <div className="chat-inbox-row">
                          <span className="chat-inbox-preview" style={{ color: c.unread > 0 ? "#1f2937" : "#6b7280", fontWeight: c.unread > 0 ? 500 : 400 }}>
                            {c.lastMessageText ? `${c.lastMessageSender}${c.lastMessageText}` : "Click to open chat"}
                          </span>
                          {c.unread > 0 && (
                            <span className="chat-inbox-unread">
                              {c.unread > 99 ? "99+" : c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!isInboxView && (
          <>
            <div className="chat-panel-messages">
              {messages.length === 0 ? (
                <div className="chat-panel-empty">
                  <p>No messages yet.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = String(m.senderId) === String(user?.userId);
                  return (
                    <div key={m._id} className={`chat-panel-message ${isMine ? "chat-panel-message-mine" : "chat-panel-message-theirs"}`}>
                      <div className="chat-panel-message-avatar">
                        {m.senderRole === "agent" ? <FiBriefcase /> : <FiUser />}
                      </div>
                      <div className="chat-panel-message-content">
                        <div className="chat-panel-message-text">{m.text}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-panel-input-area">
              <div className="chat-panel-input-wrapper">
                <textarea
                  className="chat-panel-input"
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="chat-panel-send-btn"
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                >
                  <FiSend />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}