import { loggedInUser } from "#app/account";
import Battle, { BattleType } from "#app/battle";
import { fetchDailyRunSeed, getDailyRunStarters } from "#app/data/daily-run";
import { Gender } from "#app/data/gender";
import { getBiomeKey } from "#app/field/arena";
import { GameMode, GameModes, getGameMode } from "#app/game-mode";
import type { Modifier } from "#app/modifier/modifier";
import { getDailyRunStarterModifiers, getPlayerModifierTypeOptions, ModifierPoolType, ModifierTypeOption, modifierTypes, regenerateModifierPoolThresholds } from "#app/modifier/modifier-type";
import { Phase } from "#app/phase";
import type { SessionSaveData } from "#app/system/game-data";
import { Unlockables } from "#app/system/unlockables";
import { vouchers } from "#app/system/voucher";
import type { OptionSelectConfig, OptionSelectItem } from "#app/ui/abstact-option-select-ui-handler";
import { SaveSlotUiMode } from "#app/ui/save-slot-select-ui-handler";
import { Mode } from "#app/ui/ui";
import * as Utils from "#app/utils";
import i18next from "i18next";
import { CheckSwitchPhase } from "./check-switch-phase";
import { EncounterPhase } from "./encounter-phase";
import { SelectChallengePhase } from "./select-challenge-phase";
import { SelectStarterPhase } from "./select-starter-phase";
import { SummonPhase } from "./summon-phase";
import { globalScene } from "#app/global-scene";
import * as LoggerTools from "../logger";
import { Biome } from "#app/enums/biome";
import { GameDataType } from "#app/enums/game-data-type";
import { Species } from "#app/enums/species";
import { getPokemonNameWithAffix } from "#app/messages";
import { Nature } from "#app/enums/nature";
import { biomeLinks } from "#app/data/balance/biomes";
import { applyAbAttrs, SyncEncounterNatureAbAttr } from "#app/data/ability";
import { TrainerSlot } from "#app/data/trainer-config";
import { BattleSpec } from "#app/enums/battle-spec";
import { Moves } from "#app/enums/moves";
import { Type } from "#app/enums/type";
import { allSpecies } from "#app/data/pokemon-species";
import { PlayerPokemon, PokemonMove } from "#app/field/pokemon";
import overrides from "#app/overrides";
import Overrides from "#app/overrides";


export class TitlePhase extends Phase {
  private loaded: boolean;
  private lastSessionData: SessionSaveData;
  public gameMode: GameModes;

  constructor() {
    super();

    this.loaded = false;
  }

  confirmSlot = (message: string, slotFilter: (i: integer) => boolean, callback: (i: integer) => void) => {
    const p = this;
    globalScene.ui.revertMode();
    globalScene.ui.showText(message, null, () => {
      const config: OptionSelectConfig = {
        options: new Array(5).fill(null).map((_, i) => i).filter(slotFilter).map(i => {
          const data = LoggerTools.parseSlotData(i);
          return {
            //label: `${i18next.t("menuUiHandler:slot", {slotNumber: i+1})}`,
            label: (data ? `${i18next.t("menuUiHandler:slot", { slotNumber: i + 1 })}${data.description.substring(1)}` : `${i18next.t("menuUiHandler:slot", { slotNumber: i + 1 })}`),
            handler: () => {
              callback(i);
              globalScene.ui.revertMode();
              globalScene.ui.showText("", 0);
              return true;
            }
          };
        }).concat([{
          label: i18next.t("menuUiHandler:cancel"),
          handler: () => {
            p.callEnd();
            return true;
          }
        }]),
        //xOffset: 98
      };
      globalScene.ui.setOverlayMode(Mode.MENU_OPTION_SELECT, config);
    });
  };

  start(): void {
    super.start();

    globalScene.ui.clearText();
    globalScene.ui.fadeIn(250);

    globalScene.playBgm("title", true);

    globalScene.gameData.getSession(loggedInUser?.lastSessionSlot ?? -1).then(sessionData => {
      if (sessionData) {
        this.lastSessionData = sessionData;
        const biomeKey = getBiomeKey(sessionData.arena.biome);
        const bgTexture = `${biomeKey}_bg`;
        globalScene.arenaBg.setTexture(bgTexture);
      }
      this.showOptions();
    }).catch(err => {
      console.error(err);
      this.showOptions();
    });
  }

