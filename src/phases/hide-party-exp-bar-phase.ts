import { globalScene } from "#app/global-scene";
import { BattlePhase } from "./battle-phase";
import * as LoggerTools from "../logger";

export class HidePartyExpBarPhase extends BattlePhase {
  constructor() {
    super();
  }

  start() {
    super.start();

    globalScene.partyExpBar.hide().then(() => this.end());
  }
}
