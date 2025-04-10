import type { InfoToggle } from "#app/battle-scene";
import { globalScene } from "#app/global-scene";
import { addTextObject, TextStyle } from "./text";
import { getTypeDamageMultiplierColor } from "#app/data/type";
import { Type } from "#enums/type";
import { Command } from "./command-ui-handler";
import { Mode } from "./ui";
import UiHandler from "./ui-handler";
import * as Utils from "../utils";
import * as MoveData from "#app/data/move";
import i18next from "i18next";
import {Button} from "#enums/buttons";
import type { EnemyPokemon, PlayerPokemon, PokemonMove } from "#app/field/pokemon";
import type Pokemon from "#app/field/pokemon";
import type { CommandPhase } from "#app/phases/command-phase";
import { PokemonMultiHitModifierType } from "#app/modifier/modifier-type";
import { StatusEffect } from "#app/enums/status-effect";
import MoveInfoOverlay from "./move-info-overlay";
import { BattleType } from "#app/battle";

export default class FightUiHandler extends UiHandler implements InfoToggle {
  public static readonly MOVES_CONTAINER_NAME = "moves";

  private readonly logDamagePrediction: Boolean = false;

  private movesContainer: Phaser.GameObjects.Container;
  private moveInfoContainer: Phaser.GameObjects.Container;
  private typeIcon: Phaser.GameObjects.Sprite;
  private ppLabel: Phaser.GameObjects.Text;
  private ppText: Phaser.GameObjects.Text;
  private powerLabel: Phaser.GameObjects.Text;
  private powerText: Phaser.GameObjects.Text;
  private accuracyLabel: Phaser.GameObjects.Text;
  private accuracyText: Phaser.GameObjects.Text;
  private cursorObj: Phaser.GameObjects.Image | null;
  private moveCategoryIcon: Phaser.GameObjects.Sprite;
  private moveInfoOverlay : MoveInfoOverlay;

  protected fieldIndex: number = 0;
  protected fromCommand: Command = Command.FIGHT;
  protected cursor2: number = 0;

  constructor() {
    super(Mode.FIGHT);
  }

