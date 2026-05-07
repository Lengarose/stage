import { useParams } from 'react-router-dom';
import Admin from '@/pages/Admin';

/** Fallback for `/admin/:section` when `section` is not one of the explicit static routes. */
export default function AdminSectionRoutePage() {
  const { section } = useParams();
  return <Admin forcedSection={section} />;
}
