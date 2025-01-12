import { loggedInUser } from "#app/account";
import Battle, { BattleType } from "#app/battle";
import BattleScene from "#app/battle-scene";
import { fetchDailyRunSeed, getDailyRunStarters } from "#app/data/daily-run";
import { Gender } from "#app/data/gender";
import { getBiomeKey } from "#app/field/arena";
import { GameMode, GameModes, getGameMode } from "#app/game-mode";
import { HiddenAbilityRateBoosterModifier, Modifier } from "#app/modifier/modifier";
import { getDailyRunStarterModifiers, getModifierPoolForType, getPlayerModifierTypeOptions, ModifierPoolType, ModifierType, ModifierTypeOption, modifierTypes, regenerateModifierPoolThresholds } from "#app/modifier/modifier-type";
import { Phase } from "#app/phase";
import { SessionSaveData } from "#app/system/game-data";
import { Unlockables } from "#app/system/unlockables";
import { vouchers } from "#app/system/voucher";
import { OptionSelectConfig, OptionSelectItem } from "#app/ui/abstact-option-select-ui-handler";
import { SaveSlotUiMode } from "#app/ui/save-slot-select-ui-handler";
import { Mode } from "#app/ui/ui";
import * as Utils from "#app/utils";
import i18next from "i18next";
import { CheckSwitchPhase } from "./check-switch-phase";
import { EncounterPhase } from "./encounter-phase";
import { SelectChallengePhase } from "./select-challenge-phase";
import { SelectStarterPhase } from "./select-starter-phase";
import { SummonPhase } from "./summon-phase";
import * as LoggerTools from "../logger";
import { Biome } from "#app/enums/biome.js";
import { GameDataType } from "#app/enums/game-data-type.js";
import { Species } from "#app/enums/species.js";
import { getPokemonNameWithAffix } from "#app/messages.js";
import { Nature } from "#app/enums/nature.js";
import { biomeLinks } from "#app/data/balance/biomes.js";
import { applyAbAttrs, SyncEncounterNatureAbAttr } from "#app/data/ability.js";
import { TrainerSlot } from "#app/data/trainer-config.js";
import { BattleSpec } from "#app/enums/battle-spec.js";
import { Moves } from "#app/enums/moves.js";
import { ModifierTier } from "#app/modifier/modifier-tier.js";
import { Type } from "#app/enums/type.js";
import { allSpecies } from "#app/data/pokemon-species.js";
import { PlayerPokemon } from "#app/field/pokemon.js";
import { BattlerTagLapseType } from "#app/data/battler-tags.js";


export class TitlePhase extends Phase {
  private loaded: boolean;
  private lastSessionData: SessionSaveData;
  public gameMode: GameModes;

  constructor(scene: BattleScene) {
    super(scene);

    this.loaded = false;
  }

