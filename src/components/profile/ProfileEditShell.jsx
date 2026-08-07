import { useId, useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2, Move, Palette, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import BannerSelector from "@/components/BannerSelector";
import ImagePositionEditor from "@/components/ImagePositionEditor";
import { stageClient } from "@/api/stageClient";
import { prepareImageForUpload } from "@/lib/imageUpload";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

/**
 * Shared edit-profile layout for Player / Club / President.
 * Same chrome: Back + title → Photo & Banner card → Info card (children).
 */
export default function ProfileEditShell({
  title,
  infoTitle,
  onBack,
  showBack = true,
  photoUrl = "",
  photoPosition = "50% 50%",
  photoZoom = 150,
  photoShape = "circle", // "circle" | "rounded"
  bannerUrl = "",
  bannerPosition = "50% 50%",
  bannerZoom = 150,
  bannerPreview = {},
  photoAspect = "avatar",
  onPhotoChange,
  onBannerChange,
  children,
  footer = null,
}) {
  const { t } = useTranslation();
  const fileInputId = useId();
  const fileRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const [uploading, setUploading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [repositionOpen, setRepositionOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (!file.type?.startsWith("image/")) {
      setUploadError(t("commonPages.obErrImage"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(t("commonPages.obErrAvatarSize"));
      return;
    }
    setUploading(true);
    try {
      const uploadFile = await prepareImageForUpload(file, { fallbackName: "profile-photo.jpg" });
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file: uploadFile });
      if (!file_url) throw new Error(t("commonPages.obErrUpload"));
      setPendingPhoto(file_url);
    } catch (err) {
      console.error("Profile photo upload failed:", err);
      setUploadError(err?.data?.error || err?.message || t("commonPages.obErrUpload"));
    } finally {
      setUploading(false);
    }
  }

  const photoFrameCls = photoShape === "rounded"
    ? "w-20 h-24 rounded-2xl"
    : "w-20 h-20 rounded-full";

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
          </button>
        ) : null}
        <h1 className="font-heading text-2xl font-black text-foreground uppercase">
          {title}
        </h1>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          {t("commonPages.profPhotoBanner")}
        </h2>
        <div className="flex items-start gap-4">
          <div className="relative group shrink-0">
            <div
              className={cn(
                "bg-secondary border-4 border-card flex items-center justify-center overflow-hidden pointer-events-none",
                photoFrameCls
              )}
            >
              {photoUrl ? (
                <div
                  className="w-full h-full"
                  style={{
                    backgroundImage: `url(${photoUrl})`,
                    backgroundSize: photoZoom ? `${photoZoom}%` : "cover",
                    backgroundPosition: photoPosition || "50% 50%",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              ) : photoShape === "rounded" ? (
                <Shield className="w-9 h-9 text-muted-foreground" />
              ) : (
                <User className="w-9 h-9 text-muted-foreground" />
              )}
            </div>
            <label
              htmlFor={uploading ? undefined : fileInputId}
              className={cn(
                "absolute inset-0 z-10 bg-black/50 flex items-center justify-center cursor-pointer touch-manipulation transition-opacity",
                photoShape === "rounded" ? "rounded-2xl" : "rounded-full",
                uploading && "pointer-events-none opacity-60",
                photoUrl
                  ? "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  : "opacity-100"
              )}
              title={t("commonPages.profUploadPhoto")}
            >
              <span className="p-1.5 rounded-lg bg-white/10">
                {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
              </span>
            </label>
            <input
              id={fileInputId}
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={handleFileChange}
            />
          </div>
          <div className="space-y-2 pt-1">
            {photoUrl ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRepositionOpen(true)}>
                <Move className="w-3.5 h-3.5" /> {t("commonPages.profRepositionPhoto")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setBannerOpen(true)}>
              <Palette className="w-3.5 h-3.5" /> {t("commonPages.profChangeBanner")}
            </Button>
          </div>
        </div>
        {uploadError ? (
          <p className="mt-3 text-xs text-destructive">{uploadError}</p>
        ) : null}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {infoTitle ? (
          <h2 className="text-xl font-bold text-foreground">{infoTitle}</h2>
        ) : null}
        {children}
        {footer}
      </div>

      <BannerSelector
        open={bannerOpen}
        onClose={() => setBannerOpen(false)}
        currentBannerId={bannerUrl}
        currentBannerPosition={bannerPosition}
        currentBannerZoom={bannerZoom}
        previewData={bannerPreview}
        onSelect={async (url, position, zoom) => {
          setBannerOpen(false);
          await onBannerChange?.({
            banner_url: url,
            banner_position: position || "50% 50%",
            banner_zoom: zoom || 150,
          });
        }}
      />

      <ImagePositionEditor
        open={!!pendingPhoto}
        onClose={() => setPendingPhoto(null)}
        imageUrl={pendingPhoto}
        aspect={photoAspect}
        initialPosition={photoPosition}
        initialZoom={photoZoom}
        onConfirm={async (url, position, zoom) => {
          setPendingPhoto(null);
          await onPhotoChange?.({
            url,
            position: position || "50% 50%",
            zoom: zoom || 150,
          });
        }}
      />

      <ImagePositionEditor
        open={repositionOpen && !pendingPhoto}
        onClose={() => setRepositionOpen(false)}
        imageUrl={photoUrl}
        aspect={photoAspect}
        initialPosition={photoPosition}
        initialZoom={photoZoom}
        onConfirm={async (url, position, zoom) => {
          setRepositionOpen(false);
          await onPhotoChange?.({
            url,
            position: position || "50% 50%",
            zoom: zoom || 150,
          });
        }}
      />
    </div>
  );
}
