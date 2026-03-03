import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Smile, MoreVertical, Hash, Volume2, Pin, Users, Plus, Phone, Video, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  avatar?: string;
  isOwn?: boolean;
  reactions?: { emoji: string; count: number; users: string[] }[];
}

interface Channel {
  id: string;
  name: string;
  type: "channel" | "dm";
  unread?: number;
  isOnline?: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
}

const mockChannels: Channel[] = [
  { id: "1", name: "general", type: "channel", unread: 3, lastMessage: "Hey team, how's the project going?", lastMessageTime: "2m" },
  { id: "2", name: "development", type: "channel", lastMessage: "Just pushed the latest updates", lastMessageTime: "15m" },
  { id: "3", name: "design", type: "channel", unread: 1, lastMessage: "New mockups are ready for review", lastMessageTime: "1h" },
  { id: "4", name: "Sarah Chen", type: "dm", isOnline: true, lastMessage: "Can we sync up later?", lastMessageTime: "30m" },
  { id: "5", name: "Alex Kumar", type: "dm", isOnline: false, lastMessage: "Thanks for the help!", lastMessageTime: "2h" },
  { id: "6", name: "Marketing Team", type: "channel", lastMessage: "Campaign results are in", lastMessageTime: "3h" },
];

const mockMessages: Message[] = [
  {
    id: "1",
    content: "Hey team! 👋 Just wanted to share some exciting updates on our latest project.",
    sender: "Sarah Chen",
    timestamp: "9:30 AM",
    avatar: "SC",
    isOwn: false,
    reactions: [{ emoji: "👍", count: 3, users: ["You", "Alex", "Mike"] }]
  },
  {
    id: "2",
    content: "That's fantastic news! Looking forward to seeing the demo.",
    sender: "You",
    timestamp: "9:32 AM",
    avatar: "YU",
    isOwn: true
  },
  {
    id: "3",
    content: "The new features are really coming together nicely. Great work everyone!",
    sender: "Alex Kumar",
    timestamp: "9:35 AM",
    avatar: "AK",
    isOwn: false,
    reactions: [{ emoji: "🎉", count: 2, users: ["Sarah", "Mike"] }]
  },
  {
    id: "4",
    content: "Thanks! The UI improvements have made a huge difference. User feedback has been really positive so far.",
    sender: "You",
    timestamp: "9:38 AM",
    avatar: "YU",
    isOwn: true
  },
  {
    id: "5",
    content: "Should we schedule a walkthrough for the stakeholders next week?",
    sender: "Mike Johnson",
    timestamp: "9:40 AM",
    avatar: "MJ",
    isOwn: false
  }
];

export function ChatPage() {
  const [selectedChannel, setSelectedChannel] = useState<Channel>(mockChannels[0]);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const newMsg: Message = {
        id: Date.now().toString(),
        content: newMessage,
        sender: "You",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: "YU",
        isOwn: true
      };
      setMessages([...messages, newMsg]);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const addReaction = (messageId: string, emoji: string) => {
    setMessages(messages.map(msg => {
      if (msg.id === messageId) {
        const existingReaction = msg.reactions?.find(r => r.emoji === emoji);
        if (existingReaction) {
          return {
            ...msg,
            reactions: msg.reactions?.map(r =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, users: [...r.users, "You"] }
                : r
            )
          };
        } else {
          return {
            ...msg,
            reactions: [...(msg.reactions || []), { emoji, count: 1, users: ["You"] }]
          };
        }
      }
      return msg;
    }));
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      {/* Sidebar */}
      <div className="w-72 bg-card border-r border-border flex flex-col">

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</span>
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 hover:bg-muted">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {mockChannels.filter(ch => ch.type === "channel").map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all duration-200 group",
                  selectedChannel.id === channel.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <Hash className={cn(
                  "h-4 w-4 flex-shrink-0",
                  selectedChannel.id === channel.id ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{channel.name}</span>
                    {channel.unread && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
                        {channel.unread}
                      </Badge>
                    )}
                  </div>
                  {channel.lastMessage && (
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{channel.lastMessage}</p>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{channel.lastMessageTime}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="p-2 mt-4">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</span>
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 hover:bg-muted">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {mockChannels.filter(ch => ch.type === "dm").map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className={cn(
                  "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all duration-200 group",
                  selectedChannel.id === channel.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">{channel.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  {channel.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-card"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{channel.name}</span>
                    {channel.unread && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
                        {channel.unread}
                      </Badge>
                    )}
                  </div>
                  {channel.lastMessage && (
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{channel.lastMessage}</p>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{channel.lastMessageTime}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-card">
        {/* Chat Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-3">
            {selectedChannel.type === "channel" ? (
              <Hash className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-sm">{selectedChannel.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
            )}
            <div>
              <h3 className="font-semibold text-foreground">{selectedChannel.name}</h3>
              <p className="text-xs text-muted-foreground">
                {selectedChannel.type === "channel" ? "Channel" : selectedChannel.isOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Phone className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Video className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Users className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Pin className="mr-2 h-4 w-4" />
                  Pin Channel
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Notification Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Info className="mr-2 h-4 w-4" />
                  About Channel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  Leave Channel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 group",
                message.isOwn && "flex-row-reverse"
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-sm">{message.avatar}</AvatarFallback>
              </Avatar>
              
              <div className={cn(
                "flex-1 max-w-2xl",
                message.isOwn && "items-end"
              )}>
                <div className="flex items-baseline gap-2 mb-1">
                  {!message.isOwn && (
                    <span className="text-sm font-semibold text-foreground">
                      {message.sender}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp}
                  </span>
                </div>
                
                <div className={cn(
                  "inline-block px-4 py-2 rounded-2xl",
                  message.isOwn
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted text-foreground"
                )}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
                
                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {message.reactions.map((reaction, idx) => (
                      <button
                        key={idx}
                        onClick={() => addReaction(message.id, reaction.emoji)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors",
                          reaction.users.includes("You")
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        )}
                      >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-border p-4 bg-muted">
          <div className="flex items-end gap-3">
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
              <Paperclip className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message ${selectedChannel.type === "channel" ? "#" : ""}${selectedChannel.name}`}
                className="pr-12 bg-background border-border resize-none"
              />
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              size="sm"
              className="h-9 px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
