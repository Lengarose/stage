import { useState, useEffect, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, Palette, Trash2, AlertTriangle, Lock, Eye, EyeOff, LogOut } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import NotificationSettings from "@/components/NotificationSettings";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";



const PRESET_THEMES = [
  {
    name: "Midnight",
    primary: "#00d4ff",
    gradient: "#0099ff",
    background: "#0f0f0f",
    text: "#ffffff",
    primaryText: "#ffffff",
    secondaryText: "#e0e0e0",
  },
  {
    name: "Ocean",
    primary: "#00b8d4",
    gradient: "#0088bb",
    background: "#0a1628",
    text: "#e0f7ff",
    primaryText: "#ffffff",
    secondaryText: "#b3e5fc",
  },
  {
    name: "Forest",
    primary: "#00c853",
    gradient: "#00aa47",
    background: "#1b3a1b",
    text: "#e8f5e9",
    primaryText: "#ffffff",
    secondaryText: "#c8e6c9",
  },
  {
    name: "Sunset",
    primary: "#ff6d00",
    gradient: "#ff9100",
    background: "#2c1810",
    text: "#ffe0b2",
    primaryText: "#ffffff",
    secondaryText: "#ffe0b2",
  },
  {
    name: "Purple",
    primary: "#d500f9",
    gradient: "#aa00ff",
    background: "#2a1a3a",
    text: "#f3e5f5",
    primaryText: "#ffffff",
    secondaryText: "#e1bee7",
  },
  {
    name: "Cyberpunk",
    primary: "#ff006e",
    gradient: "#ff1b6d",
    background: "#0a0e27",
    text: "#ffff00",
    primaryText: "#ffffff",
    secondaryText: "#ffff88",
  },
  {
    name: "Sakura",
    primary: "#ff1493",
    gradient: "#ff69b4",
    background: "#2a1a2a",
    text: "#ffe4f0",
    primaryText: "#ffffff",
    secondaryText: "#ffb3d9",
  },
  {
    name: "Gold",
    primary: "#ffd700",
    gradient: "#ffed4e",
    background: "#2a2410",
    text: "#fff8dc",
    primaryText: "#2c2410",
    secondaryText: "#ffe680",
  },
  {
    name: "Emerald",
    primary: "#1abc9c",
    gradient: "#16a085",
    background: "#0d2818",
    text: "#d5f4e6",
    primaryText: "#ffffff",
    secondaryText: "#a9e6d4",
  },
  {
    name: "Cosmic",
    primary: "#9d4edd",
    gradient: "#7209b7",
    background: "#1a0f2e",
    text: "#e0c3fc",
    primaryText: "#ffffff",
    secondaryText: "#c77dff",
  },
  {
    name: "Coral",
    primary: "#ff6b6b",
    gradient: "#ff8c8c",
    background: "#2a1515",
    text: "#ffe4e1",
    primaryText: "#ffffff",
    secondaryText: "#ffb3a7",
  },
  {
    name: "Slate",
    primary: "#b0bec5",
    gradient: "#90a4ae",
    background: "#1a1a1a",
    text: "#eceff1",
    primaryText: "#ffffff",
    secondaryText: "#cfd8dc",
  },
  {
    name: "Neon Green",
    primary: "#39ff14",
    gradient: "#80ff00",
    background: "#0a1a0a",
    text: "#ccffcc",
    primaryText: "#000000",
    secondaryText: "#99ff99",
  },
  {
    name: "Lavender",
    primary: "#b19cd9",
    gradient: "#d8bfd8",
    background: "#2a1a3a",
    text: "#f3e5fb",
    primaryText: "#ffffff",
    secondaryText: "#e6d5f0",
  },
  {
    name: "Terracotta",
    primary: "#cc5500",
    gradient: "#ff7f50",
    background: "#2a1a10",
    text: "#ffe4cc",
    primaryText: "#ffffff",
    secondaryText: "#ffbf99",
  },
];

