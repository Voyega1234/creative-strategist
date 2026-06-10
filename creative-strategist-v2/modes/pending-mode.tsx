import type { WorkspaceFeature } from "./types";

type PendingModeProps = {
  feature: WorkspaceFeature;
};

export function PendingMode({ feature }: PendingModeProps) {
  const Icon = feature.icon;

  return (
    <div className="mx-auto w-full max-w-3xl rounded-[28px] border border-black/10 bg-white p-8 text-center shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f1f1f] text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-[#1f1f1f]">{feature.label}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#667085]">{feature.description}</p>
    </div>
  );
}
