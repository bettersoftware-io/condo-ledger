import { describeSessionPortContract } from "../ports/__contracts__/SessionPortContract.ts";
import {
  createSessionSimulator,
  DESIGN_FIRM,
  DESIGN_PRINCIPAL,
} from "./sessionSimulator.ts";

describeSessionPortContract("session simulator", () => {
  return {
    port: createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
    }),
    teardown: (): void => {},
  };
});
