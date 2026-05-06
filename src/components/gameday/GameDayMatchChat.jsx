import { useState, useEffect, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GameDayMatchChat({ game, myClub, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const channelId = `match_${game.id}`;

  useEffect(() => {
    async function load() {
      // Fetch existing messages
      const msgs = await stageClient.entities.ChatMessage.filter(
        { channel: "match_schedule", club_id: game.home_club_id },
        "-created_date",
        100
      );
      setMessages(msgs || []);
      setLoading(false);
    }
    load();

    // Subscribe to new messages
    const unsub = stageClient.entities.ChatMessage.subscribe((event) => {
      if (event.type === "create") {
        setMessages(prev => [event.data, ...prev]);
      }
    });

    return () => unsub();
  }, [game]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await stageClient.entities.ChatMessage.create({
        channel: "match_schedule",
        club_id: myClub.id,
        sender_email: user.email,
        sender_name: user.full_name,
        sender_avatar: "",
        content: newMessage,
      });
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-[400px] gap-3">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No messages yet</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                "px-3 py-2 rounded-lg text-xs",
                msg.sender_email === user.email
                  ? "bg-primary/10 text-primary ml-6"
                  : "bg-secondary/40 text-foreground mr-6"
              )}
            >
              <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">
                {msg.sender_name}
              </p>
              <p>{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Message..."
          className="flex-1 px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm placeholder:text-muted-foreground outline-none focus:border-primary/30"
        />
        <Button size="icon" type="submit" variant="ghost" className="text-primary hover:bg-primary/10">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}