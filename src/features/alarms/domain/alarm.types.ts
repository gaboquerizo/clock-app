export type AlarmId = string;
export type AlarmTime = string;
export type AlarmLabel = string;

export type AlarmStatus = 'scheduled' | 'triggered' | 'skipped';

export type Alarm = {
  id: AlarmId;
  time: AlarmTime;
  label: AlarmLabel;
  enabled: boolean;
  status: AlarmStatus;
  order: number;
  createdAt: number;
  updatedAt: number;
  triggeredAt?: number;
  skippedAt?: number;
};

export type CreateAlarmInput = {
  id: string;
  time: string;
  label?: string;
  order: number;
  createdAt: number;
};

export type UpdateAlarmInput = {
  time: string;
  label?: string;
};

export type AlarmTransition = 'enable' | 'disable' | 'trigger' | 'skip';

export type AlarmField =
  | 'id'
  | 'time'
  | 'label'
  | 'enabled'
  | 'status'
  | 'order'
  | 'createdAt'
  | 'updatedAt'
  | 'triggeredAt'
  | 'skippedAt';

export type AlarmErrorCode =
  | 'invalid-id'
  | 'invalid-time'
  | 'invalid-label'
  | 'invalid-order'
  | 'invalid-state'
  | 'invalid-timestamp'
  | 'duplicate-id'
  | 'duplicate-time'
  | 'not-found'
  | 'invalid-transition';

export type AlarmDomainError = {
  code: AlarmErrorCode;
  field?: AlarmField;
};

export type AlarmResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AlarmDomainError };
