import { globalScene } from "#app/global-scene";
import { Phase } from "#app/phase";
import { Mode } from "#app/ui/ui";
import { LoginPhase } from "./login-phase";
import * as LoggerTools from "../logger";

export class UnavailablePhase extends Phase {
  constructor() {
    super();
  }

  start(): void {
    globalScene.ui.setMode(Mode.UNAVAILABLE, () => {
      globalScene.unshiftPhase(new LoginPhase(true));
      this.end();
    });
  }
}
