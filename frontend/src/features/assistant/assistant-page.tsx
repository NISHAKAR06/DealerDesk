import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Send,
  User,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  CheckCircle2,
  Wrench,
  Package,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useDealers } from '@/hooks/use-dealers';
import { useProducts } from '@/hooks/use-products';
import { AssistantResponse, AssistantToolCall, AssistantAction } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StockBadge } from '@/components/common/status-badge';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { formatCurrency, parseApiError } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  citedSkus?: string[];
  toolCalls?: AssistantToolCall[];
  actions?: AssistantAction[];
  timestamp: Date;
  isError?: boolean;
}

const SUGGESTED_PROMPTS = [
  'Find brake pads for Bajaj Pulsar 150',
  'Check stock for BRK-1044',
  'Find alternatives for TVS Apache RTR 160',
  'Create a draft order for 2x BRK-1044',
];

export const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Maintain persistent session ID for conversational memory
  const [sessionId] = useState<string>(() => {
    return `sess-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
  });

  const [selectedDealerId, setSelectedDealerId] = useState<number>(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [clearDialogOpen, setClearDialogOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch dealers for selector
  const { data: dealersData } = useDealers({ page_size: 100 });

  // Pre-fetch some catalogue products to enrich cited_skus cards
  const { data: productsData } = useProducts({ page_size: 100 });
  const productsMap = React.useMemo(() => {
    const map = new Map<string, any>();
    productsData?.results?.forEach((p) => map.set(p.sku, p));
    return map;
  }, [productsData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessageId = Math.random().toString(36).substring(2, 9);
    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response: AssistantResponse = await apiClient.assistant.chat({
        session_id: sessionId,
        dealer_id: selectedDealerId,
        message: text,
      });

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'assistant',
        content: response.reply,
        citedSkus: response.cited_skus || [],
        toolCalls: response.tool_calls || [],
        actions: response.actions || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message, `Assistant API Error (${parsed.code})`);

      const errorAssistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'assistant',
        content: `Error (${parsed.code}): ${parsed.message}`,
        isError: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.info('Response copied to clipboard.');
  };

  const handleClearChat = () => {
    setMessages([]);
    setClearDialogOpen(false);
    toast.info('Conversation history cleared.');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-5xl mx-auto space-y-4">
      {/* Top Bar with Contextual Dealer Selector & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Dealer Assistant
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-normal">
                LLM Tool Agent
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Session Memory ID: <code className="font-mono text-slate-700">{sessionId}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dealer Selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="dealer-context-select" className="text-xs text-slate-500 font-medium hidden md:inline">Acting Dealer:</label>
            <select
              id="dealer-context-select"
              value={selectedDealerId}
              onChange={(e) => setSelectedDealerId(Number(e.target.value))}
              disabled={isLoading}
              className="h-8 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {dealersData?.results?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.dealer_code})
                </option>
              )) || <option value={1}>Default Dealer #1</option>}
            </select>
          </div>

          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
              className="h-8 px-2.5 text-xs text-slate-600 gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Chat Messages Scrolling Container */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto">
            <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Automotive Parts &amp; Orders Assistant
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Ask about OEM parts fitment, check live warehouse stock levels, discover compatible alternatives, or create draft requisitions for dealers.
            </p>

            {/* Suggested Prompts */}
            <div className="w-full space-y-2 text-left">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                Suggested Operational Prompts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="p-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-md hover:border-indigo-400 hover:text-indigo-600 text-left transition-colors shadow-sm"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-lg p-4 space-y-2.5 ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white'
                      : msg.isError
                      ? 'bg-rose-50 border border-rose-200 text-rose-900'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  {/* Tool execution pills if assistant made tool calls */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Wrench className="h-3 w-3" /> Tools Invoked:
                      </span>
                      {msg.toolCalls.map((tc, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          {tc.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message body */}
                  <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>

                  {/* Cited SKUs Compact Cards */}
                  {msg.citedSkus && msg.citedSkus.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Package className="h-3 w-3" /> Cited Catalogue Parts:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.citedSkus.map((sku) => {
                          const part = productsMap.get(sku);
                          return (
                            <div
                              key={sku}
                              className="p-2.5 rounded border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                            >
                              <div className="flex justify-between items-start">
                                <span className="font-mono font-bold text-slate-900">{sku}</span>
                                {part && <StockBadge stock={part.stock} />}
                              </div>
                              <div className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                                {part?.name || 'OEM Automotive Part'}
                              </div>
                              {part && (
                                <div className="text-[11px] font-mono text-indigo-700 mt-1">
                                  {formatCurrency(part.price)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Created Actions / Order Link */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      {msg.actions.map((act, idx) => {
                        if (act.type === 'draft_order_created' && act.order_number) {
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>
                                  Draft order created: <strong className="font-mono">{act.order_number}</strong>
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/orders/${act.order_number}`)}
                                className="h-6 px-2 text-[11px] bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100 gap-1"
                              >
                                View Order
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Message Footer / Copy */}
                  {msg.sender === 'assistant' && !msg.isError && (
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 text-xs justify-start">
                <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Processing catalogue query and executing backend tools...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </Card>

      {/* Message Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm shrink-0"
      >
        <input
          type="text"
          placeholder="Ask Dealer Assistant about parts, stock, vehicle fitment, or draft orders..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-xs text-slate-900 bg-transparent placeholder:text-slate-400 focus:outline-none"
        />

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!inputMessage.trim() || isLoading}
          className="gap-1.5 h-8 px-3.5"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </Button>
      </form>

      {/* Confirmation Dialog to Clear Conversation */}
      <ConfirmDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Clear Conversation History"
        description="Are you sure you want to clear this chat session? This will remove all previous messages from the current view."
        confirmLabel="Clear Conversation"
        onConfirm={handleClearChat}
      />
    </div>
  );
};
