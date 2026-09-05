import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC, FormEvent, KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Send,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  ArrowRight,
  HelpCircle,
  ShieldCheck,
  Zap,
  Compass,
} from 'lucide-react';
import { useAiraState } from '../context/AiraStateContext';
import { askAiraAssistant } from '../assistant/assistantService';
import { getDocForRoute } from '../assistant/assistantKnowledge';
import type { ChatMessage, AssistantContext, AssistantAction } from '../assistant/assistantTypes';
import symbolMark from '../assets/aira-symbol.png';

export const AiraAssistant: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    metrics,
    isAssistantOpen,
    setAssistantOpen,
    pendingAssistantPrompt,
    clearPendingAssistantPrompt,
    activeEntityContext,
  } = useAiraState();

  const [minimized, setMinimized] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentDoc = getDocForRoute(location.pathname);

  // Build current Assistant Context
  const getContext = useCallback((): AssistantContext => {
    return {
      currentRoute: location.pathname,
      currentModule: currentDoc.name,
      currentScreen: currentDoc.badge,
      visibleMetrics: metrics || undefined,
      selectedCustomer: activeEntityContext?.customerName,
      selectedPayment: activeEntityContext?.paymentId || activeEntityContext?.invoiceId,
      selectedRecoveryCase: activeEntityContext?.caseId,
      activeEntity: activeEntityContext || undefined,
    };
  }, [location.pathname, currentDoc, metrics, activeEntityContext]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isAssistantOpen && !minimized) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isAssistantOpen, minimized, messages, loading]);

  // Initialize Welcome Message
  useEffect(() => {
    if (messages.length === 0) {
      const welcome: ChatMessage = {
        id: 'welcome-01',
        role: 'assistant',
        content:
          `**AIRA — Recover More. Do More.**\n\n` +
          `I can explain how AIRA works, walk you through our autonomous recovery loop, or answer questions about what you're seeing on **${currentDoc.name}**.\n\n` +
          `Select a quick prompt below or ask me anything!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedPrompts: currentDoc.suggestedPrompts,
        actions: currentDoc.defaultActions,
        moduleContext: currentDoc.name,
      };
      setMessages([welcome]);
    }
  }, [currentDoc, messages.length]);

  // Handle external prompt triggers (e.g. from page header "Ask Aira" buttons)
  useEffect(() => {
    if (pendingAssistantPrompt) {
      const promptToRun = pendingAssistantPrompt;
      clearPendingAssistantPrompt();
      handleSend(promptToRun);
    }
  }, [pendingAssistantPrompt, clearPendingAssistantPrompt]);

  // Submit query
  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const ctx = getContext();
      const res = await askAiraAssistant({
        message: text,
        context: ctx,
        history: newHistory,
      });

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: res.actions,
        suggestedPrompts: res.suggested_prompts,
        moduleContext: res.module_context || currentDoc.name,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[AiraAssistant] Error generating response:', err);
      setError('I encountered an issue processing your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    const resetMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content:
        `**Chat history cleared.**\n\n` +
        `I am your guide to **${currentDoc.name}**. How can I help you?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedPrompts: currentDoc.suggestedPrompts,
      actions: currentDoc.defaultActions,
      moduleContext: currentDoc.name,
    };
    setMessages([resetMsg]);
    setError(null);
  };

  const handleActionClick = (action: AssistantAction) => {
    if (action.type === 'NAVIGATE' && action.route) {
      navigate(action.route);
    } else if (action.type === 'EXPLAIN' && action.prompt) {
      handleSend(action.prompt);
    }
  };

  // Render markdown-like simple text formatting
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="assistant-message-content">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="assistant-heading">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('**') && line.endsWith('**')) {
            return (
              <p key={idx} className="assistant-bold-lead">
                {line.slice(2, -2)}
              </p>
            );
          }
          if (line.startsWith('• ') || line.startsWith('- ')) {
            return (
              <div key={idx} className="assistant-bullet">
                <span className="bullet-dot" />
                <span>{line.slice(2)}</span>
              </div>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="assistant-spacer" />;
          }
          return <p key={idx}>{line}</p>;
        })}
      </div>
    );
  };

  return (
    <>
      {/* ─── 1. Collapsed Floating Trigger ─── */}
      {!isAssistantOpen && (
        <button
          className="aira-assistant-floating-btn"
          onClick={() => setAssistantOpen(true)}
          title="Ask Aira — Recover More. Do More."
          aria-label="Ask Aira Assistant"
        >
          <div className="pulse-glow-ring" />
          <div className="btn-inner">
            <img src={symbolMark} alt="AIRA" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            <span className="btn-label">Ask Aira</span>
          </div>
        </button>
      )}

      {/* ─── 2. Expanded Assistant Panel ─── */}
      {isAssistantOpen && (
        <div className={`aira-assistant-panel ${minimized ? 'minimized' : ''}`}>
          {/* Header */}
          <div className="assistant-header">
            <div className="header-left">
              <div className="assistant-avatar">
                <img src={symbolMark} alt="AIRA" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
              </div>
              <div className="header-titles">
                <div className="title-row">
                  <span className="title-name">Aira Assistant</span>
                  <span className="live-status-pill">
                    <span className="live-dot" />
                    Ready
                  </span>
                </div>
                <span className="subtitle-text">Recover More. Do More.</span>
              </div>
            </div>

            <div className="header-actions">
              <button
                className="header-icon-btn"
                onClick={handleClearChat}
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                <RotateCcw size={15} />
              </button>
              <button
                className="header-icon-btn"
                onClick={() => setMinimized(!minimized)}
                title={minimized ? 'Expand' : 'Minimize'}
                aria-label={minimized ? 'Expand' : 'Minimize'}
              >
                {minimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
              </button>
              <button
                className="header-icon-btn close-btn"
                onClick={() => setAssistantOpen(false)}
                title="Close Aira Assistant"
                aria-label="Close Aira Assistant"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Module Context Bar */}
          {!minimized && (
            <div className="assistant-context-bar">
              <div className="context-pill">
                <Compass size={13} className="text-cyan" />
                <span>Viewing: <strong>{currentDoc.name}</strong></span>
              </div>
              <button
                className="explain-current-btn"
                onClick={() => handleSend(`Explain the ${currentDoc.name} screen I'm viewing`)}
                title="Explain current screen"
              >
                <Zap size={12} />
                <span>Explain Screen</span>
              </button>
            </div>
          )}

          {/* Body / Message Stream */}
          {!minimized && (
            <div className="assistant-body">
              <div className="messages-stream">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-bubble-wrapper ${msg.role === 'user' ? 'user-msg' : 'assistant-msg'}`}
                  >
                    <div className="message-header-meta">
                      <span className="msg-author">
                        {msg.role === 'user' ? 'You' : 'Aira Copilot'}
                      </span>
                      <span className="msg-time">{msg.timestamp}</span>
                    </div>

                    <div className="message-bubble">
                      {renderFormattedContent(msg.content)}

                      {/* Interactive Actions */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="assistant-actions-container">
                          {msg.actions.map((act, aIdx) => (
                            <button
                              key={aIdx}
                              className="assistant-action-chip"
                              onClick={() => handleActionClick(act)}
                            >
                              <span>{act.label}</span>
                              <ArrowRight size={13} />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Suggested Follow-up Prompts */}
                      {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                        <div className="suggested-prompts-wrapper">
                          <span className="prompt-header-label">
                            <HelpCircle size={12} /> Suggested prompts:
                          </span>
                          <div className="prompts-grid">
                            {msg.suggestedPrompts.map((prompt, pIdx) => (
                              <button
                                key={pIdx}
                                className="suggested-prompt-btn"
                                onClick={() => handleSend(prompt)}
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading typing indicator */}
                {loading && (
                  <div className="message-bubble-wrapper assistant-msg">
                    <div className="message-header-meta">
                      <span className="msg-author">Aira Copilot</span>
                      <span className="msg-time">Thinking...</span>
                    </div>
                    <div className="message-bubble loading-bubble">
                      <div className="typing-indicator">
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className="typing-text">Aira is analyzing payment intelligence...</span>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="assistant-error-card">
                    <p>{error}</p>
                    <button
                      className="retry-btn"
                      onClick={() => handleSend(messages[messages.length - 1]?.content)}
                    >
                      Try again
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="assistant-footer">
                <form onSubmit={handleFormSubmit} className="assistant-input-form">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask about ${currentDoc.name} or payment recovery...`}
                    className="assistant-input-field"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="assistant-send-btn"
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                </form>

                <div className="assistant-footer-meta">
                  <div className="compliance-tag">
                    <ShieldCheck size={11} className="text-emerald" />
                    <span>RBI & TRAI Policy Governor Enabled</span>
                  </div>
                  <span className="shortcut-hint">↵ to send</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
