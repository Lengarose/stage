import NewspaperSection from "@/components/news/NewspaperSection";

export default function MercatoPaper({ initialTransferId = "" }) {
  return (
    <NewspaperSection
      section="mercato"
      featuredId={initialTransferId}
      empty="No transfer or contract news yet."
    />
  );
}
