import { useState } from "react";
import { TrendingUp, X, Send } from "lucide-react";
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
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40 border-2 border-primary-foreground/20 flex items-center justify-center group p-0"
          size="icon"
        >
          {isOpen ? <X size={24} /> : <TrendingUp size={28} strokeWidth={3} className="text-primary-foreground group-hover:scale-110 transition-transform" />}
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
            <Card className="bg-card border-border shadow-2xl overflow-hidden">
              <CardHeader className="bg-muted/50 border-b border-border p-4">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                    <TrendingUp size={14} strokeWidth={3} className="text-primary-foreground" />
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
                          "max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                          m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none border border-border"
                        )}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-border bg-background flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask about your metrics..."
                      className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                    <Button size="icon" onClick={handleSend} className="bg-primary hover:bg-primary/90">
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
