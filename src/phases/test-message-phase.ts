import { MessagePhase } from "./message-phase";
import * as LoggerTools from "../logger";

export class TestMessagePhase extends MessagePhase {
  constructor(message: string) {
    super(message, null, true);
  }
}
