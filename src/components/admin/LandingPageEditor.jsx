import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import PositionedImageUploadField from "@/components/admin/shared/PositionedImageUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { swalAlert } from "@/lib/swal";

const DEFAULT_STATS = [
  { value: "2 000+",  label: "Active Players" },
  { value: "200+",    label: "Clubs" },
  { value: "500+",    label: "Competitions Played" },
  { value: "10 000+", label: "Matches Recorded" },
];


/* ── collapsible section ──────────────────────────────────────── */
function EditorSection({ title, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 text-left hover:bg-secondary/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</span>
          {badge != null && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      {children}
    </div>
  );
}

/* ── main export ─────────────────────────────────────────────── */
export default function LandingPageEditor() {
  const [record, setRecord] = useState(null);
  const [form, setForm]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    (stageClient.entities.LandingConfig?.filter({}, null, 1) ?? Promise.resolve([]))
      .catch(() => [])
      .then(rows => {
        const r = rows[0] || {};
        setRecord(r);
        setForm(buildForm(r));
      });
  }, []);

  function buildForm(r) {
    const stats = (() => {
      try {
        const s = typeof r.stats_json === 'string' ? JSON.parse(r.stats_json || '[]') : r.stats_json;
        if (Array.isArray(s) && s.length) return s;
      } catch {}
      return DEFAULT_STATS.map(s => ({ ...s }));
    })();
    return {
      hero_title:         r.hero_title         ?? "The Competitive EA FC Platform",
      hero_description:   r.hero_description   ?? "",
      hero_image_url:     r.hero_image_url     ?? "",
      hero_image_position:r.hero_image_position?? "50% 10%",
      hero_image_zoom:    r.hero_image_zoom    ?? null,
      stats,
      section1_tag:       r.section1_tag       ?? "Compete",
      section1_title:     r.section1_title     ?? "Structured Leagues & Competitions",
      section1_text:      r.section1_text      ?? "",
      section1_image_url: r.section1_image_url ?? "",
      section1_image_position: r.section1_image_position ?? "50% 50%",
      section1_image_zoom:     r.section1_image_zoom     ?? null,
      section2_tag:       r.section2_tag       ?? "Manage",
      section2_title:     r.section2_title     ?? "Your Club, Your Rules",
      section2_text:      r.section2_text      ?? "",
      section2_image_url: r.section2_image_url ?? "",
      section2_image_position: r.section2_image_position ?? "50% 50%",
      section2_image_zoom:     r.section2_image_zoom     ?? null,
      section3_tag:       r.section3_tag       ?? "Grow",
      section3_title:     r.section3_title     ?? "Build a Career Worth Watching",
      section3_text:      r.section3_text      ?? "",
      section3_image_url: r.section3_image_url ?? "",
      section3_image_position: r.section3_image_position ?? "50% 50%",
      section3_image_zoom:     r.section3_image_zoom     ?? null,
      footer_tagline:     r.footer_tagline     ?? "",
    };
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function setStat(i, key, value) {
    setForm(f => {
      const stats = [...(f.stats || [])];
      stats[i] = { ...stats[i], [key]: value };
      return { ...f, stats };
    });
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        stats_json: JSON.stringify(form.stats || []),
      };
      delete payload.stats;
      if (record?.id) {
        await stageClient.entities.LandingConfig.update(record.id, payload);
      } else {
        const created = await stageClient.entities.LandingConfig.create(payload);
        setRecord(created);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      await swalAlert(`Save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>;

  const SaveButton = ({ full }) => (
    <Button
      size="sm"
      onClick={handleSave}
      disabled={saving}
      className={cn(full ? "w-full h-9" : "h-8", "text-xs gap-1.5", saved ? "bg-success text-white" : "bg-primary text-primary-foreground")}
    >
      {saving
        ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" />
        : <Check className="w-3.5 h-3.5" />}
      {saving ? "Saving…" : saved ? "Saved!" : "Save All Changes"}
    </Button>
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">Landing Page Editor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Changes go live immediately after saving.</p>
        </div>
        <SaveButton />
      </div>

      {/* ── Hero ── */}
      <EditorSection title="Hero Section" defaultOpen>
        <Field label="Eyebrow text (small label above title)">
          <Input value={form.hero_title} onChange={e => set("hero_title", e.target.value)} className="h-8 text-xs" placeholder="The Competitive EA FC Platform" />
        </Field>
        <Field label="Hero description">
          <Textarea value={form.hero_description} onChange={e => set("hero_description", e.target.value)} className="text-xs resize-none" rows={3} placeholder="Leagues, competitions, clubs..." />
        </Field>
        <PositionedImageUploadField
          label="Hero background image (full-screen, blurred)"
          value={form.hero_image_url}
          onChange={v => set("hero_image_url", v)}
          position={form.hero_image_position}
          onPositionChange={v => set("hero_image_position", v)}
          zoom={form.hero_image_zoom}
          onZoomChange={v => set("hero_image_zoom", v)}
          preview="hero"
          placeholder="https://… or drop image above"
          title="Your Stage Awaits"
          subtitle={form.hero_title}
        />
      </EditorSection>

      {/* ── Stats Bar ── */}
      <EditorSection title="Stats Bar" badge={form.stats?.length}>
        <p className="text-[10px] text-muted-foreground">The 4 numbers shown under the hero. Edit values like "2 000+" and labels like "Active Players".</p>
        <div className="space-y-2">
          {(form.stats || []).map((stat, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 bg-secondary/30 rounded-lg p-3">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Value</p>
                <Input value={stat.value} onChange={e => setStat(i, "value", e.target.value)} className="h-7 text-xs" placeholder="2 000+" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Label</p>
                <Input value={stat.label} onChange={e => setStat(i, "label", e.target.value)} className="h-7 text-xs" placeholder="Active Players" />
              </div>
            </div>
          ))}
        </div>
      </EditorSection>

      {/* ── Picture Sections ── */}
      {[
        { n: 1, defaultTag: "Compete" },
        { n: 2, defaultTag: "Manage" },
        { n: 3, defaultTag: "Grow"   },
      ].map(({ n, defaultTag }) => (
        <EditorSection key={n} title={`Frame ${n} — Picture + Text`}>
          <Field label="Tag / label (small coloured text above title)">
            <Input value={form[`section${n}_tag`]} onChange={e => set(`section${n}_tag`, e.target.value)} className="h-8 text-xs" placeholder={defaultTag} />
          </Field>
          <Field label="Title">
            <Input value={form[`section${n}_title`]} onChange={e => set(`section${n}_title`, e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Description">
            <Textarea value={form[`section${n}_text`]} onChange={e => set(`section${n}_text`, e.target.value)} className="text-xs resize-none" rows={4} />
          </Field>
          <PositionedImageUploadField
            label="Frame image (16:10 ratio looks best)"
            value={form[`section${n}_image_url`]}
            onChange={v => set(`section${n}_image_url`, v)}
            position={form[`section${n}_image_position`]}
            onPositionChange={v => set(`section${n}_image_position`, v)}
            zoom={form[`section${n}_image_zoom`]}
            onZoomChange={v => set(`section${n}_image_zoom`, v)}
            preview="landscape"
            title={form[`section${n}_title`]}
            subtitle={form[`section${n}_tag`]}
          />
        </EditorSection>
      ))}

      {/* ── Footer ── */}
      <EditorSection title="Footer">
        <Field label="Tagline">
          <Input value={form.footer_tagline} onChange={e => set("footer_tagline", e.target.value)} className="h-8 text-xs" placeholder="The premier competitive football gaming platform." />
        </Field>
      </EditorSection>

      <SaveButton full />
    </div>
  );
}
