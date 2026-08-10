import type { FC } from 'react';
import { Card } from '../../common/Card/Card';
import { formatCreditNoteAmount } from '../../../utils/creditNoteFormatting';
import type { CreditNoteRead } from '../../../types/billing';

interface CreditNoteSummaryCardProps {
  creditNote: CreditNoteRead;
}

export const CreditNoteSummaryCard: FC<CreditNoteSummaryCardProps> = ({ creditNote }) => {
  return (
    <Card variant="default" size="md">
      <Card.Header title="Credit Summary" />
      <Card.Body>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Invoice Grand Total</span>
            <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
              {formatCreditNoteAmount(creditNote.invoice.grand_total, creditNote.financials.currency_code)}
            </span>
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">Credit Note Amount</span>
            <span className="text-body-sm font-bold text-neutral-900 tabular-nums">
              {formatCreditNoteAmount(creditNote.amount, creditNote.financials.currency_code)}
            </span>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};
