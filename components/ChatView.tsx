
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem } from '../types';
import { Send, Bot, User, Trash2, Sparkles, Loader2, StopCircle, Hash } from 'lucide-react';

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
  "Summarize sales for voucher number [Type Number]",
  "Who are the top 5 customers by voucher value?",
  "Show me the latest 10 sales vouchers.",
  "Which items have the highest quantity in recent vouchers?",
  "Show me the sales trend for the last 3 months.",
  "Check stock status for items in pending orders."
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
    const stockContext = closingStock.slice(0, 300).map(i => `${i.description} (Qty: ${i.quantity}, Val: ${i.value})`).join('\n');
    const soContext = pendingSO.slice(0, 200).map(i => `Order: ${i.orderNo}, Party: ${i.partyName}, Item: ${i.itemName}, Bal Qty: ${i.balanceQty}, Val: ${i.value}, Due: ${i.dueDate}`).join('\n');
    const poContext = pendingPO.slice(0, 200).map(i => `Order: ${i.orderNo}, Vendor: ${i.partyName}, Item: ${i.itemName}, Bal Qty: ${i.balanceQty}, Val: ${i.value}, Due: ${i.dueDate}`).join('\n');
    const custContext = customers.slice(0, 300).map(c => `${c.customerName} (Group: ${c.group}, Status: ${c.status})`).join('\n');
    
    // Emphasis on Voucher data
    const recentSales = salesReportItems.slice(0, 300).map(s => `Vch: ${s.voucherNo}, Date: ${s.date}, Cust: ${s.customerName}, Item: ${s.particulars}, Qty: ${s.quantity}, Val: ${s.value}`).join('\n');

    return `
      You are an intelligent data assistant for "Siddhi Reports".
      Answer based STRICTLY on the business data provided below. Use Markdown tables for lists.
      
      REPORTING PRIORITIES:
      - Sales data is from the "sales_report_voucher" table.
      - "Net Stock" = (Closing Stock + Pending PO - Pending SO).
      - You can provide summaries by Voucher Number, Customer, Item, or Date.
      - If a user asks for a specific voucher, list all items and the total value for that voucher.

      1. CLOSING STOCK (TOP 300): ${stockContext}
      2. PENDING SO (TOP 200): ${soContext}
      3. PENDING PO (TOP 200): ${poContext}
      4. CUSTOMERS (TOP 300): ${custContext}
      5. SALES VOUCHERS (LATEST 300): ${recentSales}
    `;
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Guidelines: Always initialize GoogleGenAI inside the event handler with named parameters
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: prepareContext()
        }
      });

      const result = await chat.sendMessage({ message: text });
      // Guidelines: Access .text property directly
      const responseText = result.text || "No response received.";

      const aiMsg: Message = { id: crypto.randomUUID(), role: 'model', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("AI Assistant Error:", error);
      const errorMsg: Message = { 
        id: crypto.randomUUID(), 
        role: 'model', 
        content: "I encountered an error connecting to the AI brain. Please check your network or API settings.", 
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
      <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-2 rounded-lg"><Sparkles className="w-5 h-5 text-indigo-600" /></div>
          <div><h2 className="text-sm font-bold text-gray-800">Siddhi AI Assistant</h2><p className="text-[10px] text-gray-500">Sales Vouchers & Data Analysis</p></div>
        </div>
        <button onClick={handleClear} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-60">
            <Bot className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-500">How can I help you with your sales vouchers today?</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUERIES.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)} className="text-xs text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all flex items-start gap-2">
                  <Hash className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"><Sparkles className="w-4 h-4 text-white" /></div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none prose prose-sm max-w-none'}`}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1"><User className="w-4 h-4 text-gray-500" /></div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
             <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"><Loader2 className="w-4 h-4 text-white animate-spin" /></div>
              <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Search vouchers, summarize sales, check net stock..."
            className="flex-1 bg-gray-50 text-sm border border-gray-300 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
            disabled={isLoading}
          />
          <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
            {isLoading ? <StopCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
