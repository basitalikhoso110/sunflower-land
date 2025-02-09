import Decimal from "decimal.js-light";
import { getBumpkinLevel } from "features/game/lib/level";
import { getKeys } from "features/game/types/craftables";
import { GameState } from "features/game/types/game";
import { onboardingAnalytics } from "lib/onboardingAnalytics";

import cloneDeep from "lodash.clonedeep";

export type ExpandLandAction = {
  type: "land.expanded";
  farmId: number;
};

type Options = {
  state: Readonly<GameState>;
  action: ExpandLandAction;
  createdAt?: number;
};

export function expandLand({ state, action, createdAt = Date.now() }: Options) {
  const game = cloneDeep(state) as GameState;
  const bumpkin = game.bumpkin;

  if (!game.expansionRequirements) {
    throw new Error("No more land expansions available");
  }

  if (game.expansionConstruction) {
    throw new Error("Player is expanding");
  }

  const bumpkinLevel = getBumpkinLevel(bumpkin?.experience ?? 0);
  if (bumpkinLevel < game.expansionRequirements.bumpkinLevel) {
    throw new Error("Insufficient Bumpkin Level");
  }

  const inventory = getKeys(game.expansionRequirements.resources).reduce(
    (inventory, ingredientName) => {
      const count = game.inventory[ingredientName] || new Decimal(0);
      const totalAmount =
        game.expansionRequirements?.resources[ingredientName] || new Decimal(0);

      if (count.lessThan(totalAmount)) {
        throw new Error(`Insufficient ingredient: ${ingredientName}`);
      }

      return {
        ...inventory,
        [ingredientName]: count.sub(totalAmount),
      };
    },
    game.inventory
  );

  game.expansionConstruction = {
    createdAt,
    readyAt: createdAt + game.expansionRequirements.seconds * 1000,
  };

  // https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag#tutorial_complete
  if (game.inventory["Basic Land"]?.eq(3)) {
    onboardingAnalytics.logEvent("tutorial_complete");
  }

  //developers.google.com/analytics/devguides/collection/ga4/reference/events?sjid=11955999175679069053-AP&client_type=gtag#level_up
  onboardingAnalytics.logEvent("level_up", {
    level: game.inventory["Basic Land"]?.toNumber() ?? 3,
  });

  return {
    ...game,
    inventory,
  };
}
