import { globalScene } from "#app/global-scene";
import type Pokemon from "#app/field/pokemon";
import { BattlePhase } from "./battle-phase";
import { BattlerIndex } from "#app/battle";
import * as Utils from "../utils";
import { Stat } from "#app/enums/stat";
import { TrickRoomTag } from "#app/data/arena-tag";

type PokemonFunc = (pokemon: Pokemon) => void;

export abstract class FieldPhase extends BattlePhase {
  executeForAll(func: PokemonFunc): void {
    const field = globalScene.getField(true).filter(p => p.summonData);
    field.forEach(pokemon => func(pokemon));
  }
}