function playWebAudioSound(ctx, gainNode, soundId) {
  const t = ctx.currentTime;
  if (soundId === "cyber_ping") {
    // Sharp high-freq blip, quick drop
    const osc = ctx.createOscillator();
    osc.connect(gainNode);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    gainNode.gain.setValueAtTime(0.5, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t); osc.stop(t + 0.25);
  } else if (soundId === "stadium_cheer") {
    // Noise burst that swells like a crowd
    const bufSize = ctx.sampleRate * 0.6;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    src.connect(filter);
    filter.connect(gainNode);
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime(0.4, t + 0.2);
    gainNode.gain.linearRampToValueAtTime(0.2, t + 0.4);
    gainNode.gain.linearRampToValueAtTime(0.001, t + 0.6);
    src.start(t); src.stop(t + 0.6);
  } else if (soundId === "whistle") {
    // High sine with vibrato, like a referee whistle
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 8;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gainNode);
    osc.type = "sine";
    osc.frequency.setValueAtTime(2800, t);
    gainNode.gain.setValueAtTime(0.4, t);
    gainNode.gain.setValueAtTime(0.4, t + 0.35);
    gainNode.gain.linearRampToValueAtTime(0.001, t + 0.5);
    lfo.start(t); osc.start(t);
    lfo.stop(t + 0.5); osc.stop(t + 0.5);
  } else if (soundId === "trophy") {
    // Ascending fanfare: C-E-G-C
    const melody = [523, 659, 784, 1047];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.connect(gainNode);
      osc.type = "triangle";
      const start = t + i * 0.13;
      osc.frequency.setValueAtTime(freq, start);
      gainNode.gain.setValueAtTime(0.4, start);
      osc.start(start);
      osc.stop(start + (i === melody.length - 1 ? 0.35 : 0.1));
    });
  }
}

function getSoundDuration(soundId) {
  return { cyber_ping: 0.3, stadium_cheer: 0.7, whistle: 0.55, trophy: 0.9 }[soundId] || 0.5;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "French (Français)" },
  { value: "es", label: "Spanish (Español)" },
  { value: "de", label: "German (Deutsch)" },
  { value: "it", label: "Italian (Italiano)" },
  { value: "nl", label: "Dutch (Nederlands)" },
  { value: "pt", label: "Portuguese (Português)" },
  { value: "ru", label: "Russian (Русский)" },
];

