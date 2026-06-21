export const FORMATS = {
  SINGLE_ELIMINATION: 'single-elimination',
  DOUBLE_ELIMINATION: 'double-elimination',
  ROUND_ROBIN: 'round-robin',
  GROUP_STAGE: 'group-stage',
  SWISS: 'swiss',
};

export const FORMAT_LABELS = {
  [FORMATS.SINGLE_ELIMINATION]: 'Élimination directe',
  [FORMATS.DOUBLE_ELIMINATION]: 'Double élimination',
  [FORMATS.ROUND_ROBIN]: 'Round Robin',
  [FORMATS.GROUP_STAGE]: 'Phase de groupes',
  [FORMATS.SWISS]: 'Système suisse',
};

export const STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
};

export const STATUS_LABELS = {
  [STATUS.DRAFT]: 'Brouillon',
  [STATUS.IN_PROGRESS]: 'En cours',
  [STATUS.COMPLETED]: 'Terminé',
};

export const ELIM_SIZES = [4, 8, 16, 32];

export const PARTICIPANT_COLORS = [
  '#8f6118', '#2f9656', '#7a1a1a', '#495052', '#c49d10',
  '#677578', '#78551d', '#94600d', '#abd1ca', '#de560d',
  '#3bed7f', '#bf280d', '#edbb07', '#9fb5b1', '#21b058',
  '#3b3f40',
];
