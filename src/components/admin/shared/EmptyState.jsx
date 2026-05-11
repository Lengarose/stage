export default function EmptyState({ icon: Icon, text }) {
  return (
    <div className="border border-dashed border-border rounded p-12 text-center">
      <Icon className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
      <p className="text-muted-foreground text-sm uppercase tracking-widest">{text}</p>
    </div>
  );
}
