export type GlobalAlertActionEmphasis =
  | 'primary'
  | 'secondary'
  | 'danger';

export type GlobalAlertAction = {
  readonly id: string;
  readonly label: string;
  readonly emphasis: GlobalAlertActionEmphasis;
  /** Side-effect-free check re-evaluated when rendering and before dispatch. */
  readonly isEnabled?: () => boolean;
  readonly onSelect: () => void | Promise<void>;
};

export type GlobalAlertRequest = {
  /** Optional stable identity used to reject duplicate event requests. */
  readonly eventId?: string;
  /** Iconify identifier from the application's approved icon collections. */
  readonly icon: string;
  readonly title: string;
  readonly message: string;
  readonly actions: readonly GlobalAlertAction[];
  /** Optional extra action appended after the existing actions. */
  readonly secondaryAction?: GlobalAlertAction;
  readonly primaryActionId: string;
  /** Runs only when this alert becomes the visible active alert. */
  readonly onActivate?: () => void | Promise<void>;
  readonly onDismiss?: () => void | Promise<void>;
};

export type ActiveGlobalAlert = {
  readonly id: string;
  readonly request: GlobalAlertRequest;
  readonly actionPending: boolean;
};

export type GlobalAlertSnapshot = {
  readonly active: ActiveGlobalAlert | undefined;
  readonly queuedCount: number;
};

export type GlobalAlertListener = (snapshot: GlobalAlertSnapshot) => void;

export type GlobalAlertService = {
  getSnapshot(): GlobalAlertSnapshot;
  subscribe(listener: GlobalAlertListener): () => void;
  present(request: GlobalAlertRequest): string;
  invalidate(eventId: string): Promise<boolean>;
  dismiss(alertId: string): Promise<boolean>;
  selectAction(alertId: string, actionId: string): Promise<boolean>;
};
