/** Who a control account's posting is with: a supplier, or an owner in one residency. */
export interface SupplierParty {
  kind: "supplier";
  id: string;
  name: string;
}

export interface OwnerParty {
  kind: "owner";
  id: string;
  personId: string;
  name: string;
  unitCode: string;
}

export type Party = SupplierParty | OwnerParty;
