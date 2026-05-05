import { useState, useEffect } from "react";
import BannerPreviewEditor from "./BannerPreviewEditor";
import { stageClient } from "@/api/stageClient";
import { STORE_ITEMS, RARITY_STYLES, getBannerStyle } from "@/lib/storeItems";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, Lock, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const banners = STORE_ITEMS.filter(i => i.type === "banner");

export default function BannerSelector({ open, onClose, currentBannerId, onSelect, userEmail, previewData, currentBannerPosition, currentBannerZoom }) {
  const [ownedIds, setOwnedIds] = useState(["banner_default"]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingUrl, setPendingUrl] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    if (!open || !userEmail) return;
    async function load() {
      const purchases = await stageClient.entities.UserPurchase.filter({ buyer_email: userEmail, item_type: "banner" });
      setOwnedIds(["banner_default", ...purchases.map(p => p.item_id)]);
      setLoading(false);
    }
    load();
  }, [open, userEmail]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setUploading(false);
    // Open position editor instead of immediately saving
    setPendingUrl(file_url);
    e.target.value = "";
  }

  return (<>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="leading-relaxed text-xl">Choose Banner</DialogTitle>
        </DialogHeader>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        {/* Upload custom image */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 w-full border border-dashed border-border rounded-xl p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          {uploading
            ? <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Uploading...</>
            : <><ShoppingBag className="w-4 h-4" /> Upload a custom image as banner</>}
        </button>
        <p className="text-xs text-muted-foreground -mt-1">
          Or pick from your owned banners below. <Link to="/store" onClick={onClose} className="text-primary hover:underline">Visit Store</Link> to unlock more.
        </p>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
            {banners.map(banner => {
              const owned = ownedIds.includes(banner.id);
              const active = currentBannerId === banner.id;
              const rarity = RARITY_STYLES[banner.rarity];
              return (
                <button
                        key={banner.id}
                        onClick={() => owned && onSelect(banner.id, null, null)}
                        disabled={!owned}
                  className={cn(
                    "relative rounded-xl overflow-hidden border-2 transition-all text-left",
                    active ? "border-primary ring-2 ring-primary/30" :
                    owned ? "border-border hover:border-primary/50 cursor-pointer" :
                    "border-border opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="h-16" style={getBannerStyle(banner.id)} />
                  <div className="p-2 bg-secondary/80">
                    <p className="text-xs leading-relaxed font-bold text-foreground">{banner.name}</p>
                    <p className={cn("text-[10px] font-medium", rarity.color)}>{rarity.label}</p>
                  </div>
                  {active && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  {!owned && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Banner preview position editor */}
    <BannerPreviewEditor
      open={!!pendingUrl}
      onClose={() => setPendingUrl(null)}
      imageUrl={pendingUrl}
      previewData={previewData}
      onConfirm={(url, position, zoom) => {
        setPendingUrl(null);
        onSelect(url, position, zoom);
      }}
    />
  </>);
}