export default function Settings() {
  const { language, setLanguage: setContextLanguage } = useTranslation();
  const navigate = useNavigate();
  const [localLanguage, setLocalLanguage] = useState(language);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#00d4ff");
  const [gradientColor, setGradientColor] = useState("#0099ff");
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("stage-theme") || "theme-dark");
  const [customPrimaryColor, setCustomPrimaryColor] = useState("#00d4ff");
  const [customGradientColor, setCustomGradientColor] = useState("#0099ff");
  const [customBackgroundColor, setCustomBackgroundColor] = useState("#220e0e");
  const [customBackgroundOpacity, setCustomBackgroundOpacity] = useState(0.95);
  const [customTextColor, setCustomTextColor] = useState("#ffffff");
  const [customPrimaryTextColor, setCustomPrimaryTextColor] = useState("#ffffff");
  const [customSecondaryTextColor, setCustomSecondaryTextColor] = useState("#e0e0e0");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const u = await stageClient.auth.me();
      setUser(u);
      const currentTheme = localStorage.getItem("stage-theme");
      setTheme(currentTheme || "theme-dark");
      if (u.language) setLocalLanguage(u.language);
      if (u.primaryColor) setPrimaryColor(u.primaryColor);
      if (u.gradientColor) setGradientColor(u.gradientColor);
      if (u.backgroundImage) setBackgroundImage(u.backgroundImage);
      if (u.customPrimaryColor) setCustomPrimaryColor(u.customPrimaryColor);
      if (u.customGradientColor) setCustomGradientColor(u.customGradientColor);
      if (u.customBackgroundColor) setCustomBackgroundColor(u.customBackgroundColor);
      if (u.customBackgroundOpacity) setCustomBackgroundOpacity(u.customBackgroundOpacity);
      if (u.customTextColor) setCustomTextColor(u.customTextColor);
      if (u.customPrimaryTextColor) setCustomPrimaryTextColor(u.customPrimaryTextColor);
      if (u.customSecondaryTextColor) setCustomSecondaryTextColor(u.customSecondaryTextColor);
      
      // Apply custom theme if it's selected
      if (currentTheme === "theme-custom") {
        applyCustomTheme(u.customPrimaryColor || "#00d4ff", u.customGradientColor || "#0099ff", u.customBackgroundColor || "#220e0e", u.customBackgroundOpacity || 0.95, u.customTextColor || "#ffffff", u.customPrimaryTextColor || "#ffffff", u.customSecondaryTextColor || "#e0e0e0");
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (theme === "theme-custom") {
      applyCustomTheme(customPrimaryColor, customGradientColor, customBackgroundColor, customBackgroundOpacity, customTextColor, customPrimaryTextColor, customSecondaryTextColor);
    }
  }, [theme, customPrimaryColor, customGradientColor, customBackgroundColor, customBackgroundOpacity, customTextColor, customPrimaryTextColor, customSecondaryTextColor, backgroundImage]);

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setBackgroundImage(file_url);
    setLoading(false);
  }

  async function handleSave() {
    setLoading(true);
    await stageClient.auth.updateMe({
      language: localLanguage,
      customPrimaryColor,
      customGradientColor,
      customBackgroundColor,
      customBackgroundOpacity,
      customTextColor,
      customPrimaryTextColor,
      customSecondaryTextColor,
      backgroundImage,
    });
    
    setLoading(false);
  }

  async function handleChangePassword() {
    setPasswordMessage("");
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters");
      return;
    }
    
    setPasswordLoading(true);
    try {
      await stageClient.functions.invoke("changePassword", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMessage("✅ Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setShowPasswordForm(false), 1500);
    } catch (err) {
      setPasswordMessage("❌ " + (err.message || "Failed to change password"));
    }
    setPasswordLoading(false);
  }
  
  function applyCustomTheme(primary, gradient, bg, opacity, textColor, primaryTextColor, secondaryTextColor) {
    const root = document.documentElement;
    root.style.setProperty("--primary", `${hexToHsl(primary)}`);
    root.style.setProperty("--accent", `${hexToHsl(gradient)}`);
    root.style.setProperty("--background", `${hexToHsl(bg)}`);
    root.style.setProperty("--card", `${hexToHsl(adjustHsl(hexToHsl(bg), 5))}`);
    root.style.setProperty("--sidebar-background", `${hexToHsl(bg)}`);
    root.style.setProperty("--foreground", `${hexToHsl(textColor)}`);
    root.style.setProperty("--primary-foreground", `${hexToHsl(primaryTextColor)}`);
    root.style.setProperty("--secondary-foreground", `${hexToHsl(secondaryTextColor)}`);
    
    // Apply background image if exists
    if (backgroundImage) {
      applyBackgroundImageStyle(backgroundImage);
    } else {
      const rgb = hexToRgb(bg);
      document.body.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    }
  }
  
  function applyBackgroundImageStyle(imageUrl) {
    const bodyBg = document.querySelector('body');
    if (!bodyBg) return;
    
    const rgb = hexToRgb(customBackgroundColor);
    
    // Create or update background container
    let bgContainer = document.querySelector('[data-custom-bg]');
    if (!bgContainer) {
      bgContainer = document.createElement('div');
      bgContainer.setAttribute('data-custom-bg', 'true');
      document.body.insertBefore(bgContainer, document.body.firstChild);
    }
    
    // Add animation styles if not already in document
    if (!document.querySelector('style[data-custom-bg-animation]')) {
      const style = document.createElement('style');
      style.setAttribute('data-custom-bg-animation', 'true');
      style.innerHTML = `
        @keyframes dressingRoomPan {
          0%   { transform: scale(1.15) translate(-4%, 0%) rotate(-0.5deg); }
          25%  { transform: scale(1.18) translate(0%, -2%) rotate(0deg); }
          50%  { transform: scale(1.15) translate(4%, 1%) rotate(0.5deg); }
          75%  { transform: scale(1.18) translate(1%, -1%) rotate(0deg); }
          100% { transform: scale(1.15) translate(-4%, 0%) rotate(-0.5deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    bgContainer.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 0;
      background-image: url('${imageUrl}');
      background-size: cover;
      background-position: center;
      filter: blur(3px);
      animation: dressingRoomPan 20s ease-in-out infinite;
    `;
    
    // Add background color overlay + gradients
    bgContainer.innerHTML = `
      <div style="position: absolute; inset: 0; background: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${customBackgroundOpacity});"></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.1) 100%);"></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 25%);"></div>
      <div style="position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%);"></div>
    `;
    
    document.body.style.backgroundColor = 'transparent';
  }
  
  function adjustHsl(hslString, lightnessDelta) {
    const [h, s, l] = hslString.match(/\d+/g);
    const newL = Math.min(100, Math.max(0, parseInt(l) + lightnessDelta));
    return `${h} ${s}% ${newL}%`;
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    const hue = Math.round(h * 360);
    const sat = Math.round(s * 100);
    const light = Math.round(l * 100);
    return `${hue} ${sat}% ${light}%`;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl leading-relaxed font-bold text-foreground mb-8">Settings</h1>
      
      <div className="space-y-8">
        {/* Language */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg leading-relaxed font-bold text-foreground">Language</h3>
            <p className="text-sm text-muted-foreground">Choose your preferred language</p>
          </div>
          <Select value={localLanguage} onValueChange={(val) => { setLocalLanguage(val); setContextLanguage(val); }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Theme */}
        {theme === "theme-custom" && (
        <div className="space-y-3">
          <div className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary">
            <Palette className="w-5 h-5 text-primary shrink-0" />
            <div>
              <h3 className="text-sm leading-relaxed font-bold text-foreground">Custom Theme Settings</h3>
              <p className="text-xs text-muted-foreground">Choose a preset or customize manually</p>
            </div>
          </div>
          
          {/* Preset Themes */}
          <div className="space-y-2 p-4 rounded-lg bg-secondary border border-border">
            <p className="text-sm font-medium text-foreground mb-3">Preset Themes</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESET_THEMES.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setCustomPrimaryColor(preset.primary);
                    setCustomGradientColor(preset.gradient);
                    setCustomBackgroundColor(preset.background);
                    setCustomTextColor(preset.text);
                    setCustomPrimaryTextColor(preset.primaryText);
                    setCustomSecondaryTextColor(preset.secondaryText);
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
                >
                  <div className="flex gap-1 shrink-0">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: preset.primary }} />
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: preset.gradient }} />
                  </div>
                  <span className="text-xs font-medium text-foreground">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="space-y-4 p-4 rounded-lg bg-secondary border border-border">
            <div className="space-y-4 p-4 rounded-lg bg-secondary border border-border">
              {/* Primary Color */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customPrimaryColor}
                    onChange={(e) => setCustomPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-sm text-muted-foreground">{customPrimaryColor}</span>
                </div>
              </div>

              {/* Gradient Color */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Gradient Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customGradientColor}
                    onChange={(e) => setCustomGradientColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-sm text-muted-foreground">{customGradientColor}</span>
                </div>
              </div>

              {/* Background Color */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Background Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customBackgroundColor}
                    onChange={(e) => setCustomBackgroundColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-sm text-muted-foreground">{customBackgroundColor}</span>
                </div>
              </div>

              {/* Background Opacity */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Background Opacity: {(customBackgroundOpacity * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customBackgroundOpacity}
                  onChange={(e) => setCustomBackgroundOpacity(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Text Color */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Text Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customTextColor}
                    onChange={(e) => setCustomTextColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-sm text-muted-foreground">{customTextColor}</span>
                </div>
              </div>

              {/* Primary Text Color */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Primary Text Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customPrimaryTextColor}
                    onChange={(e) => setCustomPrimaryTextColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-sm text-muted-foreground">{customPrimaryTextColor}</span>
                </div>
              </div>

              {/* Secondary Text Color */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Secondary Text Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customSecondaryTextColor}
                    onChange={(e) => setCustomSecondaryTextColor(e.target.value)}
                    className="w-12 h-10 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-sm text-muted-foreground">{customSecondaryTextColor}</span>
                </div>
              </div>

              {/* Background Image */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Background Image</label>
                <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {backgroundImage ? "Change background" : "Upload background image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
                {backgroundImage && (
                  <p className="text-xs text-muted-foreground mt-2">Background image uploaded</p>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* App Theme */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg leading-relaxed font-bold text-foreground">App Theme</h3>
            <p className="text-sm text-muted-foreground">Choose your preferred app theme</p>
          </div>
          <Select value={theme} onValueChange={(val) => {
            localStorage.setItem("stage-theme", val);
            setTheme(val);
            window.location.reload();
          }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="theme-dark">Dark</SelectItem>
              <SelectItem value="theme-light">Day</SelectItem>
              <SelectItem value="theme-video">LIVE DARK</SelectItem>
              <SelectItem value="theme-white">LIVE WHITE</SelectItem>
              <SelectItem value="theme-custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>



        {/* Account Security */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg leading-relaxed font-bold text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" /> Account Security
            </h3>
            <p className="text-sm text-muted-foreground">Manage your password and account security</p>
          </div>
          
          {!showPasswordForm ? (
            <Button
              variant="outline"
              onClick={() => setShowPasswordForm(true)}
              className="w-full border-primary/30 text-primary hover:bg-primary/5"
            >
              <Lock className="w-4 h-4 mr-2" /> Change Password
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-lg bg-secondary border border-border">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Current Password</label>
                <div className="relative">
                  <Input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="bg-background border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">New Password</label>
                <div className="relative">
                  <Input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                    className="bg-background border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Confirm Password</label>
                <div className="relative">
                  <Input
                    type={showConfirmPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="bg-background border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {passwordMessage && (
                <p className={`text-xs font-semibold ${passwordMessage.startsWith("✅") ? "text-success" : "text-destructive"}`}>
                  {passwordMessage}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="flex-1"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordMessage("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <div className="space-y-3">
          <NotificationSettings />
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Saving..." : "Save Settings"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => stageClient.auth.logout("/")}
          className="w-full border-warning/40 text-warning hover:bg-warning/10"
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>

        {/* Danger Zone */}
        <div className="space-y-3 pt-4 border-t border-destructive/20">
          <div>
            <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Danger Zone
            </h3>
            <p className="text-sm text-muted-foreground">Permanently delete your account and all data.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete Account
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <span className="block">This will permanently delete your player profile, contracts, purchases, and all associated data. <strong className="text-foreground">This cannot be undone.</strong></span>
              <span className="block pt-2">Type <strong className="text-foreground">DELETE</strong> to confirm:</span>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
                className="w-full mt-2 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirm !== "DELETE" || deleting}
              onClick={async () => {
                setDeleting(true);
                await stageClient.functions.invoke("deleteAccount", {});
                await stageClient.auth.logout("/");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete My Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}