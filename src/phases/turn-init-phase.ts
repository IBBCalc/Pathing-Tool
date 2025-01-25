import { BattlerIndex } from "#app/battle";
import { handleMysteryEncounterBattleStartEffects, handleMysteryEncounterTurnStartEffects } from "#app/data/mystery-encounters/utils/encounter-phase-utils";
import { TurnInitEvent } from "#app/events/battle-scene";
import type { PlayerPokemon, EnemyPokemon } from "#app/field/pokemon";
import i18next from "i18next";
import { CommandPhase } from "./command-phase";
import { EnemyCommandPhase } from "./enemy-command-phase";
import { FieldPhase } from "./field-phase";
import { GameOverPhase } from "./game-over-phase";
import { ToggleDoublePositionPhase } from "./toggle-double-position-phase";
import { TurnStartPhase } from "./turn-start-phase";
import { globalScene } from "#app/global-scene";
import * as LoggerTools from "../logger";

export class TurnInitPhase extends FieldPhase {
  constructor() {
    super();
  }

  start() {
    super.start();

    // If the flyout was shown automatically, and the user hasn't made it go away, auto-hide it
    globalScene.arenaFlyout.dismiss()

    globalScene.getPlayerField().forEach(p => {
      // If this pokemon is in play and evolved into something illegal under the current challenge, force a switch
      if (p.isOnField() && !p.isAllowedInBattle()) {
        globalScene.queueMessage(i18next.t("challenges:illegalEvolution", { "pokemon": p.name }), null, true);

        const allowedPokemon = globalScene.getPokemonAllowedInBattle();

        if (!allowedPokemon.length) {
          // If there are no longer any legal pokemon in the party, game over.
          globalScene.clearPhaseQueue();
          globalScene.unshiftPhase(new GameOverPhase());
        } else if (allowedPokemon.length >= globalScene.currentBattle.getBattlerCount() || (globalScene.currentBattle.double && !allowedPokemon[0].isActive(true))) {
          // If there is at least one pokemon in the back that is legal to switch in, force a switch.
          p.switchOut();
        } else {
          // If there are no pokemon in the back but we're not game overing, just hide the pokemon.
          // This should only happen in double battles.
          p.leaveField();
        }
        if (allowedPokemon.length === 1 && globalScene.currentBattle.double) {
          globalScene.unshiftPhase(new ToggleDoublePositionPhase(true));
        }
      }
    });

    globalScene.eventTarget.dispatchEvent(new TurnInitEvent());

    // Add new blank actions
    LoggerTools.Actions[0] = ""
    LoggerTools.Actions[1] = ""

    LoggerTools.enemyPlan[0] = ""
    LoggerTools.enemyPlan[1] = ""
    LoggerTools.enemyPlan[2] = ""
    LoggerTools.enemyPlan[3] = ""

    handleMysteryEncounterBattleStartEffects();

    // If true, will skip remainder of current phase (and not queue CommandPhases etc.)
    if (handleMysteryEncounterTurnStartEffects()) {
      this.end();
      return;
    }

    if (false) {
      globalScene.getField().forEach((pokemon, i) => {
        if (pokemon != undefined && pokemon != null)
          console.log("Handle " + pokemon.name)
        if (pokemon?.isActive()) {
          if (pokemon.isPlayer()) {
            globalScene.currentBattle.addParticipant(pokemon as PlayerPokemon);
          } else {
            console.log("Marked " + pokemon.name + " as used")
            pokemon.usedInBattle = true;
            pokemon.flyout.setText()
            pokemon.getBattleInfo().iconsActive = true
          }
          pokemon.resetTurnData();
          globalScene.pushPhase(pokemon.isPlayer() ? new CommandPhase(i) : new EnemyCommandPhase(i - BattlerIndex.ENEMY));
        }
      });
    } else {
      globalScene.getField().forEach((pokemon, i) => {
        if (pokemon?.isActive()) {
          if (!pokemon.isPlayer()) {
            pokemon.flyout.setText()
            pokemon.usedInBattle = true;
            pokemon.getBattleInfo().iconsActive = true
            pokemon.resetTurnData();
            globalScene.pushPhase(pokemon.isPlayer() ? new CommandPhase(i) : new EnemyCommandPhase(i - BattlerIndex.ENEMY));
          }
        }
      });
      globalScene.getField().forEach((pokemon, i) => {
        if (pokemon?.isActive()) {
          if (pokemon.isPlayer()) {
            globalScene.currentBattle.addParticipant(pokemon as PlayerPokemon);
            pokemon.resetTurnData();
            globalScene.pushPhase(pokemon.isPlayer() ? new CommandPhase(i) : new EnemyCommandPhase(i - BattlerIndex.ENEMY));
          }
        }
      });
    }

    var Pt = globalScene.getEnemyParty()
    var Pt1: EnemyPokemon[] = []
    var Pt2: EnemyPokemon[] = []
    for (var i = 0; i < Pt.length; i++) {
      if (i % 2 == 0) {
        Pt1.push(Pt[i])
      } else {
        Pt2.push(Pt[i])
      }
    }
    Pt.forEach((pokemon, i) => {
      if (pokemon != undefined && pokemon.hp > 0 && pokemon.isActive())
        if (pokemon.hasTrainer() || true) {
          // console.log(i)
          if (pokemon.getFieldIndex() == 1 && pokemon.isOnField()) {
            // Switch this to cycle between
            //   - hiding the top mon's team bar
            //   - showing the bottom mon's team bar with its active slots reversed
            if (false) {
              pokemon.getBattleInfo().displayParty(Pt)
              Pt[0].getBattleInfo().switchIconVisibility(false); // Make the top mon's team bar go away
              Pt[0].getBattleInfo().iconsActive = false; // Prevent the top mon from re-opening its bar
            } else {
              pokemon.getBattleInfo().displayParty(Pt2)
            }
          } else {
            pokemon.getBattleInfo().displayParty((globalScene.currentBattle.double ? Pt1 : Pt))
          }
        }
    });

    globalScene.pushPhase(new TurnStartPhase());

    globalScene.updateCatchRate()

    this.end();
  }
}
