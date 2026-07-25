export default function EmptyState({ icon: Icon, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
      <Icon className="w-8 h-8 text-white/20 mx-auto mb-3" />
      <p className="text-white/45 text-sm uppercase tracking-widest font-heading">{text}</p>
    </div>
  );
}
