import { useAppRuntime } from "../runtime/useAppRuntime";
import { DatiCondominioSection } from "../sections/dati/DatiCondominioSection";
import { UnitaSection } from "../sections/unita/UnitaSection";
import { TabelleSection } from "../sections/tabelle/TabelleSection";
import { ContiSection } from "../sections/conti/ContiSection";
import { GiornaleSection } from "../sections/giornale/GiornaleSection";
import { RateSection } from "../sections/rate/RateSection";

export function CondominiModule() {
  const rt = useAppRuntime();
  const section = rt.useSection();
  const sel = rt.useSelection();
  if (!sel.accountingPeriodId && section !== "dati") {
    return <DatiCondominioSection />; // before a period is picked, show the registry
  }
  switch (section) {
    case "dati": return <DatiCondominioSection />;
    case "unita": return <UnitaSection />;
    case "tabelle": return <TabelleSection />;
    case "conti": return <ContiSection />;
    case "giornale": return <GiornaleSection />;
    case "rate": return <RateSection />;
  }
}
