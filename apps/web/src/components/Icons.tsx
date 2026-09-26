type IconProps = { size?: number };

function Frame({ size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function ExploreIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 5.2v1.5M12 17.3v1.5M5.2 12h1.5M17.3 12h1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 8.4 13.4 12.6 12 11.6 10.6 12.6 12 8.4Z" fill="currentColor" />
    </Frame>
  );
}

export function LaunchIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <path
        d="M13.1 3.4 6.2 13.1h4.1l-.8 7.5 7.3-10.2h-4.2l.5-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function RewardsIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <rect x="4" y="9" width="16" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9v11" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9c-.2-2.4-2.2-3.6-3.6-2.4S8 9 12 9c.2-2.4 2.2-3.6 3.6-2.4S16 9 12 9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </Frame>
  );
}

export function LeaderboardIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M7 19.2V12.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 19.2V6.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M17 19.2V10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </Frame>
  );
}

export function AccountIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <circle cx="12" cy="9" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.6 18.4c1.2-2.4 3.4-3.6 6.4-3.6s5.2 1.2 6.4 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Frame>
  );
}

export function AnalyticsIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M4.8 16.6 9.1 12.2l3.1 2.5 6.8-7.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6 7.3h4.4V11.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function StakingIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M12 4.4 18.6 7.8 12 11.2 5.4 7.8 12 4.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.4 11.4 12 14.8l6.6-3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.4 15 12 18.4l6.6-3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function DevLockIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <rect x="5.5" y="10.4" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Frame>
  );
}

export function CreateStakingIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M12 4.4 18.6 7.8 12 11.2 5.4 7.8 12 4.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.4 12.2 12 15.6l6.6-3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.8 17.2v3.6M15 19h3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Frame>
  );
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <Frame size={size}>
      <circle cx="10.5" cy="10.5" r="5.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14.6 14.6 19 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Frame>
  );
}

export function WalletIcon({ size = 16 }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M4.2 8.2V7.1A2.1 2.1 0 0 1 6.3 5h11.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3.6" y="8.2" width="16.8" height="10.2" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14.2 13.3h3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Frame>
  );
}