  confirmSlot = (message: string, slotFilter: (i: integer) => boolean, callback: (i: integer) => void) => {
    const p = this;
    this.scene.ui.revertMode();
    this.scene.ui.showText(message, null, () => {
      const config: OptionSelectConfig = {
        options: new Array(5).fill(null).map((_, i) => i).filter(slotFilter).map(i => {
          const data = LoggerTools.parseSlotData(i);
          return {
            //label: `${i18next.t("menuUiHandler:slot", {slotNumber: i+1})}`,
            label: (data ? `${i18next.t("menuUiHandler:slot", { slotNumber: i + 1 })}${data.description.substring(1)}` : `${i18next.t("menuUiHandler:slot", { slotNumber: i + 1 })}`),
            handler: () => {
              callback(i);
              this.scene.ui.revertMode();
              this.scene.ui.showText("", 0);
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
      this.scene.ui.setOverlayMode(Mode.MENU_OPTION_SELECT, config);
    });
  };

  start(): void {
    super.start();

    this.scene.ui.clearText();
    this.scene.ui.fadeIn(250);

    this.scene.playBgm("title", true);

    this.scene.gameData.getSession(loggedInUser?.lastSessionSlot ?? -1).then(sessionData => {
      if (sessionData) {
        this.lastSessionData = sessionData;
        const biomeKey = getBiomeKey(sessionData.arena.biome);
        const bgTexture = `${biomeKey}_bg`;
        this.scene.arenaBg.setTexture(bgTexture);
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
    this.scene.clearPhaseQueue();
    this.scene.pushPhase(new TitlePhase(this.scene));
    super.end();
    return true;
  }

  showLoggerOptions(txt: string, options: OptionSelectItem[]): boolean {
    this.scene.ui.showText("Export or clear game logs.", null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
    return true;
  }

  logMenu(): boolean {
    const options: OptionSelectItem[] = [];
    LoggerTools.getLogs();
    for (let i = 0; i < LoggerTools.logs.length; i++) {
      if (localStorage.getItem(LoggerTools.logs[i][1]) != null) {
        options.push(LoggerTools.generateOption(i, this.getSaves()) as OptionSelectItem);
      } else {
        //options.push(LoggerTools.generateAddOption(i, this.scene, this))
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
        this.scene.clearPhaseQueue();
        this.scene.pushPhase(new TitlePhase(this.scene));
        super.end();
        return true;
      }
    }, {
      label: i18next.t("menu:cancel"),
      handler: () => {
        this.scene.clearPhaseQueue();
        this.scene.pushPhase(new TitlePhase(this.scene));
        super.end();
        return true;
      }
    });
    this.scene.ui.showText("Export or clear game logs.", null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
    return true;
  }
  logRenameMenu(): boolean {
    const options: OptionSelectItem[] = [];
    LoggerTools.getLogs();
    this.setBiomeByType(Biome.FACTORY);
    for (let i = 0; i < LoggerTools.logs.length; i++) {
      if (localStorage.getItem(LoggerTools.logs[i][1]) != null) {
        options.push(LoggerTools.generateEditOption(this.scene, i, this.getSaves(), this) as OptionSelectItem);
      } else {
        //options.push(LoggerTools.generateAddOption(i, this.scene, this))
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
        this.scene.clearPhaseQueue();
        this.scene.pushPhase(new TitlePhase(this.scene));
        super.end();
        return true;
      }
    }, {
      label: i18next.t("menu:cancel"),
      handler: () => {
        this.scene.clearPhaseQueue();
        this.scene.pushPhase(new TitlePhase(this.scene));
        super.end();
        return true;
      }
    });
    this.scene.ui.showText("Export, rename, or delete logs.", null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
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
    this.scene.quickloadDisplayMode = "Both";
    switch (true) {
      case (this.scene.quickloadDisplayMode == "Daily" && ls1 != undefined):
        options.push({
          label: (ls1.description ? ls1.description : "[???]"),
          handler: () => {
            this.loadSaveSlot(ls1!.slot);
            return true;
          }
        });
        break;
      case this.scene.quickloadDisplayMode == "Dailies" && lastsaves != undefined && ls1 != undefined:
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
      case lastsave != undefined && (this.scene.quickloadDisplayMode == "Latest" || ((this.scene.quickloadDisplayMode == "Daily" || this.scene.quickloadDisplayMode == "Dailies") && ls1 == undefined)):
        options.push({
          label: (lastsave.description ? lastsave.description : "[???]"),
          handler: () => {
            this.loadSaveSlot(lastsave!.slot);
            return true;
          }
        });
        break;
      case this.scene.quickloadDisplayMode == "Both" && ls2 != undefined:
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
          this.scene.ui.setMode(Mode.MESSAGE);
          this.scene.ui.clearText();
          this.end();
        };
        const { gameData } = this.scene;
        if (gameData.isUnlocked(Unlockables.ENDLESS_MODE)) {
          const options: OptionSelectItem[] = [
            {
              label: GameMode.getModeName(GameModes.CLASSIC),
              handler: () => {
                setModeAndEnd(GameModes.CLASSIC);
                return true;
              }
            },
            {
              label: GameMode.getModeName(GameModes.CHALLENGE),
              handler: () => {
                setModeAndEnd(GameModes.CHALLENGE);
                return true;
              }
            },
            {
              label: GameMode.getModeName(GameModes.ENDLESS),
              handler: () => {
                setModeAndEnd(GameModes.ENDLESS);
                return true;
              }
            }
          ];
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
              this.confirmSlot(i18next.t("menuUiHandler:importSlotSelect"), () => true, slotId => this.scene.gameData.importData(GameDataType.SESSION, slotId));
              return true;
            },
            keepOpen: true
          });
          options.push({
            label: i18next.t("menu:cancel"),
            handler: () => {
              this.scene.clearPhaseQueue();
              this.scene.pushPhase(new TitlePhase(this.scene));
              super.end();
              return true;
            }
          });
          this.scene.ui.showText(i18next.t("menu:selectGameMode"), null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
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
              this.confirmSlot(i18next.t("menuUiHandler:importSlotSelect"), () => true, slotId => this.scene.gameData.importData(GameDataType.SESSION, slotId));
              return true;
            },
            keepOpen: true
          });
          options.push({
            label: i18next.t("menu:cancel"),
            handler: () => {
              this.scene.clearPhaseQueue();
              this.scene.pushPhase(new TitlePhase(this.scene));
              super.end();
              return true;
            }
          });
          this.scene.ui.showText(i18next.t("menu:selectGameMode"), null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
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
        this.scene.ui.showText("Encounter Scouting", null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: charmOptions }));
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
        this.scene.ui.showText("Shop Scouting", null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: shopOptions }));
        return true;
      }
    }, {
      label: "Manage Logs",
      handler: () => {
        //return this.logRenameMenu()
        this.scene.ui.setOverlayMode(Mode.LOG_HANDLER,
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
        this.scene.biomeChangeMode = false;
        this.scene.ui.setOverlayMode(Mode.SAVE_SLOT, SaveSlotUiMode.LOAD,
          (slotId: integer, autoSlot: integer) => {
            if (slotId === -1) {
              return this.showOptions();
            }
            this.loadSaveSlot(slotId, autoSlot);
          });
        return true;
      }
    });
    if (false) {
      options.push({
        label: i18next.t("menu:dailyRun"),
        handler: () => {
          this.setupDaily();
          return true;
        },
        keepOpen: true
      });
    }
    options.push({
      label: i18next.t("menu:settings"),
      handler: () => {
        this.scene.ui.setOverlayMode(Mode.SETTINGS);
        return true;
      },
      keepOpen: true
    });
    const config: OptionSelectConfig = {
      options: options,
      noCancel: true,
      yOffset: 47
    };
    this.scene.ui.setMode(Mode.TITLE, config);
  }

