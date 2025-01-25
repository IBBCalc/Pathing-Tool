import type { PlayerPokemon } from "#app/field/pokemon";
import { PartyMemberPokemonPhase } from "./party-member-pokemon-phase";
import * as LoggerTools from "../logger";

export abstract class PlayerPartyMemberPokemonPhase extends PartyMemberPokemonPhase {
  constructor(partyMemberIndex: integer) {
    super(partyMemberIndex, true);
  }

  getPlayerPokemon(): PlayerPokemon {
    return super.getPokemon() as PlayerPokemon;
  }
}
