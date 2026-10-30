/** A postal address: the street and number on one line, the postcode and the city. */
export interface Address {
  street: string;
  postcode: string | null;
  city: string | null;
}
