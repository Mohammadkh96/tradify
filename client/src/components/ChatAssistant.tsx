import { useState } from "react";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: "Hello! I'm your Tradify Assistant. How can I help you navigate the platform today?" }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', content: input }]);
    setInput("");
    
    // Simple response logic for demonstration
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm currently in demo mode. I can explain how to sync your MT5 account or how to interpret your win rate metrics once you have 20+ trades." 
      }]);
    }, 1000);
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/40 border-2 border-emerald-400/20 flex items-center justify-center group"
          size="icon"
        >
          {isOpen ? <X size={24} /> : <MessageSquare size={24} className="group-hover:scale-110 transition-transform" />}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-[#020617] animate-pulse" />
        </Button>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[350px] sm:w-[400px]"
          >
            <Card className="bg-slate-950 border-slate-800 shadow-2xl overflow-hidden">
              <CardHeader className="bg-slate-900 border-b border-slate-800 p-4">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Sparkles size={14} className="text-white" />
                  </div>
                  Tradify Assistant
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[400px] flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans">
                    {messages.map((m, i) => (
                      <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed",
                          m.role === 'user' ? "bg-emerald-500 text-slate-950 rounded-tr-none" : "bg-slate-900 text-slate-300 rounded-tl-none border border-slate-800"
                        )}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask about your metrics..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <Button size="icon" onClick={handleSend} className="bg-emerald-500 hover:bg-emerald-400">
                      <Send size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
