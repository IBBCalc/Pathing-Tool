import { globalScene } from "#app/global-scene";
import { BattleStyle } from "#app/enums/battle-style";
import { BattlerTagType } from "#app/enums/battler-tag-type";
import { getPokemonNameWithAffix } from "#app/messages";
import { Mode } from "#app/ui/ui";
import i18next from "i18next";
import { BattlePhase } from "./battle-phase";
import { SummonMissingPhase } from "./summon-missing-phase";
import { SwitchPhase } from "./switch-phase";
import { getNatureName } from "#app/data/nature";
import * as LoggerTools from "../logger";
import { SwitchType } from "#enums/switch-type";

export class CheckSwitchPhase extends BattlePhase {
  protected fieldIndex: number;
  protected useName: boolean;

  constructor(fieldIndex: number, useName: boolean) {
    super();

    this.fieldIndex = fieldIndex;
    this.useName = useName;
  }

  start() {
    super.start();

    const pokemon = globalScene.getPlayerField()[this.fieldIndex];

    // End this phase early...

    // ...if the user is playing in Set Mode
    if (globalScene.battleStyle === BattleStyle.SET) {
      return super.end();
    }

    // ...if the checked Pokemon is somehow not on the field
    if (globalScene.field.getAll().indexOf(pokemon) === -1) {
      globalScene.unshiftPhase(new SummonMissingPhase(this.fieldIndex));
      return super.end();
    }

    // ...if there are no other allowed Pokemon in the player's party to switch with
    if (!globalScene.getPlayerParty().slice(1).filter(p => p.isActive()).length) {
      return super.end();
    }

    // ...or if any player Pokemon has an effect that prevents the checked Pokemon from switching
    if (pokemon.getTag(BattlerTagType.FRENZY)
        || pokemon.isTrapped()
        || globalScene.getPlayerField().some(p => p.getTag(BattlerTagType.COMMANDED))) {
      return super.end();
    }

    for (var i = 0; i < globalScene.getEnemyField().length; i++) {
      var pk = globalScene.getEnemyField()[i]
      var maxIVs: string[] = []
      var ivnames = ["HP", "Atk", "Def", "Sp.Atk", "Sp.Def", "Speed"]
      pk.ivs.forEach((iv, j) => {
if (iv == 31) maxIVs.push(ivnames[j])
})
      var ivDesc = maxIVs.join(",")
      if (ivDesc == "") {
        ivDesc = "No Max IVs"
      } else {
        ivDesc = "31iv: " + ivDesc
      }
      pk.getBattleInfo().flyoutMenu.toggleFlyout(true)
      pk.getBattleInfo().flyoutMenu.flyoutText[0].text = getNatureName(pk.nature)
      pk.getBattleInfo().flyoutMenu.flyoutText[1].text = ivDesc
      pk.getBattleInfo().flyoutMenu.flyoutText[2].text = pk.getAbility().name
      pk.getBattleInfo().flyoutMenu.flyoutText[3].text = pk.getPassiveAbility().name
      if (pk.abilityIndex == 2) { // Hidden Ability
        pk.getBattleInfo().flyoutMenu.flyoutText[2].setColor("#e8e8a8")
        pk.getBattleInfo().flyoutMenu.flyoutText[2].text += " (HA)"
      }
    }

    globalScene.ui.showText(i18next.t("battle:switchQuestion", { pokemonName: this.useName ? getPokemonNameWithAffix(pokemon) : i18next.t("battle:pokemon") }), null, () => {
      globalScene.ui.setMode(Mode.CONFIRM, () => {
        // Yes, I want to Pre-Switch
        globalScene.ui.setMode(Mode.MESSAGE);
        globalScene.unshiftPhase(new SwitchPhase(SwitchType.INITIAL_SWITCH, this.fieldIndex, false, true));
        for (var i = 0; i < globalScene.getEnemyField().length; i++) {
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.toggleFlyout(false)
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[0].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[1].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[2].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[3].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[2].setColor("#f8f8f8")
          globalScene.getEnemyField()[i].flyout.setText()
        }
        //globalScene.pokemonInfoContainer.hide()
        this.end();
      }, () => {
        // No, I want to leave my Pokémon as is
        globalScene.ui.setMode(Mode.MESSAGE);
        for (var i = 0; i < globalScene.getEnemyField().length; i++) {
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.toggleFlyout(false)
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[0].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[1].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[2].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[3].text = "???"
          globalScene.getEnemyField()[i].getBattleInfo().flyoutMenu.flyoutText[2].setColor("#f8f8f8")
        }
        //globalScene.pokemonInfoContainer.hide()
        this.end();
      });
    });
  }
}