  loadSaveSlot(slotId: integer, autoSlot?: integer): void {
    this.scene.sessionSlotId = slotId > -1 || !loggedInUser ? slotId : loggedInUser.lastSessionSlot;
    this.scene.ui.setMode(Mode.MESSAGE);
    this.scene.ui.resetModeChain();
    this.scene.gameData.loadSession(this.scene, slotId, slotId === -1 ? this.lastSessionData : undefined, autoSlot).then((success: boolean) => {
      if (success) {
        this.loaded = true;
        this.scene.ui.showText(i18next.t("menu:sessionSuccess"), null, () => this.end());
      } else {
        this.end();
      }
    }).catch(err => {
      console.error(err);
      this.scene.ui.showText(i18next.t("menu:failedToLoadSession"), null);
    });
  }

  initDailyRun(): void {
    this.scene.ui.setMode(Mode.SAVE_SLOT, SaveSlotUiMode.SAVE, (slotId: integer) => {
      this.scene.clearPhaseQueue();
      if (slotId === -1) {
        this.scene.pushPhase(new TitlePhase(this.scene));
        return super.end();
      }
      this.scene.sessionSlotId = slotId;

      const generateDaily = (seed: string) => {
        this.scene.gameMode = getGameMode(GameModes.DAILY);

        this.scene.setSeed(seed);
        this.scene.resetSeed(0);

        this.scene.money = this.scene.gameMode.getStartingMoney();

        const starters = getDailyRunStarters(this.scene, seed);
        const startingLevel = this.scene.gameMode.getStartingLevel();

        const party = this.scene.getPlayerParty();
        const loadPokemonAssets: Promise<void>[] = [];
        for (const starter of starters) {
          const starterProps = this.scene.gameData.getSpeciesDexAttrProps(starter.species, starter.dexAttr);
          const starterFormIndex = Math.min(starterProps.formIndex, Math.max(starter.species.forms.length - 1, 0));
          const starterGender = starter.species.malePercent !== null
            ? !starterProps.female ? Gender.MALE : Gender.FEMALE
            : Gender.GENDERLESS;
          const starterPokemon = this.scene.addPlayerPokemon(starter.species, startingLevel, starter.abilityIndex, starterFormIndex, starterGender, starterProps.shiny, starterProps.variant, undefined, starter.nature);
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
          this.scene.addModifier(m, true, false, false, true);
        }
        this.scene.updateModifiers(true, true);

        Promise.all(loadPokemonAssets).then(() => {
          this.scene.time.delayedCall(500, () => this.scene.playBgm());
          this.scene.gameData.gameStats.dailyRunSessionsPlayed++;
          this.scene.newArena(this.scene.gameMode.getStartingBiome(this.scene));
          this.scene.newBattle();
          this.scene.arena.init();
          this.scene.sessionPlayTime = 0;
          this.scene.lastSavePlayTime = 0;
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
        generateDaily(btoa(new Date().toISOString().substring(0, 10)));
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
    const ui = this.scene.ui;
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
      this.scene.clearPhaseQueue();
      this.scene.pushPhase(new TitlePhase(this.scene));
      super.end();
      return true;
    });
    return;
    confirmSlot("Select a slot to replace.", () => true, slotId => this.scene.gameData.importData(GameDataType.SESSION, slotId));
  }
  end(): void {
    if (!this.loaded && !this.scene.gameMode.isDaily) {
      this.scene.arena.preloadBgm();
      this.scene.gameMode = getGameMode(this.gameMode);
      if (this.gameMode === GameModes.CHALLENGE) {
        this.scene.pushPhase(new SelectChallengePhase(this.scene));
      } else {
        this.scene.pushPhase(new SelectStarterPhase(this.scene));
      }
      this.scene.newArena(this.scene.gameMode.getStartingBiome(this.scene));
    } else {
      this.scene.playBgm();
    }

    this.scene.pushPhase(new EncounterPhase(this.scene, this.loaded));

    if (this.loaded) {
      const availablePartyMembers = this.scene.getPokemonAllowedInBattle().length;

      this.scene.pushPhase(new SummonPhase(this.scene, 0, true, true));
      if (this.scene.currentBattle.double && availablePartyMembers > 1) {
        this.scene.pushPhase(new SummonPhase(this.scene, 1, true, true));
      }

      if (this.scene.currentBattle.battleType !== BattleType.TRAINER && (this.scene.currentBattle.waveIndex > 1 || !this.scene.gameMode.isDaily)) {
        const minPartySize = this.scene.currentBattle.double ? 2 : 1;
        if (availablePartyMembers > minPartySize) {
          this.scene.pushPhase(new CheckSwitchPhase(this.scene, 0, this.scene.currentBattle.double));
          if (this.scene.currentBattle.double) {
            this.scene.pushPhase(new CheckSwitchPhase(this.scene, 1, this.scene.currentBattle.double));
          }
        }
      }
    }

    for (const achv of Object.keys(this.scene.gameData.achvUnlocks)) {
      if (vouchers.hasOwnProperty(achv) && achv !== "CLASSIC_VICTORY") {
        this.scene.validateVoucher(vouchers[achv]);
      }
    }

    super.end();
  }

  InitShopScouting(method) {
    this.scene.sessionSlotId = 0;
    this.scene.gameData.loadSession(this.scene, this.scene.sessionSlotId, undefined, undefined).then((success: boolean) => {
      this.ShopScouting(method);
    }).catch(err => {
      console.error(err);
      this.scene.ui.showText(`something went wrong, see console error`, null);
    });
  }

  private iterations: string[] = [];
  private charmList: string[] = [];
  ShopScouting(method) {
    // this.scene.currentBattle.waveIndex = 31;

    // Remove any lures or charms
    this.scene.RemoveModifiers();
    console.log(`Starting shop scouting ${new Date().toLocaleString()}`);

    var party = this.scene.getPlayerParty();

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
      (pokemon) => pokemon.moveset[0]?.usePp(pokemon.moveset[0].getMovePp()),
      (pokemon) => pokemon.moveset[1]?.usePp(pokemon.moveset[1].getMovePp()),
      (pokemon) => pokemon.moveset[2]?.usePp(pokemon.moveset[2].getMovePp()),
    ]

    var lures = [
      () => "",
      () => {
        this.scene.RemoveModifiers();
        this.scene.InsertLure();
        return "Lure";
      },
      () => {
        this.scene.RemoveModifiers();
        this.scene.InsertSuperLure();
        return "Super Lure";
      },
      () => {
        this.scene.RemoveModifiers();
        this.scene.InsertMaxLure();
        return "Max Lure";
      },
      () => {
        this.scene.RemoveModifiers();
        this.scene.InsertLure();
        this.scene.InsertSuperLure();
        return "Lure + Super Lure";
      },
      () => {
        this.scene.RemoveModifiers();
        this.scene.InsertSuperLure();
        this.scene.InsertMaxLure();
        return "Super Lure + Max Lure";
      },
      () => {
        this.scene.RemoveModifiers();
        this.scene.InsertThreeLures();
        return "All Lures";
      },
    ]

    // var globals = [
    //   () => this.scene.InsertMegaBracelet(),
    //   () => this.scene.InsertDynamaxBand(),
    //   () => this.scene.InsertTeraOrb(),
    //   () => this.scene.InsertLockCapsule(),
    // ]

    // globals.forEach(g => {
    //   this.scene.RemoveModifiers();
    //   g()

    // comps.forEach(c => {
    this.iterations = [];
    var comp = comps[method];

    this.ClearParty(party);
    this.FillParty(party, comp);

    var partynames = party.map(p => p.name);
    console.log(partynames, party);

    var e = 0;
    ethers.forEach(ether => {
      ether(party[0])

      lures.forEach(lure => {
        var text = lure();
        this.IteratePotions(party, 0, 0, 0, 0, 0, e, text);
      });

      e++;
    })
    // });
    // });

    console.log(this.charmList);
    this.scene.ui.showText("DONE! Copy the list from the console and refresh the page.", null);
  }

  ClearParty(party: PlayerPokemon[]) {
    do {
      this.scene.removePokemonFromPlayerParty(party[0], true);
    }
    while (party.length > 0);
  }

  FillParty(party: PlayerPokemon[], comp: Species[]) {
    comp.forEach((s: Species) => {
      this.AddPokemon(party, s);
    });
  }

  AddPokemon(party: PlayerPokemon[], species: Species) {
    var pokemon = allSpecies.filter(sp => sp.speciesId == species)[0];
    party.push(this.scene.addPlayerPokemon(pokemon, 70));
  }

  CreateLog(a = 0, b = 0, c = 0, d = 0, e = 0, f = "") {
    var items: string[] = [];
    if (a - b > 0) items.push(`${a - b}x 75%-87.5% HP`);
    if (b - c > 0) items.push(`${b - c}x 62.5%-75% HP`);
    if (c - d > 0) items.push(`${c - d}x 50%-62.5% and 100dmg taken`);
    if (d > 0) items.push(`${d}x <50% and 150dmg taken`);
    if (e > 0) items.push(`${e}x low PP`);
    if (f != "") items.push(`${f}`);

    if (items.length == 0) {
      items.push("nothing");
    }

    return items.join(" + ");
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
  //
  // Planned:
  //  Revive
  //  Max Revive
  //  Full Heal
  //  Full Restore
  //  Sacred Ash
  //  Form Change Items
  //  Species Items
  //  Leek
  //  Toxic Orb
  //  Flame Orb
  //  Tera Orb
  //  Lock Capsule
  //  Dynamax Band
  //  Mega Bracelet
  IteratePotions(party: PlayerPokemon[], n = 0, a = 0, b = 0, c = 0, d = 0, e = 0, f = "") {
    if (n == 3) {
      var i = `${a} ${b} ${c} ${d} ${e} ${f}`;
      if (this.iterations.some(it => it == i)) return;

      this.iterations.push(i)
      this.GenerateShop(party, this.CreateLog(a, b, c, d, e, f));
      return;
    }

    var pokemon = party[n];
    var mhp = pokemon.getMaxHp();

    // Nothing
    this.IteratePotions(party, n + 1, a, b, c, d, e, f);

    // potion
    pokemon.hp = mhp - Math.min(Math.max(Math.floor(mhp * 0.18), 10), mhp - 1);
    this.IteratePotions(party, n + 1, a + 1, b, c, d, e, f);

    // super potion
    pokemon.hp = mhp - Math.min(Math.max(Math.floor(mhp * 0.31), 25), mhp - 1);
    this.IteratePotions(party, n + 1, a + 1, b + 1, c, d, e, f);

    // hyper potion
    pokemon.hp = mhp - Math.min(Math.max(Math.floor(mhp * 0.499), 100), mhp - 1);
    this.IteratePotions(party, n + 1, a + 1, b + 1, c + 1, d, e, f);

    // max potion
    pokemon.hp = mhp - Math.min(Math.max(Math.floor(mhp * 0.51), 150), mhp - 1);
    this.IteratePotions(party, n + 1, a + 1, b + 1, c + 1, d + 1, e, f);

    // reset pokemon
    pokemon.hp = pokemon.getMaxHp();
  }

  GenerateShop(party: PlayerPokemon[], comptext: string) {
    // var modifierPool = getModifierPoolForType(ModifierPoolType.PLAYER);
    // modifierPool[ModifierTier.ULTRA].push(new WeightedModifierType(modifierTypes.EVIOLITE, 10))
    // modifierPool[ModifierTier.GREAT].push(new WeightedModifierType(modifierTypes.EVOLUTION_ITEM, Math.min(Math.ceil(this.scene.currentBattle.waveIndex / 15), 8), 8))

    for (var w = 1; w < 50; w++) {
      if (w % 10 == 0) continue;

      this.scene.executeWithSeedOffset(() => {
        this.scene.currentBattle.waveIndex = w;
        for (var i = 0; i < 5; i++) {
          regenerateModifierPoolThresholds(party, ModifierPoolType.PLAYER, i);
          // console.log(modifierPool)
          const typeOptions: ModifierTypeOption[] = getPlayerModifierTypeOptions(Math.min(6, 3 + Math.floor((w / 10) - 1)), party);
          if (typeOptions.some(t => t.type.id == "ABILITY_CHARM")) {
            console.log(w, i, comptext);
            this.charmList.push(`${w} ${i} ${comptext}`);
          }
        }
      }, w);
    }
  }

  InitScouting(charms: number) {
    this.scene.sessionSlotId = 0;
    this.scene.gameData.loadSession(this.scene, this.scene.sessionSlotId, undefined, undefined).then((success: boolean) => {
      this.ScoutingWithoutUI(charms);
    }).catch(err => {
      console.error(err);
      this.scene.ui.showText(`something went wrong, see console error`, null);
    });
  }

	private encounterList: string[] = [];
  ScoutingWithoutUI(charms: number) {
    var startingBiome = this.scene.arena.biomeType;

    var starters: string[] = []
    var party = this.scene.getPlayerParty();
    party.forEach(p => {
      starters.push(`Pokemon: ${getPokemonNameWithAffix(p)} ` +
        `Form: ${p.getSpeciesForm().getSpriteAtlasPath(false, p.formIndex)} Species ID: ${p.species.speciesId} Stats: ${p.stats} IVs: ${p.ivs} Ability: ${p.getAbility().name} ` +
        `Passive Ability: ${p.getPassiveAbility().name} Nature: ${Nature[p.nature]} Gender: ${Gender[p.gender]} Rarity: undefined AbilityIndex: ${p.abilityIndex} `+
        `ID: ${p.id} Type: ${p.getTypes().map(t => Type[t]).join(",")} Moves: ${p.getMoveset().map(m => Moves[m?.moveId ?? 0]).join(",")}`);
    });

    var output: string[][] = [];
    output.push([`startstarters`]);
    output.push(starters);
    output.push([`endstarters`]);
    localStorage.setItem("scouting", JSON.stringify(output));

    // Remove any lures or charms
    this.scene.RemoveModifiers();

    // Add 0 to 4 charms
    if (charms > 0) this.scene.InsertAbilityCharm(charms);

    // Keep track of encounters, Generate Biomes and encounters
    console.log(`Starting 0 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    this.GenerateBiomes(startingBiome, 0);
    this.StoreEncounters(`0${charms}`);

    console.log(`Starting 1 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    this.scene.InsertLure();
    this.GenerateBiomes(startingBiome, 0);
    this.StoreEncounters(`1${charms}`);

    console.log(`Starting 2 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    this.scene.InsertSuperLure();
    this.GenerateBiomes(startingBiome, 0);
    this.StoreEncounters(`2${charms}`);

    // Only generate wave 10 for 3 lures.
    console.log(`Starting 3 lures and ${charms} charms ${new Date().toLocaleString()}`);
    this.encounterList = [];
    this.scene.InsertMaxLure();
    this.scene.newArena(startingBiome);
    this.scene.currentBattle.waveIndex = 9;
    this.scene.arena.updatePoolsForTimeOfDay();
    this.GenerateBattle();
    this.StoreEncounters(`3${charms}`);

    var output = JSON.parse(localStorage.getItem("scouting")!) as string[][];
    console.log("All scouting data:", output);
    output = [];
    this.scene.ui.showText("DONE! Copy the data from the console and then you can refresh this page.", null);
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
    console.log(`%%%%%  Wave: ${this.scene.currentBattle.waveIndex + 1}  %%%%%`)
    var battle = this.scene.newBattle() as Battle;
    while (LoggerTools.rarities.length > 0) {
      LoggerTools.rarities.pop();
    }
    LoggerTools.rarityslot[0] = 0;

    if (!nolog && battle?.trainer != null) {
      this.encounterList.push(`Wave: ${this.scene.currentBattle.waveIndex} Biome: ${Biome[this.scene.arena.biomeType]} Trainer: ${battle.trainer.config.name}`);
    }

    battle.enemyLevels?.forEach((level, e) => {
      if (battle.battleType === BattleType.TRAINER) {
        battle.enemyParty[e] = battle.trainer?.genPartyMember(e)!;
      } else {
        LoggerTools.rarityslot[0] = e;
        let enemySpecies = this.scene.randomSpecies(battle.waveIndex, level, true);
        battle.enemyParty[e] = this.scene.addEnemyPokemon(enemySpecies, level, TrainerSlot.NONE, !!this.scene.getEncounterBossSegments(battle.waveIndex, level, enemySpecies));
        if (this.scene.currentBattle.battleSpec === BattleSpec.FINAL_BOSS) {
          battle.enemyParty[e].ivs = new Array(6).fill(31);
        }
        this.scene.getPlayerParty().slice(0, !battle.double ? 1 : 2).reverse().forEach(playerPokemon => {
          applyAbAttrs(SyncEncounterNatureAbAttr, playerPokemon, null, false, battle.enemyParty[e]);
        });
      }

      if (!nolog) {
        var enemy = battle.enemyParty[e]
        // Regional pokemon have the same name, instead get their atlas path.
        if (enemy.species.speciesId > 1025) {
          // Using nicknames here because i want the getPokemonNameWithAffix so i have Wild/Foe information
          // Nicknames are stored in base 64? so convert btoa here
          enemy.nickname = btoa(Species[enemy.getSpeciesForm().getSpriteAtlasPath(false, enemy.formIndex)])
        }

        // Store encounters in a list, basically CSV (uses regex in sheets), but readable as well
        var text = `Wave: ${this.scene.currentBattle.waveIndex} Biome: ${Biome[this.scene.arena.biomeType]} Pokemon: ${getPokemonNameWithAffix(enemy)} ` +
        `Form: ${enemy.getSpeciesForm().getSpriteAtlasPath(false, enemy.formIndex)} Species ID: ${enemy.species.speciesId} Stats: ${enemy.stats} IVs: ${enemy.ivs} Ability: ${enemy.getAbility().name} ` +
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
    this.scene.newArena(biome);
    this.scene.currentBattle.waveIndex = waveIndex;
    this.scene.arena.updatePoolsForTimeOfDay()

    // Finish biome
    for (var i = 1; i <= 10; i++) {
        this.GenerateBattle()
    }

    // Victory
    if (this.scene.currentBattle.waveIndex >= 50) {
      return;
    }

    // Get next biomes by offsetting the seed to the x1 wave and then rolling for the biome selections.
    var biomeChoices: Biome[] = [];
    this.scene.executeWithSeedOffset(() => {
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
      if (this.scene.currentBattle.waveIndex != waveIndex) {
        // Back to x9 wave to generate the x0 wave again, that sets the correct rng
        this.scene.newArena(biome);
        this.scene.currentBattle.waveIndex = waveIndex + 9;
        this.GenerateBattle(true);
      }

      this.GenerateBiomes(b, waveIndex + 10);
    }
  }
}
