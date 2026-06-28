import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
role: 'user' | 'assistant';
content: string;
}

export function SidebarChatbot({ collapsed }: { collapsed: boolean }) {
const [isOpen, setIsOpen] = useState(false);
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [messages, setMessages] = useState<Message[]>([
{ role: 'assistant', content: 'Hello! I am your NEET AI assistant. How can I help you today?' }
]);

const scrollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
if (scrollRef.current) {
scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
}
}, [messages, isLoading]);

const handleSend = async () => {
if (!input.trim() || isLoading) return;

const userMsg = input.trim();  
setInput('');  
setMessages(prev => [...prev, { role: 'user', content: userMsg }]);  
setIsLoading(true);  

try {  
  // 100% Free AI API - Pollinations AI (No Key Required)  
  const systemPrompt = "You are a helpful NEET Exam Assistant for neetverse. Provide accurate information about Physics, Chemistry, and Biology for NEET preparation. Keep responses concise and helpful.";  
  const encodedPrompt = encodeURIComponent(userMsg);  
  const url = `https://text.pollinations.ai/${encodedPrompt}?model=openai&system=${encodeURIComponent(systemPrompt)}`;  

  const response = await fetch(url);  
    
  if (!response.ok) throw new Error('Failed to get response');  
    
  const data = await response.text();  
    
  setMessages(prev => [...prev, { role: 'assistant', content: data || "I'm sorry, I couldn't process that. Please try again." }]);  
} catch (error) {  
  console.error('Chatbot Error:', error);  
  toast.error('AI is currently busy. Please try again later.');  
  setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to AI. Please check your internet or try again later." }]);  
} finally {  
  setIsLoading(false);  
}

};

return (
<div className="px-2 mt-2">
<Popover open={isOpen} onOpenChange={setIsOpen}>
<PopoverTrigger asChild>
<button
className={cn(
"w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20",
collapsed && "justify-center px-2"
)}
>
<Bot className="w-5 h-5 flex-shrink-0" />
{!collapsed && (
<div className="flex flex-col text-left">
<span className="text-sm font-bold leading-tight">NEET AI Chat</span>
<span className="text-[10px] text-muted-foreground">100% Free Assistant</span>
</div>
)}
</button>
</PopoverTrigger>
<PopoverContent
side={collapsed ? "right" : "top"}
align={collapsed ? "start" : "center"}
className="w-80 p-0 overflow-hidden border-border shadow-2xl rounded-2xl"
sideOffset={10}
>
<div className="bg-primary p-4 text-primary-foreground flex items-center justify-between">
<div className="flex items-center gap-2">
<Bot className="w-5 h-5" />
<span className="font-semibold">NEETVerse AI</span>
</div>
<Button
variant="ghost"
size="icon"
className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
onClick={() => setIsOpen(false)}
>
<X className="w-4 h-4" />
</Button>
</div>

<ScrollArea className="h-80 p-4 bg-background" ref={scrollRef}>  
        <div className="space-y-4">  
          {messages.map((msg, i) => (  
            <div key={i} className={cn("flex gap-2", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>  
              <div className={cn(  
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",  
                msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"  
              )}>  
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}  
              </div>  
              <div className={cn(  
                "p-3 rounded-2xl text-xs max-w-[85%]",  
                msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"  
              )}>  
                {msg.content}  
              </div>  
            </div>  
          ))}  
          {isLoading && (  
            <div className="flex gap-2">  
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">  
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />  
              </div>  
              <div className="bg-muted p-3 rounded-2xl rounded-tl-none text-xs">  
                Thinking...  
              </div>  
            </div>  
          )}  
        </div>  
      </ScrollArea>  

      <div className="p-3 border-t bg-muted/30">  
        <div className="flex gap-2">  
          <Input  
            value={input}  
            onChange={(e) => setInput(e.target.value)}  
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}  
            placeholder="Ask anything..."  
            className="h-9 text-xs rounded-xl"  
            disabled={isLoading}  
          />  
          <Button   
            size="icon"   
            className="h-9 w-9 rounded-xl shrink-0"   
            onClick={handleSend}  
            disabled={isLoading || !input.trim()}  
          >  
            <Send className="w-4 h-4" />  
          </Button>  
        </div>  
        <p className="text-[9px] text-center mt-2 text-muted-foreground flex items-center justify-center gap-1">  
          <Sparkles className="w-2.5 h-2.5" /> Powered by Free AI  
        </p>  
      </div>  
    </PopoverContent>  
  </Popover>  
</div>

);
}