export function GiftIcon({ size = 16 }: IconProps) {
  return (
    <Frame size={size}>
      <rect x="3" y="8.2" width="18" height="3.6" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.2v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 11.8v6.6a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.4v-6.6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M12 8.2C12 8.2 10.4 3.2 8.3 3.7 6.4 4.1 6.4 6.8 8.4 7.6 9.6 8.1 12 8.2 12 8.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.2C12 8.2 13.6 3.2 15.7 3.7 17.6 4.1 17.6 6.8 15.6 7.6 14.4 8.1 12 8.2 12 8.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function BurnIcon({ size = 16 }: IconProps) {
  return (
    <Frame size={size}>
      <path
        d="M12 20c4-2.2 6-5.4 6-9.2 0-3.2-1.6-5.4-3.6-7.2-.4 2.4-1.6 4.2-3.2 5.6.2-3.4-.8-6.2-2.8-8.4-.6 3.8-2.4 6.6-4.8 8.6 1.2-.2 2.2.2 3 1.2-2.6.6-4.4 2.4-4.6 5.2C5.6 17.8 8.2 19.4 12 20Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function BoxIcon({ size = 16 }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M4.2 9.2 12 5.4l7.8 3.8L12 13 4.2 9.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4.2 9.2V15l7.8 3.6L19.8 15V9.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 13v5.6" stroke="currentColor" strokeWidth="1.6" />
    </Frame>
  );
}

export function PlusIcon({ size = 18 }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M12 5.5v13M5.5 12h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Frame>
  );
}

export function PanelIcon({ open, size = 18 }: IconProps & { open: boolean }) {
  return (
    <Frame size={size}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 4.5v15" stroke="currentColor" strokeWidth="1.5" />
      <path
        d={open ? "M15.2 9.4 12.6 12l2.6 2.6" : "M12.2 9.4 14.8 12l-2.6 2.6"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function LootingTokenIcon({ size }: IconProps) {
  return (
    <Frame size={size}>
      <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.6c1.4 1.6 2.4 3.1 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.5 1-3 2.4-4.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

const icons = {
  Explore: ExploreIcon,
  Launch: LaunchIcon,
  Rewards: RewardsIcon,
  "Lucky Boxes": RewardsIcon,
  Leaderboard: LeaderboardIcon,
  Analytics: AnalyticsIcon,
  Staking: StakingIcon,
  "Dev Lock": DevLockIcon,
  "Create Staking": CreateStakingIcon,
  Account: AccountIcon,
  $LOOTING: LootingTokenIcon,
};

export function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] ?? ExploreIcon;
  return <Icon size={size} />;
}

function TabFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function NewPairIcon() {
  return (
    <TabFrame>
      <circle cx="12" cy="12" r="7" {...stroke} />
      <path d="M12 9v6M9 12h6" {...stroke} />
    </TabFrame>
  );
}

export function GraduateIcon() {
  return (
    <TabFrame>
      <path d="M4.5 10.5 12 7l7.5 3.5L12 14 4.5 10.5Z" {...stroke} />
      <path d="M7.5 12.2V16c1.4 1.3 3 2 4.5 2s3.1-.7 4.5-2v-3.8" {...stroke} />
    </TabFrame>
  );
}

export function MigrateIcon() {
  return (
    <TabFrame>
      <path d="M5 12h11" {...stroke} />
      <path d="M12 7.5 16.5 12 12 16.5" {...stroke} />
      <path d="M16 6.5h3.2v11H16" {...stroke} />
    </TabFrame>
  );
}

export function MoversIcon() {
  return (
    <TabFrame>
      <path d="M4 15.5 8.5 11l3.2 3.2L20 6.5" {...stroke} />
      <path d="M14.5 6.5H20V12" {...stroke} />
    </TabFrame>
  );
}

export function TrendingIcon() {
  return (
    <TabFrame>
      <path d="M12 19c-3.2-2.2-5-4.4-5-7.1 0-2.2 1.6-3.6 3.4-3.6 1.1 0 2 .6 2.6 1.6.6-1 1.5-1.6 2.6-1.6 1.8 0 3.4 1.4 3.4 3.6 0 2.7-1.8 4.9-5 7.1Z" {...stroke} />
    </TabFrame>
  );
}

export function GridIcon() {
  return (
    <TabFrame>
      <rect x="4.5" y="4.5" width="6" height="6" rx="1.4" {...stroke} />
      <rect x="13.5" y="4.5" width="6" height="6" rx="1.4" {...stroke} />
      <rect x="4.5" y="13.5" width="6" height="6" rx="1.4" {...stroke} />
      <rect x="13.5" y="13.5" width="6" height="6" rx="1.4" {...stroke} />
    </TabFrame>
  );
}

export function AllBoxesIcon() {
  return (
    <TabFrame>
      <rect x="4" y="4.5" width="6.5" height="6.5" rx="1.4" {...stroke} />
      <rect x="13.5" y="4.5" width="6.5" height="6.5" rx="1.4" {...stroke} />
      <rect x="4" y="13" width="6.5" height="6.5" rx="1.4" {...stroke} />
      <rect x="13.5" y="13" width="6.5" height="6.5" rx="1.4" {...stroke} />
    </TabFrame>
  );
}

export function UnclaimedIcon() {
  return (
    <TabFrame>
      <rect x="4" y="10" width="16" height="8.5" rx="1.6" {...stroke} />
      <path d="M4 13.2h16M12 10v8.5" {...stroke} />
      <path d="M12 10c0-2.2-1.5-3.6-3-3.6S6.4 8.2 8 9.2C9 9.7 12 10 12 10c0-2.2 1.5-3.6 3-3.6s2.6 1.8 1 2.8C15 9.7 12 10 12 10Z" {...stroke} />
    </TabFrame>
  );
}

export function ClaimedIcon() {
  return (
    <TabFrame>
      <circle cx="12" cy="12" r="7" {...stroke} />
      <path d="M8.6 12.2 11 14.5 15.5 9.6" {...stroke} />
    </TabFrame>
  );
}

export function HoldingIcon() {
  return (
    <TabFrame>
      <path d="M5 17.5h14" {...stroke} />
      <path d="M7 17.5V9.5M12 17.5V6.5M17 17.5V12" {...stroke} />
    </TabFrame>
  );
}

export function IneligibleIcon() {
  return (
    <TabFrame>
      <circle cx="12" cy="12" r="7" {...stroke} />
      <path d="M8 8 16 16" {...stroke} />
    </TabFrame>
  );
}

export function LockedIcon() {
  return (
    <TabFrame>
      <rect x="6" y="11" width="12" height="8" rx="1.8" {...stroke} />
      <path d="M8.5 11V8.7a3.5 3.5 0 0 1 7 0V11" {...stroke} />
    </TabFrame>
  );
}

export function TableIcon() {
  return (
    <TabFrame>
      <rect x="4.5" y="5" width="15" height="14" rx="2" {...stroke} />
      <path d="M4.5 9.5h15M9.5 9.5V19" {...stroke} />
    </TabFrame>
  );
}

export function XIcon({ size = 14 }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M6 5.2 18 18.8M18 5.2 6 18.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Frame>
  );
}

export function BookIcon({ size = 14 }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M12 6.2c-1.6-1-3.4-1.4-5.6-1.2v13c2.2-.2 4 .2 5.6 1.2 1.6-1 3.4-1.4 5.6-1.2v-13c-2.2-.2-4 .2-5.6 1.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 6.2v13" stroke="currentColor" strokeWidth="1.6" />
    </Frame>
  );
}

export function PaperIcon({ size = 14 }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M8 4.5h6.2L18 8.2V19.5H8V4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 4.8V8.4H17.6M10.2 12.2h5.2M10.2 15.2h5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function TelegramIcon({ size = 14 }: IconProps) {
  return (
    <Frame size={size}>
      <path d="M5.2 11.6 18.6 6.2 15.8 18.2 11.6 14.6 8.4 16.4 8.8 13.2 5.2 11.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.8 13.2 18.6 6.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </Frame>
  );
}
