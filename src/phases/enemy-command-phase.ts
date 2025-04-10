import { globalScene } from "#app/global-scene";
import { BattlerIndex } from "#app/battle";
import { Command } from "#app/ui/command-ui-handler";
import { FieldPhase } from "./field-phase";
import * as LoggerTools from "../logger";
import { Abilities } from "#enums/abilities";
import { BattlerTagType } from "#enums/battler-tag-type";
import { PokemonMove } from "#app/field/pokemon";

/**
 * Phase for determining an enemy AI's action for the next turn.
 * During this phase, the enemy decides whether to switch (if it has a trainer)
 * or to use a move from its moveset.
 *
 * For more information on how the Enemy AI works, see docs/enemy-ai.md
 * @see {@linkcode Pokemon.getMatchupScore}
 * @see {@linkcode EnemyPokemon.getNextMove}
 */
export class EnemyCommandPhase extends FieldPhase {
  protected fieldIndex: number;
  protected skipTurn: boolean = false;

  constructor(fieldIndex: number) {
    super();

    this.fieldIndex = fieldIndex;
    if (globalScene.currentBattle.mysteryEncounter?.skipEnemyBattleTurns) {
      this.skipTurn = true;
    }
  }

  start() {
    super.start();

    const enemyPokemon = globalScene.getEnemyField()[this.fieldIndex];
    console.log(enemyPokemon.getMoveset().map(m => m?.getName()));

    const battle = globalScene.currentBattle;

    const trainer = battle.trainer;

    if (battle.double && enemyPokemon.hasAbility(Abilities.COMMANDER)
        && enemyPokemon.getAlly().getTag(BattlerTagType.COMMANDED)) {
      this.skipTurn = true;
    }

    /**
     * If the enemy has a trainer, decide whether or not the enemy should switch
     * to another member in its party.
     *
     * This block compares the active enemy Pokemon's {@linkcode Pokemon.getMatchupScore | matchup score}
     * against the active player Pokemon with the enemy party's other non-fainted Pokemon. If a party
     * member's matchup score is 3x the active enemy's score (or 2x for "boss" trainers),
     * the enemy will switch to that Pokemon.
     */
    if (trainer && !enemyPokemon.getMoveQueue().length) {
      const opponents = enemyPokemon.getOpponents();

      if (!enemyPokemon.isTrapped()) {
        const partyMemberScores = trainer.getPartyMemberMatchupScores(enemyPokemon.trainerSlot, true);

        if (partyMemberScores.length) {
          const matchupScores = opponents.map(opp => enemyPokemon.getMatchupScore(opp));
          const matchupScore = matchupScores.reduce((total, score) => total += score, 0) / matchupScores.length;

          const sortedPartyMemberScores = trainer.getSortedPartyMemberMatchupScores(partyMemberScores);

          const switchMultiplier = 1 - (battle.enemySwitchCounter ? Math.pow(0.1, (1 / battle.enemySwitchCounter)) : 0);

          if (sortedPartyMemberScores[0][1] * switchMultiplier >= matchupScore * (trainer.config.isBoss ? 2 : 3)) {
            const index = trainer.getNextSummonIndex(enemyPokemon.trainerSlot, partyMemberScores);

            battle.turnCommands[this.fieldIndex + BattlerIndex.ENEMY] =
                { command: Command.POKEMON, cursor: index, args: [ false ], skip: this.skipTurn };
            console.log(enemyPokemon.name + " selects:", "Switch to " + globalScene.getEnemyParty()[index].name);

            battle.enemySwitchCounter++;

            LoggerTools.enemyPlan[this.fieldIndex * 2] = "Switching out";
            LoggerTools.enemyPlan[this.fieldIndex * 2 + 1] = "→ " + globalScene.getEnemyParty()[index].name;

            enemyPokemon.flyout.setText();

            globalScene.updateCatchRate();

            return this.end();
          }
        }
      }
    }

    /** Select a move to use (and a target to use it against, if applicable) */
    const nextMove = enemyPokemon.getNextMove();
    const mv = new PokemonMove(nextMove.move);

    if (trainer && trainer.shouldTera(enemyPokemon)) {
      globalScene.currentBattle.preTurnCommands[this.fieldIndex + BattlerIndex.ENEMY] = { command: Command.TERA };
    }

    globalScene.currentBattle.turnCommands[this.fieldIndex + BattlerIndex.ENEMY] =
      { command: Command.FIGHT, move: nextMove, skip: this.skipTurn };
    const targetLabels = [ "Counter", "[PLAYER L]", "[PLAYER R]", "[ENEMY L]", "[ENEMY R]" ];
    globalScene.getPlayerParty().forEach((v, i, a) => {
      if (v.isActive() && v.name) {
        targetLabels[i + 1] = v.name;
      }
    });
    globalScene.getEnemyParty().forEach((v, i, a) => {
      if (v.isActive() && v.name) {
        targetLabels[i + 3] = v.name;
      }
    });
    if (this.fieldIndex == 0) {
      targetLabels[3] = "Self";
    }
    if (this.fieldIndex == 1) {
      targetLabels[4] = "Self";
    }
    if (targetLabels[1] == targetLabels[2]) {
      targetLabels[1] += " (L)";
      targetLabels[2] += " (R)";
    }
    console.log(enemyPokemon.name + " selects:", mv.getName() + " → " + nextMove.targets.map((m) => targetLabels[m + 1]));
    globalScene.currentBattle.enemySwitchCounter = Math.max(globalScene.currentBattle.enemySwitchCounter - 1, 0);

    LoggerTools.enemyPlan[this.fieldIndex * 2] = mv.getName();
    LoggerTools.enemyPlan[this.fieldIndex * 2 + 1] = "→ " + nextMove.targets.map((m) => targetLabels[m + 1]);
    globalScene.arenaFlyout.updateFieldText();

    globalScene.updateCatchRate();

    this.end();
  }

  getFieldIndex(): number {
    return this.fieldIndex;
  }
}
