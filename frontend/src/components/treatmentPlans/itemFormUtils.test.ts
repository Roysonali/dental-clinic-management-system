import { describe, it, expect } from 'vitest';
import {
  itemFormValuesToAddRequest,
  itemFormValuesToUpdateRequest,
  itemResponseToFormValues,
} from './itemFormUtils';
import type { TreatmentPlanItemResponse } from '../../types/treatmentPlan';

const item: TreatmentPlanItemResponse = {
  id: 'item-1',
  plan_id: 'plan-1',
  procedure_id: 5,
  procedure: null,
  sequence_number: 1,
  quantity: 2,
  tooth_number: 46,
  tooth_surface: 'MOD',
  quadrant: 'UR',
  arch: 'upper',
  estimated_cost: 1500,
  discount: 100,
  item_status: 'pending',
  notes: 'Existing note',
  appointment_id: null,
  diagnosis_id: null,
};

describe('itemFormValuesToAddRequest', () => {
  it('maps string form values to the add-item payload', () => {
    const request = itemFormValuesToAddRequest({
      procedure_id: '5',
      sequence_number: '1',
      quantity: '2',
      tooth_number: '46',
      tooth_surface: 'MOD',
      quadrant: 'UR',
      arch: 'upper',
      estimated_cost: '1500',
      discount: '100',
      notes: '  Note  ',
    });
    expect(request).toEqual({
      procedure_id: 5,
      sequence_number: 1,
      quantity: 2,
      estimated_cost: 1500,
      discount: 100,
      tooth_number: 46,
      tooth_surface: 'MOD',
      quadrant: 'UR',
      arch: 'upper',
      notes: 'Note',
    });
  });

  it('leaves tooth fields null when blank', () => {
    const request = itemFormValuesToAddRequest({
      procedure_id: '5',
      sequence_number: '1',
      quantity: '',
      tooth_number: '',
      tooth_surface: '',
      quadrant: '',
      arch: '',
      estimated_cost: '',
      discount: '',
      notes: '',
    });
    expect(request.quantity).toBe(1);
    expect(request.tooth_number).toBeNull();
    expect(request.quadrant).toBeNull();
    expect(request.notes).toBeNull();
  });

  it('defaults quantity to 1 when omitted', () => {
    const request = itemFormValuesToAddRequest({
      procedure_id: '5',
      sequence_number: '1',
      quantity: '',
      tooth_number: '',
      tooth_surface: '',
      quadrant: '',
      arch: '',
      estimated_cost: '',
      discount: '',
      notes: '',
    });
    expect(request.quantity).toBe(1);
  });

  it('floors decimal quantity to integer', () => {
    const request = itemFormValuesToAddRequest({
      procedure_id: '5',
      sequence_number: '1',
      quantity: '2.7',
      tooth_number: '',
      tooth_surface: '',
      quadrant: '',
      arch: '',
      estimated_cost: '',
      discount: '',
      notes: '',
    });
    expect(request.quantity).toBe(2);
  });
});

describe('itemFormValuesToUpdateRequest', () => {
  it('sends only changed fields', () => {
    const request = itemFormValuesToUpdateRequest(
      { ...itemResponseToFormValues(item), estimated_cost: '1700' },
      item,
    );
    expect(request).toEqual({ estimated_cost: 1700 });
  });

  it('sends quantity when changed', () => {
    const request = itemFormValuesToUpdateRequest(
      { ...itemResponseToFormValues(item), quantity: '5' },
      item,
    );
    expect(request).toEqual({ quantity: 5 });
  });

  it('omits notes when unchanged or blank (R14: "" invalid, null ignored)', () => {
    const unchanged = itemFormValuesToUpdateRequest(itemResponseToFormValues(item), item);
    expect('notes' in unchanged).toBe(false);

    const blanked = itemFormValuesToUpdateRequest(
      { ...itemResponseToFormValues(item), notes: '   ' },
      item,
    );
    expect('notes' in blanked).toBe(false);
  });

  it('sends notes only when non-empty and different', () => {
    const request = itemFormValuesToUpdateRequest(
      { ...itemResponseToFormValues(item), notes: 'New note' },
      item,
    );
    expect(request.notes).toBe('New note');
  });

  it('clears tooth fields with explicit null (backend semantics)', () => {
    const request = itemFormValuesToUpdateRequest(
      { ...itemResponseToFormValues(item), tooth_number: '' },
      item,
    );
    expect(request.tooth_number).toBeNull();
  });
});

describe('itemResponseToFormValues', () => {
  it('round-trips an item into form values', () => {
    const values = itemResponseToFormValues(item);
    expect(values).toEqual({
      procedure_id: '5',
      sequence_number: '1',
      quantity: '2',
      tooth_number: '46',
      tooth_surface: 'MOD',
      quadrant: 'UR',
      arch: 'upper',
      estimated_cost: '1500',
      discount: '100',
      notes: 'Existing note',
    });
  });
});
