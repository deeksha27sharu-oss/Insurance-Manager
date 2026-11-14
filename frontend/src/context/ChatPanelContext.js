import { createContext, useContext, useState, useCallback } from "react";

const ChatPanelContext = createContext(null);

export function ChatPanelProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePolicyId, setActivePolicyId] = useState(null);
  const [activeUserId, setActiveUserId] = useState(null); // Represents the "target" (agent for user, client for agent)
  const [showBackButton, setShowBackButton] = useState(false);

  const openChat = useCallback((policyId = null, userId = null, fromInbox = false) => {
    setActivePolicyId(policyId);
    setActiveUserId(userId);
    setShowBackButton(fromInbox);
    setIsOpen(true);
  }, []);

  const setActiveChatUser = useCallback((userId) => {
    setActiveUserId(userId);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setActiveChatUser(null);
    setShowBackButton(false);
  }, []);

  return (
    <ChatPanelContext.Provider
      value={{ isOpen, activePolicyId, activeUserId, showBackButton, openChat, setActiveChatUser, closeChat }}
    >
      {children}
    </ChatPanelContext.Provider>
  );
}

export function useChatPanel() {
  const ctx = useContext(ChatPanelContext);
  if (!ctx) throw new Error("useChatPanel must be used within a ChatPanelProvider");
  return ctx;
}