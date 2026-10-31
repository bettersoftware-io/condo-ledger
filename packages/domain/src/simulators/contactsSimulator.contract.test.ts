import { describeContactsPortContract } from "../ports/__contracts__/ContactsPortContract.ts";
import { createSmallSeed } from "../testing/createSmallBooks.ts";
import { createContactsSimulator } from "./contactsSimulator.ts";

describeContactsPortContract("contacts simulator", () => {
  const seed = createSmallSeed();

  return {
    port: createContactsSimulator(seed),
    expected: seed.contacts,
    teardown: (): void => {},
  };
});
