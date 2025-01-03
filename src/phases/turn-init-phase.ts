import { BattlerIndex } from "#app/battle";
import BattleScene from "#app/battle-scene";
import { handleMysteryEncounterBattleStartEffects, handleMysteryEncounterTurnStartEffects } from "#app/data/mystery-encounters/utils/encounter-phase-utils";
import { TurnInitEvent } from "#app/events/battle-scene";
import { PlayerPokemon, EnemyPokemon } from "#app/field/pokemon";
import i18next from "i18next";
import { CommandPhase } from "./command-phase";
import { EnemyCommandPhase } from "./enemy-command-phase";
import { FieldPhase } from "./field-phase";
import { GameOverPhase } from "./game-over-phase";
import { ToggleDoublePositionPhase } from "./toggle-double-position-phase";
import { TurnStartPhase } from "./turn-start-phase";
import * as LoggerTools from "../logger";

export class TurnInitPhase extends FieldPhase {
  constructor(scene: BattleScene) {
    super(scene);
  }

  start() {
    super.start();

    // If the flyout was shown automatically, and the user hasn't made it go away, auto-hide it
    this.scene.arenaFlyout.dismiss()

    this.scene.getPlayerField().forEach(p => {
      // If this pokemon is in play and evolved into something illegal under the current challenge, force a switch
      if (p.isOnField() && !p.isAllowedInBattle()) {
        this.scene.queueMessage(i18next.t("challenges:illegalEvolution", { "pokemon": p.name }), null, true);

        const allowedPokemon = this.scene.getPokemonAllowedInBattle();

        if (!allowedPokemon.length) {
          // If there are no longer any legal pokemon in the party, game over.
          this.scene.clearPhaseQueue();
          this.scene.unshiftPhase(new GameOverPhase(this.scene));
        } else if (allowedPokemon.length >= this.scene.currentBattle.getBattlerCount() || (this.scene.currentBattle.double && !allowedPokemon[0].isActive(true))) {
          // If there is at least one pokemon in the back that is legal to switch in, force a switch.
          p.switchOut();
        } else {
          // If there are no pokemon in the back but we're not game overing, just hide the pokemon.
          // This should only happen in double battles.
          p.leaveField();
        }
        if (allowedPokemon.length === 1 && this.scene.currentBattle.double) {
          this.scene.unshiftPhase(new ToggleDoublePositionPhase(this.scene, true));
        }
      }
    });

    //this.scene.pushPhase(new MoveAnimTestPhase(this.scene));
    this.scene.eventTarget.dispatchEvent(new TurnInitEvent());

    // Add new blank actions
    LoggerTools.Actions[0] = ""
    LoggerTools.Actions[1] = ""

    LoggerTools.enemyPlan[0] = ""
    LoggerTools.enemyPlan[1] = ""
    LoggerTools.enemyPlan[2] = ""
    LoggerTools.enemyPlan[3] = ""

    handleMysteryEncounterBattleStartEffects(this.scene);

    // If true, will skip remainder of current phase (and not queue CommandPhases etc.)
    if (handleMysteryEncounterTurnStartEffects(this.scene)) {
      this.end();
      return;
    }

    if (false) {
      this.scene.getField().forEach((pokemon, i) => {
        if (pokemon != undefined && pokemon != null)
          console.log("Handle " + pokemon.name)
        if (pokemon?.isActive()) {
          if (pokemon.isPlayer()) {
            this.scene.currentBattle.addParticipant(pokemon as PlayerPokemon);
          } else {
            console.log("Marked " + pokemon.name + " as used")
            pokemon.usedInBattle = true;
            pokemon.flyout.setText()
            pokemon.getBattleInfo().iconsActive = true
          }
          pokemon.resetTurnData();
          this.scene.pushPhase(pokemon.isPlayer() ? new CommandPhase(this.scene, i) : new EnemyCommandPhase(this.scene, i - BattlerIndex.ENEMY));
        }
      });
    } else {
      this.scene.getField().forEach((pokemon, i) => {
        if (pokemon?.isActive()) {
          if (!pokemon.isPlayer()) {
            pokemon.flyout.setText()
            pokemon.usedInBattle = true;
            pokemon.getBattleInfo().iconsActive = true
            pokemon.resetTurnData();
            this.scene.pushPhase(pokemon.isPlayer() ? new CommandPhase(this.scene, i) : new EnemyCommandPhase(this.scene, i - BattlerIndex.ENEMY));
          }
        }
      });
      this.scene.getField().forEach((pokemon, i) => {
        if (pokemon?.isActive()) {
          if (pokemon.isPlayer()) {
            this.scene.currentBattle.addParticipant(pokemon as PlayerPokemon);
            pokemon.resetTurnData();
            this.scene.pushPhase(pokemon.isPlayer() ? new CommandPhase(this.scene, i) : new EnemyCommandPhase(this.scene, i - BattlerIndex.ENEMY));
          }
        }
      });
    }

    var Pt = this.scene.getEnemyParty()
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
          console.log(i)
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
            pokemon.getBattleInfo().displayParty((this.scene.currentBattle.double ? Pt1 : Pt))
          }
        }
    });

    this.scene.pushPhase(new TurnStartPhase(this.scene));

    this.scene.updateCatchRate()

    this.end();
  }
}
