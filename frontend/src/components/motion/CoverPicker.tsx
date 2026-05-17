import { useState, useRef } from "react";
import { Search, Image as ImageLucide } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CoverPickerProps {
  onSelect: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

const COVER_GALLERIES = [
  {
    name: "Color & Gradient",
    images: [
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1550684376-efcbd6e3f031?q=80&w=800&auto=format&fit=crop",
    ]
  },
  {
    name: "Abstract & Texture",
    images: [
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1550684847-75bdda21cc95?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1633167606207-d840b5070fc2?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1614851099511-773084f6911d?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1618556450991-2f1af64e8191?q=80&w=800&auto=format&fit=crop",
    ]
  },
  {
    name: "Space & Cosmos",
    images: [
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1464802686167-b939a6910659?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1506318137071-a8e063b4bcc0?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?q=80&w=800&auto=format&fit=crop",
    ]
  },
  {
    name: "Landscapes",
    images: [
      "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1426604966848-d7adac402bff?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=800&auto=format&fit=crop",
    ]
  },
  {
    name: "Architecture",
    images: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1449156001437-3a1621dfbe2b?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=800&auto=format&fit=crop",
    ]
  },
  {
    name: "Art & Minimal",
    images: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1574357279766-3d605bd27894?q=80&w=800&auto=format&fit=crop",
    ]
  },
];

export function CoverPicker({ onSelect, onRemove, onClose }: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState<"Gallery" | "Upload" | "Link">("Gallery");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState("");

  return (
    <div className="absolute top-full right-0 mt-2 z-[110] w-[540px] bg-popover rounded-xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-4 px-5 pt-4 border-b border-border/50 relative">
        {(["Gallery", "Upload", "Link"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-3 text-[14px] font-medium transition-colors border-b-2 relative -bottom-[1px]",
              activeTab === tab
                ? "text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto flex items-center pb-3">
          <button
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { onRemove(); onClose(); }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[400px]">
        {activeTab === "Gallery" && (
          <div className="p-5 flex flex-col gap-6">
            {COVER_GALLERIES.map((gallery, idx) => (
              <div key={idx} className="flex flex-col gap-3">
                <span className="text-[13px] font-medium text-muted-foreground">{gallery.name}</span>
                <div className="grid grid-cols-4 gap-2">
                  {gallery.images.map((img, i) => (
                    <button
                      key={i}
                      className="aspect-[2/1] rounded-md overflow-hidden hover:ring-2 ring-primary/50 ring-offset-2 ring-offset-popover transition-all focus:outline-none group/img"
                      onClick={() => { onSelect(img); onClose(); }}
                    >
                      <img
                        src={img}
                        alt="cover"
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "Upload" && (
          <div className="p-8 flex flex-col h-[320px] items-center justify-center text-center gap-6">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => { onSelect(reader.result as string); onClose(); };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <div
              className="w-full max-w-xs h-36 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="size-10 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                <ImageLucide className="size-5 text-muted-foreground" />
              </div>
              <span className="text-[14px] font-medium text-foreground/70">Upload an image</span>
            </div>
            <p className="text-[12px] text-muted-foreground/60">Images wider than 1500 pixels work best.</p>
          </div>
        )}

        {activeTab === "Link" && (
          <div className="p-6 flex flex-col h-[320px] gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-muted-foreground">Image link</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border focus-within:border-primary/50 transition-colors">
                  <Search className="size-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Paste an image link..."
                    className="bg-transparent border-none outline-none text-sm w-full"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && linkInput) { onSelect(linkInput); onClose(); }
                    }}
                  />
                </div>
                <Button
                  onClick={() => { if (linkInput) { onSelect(linkInput); onClose(); } }}
                  disabled={!linkInput}
                  size="sm"
                  className="h-10"
                >
                  Submit
                </Button>
              </div>
            </div>
            {linkInput && (
              <div className="mt-4 rounded-lg overflow-hidden border border-border/50 aspect-[3/1] bg-muted/20">
                <img src={linkInput} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
