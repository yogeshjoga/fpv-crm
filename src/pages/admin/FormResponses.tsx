import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { EnrollmentRequests } from './EnrollmentRequests';

export function FormResponses() {
  const { id } = useParams();
  return (
    <div>
      <Link to="/admin/forms" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ChevronLeft size={15} /> Forms
      </Link>
      <EnrollmentRequests formId={id} />
    </div>
  );
}
