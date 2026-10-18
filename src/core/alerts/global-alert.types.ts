export type GlobalAlertActionEmphasis =
  | 'primary'
  | 'secondary'
  | 'danger';

export type GlobalAlertAction = {
  readonly id: string;
  readonly label: string;
  readonly emphasis: GlobalAlertActionEmphasis;
  readonly onSelect: () => void | Promise<void>;
};

export type GlobalAlertRequest = {
  readonly title: string;
  readonly message: string;
  readonly actions: readonly GlobalAlertAction[];
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
  dismiss(alertId: string): Promise<boolean>;
  selectAction(alertId: string, actionId: string): Promise<boolean>;
};
