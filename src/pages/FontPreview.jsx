import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function FontPreview() {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setAllowed(u?.role === "admin"));
  }, []);

  if (allowed === null) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!allowed) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <p className="text-muted-foreground">Admin access required.</p>
      <Link to="/"><Button variant="outline">Go Home</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background space-y-0">
      {/* Hero Section with Green Accent */}
      <div className="bg-card border-b border-border pl-6 pr-6 lg:pl-10 lg:pr-10 py-12 flex items-start gap-6 md:gap-8">
        <div className="w-1.5 h-32 bg-primary shrink-0 rounded-sm" />
        <div className="space-y-3">
          <h1 className="font-heading text-5xl md:text-6xl font-black text-foreground tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            EA SPORTS FC™ 26
          </h1>
          <p className="text-sm md:text-base text-foreground/90 leading-relaxed max-w-3xl" style={{ wordSpacing: "0.15em" }}>
            Speel EA SPORTS FC™ 26 nu, met een vernieuwde gameplay-ervaring mogelijk gemaakt door feedback van de community, Manager Live-uitdagingen die frisse scenario's naar het nieuwe seizoen brengen, en Archetypes geïnspireerd door Grootse Voetballers.
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-12">

      {/* Font Characteristics */}
      <div className="space-y-4 pt-4">
        <p className="text-xs text-primary uppercase tracking-widest font-bold">Typography System</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="font-heading text-xs text-primary uppercase tracking-widest font-bold mb-2">Style</p>
          <p className="text-sm text-foreground">Clean geometric sans-serif</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="font-heading text-xs text-primary uppercase tracking-widest font-bold mb-2">Width</p>
          <p className="text-sm text-foreground">Slightly condensed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="font-heading text-xs text-primary uppercase tracking-widest font-bold mb-2">Edges</p>
          <p className="text-sm text-foreground">Sharp with subtle rounding</p>
        </div>
      </div>

      {/* Main Showcase */}
      <div className="space-y-6 pt-4">
        {/* FC 26 Logo Style */}
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30 rounded-2xl p-12">
          <div className="text-center space-y-4">
            <h1 className="font-heading text-7xl md:text-8xl font-black tracking-tighter text-primary" style={{ letterSpacing: "-0.02em" }}>
              FC 26
            </h1>
            <p className="text-muted-foreground text-lg font-heading tracking-wider uppercase">Ultimate Team</p>
          </div>
        </div>

        {/* Example Texts */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-3">Championship Mode</p>
            <p className="font-heading text-4xl font-bold text-primary tracking-tight">ULTIMATE TEAM</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-3">Player Jersey</p>
            <p className="font-heading text-6xl font-black text-foreground" style={{ letterSpacing: "-0.03em" }}>
              99
            </p>
          </div>
        </div>

        {/* Dynamic Motion Version */}
        <div className="bg-secondary border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-4">Dynamic Motion (Italic Slant)</p>
          <p className="font-heading text-5xl font-bold text-accent italic tracking-tight" style={{ letterSpacing: "-0.01em" }}>
            PLAYER 99
          </p>
        </div>
      </div>

      {/* Uppercase Alphabet */}
      <div className="space-y-3 pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Uppercase Letters</p>
        <div className="bg-card border border-border rounded-xl p-8">
          <p className="font-heading text-3xl font-bold text-foreground tracking-wider" style={{ letterSpacing: "0.08em" }}>
            ABCDEFGHIJKLMNOPQRSTUVWXYZ
          </p>
        </div>
      </div>

      {/* Numbers */}
      <div className="space-y-3 pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Numerals (Jersey Style)</p>
        <div className="bg-card border border-border rounded-xl p-8">
          <p className="font-heading text-5xl font-black text-primary tracking-widest" style={{ letterSpacing: "0.12em" }}>
            0 1 2 3 4 5 6 7 8 9
          </p>
        </div>
      </div>

      {/* Common Characters */}
      <div className="space-y-3 pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Common Symbols & Spacing</p>
        <div className="bg-card border border-border rounded-xl p-8">
          <p className="font-heading text-2xl font-bold text-foreground tracking-wide">
            # @ & - / : . ( ) [ ] { } !
          </p>
        </div>
      </div>

      {/* Weight Variations */}
      <div className="space-y-4 pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Weight Variations</p>
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="font-heading text-lg font-normal text-foreground tracking-wide">
              Regular Weight — Professional & Readable
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="font-heading text-lg font-bold text-foreground tracking-wide">
              Bold Weight — Headings & Names
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="font-heading text-lg font-black text-foreground tracking-wide">
              Black Weight — Jersey Numbers & Impact
            </p>
          </div>
        </div>
      </div>

      {/* Real-World Examples */}
      <div className="space-y-4 pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Real-World Examples</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="font-heading text-xs text-primary uppercase tracking-widest font-bold">Match Header</p>
            <div className="space-y-1">
              <p className="font-heading text-sm text-muted-foreground uppercase tracking-wider">Manchester United</p>
              <p className="font-heading text-4xl font-bold text-foreground">3</p>
              <p className="font-heading text-xs text-muted-foreground">Final</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="font-heading text-xs text-primary uppercase tracking-widest font-bold">Player Card</p>
            <div className="space-y-1">
              <p className="font-heading text-xl font-black text-foreground">RONALDO</p>
              <p className="font-heading text-lg font-bold text-accent">LW</p>
              <p className="font-heading text-sm text-muted-foreground">Overall: 91</p>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specs */}
      <div className="bg-secondary border border-border rounded-xl p-6 space-y-3 mt-8 mb-12">
        <p className="font-heading text-sm font-bold text-foreground uppercase tracking-widest">Technical Specifications</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div>• Letter-spacing: -0.02em to 0.12em</div>
          <div>• Width: 95% (slightly condensed)</div>
          <div>• Line-height: 1.1 (tight)</div>
          <div>• Kerning: Optimized for readability</div>
          <div>• Weights: Regular, Bold, Black</div>
          <div>• Style: Upright or Italic Slant</div>
        </div>
      </div>
      </div>
    </div>
  );
}