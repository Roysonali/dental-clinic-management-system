import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { clinicalText } from '../../../utils/patientRecordFormatting';
import type { PatientRecordResponse } from '../../../types/patientRecord';

interface RecordClinicalTabProps {
  record: PatientRecordResponse;
}

/** Render a labelled clinical field value (with "—" for empty). */
function ClinicalField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-body text-neutral-800">
        {clinicalText(value)}
      </dd>
    </div>
  );
}

/**
 * RecordClinicalTab — S-02 Clinical tab ([UI spec S-02]).
 *
 * Read-only DescriptionList-style view grouped into Clinical (chief
 * complaint, clinical notes, doctor remarks, treatment recommendation) and
 * Medical history (7 free-text fields). Editing happens in the Edit drawer,
 * never inline. Empty fields render "—".
 */
export const RecordClinicalTab: FC<RecordClinicalTabProps> = ({ record }) => {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Header title="Clinical" />
        <Card.Body>
          <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ClinicalField label="Chief Complaint" value={record.chief_complaint} />
            <ClinicalField label="Doctor Remarks" value={record.doctor_remarks} />
            <div className="md:col-span-2">
              <ClinicalField label="Clinical Notes" value={record.clinical_notes} />
            </div>
            <div className="md:col-span-2">
              <ClinicalField label="Treatment Recommendation" value={record.treatment_recommendation} />
            </div>
          </dl>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header title="Medical History" />
        <Card.Body>
          <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ClinicalField label="Systemic Diseases" value={record.systemic_diseases} />
            <ClinicalField label="Surgeries" value={record.surgeries} />
            <ClinicalField label="Medications" value={record.medications} />
            <ClinicalField label="Habits" value={record.habits} />
            <ClinicalField label="Medical Alerts" value={record.medical_alerts} />
            <ClinicalField label="Allergies" value={record.allergies} />
            <div className="md:col-span-2">
              <ClinicalField label="Dental History" value={record.dental_history} />
            </div>
          </dl>
        </Card.Body>
      </Card>
    </div>
  );
};
