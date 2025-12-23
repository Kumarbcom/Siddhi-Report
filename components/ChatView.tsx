
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  "Summarize the sales trend for the last 3 fiscal years.",
  "What is the total value of closing stock?",
  "Which customers have the highest pending orders?",
  "List items with stock less than pending orders.",
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

  const fiscalYearSummary = useMemo(() => {
    const fyTotals: Record<string, number> = {};
    salesReportItems.forEach(item => {
        let dateObj: Date;
        // Fix: Use any cast to allow checking for Date or number which can come from mixed data sources like Excel imports
        const rawDate = item.date as any;
        if (rawDate instanceof Date) {
          dateObj = rawDate;
        } else if (typeof rawDate === 'string') {
          dateObj = new Date(rawDate);
        } else {
          // Handle Excel serial date if passed as number
          dateObj = new Date((Number(rawDate) - (25567 + 2)) * 86400 * 1000);
        }
        
        if (!isNaN(dateObj.getTime())) {
            const month = dateObj.getMonth();
            const year = dateObj.getFullYear();
            const startYear = month >= 3 ? year : year - 1;
            const fy = `${startYear}-${startYear + 1}`;
            fyTotals[fy] = (fyTotals[fy] || 0) + (item.value || 0);
        }
    });
    return Object.entries(fyTotals)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([fy, total]) => `${fy}: Rs. ${Math.round(total).toLocaleString('en-IN')}`)
      .join('\n');
  }, [salesReportItems]);

  const prepareContext = () => {
    const stockContext = closingStock.slice(0, 100).map(i => `${i.description} (Qty: ${i.quantity}, Val: ${i.value})`).join('\n');
    const soContext = pendingSO.slice(0, 100).map(i => `Order: ${i.orderNo}, Party: ${i.partyName}, Item: ${i.itemName}, Qty: ${i.balanceQty}, Val: ${i.value}`).join('\n');
    const poContext = pendingPO.slice(0, 100).map(i => `Order: ${i.orderNo}, Vendor: ${i.partyName}, Item: ${i.itemName}, Qty: ${i.balanceQty}, Val: ${i.value}`).join('\n');
    const custContext = customers.slice(0, 100).map(c => `${c.customerName} (Status: ${c.status})`).join('\n');
    const recentSales = salesReportItems.slice(0, 50).map(s => `Date: ${s.date}, Cust: ${s.customerName}, Item: ${s.particulars}, Qty: ${s.quantity}, Val: ${s.value}`).join('\n');

    return `You are an intelligent data analyst for Siddhi Kabel Corp. 
    HISTORICAL SALES TREND (Last 3 FYs):
    ${fiscalYearSummary || 'No aggregate data available'}

    REAL-TIME SNAPSHOTS (Limited to top 100 records for brevity):
    --- STOCK ---
    ${stockContext}
    --- PENDING SALES ORDERS ---
    ${soContext}
    --- PENDING PURCHASE ORDERS ---
    ${poContext}
    --- CUSTOMERS ---
    ${custContext}
    --- RECENT 50 SALES ---
    ${recentSales}

    RULES:
    - Format lists as Markdown tables.
    - Double check math for totals.
    - Net Stock = Closing Stock + Pending PO - Pending SO.
    - When asked about trends, use the HISTORICAL SALES TREND totals provided above.
    - Be concise and professional.`;
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Using named parameter for apiKey and direct initialization as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Create chat session as per GenAI SDK guidelines for Chat tasks
      const chat: Chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: prepareContext(),
        },
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }))
      });

      const response: GenerateContentResponse = await chat.sendMessage({ message: text });
      // Use .text property to extract response string
      const responseText = response.text || "I'm sorry, I couldn't generate a response.";

      const aiMsg: Message = { id: crypto.randomUUID(), role: 'model', content: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMsg: Message = { 
        id: crypto.randomUUID(), 
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
    if(confirm("Clear chat history?")) setMessages([]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200">
      <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Sparkles className="w-5 h-5" /></div>
          <div><h2 className="text-sm font-bold text-gray-800">AI Data Analyst</h2><p className="text-[10px] text-gray-500">Analytics powered by Gemini 3 Pro</p></div>
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
