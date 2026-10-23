import type { Sketch } from './winkTimeline.js';
import { elfIntern, reindeerDriver, santaForeman, secretSanta, snowmanGuard } from './winkSketchesChristmas.js';
import { ghost, mummy, pumpkin, vampire, witch } from './winkSketchesHalloween.js';
import { engineerMom, grandma, lateSon, multitaskMom, voiceNote } from './winkSketchesMothers.js';
import { countdown, grapes, suitcase, toast, yellowLucky } from './winkSketchesNewYear.js';
import { anticucho, flag, marinera, parade, pisco } from './winkSketchesPatrias.js';
import { cupid, heartbroken, roses, serenade, stoodUp } from './winkSketchesValentine.js';

/** The seasonal winks' sketches by wink id (pending 73), five per season. */
export const SEASONAL_SKETCHES = {
  pumpkin: pumpkin(),
  vampire: vampire(),
  mummy: mummy(),
  witch: witch(),
  ghost: ghost(),
  santa: santaForeman(),
  elf: elfIntern(),
  reindeer: reindeerDriver(),
  snowman: snowmanGuard(),
  'secret-santa': secretSanta(),
  countdown: countdown(),
  grapes: grapes(),
  suitcase: suitcase(),
  yellow: yellowLucky(),
  toast: toast(),
  cupid: cupid(),
  roses: roses(),
  serenade: serenade(),
  'stood-up': stoodUp(),
  heartbroken: heartbroken(),
  'multitask-mom': multitaskMom(),
  grandma: grandma(),
  'late-son': lateSon(),
  'engineer-mom': engineerMom(),
  'voice-note': voiceNote(),
  flag: flag(),
  marinera: marinera(),
  anticucho: anticucho(),
  parade: parade(),
  pisco: pisco(),
} satisfies Record<string, Sketch>;
