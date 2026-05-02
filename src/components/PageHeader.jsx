export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
      <div>
        <h1
          className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
          style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
        >
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 mt-1">{actions}</div>}
    </div>
  );
}