  getLastSave(log?: boolean, dailyOnly?: boolean, noDaily?: boolean): SessionSaveData | undefined {
    const saves: Array<Array<any>> = [];
    for (let i = 0; i < 5; i++) {
      const s = LoggerTools.parseSlotData(i);
      if (s != undefined) {
        if ((!noDaily && !dailyOnly) || (s.gameMode == GameModes.DAILY && dailyOnly) || (s.gameMode != GameModes.DAILY && noDaily)) {
          saves.push([ i, s, s.timestamp ]);
        }
      }
    }
    saves.sort((a, b): integer => {
      return b[2] - a[2];
    });
    if (log) {
      console.log(saves);
    }
    if (saves == undefined) {
      return undefined;
    }
    if (saves[0] == undefined) {
      return undefined;
    }
    return saves[0][1];
  }
  getLastSavesOfEach(log?: boolean): SessionSaveData[] | undefined {
    const saves: Array<Array<SessionSaveData | number>> = [];
    for (var i = 0; i < 5; i++) {
      const s = LoggerTools.parseSlotData(i);
      if (s != undefined) {
        saves.push([ i, s, s.timestamp ]);
      }
    }
    saves.sort((a, b): integer => {
      return (b[2] as number) - (a[2] as number);
    });
    if (log) {
      console.log(saves);
    }
    if (saves == undefined) {
      return undefined;
    }
    if (saves[0] == undefined) {
      return undefined;
    }
    const validSaves: Array<Array<SessionSaveData | number>> = [];
    let hasNormal = false;
    let hasDaily = false;
    for (var i = 0; i < saves.length; i++) {
      if ((saves[i][1] as SessionSaveData).gameMode == GameModes.DAILY && !hasDaily) {
        hasDaily = true;
        validSaves.push(saves[i]);
      }
      if ((saves[i][1] as SessionSaveData).gameMode != GameModes.DAILY && !hasNormal) {
        hasNormal = true;
        validSaves.push(saves[i]);
      }
    }
    console.log(saves, validSaves);
    if (validSaves.length == 0) {
      return undefined;
    }
    return validSaves.map(f => f[1] as SessionSaveData);
  }
  getSaves(log?: boolean, dailyOnly?: boolean): SessionSaveData[] | undefined {
    const saves: Array<Array<any>> = [];
    for (let i = 0; i < 5; i++) {
      const s = LoggerTools.parseSlotData(i);
      if (s != undefined) {
        if (!dailyOnly || s.gameMode == GameModes.DAILY) {
          saves.push([ i, s, s.timestamp ]);
        }
      }
    }
    saves.sort((a, b): integer => {
      return b[2] - a[2];
    });
    if (log) {
      console.log(saves);
    }
    if (saves == undefined) {
      return undefined;
    }
    return saves.map(f => f[1]);
  }
  getSavesUnsorted(log?: boolean, dailyOnly?: boolean): SessionSaveData[] | undefined {
    const saves: Array<Array<any>> = [];
    for (let i = 0; i < 5; i++) {
      const s = LoggerTools.parseSlotData(i);
      if (s != undefined) {
        if (!dailyOnly || s.gameMode == GameModes.DAILY) {
          saves.push([ i, s, s.timestamp ]);
        }
      }
    }
    if (log) {
      console.log(saves);
    }
    if (saves == undefined) {
      return undefined;
    }
    return saves.map(f => f[1]);
  }

  callEnd(): boolean {
    globalScene.clearPhaseQueue();
    globalScene.pushPhase(new TitlePhase());
    super.end();
    return true;
  }

