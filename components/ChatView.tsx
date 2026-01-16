
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem } from '../types';
import { Send, Bot, User, Trash2, Sparkles, Loader2, StopCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

const SUGGESTED_QUERIES = [
  "Summarize the sales trend for the last 3 fiscal years.",
  "What is the total value of closing stock?",
  "Which customers have the highest pending orders?",
  "List items with stock less than pending orders.",
  "Show me pending POs that are overdue.",
  "Who are my top 5 customers by sales value?"
];

interface ChatViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  salesReportItems: SalesReportItem[];
  customers: CustomerMasterItem[];
  isAdmin?: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  salesReportItems,
  customers,
  isAdmin = false
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

  const generateSafeId = (): string => {
    return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
  };

  const fiscalYearSummary = useMemo(() => {
    const fyTotals: Record<string, number> = {};
    salesReportItems.forEach(item => {
      let dateObj: Date;
      const rawDate = item.date as any;
      if (rawDate instanceof Date) {
        dateObj = rawDate;
      } else if (typeof rawDate === 'string') {
        dateObj = new Date(rawDate);
      } else if (typeof rawDate === 'number') {
        // Excel serial date: days since 1900-01-01 (with 1900 leap year bug, offset is 25568)
        dateObj = new Date((Math.round(Number(rawDate)) - 25568) * 86400 * 1000);
      } else {
        // Default fallback
        dateObj = new Date(rawDate);
      }

      // Final sanity nudge for Date objects to handle 23:59:59 precision issues
      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        dateObj = new Date(dateObj.getTime() + (12 * 60 * 60 * 1000));
      }

      if (!isNaN(dateObj.getTime())) {
        const month = dateObj.getMonth();
        const year = dateObj.getFullYear();
        const startYear = month >= 3 ? year : year - 1;
        const fy = `${startYear}-${(startYear + 1).toString().slice(-2)}`;
        fyTotals[fy] = (fyTotals[fy] || 0) + (item.value || 0);
      }
    });
    return Object.entries(fyTotals)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([fy, total]) => `${fy}: Rs. ${Math.round(total).toLocaleString('en-IN')}`)
      .join('\n');
  }, [salesReportItems]);

  const prepareContext = () => {
    // Build a comprehensive item-level context for all materials to allow specific queries (like part numbers)
    const itemContextMap = new Map<string, { desc: string, stock: number, so: number, po: number, free: number }>();

    // Initialize with materials to ensure we have partNo mapping
    materials.forEach(m => {
      const p = (m.partNo || '').trim();
      const d = (m.description || '').trim();
      if (p || d) {
        const key = p || d;
        itemContextMap.set(key.toLowerCase(), { desc: d, stock: 0, so: 0, po: 0, free: 0 });
      }
    });

    // Populate Stock
    closingStock.forEach(s => {
      const d = (s.description || '').trim().toLowerCase();
      const entry = itemContextMap.get(d) || { desc: s.description, stock: 0, so: 0, po: 0, free: 0 };
      entry.stock += s.quantity || 0;
      itemContextMap.set(d, entry);
    });

    // Populate Pending SO
    pendingSO.forEach(so => {
      const d = (so.itemName || '').trim().toLowerCase();
      const p = (so.partNo || '').trim().toLowerCase();
      const key = itemContextMap.has(p) ? p : (itemContextMap.has(d) ? d : d);
      const entry = itemContextMap.get(key) || { desc: so.itemName, stock: 0, so: 0, po: 0, free: 0 };
      entry.so += so.balanceQty || 0;
      itemContextMap.set(key, entry);
    });

    // Populate Pending PO
    pendingPO.forEach(po => {
      const d = (po.itemName || '').trim().toLowerCase();
      const p = (po.partNo || '').trim().toLowerCase();
      const key = itemContextMap.has(p) ? p : (itemContextMap.has(d) ? d : d);
      const entry = itemContextMap.get(key) || { desc: po.itemName, stock: 0, so: 0, po: 0, free: 0 };
      entry.po += po.balanceQty || 0;
      itemContextMap.set(key, entry);
    });

    // Calculate Free Stock for top 500 items (to stay within context limits)
    const itemSnapshots = Array.from(itemContextMap.entries())
      .map(([key, data]) => {
        data.free = data.stock + data.po - data.so;
        return `Item/Part: ${key} | Desc: ${data.desc} | Stock: ${data.stock} | Pending SO: ${data.so} | Pending PO: ${data.po} | Free: ${data.free}`;
      })
      .slice(0, 500)
      .join('\n');

    return `You are an intelligent data analyst for Siddhi Kabel Corp. 
    CURRENT BUSINESS RULES for Stock Planning:
    1. Categories: FAST RUNNER (9+ active months), SLOW RUNNER (3+), NON-MOVING (new/stale).
    2. Strategy: GENERAL STOCK (Planned buffer), AGAINST ORDER / MADE TO ORDER (Order-specific).
    3. PLANNING RULE: For NON-MOVING, AGAINST ORDER, or MADE TO ORDER items, additional buffer qty is ZERO. 
       The PO Need (Requirement) for these items is strictly: SO - (Stock + Pending PO).
    
    HISTORICAL SALES TREND (Last 3 FYs):
    ${fiscalYearSummary || 'No aggregate data available'}

    DETAILED ITEM SNAPSHOTS (Stock, SO, PO, Free Stock):
    ${itemSnapshots}

    RULES:
    - If a user asks about a specific Part Number or Item, use the DETAILED ITEM SNAPSHOTS to provide exact numbers.
    - Total Stock = Current on-hand quantity.
    - Pending SO Qty = Total balance quantity from all open sales orders.
    - Free stock = Total Stock + Pending PO - Pending SO.
    - Format response as a clean Markdown table for clarity.
    - Be concise and professional.`;
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: generateSafeId(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Vite uses import.meta.env for environment variables.
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey || apiKey === '') {
        throw new Error("Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your .env file.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: prepareContext()
      });

      const chat = model.startChat({
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }))
      });

      const result = await chat.sendMessage(text);
      const response = await result.response;
      const responseText = response.text() || "I'm sorry, I couldn't generate a response.";

      const aiMsg: Message = { id: generateSafeId(), role: 'model', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMsg: Message = {
        id: generateSafeId(),
        role: 'model',
        content: `Error: ${error.message || "Failed to connect to AI engine."}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (confirm("Clear chat history?")) setMessages([]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Sparkles className="w-5 h-5" /></div>
          <div><h2 className="text-sm font-bold text-gray-800">AI Data Analyst</h2><p className="text-[10px] text-gray-500">Analytics powered by Gemini 1.5 Flash</p></div>
        </div>
        <button onClick={handleClear} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-60">
            <Bot className="w-12 h-12 text-gray-300 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUERIES.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)} className="text-xs text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-all">{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (<div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"><Sparkles className="w-4 h-4 text-white" /></div>)}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
              {msg.role === 'model' ? (<div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\|/g, '&nbsp;|&nbsp;') }} />) : (msg.content)}
            </div>
            {msg.role === 'user' && (<div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1"><User className="w-4 h-4 text-gray-500" /></div>)}
          </div>
        ))}
        {isLoading && (<div className="flex gap-3 justify-start"><div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1"><Loader2 className="w-4 h-4 text-white animate-spin" /></div><div className="bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span></div></div>)}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2 relative">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()} placeholder="Analyze data..." className="flex-1 bg-gray-50 text-sm border border-gray-300 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={isLoading} />
          <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            {isLoading ? <StopCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
