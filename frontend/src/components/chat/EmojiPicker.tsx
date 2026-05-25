import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmojiItem {
  char: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiItem[];
}

const EMOJI_DATA: EmojiCategory[] = [
  {
    id: "smileys",
    name: "Smileys & Emotion",
    icon: "😊",
    emojis: [
      { char: "😀", name: "grinning face", keywords: ["smile", "happy", "grin"] },
      { char: "😃", name: "smiley face", keywords: ["smile", "happy", "laugh"] },
      { char: "😄", name: "laughing face", keywords: ["smile", "happy", "laugh"] },
      { char: "😁", name: "beaming face", keywords: ["smile", "grin", "happy"] },
      { char: "😆", name: "grinning squinting face", keywords: ["smile", "laugh", "happy"] },
      { char: "😅", name: "grinning sweat face", keywords: ["sweat", "relief", "happy"] },
      { char: "😂", name: "face with tears of joy", keywords: ["joy", "tears", "laugh", "lol"] },
      { char: "🤣", name: "rofl", keywords: ["rofl", "rolling", "laugh", "lol"] },
      { char: "🥲", name: "smiling face with tear", keywords: ["sad", "happy", "tear"] },
      { char: "😊", name: "blushing face", keywords: ["blush", "smile", "happy"] },
      { char: "😇", name: "halo face", keywords: ["angel", "halo", "innocent"] },
      { char: "🙂", name: "slightly smiling face", keywords: ["smile", "happy"] },
      { char: "🙃", name: "upside down face", keywords: ["upside", "sarcasm", "silly"] },
      { char: "😉", name: "winking face", keywords: ["wink", "smile"] },
      { char: "😌", name: "relieved face", keywords: ["relieved", "calm", "peaceful"] },
      { char: "😍", name: "heart eyes", keywords: ["heart", "eyes", "love", "crush"] },
      { char: "🥰", name: "loving face with hearts", keywords: ["love", "hearts", "blush"] },
      { char: "😘", name: "blowing kiss", keywords: ["kiss", "love", "heart"] },
      { char: "😗", name: "kissing face", keywords: ["kiss"] },
      { char: "😋", name: "delicious food face", keywords: ["yum", "delicious", "tongue", "food"] },
      { char: "😛", name: "tongue face", keywords: ["tongue", "silly"] },
      { char: "😜", name: "winking tongue face", keywords: ["wink", "tongue", "silly", "crazy"] },
      { char: "🤪", name: "zany face", keywords: ["crazy", "zany", "silly"] },
      { char: "🤨", name: "raised eyebrow", keywords: ["suspicious", "doubt", "raised eyebrow"] },
      { char: "🧐", name: "monocle face", keywords: ["smart", "monocle", "thinking"] },
      { char: "🤓", name: "nerd face", keywords: ["nerd", "geek", "smart", "glasses"] },
      { char: "😎", name: "cool face", keywords: ["cool", "sunglasses", "chill"] },
      { char: "🥸", name: "disguised face", keywords: ["disguise", "mask"] },
      { char: "🤩", name: "star struck", keywords: ["star", "struck", "wow", "excited"] },
      { char: "🥳", name: "partying face", keywords: ["party", "celebrate", "horn"] },
      { char: "😏", name: "smirking face", keywords: ["smirk", "sly", "flirt"] },
      { char: "😒", name: "unamused face", keywords: ["unamused", "bored", "meh"] },
      { char: "😞", name: "disappointed face", keywords: ["sad", "disappointed"] },
      { char: "😔", name: "pensive face", keywords: ["pensive", "sad", "thoughtful"] },
      { char: "😟", name: "worried face", keywords: ["worried", "anxious"] },
      { char: "😕", name: "confused face", keywords: ["confused", "puzzled"] },
      { char: "🙁", name: "slightly frowning face", keywords: ["frown", "sad"] },
      { char: "😣", name: "persevering face", keywords: ["persevere", "struggle"] },
      { char: "😖", name: "confounded face", keywords: ["confounded", "frustrated"] },
      { char: "😫", name: "tired face", keywords: ["tired", "exhausted"] },
      { char: "😩", name: "weary face", keywords: ["weary", "tired", "sad"] },
      { char: "🥺", name: "pleading face", keywords: ["pleading", "begging", "cute", "eyes"] },
      { char: "😢", name: "crying face", keywords: ["cry", "tear", "sad"] },
      { char: "😭", name: "loudly crying face", keywords: ["cry", "sob", "sad", "tears"] },
      { char: "😤", name: "triumph face", keywords: ["triumph", "proud", "angry"] },
      { char: "😠", name: "angry face", keywords: ["angry", "mad", "annoyed"] },
      { char: "😡", name: "pouting face", keywords: ["angry", "rage", "red", "mad"] },
      { char: "🤬", name: "censored angry face", keywords: ["angry", "cursing", "swearing"] },
      { char: "🤯", name: "exploding head", keywords: ["mind", "blown", "exploding", "shock"] },
      { char: "😳", name: "flushed face", keywords: ["flushed", "embarrassed", "blush"] },
      { char: "🥵", name: "hot face", keywords: ["hot", "sweat", "summer", "red"] },
      { char: "🥶", name: "cold face", keywords: ["cold", "blue", "winter", "freeze"] },
      { char: "😱", name: "screaming in fear", keywords: ["scared", "fear", "scream", "shock"] },
      { char: "🤔", name: "thinking face", keywords: ["thinking", "ponder", "hmm"] },
      { char: "🥱", name: "yawning face", keywords: ["yawn", "sleepy", "tired"] },
      { char: "😴", name: "sleeping face", keywords: ["sleep", "zzz", "tired"] },
      { char: "🤤", name: "drooling face", keywords: ["drool", "delicious", "sleepy"] },
      { char: "🤢", name: "nauseated face", keywords: ["green", "sick", "nausea", "gross"] },
      { char: "🤮", name: "vomiting face", keywords: ["vomit", "sick", "gross"] },
      { char: "💩", name: "pile of poo", keywords: ["poop", "poo", "turd", "funny"] },
      { char: "🤡", name: "clown face", keywords: ["clown", "funny", "circus"] },
      { char: "👻", name: "ghost", keywords: ["ghost", "spooky", "halloween"] },
      { char: "💀", name: "skull", keywords: ["skull", "dead", "skeleton"] },
      { char: "👽", name: "alien", keywords: ["alien", "ufo", "space"] },
      { char: "🤖", name: "robot", keywords: ["robot", "bot", "computer"] },
      { char: "🔥", name: "fire", keywords: ["fire", "hot", "lit", "flame"] },
      { char: "✨", name: "sparkles", keywords: ["sparkles", "shine", "magic", "clean"] },
      { char: "🎉", name: "party popper", keywords: ["party", "celebrate", "popper", "congrats"] },
    ]
  },
  {
    id: "gestures",
    name: "Gestures & Hands",
    icon: "👋",
    emojis: [
      { char: "👋", name: "waving hand", keywords: ["wave", "hello", "hi", "bye"] },
      { char: "🤚", name: "raised back of hand", keywords: ["backhand", "hand"] },
      { char: "✋", name: "raised hand", keywords: ["stop", "highfive", "hand"] },
      { char: "🖖", name: "vulcan salute", keywords: ["vulcan", "salute", "spock", "star trek"] },
      { char: "👌", name: "ok hand", keywords: ["ok", "perfect", "good"] },
      { char: "🤌", name: "pinched fingers", keywords: ["pinched", "italian", "what"] },
      { char: "🤏", name: "pinching hand", keywords: ["pinching", "small", "little"] },
      { char: "✌️", name: "victory hand", keywords: ["peace", "victory", "two"] },
      { char: "🤞", name: "crossed fingers", keywords: ["hope", "luck", "crossed"] },
      { char: "🤟", name: "love-you gesture", keywords: ["love", "ily", "gesture"] },
      { char: "🤘", name: "rock on", keywords: ["horns", "rock", "metal"] },
      { char: "🤙", name: "call me", keywords: ["call", "phone", "shaka"] },
      { char: "👈", name: "pointing left", keywords: ["left", "pointing"] },
      { char: "👉", name: "pointing right", keywords: ["right", "pointing"] },
      { char: "👆", name: "pointing up", keywords: ["up", "pointing"] },
      { char: "👇", name: "pointing down", keywords: ["down", "pointing"] },
      { char: "☝️", name: "index pointing up", keywords: ["up", "point", "one"] },
      { char: "👍", name: "thumbs up", keywords: ["thumbsup", "like", "yes", "good", "agree"] },
      { char: "👎", name: "thumbs down", keywords: ["thumbsdown", "dislike", "no", "bad"] },
      { char: "✊", name: "raised fist", keywords: ["fist", "power"] },
      { char: "👊", name: "oncoming fist", keywords: ["fist", "punch", "bump"] },
      { char: "👏", name: "clapping hands", keywords: ["clap", "applause", "good"] },
      { char: "🙌", name: "raising hands", keywords: ["raise", "celebrate", "hooray"] },
      { char: "👐", name: "open hands", keywords: ["open", "hug"] },
      { char: "🤲", name: "palms up together", keywords: ["palms", "prayer", "cupped"] },
      { char: "🤝", name: "handshake", keywords: ["handshake", "agreement", "shake", "deal"] },
      { char: "🙏", name: "folded hands", keywords: ["pray", "please", "thanks", "hope"] },
      { char: "💪", name: "flexed biceps", keywords: ["flex", "strong", "power", "muscle"] },
      { char: "🧠", name: "brain", keywords: ["brain", "smart", "mind", "think"] },
      { char: "👀", name: "eyes", keywords: ["eyes", "look", "see", "watch"] },
      { char: "❤️", name: "red heart", keywords: ["heart", "love", "like"] },
    ]
  },
  {
    id: "animals",
    name: "Animals & Nature",
    icon: "🐱",
    emojis: [
      { char: "🐶", name: "dog", keywords: ["dog", "puppy", "pet", "animal"] },
      { char: "🐱", name: "cat", keywords: ["cat", "kitten", "pet", "animal"] },
      { char: "🐭", name: "mouse", keywords: ["mouse", "animal"] },
      { char: "🐹", name: "hamster", keywords: ["hamster", "pet", "animal"] },
      { char: "🐰", name: "rabbit", keywords: ["rabbit", "bunny", "pet", "animal"] },
      { char: "🦊", name: "fox", keywords: ["fox", "animal"] },
      { char: "🐻", name: "bear", keywords: ["bear", "animal"] },
      { char: "🐼", name: "panda", keywords: ["panda", "animal"] },
      { char: "🐨", name: "koala", keywords: ["koala", "animal"] },
      { char: "🐯", name: "tiger", keywords: ["tiger", "animal"] },
      { char: "🦁", name: "lion", keywords: ["lion", "animal"] },
      { char: "🐮", name: "cow", keywords: ["cow", "animal"] },
      { char: "🐷", name: "pig", keywords: ["pig", "animal"] },
      { char: "🐵", name: "monkey", keywords: ["monkey", "animal"] },
      { char: "🐔", name: "chicken", keywords: ["chicken", "animal", "bird"] },
      { char: "🐧", name: "penguin", keywords: ["penguin", "animal", "bird"] },
      { char: "🐦", name: "bird", keywords: ["bird", "animal"] },
      { char: "🐝", name: "honeybee", keywords: ["bee", "insect", "honey"] },
      { char: "🦋", name: "butterfly", keywords: ["butterfly", "insect"] },
      { char: "🐌", name: "snail", keywords: ["snail", "insect"] },
      { char: "🐞", name: "lady beetle", keywords: ["ladybug", "insect"] },
      { char: "🕸️", name: "spider web", keywords: ["spider", "web", "spooky"] },
      { char: "🐢", name: "turtle", keywords: ["turtle", "reptile", "animal"] },
      { char: "🐍", name: "snake", keywords: ["snake", "reptile", "animal"] },
      { char: "🐙", name: "octopus", keywords: ["octopus", "sea", "animal"] },
      { char: "🐠", name: "tropical fish", keywords: ["fish", "sea", "animal"] },
      { char: "🐬", name: "dolphin", keywords: ["dolphin", "sea", "animal"] },
      { char: "🌳", name: "deciduous tree", keywords: ["tree", "nature", "forest"] },
      { char: "🍁", name: "maple leaf", keywords: ["leaf", "nature", "autumn"] },
      { char: "🍀", name: "four leaf clover", keywords: ["clover", "lucky", "nature"] },
      { char: "🌸", name: "cherry blossom", keywords: ["flower", "cherry", "nature", "pink"] },
    ]
  },
  {
    id: "food",
    name: "Food & Drink",
    icon: "🍔",
    emojis: [
      { char: "🍏", name: "green apple", keywords: ["apple", "fruit", "food"] },
      { char: "🍎", name: "red apple", keywords: ["apple", "fruit", "food"] },
      { char: "🍉", name: "watermelon", keywords: ["watermelon", "fruit", "food", "summer"] },
      { char: "🍓", name: "strawberry", keywords: ["strawberry", "fruit", "food"] },
      { char: "🍌", name: "banana", keywords: ["banana", "fruit", "food"] },
      { char: "🍋", name: "lemon", keywords: ["lemon", "fruit", "food", "sour"] },
      { char: "🍒", name: "cherries", keywords: ["cherries", "fruit", "food"] },
      { char: "🥑", name: "avocado", keywords: ["avocado", "fruit", "food"] },
      { char: "🥦", name: "broccoli", keywords: ["broccoli", "vegetable", "food"] },
      { char: "🥐", name: "croissant", keywords: ["croissant", "bread", "pastry", "food"] },
      { char: "🍞", name: "bread", keywords: ["bread", "food"] },
      { char: "🧀", name: "cheese wedge", keywords: ["cheese", "food"] },
      { char: "🥚", name: "egg", keywords: ["egg", "food"] },
      { char: "🍳", name: "cooking", keywords: ["egg", "frying", "cooking", "food"] },
      { char: "🥓", name: "bacon", keywords: ["bacon", "meat", "food"] },
      { char: "🍔", name: "hamburger", keywords: ["burger", "fastfood", "meat", "food"] },
      { char: "🍟", name: "french fries", keywords: ["fries", "fastfood", "food"] },
      { char: "🍕", name: "pizza", keywords: ["pizza", "cheese", "food"] },
      { char: "🌮", name: "taco", keywords: ["taco", "mexican", "food"] },
      { char: "🍜", name: "steaming bowl", keywords: ["noodles", "ramen", "soup", "food"] },
      { char: "🍣", name: "sushi", keywords: ["sushi", "fish", "food"] },
      { char: "🧁", name: "cupcake", keywords: ["cupcake", "dessert", "sweet", "food"] },
      { char: "🍩", name: "donut", keywords: ["donut", "dessert", "sweet", "food"] },
      { char: "🍪", name: "cookie", keywords: ["cookie", "dessert", "sweet", "food"] },
      { char: "🍫", name: "chocolate bar", keywords: ["chocolate", "sweet", "food"] },
      { char: "🍬", name: "candy", keywords: ["candy", "sweet", "food"] },
      { char: "☕", name: "hot beverage", keywords: ["coffee", "tea", "hot", "drink"] },
      { char: "🥤", name: "cup with straw", keywords: ["soda", "drink", "juice"] },
      { char: "🍺", name: "beer mug", keywords: ["beer", "alcohol", "drink", "bar"] },
      { char: "🥂", name: "clinking glasses", keywords: ["cheers", "celebrate", "wine", "drink"] },
      { char: "🧊", name: "ice cube", keywords: ["ice", "cold", "water"] },
    ]
  },
  {
    id: "travel",
    name: "Travel & Places",
    icon: "🚗",
    emojis: [
      { char: "🚗", name: "automobile", keywords: ["car", "drive", "travel"] },
      { char: "🚓", name: "police car", keywords: ["police", "car", "cop"] },
      { char: "🚑", name: "ambulance", keywords: ["ambulance", "hospital", "emergency"] },
      { char: "🚒", name: "fire engine", keywords: ["fire", "truck", "emergency"] },
      { char: "🛵", name: "motor scooter", keywords: ["scooter", "bike", "drive"] },
      { char: "🚲", name: "bicycle", keywords: ["bike", "cycle", "ride"] },
      { char: "✈️", name: "airplane", keywords: ["plane", "flight", "fly", "travel"] },
      { char: "🚀", name: "rocket", keywords: ["rocket", "space", "launch"] },
      { char: "🛸", name: "ufo", keywords: ["ufo", "alien", "space"] },
      { char: "⛵", name: "sailboat", keywords: ["boat", "sailing", "sea"] },
      { char: "⚓", name: "anchor", keywords: ["anchor", "sea", "boat"] },
      { char: "🌅", name: "sunrise", keywords: ["sunrise", "morning", "sun"] },
      { char: "🌊", name: "water wave", keywords: ["wave", "ocean", "sea", "tsunami"] },
      { char: "🌋", name: "volcano", keywords: ["volcano", "nature", "hot"] },
      { char: "⛰️", name: "mountain", keywords: ["mountain", "climb", "nature"] },
      { char: "⛺", name: "tent", keywords: ["tent", "camp", "outdoor"] },
      { char: "🏠", name: "house", keywords: ["house", "home", "building"] },
      { char: "🏢", name: "office building", keywords: ["office", "work", "building"] },
      { char: "🏥", name: "hospital", keywords: ["hospital", "medical", "clinic"] },
      { char: "🏰", name: "castle", keywords: ["castle", "building", "disney"] },
      { char: "🗺️", name: "world map", keywords: ["map", "travel", "world"] },
      { char: "🧭", name: "compass", keywords: ["compass", "directions", "travel"] },
      { char: "⏰", name: "alarm clock", keywords: ["clock", "alarm", "time"] },
      { char: "⌛", name: "hourglass", keywords: ["hourglass", "time", "wait"] },
      { char: "🔋", name: "battery", keywords: ["battery", "charge", "power"] },
      { char: "💡", name: "light bulb", keywords: ["bulb", "light", "idea", "smart"] },
      { char: "💵", name: "dollar banknote", keywords: ["money", "dollar", "cash"] },
      { char: "💸", name: "money with wings", keywords: ["money", "cash", "spend", "rich"] },
      { char: "💳", name: "credit card", keywords: ["card", "credit", "money", "pay"] },
      { char: "🎁", name: "wrapped gift", keywords: ["gift", "present", "birthday", "party"] },
      { char: "🎈", name: "balloon", keywords: ["balloon", "celebrate", "party"] },
    ]
  },
  {
    id: "activities",
    name: "Activities & Sports",
    icon: "⚽",
    emojis: [
      { char: "⚽", name: "soccer ball", keywords: ["soccer", "football", "ball", "sport"] },
      { char: "🏀", name: "basketball", keywords: ["basketball", "ball", "sport"] },
      { char: "🏈", name: "american football", keywords: ["football", "ball", "sport"] },
      { char: "⚾", name: "baseball", keywords: ["baseball", "ball", "sport"] },
      { char: "🎾", name: "tennis", keywords: ["tennis", "ball", "sport"] },
      { char: "🏐", name: "volleyball", keywords: ["volleyball", "ball", "sport"] },
      { char: "🎱", name: "billiards", keywords: ["pool", "billiards", "eightball", "ball"] },
      { char: "🏓", name: "ping pong", keywords: ["pingpong", "tabletennis", "sport"] },
      { char: "🎯", name: "bullseye", keywords: ["darts", "target", "bullseye", "game"] },
      { char: "⛳", name: "flag in hole", keywords: ["golf", "hole", "sport"] },
      { char: "🛹", name: "skateboard", keywords: ["skate", "skateboard", "board"] },
      { char: "🎮", name: "video game", keywords: ["controller", "game", "xbox", "playstation", "gaming"] },
      { char: "🎲", name: "game die", keywords: ["dice", "die", "game", "boardgame"] },
      { char: "♟️", name: "chess pawn", keywords: ["chess", "boardgame", "game"] },
      { char: "🏆", name: "trophy", keywords: ["trophy", "winner", "prize", "first"] },
      { char: "🥇", name: "1st place medal", keywords: ["medal", "first", "winner"] },
      { char: "🥈", name: "2nd place medal", keywords: ["medal", "second"] },
      { char: "🥉", name: "3rd place medal", keywords: ["medal", "third"] },
      { char: "🎨", name: "artist palette", keywords: ["art", "paint", "draw", "creative"] },
      { char: "🎬", name: "clapper board", keywords: ["movie", "film", "cinema", "director"] },
      { char: "🎤", name: "microphone", keywords: ["sing", "mic", "karaoke", "music"] },
      { char: "🎧", name: "headphone", keywords: ["music", "headphones", "listen", "audio"] },
      { char: "🎼", name: "musical score", keywords: ["music", "notes", "song"] },
      { char: "🎸", name: "guitar", keywords: ["guitar", "music", "instrument"] },
      { char: "🎹", name: "musical keyboard", keywords: ["piano", "music", "keyboard"] },
      { char: "📷", name: "camera", keywords: ["camera", "photo", "shoot"] },
      { char: "📱", name: "mobile phone", keywords: ["phone", "cell", "iphone", "device"] },
      { char: "💻", name: "laptop", keywords: ["computer", "laptop", "device", "work"] },
      { char: "✉️", name: "envelope", keywords: ["mail", "envelope", "letter", "email"] },
      { char: "📎", name: "paperclip", keywords: ["paperclip", "attach", "clip"] },
    ]
  }
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("smileys");
  const [hoveredEmoji, setHoveredEmoji] = useState<EmojiItem | null>(null);

  // Search filter matching
  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.toLowerCase().trim();
    const matches: EmojiItem[] = [];
    EMOJI_DATA.forEach((category) => {
      category.emojis.forEach((emoji) => {
        if (
          emoji.name.toLowerCase().includes(query) ||
          emoji.keywords.some((keyword) => keyword.toLowerCase().includes(query))
        ) {
          matches.push(emoji);
        }
      });
    });
    return matches;
  }, [search]);

  return (
    <div className="flex flex-col h-[320px] w-72 bg-popover text-popover-foreground overflow-hidden rounded-2xl select-none">
      {/* ── Search Header ── */}
      <div className="p-2 border-b border-border/50 bg-card/40 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emojis..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-muted/60 hover:bg-muted/80 focus:bg-muted focus:ring-1 focus:ring-primary/20 rounded-lg outline-none border border-transparent focus:border-border/80 transition-all placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
      </div>

      {/* ── Category Select Tabs (only visible when not searching) ── */}
      {!search.trim() && (
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/30 bg-muted/10 shrink-0">
          {EMOJI_DATA.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.name}
              className={cn(
                "size-7 flex items-center justify-center text-base rounded-md hover:bg-accent active:scale-90 transition-all relative",
                activeCategory === cat.id ? "bg-accent scale-105" : "opacity-75 hover:opacity-100"
              )}
            >
              {cat.icon}
              {activeCategory === cat.id && (
                <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Scrollable Emoji Grid ── */}
      <ScrollArea className="flex-1 min-h-0 bg-card/20">
        {search.trim() ? (
          /* Search Results Grid */
          <div className="p-2">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Search Results
            </h4>
            {filteredEmojis && filteredEmojis.length > 0 ? (
              <div className="grid grid-cols-7 gap-1">
                {filteredEmojis.map((emoji) => (
                  <button
                    key={emoji.char}
                    onClick={() => onSelect(emoji.char)}
                    onMouseEnter={() => setHoveredEmoji(emoji)}
                    onMouseLeave={() => setHoveredEmoji(null)}
                    className="size-8 text-xl flex items-center justify-center rounded-lg hover:bg-primary/10 hover:scale-115 active:scale-90 transition-all duration-100"
                  >
                    {emoji.char}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground py-12">
                No matching emojis found
              </p>
            )}
          </div>
        ) : (
          /* Selected Category Grid */
          <div className="p-2">
            {EMOJI_DATA.map(
              (cat) =>
                activeCategory === cat.id && (
                  <div key={cat.id} className="space-y-2">
                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      {cat.name}
                    </h4>
                    <div className="grid grid-cols-7 gap-1">
                      {cat.emojis.map((emoji) => (
                        <button
                          key={emoji.char}
                          onClick={() => onSelect(emoji.char)}
                          onMouseEnter={() => setHoveredEmoji(emoji)}
                          onMouseLeave={() => setHoveredEmoji(null)}
                          className="size-8 text-xl flex items-center justify-center rounded-lg hover:bg-primary/10 hover:scale-115 active:scale-90 transition-all duration-100"
                        >
                          {emoji.char}
                        </button>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>
        )}
      </ScrollArea>

      {/* ── Status Bar / Emoji Name Preview ── */}
      <div className="h-8 px-3 border-t border-border/50 bg-muted/20 shrink-0 flex items-center justify-between text-[11px] text-muted-foreground">
        {hoveredEmoji ? (
          <div className="flex items-center gap-1.5 truncate max-w-full">
            <span className="text-base select-none shrink-0">{hoveredEmoji.char}</span>
            <span className="capitalize font-medium text-foreground truncate">
              {hoveredEmoji.name}
            </span>
          </div>
        ) : (
          <span className="italic">Select an emoji</span>
        )}
      </div>
    </div>
  );
}
