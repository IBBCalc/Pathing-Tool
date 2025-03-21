import { globalScene } from "#app/global-scene";
import { applyPostBattleAbAttrs, PostBattleAbAttr } from "#app/data/ability";
import { LapsingPersistentModifier, LapsingPokemonHeldItemModifier } from "#app/modifier/modifier";
import { BattlePhase } from "./battle-phase";
import { GameOverPhase } from "./game-over-phase";
import * as LoggerTools from "../logger";

export class BattleEndPhase extends BattlePhase {
  /** If true, will increment battles won */
  isVictory: boolean;

  constructor(isVictory: boolean) {
    super();

    this.isVictory = isVictory;
  }

  start() {
    super.start();

    globalScene.gameData.gameStats.battles++;
    if (globalScene.gameMode.isEndless && globalScene.currentBattle.waveIndex + 1 > globalScene.gameData.gameStats.highestEndlessWave) {
      globalScene.gameData.gameStats.highestEndlessWave = globalScene.currentBattle.waveIndex + 1;
    }

    if (this.isVictory) {
      globalScene.currentBattle.addBattleScore();

      if (globalScene.currentBattle.trainer) {
        globalScene.gameData.gameStats.trainersDefeated++;
      }
    }

    // Endless graceful end
    if (globalScene.gameMode.isEndless && globalScene.currentBattle.waveIndex >= 5850) {
      globalScene.clearPhaseQueue();
      globalScene.unshiftPhase(new GameOverPhase(true));
    }

    for (const pokemon of globalScene.getField()) {
      if (pokemon && pokemon.battleSummonData) {
        pokemon.battleSummonData.waveTurnCount = 1;
      }
    }

    for (const pokemon of globalScene.getPokemonAllowedInBattle()) {
      applyPostBattleAbAttrs(PostBattleAbAttr, pokemon, false, this.isVictory);
    }

    if (globalScene.currentBattle.moneyScattered) {
      globalScene.currentBattle.pickUpScatteredMoney();
    }

    globalScene.clearEnemyHeldItemModifiers();

    const lapsingModifiers = globalScene.findModifiers(m => m instanceof LapsingPersistentModifier || m instanceof LapsingPokemonHeldItemModifier) as (LapsingPersistentModifier | LapsingPokemonHeldItemModifier)[];
    for (const m of lapsingModifiers) {
      const args: any[] = [];
      if (m instanceof LapsingPokemonHeldItemModifier) {
        args.push(globalScene.getPokemonById(m.pokemonId));
      }
      if (!m.lapse(...args)) {
        globalScene.removeModifier(m);
      }
    }

    // Format this wave's logs
    const drpd: LoggerTools.DRPD = LoggerTools.getDRPD();
    const wv: LoggerTools.Wave = LoggerTools.getWave(drpd, globalScene.currentBattle.waveIndex);
    let lastcount = 0;
    let lastval;
    const tempActions: string[] = wv.actions.slice();
    const prevWaveActions: string[] = [];
    wv.actions = [];
    // Loop through each action
    for (let i = 0; i < tempActions.length; i++) {
      if (tempActions[i].substring(0, 10) == "[MOVEBACK]") {
        prevWaveActions.push(tempActions[i].substring(10));
      } else if (tempActions[i] != lastval) {
        if (lastcount > 0) {
          wv.actions.push(lastval + (lastcount == 1 ? "" : " x" + lastcount));
        }
        lastval = tempActions[i];
        lastcount = 1;
      } else {
        lastcount++;
      }
    }
    if (lastcount > 0) {
      wv.actions.push(lastval + (lastcount == 1 ? "" : " x" + lastcount));
    }
    console.log(tempActions, wv.actions);
    const wv2: LoggerTools.Wave = LoggerTools.getWave(drpd, globalScene.currentBattle.waveIndex - 1);
    wv2.actions = wv2.actions.concat(prevWaveActions);
    console.log(drpd);
    LoggerTools.save(drpd);

    globalScene.updateModifiers();
    this.end();
  }
}
