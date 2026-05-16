import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import PositionedImageUploadField from "@/components/admin/shared/PositionedImageUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { swalAlert } from "@/lib/swal";


function EditorSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 text-left hover:bg-secondary/50 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</span>
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

export default function HomePageEditor() {
  const [record, setRecord] = useState(null);
  const [form, setForm]     = useState(null);
  const [faqItems, setFaqItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingFaq, setSavingFaq] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [faqSaved, setFaqSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      stageClient.entities.HomePageContent.filter({}, null, 1).catch(() => []),
      stageClient.entities.FaqItem.filter({}, "sort_order", 100).catch(() => []),
    ]).then(([rows, faqs]) => {
      const r = rows[0] || {};
      setRecord(r);
      setForm(buildForm(r));
      setFaqItems(faqs || []);
    });
  }, []);

  function buildForm(r) {
    return {
      hero_title:         r.hero_title         ?? "Welcome To",
      hero_subtitle:      r.hero_subtitle      ?? "STAGE",
      hero_description:   r.hero_description   ?? "",
      hero_image_url:     r.hero_image_url     ?? "",
      hero_image_position:r.hero_image_position?? "50% 10%",
      hero_image_zoom:    r.hero_image_zoom    ?? null,
      hero_cta_1_label:   r.hero_cta_1_label   ?? "Competitions",
      hero_cta_1_url:     r.hero_cta_1_url     ?? "/competitions",
      hero_cta_2_label:   r.hero_cta_2_label   ?? "Game Day",
      hero_cta_2_url:     r.hero_cta_2_url     ?? "/game-day",
      hero_cta_3_label:   r.hero_cta_3_label   ?? "Store",
      hero_cta_3_url:     r.hero_cta_3_url     ?? "/lifestyle",
      section1_title:     r.section1_title     ?? "What is STAGE?",
      section1_text:      r.section1_text      ?? "",
      section1_image_url: r.section1_image_url ?? "",
      section1_image_position: r.section1_image_position ?? "50% 50%",
      section1_image_zoom:     r.section1_image_zoom     ?? null,
      section2_title:     r.section2_title     ?? "How It Works",
      section2_text:      r.section2_text      ?? "",
      section2_image_url: r.section2_image_url ?? "",
      section2_image_position: r.section2_image_position ?? "50% 50%",
      section2_image_zoom:     r.section2_image_zoom     ?? null,
      section3_title:     r.section3_title     ?? "Built for Competitors",
      section3_text:      r.section3_text      ?? "",
      section3_image_url: r.section3_image_url ?? "",
      section3_image_position: r.section3_image_position ?? "50% 50%",
      section3_image_zoom:     r.section3_image_zoom     ?? null,
      contact_email:      r.contact_email      ?? "contact@stage.gg",
      footer_tagline:     r.footer_tagline     ?? "",
    };
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function addFaq() {
    setFaqItems(items => [
      ...items,
      { id: null, question: "", answer: "", sort_order: items.length + 1, is_active: 1 },
    ]);
  }

  function removeFaq(i) {
    setFaqItems(items => items.filter((_, idx) => idx !== i));
  }

  function setFaq(i, field, value) {
    setFaqItems(items => items.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  }

  async function handleSaveFaq() {
    setSavingFaq(true);
    try {
      const existing = await stageClient.entities.FaqItem.filter({}, "sort_order", 200).catch(() => []);
      const keepIds = new Set();

      for (let i = 0; i < faqItems.length; i++) {
        const item = faqItems[i];
        const question = String(item.question || "").trim();
        const answer = String(item.answer || "").trim();
        if (!question && !answer) continue;
        if (!question || !answer) {
          throw new Error(`FAQ item ${i + 1} needs both a question and an answer.`);
        }
        const payload = {
          question,
          answer,
          sort_order: i + 1,
          is_active: item.is_active != null ? Number(item.is_active) : 1,
        };
        if (item.id) {
          await stageClient.entities.FaqItem.update(item.id, payload);
          keepIds.add(item.id);
        } else {
          const created = await stageClient.entities.FaqItem.create(payload);
          keepIds.add(created.id);
        }
      }

      for (const row of existing) {
        if (row.id && !keepIds.has(row.id)) {
          await stageClient.entities.FaqItem.delete(row.id);
        }
      }

      const refreshed = await stageClient.entities.FaqItem.filter({}, "sort_order", 100);
      setFaqItems(refreshed || []);
      setFaqSaved(true);
      setTimeout(() => setFaqSaved(false), 2500);
    } catch (err) {
      await swalAlert(`FAQ save failed: ${err?.message || "Unknown error."}`);
    } finally {
      setSavingFaq(false);
    }
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      if (record?.id) {
        await stageClient.entities.HomePageContent.update(record.id, form);
      } else {
        const created = await stageClient.entities.HomePageContent.create(form);
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
    <Button size="sm" onClick={handleSave} disabled={saving}
      className={cn(full ? "w-full h-9" : "h-8", "text-xs gap-1.5",
        saved ? "bg-success text-white" : "bg-primary text-primary-foreground")}>
      {saving ? <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin inline-block" /> : <Check className="w-3.5 h-3.5" />}
      {saving ? "Saving…" : saved ? "Saved!" : "Save All Changes"}
    </Button>
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">Home Page Editor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Edits the home page shown after signing in.</p>
        </div>
        <SaveButton />
      </div>

      {/* Hero */}
      <EditorSection title="Hero Section" defaultOpen>
        <Field label="Label above title">
          <Input value={form.hero_title} onChange={e => set("hero_title", e.target.value)} className="h-8 text-xs" placeholder="Welcome To" />
        </Field>
        <Field label="Big title">
          <Input value={form.hero_subtitle} onChange={e => set("hero_subtitle", e.target.value)} className="h-8 text-xs" placeholder="STAGE" />
        </Field>
        <Field label="Description">
          <Textarea value={form.hero_description} onChange={e => set("hero_description", e.target.value)} className="text-xs resize-none" rows={3} />
        </Field>
        <PositionedImageUploadField
          label="Background image"
          value={form.hero_image_url}
          onChange={v => set("hero_image_url", v)}
          position={form.hero_image_position}
          onPositionChange={v => set("hero_image_position", v)}
          zoom={form.hero_image_zoom}
          onZoomChange={v => set("hero_image_zoom", v)}
          preview="hero"
          placeholder="https://… or drop image above"
          title={form.hero_subtitle}
          subtitle={form.hero_title}
        />
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[1, 2, 3].map(n => (
            <div key={n} className="space-y-1.5 border border-border rounded-lg p-2">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Button {n}</p>
              <Input value={form[`hero_cta_${n}_label`]} onChange={e => set(`hero_cta_${n}_label`, e.target.value)} className="h-7 text-xs" placeholder="Label" />
              <Input value={form[`hero_cta_${n}_url`]}   onChange={e => set(`hero_cta_${n}_url`,   e.target.value)} className="h-7 text-xs" placeholder="/path" />
            </div>
          ))}
        </div>
      </EditorSection>

      {/* Content Sections */}
      {[
        { n: 1, label: "Section 1 — What is STAGE?" },
        { n: 2, label: "Section 2 — How It Works" },
        { n: 3, label: "Section 3 — Built for Competitors" },
      ].map(({ n, label }) => (
        <EditorSection key={n} title={label}>
          <Field label="Title">
            <Input value={form[`section${n}_title`]} onChange={e => set(`section${n}_title`, e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Body text">
            <Textarea value={form[`section${n}_text`]} onChange={e => set(`section${n}_text`, e.target.value)} className="text-xs resize-none" rows={4} />
          </Field>
          <PositionedImageUploadField
            label="Section image"
            value={form[`section${n}_image_url`]}
            onChange={v => set(`section${n}_image_url`, v)}
            position={form[`section${n}_image_position`]}
            onPositionChange={v => set(`section${n}_image_position`, v)}
            zoom={form[`section${n}_image_zoom`]}
            onZoomChange={v => set(`section${n}_image_zoom`, v)}
            preview="landscape"
            title={form[`section${n}_title`]}
            subtitle={`Section ${n}`}
          />
        </EditorSection>
      ))}

      {/* FAQ — stored in faq_items table */}
      <EditorSection title="FAQ">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Questions shown on the home page FAQ accordion. Saved to the database separately from other home content.
        </p>
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <div key={item.id || `new-${i}`} className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
              <div className="flex items-center justify-between">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Question {i + 1}</p>
                <button type="button" onClick={() => removeFaq(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <Input value={item.question} onChange={e => setFaq(i, "question", e.target.value)} className="h-8 text-xs" placeholder="Question…" />
              <Textarea value={item.answer} onChange={e => setFaq(i, "answer", e.target.value)} className="text-xs resize-none" rows={2} placeholder="Answer…" />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addFaq} className="h-7 text-[10px] gap-1.5">
              <Plus className="w-3 h-3" /> Add Question
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveFaq}
              disabled={savingFaq}
              className={cn("h-7 text-[10px] gap-1.5", faqSaved ? "bg-success text-white" : "")}
            >
              {savingFaq ? "Saving FAQ…" : faqSaved ? "FAQ Saved!" : "Save FAQ"}
            </Button>
          </div>
        </div>
      </EditorSection>

      {/* Footer */}
      <EditorSection title="Footer">
        <Field label="Tagline">
          <Input value={form.footer_tagline} onChange={e => set("footer_tagline", e.target.value)} className="h-8 text-xs" placeholder="The premier competitive football gaming platform." />
        </Field>
        <Field label="Contact email">
          <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} className="h-8 text-xs" placeholder="contact@stage.gg" />
        </Field>
      </EditorSection>

      <SaveButton full />
    </div>
  );
}
