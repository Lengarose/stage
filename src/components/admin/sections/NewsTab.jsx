import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Newspaper, Upload } from "lucide-react";

export default function NewsTab({
  newsForm,
  setNewsForm,
  newsImageFile,
  setNewsImageFile,
  uploadingNews,
  postNews,
}) {
  return (
    <div className="bg-card border border-border rounded p-6 max-w-2xl space-y-4">
      <h3 className="font-heading text-lg uppercase tracking-tight text-foreground flex items-center gap-2"><Newspaper className="w-4 h-4 text-primary" /> Post News</h3>
      <div>
        <label className="label-xs">Category</label>
        <Select value={newsForm.type} onValueChange={v => setNewsForm(f => ({ ...f, type: v }))}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="app_update">App Update</SelectItem>
            <SelectItem value="announcement">Announcement</SelectItem>
            <SelectItem value="tournament">Tournament</SelectItem>
            <SelectItem value="achievement">Achievement</SelectItem>
            <SelectItem value="ranking">Rankings</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="label-xs">Title</label>
        <input value={newsForm.title} onChange={e => setNewsForm(f => ({ ...f, title: e.target.value }))}
          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="News headline..." />
      </div>
      <div>
        <label className="label-xs">Body</label>
        <Textarea value={newsForm.body} onChange={e => setNewsForm(f => ({ ...f, body: e.target.value }))}
          className="bg-secondary border-border min-h-[80px]" placeholder="News body text..." />
      </div>
      <div>
        <label className="label-xs">Image (optional)</label>
        <input type="file" accept="image/*" onChange={e => setNewsImageFile(e.target.files[0])} className="text-xs text-muted-foreground" />
        {newsImageFile && <p className="text-xs text-primary mt-1">Selected: {newsImageFile.name}</p>}
      </div>
      <Button onClick={postNews} disabled={!newsForm.title || uploadingNews} className="bg-primary text-primary-foreground gap-2">
        <Upload className="w-4 h-4" /> {uploadingNews ? "Posting..." : "Post News"}
      </Button>
    </div>
  );
}
