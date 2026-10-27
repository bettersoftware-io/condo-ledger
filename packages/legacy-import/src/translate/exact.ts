/**
 * The English of each Italian string of the legacy seed that is not
 * templated, keyed by the string as the seed holds it after
 * pseudonymisation. The names in it (a firm, a utility, a town, "Valerio")
 * are the seed's pseudonyms and stay as they are; the rest is plain
 * accounting English, worded after the design's labels where it has one.
 * A string missing here and matching no pattern in patterns.ts stops the
 * generator.
 */
const EXACT: Readonly<Record<string, string>> = {
  // ---- Accounts: assets and liabilities ----
  Liquidità: "Liquidity",
  "Cassa Contanti": "Cash on hand",
  "Cassa contanti": "Cash on hand",
  Banche: "Banks",
  Poste: "Post office",
  "Libretti di Risparmio/Depositi": "Savings books / Deposits",
  "Crediti/debiti vs condòmini": "Receivables/payables vs owners",
  "Arrotondamenti attivi/passivi": "Active/passive roundings",
  Fondi: "Funds",
  "Accumulato dai condòmini": "Accumulated from owners",
  "Interessi per morosità": "Late-payment interest",
  Imprevisti: "Contingencies",
  "Debiti vs terzi": "Payables to third parties",
  Fornitori: "Suppliers",
  Amministrazione: "Administration",
  Dipendenti: "Employees",
  "Salari e stipendi": "Salaries & wages",
  "13° e 14° non versati": "Unpaid 13th & 14th month pay",
  "Fondo di accantonamento TFR": "Severance (TFR) reserve",
  Erario: "Tax authority",
  "Professionisti - trib. 1040": "Professionals - tax code 1040",
  "Amministratori occasionali - trib. 1004":
    "Occasional administrators - tax code 1004",
  "Società di persone - trib. 1019": "Partnerships - tax code 1019",
  "Società di capitali - trib. 1020": "Corporations - tax code 1020",
  "Istituti previdenziali": "Social security institutions",
  "Debiti/crediti vs fornitori": "Payables/receivables vs suppliers",
  "Debiti vs Erario": "Payables to the tax authority",
  "Anticipi amministrazione Studio Bertoli Amministrazioni":
    "Administration advances - Studio Bertoli Amministrazioni",

  // ---- Accounts: costs ----
  "Spese generali": "General expenses",
  Assicurazione: "Insurance",
  "Aumento annuale fondo accantonamento": "Annual reserve fund increase",
  "Compenso amministratore": "Administrator fee",
  "Modello 770 e adempimenti fiscali": "Form 770 & tax compliance",
  "Spesa tenuta cc bancario": "Bank account fee",
  "Generali residenti": "General residents",
  "Spese giardino": "Garden expenses",
  "Spese varie di manutenzione": "Miscellaneous maintenance",
  "Spese scala": "Stair expenses",
  Illuminazione: "Lighting",
  Pulizia: "Cleaning",
  "Spese ascensore": "Elevator expenses",
  "Forza motrice": "Motor power",
  Manutenzione: "Maintenance",
  Consumi: "Consumption",
  Acqua: "Water",
  Gas: "Gas",
  Elettricità: "Electricity",
  "Spese personali": "Personal expenses",
  "Spese straordinarie (proprietari)": "Extraordinary expenses (owners)",
  "Manutenzione straordinaria ascensore": "Extraordinary elevator maintenance",
  "Spese generali (proprietari)": "General expenses (owners)",
  "Assicurazione fabbricato (Minisini Assicurazioni s.r.l.)":
    "Building insurance (Minisini Assicurazioni s.r.l.)",
  "Amministrazione ordinaria": "Ordinary administration",
  "Amministrazione straordinaria": "Extraordinary administration",
  "Pratica detrazione fiscale 36% (Opere risanamento terrazze - asfaltatura)":
    "Tax deduction 36% filing (terrace renovation works - asphalting)",
  "Contratti appalto manutenzioni": "Maintenance contracts",
  "Manutenzione straordinaria CT": "Extraordinary heating plant maintenance",
  "Compilazione Quadro AC": "Form AC compilation",
  "Adempimenti comma 43 L. 296/06": "Compliance with para. 43, Law 296/06",
  "Compilazione ed invio mod. 770": "Form 770 compilation & filing",
  "Diritti segreteria e fotocopie Comune Nimis":
    "Registry fees & copies - Nimis municipality",
  "Interessi / sanzioni ravvedimenti operosi":
    "Interest / penalties for voluntary settlement",
  "Spese generali (50% proprietari e 50% conduttori)":
    "General expenses (50% owners & 50% tenants)",
  Cancelleria: "Stationery",
  "Competenze Banca c/c ordinario": "Bank account fees",
  "Postali e valori bollati": "Postage & revenue stamps",
  Varie: "Miscellaneous",
  "Spese generali (conduttori)": "General expenses (tenants)",
  "Manutenzione ordinaria generale": "General ordinary maintenance",
  "Manutenzione ordinaria impianti elettrici":
    "Ordinary maintenance - electrical systems",
  "Manutenzione ordinaria igienici": "Ordinary maintenance - sanitary fittings",
  "Manutenzione ordinaria copertura": "Ordinary maintenance - roof",
  "Manutenzione ordinaria impianti idrici": "Ordinary maintenance - plumbing",
  "Spese manutenzione porte comuni": "Common doors maintenance",
  "Manutenzione ordinaria estintori": "Ordinary maintenance - extinguishers",
  "ENERGIE DEL LEDRA contratto luci utenza n. 395 123 456":
    "ENERGIE DEL LEDRA lighting contract, supply no. 395 123 456",
  "Pulizia marciapiedi esterni": "Outdoor pavement cleaning",
  "Manutenzione verde comune": "Common garden maintenance",
  "Manutenzione ordinaria Centrale Termica":
    "Ordinary maintenance - heating plant",
  "Manutenzione Centrale Termica: interventi e sostituzioni":
    "Heating plant maintenance: works & replacements",
  "Contratto Terzo Responsabile CT":
    "Heating plant third-party manager contract",
  "Pulizia scale (conduttori)": "Stair cleaning (tenants)",
  "Pulizia ordinaria scale": "Ordinary stair cleaning",
  "Pulizia straordinaria scale": "Extraordinary stair cleaning",
  "Riscaldamento elettricità e gas (conduttori)":
    "Heating, electricity & gas (tenants)",
  "GAS Metano": "Natural gas",
  "ENERGIE DEL LEDRA utenza n. 395 123 555":
    "ENERGIE DEL LEDRA supply no. 395 123 555",
  "Metano ZONA FRANCA": "Natural gas (free zone)",
  "Consumo acqua calda (conduttori)": "Hot water consumption (tenants)",
  "Acqua calda": "Hot water",
  "Consumo acqua fredda (conduttori)": "Cold water consumption (tenants)",
  "Acqua fredda": "Cold water",
  'Deduzione quota fissa Acque Fella (rif. conto "Quota fissa acqua (conduttori)")':
    'Acque Fella fixed charge deduction (see account "Water fixed charge (tenants)")',
  'Acqua calda imputata al conto "Consumo acqua calda (conduttori)"':
    'Hot water charged to the account "Hot water consumption (tenants)"',
  "Quota fissa acqua (conduttori)": "Water fixed charge (tenants)",
  "Quota fissa Acque Fella": "Acque Fella fixed charge",
  Ascensore: "Elevator",
  "Zona franca": "Free zone",
  Detrazione: "Deduction",
  "Spese individuali": "Individual expenses",
  "Spese postali singole unità (convocazione - verbale - comunicazioni)":
    "Postage, single units (notices - minutes - communications)",
  "Spese manutenzioni singole unità": "Maintenance, single units",
  "Spese manutenzioni antenna": "Antenna maintenance",
  "Interessi di mora": "Default interest",
  "Solleciti di pagamento": "Payment reminders",
  "Spese postali per solleciti": "Postage for reminders",

  // ---- Accounts: revenue ----
  "Da condòmini": "From owners",
  "Da riparto preventivo": "From budget allocation",
  "Da conguaglio a consuntivo": "From final balance settlement",
  "Da riparto preventivo straordinario": "From extraordinary budget allocation",
  "Da riparto consuntivo mensile": "From monthly final balance allocation",
  "Da affitti attivi": "From rental income",
  "Da interessi attivi": "From interest income",
  "Da conto corrente": "From bank account",
  "Da condòmini morosi": "From defaulting owners",
  "Rimborsi/sconti": "Refunds / discounts",
  "Rimborsi assicurativi per danno a parti comuni":
    "Insurance refunds for damage to common parts",
  "Rimborsi assicurativi": "Insurance refunds",
  "Utilizzo fondi": "Use of funds",
  "Conguaglio quote fondo accantonamento utilizzate":
    "Settlement of used reserve fund shares",

  // ---- Account abbreviations (the role codes stay) ----
  "Straordinarie PR": "Extraordinary PR",
  "Generali PR": "General PR",
  "Generali PR+CO": "General PR+CO",
  "Generali CO": "General CO",
  "Scale CO": "Stairs CO",
  "Riscaldamento CO": "Heating CO",
  "Acqua calda CO": "Hot water CO",
  "Acqua fredda CO": "Cold water CO",
  "Quota fissa CO": "Fixed charge CO",

  // ---- Thousandth tables ----
  Proprietà: "Property",
  "Generale residenti": "General residents",
  Scale: "Stairs",
  "Acqua preventivo": "Water budget",
  "Acqua consuntivo": "Water actual",
  Generale: "General",
  Scala: "Stairs",
  "Quota piano": "Floor share",
  Volumetrico: "Volume",
  "Riscaldamento contaore": "Heating hour meter",
  Superficie: "Surface area",
  Riscaldamento: "Heating",
  "Acqua calda contatore": "Hot water meter",
  "Acqua fredda contatore": "Cold water meter",
  "Parti uguali": "Equal shares",
  'Questo dovrebbe essere collegato al contatore contaore di riscaldamentonn(nelle tabelle di Valerio è chiamato "Riscaldamento 70% Contaore")':
    'This should be linked to the heating hour meter (in Valerio\'s tables it is called "Heating 70% hour meter")',
  'Nelle tabelle di Valerio è chiamato "sup. corpi radianti", serve come una tabella intermedia per ottenere "ore x sup. corpi radianti"':
    'In Valerio\'s tables it is called "radiator surface"; it serves as an intermediate table to obtain "hours x radiator surface"',
  'Nelle tabelle di Valerio è chiamato "ore x sup. corpi radianti", ottenuta dalla moltiplicazione di 2 tabelle: "70% contaore" (Riscaldamento contaore) e "sup. corpi radianti" (Superficie)':
    'In Valerio\'s tables it is called "hours x radiator surface", obtained by multiplying 2 tables: "70% hour meter" (Heating hour meter) and "radiator surface" (Surface area)',

  // ---- Unit groups ----
  "Scala A": "Stairwell A",
  Box: "Garages",

  // ---- Withholding taxes ----
  "Amm. di condomìnio senza P.IVA":
    "Condominium administrators without VAT no.",
  "Società di persone": "Partnerships",
  "Società di capitali": "Corporations",
  "Professionisti con P.IVA": "Professionals with VAT no.",

  // ---- Invoice reasons, also read back out of the invoice descriptions ----
  "Intervento di manutenzione giardino: siepe e vialetto":
    "Garden maintenance: hedge and path",
  "Trattamento antiparassitario alla sequoia centinaria del giardino posteriore":
    "Pest treatment of the century-old sequoia in the back garden",
  "Trattamento antiparassitario sequioia": "Pest treatment of the sequoia",
  "Taglio siepe giardino": "Garden hedge trimming",
  "Spese di amministrazione condominiale": "Condominium administration fees",
  "Spese amministrazione condominiale - parziale - caso particolare con attribuzione costi individuale":
    "Condominium administration fees - partial - special case with individual cost allocation",
  "Revisione caldaia": "Boiler service",
  "revisione caldaia": "Boiler service",
  "Riparazione porte": "Door repairs",
  "Sostituzione estintori": "Extinguisher replacement",
  "Revisione estintori": "Extinguisher service",
  "pulizia marciapiedi": "Pavement cleaning",
  "bolletta acqua": "Water bill",
  "controllo ascensori": "Elevator inspection",
  "verifica straordinaria": "Extraordinary inspection",
  "Spese luci utenza n. 395 123 456: dicembre '09 - gennaio '10":
    "Lighting bill, supply no. 395 123 456: December '09 - January '10",
  "Spese luci utenza n. 395 123 456: dicembre '12 - gennaio '13":
    "Lighting bill, supply no. 395 123 456: December '12 - January '13",
  "Spese luci utenza n. 395 123 456: febbraio - marzo":
    "Lighting bill, supply no. 395 123 456: February - March",
  "Spese luci utenza n. 395 123 456: aprile - maggio":
    "Lighting bill, supply no. 395 123 456: April - May",
  "Spese luci utenza n. 395 123 456: giugno - luglio":
    "Lighting bill, supply no. 395 123 456: June - July",
  "Spese luci utenza n. 395 123 456: agosto - settembre":
    "Lighting bill, supply no. 395 123 456: August - September",
  "Spese luci utenza n. 395 123 456: ottobre - novembre":
    "Lighting bill, supply no. 395 123 456: October - November",
  "Energie del Ledra riscaldamento utenza n. 395 123 555 - dicembre '12 - gennaio '13":
    "Energie del Ledra heating, supply no. 395 123 555 - December '12 - January '13",
  "Energie del Ledra riscaldamento utenza n. 395 123 555 - febbraio - marzo":
    "Energie del Ledra heating, supply no. 395 123 555 - February - March",
  "Energie del Ledra riscaldamento utenza n. 395 123 555 - aprile - maggio":
    "Energie del Ledra heating, supply no. 395 123 555 - April - May",
  "Energie del Ledra riscaldamento utenza n. 395 123 555 - giugno - luglio":
    "Energie del Ledra heating, supply no. 395 123 555 - June - July",
  "Energie del Ledra riscaldamento utenza n. 395 123 555 - agosto - settembre":
    "Energie del Ledra heating, supply no. 395 123 555 - August - September",
  "Energie del Ledra riscaldamento utenza n. 395 123 555 - ottobre - novembre":
    "Energie del Ledra heating, supply no. 395 123 555 - October - November",
  "spese gas dicembre '09": "Gas bill December '09",
  "spese gas dicembre '12": "Gas bill December '12",
  "spese gas gennaio": "Gas bill January",
  "spese gas febbraio": "Gas bill February",
  "spese gas marzo": "Gas bill March",
  "spese gas aprile": "Gas bill April",
  "spese gas maggio": "Gas bill May",
  "spese gas giugno": "Gas bill June",
  "spese gas luglio": "Gas bill July",
  "spese gas agosto": "Gas bill August",
  "spese gas settembre": "Gas bill September",
  "spese gas ottobre": "Gas bill October",
  "spese gas novembre": "Gas bill November",

  // ---- Entry descriptions ----
  "Inserimento saldi apertura": "Opening balances entry",
  "Incremento fondo accantonamento": "Reserve fund increase",
  "Acquisto contenitore per pubblicità condominiale da posizionare nell'androne":
    "Purchase of a holder for condominium notices, for the entrance hall",
  "Bolletta elettricità Gen-Feb 2011": "Electricity bill Jan-Feb 2011",
  "Bolletta elettricità Mar-Apr 2011": "Electricity bill Mar-Apr 2011",
  "Riparto preventivo (n°1 del 14/03/2011)":
    "Budget allocation (no. 1 of 14/03/2011)",
  "Competenze bancarie 1° trimestre": "Bank charges, 1st quarter",
  "Acquisto zerbino per l'ingresso principale":
    "Purchase of a doormat for the main entrance",
  "Premio polizza assicurazione fabbricato": "Building insurance premium",
  "Versamento R/A (Società di persone - trib. 1019)":
    "Withholding payment (Partnerships - tax code 1019)",
  "Conguaglio a consuntivo": "Final balance settlement",
  "Riparto relatvo al bilancio preventivo approvato il 13/02/2012":
    "Allocation of the budget approved on 13/02/2012",
  "Pagamento in contanti di spese postali": "Cash payment of postage",
  "Pagamento di noleggio sala riunioni": "Payment of meeting room rental",
  "Pagamento diretto di spese bancarie": "Direct payment of bank charges",
  "Deduzione Quota fissa Acque Fella": "Acque Fella fixed charge deduction",
  "Imputazione quota tra acqua calda e fredda":
    "Apportionment of the charge between hot and cold water",
  "Spese singole - postali per solleciti":
    "Individual expenses - postage for reminders",
  "Spese singole - postali per invio raccomandate":
    "Individual expenses - registered mail postage",
  "Spese singole - manutenzione antenna":
    "Individual expenses - antenna maintenance",
  "Spese singole - Fattura parziale n. 309: amministrazione condominiale":
    "Individual expenses - partial invoice no. 309: condominium administration",
  "Pagamento diretto polizza assicurativa":
    "Direct payment of insurance policy",
  "Pagamento in contanti al Comune Nimis per fotocopie":
    "Cash payment to Nimis municipality for photocopies",
};

/** The English of a string the map holds, or undefined. */
export function exactEnglish(italian: string): string | undefined {
  return Object.hasOwn(EXACT, italian) ? EXACT[italian] : undefined;
}