  showLoggerOptions(txt: string, options: OptionSelectItem[]): boolean {
    globalScene.ui.showText("Export or clear game logs.", null, () => globalScene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
    return true;
  }

  logMenu(): boolean {
    const options: OptionSelectItem[] = [];
    LoggerTools.getLogs();
    for (let i = 0; i < LoggerTools.logs.length; i++) {
      if (localStorage.getItem(LoggerTools.logs[i][1]) != null) {
        options.push(LoggerTools.generateOption(i, this.getSaves()) as OptionSelectItem);
      } else {
        //options.push(LoggerTools.generateAddOption(i, globalScene, this))
      }
    }
    options.push({
      label: "Delete all",
      handler: () => {
        for (let i = 0; i < LoggerTools.logs.length; i++) {
          if (localStorage.getItem(LoggerTools.logs[i][1]) != null) {
            localStorage.removeItem(LoggerTools.logs[i][1]);
          }
        }
        globalScene.clearPhaseQueue();
        globalScene.pushPhase(new TitlePhase());
        super.end();
        return true;
      }
    }, {
      label: i18next.t("menu:cancel"),
      handler: () => {
        globalScene.clearPhaseQueue();
        globalScene.pushPhase(new TitlePhase());
        super.end();
        return true;
      }
    });
    globalScene.ui.showText("Export or clear game logs.", null, () => globalScene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
    return true;
  }
  logRenameMenu(): boolean {
    const options: OptionSelectItem[] = [];
    LoggerTools.getLogs();
    globalScene.newArena(Biome.FACTORY);
    for (let i = 0; i < LoggerTools.logs.length; i++) {
      if (localStorage.getItem(LoggerTools.logs[i][1]) != null) {
        options.push(LoggerTools.generateEditOption(i, this.getSaves(), this) as OptionSelectItem);
      } else {
        //options.push(LoggerTools.generateAddOption(i, globalScene, this))
      }
    }
    options.push({
      label: "Delete all",
      handler: () => {
        for (let i = 0; i < LoggerTools.logs.length; i++) {
          if (localStorage.getItem(LoggerTools.logs[i][1]) != null) {
            localStorage.removeItem(LoggerTools.logs[i][1]);
          }
        }
        globalScene.clearPhaseQueue();
        globalScene.pushPhase(new TitlePhase());
        super.end();
        return true;
      }
    }, {
      label: i18next.t("menu:cancel"),
      handler: () => {
        globalScene.clearPhaseQueue();
        globalScene.pushPhase(new TitlePhase());
        super.end();
        return true;
      }
    });
    globalScene.ui.showText("Export, rename, or delete logs.", null, () => globalScene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
    return true;
  }

  showOptions(): void {
    const options: OptionSelectItem[] = [];
    if (false) {
      if (loggedInUser && loggedInUser!.lastSessionSlot > -1) {
        options.push({
          label: i18next.t("continue", { ns: "menu" }),
          handler: () => {
            this.loadSaveSlot(this.lastSessionData ? -1 : loggedInUser!.lastSessionSlot);
            return true;
          }
        });
      }
    }
    // Replaces 'Continue' with all Daily Run saves, sorted by when they last saved
    // If there are no daily runs, it instead shows the most recently saved run
    // If this fails too, there are no saves, and the option does not appear
    const lastsaves = this.getSaves(false, true); // Gets all Daily Runs sorted by last play time
    const lastsave = this.getLastSave(); // Gets the last save you played
    const ls1 = this.getLastSave(false, true);
    const ls2 = this.getLastSavesOfEach();
    globalScene.quickloadDisplayMode = "Both";
    switch (true) {
      case (globalScene.quickloadDisplayMode == "Daily" && ls1 != undefined):
        options.push({
          label: (ls1.description ? ls1.description : "[???]"),
          handler: () => {
            this.loadSaveSlot(ls1!.slot);
            return true;
          }
        });
        break;
      case globalScene.quickloadDisplayMode == "Dailies" && lastsaves != undefined && ls1 != undefined:
        lastsaves.forEach(lastsave1 => {
          options.push({
            label: (lastsave1.description ? lastsave1.description : "[???]"),
            handler: () => {
              this.loadSaveSlot(lastsave1.slot);
              return true;
            }
          });
        });
        break;
      case lastsave != undefined && (globalScene.quickloadDisplayMode == "Latest" || ((globalScene.quickloadDisplayMode == "Daily" || globalScene.quickloadDisplayMode == "Dailies") && ls1 == undefined)):
        options.push({
          label: (lastsave.description ? lastsave.description : "[???]"),
          handler: () => {
            this.loadSaveSlot(lastsave!.slot);
            return true;
          }
        });
        break;
      case globalScene.quickloadDisplayMode == "Both" && ls2 != undefined:
        ls2.forEach(lastsave2 => {
          options.push({
            label: (lastsave2.description ? lastsave2.description : "[???]"),
            handler: () => {
              this.loadSaveSlot(lastsave2.slot);
              return true;
            }
          });
        });
        break;
      default: // If set to "Off" or all above conditions failed
        if (loggedInUser && loggedInUser.lastSessionSlot > -1) {
          options.push({
            label: i18next.t("continue", { ns: "menu" }),
            handler: () => {
              this.loadSaveSlot(this.lastSessionData ? -1 : loggedInUser!.lastSessionSlot);
              return true;
            }
          });
        }
        break;
    }
    options.push({
      label: i18next.t("menu:newGame"),
      handler: () => {
        const setModeAndEnd = (gameMode: GameModes) => {
          this.gameMode = gameMode;
          globalScene.ui.setMode(Mode.MESSAGE);
          globalScene.ui.clearText();
          this.end();
        };
        const { gameData } = globalScene;
        const options: OptionSelectItem[] = [];
        options.push({
          label: GameMode.getModeName(GameModes.CLASSIC),
          handler: () => {
            setModeAndEnd(GameModes.CLASSIC);
            return true;
          }
        });
        options.push({
          label: i18next.t("menu:dailyRun"),
          handler: () => {
            this.initDailyRun();
            return true;
          }
        });
        if (gameData.isUnlocked(Unlockables.ENDLESS_MODE)) {
          options.push({
            label: GameMode.getModeName(GameModes.CHALLENGE),
            handler: () => {
              setModeAndEnd(GameModes.CHALLENGE);
              return true;
            }
          });
          options.push({
            label: GameMode.getModeName(GameModes.ENDLESS),
            handler: () => {
              setModeAndEnd(GameModes.ENDLESS);
              return true;
            }
          });
          if (gameData.isUnlocked(Unlockables.SPLICED_ENDLESS_MODE)) {
            options.push({
              label: GameMode.getModeName(GameModes.SPLICED_ENDLESS),
              handler: () => {
                setModeAndEnd(GameModes.SPLICED_ENDLESS);
                return true;
              }
            });
          }
          options.push({
            label: i18next.t("menuUiHandler:importSession"),
            handler: () => {
              this.confirmSlot(i18next.t("menuUiHandler:importSlotSelect"), () => true, slotId => globalScene.gameData.importData(GameDataType.SESSION, slotId));
              return true;
            },
            keepOpen: true
          });
          options.push({
            label: i18next.t("menu:cancel"),
            handler: () => {
              globalScene.clearPhaseQueue();
              globalScene.pushPhase(new TitlePhase());
              super.end();
              return true;
            }
          });
          globalScene.ui.showText(i18next.t("menu:selectGameMode"), null, () => globalScene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
        } else {
          const options: OptionSelectItem[] = [
            {
              label: GameMode.getModeName(GameModes.CLASSIC),
              handler: () => {
                setModeAndEnd(GameModes.CLASSIC);
                return true;
              }
            }
          ];
          options.push({
            label: i18next.t("menuUiHandler:importSession"),
            handler: () => {
              this.confirmSlot(i18next.t("menuUiHandler:importSlotSelect"), () => true, slotId => globalScene.gameData.importData(GameDataType.SESSION, slotId));
              return true;
            },
            keepOpen: true
          });
          options.push({
            label: i18next.t("menu:cancel"),
            handler: () => {
              globalScene.clearPhaseQueue();
              globalScene.pushPhase(new TitlePhase());
              super.end();
              return true;
            }
          });
          globalScene.ui.showText(i18next.t("menu:selectGameMode"), null, () => globalScene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
        }
        return true;
      }
    }, {
      label: "Scouting",
      handler: () => {
        const charmOptions: OptionSelectItem[] = [];
        charmOptions.push({
          label: "0 charms",
          handler: () => {
            this.InitScouting(0);
            return true;
          }
        }, {
          label: "1 charm",
          handler: () => {
            this.InitScouting(1);
            return true;
          }
        }, {
          label: "2 charms",
          handler: () => {
            this.InitScouting(2);
            return true;
          }
        }, {
          label: "3 charms",
          handler: () => {
            this.InitScouting(3);
            return true;
          }
        }, {
          label: "4 charms",
          handler: () => {
            this.InitScouting(4);
            return true;
          }
        });
        globalScene.ui.showText("Encounter Scouting", null, () => globalScene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: charmOptions }));
        return true;
      }
    }, {
      label: "Shop Scouting",
      handler: () => {
        const shopOptions: OptionSelectItem[] = [];
        shopOptions.push({
          label: "Shop no evo",
          handler: () => {
            this.InitShopScouting(0);
            return true;
          }
        }, {
          label: "Shop lvl evo",
          handler: () => {
            this.InitShopScouting(1);
            return true;
          }
        }, {
          label: "Shop 1x item evo",
          handler: () => {
            this.InitShopScouting(2);
            return true;
          }
        }, {
          label: "Shop 2x item evo",
          handler: () => {
            this.InitShopScouting(3);
            return true;
          }
        });
        globalScene.ui.showText("Shop Scouting", null, () => globalScene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: shopOptions }));
        return true;
      }
    }, {
      label: "Manage Logs",
      handler: () => {
        //return this.logRenameMenu()
        globalScene.ui.setOverlayMode(Mode.LOG_HANDLER,
          (k: string) => {
            if (k === undefined) {
              return this.showOptions();
            }
            console.log(k);
            this.showOptions();
          }, () => {
            this.showOptions();
          });
        return true;
      }
    }, {
      label: "Manage Logs (Old Menu)",
      handler: () => {
        return this.logRenameMenu();
      }
    });
    options.push({
      label: i18next.t("menu:loadGame"),
      handler: () => {
        globalScene.ui.setOverlayMode(Mode.SAVE_SLOT, SaveSlotUiMode.LOAD,
          (slotId: number, autoSlot: integer) => {
            if (slotId === -1) {
              return this.showOptions();
            }
            this.loadSaveSlot(slotId, autoSlot);
          });
        return true;
      }
    },
    {
      label: i18next.t("menu:runHistory"),
      handler: () => {
        globalScene.ui.setOverlayMode(Mode.RUN_HISTORY);
        return true;
      },
      keepOpen: true
    },
    {
      label: i18next.t("menu:settings"),
      handler: () => {
        globalScene.ui.setOverlayMode(Mode.SETTINGS);
        return true;
      },
      keepOpen: true
    });
    const config: OptionSelectConfig = {
      options: options,
      noCancel: true,
      yOffset: 47
    };
    globalScene.ui.setMode(Mode.TITLE, config);
  }

  loadSaveSlot(slotId: number, autoSlot?: integer): void {
    globalScene.sessionSlotId = slotId > -1 || !loggedInUser ? slotId : loggedInUser.lastSessionSlot;
    globalScene.ui.setMode(Mode.MESSAGE);
    globalScene.ui.resetModeChain();
    globalScene.gameData.loadSession(slotId, slotId === -1 ? this.lastSessionData : undefined, autoSlot).then((success: boolean) => {
      if (success) {
        this.loaded = true;
        globalScene.ui.showText(i18next.t("menu:sessionSuccess"), null, () => this.end());
      } else {
        this.end();
      }
    }).catch(err => {
      console.error(err);
      globalScene.ui.showText(i18next.t("menu:failedToLoadSession"), null);
    });
  }

  initDailyRun(): void {
    globalScene.ui.clearText();
    globalScene.ui.setMode(Mode.SAVE_SLOT, SaveSlotUiMode.SAVE, (slotId: number) => {
      globalScene.clearPhaseQueue();
      if (slotId === -1) {
        globalScene.pushPhase(new TitlePhase());
        return super.end();
      }
      globalScene.sessionSlotId = slotId;

      const generateDaily = (seed: string) => {
        globalScene.gameMode = getGameMode(GameModes.DAILY);

        globalScene.setSeed(seed);
        globalScene.resetSeed(0);

        globalScene.money = globalScene.gameMode.getStartingMoney();

        const starters = getDailyRunStarters(seed);
        const startingLevel = globalScene.gameMode.getStartingLevel();

        const party = globalScene.getPlayerParty();
        const loadPokemonAssets: Promise<void>[] = [];
        for (const starter of starters) {
          const starterProps = globalScene.gameData.getSpeciesDexAttrProps(starter.species, starter.dexAttr);
          const starterFormIndex = Math.min(starterProps.formIndex, Math.max(starter.species.forms.length - 1, 0));
          const starterGender = starter.species.malePercent !== null
            ? !starterProps.female ? Gender.MALE : Gender.FEMALE
            : Gender.GENDERLESS;
          const starterPokemon = globalScene.addPlayerPokemon(starter.species, startingLevel, starter.abilityIndex, starterFormIndex, starterGender, starterProps.shiny, starterProps.variant, undefined, starter.nature);
          starterPokemon.setVisible(false);
          party.push(starterPokemon);
          loadPokemonAssets.push(starterPokemon.loadAssets());
        }

        regenerateModifierPoolThresholds(party, ModifierPoolType.DAILY_STARTER);
        const modifiers: Modifier[] = Array(3).fill(null).map(() => modifierTypes.EXP_SHARE().withIdFromFunc(modifierTypes.EXP_SHARE).newModifier())
          .concat(Array(3).fill(null).map(() => modifierTypes.GOLDEN_EXP_CHARM().withIdFromFunc(modifierTypes.GOLDEN_EXP_CHARM).newModifier()))
          .concat([ modifierTypes.MAP().withIdFromFunc(modifierTypes.MAP).newModifier() ])
          .concat(getDailyRunStarterModifiers(party))
          .filter((m) => m !== null);

        for (const m of modifiers) {
          globalScene.addModifier(m, true, false, false, true);
        }
        globalScene.updateModifiers(true, true);

        Promise.all(loadPokemonAssets).then(() => {
          globalScene.time.delayedCall(500, () => globalScene.playBgm());
          globalScene.gameData.gameStats.dailyRunSessionsPlayed++;
          globalScene.newArena(globalScene.gameMode.getStartingBiome());
          globalScene.newBattle();
          globalScene.arena.init();
          globalScene.sessionPlayTime = 0;
          globalScene.lastSavePlayTime = 0;
          this.end();
        });
      };

      // If Online, calls seed fetch from db to generate daily run. If Offline, generates a daily run based on current date.
      if (!Utils.isLocal || Utils.isLocalServerConnected) {
        fetchDailyRunSeed().then(seed => {
          if (seed) {
            generateDaily(seed);
          } else {
            throw new Error("Daily run seed is null!");
          }
        }).catch(err => {
          console.error("Failed to load daily run:\n", err);
        });
      } else {
        let seed: string = btoa(new Date().toISOString().substring(0, 10));
        if (!Utils.isNullOrUndefined(Overrides.DAILY_RUN_SEED_OVERRIDE)) {
          seed = Overrides.DAILY_RUN_SEED_OVERRIDE;
        }
        generateDaily(seed);
      }
    });
  }
  setupDaily(): void {
    // TODO
    const saves = this.getSaves();
    const saveNames = new Array(5).fill("");
    for (let i = 0; i < saves!.length; i++) {
      saveNames[saves![i][0]] = saves![i][1].description;
    }
    const ui = globalScene.ui;
    const confirmSlot = (message: string, slotFilter: (i: integer) => boolean, callback: (i: integer) => void) => {
      ui.revertMode();
      ui.showText(message, null, () => {
        const config: OptionSelectConfig = {
          options: new Array(5).fill(null).map((_, i) => i).filter(slotFilter).map(i => {
            return {
              label: (i + 1) + " " + saveNames[i],
              handler: () => {
                callback(i);
                ui.revertMode();
                ui.showText("", 0);
                return true;
              }
            };
          }).concat([{
            label: i18next.t("menuUiHandler:cancel"),
            handler: () => {
              ui.revertMode();
              ui.showText("", 0);
              return true;
            }
          }]),
          xOffset: 98
        };
        ui.setOverlayMode(Mode.MENU_OPTION_SELECT, config);
      });
    };
    ui.showText("This feature is incomplete.", null, () => {
      globalScene.clearPhaseQueue();
      globalScene.pushPhase(new TitlePhase());
      super.end();
      return true;
    });
    return;
    confirmSlot("Select a slot to replace.", () => true, slotId => globalScene.gameData.importData(GameDataType.SESSION, slotId));
  }
  end(): void {
    if (!this.loaded && !globalScene.gameMode.isDaily) {
      globalScene.arena.preloadBgm();
      globalScene.gameMode = getGameMode(this.gameMode);
      if (this.gameMode === GameModes.CHALLENGE) {
        globalScene.pushPhase(new SelectChallengePhase());
      } else {
        globalScene.pushPhase(new SelectStarterPhase());
      }
      globalScene.newArena(globalScene.gameMode.getStartingBiome());
    } else {
      globalScene.playBgm();
    }

    globalScene.pushPhase(new EncounterPhase(this.loaded));

    if (this.loaded) {
      const availablePartyMembers = globalScene.getPokemonAllowedInBattle().length;

      globalScene.pushPhase(new SummonPhase(0, true, true));
      if (globalScene.currentBattle.double && availablePartyMembers > 1) {
        globalScene.pushPhase(new SummonPhase(1, true, true));
      }

      if (globalScene.currentBattle.battleType !== BattleType.TRAINER && (globalScene.currentBattle.waveIndex > 1 || !globalScene.gameMode.isDaily)) {
        const minPartySize = globalScene.currentBattle.double ? 2 : 1;
        if (availablePartyMembers > minPartySize) {
          globalScene.pushPhase(new CheckSwitchPhase(0, globalScene.currentBattle.double));
          if (globalScene.currentBattle.double) {
            globalScene.pushPhase(new CheckSwitchPhase(1, globalScene.currentBattle.double));
          }
        }
      }
    }

    for (const achv of Object.keys(globalScene.gameData.achvUnlocks)) {
      if (vouchers.hasOwnProperty(achv) && achv !== "CLASSIC_VICTORY") {
        globalScene.validateVoucher(vouchers[achv]);
      }
    }

    super.end();
  }

  InitShopScouting(method) {
    globalScene.sessionSlotId = 0;
    globalScene.gameData.loadSession(globalScene.sessionSlotId, undefined, undefined).then((success: boolean) => {
      this.ShopScouting(method);
    }).catch(err => {
      console.error(err);
      globalScene.ui.showText(`something went wrong, see console error`, null);
    });
  }

  private iterations: string[] = [];
  private charmList: string[] = [];
  ShopScouting(method) {
    // Remove any lures or charms
    globalScene.RemoveModifiers();
    console.log(`Starting shop scouting ${new Date().toLocaleString()}`);

    var party = globalScene.getPlayerParty();

    var comps = [
      [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.MEW],
      [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.BULBASAUR],
      [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.JIGGLYPUFF],
      [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.POLIWHIRL],
      // [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.SWELLOW, Species.MEW],
      // [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.SWELLOW, Species.BULBASAUR],
      // [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.SWELLOW, Species.JIGGLYPUFF],
      // [Species.MEW, Species.MEW, Species.MEW, Species.MEW, Species.SWELLOW, Species.POLIWHIRL],
    ]

    var ethers = [
      (pokemon) => true,
      (pokemon) => {
        this.SetFullPP(pokemon);
        pokemon.moveset[0]?.usePp(pokemon.moveset[0].getMovePp())
      },
      (pokemon) =>  {
        this.SetFullPP(pokemon);
        pokemon.moveset[1]?.usePp(pokemon.moveset[1].getMovePp())
      },
      (pokemon) =>  {
        this.SetFullPP(pokemon);
        pokemon.moveset[2]?.usePp(pokemon.moveset[2].getMovePp())
      },
    ]

    var lures = [
      () => {
        globalScene.RemoveLures();
        return "";
      },
      () => {
        globalScene.RemoveLures();
        globalScene.InsertLure();
        return "Lure";
      },
      () => {
        globalScene.RemoveLures();
        globalScene.InsertSuperLure();
        return "Super Lure";
      },
      () => {
        globalScene.RemoveLures();
        globalScene.InsertMaxLure();
        return "Max Lure";
      },
      () => {
        globalScene.RemoveLures();
        globalScene.InsertLure();
        globalScene.InsertSuperLure();
        return "Lure + Super Lure";
      },
      () => {
        globalScene.RemoveLures();
        globalScene.InsertSuperLure();
        globalScene.InsertMaxLure();
        return "Super Lure + Max Lure";
      },
      () => {
        globalScene.RemoveLures();
        globalScene.InsertThreeLures();
        return "All Lures";
      },
    ]

    var comp = comps[method];
    var mushroom = [
      (mu: {start: integer, end: integer, level: integer}) => {
        this.ClearParty(party);
        mu.level = 39;
        this.FillParty(party, comp, mu.level);
        mu.start = 1;
        mu.end  = 20;
      },
      (mu: {start: integer, end: integer, level: integer}) => {
        this.ClearParty(party);
        mu.level = 59;
        this.FillParty(party, comp, mu.level);
        mu.start = 15;
        mu.end  = 40;
      },
      (mu: {start: integer, end: integer, level: integer}) => {
        this.ClearParty(party);
        mu.level = 79;
        this.FillParty(party, comp, mu.level);
        mu.start = 35;
        mu.end  = 49;
      },
    ]

    var globals = [
      () => {
        return "";
      },
      // () => {
      //   globalScene.InsertMegaBracelet();
      //   return "Mega";
      // },
      // () => {
      //   globalScene.InsertDynamaxBand();
      //   return "Band";
      // },
      // () => {
      //   globalScene.InsertLockCapsule();
      //   return "Lock";
      // },
      // () => {
      //   globalScene.InsertMegaBracelet();
      //   globalScene.InsertDynamaxBand();
      //   return "Mega + Band";
      // },
      // () => {
      //   globalScene.InsertMegaBracelet();
      //   globalScene.InsertLockCapsule();
      //   return "Mega + Lock";
      // },
      // () => {
      //   globalScene.InsertDynamaxBand();
      //   globalScene.InsertLockCapsule();
      //   return "Band + Lock";
      // },
      // () => {
      //   globalScene.InsertMegaBracelet();
      //   globalScene.InsertDynamaxBand();
      //   globalScene.InsertLockCapsule();
      //   return "Mega + Band + Lock";
      // },
      // () => {
      //   globalScene.InsertTeraOrb();
      //   return "Tera";
      // },
    ]

    this.iterations = [];

    // this.ClearParty(party);
    // overrides.MOVESET_OVERRIDE = [Moves.TACKLE, Moves.SPLASH, Moves.SPLASH, Moves.SPLASH];
    // this.FillParty(party, comps[0], 39);
    // party[0].hp = 0;
    // this.GenerateShop(party, "test", 9, 10);
    // party[0].hp = party[0].getMaxHp();
    // this.GenerateShop(party, "test", 9, 10);
    // return

    globals.forEach(g => {
      globalScene.RemoveModifiers();

      // globalScene.InsertDynamaxBand();
      // globalScene.InsertIVScanner();

      var rogueItem = g()
      mushroom.forEach(m => {
        var mu = {
          start: 0,
          end: 0,
          level: 0
        }
        m(mu);

        var partynames = party.map(p => p.name);
        console.log(rogueItem, mu.level, partynames, party);

        var e = 0;
        ethers.forEach(ether => {
          ether(party[0])

          lures.forEach(lure => {
            var text = lure();
            this.IteratePotions(party, 0, 0, 0, 0, 0, 0, e, text, mu.start, mu.end, mu.level, rogueItem);
          });

          e++;
        });
      });
    });

    console.log(this.charmList);
    globalScene.ui.showText("DONE! Copy the list from the console and refresh the page.", null);
  }

  ClearParty(party: PlayerPokemon[]) {
    do {
      globalScene.removePokemonFromPlayerParty(party[0], true);
    }
    while (party.length > 0);
  }

  FillParty(party: PlayerPokemon[], comp: Species[], level: integer) {
    comp.forEach((s: Species) => {
      this.AddPokemon(party, s, level);
    });
  }

  AddPokemon(party: PlayerPokemon[], species: Species, level: integer) {
    var pokemon = allSpecies.filter(sp => sp.speciesId == species)[0];
    var playerPokemon = globalScene.addPlayerPokemon(pokemon, level);
    playerPokemon.moveset = [new PokemonMove(Moves.TACKLE), new PokemonMove(Moves.SPLASH), new PokemonMove(Moves.SPLASH), new PokemonMove(Moves.SPLASH)]
    party.push(playerPokemon);
  }

  SetFullPP(pokemon: PlayerPokemon) {
    pokemon.getMoveset().forEach(ms => {
      ms?.setFullPp();
    })
  }

  // Done:
  //  Potion
  //  Super Potion
  //  Hyper Potion
  //  Max Potion
  //  Ether
  //  Max Ether
  //  Elixir
  //  Max Elixir
  //  Lure
  //  Super Lure
  //  Max Lure
  //  Memory Mushroom
  //  Revive
  //  Max Revive
  //  Lock Capsule
  //  Dynamax Band
  //  Mega Bracelet
  //
  // Planned:
  //  Full Heal
  //  Full Restore
  //  Sacred Ash
  //  Form Change Items
  //  Species Items
  //  Leek
  //  Toxic Orb
  //  Flame Orb
  //  Tera Orb
  CreateLog(pot = 0, suppot = 0, hyppot = 0, maxpot = 0, revive = 0, eth = 0, lure = "", level = 79, rogueItem = "") {
    var items: string[] = [];
    if (pot - suppot > 0) items.push(`${pot - suppot}x <87.5% HP and 10+ dmg taken`);
    if (suppot - hyppot > 0) items.push(`${suppot - hyppot}x <75% HP and 25+ dmg taken`);
    if (hyppot - maxpot > 0) items.push(`${hyppot - maxpot}x 50%-62.5% and 100+ dmg taken`);
    if (maxpot - revive > 0) items.push(`${maxpot - revive}x <50% and 100+ dmg taken`);
    if (revive > 0) items.push(`${revive}x fainted`);
    if (eth > 0) items.push(`${eth}x low PP`);
    if (lure != "") items.push(`${lure}`);
    if (rogueItem != "") items.push(`${rogueItem}`);

    if (items.length == 0) {
      items.push("nothing");
    }

    items.push(`Highest lvl: ${level - 19}-${level}`);

    return items.join(" + ");
  }

  IteratePotions(party: PlayerPokemon[], n = 0, pot = 0, suppot = 0, hyppot = 0, maxpot = 0, revive = 0, eth = 0, lure = "", start = 1, end = 50, level = 79, rogueItem = "") {
    if (n == Math.min(3, party.length)) {
      var i = `${pot} ${suppot} ${hyppot} ${maxpot} ${revive} ${eth} ${lure} ${level} ${rogueItem}`;
      if (this.iterations.some(it => it == i)) return;

      this.iterations.push(i)
      var comptext = this.CreateLog(pot, suppot, hyppot, maxpot, revive, eth, lure, level, rogueItem);
      this.GenerateShop(party, comptext, start, end);
      return;
    }

    var pokemon = party[n];
    var mhp = pokemon.getMaxHp();

    // Nothing
    this.IteratePotions(party, n + 1, pot, suppot, hyppot, maxpot, revive, eth, lure, start, end, level, rogueItem);

    // potion
    var damage = Math.min(Math.max(Math.floor(mhp * 0.18), 10));
    if (damage < mhp) {
      pokemon.hp = mhp - damage;
      this.IteratePotions(party, n + 1, pot + 1, suppot, hyppot, maxpot, revive, eth, lure, start, end, level, rogueItem);
    }

    // super potion
    var damage = Math.min(Math.max(Math.floor(mhp * 0.31), 25));
    if (damage < mhp) {
      pokemon.hp = mhp - damage;
      this.IteratePotions(party, n + 1, pot + 1, suppot + 1, hyppot, maxpot, revive, eth, lure, start, end, level, rogueItem);
    }

    // hyper potion
    var damage = Math.min(Math.max(Math.floor(mhp * 0.45), 100));
    if (damage < mhp && (mhp - damage) / mhp > 0.5) {
      pokemon.hp = mhp - damage;
      this.IteratePotions(party, n + 1, pot + 1, suppot + 1, hyppot + 1, maxpot, revive, eth, lure, start, end, level, rogueItem);
    }

    // max potion
    var damage = Math.min(Math.max(Math.floor(mhp * 0.51), 100));
    if (damage < mhp) {
      pokemon.hp = mhp - damage;
      this.IteratePotions(party, n + 1, pot + 1, suppot + 1, hyppot + 1, maxpot + 1, revive, eth, lure, start, end, level, rogueItem);
    }

    // Revive
    pokemon.hp = 0;
    this.IteratePotions(party, n + 1, pot + 1, suppot + 1, hyppot + 1, maxpot + 1, revive + 1, eth, lure, start, end, level, rogueItem);

    // reset pokemon
    pokemon.hp = pokemon.getMaxHp();
  }

  GenerateShop(party: PlayerPokemon[], comptext: string, start: integer, end: integer) {
    for (var w = start; w < end; w++) {
      if (w % 10 == 0) continue;

      globalScene.executeWithSeedOffset(() => {
        globalScene.currentBattle.waveIndex = w;
        for (var i = 0; i < 4; i++) {
          regenerateModifierPoolThresholds(party, ModifierPoolType.PLAYER, i);
          const typeOptions: ModifierTypeOption[] = getPlayerModifierTypeOptions(Math.min(6, Math.max(3, 3 + Math.floor((w / 10) - 1))), party);
          if (typeOptions.some(t => t.type.id == "ABILITY_CHARM")) {
            console.log(w, i, comptext);
            this.charmList.push(`${w} ${i} ${comptext}`);
          }
        }
      }, w);
    }
  }

  InitScouting(charms: number) {
    globalScene.sessionSlotId = 0;
    globalScene.gameData.loadSession(globalScene.sessionSlotId, undefined, undefined).then((success: boolean) => {
      this.ScoutingWithoutUI(charms);
    }).catch(err => {
      console.error(err);
      globalScene.ui.showText(`something went wrong, see console error`, null);
    });
  }

	private encounterList: string[] = [];
  ScoutingWithoutUI(charms: number) {
    var startingBiome = globalScene.arena.biomeType;

    var starters: string[] = []
    var party = globalScene.getPlayerParty();
    party.forEach(p => {
      starters.push(`Pokemon: ${getPokemonNameWithAffix(p)} ` +
        `Form: ${p.getSpeciesForm().getSpriteAtlasPath(false, p.formIndex)} Species ID: ${p.species.speciesId} Stats: ${p.stats} IVs: ${p.ivs} Ability: ${p.getAbility().name} ` +
        `Passive Ability: ${p.getPassiveAbility().name} Nature: ${Nature[p.nature]} Gender: ${Gender[p.gender]} Rarity: undefined AbilityIndex: ${p.abilityIndex} `+
        `ID: ${p.id} Type: ${p.getTypes().map(t => Type[t]).join(",")} Moves: ${p.getMoveset().map(m => Moves[m?.moveId ?? 0]).join(",")}`);
    });

    this.ClearParty(party);
    this.FillParty(party, [Species.VENUSAUR], 20);

    var output: string[][] = [];
    output.push([`startstarters`]);
    output.push(starters);
    output.push([`endstarters`]);
    localStorage.setItem("scouting", JSON.stringify(output));

    // Remove any lures or charms
    globalScene.RemoveModifiers();

    // Add 0 to 4 charms
    if (charms > 0) globalScene.InsertAbilityCharm(charms);

    // Keep track of encounters, Generate Biomes and encounters
    console.log(`Starting 0 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    this.GenerateBiomes(startingBiome, 0);
    this.StoreEncounters(`0${charms}`);

    console.log(`Starting 1 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    globalScene.InsertLure();
    this.GenerateBiomes(startingBiome, 0);
    this.StoreEncounters(`1${charms}`);

    console.log(`Starting 2 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    globalScene.InsertSuperLure();
    this.GenerateBiomes(startingBiome, 0);
    this.StoreEncounters(`2${charms}`);

    // Only generate wave 10 for 3 lures.
    console.log(`Starting 3 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    globalScene.InsertMaxLure();
    globalScene.newArena(startingBiome);
    globalScene.currentBattle.waveIndex = 9;
    globalScene.arena.updatePoolsForTimeOfDay();
    this.GenerateBattle();
    this.StoreEncounters(`3${charms}`);

    var output = JSON.parse(localStorage.getItem("scouting")!) as string[][];
    console.log("All scouting data:", output);
    output = [];
    globalScene.ui.showText("DONE! Copy the data from the console and then you can refresh this page.", null);
  }

  StoreEncounters(lurecharm: string) {
    var output = JSON.parse(localStorage.getItem("scouting")!) as string[][];
    output.push([`start${lurecharm}`]);
    output.push(this.encounterList);
    output.push([`end${lurecharm}`]);
    localStorage.setItem("scouting", JSON.stringify(output));
    output = [];
  }

  GenerateBattle(nolog: boolean = false) {
    console.log(`%%%%%  Wave: ${globalScene.currentBattle.waveIndex + 1}  %%%%%`)
    var battle = globalScene.newBattle() as Battle;
    while (LoggerTools.rarities.length > 0) {
      LoggerTools.rarities.pop();
    }
    LoggerTools.rarityslot[0] = 0;

    if (!nolog && battle?.trainer != null) {
      this.encounterList.push(`Wave: ${globalScene.currentBattle.waveIndex} Biome: ${Biome[globalScene.arena.biomeType]} Trainer: ${battle.trainer.config.name}`);
    }

    battle.enemyLevels?.forEach((level, e) => {
      if (battle.battleType === BattleType.TRAINER) {
        battle.enemyParty[e] = battle.trainer?.genPartyMember(e)!;
      } else {
        LoggerTools.rarityslot[0] = e;
        let enemySpecies = globalScene.randomSpecies(battle.waveIndex, level, true);
        battle.enemyParty[e] = globalScene.addEnemyPokemon(enemySpecies, level, TrainerSlot.NONE, !!globalScene.getEncounterBossSegments(battle.waveIndex, level, enemySpecies));
        if (globalScene.currentBattle.battleSpec === BattleSpec.FINAL_BOSS) {
          battle.enemyParty[e].ivs = new Array(6).fill(31);
        }
        globalScene.getPlayerParty().slice(0, !battle.double ? 1 : 2).reverse().forEach(playerPokemon => {
          applyAbAttrs(SyncEncounterNatureAbAttr, playerPokemon, null, false, battle.enemyParty[e]);
        });
      }

      if (!nolog) {
        var enemy = battle.enemyParty[e]
        var atlaspath = enemy.getSpeciesForm().getSpriteAtlasPath(false, enemy.formIndex);
        // Regional pokemon have the same name, instead get their atlas path.
        if (enemy.species.speciesId > 1025) {
          // Using nicknames here because i want the getPokemonNameWithAffix so i have Wild/Foe information
          // Nicknames are stored in base 64? so convert btoa here
          enemy.nickname = btoa(Species[atlaspath])
        }

        // Always pyroar...
        if (atlaspath == "668") {
          atlaspath += `-${Gender[enemy.gender].toLowerCase()}`
        }

        // Store encounters in a list, basically CSV (uses regex in sheets), but readable as well
        var text = `Wave: ${globalScene.currentBattle.waveIndex} Biome: ${Biome[globalScene.arena.biomeType]} Pokemon: ${getPokemonNameWithAffix(enemy)} ` +
        `Form: ${atlaspath} Species ID: ${enemy.species.speciesId} Stats: ${enemy.stats} IVs: ${enemy.ivs} Ability: ${enemy.getAbility().name} ` +
        `Passive Ability: ${enemy.getPassiveAbility().name} Nature: ${Nature[enemy.nature]} Gender: ${Gender[enemy.gender]} Rarity: ${LoggerTools.rarities[e]} AbilityIndex: ${enemy.abilityIndex} `+
        `ID: ${enemy.id} Type: ${enemy.getTypes().map(t => Type[t]).join(",")} Moves: ${enemy.getMoveset().map(m => Moves[m?.moveId ?? 0]).join(",")}`;
        this.encounterList.push(text);
        console.log(text);
        if (battle.waveIndex == 50) {
          // separate print so its easier to find for discord pin
          console.log(enemy.getMoveset().map(m => Moves[m?.moveId ?? 0]))
        }
      }
    })
  }

  GenerateBiomes(biome: Biome, waveIndex: integer) {
    globalScene.newArena(biome);
    globalScene.currentBattle.waveIndex = waveIndex;
    globalScene.arena.updatePoolsForTimeOfDay()

    // Finish biome
    for (var i = 1; i <= 10; i++) {
        this.GenerateBattle()
    }

    // Victory
    if (globalScene.currentBattle.waveIndex >= 50) {
      return;
    }

    // Get next biomes by offsetting the seed to the x1 wave and then rolling for the biome selections.
    var biomeChoices: Biome[] = [];
    globalScene.executeWithSeedOffset(() => {
      biomeChoices = (!Array.isArray(biomeLinks[biome])
      ? [ biomeLinks[biome] as Biome ]
      : biomeLinks[biome] as (Biome | [Biome, integer])[])
      .filter((b, i) => !Array.isArray(b) || !Utils.randSeedInt(b[1], undefined, "Choosing next biome for map"))
      .map(b => Array.isArray(b) ? b[0] : b);
    }, waveIndex + 11);
    console.log(biomeChoices);

    // Recursively generate next biomes
    for (var b of biomeChoices) {
      // If waveindex is not the same anymore, that means a different path ended and we continue with a new branch
      if (globalScene.currentBattle.waveIndex != waveIndex) {
        // Back to x9 wave to generate the x0 wave again, that sets the correct rng
        globalScene.newArena(biome);
        globalScene.currentBattle.waveIndex = waveIndex + 9;
        this.GenerateBattle(true);
      }

      this.GenerateBiomes(b, waveIndex + 10);
    }
  }
}
