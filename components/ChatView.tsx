
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem } from '../types';
import { Send, Bot, User, Trash2, Sparkles, Loader2, StopCircle } from 'lucide-react';

interface ChatViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  salesReportItems: SalesReportItem[];
  customers: CustomerMasterItem[];
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

const SUGGESTED_QUERIES = [
  "What is the total value of closing stock?",
  "Which customers have the highest pending orders?",
  "List items with stock less than pending orders.",
  "What is the sales trend for the last 3 months?",
  "Show me pending POs that are overdue.",
  "Who are my top 5 customers by sales value?"
];

const ChatView: React.FC<ChatViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  salesReportItems,
  customers
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const prepareContext = () => {
    // We optimize the data to fit into the context window by mapping only essential fields
    // and limiting historical data if necessary.
    
    const stockContext = closingStock.map(i => `${i.description} (Qty: ${i.quantity}, Val: ${i.value})`).join('\n');
    
    const soContext = pendingSO.map(i => 
      `Order: ${i.orderNo}, Party: ${i.partyName}, Item: ${i.itemName}, Bal Qty: ${i.balanceQty}, Val: ${i.value}, Due: ${i.dueDate}`
    ).join('\n');

    const poContext = pendingPO.map(i => 
      `Order: ${i.orderNo}, Vendor: ${i.partyName}, Item: ${i.itemName}, Bal Qty: ${i.balanceQty}, Val: ${i.value}, Due: ${i.dueDate}`
    ).join('\n');

    const custContext = customers.map(c => `${c.customerName} (Group: ${c.group}, Status: ${c.status})`).join('\n');

    // For sales, we might have thousands of rows. Let's send the last 200 transactions.
    const recentSales = salesReportItems.slice(0, 200).map(s => 
      `Date: ${s.salesDate}, Cust: ${s.customerName}, Item: ${s.materialCode}, Qty: ${s.quantity}, Val: ${s.value}`
    ).join('\n');

    return `
      You are an intelligent assistant for a Sales & Inventory Management System.
      You have access to the following REAL-TIME database snapshots:

      1. CLOSING STOCK (Inventory):
      ${stockContext.substring(0, 20000)}...

      2. PENDING SALES ORDERS (Customer Demand):
      ${soContext.substring(0, 20000)}...

      3. PENDING PURCHASE ORDERS (Incoming Supply):
      ${poContext.substring(0, 10000)}...

      4. CUSTOMER MASTER:
      ${custContext.substring(0, 10000)}...

      5. RECENT SALES TRANSACTIONS (Sample):
      ${recentSales}

      RULES:
      - Answer based STRICTLY on the data provided above.
      - If calculating totals, double-check your math.
      - When asked for lists, format them as Markdown tables.
      - "Net Stock" or "Availability" usually means (Closing Stock + Pending PO - Pending SO).
      - If the data is ambiguous, say so.
      - Be concise and professional.
    `;
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      // Initialize AI instance right before the call to ensure latest API key
      const ai = new GoogleGenAI({ apiKey });
      
      const chatHistory = messages.map(m => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.content }]
      }));

      // Using ai.chats.create for conversational interaction as per guidelines
      const chat: Chat = ai.chats.create({ 
        model: "gemini-3-pro-preview", // Upgraded to Pro for complex data reasoning
        config: {
          systemInstruction: prepareContext()
        },
        history: chatHistory
      });

      // chat.sendMessage accepts a message object
      const response: GenerateContentResponse = await chat.sendMessage({ message: text });
      // text is a property, not a method
      const responseText = response.text || '';

      const aiMsg: Message = { id: crypto.randomUUID(), role: 'model', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("AI Error:", error);
      const errorMsg: Message = { 
        id: crypto.randomUUID(), 
        role: 'model', 
        content: "I'm sorry, I encountered an error connecting to the intelligence engine. Please check your API key or internet connection.", 
        timestamp: Date.now() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if(confirm("Clear chat history?")) {
        setMessages([]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      {/* Header */}
      <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">AI Data Assistant</h2>
            <p className="text-[10px] text-gray-500">Ask questions about your Inventory, Sales, and Orders</p>
          </div>
        </div>
        <button onClick={handleClear} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-100" title="Clear History">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-60">
            <Bot className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-500">How can I help you analyze your data today?</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUERIES.map((q, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSend(q)}
                  className="text-xs text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none prose prose-sm max-w-none'
            }`}>
              {msg.role === 'model' ? (
                <div dangerouslySetInnerHTML={{ 
                  __html: msg.content
                    .replace(/\n/g, '<br />')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                    .replace(/\|/g, '&nbsp;|&nbsp;') // Simple table hack for visualization
                }} />
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
             <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Ask about stock, pending orders, or sales trends..."
            className="flex-1 bg-gray-50 text-sm border border-gray-300 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
            disabled={isLoading}
          />
          <button 
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isLoading ? <StopCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-2">
          AI generated responses may vary. Cross-check with tables for critical decisions.
        </p>
      </div>
    </div>
  );
};

export default ChatView;
