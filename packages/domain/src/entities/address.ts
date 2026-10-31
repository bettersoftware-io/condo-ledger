/** A postal address: the street and number on one line, the postcode and the city. */
export interface Address {
  street: string;
  postcode: string | null;
  city: string | null;
}

/** One line: "{street}, {postcode} {city}", leaving out what is null. */
export function addressTextOf(address: Address): string {
  const place = [address.postcode, address.city]
    .filter((part) => {
      return part !== null;
    })
    .join(" ");

  return place === "" ? address.street : `${address.street}, ${place}`;
}
