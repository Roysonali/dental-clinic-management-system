import type { FC } from 'react';
import { Plus, CalendarPlus, FileText, ClipboardList, Receipt } from 'lucide-react';
import { Dropdown } from '../common/Dropdown/Dropdown';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';

export type CreateActionType = 'appointment' | 'record' | 'treatment-plan' | 'invoice';

interface PatientQuickActionsProps {
  /** Callback when a create action is selected — opens the inline drawer in the parent. */
  onCreateAction: (action: CreateActionType) => void;
}

/**
 * PatientQuickActions — persistent patient-level create actions.
 *
 * Renders a compact dropdown trigger that always provides access to
 * creating new Appointments, Records, Treatment Plans, and Invoices
 * for the current patient, regardless of tab state or existing data.
 *
 * Each action invokes the `onCreateAction` callback, allowing the parent
 * (PatientDetailsContainer) to open the appropriate inline drawer without
 * navigating away from the Patient Hub.
 *
 * RBAC is enforced by the backend on each target endpoint. Frontend
 * visibility is kept open for all authenticated users (the create
 * drawers handle their own field-level authorization).
 */
export const PatientQuickActions: FC<PatientQuickActionsProps> = ({
  onCreateAction,
}) => {
  const actions = [
    {
      icon: CalendarPlus,
      label: 'New Appointment',
      action: 'appointment' as const,
    },
    {
      icon: FileText,
      label: 'New Patient Record',
      action: 'record' as const,
    },
    {
      icon: ClipboardList,
      label: 'New Treatment Plan',
      action: 'treatment-plan' as const,
    },
    {
      icon: Receipt,
      label: 'New Invoice',
      action: 'invoice' as const,
    },
  ];

  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icon icon={Plus} size="sm" />}
        >
          New
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Content align="end">
        {actions.map((action) => (
          <Dropdown.Item
            key={action.label}
            icon={action.icon}
            label={action.label}
            onClick={() => onCreateAction(action.action)}
          />
        ))}
      </Dropdown.Content>
    </Dropdown>
  );
};
