/**
 * Quirky agent name generator.
 *
 * Produces unique, fun compound names like "cosmic-penguin" or "turbo-flamingo"
 * from two curated wordlists using SHA-256 hashing with UUID entropy.
 */

import { createHash } from "node:crypto";

const ADJECTIVES = [
  "bouncy", "bubbly", "buzzy", "chaotic", "cheeky", "chilly", "chunky",
  "clever", "cosmic", "cranky", "crispy", "crunchy", "cuddly", "daring",
  "dizzy", "dreamy", "dusty", "fancy", "fizzy", "flashy", "fluffy",
  "frosty", "funky", "fuzzy", "giddy", "glitchy", "groovy", "grumpy",
  "gusty", "happy", "jazzy", "jiggly", "jolly", "jumpy", "lazy", "lucky",
  "mellow", "mighty", "misty", "moody", "nifty", "noble", "peppy",
  "plucky", "punchy", "quirky", "rusty", "salty", "sassy", "shiny",
  "silent", "silly", "sleepy", "sneaky", "snowy", "speedy", "spicy",
  "stormy", "sunny", "swift", "tangy", "tiny", "toasty", "turbo",
  "twisty", "wacky", "witty", "wobbly", "zappy", "zesty",
];

const ANIMALS = [
  "alpaca", "axolotl", "badger", "bat", "beaver", "bison", "bunny",
  "capybara", "chameleon", "cheetah", "cobra", "corgi", "coyote", "crane",
  "crow", "dolphin", "donkey", "dragon", "eagle", "falcon", "ferret",
  "flamingo", "fox", "frog", "gecko", "goose", "hamster", "hawk",
  "hedgehog", "hippo", "hyena", "iguana", "jaguar", "koala", "lemur",
  "leopard", "llama", "lobster", "lynx", "mantis", "moose", "narwhal",
  "newt", "octopus", "otter", "owl", "panda", "parrot", "pelican",
  "penguin", "possum", "puffin", "quail", "rabbit", "raccoon", "raven",
  "salmon", "seal", "shark", "sloth", "sparrow", "squid", "tiger",
  "toucan", "turtle", "viper", "walrus", "wombat", "yak", "zebra",
];

/**
 * Generate a fun compound name from a seed string.
 * Deterministic — same seed always gives the same name.
 */
export function generateName(seed: string): string {
  const hash = createHash("sha256").update(seed).digest();
  const adjIdx = ((hash[0] << 8) | hash[1]) % ADJECTIVES.length;
  const animalIdx = ((hash[2] << 8) | hash[3]) % ANIMALS.length;
  return `${ADJECTIVES[adjIdx]}-${ANIMALS[animalIdx]}`;
}

/**
 * Generate a unique agent name for a new agent.
 * Each call produces a different name thanks to random entropy.
 */
export function generateUniqueName(
  projectName: string,
  agentType: string,
  attempt: number = 0
): string {
  const entropy = crypto.randomUUID().slice(0, 8);
  const seed = `${projectName}:${agentType}:${entropy}:${attempt}`;
  return generateName(seed);
}

/** The creator agent's fixed name */
export const CREATOR_NAME = "the_creator";
