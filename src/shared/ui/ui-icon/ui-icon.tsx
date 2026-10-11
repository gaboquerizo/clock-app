export type IconName =
  | 'proicons:clock'
  | 'proicons:calendar'
  | 'proicons:alarm-clock'
  | 'proicons:globe'
  | 'proicons:pie-chart'
  | 'proicons:hourglass'
  | 'proicons:history'
  | 'proicons:settings'
  | 'proicons:timer';

type UiIconProps = {
  name: IconName;
  class?: string;
};

function renderIcon(name: IconName) {
  switch (name) {
    case 'proicons:clock':
      return (
        <g
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
        >
          <path d="M21.25 12a9.25 9.25 0 1 1-18.5 0a9.25 9.25 0 0 1 18.5 0" />
          <path d="M11.25 6.75v6h4" />
        </g>
      );
    case 'proicons:calendar':
      return (
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M17.25 4.75H6.75a3.5 3.5 0 0 0-3.5 3.5v9.5a3.5 3.5 0 0 0 3.5 3.5h10.5a3.5 3.5 0 0 0 3.5-3.5v-9.5a3.5 3.5 0 0 0-3.5-3.5m-14 4.5h17.5M7.361 4.75v-2m9.25 2v-2"
        />
      );
    case 'proicons:globe':
      return (
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M21.25 12A9.25 9.25 0 0 0 12 2.75M21.25 12H2.75m18.5 0A9.25 9.25 0 0 1 12 21.25m0-18.5A9.25 9.25 0 0 0 2.75 12M12 2.75c-.5 0-4 4.141-4 9.25s3.5 9.25 4 9.25m0-18.5c.5 0 4 4.141 4 9.25s-3.5 9.25-4 9.25M2.75 12A9.25 9.25 0 0 0 12 21.25"
        />
      );
    case 'proicons:alarm-clock':
      return (
        <g fill="none" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-width="1.5"
            d="m21.25 7.072l-3.574-3.574M2.75 7.072l3.574-3.574"
          />
          <circle cx="12" cy="12.753" r="7.75" stroke-width="1.503" />
          <path
            stroke-linecap="round"
            stroke-width="1.503"
            d="m17.514 18.267l2.236 2.235M6.486 18.267L4.25 20.502"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M11.9 8.353v4.25l3.685 2.117"
          />
        </g>
      );
    case 'proicons:hourglass':
      return (
        <g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5">
          <path stroke-linecap="round" d="m4.095 3.298l15.81-.048m-15.81 17.5l15.81-.048" />
          <path d="M18.426 3.31H5.574l.079 1.449a7.38 7.38 0 0 0 2.251 4.913l1.242 1.195a1.58 1.58 0 0 1 0 2.279L7.904 14.34a7.38 7.38 0 0 0-2.251 4.913l-.08 1.448h12.853l-.079-1.445a7.38 7.38 0 0 0-2.256-4.917l-1.242-1.194a1.58 1.58 0 0 1 0-2.28l1.242-1.193a7.38 7.38 0 0 0 2.256-4.918z" />
        </g>
      );
    case 'proicons:timer':
      return (
        <g fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" d="M9 2.75h6M12 9.5v4" />
          <circle cx="12" cy="13.5" r="7.75" />
          <path stroke-linecap="round" d="m19.75 5.818l-2.236 2.236" />
        </g>
      );
    case 'proicons:pie-chart':
      return (
        <g
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
        >
          <circle cx="12" cy="12" r="9.25" />
          <path d="M12 2.75a9.25 9.25 0 1 0 8.01 13.875L12 12z" />
        </g>
      );
    case 'proicons:history':
      return (
        <g
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
        >
          <path d="M4.281 14.385a8.25 8.25 0 1 0 .824-6.26l-.477.88m-.523-4.63v3.75a1 1 0 0 0 .523.88m4.227.12h-3.75a1 1 0 0 1-.477-.12" />
          <path d="M12.25 8v4.25l3.685 2.117" />
        </g>
      );
    case 'proicons:settings':
      return (
        <path
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M7.05 6.462a2 2 0 0 0 2.63-1.519l.32-1.72a9 9 0 0 1 3.998 0l.322 1.72a2 2 0 0 0 2.63 1.519l1.649-.58a9 9 0 0 1 2.001 3.46l-1.33 1.14a2 2 0 0 0 0 3.037l1.33 1.139a9 9 0 0 1-2.001 3.46l-1.65-.58a2 2 0 0 0-2.63 1.519L14 20.777a9 9 0 0 1-3.998 0l-.322-1.72a2 2 0 0 0-2.63-1.519l-1.649.58a9 9 0 0 1-2.001-3.46l1.33-1.14a2 2 0 0 0 0-3.036L3.4 9.342a9 9 0 0 1 2-3.46zM12 9a3 3 0 1 1 0 6a3 3 0 0 1 0-6"
          clip-rule="evenodd"
        />
      );
  }
}

export default function UiIcon(props: UiIconProps) {
  return (
    <svg
      aria-hidden="true"
      class={props.class}
      fill="none"
      viewBox="0 0 24 24"
    >
      {renderIcon(props.name)}
    </svg>
  );
}