  setup() {
    const ui = this.getUi();

    this.movesContainer = globalScene.add.container(18, -38.7);
    this.movesContainer.setName(FightUiHandler.MOVES_CONTAINER_NAME);
    ui.add(this.movesContainer);

    this.moveInfoContainer = globalScene.add.container(1, 0);
    this.moveInfoContainer.setName("move-info");
    ui.add(this.moveInfoContainer);

    this.typeIcon = globalScene.add.sprite(globalScene.scaledCanvas.width - 57, -36, Utils.getLocalizedSpriteKey("types"), "unknown");
    this.typeIcon.setVisible(false);
    this.moveInfoContainer.add(this.typeIcon);

    this.moveCategoryIcon = globalScene.add.sprite(globalScene.scaledCanvas.width - 25, -36, "categories", "physical");
    this.moveCategoryIcon.setVisible(false);
    this.moveInfoContainer.add(this.moveCategoryIcon);

    this.ppLabel = addTextObject(globalScene.scaledCanvas.width - 70, -26, "PP", TextStyle.MOVE_INFO_CONTENT);
    this.ppLabel.setOrigin(0.0, 0.5);
    this.ppLabel.setVisible(false);
    this.ppLabel.setText(i18next.t("fightUiHandler:pp"));
    this.moveInfoContainer.add(this.ppLabel);

    this.ppText = addTextObject(globalScene.scaledCanvas.width - 12, -26, "--/--", TextStyle.MOVE_INFO_CONTENT);
    this.ppText.setOrigin(1, 0.5);
    this.ppText.setVisible(false);
    this.moveInfoContainer.add(this.ppText);

    this.powerLabel = addTextObject(globalScene.scaledCanvas.width - 70, -18, "POWER", TextStyle.MOVE_INFO_CONTENT);
    this.powerLabel.setOrigin(0.0, 0.5);
    this.powerLabel.setVisible(false);
    this.powerLabel.setText(i18next.t("fightUiHandler:power"));
    this.moveInfoContainer.add(this.powerLabel);

    this.powerText = addTextObject(globalScene.scaledCanvas.width - 12, -18, "---", TextStyle.MOVE_INFO_CONTENT);
    this.powerText.setOrigin(1, 0.5);
    this.powerText.setVisible(false);
    this.moveInfoContainer.add(this.powerText);

    this.accuracyLabel = addTextObject(globalScene.scaledCanvas.width - 70, -10, "ACC", TextStyle.MOVE_INFO_CONTENT);
    this.accuracyLabel.setOrigin(0.0, 0.5);
    this.accuracyLabel.setVisible(false);
    this.accuracyLabel.setText(i18next.t("fightUiHandler:accuracy"));
    this.moveInfoContainer.add(this.accuracyLabel);

    this.accuracyText = addTextObject(globalScene.scaledCanvas.width - 12, -10, "---", TextStyle.MOVE_INFO_CONTENT);
    this.accuracyText.setOrigin(1, 0.5);
    this.accuracyText.setVisible(false);
    this.moveInfoContainer.add(this.accuracyText);

    // prepare move overlay
    const overlayScale = 1;
    this.moveInfoOverlay = new MoveInfoOverlay({
      delayVisibility: true,
      scale: overlayScale,
      onSide: true,
      right: true,
      x: 0,
      y: -MoveInfoOverlay.getHeight(overlayScale, true),
      width: (globalScene.game.canvas.width / 6) + 4,
      hideEffectBox: true,
      hideBg: true
    });
    ui.add(this.moveInfoOverlay);
    // register the overlay to receive toggle events
    globalScene.addInfoToggle(this.moveInfoOverlay);
    globalScene.addInfoToggle(this);
  }

  show(args: any[]): boolean {
    super.show(args);

    this.fieldIndex = args.length ? args[0] as number : 0;
    this.fromCommand = args.length > 1 ? args[1] as Command : Command.FIGHT;

    const messageHandler = this.getUi().getMessageHandler();
    messageHandler.bg.setVisible(false);
    messageHandler.commandWindow.setVisible(false);
    messageHandler.movesWindowContainer.setVisible(true);
    const pokemon = (globalScene.getCurrentPhase() as CommandPhase).getPokemon();
    if (pokemon.battleSummonData.turnCount <= 1) {
      this.setCursor(0);
    } else {
      this.setCursor(this.getCursor());
    }
    this.displayMoves();
    this.toggleInfo(false); // in case cancel was pressed while info toggle is active
    this.active = true;
    return true;
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();

    let success = false;

    const cursor = this.getCursor();

    if (button === Button.CANCEL || button === Button.ACTION) {
      if (button === Button.ACTION) {
        if ((globalScene.getCurrentPhase() as CommandPhase).handleCommand(this.fromCommand, true, cursor, false)) {
          success = true;
        } else {
          ui.playError();
        }
      } else {
        // Cannot back out of fight menu if skipToFightInput is enabled
        const { battleType, mysteryEncounter } = globalScene.currentBattle;
        if (battleType !== BattleType.MYSTERY_ENCOUNTER || !mysteryEncounter?.skipToFightInput) {
          ui.setMode(Mode.COMMAND, this.fieldIndex);
          success = true;
        }
      }
    } else {
      switch (button) {
        case Button.UP:
          if (cursor >= 2) {
            success = this.setCursor(cursor - 2);
          }
          break;
        case Button.DOWN:
          if (cursor < 2) {
            success = this.setCursor(cursor + 2);
          }
          break;
        case Button.LEFT:
          if (cursor % 2 === 1) {
            success = this.setCursor(cursor - 1);
          }
          break;
        case Button.RIGHT:
          if (cursor % 2 === 0) {
            success = this.setCursor(cursor + 1);
          }
          break;
      }
    }

    if (success) {
      ui.playSelect();
    }

    return success;
  }

