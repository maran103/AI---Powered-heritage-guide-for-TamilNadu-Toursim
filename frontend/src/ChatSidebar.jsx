import { useEffect, useState } from "react";
import "./ChatSidebar.css";

function ChatSidebar({ currentChat, onSelectChat, onNewChat, chats = [], onOpenSettings }) {
  const [isOpen, setIsOpen] = useState(true);

  // Toggle a class on the main app container so layout can respond when sidebar opens
  useEffect(() => {
    const container = document.querySelector('.app-container');
    if (!container) return;

    if (isOpen) container.classList.add('sidebar-open');
    else container.classList.remove('sidebar-open');

    return () => {
      container.classList.remove('sidebar-open');
    };
  }, [isOpen]);

  const getChatPreview = (messages) => {
    if (!messages || messages.length === 0) return "New Chat";

    // Find the first user message
    const firstUserMessage = messages.find(msg => msg.type === "user");
    if (!firstUserMessage) return "New Chat";

    // Return first 30 characters of the message
    return firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? "..." : "");
  };

  const getChatCategory = (messages) => {
    if (!messages || messages.length === 0) return "Recent";

    // Extract category from first user message
    const firstUserMessage = messages.find(msg => msg.type === "user");
    if (!firstUserMessage) return "Recent";

    const text = firstUserMessage.text.toLowerCase();

    if (text.includes("temple") || text.includes("கோயில்")) return "🏛️ Temples";
    if (text.includes("fort") || text.includes("கோட்டை")) return "🏰 Forts";
    if (text.includes("museum") || text.includes("சंग्रहालय")) return "🖼️ Museums";
    if (text.includes("monument") || text.includes("स्मारक")) return "📿 Monuments";
    if (text.includes("beach") || text.includes("கடற்கரை")) return "🏖️ Beaches";
    if (text.includes("route") || text.includes("பாதை")) return "🗺️ Routes";
    if (text.includes("food") || text.includes("சமையல்")) return "🍲 Food";
    if (text.includes("festival") || text.includes("திருவிழா")) return "🎉 Festivals";

    return "💬 Chats";
  };

  return (
    <>
      {/* Sidebar */}
      <div className={`chat-sidebar ${isOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <h2>Chat History</h2>
          <button
            className="new-chat-btn"
            onClick={onNewChat}
            title="Start New Chat"
          >
            New
          </button>
        </div>

        <div className="chats-container">
          {chats && chats.length > 0 ? (
            <>
              {chats.map((chat, index) => (
                <div
                  key={index}
                  className={`chat-item ${currentChat === index ? "active" : ""}`}
                  onClick={() => onSelectChat(index)}
                  title={getChatPreview(chat.messages)}
                >
                  <div className="chat-category">
                    {getChatCategory(chat.messages)}
                  </div>
                  <div className="chat-preview">
                    {getChatPreview(chat.messages)}
                  </div>
                  <div className="chat-time">
                    {chat.timestamp ? new Date(chat.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    }) : ""}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="empty-chat">
              <p>No chats yet</p>
              <p className="hint">Start a new conversation!</p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed UI Controls (Separate from Sidebar) */}
      <div className="sidebar-controls">
        <button
          className="control-btn menu-toggle"
          onClick={() => setIsOpen(!isOpen)}
          title={isOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <button
          className="control-btn settings-toggle"
          onClick={onOpenSettings}
          title="User Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
}

export default ChatSidebar;
