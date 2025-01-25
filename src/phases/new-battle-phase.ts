import { globalScene } from "#app/global-scene";
import { BattlePhase } from "./battle-phase";

export class NewBattlePhase extends BattlePhase {
  constructor() {
    super();
  }

  start() {
    super.start();

    globalScene.newBattle();

    this.end();
  }
}