  toggleInfo(visible: boolean): void {
    if (visible) {
      this.movesContainer.setVisible(false);
      this.cursorObj?.setVisible(false);
    }
    globalScene.tweens.add({
      targets: [ this.movesContainer, this.cursorObj ],
      duration: Utils.fixedInt(125),
      ease: "Sine.easeInOut",
      alpha: visible ? 0 : 1
    });
    if (!visible) {
      this.movesContainer.setVisible(true);
      this.cursorObj?.setVisible(true);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  getCursor(): number {
    return !this.fieldIndex ? this.cursor : this.cursor2;
  }

  setCursor(cursor: number): boolean {
    const ui = this.getUi();

    this.moveInfoOverlay.clear();
    const changed = this.getCursor() !== cursor;
    if (changed) {
      if (!this.fieldIndex) {
        this.cursor = cursor;
      } else {
        this.cursor2 = cursor;
      }
    }

    if (!this.cursorObj) {
      const isTera = this.fromCommand === Command.TERA;
      this.cursorObj = globalScene.add.image(0, 0, isTera ? "cursor_tera" : "cursor");
      this.cursorObj.setScale(isTera ? 0.7 : 1);
      ui.add(this.cursorObj);
    }

    const pokemon = (globalScene.getCurrentPhase() as CommandPhase).getPokemon();
    const moveset = pokemon.getMoveset();

    const hasMove = cursor < moveset.length;

    if (hasMove) {
      const pokemonMove = moveset[cursor]!; // TODO: is the bang correct?
      const moveType = pokemon.getMoveType(pokemonMove.getMove());
      const textureKey = Utils.getLocalizedSpriteKey("types");
      this.typeIcon.setTexture(textureKey, Type[moveType].toLowerCase()).setScale(0.8);

      const moveCategory = pokemonMove.getMove().category;
      this.moveCategoryIcon.setTexture("categories", MoveData.MoveCategory[moveCategory].toLowerCase()).setScale(1.0);
      const power = pokemonMove.getMove().power;
      const accuracy = pokemonMove.getMove().accuracy;
      const maxPP = pokemonMove.getMovePp();
      const pp = maxPP - pokemonMove.ppUsed;

      const ppLeftStr = Utils.padInt(pp, 2, "  ");
      const ppMaxStr = Utils.padInt(maxPP, 2, "  ");
      this.ppText.setText(`${ppLeftStr}/${ppMaxStr}`);
      this.powerText.setText(`${power >= 0 ? power : "---"}`);
      this.accuracyText.setText(`${accuracy >= 0 ? accuracy : "---"}`);

      const ppPercentLeft = pp / maxPP;

      //** Determines TextStyle according to percentage of PP remaining */
      let ppColorStyle = TextStyle.MOVE_PP_FULL;
      if (ppPercentLeft > 0.25 && ppPercentLeft <= 0.5) {
        ppColorStyle = TextStyle.MOVE_PP_HALF_FULL;
      } else if (ppPercentLeft > 0 && ppPercentLeft <= 0.25) {
        ppColorStyle = TextStyle.MOVE_PP_NEAR_EMPTY;
      } else if (ppPercentLeft === 0) {
        ppColorStyle = TextStyle.MOVE_PP_EMPTY;
      }

      //** Changes the text color and shadow according to the determined TextStyle */
      this.ppText.setColor(this.getTextColor(ppColorStyle, false));
      this.ppText.setShadowColor(this.getTextColor(ppColorStyle, true));
      this.moveInfoOverlay.show(pokemonMove.getMove());

      pokemon.getOpponents().forEach((opponent) => {
        opponent.updateEffectiveness(this.getEffectivenessText(pokemon, opponent, pokemonMove));
      });
    }

    this.typeIcon.setVisible(hasMove);
    this.ppLabel.setVisible(hasMove);
    this.ppText.setVisible(hasMove);
    this.powerLabel.setVisible(hasMove);
    this.powerText.setVisible(hasMove);
    this.accuracyLabel.setVisible(hasMove);
    this.accuracyText.setVisible(hasMove);
    this.moveCategoryIcon.setVisible(hasMove);

    this.cursorObj.setPosition(13 + (cursor % 2 === 1 ? 100 : 0), -31 + (cursor >= 2 ? 15 : 0));

    return changed;
  }

  /**
   * Gets multiplier text for a pokemon's move against a specific opponent.
   * Returns undefined if it's a status move.
   *
   * If Type Hints is enabled, shows the move's type effectiveness.
   *
   * If Damage Calculation is enabled, shows the move's expected damage range.
   *
   * If Type Hints and Damage Calculation are both off, the type effectiveness multiplier is hidden.
   */
  private getEffectivenessText(pokemon: Pokemon, opponent: Pokemon, pokemonMove: PokemonMove): string | undefined {
    const effectiveness = opponent.getMoveEffectiveness(pokemon, pokemonMove.getMove(), !opponent.battleData?.abilityRevealed);
    if (effectiveness === undefined) {
      return undefined;
    }

    var calc = this.calcDamage(pokemon as PlayerPokemon, opponent, pokemonMove);
    if (calc != "") {
      if (globalScene.typeHints) return `${effectiveness}x - ${calc}`;
      return calc;
    }
    if (globalScene.typeHints) return `${effectiveness}x`;
    return "";
  }

  displayMoves() {
    const pokemon = (globalScene.getCurrentPhase() as CommandPhase).getPokemon();
    const moveset = pokemon.getMoveset();

    for (let moveIndex = 0; moveIndex < 4; moveIndex++) {
      const moveText = addTextObject(moveIndex % 2 === 0 ? 0 : 100, moveIndex < 2 ? 0 : 16, "-", TextStyle.WINDOW);
      moveText.setName("text-empty-move");

      if (moveIndex < moveset.length) {
        const pokemonMove = moveset[moveIndex]!; // TODO is the bang correct?
        moveText.setText(pokemonMove.getName());
        moveText.setName(pokemonMove.getName());
        moveText.setColor(this.getMoveColor(pokemon, pokemonMove) ?? moveText.style.color);
      }

      this.movesContainer.add(moveText);
    }
  }

  /**
   * Returns a specific move's color based on its type effectiveness against opponents
   * If there are multiple opponents, the highest effectiveness' color is returned
   * @returns A color or undefined if the default color should be used
   */
  private getMoveColor(pokemon: Pokemon, pokemonMove: PokemonMove): string | undefined {
    if (!globalScene.typeHints) {
      return undefined;
    }

    const opponents = pokemon.getOpponents();
    if (opponents.length <= 0) {
      return undefined;
    }

    const moveColors = opponents
      .map((opponent) => opponent.getMoveEffectiveness(pokemon, pokemonMove.getMove(), !opponent.battleData.abilityRevealed))
      .sort((a, b) => b - a)
      .map((effectiveness) => getTypeDamageMultiplierColor(effectiveness ?? 0, "offense"));

    return moveColors[0];
  }

  clear() {
    super.clear();
    const messageHandler = this.getUi().getMessageHandler();
    this.clearMoves();
    this.typeIcon.setVisible(false);
    this.ppLabel.setVisible(false);
    this.ppText.setVisible(false);
    this.powerLabel.setVisible(false);
    this.powerText.setVisible(false);
    this.accuracyLabel.setVisible(false);
    this.accuracyText.setVisible(false);
    this.moveCategoryIcon.setVisible(false);
    this.moveInfoOverlay.clear();
    messageHandler.bg.setVisible(true);
    this.eraseCursor();
    this.active = false;
  }

  clearMoves() {
    this.movesContainer.removeAll(true);

    const opponents = (globalScene.getCurrentPhase() as CommandPhase).getPokemon().getOpponents();
    opponents.forEach((opponent) => {
      opponent.updateEffectiveness(undefined);
    });
  }

  eraseCursor() {
    if (this.cursorObj) {
      this.cursorObj.destroy();
    }
    this.cursorObj = null;
  }

  calcDamage(user: PlayerPokemon, target: Pokemon, move: PokemonMove) {
    var moveObj = move.getMove();
    if (moveObj.category == MoveData.MoveCategory.STATUS) {
      return ""; // Don't give a damage estimate for status moves
    }

    if (target.getMoveEffectiveness(user, moveObj, false, true) == undefined) {
      return ""; // Target is immune
    }

    var dmgRange = 0.85;
    const fixedDamage = new Utils.NumberHolder(0);
    MoveData.applyMoveAttrs(MoveData.FixedDamageAttr, user, target, moveObj, fixedDamage);
    if (fixedDamage.value > 0) {
      dmgRange = 1;
    }

    var isGuaranteedCrit = target.isGuaranteedCrit(user, moveObj, true);
    var isTera = user.isTerastallized;
    user.isTerastallized = isTera ? isTera : this.fromCommand === Command.TERA; // If not yet terastallized, check if command wants to terastallize
    var dmgLow = target.getAttackDamage(user, moveObj, false, false, isGuaranteedCrit, true).damage * dmgRange;
    var dmgHigh = target.getAttackDamage(user, moveObj, false, false, isGuaranteedCrit, true).damage;
    user.isTerastallized = isTera; // Revert to whatever the terastallize state was before

    if (this.logDamagePrediction) console.log(`Damage min: ${dmgLow} | Damage max: ${dmgHigh}`);

    var minHits = 1;
    var maxHits = -1; // If nothing changes this value, it is set to minHits
    var mh = moveObj.getAttrs(MoveData.MultiHitAttr);
    for (var i = 0; i < mh.length; i++) {
      var mh2 = mh[i] as MoveData.MultiHitAttr;
      switch (mh2.getMultiHitType()) {
        case MoveData.MultiHitType._2:
          minHits = 2;
        case MoveData.MultiHitType._2_TO_5:
          minHits = 2;
          maxHits = 5;
        case MoveData.MultiHitType._3:
          minHits = 3;
        case MoveData.MultiHitType._10:
          minHits = 1;
          maxHits = 10;
        case MoveData.MultiHitType.BEAT_UP:
          const party = user.isPlayer() ? globalScene.getPlayerParty() : globalScene.getEnemyParty();
          // No status means the ally pokemon can contribute to Beat Up
          minHits = party.reduce((total, pokemon) => {
            return total + (pokemon.id === user.id ? 1 : pokemon?.status && pokemon.status.effect !== StatusEffect.NONE ? 0 : 1);
          }, 0);
      }
    }

    if (maxHits == -1) {
      maxHits = minHits;
    }

    // Add Multi Lens if its not a multi-hit move
    if (minHits == 1) {
      var h = user.getHeldItems();
      for (var i = 0; i < h.length; i++) {
        if (h[i].type instanceof PokemonMultiHitModifierType) {
          minHits *= h[i].getStackCount();
          maxHits *= h[i].getStackCount();
        }
      }
    }

    if (this.logDamagePrediction) console.log(`MinHits: ${minHits} | MaxHits: ${maxHits}`);

    if (false) {
      dmgLow = dmgLow * minHits;
      dmgHigh = dmgHigh * maxHits;
    }

    // Actual damage dealt
    var dmgLowF = Math.floor(dmgLow);
    var dmgHighF = Math.floor(dmgHigh);

    var maxEHP = target.getMaxHp();

    var koText = "";
    if (dmgLowF >= maxEHP) {
      koText = " KO";
    } else if (dmgHighF >= target.hp) {
      var percentChance = Utils.rangemap(maxEHP, dmgLow, dmgHigh);
      koText = " " + Math.floor(percentChance * 100) + "% KO";
    }

    // Calculate boss shield segments cleared
    var qSuffix = "";
    if (target.isBoss()) {
      var segmentRequirements = (target as EnemyPokemon).calculateBossShieldRequirements();
      if (this.logDamagePrediction) console.log(`Segments: ${segmentRequirements}`);

      maxEHP = segmentRequirements[segmentRequirements.length - 1];

      // Count amount of segments cleared.
      var segmentClearedLow = segmentRequirements.reduce((total, req) => {
        return total + (dmgLowF >= req ? 1 : 0);
      }, 0);
      var segmentClearedHigh = segmentRequirements.reduce((total, req) => {
        return total + (dmgHighF >= req ? 1 : 0);
      }, 0);

      // Set info suffix text
      qSuffix = ` (${segmentClearedLow}-${segmentClearedHigh})`;
      if (segmentClearedLow == segmentClearedHigh) {
        qSuffix = ` (${segmentClearedLow})`;
      }

      if (this.logDamagePrediction) console.log(`Segments min: ${segmentClearedLow} | Segments max: ${segmentClearedHigh}`);

      if (segmentClearedLow == segmentRequirements.length) {
        // Same segment, Guaranteed kill
        // 100% KO
        // show damage ranges
        koText = " KO";
      } else if (segmentClearedHigh == segmentRequirements.length) {
        // Different segment, only high is a kill
        // ~% KO
        // show segment damage for low and damage range for high
        var percentChance = Utils.rangemap(maxEHP, dmgLow, dmgHigh);
        koText = " " + Math.floor(percentChance * 100) + "% KO";

        dmgLow = segmentClearedLow > 0 ? segmentRequirements[0] * segmentClearedLow : dmgLow;
      } else if (segmentClearedLow == segmentClearedHigh) {
        // Same segment
        // no KO
        // show segment damage for both
        koText = "";

        dmgLow = segmentClearedLow > 0 ? segmentRequirements[0] * segmentClearedLow : dmgLow;
        dmgHigh = segmentClearedHigh > 0 ? segmentRequirements[0] * segmentClearedHigh : dmgHigh;
      } else {
        // Different segment
        // no KO
        // show segment damage for both
        koText = "";

        dmgLow = segmentClearedLow > 0 ? segmentRequirements[0] * segmentClearedLow : dmgLow;
        dmgHigh = segmentClearedHigh > 0 ? segmentRequirements[0] * segmentClearedHigh : dmgHigh;
      }

      // Re-Floor based on the new numbers
      dmgLowF = Math.floor(dmgLow);
      dmgHighF = Math.floor(dmgHigh);
      if (this.logDamagePrediction) console.log(`Boss damage min: ${dmgLow} | Boss damage max: ${dmgHigh}`);
    }

    // %HP removed
    var dmgLowP = Math.round((dmgLowF)/target.getMaxHp() * 100);
    var dmgHighP = Math.round((dmgHighF)/target.getMaxHp() * 100);

    if (this.logDamagePrediction) console.log(`HP% min: ${dmgLowP} | HP% max: ${dmgHighP}`);

    if (this.logDamagePrediction) console.log(`Enemy HP: ${target.hp} | Enemy HP%: ${target.getHpRatio() * 100}`);
    if (this.logDamagePrediction) console.log(`Max EHP: ${maxEHP}`);
    if (this.logDamagePrediction && !Utils.isNullOrUndefined(koText)) console.log(`KO%: ${koText}`);

    if (globalScene.damageDisplay == "Percent")
      return (dmgLowP == dmgHighP ? dmgLowP + "%" + qSuffix : dmgLowP + "%-" + dmgHighP + "%" + qSuffix) + koText;
    if (globalScene.damageDisplay == "Value")
      return (dmgLowF == dmgHighF ? dmgLowF + qSuffix : dmgLowF + "-" + dmgHighF + qSuffix) + koText;
    return "";
  }
}
