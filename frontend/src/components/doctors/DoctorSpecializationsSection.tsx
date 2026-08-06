import type { FC } from 'react';
import { Award } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { Badge } from '../common/Badge/Badge';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { formatISODate } from '../../utils/date';
import type { DoctorResponse } from '../../types/doctor';

interface DoctorSpecializationsSectionProps {
  doctor: DoctorResponse;
}

/**
 * DoctorSpecializationsSection — read-only list of the doctor's assigned
 * specializations (resolved from the profile endpoint). No editing or
 * assignment UI (specialization CRUD belongs to a later phase).
 */
export const DoctorSpecializationsSection: FC<DoctorSpecializationsSectionProps> = ({ doctor }) => {
  const specializations = doctor.specializations;

  return (
    <Card>
      <Card.Header
        title="Specializations"
        icon={<Icon icon={Award} size="md" className="text-primary-500" />}
      />
      <Card.Body>
        {specializations.length === 0 ? (
          <EmptyState
            title="No specializations"
            description="Specializations assigned to this doctor will appear here."
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {specializations.map((spec) => (
              <li key={spec.specialization_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-900">{spec.specialization_name}</span>
                    {spec.is_primary && (
                      <Badge variant="primary" size="xs">Primary</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-caption text-neutral-500">
                    {spec.specialization_code}
                    {spec.certification_date
                      ? ` · Certified ${formatISODate(spec.certification_date)}`
                      : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
};
