import { addTextObject, TextStyle } from "./text";
import PartyUiHandler, { PartyUiMode } from "./party-ui-handler";
import { Mode } from "./ui";
import UiHandler from "./ui-handler";
import i18next from "i18next";
import { Button } from "#enums/buttons";
import { getPokemonNameWithAffix } from "#app/messages";
import { CommandPhase } from "#app/phases/command-phase";
import { globalScene } from "#app/global-scene";

export enum Command {
  FIGHT = 0,
  BALL,
  POKEMON,
  RUN
}

export default class CommandUiHandler extends UiHandler {
  private commandsContainer: Phaser.GameObjects.Container;
  private cursorObj: Phaser.GameObjects.Image | null;

  protected fieldIndex: number = 0;
  protected cursor2: number = 0;

  constructor() {
    super(Mode.COMMAND);
  }

  setup() {
    const ui = this.getUi();
    const commands = [
      i18next.t("commandUiHandler:fight"),
      i18next.t("commandUiHandler:ball"),
      i18next.t("commandUiHandler:pokemon"),
      i18next.t("commandUiHandler:run")
    ];

    this.commandsContainer = globalScene.add.container(217, -38.7);
    this.commandsContainer.setName("commands");
    this.commandsContainer.setVisible(false);
    ui.add(this.commandsContainer);

    for (let c = 0; c < commands.length; c++) {
      const commandText = addTextObject(c % 2 === 0 ? 0 : 55.8, c < 2 ? 0 : 16, commands[c], TextStyle.WINDOW);
      commandText.setName(commands[c]);
      this.commandsContainer.add(commandText);
    }
  }

  show(args: any[]): boolean {
    super.show(args);

    this.fieldIndex = args.length ? args[0] as number : 0;

    this.commandsContainer.setVisible(true);

    let commandPhase: CommandPhase;
    const currentPhase = globalScene.getCurrentPhase();
    if (currentPhase instanceof CommandPhase) {
      commandPhase = currentPhase;
    } else {
      commandPhase = globalScene.getStandbyPhase() as CommandPhase;
    }

    const messageHandler = this.getUi().getMessageHandler();
    messageHandler.bg.setVisible(true);
    messageHandler.commandWindow.setVisible(true);
    messageHandler.movesWindowContainer.setVisible(false);
    messageHandler.message.setWordWrapWidth(1110);
    messageHandler.showText(i18next.t("commandUiHandler:actionMessage", { pokemonName: getPokemonNameWithAffix(commandPhase.getPokemon()) }), 0);
    if (this.getCursor() === Command.POKEMON) {
      this.setCursor(Command.FIGHT);
    } else {
      this.setCursor(this.getCursor());
    }

    return true;
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();

    let success = false;

    const cursor = this.getCursor();

    if (button === Button.CANCEL || button === Button.ACTION) {

      if (button === Button.ACTION) {
        switch (cursor) {
        // Fight
          case Command.FIGHT:
            ui.setMode(Mode.FIGHT, (globalScene.getCurrentPhase() as CommandPhase).getFieldIndex());
            success = true;
            break;
          // Ball
          case Command.BALL:
            ui.setModeWithoutClear(Mode.BALL);
            success = true;
            break;
          // Pokemon
          case Command.POKEMON:
            ui.setMode(Mode.PARTY, PartyUiMode.SWITCH, (globalScene.getCurrentPhase() as CommandPhase).getPokemon().getFieldIndex(), null, PartyUiHandler.FilterNonFainted);
            success = true;
            break;
          // Run
          case Command.RUN:
            (globalScene.getCurrentPhase() as CommandPhase).handleCommand(Command.RUN, true, 0);
            success = true;
            break;
        }
      } else {
        (globalScene.getCurrentPhase() as CommandPhase).cancel();
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

  getCursor(): number {
    return !this.fieldIndex ? this.cursor : this.cursor2;
  }

  setCursor(cursor: number): boolean {
    const changed = this.getCursor() !== cursor;
    if (changed) {
      if (!this.fieldIndex) {
        this.cursor = cursor;
      } else {
        this.cursor2 = cursor;
      }
    }

    if (!this.cursorObj) {
      this.cursorObj = globalScene.add.image(0, 0, "cursor");
      this.commandsContainer.add(this.cursorObj);
    }

    this.cursorObj.setPosition(-5 + (cursor % 2 === 1 ? 56 : 0), 8 + (cursor >= 2 ? 16 : 0));

    return changed;
  }

  clear(): void {
    super.clear();
    this.getUi().getMessageHandler().commandWindow.setVisible(false);
    this.commandsContainer.setVisible(false);
    this.getUi().getMessageHandler().clearText();
    this.eraseCursor();
  }

  eraseCursor(): void {
    if (this.cursorObj) {
      this.cursorObj.destroy();
    }
    this.cursorObj = null;
  }
}
