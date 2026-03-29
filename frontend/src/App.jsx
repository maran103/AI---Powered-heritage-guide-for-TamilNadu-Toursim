import { useEffect, useState, useRef } from "react";
import { askAI, getChatHistory, clearChatHistory, changePassword, deleteAccount, getTTSAudioUrl, addVisitedPlace, removeVisitedPlace, getVisitedPlaces } from "./api";
import Auth from "./Auth";
import ChatSidebar from "./ChatSidebar";
import HeritageMap from "./HeritageMap";
import CulturalCalendar from "./CulturalCalendar";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState({});
  const [chats, setChats] = useState([]);
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [language, setLanguage] = useState("en");
  const [view, setView] = useState("chat"); // 'chat', 'map', or 'calendar'
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const ambientAudioRef = useRef(null);
  const currentSentenceRef = useRef(null);
  const voicesLoadedRef = useRef(false);

  // Keep a ref for language so TTS callbacks always see current value
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Preload voices on mount
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) voicesLoadedRef.current = true;
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const audioEnabledRef = useRef(audioEnabled);
  useEffect(() => {
    const wasDisabled = !audioEnabledRef.current && audioEnabled;
    audioEnabledRef.current = audioEnabled;

    if (!audioEnabled) {
      window.speechSynthesis.cancel();
      // Put the current sentence back at the front of the queue to resume later
      if (currentSentenceRef.current) {
        speechQueue.current.unshift(currentSentenceRef.current);
        currentSentenceRef.current = null;
      }
      isProcessingQueue.current = false;

      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current.currentTime = 0;
      }
    } else if (wasDisabled && speechQueue.current.length > 0) {
      // Resume if there's something in the queue
      isProcessingQueue.current = true;
      processSpeechQueue();
    }
  }, [audioEnabled]);

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [visitedSites, setVisitedSites] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Fetch visited sites on login
  useEffect(() => {
    if (user) {
      getVisitedPlaces().then(sites => setVisitedSites(sites));
    }
  }, [user]);

  const toggleVisitedPlace = async (siteName) => {
    const isVisited = visitedSites.includes(siteName);
    if (isVisited) {
      const result = await removeVisitedPlace(siteName);
      if (result?.success) {
        setVisitedSites(prev => prev.filter(s => s !== siteName));
      }
    } else {
      const result = await addVisitedPlace(siteName);
      if (result?.success) {
        setVisitedSites(prev => [...prev, siteName]);
      }
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const userId = localStorage.getItem("heritage_user_id");
    const userName = localStorage.getItem("heritage_user_name");
    const userEmail = localStorage.getItem("heritage_user_email");

    if (userId && userName) {
      setUser({
        userId,
        name: userName,
        email: userEmail
      });
    }
  }, []);

  // Load chat history when user logs in
  useEffect(() => {
    if (user) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      });

      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    const history = await getChatHistory();

    if (history.length > 0) {
      setMessages(history);
      // Initialize chats array with one chat containing current messages
      setChats([{
        messages: history,
        timestamp: new Date().toISOString(),
        id: Date.now()
      }]);
    } else {
      const welcomeMessage = {
        type: "assistant",
        text: `🙏 வணக்கம் ${user?.name || ""}! Welcome to Tamil Nadu Heritage AI Assistant! I can help you discover amazing heritage sites, temples, and tourist spots. Ask me anything!`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
      setChats([{
        messages: [welcomeMessage],
        timestamp: new Date().toISOString(),
        id: Date.now()
      }]);
    }
    setCurrentChatIndex(0);
  };

  const selectChat = (index) => {
    if (index < chats.length) {
      setCurrentChatIndex(index);
      setMessages(chats[index].messages);
    }
  };

  const createNewChat = () => {
    const welcomeMessage = {
      type: "assistant",
      text: `🙏 வணக்கம் ${user?.name || ""}! How can I help you explore Tamil Nadu's heritage today?`,
      timestamp: new Date().toISOString()
    };

    const newChat = {
      messages: [welcomeMessage],
      timestamp: new Date().toISOString(),
      id: Date.now()
    };

    setChats(prev => [newChat, ...prev]);
    setCurrentChatIndex(0);
    setMessages([welcomeMessage]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (chats.length > 0) {
      const updatedChats = [...chats];
      updatedChats[currentChatIndex] = {
        ...updatedChats[currentChatIndex],
        messages: messages
      };
      setChats(updatedChats);
    }
  }, [messages]);

  const clearChat = async () => {
    const success = await clearChatHistory();

    if (success) {
      setMessages([{
        type: "assistant",
        text: `🙏 வணக்கம் ${user?.name || ""}! Welcome to Tamil Nadu Heritage AI Assistant! I can help you discover amazing heritage sites, temples, and tourist spots. Ask me anything!`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const logout = () => {
    localStorage.removeItem("heritage_user_id");
    localStorage.removeItem("heritage_user_name");
    localStorage.removeItem("heritage_user_email");
    setUser(null);
    setMessages([]);
  };

  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechQueue = useRef([]);
  const isProcessingQueue = useRef(false);
  const sentenceBuffer = useRef("");

  // Refined speak function for individual chunks/sentences
  const speakChunk = (text) => {
    if (!audioEnabledRef.current || !text) return;

    const cleanText = text
      .replace(/\*\*+/g, "")
      .replace(/\*/g, "")
      .replace(/#+/g, "")
      .replace(/__/g, "")
      .replace(/_/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/Latitude:.*Longitude:.*?(?=\s|$)/gi, "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}✨⚠️🗓️🏨🧳•→←↑↓]/gu, "")
      .replace(/\b\d+\.\d+\b/g, "")
      .replace(/^\s*\d+\.\s*/gm, "")
      .replace(/---+/g, "")
      .replace(/^\s*—\s*/gm, "")
      .trim();

    if (!cleanText || cleanText.length < 2) return;

    const currentLang = languageRef.current;

    // Use backend TTS for Tamil and Hindi as browser voices are often missing
    if (currentLang === "ta" || currentLang === "hi") {
      const audioUrl = getTTSAudioUrl(cleanText, currentLang);
      const audio = new Audio(audioUrl);

      currentSentenceRef.current = text;
      setIsSpeaking(true);

      audio.onended = () => {
        setIsSpeaking(false);
        currentSentenceRef.current = null;
        setTimeout(() => processSpeechQueue(), 50);
      };

      audio.onerror = (e) => {
        console.error("Backend TTS error:", e);
        setIsSpeaking(false);
        currentSentenceRef.current = null;
        setTimeout(() => processSpeechQueue(), 50);
      };

      audio.play().catch(e => {
        console.error("Playback error:", e);
        setIsSpeaking(false);
        setTimeout(() => processSpeechQueue(), 50);
      });
      return;
    }

    // Default to browser SpeechSynthesis for English
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const langCode = "en-IN";

    const voices = window.speechSynthesis.getVoices();
    const bestVoice =
      voices.find(v => v.lang === langCode && (v.name.includes("Google") || v.name.includes("Natural"))) ||
      voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))) ||
      voices.find(v => v.lang === langCode) ||
      voices.find(v => v.lang.startsWith("en"));

    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = bestVoice.lang;
    } else {
      utterance.lang = langCode;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      currentSentenceRef.current = text;
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      currentSentenceRef.current = null;
      setTimeout(() => processSpeechQueue(), 50);
    };
    utterance.onerror = (e) => {
      console.warn('TTS error:', e.error);
      setIsSpeaking(false);
      currentSentenceRef.current = null;
      setTimeout(() => processSpeechQueue(), 50);
    };

    window.speechSynthesis.speak(utterance);
  };

  const processSpeechQueue = () => {
    if (!audioEnabledRef.current) {
      speechQueue.current = [];
      isProcessingQueue.current = false;
      return;
    }
    if (speechQueue.current.length > 0 && !window.speechSynthesis.speaking) {
      const nextText = speechQueue.current.shift();
      speakChunk(nextText);
    } else if (speechQueue.current.length === 0) {
      isProcessingQueue.current = false;
    }
  };

  const addToSpeechQueue = (text) => {
    if (!audioEnabledRef.current) return;

    // Split on sentence boundaries — covers English (.!?), Hindi (।), and newlines
    // For Tamil, also split on comma for longer phrases since Tamil uses commas as natural pauses
    const currentLang = languageRef.current;
    let sentences;
    if (currentLang === "ta" || currentLang === "hi") {
      // For Tamil/Hindi: split on period, exclamation, question, purna viram, newlines
      sentences = text.match(/[^.!?।॥\n]+[.!?।॥\n]+|[^.!?।॥\n]+$/g) || [text];
    } else {
      sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
    }

    sentences.forEach(s => {
      const trimmed = s.trim();
      if (trimmed && trimmed.length >= 2) {
        speechQueue.current.push(trimmed);
      }
    });

    if (!isProcessingQueue.current) {
      isProcessingQueue.current = true;
      processSpeechQueue();
    }
  };

  const ask = async () => {
    if (!query.trim()) return;

    const userMessage = {
      type: "user",
      text: query,
      image: imageBase64,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery("");

    // Reset textarea height after sending
    const textarea = document.querySelector('.input-field');
    if (textarea) textarea.style.height = 'auto';

    const currentImgb64 = imageBase64;
    setSelectedImage(null);
    setImageBase64(null);
    setIsLoading(true);

    // Reset speech state for new response
    window.speechSynthesis.cancel();
    speechQueue.current = [];
    currentSentenceRef.current = null;
    sentenceBuffer.current = "";
    isProcessingQueue.current = false;

    try {
      const assistantMessageId = Date.now() + 1;
      const assistantMessage = {
        type: "assistant",
        text: "",
        timestamp: new Date().toISOString(),
        id: assistantMessageId
      };

      setMessages(prev => [...prev, assistantMessage]);
      const messageBody = userMessage.text;

      const response = await askAI({
        message: messageBody,
        latitude: location.latitude,
        longitude: location.longitude,
        language: language,
        image_base64: currentImgb64,
        storytelling: audioEnabledRef.current,
        visited_sites: visitedSites // Added visited sites context
      }, (chunk) => {
        // Update message text
        setMessages(prev => {
          return prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, text: msg.text + chunk }
              : msg
          );
        });

        // Handle storytelling audio streaming
        if (audioEnabledRef.current) {
          sentenceBuffer.current += chunk;

          // Check for sentence boundaries (include Tamil punctuation ।)
          const lastChar = sentenceBuffer.current.slice(-1);
          if (/[.!?।\n]/.test(lastChar) || sentenceBuffer.current.length > 100) {
            // If we found a boundary or buffer is getting too long
            const sentences = sentenceBuffer.current.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g);
            if (sentences && sentences.length > 1) {
              // Add all complete sentences except the last one to the queue
              sentences.slice(0, -1).forEach(s => addToSpeechQueue(s));
              // Keep the last fragment in buffer
              sentenceBuffer.current = sentences[sentences.length - 1];
            } else if (sentenceBuffer.current.length > 100) {
              // Forced split if no punctuation found
              addToSpeechQueue(sentenceBuffer.current);
              sentenceBuffer.current = "";
            }
          }
        }
      });

      // Catch any remaining text in buffer
      if (audioEnabledRef.current && sentenceBuffer.current.trim()) {
        addToSpeechQueue(sentenceBuffer.current);
        sentenceBuffer.current = "";
      }

    } catch (error) {
      const errorMessage = {
        type: "assistant",
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
        id: Date.now() + 2
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    // Map app language to speech recognition language codes
    const langMap = {
      "en": "en-IN",
      "ta": "ta-IN",
      "hi": "hi-IN"
    };
    recognition.lang = langMap[language] || "en-IN";

    recognition.onresult = (e) => {
      setQuery(e.results[0][0].transcript);
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e.error);
      if (e.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone permissions in your browser.");
      }
    };

    recognition.start();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(URL.createObjectURL(file));
        setImageBase64(reader.result.split(',')[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Show login page if not authenticated
  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div className="app-container">
      {/* Chat Sidebar */}
      <ChatSidebar
        currentChat={currentChatIndex}
        onSelectChat={selectChat}
        onNewChat={createNewChat}
        chats={chats}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <h1>Tamil Nadu Heritage AI</h1>
            <p>Welcome, {user.name}!</p>
          </div>
          <div className="header-actions">
            <select
              className="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              title="Select Language"
            >
              <option value="en">English</option>
              <option value="ta">Tamil</option>
              <option value="hi">Hindi</option>
            </select>
            <button
              className={`view-toggle storyteller-toggle ${audioEnabled ? 'active' : ''}`}
              onClick={() => setAudioEnabled(!audioEnabled)}
              title="Storyteller Mode (Audio Guide)"
            >
              {audioEnabled ? "🔊 Storytelling ON" : "🔇 Storytelling OFF"}
            </button>
            <button
              className={`view-toggle ${view === 'map' ? 'active' : ''}`}
              onClick={() => setView('map')}
              title="Map View"
            >
              Map
            </button>
            <button
              className={`view-toggle ${view === 'calendar' ? 'active' : ''}`}
              onClick={() => setView('calendar')}
              title="Calendar"
            >
              Events
            </button>
            <button
              className={`view-toggle ${view === 'chat' ? 'active' : ''}`}
              onClick={() => setView('chat')}
              title="Chat View"
            >
              Chat
            </button>
            <button className="clear-button" onClick={clearChat} title="Clear Chat">
              Clear
            </button>
            <button className="logout-button" onClick={logout} title="Logout">
              Logout
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="messages-container">
          {view === 'chat' ? (
            <>
              {messages.map((msg, index) => (
                <div key={msg.id || index} className={`message ${msg.type} animate-fade`}>
                  <div className="message-inner">
                    <div className="message-avatar">
                      {msg.type === "user" ? "U" : "AI"}
                    </div>
                    <div className="message-content">
                      <div
                        className="message-text"
                        dangerouslySetInnerHTML={{ __html: linkifyMessage(msg.text) }}
                      />
                      {msg.image && (
                        <div className="message-image">
                          <img src={`data:image/jpeg;base64,${msg.image}`} alt="Heritage site" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message assistant">
                  <div className="message-inner">
                    <div className="message-avatar">AI</div>
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : view === 'map' ? (
            <div className="map-view-container animate-fade">
              <HeritageMap
                userLocation={location}
                visitedSites={visitedSites}
                onToggleVisit={toggleVisitedPlace}
              />
            </div>
          ) : (
            <div className="calendar-view-container animate-fade">
              <CulturalCalendar userLocation={location} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-container">
          {selectedImage && (
            <div className="image-preview-container">
              <img src={selectedImage} alt="Preview" className="image-preview" />
              <button className="remove-image" onClick={removeImage}>&times;</button>
            </div>
          )}
          <div className="input-wrapper">
            <textarea
              className="input-field"
              placeholder={
                language === "ta"
                  ? "பாரம்பரிய தலங்கள், கோயில்கள், சுற்றுலா இடங்கள் பற்றி கேளுங்கள்..."
                  : language === "hi"
                    ? "विरासत स्थलों, मंदिरों, पर्यटन स्थलों के बारे में पूछें..."
                    : "Ask about heritage sites, temples, tourist places..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyPress={handleKeyPress}
              rows="1"
            />
            <div className="button-group">
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleImageChange}
              />
              <button
                className="image-button"
                onClick={() => fileInputRef.current.click()}
                title="Upload Photo"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>
              <button
                className="voice-button"
                onClick={startVoice}
                title="Voice Input"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>
              <button
                className="send-button"
                onClick={ask}
                disabled={!query.trim() || isLoading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={logout}
        />
      )}
    </div>
  );
}

function SettingsModal({ user, onClose, onLogout }) {
  const [passwordData, setPasswordData] = useState({
    old: "",
    new: "",
    confirm: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      setError("New passwords do not match");
      return;
    }
    if (passwordData.new.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const result = await changePassword(passwordData.old, passwordData.new);
    if (result.success) {
      setSuccess("Password changed successfully!");
      setPasswordData({ old: "", new: "", confirm: "" });
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    const doubleCheck = window.confirm("Are you absolutely sure? This will permanently delete your account and all chat history.");
    if (!doubleCheck) return;

    setLoading(true);
    const result = await deleteAccount();
    if (result.success) {
      alert("Account deleted successfully.");
      onLogout();
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>User Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>Profile Information</h3>
            <div className="user-details">
              <div className="detail-item">
                <label>Name</label>
                <p>{user?.name}</p>
              </div>
              <div className="detail-item">
                <label>Email Address</label>
                <p>{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Change Password</h3>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.old}
                  onChange={e => setPasswordData({ ...passwordData, old: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.new}
                  onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirm}
                  onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  required
                />
              </div>
              {error && <div className="settings-error">{error}</div>}
              {success && <div className="settings-success">{success}</div>}
              <button type="submit" className="save-btn" disabled={loading}>
                {loading ? "Saving..." : "Update Password"}
              </button>
            </form>
          </div>

          <div className="settings-section danger-zone">
            <h3>Danger Zone</h3>
            <p>Once you delete your account, there is no going back. Please be certain.</p>
            {!showDeleteConfirm ? (
              <button className="delete-account-btn" onClick={() => setShowDeleteConfirm(true)}>
                Delete Account
              </button>
            ) : (
              <div className="confirm-delete">
                <button className="confirm-btn" onClick={handleDeleteAccount} disabled={loading}>
                  {loading ? "Deleting..." : "Permanently Delete Account"}
                </button>
                <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

// ------------------ Helper: Linkify messages ------------------
function linkifyMessage(text) {
  if (!text) return "";

  // Escape HTML
  const escapeHtml = (s) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  let escaped = escapeHtml(text);

  // Markdown Headers (### Header)
  escaped = escaped.replace(/^\s*###\s+(.*$)/gim, '<h3 class="msg-h3">$1</h3>');
  escaped = escaped.replace(/^\s*##\s+(.*$)/gim, '<h2 class="msg-h2">$1</h2>');
  escaped = escaped.replace(/^\s*#\s+(.*$)/gim, '<h1 class="msg-h1">$1</h1>');

  // Markdown Bold (**text**)
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  // Markdown Italic (*text* or _text_)
  escaped = escaped.replace(/\*(.*?)\*/g, '<i>$1</i>');
  escaped = escaped.replace(/_(.*?)_/g, '<i>$1</i>');

  // Bullet points (* Item or - Item at start of line)
  // Group consecutive bullet points into <ul> (simplified approach)
  escaped = escaped.replace(/^\s*[\*\-]\s+(.*)/gim, '<div class="msg-list-item"><span>•</span><span>$1</span></div>');

  // Clean up remaining markdown symbols
  escaped = escaped.replace(/\*\*/g, '');
  escaped = escaped.replace(/(\s)#+/g, '$1');
  escaped = escaped.replace(/^#+/g, '');

  // Linkify http/https URLs FIRST (before any HTML injection) — only trusted domains
  const SAFE_DOMAINS = [
    'google.com', 'maps.google.com', 'www.google.com',
    'openstreetmap.org', 'wikipedia.org', 'wikimedia.org'
  ];
  const urlRegex = /((https?:\/\/)[^\s<]+)/g;
  escaped = escaped.replace(urlRegex, (m) => {
    try {
      const hostname = new URL(m).hostname.replace('www.', '');
      const isSafe = SAFE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
      if (isSafe) {
        return `<a href="${m}" target="_blank" rel="noopener noreferrer">🗺️ View on Map</a>`;
      }
    } catch (e) { /* malformed URL — fall through */ }
    return m; // show as plain text
  });

  // Strip raw coordinate text entirely to avoid broken HTML artefacts
  // e.g. "Latitude: 10.9, Longitude: 79.2" — just remove it
  escaped = escaped.replace(/\(?Latitude:\s*[-+]?\d+\.?\d*[,\s]+Longitude:\s*[-+]?\d+\.?\d*\)?/gi, '');


  // Linkify 'www.' without protocol
  const wwwRegex = /(^|\s)(www\.[^\s<]+)/g;
  escaped = escaped.replace(wwwRegex, (m, pre, url) => {
    const href = `https://${url}`;
    return `${pre}<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Handle double newlines as paragraphs
  const paragraphs = escaped.split(/\n\n+/);
  if (paragraphs.length > 1) {
    escaped = paragraphs.map(p => {
      // Don't wrap if it already starts with a block tag
      if (p.trim().startsWith('<h') || p.trim().startsWith('<div class="msg-list')) {
        return p;
      }
      return `<p class="msg-p">${p.replace(/\n/g, "<br />")}</p>`;
    }).join("");
  } else {
    // Preserve single newlines
    escaped = escaped.replace(/\n/g, "<br />");
  }

  return escaped;
}
