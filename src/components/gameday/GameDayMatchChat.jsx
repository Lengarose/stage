import { useState, useEffect, useRef, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { CHANNELS, makeChannel, setSocketListeners, offSocketListeners } from "@/lib/SocketContext";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function sortMessages(msgs) {
  return [...msgs].sort(
    (a, b) => new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime()
  );
}

export default function GameDayMatchChat({ game, myClub, myPlayer, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef(null);

  const senderLabel =
    user?.full_name ||
    user?.name ||
    myPlayer?.gamertag ||
    myClub?.name ||
    user?.email ||
    "Player";

  const loadMessages = useCallback(async () => {
    const msgs = await stageClient.entities.ChatMessage.filter(
      { match_id: game.id },
      "created_date",
      200
    ).catch(() => []);
    setMessages(sortMessages(msgs || []));
  }, [game.id]);

  useEffect(() => {
    let stopped = false;
    const socketChannel = makeChannel(game.id, CHANNELS.CHAT_MESSAGE);

    (async () => {
      setLoading(true);
      await loadMessages();
      if (!stopped) setLoading(false);
    })();

    setSocketListeners(socketChannel, (payload) => {
      if (!payload) return;
      if (payload.deleted) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.id));
        return;
      }
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === payload.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...payload };
          return sortMessages(next);
        }
        return sortMessages([...prev, payload]);
      });
    });

    const pollId = window.setInterval(() => {
      if (!stopped) loadMessages();
    }, 5000);

    return () => {
      stopped = true;
      window.clearInterval(pollId);
      offSocketListeners(socketChannel);
    };
  }, [game.id, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !user?.email) return;

    setSendError("");
    try {
      const created = await stageClient.entities.ChatMessage.create({
        match_id: game.id,
        sender_email: user.email,
        sender_name: senderLabel,
        sender_avatar: myPlayer?.avatar_url || myClub?.logo_url || "",
        content,
      });
      setNewMessage("");
      if (created?.id) {
        setMessages((prev) => sortMessages([...prev.filter((m) => m.id !== created.id), created]));
      } else {
        await loadMessages();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setSendError(err?.message || "Could not send message. Try again.");
    }
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading chat...</p>;
  }

  return (
    <div className="flex flex-col h-[400px] gap-3">
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No messages yet</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Both clubs can chat here before and during the match.</p>
          </div>
        ) : (
          messages.map((msg) => (
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
                {msg.sender_name || msg.sender_email}
              </p>
              <p>{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {sendError && (
        <p className="text-[10px] text-destructive">{sendError}</p>
      )}

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
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
