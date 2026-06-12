import { MainSidebar } from "@/components/main-sidebar";
import { V2Workspace } from "@/creative-strategist-v2/workspace";
import { getClientsWithProductFocus } from "@/lib/data/clients";
import { ImageIcon, MoreHorizontal } from "lucide-react";

type V2PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreativeStrategistV2Page({ searchParams }: V2PageProps) {
  const params = await searchParams;
  const clients = await getClientsWithProductFocus();
  const selectedClientName = getParamValue(params?.clientName);
  const selectedProductFocusParam = getParamValue(params?.productFocus);
  const selectedIdeaSessionId = getParamValue(params?.ideaSessionId) || null;
  const isNewSession = getParamValue(params?.newSession) === "1";
  // No default client: the workspace stays locked until the user explicitly picks one.
  const selectedClient = selectedClientName
    ? clients.find((client) => client.clientName === selectedClientName) || null
    : null;
  const selectedProductFocus =
    selectedProductFocusParam ||
    selectedClient?.productFocuses?.[0]?.productFocus ||
    null;
  const selectedProductFocusEntry =
    selectedClient?.productFocuses.find((focus) => focus.productFocus === selectedProductFocus) ||
    selectedClient?.productFocuses[0];
  const activeClientId = selectedClient
    ? getParamValue(params?.clientId) || selectedProductFocusEntry?.id || selectedClient.id
    : null;
  const activeColorPalette = selectedProductFocusEntry?.colorPalette?.length
    ? selectedProductFocusEntry.colorPalette
    : selectedClient?.colorPalette;
  return (
    <main className="app-canvas flex h-screen min-h-screen overflow-hidden text-[#1f1f1f] dark:text-slate-100">
      <MainSidebar
        clients={clients}
        activeClientName={selectedClient?.clientName || "No Client Selected"}
        activeProductFocus={selectedProductFocus}
        activeClientId={activeClientId}
        mode="v2"
        showSecondaryNav={false}
        showHistory
        showServiceFilters={false}
      />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-black/10 bg-white px-4 lg:hidden dark:border-white/10 dark:bg-[#0d1322]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1f1f1f] text-white">
              <ImageIcon className="h-3.5 w-3.5" />
            </div>
            {selectedClient?.clientName || "Creative Compass"}
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-[#555]">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 px-5 py-6 sm:px-8 lg:py-8">
          <V2Workspace
            clientId={activeClientId}
            clientName={selectedClient?.clientName}
            productFocus={selectedProductFocus}
            colorPalette={activeColorPalette}
            clients={clients}
            ideaSessionId={selectedIdeaSessionId}
            startNewSession={isNewSession}
          />
        </div>
      </section>
    </main>
  );
}
