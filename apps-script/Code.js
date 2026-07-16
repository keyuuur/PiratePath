const PIRATE_PATH_SHEETS = {
  results: 'GameResults',
  roundResponses: 'RoundResponses',
  reflections: 'Reflections',
  dashboard: 'Dashboard',
  sessions: 'Sessions',
  attemptRegistry: 'AttemptRegistry',
  attemptAudit: 'AttemptAudit'
};

const PIRATE_PATH_BRIDGE_MAX_AGE_MS = 5 * 60 * 1000;
const PIRATE_PATH_SESSION_MINUTES = 90;
const PIRATE_PATH_V2_SCHEMA_VERSION = 'pirate-path-v2';

const PIRATE_PATH_CLASS_PERIODS = [
  '1st hour',
  '2nd hour',
  '3rd hour',
  '4th hour',
  '5th hour',
  '6th hour',
  '7th hour'
];

const PIRATE_PATH_HEADERS = {
  GameResults: [
    'timestamp',
    'sessionId',
    'studentKey',
    'firstName',
    'lastName',
    'classPeriod',
    'completed',
    'submissionType',
    'progressStage',
    'gameVersion',
    'score',
    'scoreMax',
    'percent',
    'canvasGrade',
    'level1Score',
    'level1Max',
    'level2Score',
    'level2Max',
    'level3Score',
    'level3Max',
    'reflectionScore',
    'reflectionMax',
    'questionSetSummary',
    'startTime',
    'endTime',
    'durationSeconds',
    'schemaVersion',
    'teacherSessionId',
    'attemptId',
    'studentKeyHash',
    'appVersion',
    'contentVersion',
    'variantSeed',
    'directionScore',
    'directionMax',
    'c3Correct',
    'rawTier',
    'masteryTier',
    'masteryCapReason',
    'classPointsCue',
    'misconceptionsJson',
    'payloadHash',
    'invalidated',
    'resetAttempt',
    'teacherAwardStatus'
  ],
  RoundResponses: [
    'timestamp',
    'sessionId',
    'studentKey',
    'firstName',
    'lastName',
    'classPeriod',
    'level',
    'roundNumber',
    'questionId',
    'roundTitle',
    'questionType',
    'responseStatus',
    'itemLabel',
    'studentAnswer',
    'correctAnswer',
    'pointsEarned',
    'pointsPossible',
    'isCorrect',
    'teacherSessionId',
    'attemptId',
    'missionId',
    'variantId',
    'responseKind',
    'responseJson',
    'componentId',
    'misconceptionCodes',
    'routeMovesJson',
    'payloadHash'
  ],
  Reflections: [
    'timestamp',
    'sessionId',
    'studentKey',
    'firstName',
    'lastName',
    'classPeriod',
    'reflectionId',
    'prompt',
    'responseStatus',
    'studentAnswer',
    'correctAnswer',
    'pointsEarned',
    'pointsPossible',
    'isCorrect'
  ],
  Dashboard: ['Pirate Path Dashboard'],
  Sessions: [
    'sessionId', 'label', 'classPeriod', 'codeHash', 'createdAt', 'closesAt',
    'status', 'closedAt'
  ],
  AttemptRegistry: [
    'attemptId', 'teacherSessionId', 'clientAttemptId', 'studentKeyHash',
    'firstName', 'lastName', 'classPeriod', 'status', 'startedAt', 'updatedAt',
    'variantSeed', 'contentVersion', 'checkpointRevision', 'checkpointJson',
    'submittedAt', 'payloadHash', 'replacementForAttemptId',
    'replacementAttemptId', 'resetAllowed', 'invalidatedAt'
  ],
  AttemptAudit: [
    'timestamp', 'action', 'teacherSessionId', 'attemptId',
    'replacementAttemptId', 'reason', 'teacherUser'
  ]
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pirate Path')
    .addItem('Setup / Refresh Tabs', 'setupPiratePathSheetsFromMenu_')
    .addSeparator()
    .addItem('Create Class Session', 'createPiratePathClassSession_')
    .addItem('Close Selected Session', 'closeSelectedPiratePathSession_')
    .addItem('Reset Selected Attempt', 'resetSelectedPiratePathAttempt_')
    .addSeparator()
    .addItem('Refresh PiratePath Dashboard', 'refreshPiratePathDashboardFromMenu_')
    .addToUi();
}

/** Signed JSON entry point used only by the Vercel server. */
function doPost(e) {
  try {
    const request = verifyPiratePathBridgeRequest_(e);
    const lock = LockService.getDocumentLock();
    if (!lock.tryLock(10000)) {
      throw bridgeError_('SERVICE_BUSY', 'The results sheet is busy. Please retry.');
    }
    try {
      const data = dispatchPiratePathBridgeAction_(request.action, request.data);
      return jsonResponse_({ ok: true, data });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: {
        code: error && error.bridgeCode ? error.bridgeCode : 'BRIDGE_ERROR',
        message: error && error.message ? error.message : 'The classroom service could not complete this request.',
        details: error && error.bridgeDetails ? error.bridgeDetails : undefined
      }
    });
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Pirate Path classroom service');
}

function setupPiratePathSheetsFromMenu_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);
  refreshPiratePathDashboard_(ss);
}

function refreshPiratePathDashboardFromMenu_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);
  refreshPiratePathDashboard_(ss);
}

function submitPiratePathSubmission_() {
  throw new Error('The legacy browser submission path is disabled. Use the signed Pirate Path V2 service.');
}

function setupPiratePathSheets_(ss) {
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.results, PIRATE_PATH_HEADERS.GameResults);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.roundResponses, PIRATE_PATH_HEADERS.RoundResponses);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.reflections, PIRATE_PATH_HEADERS.Reflections);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.dashboard, PIRATE_PATH_HEADERS.Dashboard);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.sessions, PIRATE_PATH_HEADERS.Sessions);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.attemptRegistry, PIRATE_PATH_HEADERS.AttemptRegistry);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.attemptAudit, PIRATE_PATH_HEADERS.AttemptAudit);
}

function ensureSheetHeaders_(ss, name, requiredHeaders) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  const existingWidth = Math.max(sheet.getLastColumn(), requiredHeaders.length, 1);
  const currentHeaders = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, existingWidth).getValues()[0]
    : [];

  if (sheet.getLastRow() === 0 || currentHeaders.every(value => value === '')) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    styleHeaderRow_(sheet, requiredHeaders.length);
    return sheet;
  }

  const existingHeaderSet = {};
  currentHeaders.forEach(header => {
    if (header) {
      existingHeaderSet[String(header).trim()] = true;
    }
  });

  const missingHeaders = requiredHeaders.filter(header => !existingHeaderSet[header]);
  if (missingHeaders.length) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    styleHeaderRow_(sheet, Math.max(sheet.getLastColumn(), requiredHeaders.length));
  }
  return sheet;
}

function styleHeaderRow_(sheet, width) {
  sheet.getRange(1, 1, 1, width)
    .setFontWeight('bold')
    .setBackground('#d9ead3')
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, width);
}

function appendObjects_(sheet, rows) {
  if (!rows || !rows.length) return;

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = rows.map(row => headers.map(header => toSheetValue_(row[header])));

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
}

function buildRoundResponseRows_(timestamp, payload) {
  return (payload.rounds || []).flatMap(round => {
    return (round.items || []).map(item => ({
      timestamp,
      sessionId: payload.sessionId,
      studentKey: payload.studentKey,
      firstName: payload.student.firstName,
      lastName: payload.student.lastName,
      classPeriod: payload.student.classPeriod,
      level: numberOrBlank_(round.levelNumber),
      roundNumber: numberOrBlank_(round.roundNumber),
      questionId: round.questionId || '',
      roundTitle: round.roundTitle || '',
      questionType: round.questionType || '',
      responseStatus: round.responseStatus || '',
      itemLabel: item.label || '',
      studentAnswer: stringifyForSheet_(item.student),
      correctAnswer: stringifyForSheet_(item.correctAnswer),
      pointsEarned: numberOrBlank_(item.pointsEarned),
      pointsPossible: numberOrBlank_(item.pointsPossible),
      isCorrect: booleanOrBlank_(item.correct)
    }));
  });
}

function buildReflectionRows_(timestamp, payload) {
  return (payload.reflections || []).map(item => ({
    timestamp,
    sessionId: payload.sessionId,
    studentKey: payload.studentKey,
    firstName: payload.student.firstName,
    lastName: payload.student.lastName,
    classPeriod: payload.student.classPeriod,
    reflectionId: item.id || '',
    prompt: item.prompt || '',
    responseStatus: item.responseStatus || '',
    studentAnswer: stringifyForSheet_(item.studentAnswer),
    correctAnswer: stringifyForSheet_(item.correctAnswer),
    pointsEarned: numberOrBlank_(item.pointsEarned),
    pointsPossible: numberOrBlank_(item.pointsPossible),
    isCorrect: booleanOrBlank_(item.correct)
  }));
}

function refreshPiratePathDashboard_(ss) {
  const resultsSheet = ss.getSheetByName(PIRATE_PATH_SHEETS.results);
  const roundSheet = ss.getSheetByName(PIRATE_PATH_SHEETS.roundResponses);
  const reflectionSheet = ss.getSheetByName(PIRATE_PATH_SHEETS.reflections);
  const dashboardSheet = ss.getSheetByName(PIRATE_PATH_SHEETS.dashboard);

  const results = getSheetObjects_(resultsSheet).map(normalizeResultRow_).filter(Boolean);
  const activeResults = results.filter(row => !row.invalidated);
  const activeAttemptIds = {};
  activeResults.forEach(row => { if (row.attemptId) activeAttemptIds[row.attemptId] = true; });
  const roundItems = getSheetObjects_(roundSheet).filter(row =>
    !row.attemptId || activeAttemptIds[String(row.attemptId)]
  );
  const reflectionItems = getSheetObjects_(reflectionSheet);

  const bestCompleteByStudent = {};
  const bestOverallByStudent = {};

  activeResults.forEach(row => {
    const currentOverall = bestOverallByStudent[row.studentKey];
    if (!currentOverall || compareAttempts_(row, currentOverall) > 0) {
      bestOverallByStudent[row.studentKey] = row;
    }

    if (row.completed) {
      const currentComplete = bestCompleteByStudent[row.studentKey];
      if (!currentComplete || compareAttempts_(row, currentComplete) > 0) {
        bestCompleteByStudent[row.studentKey] = row;
      }
    }
  });

  const bestByStudent = {};
  Object.keys(bestOverallByStudent).forEach(studentKey => {
    bestByStudent[studentKey] = bestCompleteByStudent[studentKey] || bestOverallByStudent[studentKey];
  });

  const bestRows = Object.values(bestByStudent).sort((a, b) => {
    if (a.classPeriod !== b.classPeriod) return String(a.classPeriod).localeCompare(String(b.classPeriod));
    if (a.lastName !== b.lastName) return String(a.lastName).localeCompare(String(b.lastName));
    return String(a.firstName).localeCompare(String(b.firstName));
  });

  const completedCount = activeResults.filter(row => row.completed).length;
  const avgCanvas = average_(bestRows.map(row => row.canvasGrade));
  const avgPercent = average_(bestRows.map(row => row.percent));
  const missSummary = computeMissSummary_(roundItems, reflectionItems);
  const mostMissed = missSummary[0] || null;

  dashboardSheet.clearContents();
  dashboardSheet.clearFormats();

  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  bestRows.forEach(row => { if (row.masteryTier >= 1 && row.masteryTier <= 5) tierCounts[row.masteryTier] += 1; });
  const summaryRows = [
    ['Metric', 'Value'],
    ['Total active submissions', activeResults.length],
    ['Invalidated submissions retained', results.length - activeResults.length],
    ['Completed submissions', completedCount],
    ['Unique students', bestRows.length],
    ['Average percent (highest attempt)', formatPercent_(avgPercent)],
    ['Average Canvas grade (highest attempt)', roundNumber_(avgCanvas, 2)],
    ['Most commonly missed question', mostMissed ? mostMissed.displayLabel : 'None yet'],
    ['Tier 5 students', tierCounts[5]],
    ['Tier 4 students', tierCounts[4]],
    ['Tier 3 students', tierCounts[3]],
    ['Tier 2 students', tierCounts[2]],
    ['Tier 1 students', tierCounts[1]]
  ];

  dashboardSheet.getRange(1, 1, summaryRows.length, 2)
    .setValues(summaryRows.map(row => row.map(toSheetValue_)));
  dashboardSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#d9ead3');

  const attemptsStartRow = summaryRows.length + 3;
  const attemptsHeader = [[
    'classPeriod',
    'teacherSessionId',
    'lastName',
    'firstName',
    'completed',
    'submissionType',
    'score',
    'scoreMax',
    'percent',
    'canvasGrade',
    'masteryTier',
    'classPointsCue',
    'directionScore',
    'c3Correct',
    'resetAttempt',
    'teacherAwardStatus',
    'level1Score',
    'level2Score',
    'level3Score',
    'reflectionScore',
    'questionSetSummary',
    'timestamp'
  ]];

  dashboardSheet.getRange(attemptsStartRow, 1, 1, attemptsHeader[0].length).setValues(attemptsHeader);
  dashboardSheet.getRange(attemptsStartRow, 1, 1, attemptsHeader[0].length)
    .setFontWeight('bold')
    .setBackground('#d9ead3');

  if (bestRows.length) {
    const attemptValues = bestRows.map(row => ([
      row.classPeriod,
      row.teacherSessionId,
      row.lastName,
      row.firstName,
      row.completed,
      row.submissionType,
      row.score,
      row.scoreMax,
      row.percent,
      row.canvasGrade,
      row.masteryTier || '',
      row.classPointsCue || '',
      row.directionScore === '' ? '' : row.directionScore,
      row.c3Correct === null ? '' : row.c3Correct,
      row.resetAttempt === null ? '' : row.resetAttempt,
      row.teacherAwardStatus,
      row.level1Score,
      row.level2Score,
      row.level3Score,
      row.reflectionScore,
      row.questionSetSummary,
      row.timestamp
    ]));

    dashboardSheet.getRange(attemptsStartRow + 1, 1, attemptValues.length, attemptValues[0].length)
      .setValues(attemptValues.map(row => row.map(toSheetValue_)));
  }

  const missesStartRow = attemptsStartRow + Math.max(bestRows.length, 1) + 3;
  const missesHeader = [['questionId', 'questionType', 'missCount', 'totalAttempts', 'missRate']];
  dashboardSheet.getRange(missesStartRow, 1, 1, missesHeader[0].length).setValues(missesHeader);
  dashboardSheet.getRange(missesStartRow, 1, 1, missesHeader[0].length)
    .setFontWeight('bold')
    .setBackground('#d9ead3');

  if (missSummary.length) {
    const missRows = missSummary.slice(0, 10).map(item => ([
      item.questionId,
      item.questionType,
      item.missCount,
      item.totalAttempts,
      formatPercent_(item.missRate)
    ]));

    dashboardSheet.getRange(missesStartRow + 1, 1, missRows.length, missRows[0].length)
      .setValues(missRows.map(row => row.map(toSheetValue_)));
  }

  const finalWidth = Math.max(attemptsHeader[0].length, missesHeader[0].length, 2);
  dashboardSheet.setFrozenRows(1);
  dashboardSheet.autoResizeColumns(1, finalWidth);
  const existingFilter = dashboardSheet.getFilter();
  if (existingFilter) existingFilter.remove();
  if (bestRows.length) {
    dashboardSheet.getRange(attemptsStartRow, 1, bestRows.length + 1, attemptsHeader[0].length).createFilter();
  }

  return { bestByStudent };
}

function computeMissSummary_(roundItems, reflectionItems) {
  const totals = {};

  roundItems.forEach(row => {
    accumulateMissStats_(totals, {
      questionId: row.questionId || row.roundTitle || 'Unknown round',
      questionType: row.questionType || 'game-round',
      itemLabel: row.itemLabel || '',
      isCorrect: row.isCorrect,
      responseStatus: row.responseStatus
    });
  });

  reflectionItems.forEach(row => {
    accumulateMissStats_(totals, {
      questionId: row.reflectionId || 'Reflection',
      questionType: 'reflection',
      itemLabel: row.prompt || '',
      isCorrect: row.isCorrect,
      responseStatus: row.responseStatus
    });
  });

  return Object.keys(totals)
    .map(key => {
      const item = totals[key];
      return {
        questionId: item.questionId,
        questionType: item.questionType,
        missCount: item.missCount,
        totalAttempts: item.totalAttempts,
        missRate: item.totalAttempts ? (item.missCount / item.totalAttempts) * 100 : 0,
        displayLabel: `${item.questionId} - ${item.itemLabel || item.questionType} (${item.missCount} misses)`
      };
    })
    .sort((a, b) => {
      if (b.missCount !== a.missCount) return b.missCount - a.missCount;
      if (b.missRate !== a.missRate) return b.missRate - a.missRate;
      return String(a.questionId).localeCompare(String(b.questionId));
    });
}

function accumulateMissStats_(totals, item) {
  if (String(item.responseStatus || '').toLowerCase() === 'draft') return;

  const isCorrect = normalizeBoolean_(item.isCorrect);
  if (isCorrect === null) return;

  const key = [
    item.questionType || '',
    item.questionId || '',
    item.itemLabel || ''
  ].join('|');

  if (!totals[key]) {
    totals[key] = {
      questionId: item.questionId || 'Unknown',
      questionType: item.questionType || 'unknown',
      itemLabel: item.itemLabel || '',
      missCount: 0,
      totalAttempts: 0
    };
  }

  totals[key].totalAttempts += 1;
  if (!isCorrect) {
    totals[key].missCount += 1;
  }
}

function normalizePayload_(payload) {
  validatePayload_(payload);

  const student = sanitizeStudent_(payload.student);
  const summary = payload.summary || {};
  const completed = payload.completed === true;

  return {
    sessionId: String(payload.sessionId || Utilities.getUuid()),
    gameVersion: String(payload.gameVersion || ''),
    completed,
    submissionType: String(payload.submissionType || (completed ? 'normal' : 'emergency')),
    progressStage: String(payload.progressStage || (completed ? 'complete' : 'in-progress')),
    student,
    studentKey: buildStudentKey_(student.firstName, student.lastName, student.classPeriod),
    startTime: parseDateOrBlank_(payload.startTime),
    endTime: parseDateOrBlank_(payload.endTime),
    durationSeconds: numberOrBlank_(payload.durationSeconds),
    summary: {
      score: numberOrBlank_(summary.score ?? summary.preAdjustedEarned ?? summary.totalScore),
      scoreMax: numberOrBlank_(summary.scoreMax ?? summary.preAdjustedMax ?? summary.totalMax),
      percent: numberOrBlank_(summary.percent),
      canvasGrade: numberOrBlank_(summary.canvasGrade),
      level1Score: numberOrBlank_(summary.level1Score),
      level1Max: numberOrBlank_(summary.level1Max),
      level2Score: numberOrBlank_(summary.level2Score),
      level2Max: numberOrBlank_(summary.level2Max),
      level3Score: numberOrBlank_(summary.level3Score),
      level3Max: numberOrBlank_(summary.level3Max),
      reflectionScore: numberOrBlank_(summary.reflectionScore),
      reflectionMax: numberOrBlank_(summary.reflectionMax),
      questionSetSummary: String(summary.questionSetSummary || '')
    },
    rounds: Array.isArray(payload.rounds) ? payload.rounds : [],
    reflections: Array.isArray(payload.reflections) ? payload.reflections : []
  };
}

function normalizeResultRow_(row) {
  if (!row.studentKey) return null;

  return {
    timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
    sessionId: String(row.sessionId || ''),
    teacherSessionId: String(row.teacherSessionId || ''),
    attemptId: String(row.attemptId || ''),
    studentKey: String(row.studentKey || ''),
    firstName: String(row.firstName || ''),
    lastName: String(row.lastName || ''),
    classPeriod: String(row.classPeriod || ''),
    completed: normalizeBoolean_(row.completed) === true,
    submissionType: String(row.submissionType || ''),
    score: numberOrZero_(row.score),
    scoreMax: numberOrZero_(row.scoreMax),
    percent: numberOrZero_(row.percent),
    canvasGrade: numberOrZero_(row.canvasGrade),
    masteryTier: numberOrZero_(row.masteryTier),
    classPointsCue: numberOrZero_(row.classPointsCue),
    directionScore: row.directionScore === '' ? '' : numberOrZero_(row.directionScore),
    c3Correct: normalizeBoolean_(row.c3Correct),
    invalidated: normalizeBoolean_(row.invalidated) === true,
    resetAttempt: normalizeBoolean_(row.resetAttempt),
    teacherAwardStatus: String(row.teacherAwardStatus || ''),
    level1Score: numberOrZero_(row.level1Score),
    level2Score: numberOrZero_(row.level2Score),
    level3Score: numberOrZero_(row.level3Score),
    reflectionScore: numberOrZero_(row.reflectionScore),
    questionSetSummary: String(row.questionSetSummary || '')
  };
}

function compareAttempts_(left, right) {
  const checks = [
    left.canvasGrade - right.canvasGrade,
    left.percent - right.percent,
    left.score - right.score,
    left.timestamp.getTime() - right.timestamp.getTime()
  ];

  for (let i = 0; i < checks.length; i += 1) {
    if (checks[i] > 0) return 1;
    if (checks[i] < 0) return -1;
  }

  return 0;
}

function getSheetObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values
    .map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx];
      });
      return obj;
    })
    .filter(obj => Object.values(obj).some(value => value !== ''));
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Missing submission payload.');
  }

  if (!payload.student || typeof payload.student !== 'object') {
    throw new Error('Missing student information.');
  }

  const student = sanitizeStudent_(payload.student);
  if (!student.firstName || !student.lastName || !student.classPeriod) {
    throw new Error('Student first name, last name, and class period are required.');
  }

  if (PIRATE_PATH_CLASS_PERIODS.indexOf(student.classPeriod) === -1) {
    throw new Error('Class period must match one of the seven classroom options.');
  }

  if (!payload.summary || typeof payload.summary !== 'object') {
    throw new Error('Missing score summary.');
  }
}

function sanitizeStudent_(student) {
  return {
    firstName: String(student.firstName || '').trim(),
    lastName: String(student.lastName || '').trim(),
    classPeriod: String(student.classPeriod || '').trim()
  };
}

function buildStudentKey_(firstName, lastName, classPeriod) {
  return [
    String(classPeriod || '').trim().toLowerCase(),
    String(lastName || '').trim().toLowerCase(),
    String(firstName || '').trim().toLowerCase()
  ].join('|');
}

function buildSubmissionMessage_(payload, isHighest, bestStudent) {
  if (!payload.completed) {
    return 'Emergency submit saved. Incomplete attempts stay on file, and the dashboard still prefers the highest completed attempt when one exists.';
  }

  if (isHighest) {
    return `Results saved. This is now the highest recorded attempt for ${payload.student.firstName} ${payload.student.lastName}.`;
  }

  if (bestStudent) {
    return 'Results saved. The dashboard still keeps the student\'s highest attempt.';
  }

  return 'Results saved successfully.';
}

function average_(values) {
  const nums = values.filter(value => typeof value === 'number' && !isNaN(value));
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function formatPercent_(value) {
  return `${roundNumber_(value, 2)}%`;
}

function roundNumber_(value, decimals) {
  const factor = Math.pow(10, decimals || 0);
  return Math.round((Number(value) || 0) * factor) / factor;
}

function numberOrBlank_(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  return isNaN(num) ? '' : num;
}

function numberOrZero_(value) {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function booleanOrBlank_(value) {
  if (value === null || value === undefined || value === '') return '';
  return value === true;
}

function normalizeBoolean_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value === true || value === false) return value;
  const text = String(value).trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return null;
}

function parseDateOrBlank_(value) {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? '' : parsed;
}

function stringifyForSheet_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function toSheetValue_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function createPiratePathClassSession_() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt(
    'Create Pirate Path session',
    'Enter the class period exactly (for example: 2nd hour). The session will remain open for 90 minutes.',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer.getSelectedButton() !== ui.Button.OK) return;

  const classPeriod = String(answer.getResponseText() || '').trim();
  if (PIRATE_PATH_CLASS_PERIODS.indexOf(classPeriod) === -1) {
    ui.alert('That class period is not valid. Use 1st hour through 7th hour.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);
  const sheet = ss.getSheetByName(PIRATE_PATH_SHEETS.sessions);
  const existingHashes = {};
  getSheetObjects_(sheet).forEach(row => { existingHashes[String(row.codeHash || '')] = true; });

  let code = '';
  let codeHash = '';
  do {
    code = generateSessionCode_();
    codeHash = hashSessionCode_(code);
  } while (existingHashes[codeHash]);

  const createdAt = new Date();
  const closesAt = new Date(createdAt.getTime() + PIRATE_PATH_SESSION_MINUTES * 60 * 1000);
  const sessionId = Utilities.getUuid();
  const label = `${classPeriod} - ${Utilities.formatDate(createdAt, Session.getScriptTimeZone(), 'MMM d, h:mm a')}`;
  appendObjects_(sheet, [{
    sessionId,
    label,
    classPeriod,
    codeHash,
    createdAt,
    closesAt,
    status: 'open',
    closedAt: ''
  }]);
  sheet.getRange(sheet.getLastRow(), 1, 1, sheet.getLastColumn()).activate();
  ui.alert(
    'Pirate Path class session created',
    `Session code: ${code}\n\nPeriod: ${classPeriod}\nCloses: ${Utilities.formatDate(closesAt, Session.getScriptTimeZone(), 'h:mm a')}\n\nCopy this code now. It is stored only as a secure hash and cannot be recovered.`,
    ui.ButtonSet.OK
  );
}

function closeSelectedPiratePathSession_() {
  const context = selectedSheetRow_(PIRATE_PATH_SHEETS.sessions);
  if (!context) return;
  const session = context.object;
  if (String(session.status || '') !== 'open') {
    SpreadsheetApp.getUi().alert('The selected session is already closed.');
    return;
  }
  updateObjectRow_(context.sheet, context.rowNumber, { status: 'closed', closedAt: new Date() });
  SpreadsheetApp.getUi().alert(`Closed ${session.label || session.sessionId}.`);
}

function resetSelectedPiratePathAttempt_() {
  const context = selectedSheetRow_(PIRATE_PATH_SHEETS.attemptRegistry);
  if (!context) return;
  const attempt = context.object;
  const status = String(attempt.status || '');
  if (status !== 'in_progress' && status !== 'submitted') {
    SpreadsheetApp.getUi().alert('Only an in-progress or submitted attempt can be reset.');
    return;
  }
  if (attempt.replacementForAttemptId || attempt.replacementAttemptId || normalizeBoolean_(attempt.resetAllowed) === true) {
    SpreadsheetApp.getUi().alert('This student has already used or received the one allowed replacement attempt.');
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const answer = ui.prompt(
    'Reset selected attempt',
    'Enter the reason for this reset. The original result will remain in the audit trail.',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer.getSelectedButton() !== ui.Button.OK) return;
  const reason = String(answer.getResponseText() || '').trim();
  if (reason.length < 3) {
    ui.alert('A short reset reason is required.');
    return;
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    updateObjectRow_(context.sheet, context.rowNumber, {
      status: 'invalidated',
      invalidatedAt: new Date(),
      resetAllowed: true,
      updatedAt: new Date()
    });
    markGameResultInvalidated_(String(attempt.attemptId || ''));
    appendAttemptAudit_({
      action: 'RESET_AUTHORIZED',
      teacherSessionId: attempt.teacherSessionId,
      attemptId: attempt.attemptId,
      replacementAttemptId: '',
      reason
    });
  } finally {
    lock.releaseLock();
  }
  ui.alert('Reset recorded. The student may start one replacement attempt with the same class session code.');
}

function verifyPiratePathBridgeRequest_(e) {
  const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (!raw || raw.length > 90000) throw bridgeError_('INVALID_REQUEST', 'Missing or oversized bridge request.');

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    throw bridgeError_('INVALID_REQUEST', 'The bridge request is not valid JSON.');
  }
  const timestamp = Number(envelope.timestamp);
  const nonce = String(envelope.nonce || '');
  const body = String(envelope.body || '');
  const signature = String(envelope.signature || '');
  if (!Number.isFinite(timestamp) || !/^[0-9a-f-]{20,80}$/i.test(nonce) || !body || body.length > 65536 || !signature) {
    throw bridgeError_('INVALID_REQUEST', 'The bridge request is incomplete.');
  }
  if (Math.abs(Date.now() - timestamp) > PIRATE_PATH_BRIDGE_MAX_AGE_MS) {
    throw bridgeError_('STALE_REQUEST', 'The bridge request has expired.');
  }

  const secret = getRequiredScriptProperty_('PIRATE_PATH_BRIDGE_SECRET');
  const expected = base64UrlHmac_(`${timestamp}.${nonce}.${body}`, secret);
  if (!constantTimeEquals_(signature, expected)) {
    throw bridgeError_('INVALID_SIGNATURE', 'The bridge request signature is invalid.');
  }

  const cache = CacheService.getScriptCache();
  const nonceKey = `pirate-path-nonce:${nonce}`;
  if (cache.get(nonceKey)) throw bridgeError_('REPLAYED_REQUEST', 'This bridge request was already used.');
  cache.put(nonceKey, '1', Math.ceil(PIRATE_PATH_BRIDGE_MAX_AGE_MS / 1000) + 30);

  let request;
  try {
    request = JSON.parse(body);
  } catch (error) {
    throw bridgeError_('INVALID_REQUEST', 'The signed bridge body is not valid JSON.');
  }
  if (!request || typeof request.action !== 'string' || !request.data || typeof request.data !== 'object') {
    throw bridgeError_('INVALID_REQUEST', 'The signed bridge body is incomplete.');
  }
  return request;
}

function dispatchPiratePathBridgeAction_(action, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);
  if (action === 'session.validate') return bridgeValidateSession_(ss, data);
  if (action === 'attempt.start') return bridgeStartAttempt_(ss, data);
  if (action === 'attempt.checkpoint') return bridgeCheckpointAttempt_(ss, data);
  if (action === 'attempt.submit') return bridgeSubmitAttempt_(ss, data);
  throw bridgeError_('UNKNOWN_ACTION', 'The requested classroom action is not supported.');
}

function bridgeValidateSession_(ss, data) {
  const code = String(data.code || '').trim().toUpperCase();
  const classPeriod = String(data.classPeriod || '').trim();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || PIRATE_PATH_CLASS_PERIODS.indexOf(classPeriod) === -1) {
    throw bridgeError_('INVALID_REQUEST', 'The class code or period is invalid.');
  }
  const codeHash = hashSessionCode_(code);
  const sessions = getSheetObjects_(ss.getSheetByName(PIRATE_PATH_SHEETS.sessions));
  const session = sessions.find(row => constantTimeEquals_(String(row.codeHash || ''), codeHash));
  if (!session || String(session.status || '') !== 'open' || dateMillis_(session.closesAt) <= Date.now()) {
    throw bridgeError_('SESSION_NOT_AVAILABLE', 'This class session is invalid, closed, or expired.');
  }
  if (String(session.classPeriod || '') !== classPeriod) {
    throw bridgeError_('PERIOD_MISMATCH', 'Choose the class period assigned to this session code.');
  }
  return {
    teacherSessionId: String(session.sessionId),
    label: String(session.label || classPeriod),
    allowedPeriod: classPeriod,
    closesAt: asIso_(session.closesAt)
  };
}

function bridgeStartAttempt_(ss, data) {
  const teacherSessionId = requireText_(data.teacherSessionId, 'teacherSessionId', 80);
  const clientAttemptId = requireUuid_(data.clientAttemptId, 'clientAttemptId');
  const proposedVariantSeed = requireUuid_(data.proposedVariantSeed, 'proposedVariantSeed');
  const contentVersion = requireText_(data.contentVersion, 'contentVersion', 100);
  const student = sanitizeStudent_(data.student || {});
  if (!student.firstName || !student.lastName || PIRATE_PATH_CLASS_PERIODS.indexOf(student.classPeriod) === -1) {
    throw bridgeError_('INVALID_REQUEST', 'First name, last name, and a valid class period are required.');
  }
  requireOpenSession_(ss, teacherSessionId, student.classPeriod);

  const studentKeyHash = hashStudentKey_(student);
  const sheet = ss.getSheetByName(PIRATE_PATH_SHEETS.attemptRegistry);
  const matching = getSheetObjectsWithRows_(sheet).filter(row =>
    String(row.teacherSessionId) === teacherSessionId && String(row.studentKeyHash) === studentKeyHash
  );
  const inProgress = matching.find(row => String(row.status) === 'in_progress');
  if (inProgress) return attemptStartResponse_(inProgress);
  if (matching.some(row => String(row.status) === 'submitted')) {
    throw bridgeError_('ATTEMPT_ALREADY_SUBMITTED', 'A completed attempt is already recorded for this student and class session.');
  }

  const replacementSource = matching.find(row =>
    String(row.status) === 'invalidated' &&
    normalizeBoolean_(row.resetAllowed) === true &&
    !row.replacementAttemptId &&
    !row.replacementForAttemptId
  );
  if (matching.length && !replacementSource) {
    throw bridgeError_('ATTEMPT_ALREADY_SUBMITTED', 'No additional attempt is available for this student and class session.');
  }

  const now = new Date();
  const attempt = {
    attemptId: Utilities.getUuid(),
    teacherSessionId,
    clientAttemptId,
    studentKeyHash,
    firstName: student.firstName,
    lastName: student.lastName,
    classPeriod: student.classPeriod,
    status: 'in_progress',
    startedAt: now,
    updatedAt: now,
    variantSeed: proposedVariantSeed,
    contentVersion,
    checkpointRevision: '',
    checkpointJson: '',
    submittedAt: '',
    payloadHash: '',
    replacementForAttemptId: replacementSource ? replacementSource.attemptId : '',
    replacementAttemptId: '',
    resetAllowed: false,
    invalidatedAt: ''
  };
  appendObjects_(sheet, [attempt]);

  if (replacementSource) {
    updateObjectRow_(sheet, replacementSource._rowNumber, {
      replacementAttemptId: attempt.attemptId,
      resetAllowed: false,
      updatedAt: now
    });
    appendAttemptAudit_({
      action: 'REPLACEMENT_STARTED',
      teacherSessionId,
      attemptId: replacementSource.attemptId,
      replacementAttemptId: attempt.attemptId,
      reason: 'Student started authorized replacement attempt.'
    });
  }
  return attemptStartResponse_(attempt);
}

function bridgeCheckpointAttempt_(ss, data) {
  const attemptId = requireUuid_(data.attemptId, 'attemptId');
  const teacherSessionId = requireText_(data.teacherSessionId, 'teacherSessionId', 80);
  const studentKeyHash = requireHash_(data.studentKeyHash, 'studentKeyHash');
  const checkpoint = data.checkpoint;
  if (!checkpoint || typeof checkpoint !== 'object') throw bridgeError_('INVALID_REQUEST', 'Missing checkpoint.');
  const stateVersion = Number(checkpoint.stateVersion);
  if (!Number.isInteger(stateVersion) || stateVersion < 1 || stateVersion > 100) {
    throw bridgeError_('INVALID_REQUEST', 'The checkpoint revision is invalid.');
  }
  const checkpointJson = JSON.stringify(checkpoint);
  if (checkpointJson.length > 60000) throw bridgeError_('INVALID_REQUEST', 'The checkpoint is too large.');

  const sheet = ss.getSheetByName(PIRATE_PATH_SHEETS.attemptRegistry);
  const attempt = findAttempt_(sheet, attemptId);
  assertAttemptOwnership_(attempt, teacherSessionId, studentKeyHash);
  if (String(attempt.status) !== 'in_progress') {
    throw bridgeError_('ATTEMPT_ALREADY_SUBMITTED', 'This attempt can no longer be changed.');
  }

  const previousRevision = Number(attempt.checkpointRevision || 0);
  const previousJson = String(attempt.checkpointJson || '');
  if (stateVersion < previousRevision || (stateVersion === previousRevision && previousJson !== checkpointJson)) {
    return {
      saved: false,
      duplicate: false,
      stale: true,
      stateVersion: previousRevision,
      updatedAt: asIso_(attempt.updatedAt || new Date())
    };
  }
  if (stateVersion === previousRevision && previousJson === checkpointJson) {
    return {
      saved: true,
      duplicate: true,
      stale: false,
      stateVersion,
      updatedAt: asIso_(attempt.updatedAt || new Date())
    };
  }

  const updatedAt = new Date();
  updateObjectRow_(sheet, attempt._rowNumber, {
    checkpointRevision: stateVersion,
    checkpointJson,
    updatedAt
  });
  return { saved: true, duplicate: false, stale: false, stateVersion, updatedAt: asIso_(updatedAt) };
}

function bridgeSubmitAttempt_(ss, data) {
  const attemptId = requireUuid_(data.attemptId, 'attemptId');
  const teacherSessionId = requireText_(data.teacherSessionId, 'teacherSessionId', 80);
  const studentKeyHash = requireHash_(data.studentKeyHash, 'studentKeyHash');
  const payloadHash = requireHash_(data.payloadHash, 'payloadHash');
  const result = validateCanonicalResult_(data.result);
  if (!Array.isArray(data.responses) || data.responses.length !== 8) {
    throw bridgeError_('INVALID_REQUEST', 'The final assessment must contain eight mission responses.');
  }

  const registrySheet = ss.getSheetByName(PIRATE_PATH_SHEETS.attemptRegistry);
  const attempt = findAttempt_(registrySheet, attemptId);
  assertAttemptOwnership_(attempt, teacherSessionId, studentKeyHash);

  if (String(attempt.status) === 'submitted' && String(attempt.payloadHash) !== payloadHash) {
    throw bridgeError_('SUBMISSION_CONFLICT', 'This attempt was already submitted with different answers.');
  }
  if (String(attempt.status) !== 'in_progress' && String(attempt.status) !== 'submitted') {
    throw bridgeError_('ATTEMPT_ALREADY_SUBMITTED', 'This attempt can no longer be submitted.');
  }

  const existingResults = getSheetObjects_(ss.getSheetByName(PIRATE_PATH_SHEETS.results))
    .filter(row => String(row.attemptId || '') === attemptId);
  if (existingResults.some(row => String(row.payloadHash || '') !== payloadHash)) {
    throw bridgeError_('SUBMISSION_CONFLICT', 'This attempt already has a different canonical result.');
  }

  const submittedAt = parseRequiredDate_(data.submittedAt, 'submittedAt');
  const startedAt = parseRequiredDate_(data.startedAt, 'startedAt');
  if (!existingResults.length) {
    appendCanonicalResult_(ss, attempt, data, result, payloadHash, startedAt, submittedAt);
  }
  appendMissingCanonicalRoundRows_(ss, attempt, data, result, payloadHash);
  updateObjectRow_(registrySheet, attempt._rowNumber, {
    status: 'submitted',
    submittedAt,
    payloadHash,
    checkpointJson: '',
    updatedAt: new Date()
  });
  return {
    duplicate: existingResults.length > 0 || String(attempt.status) === 'submitted',
    submittedAt: asIso_(submittedAt)
  };
}

function appendCanonicalResult_(ss, attempt, data, result, payloadHash, startedAt, submittedAt) {
  const variants = (data.responses || []).map(response => `${response.missionId}:${response.variantId}`).join(', ');
  appendObjects_(ss.getSheetByName(PIRATE_PATH_SHEETS.results), [{
    timestamp: submittedAt,
    sessionId: attemptIdForLegacy_(attempt),
    studentKey: attempt.studentKeyHash,
    firstName: attempt.firstName,
    lastName: attempt.lastName,
    classPeriod: attempt.classPeriod,
    completed: true,
    submissionType: 'v2-final',
    progressStage: 'complete',
    gameVersion: data.appVersion,
    score: result.score,
    scoreMax: 20,
    percent: result.percent,
    canvasGrade: result.score,
    questionSetSummary: variants,
    startTime: startedAt,
    endTime: submittedAt,
    durationSeconds: Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000)),
    schemaVersion: PIRATE_PATH_V2_SCHEMA_VERSION,
    teacherSessionId: attempt.teacherSessionId,
    attemptId: attempt.attemptId,
    studentKeyHash: attempt.studentKeyHash,
    appVersion: data.appVersion,
    contentVersion: data.contentVersion,
    variantSeed: data.variantSeed,
    directionScore: result.directionScore,
    directionMax: 5,
    c3Correct: result.c3Correct,
    rawTier: result.rawTier,
    masteryTier: result.masteryTier,
    masteryCapReason: result.capReason || '',
    classPointsCue: result.masteryTier,
    misconceptionsJson: JSON.stringify(result.misconceptions || []),
    payloadHash,
    invalidated: false,
    resetAttempt: !!attempt.replacementForAttemptId,
    teacherAwardStatus: 'Not awarded'
  }]);
}

function appendMissingCanonicalRoundRows_(ss, attempt, data, result, payloadHash) {
  const sheet = ss.getSheetByName(PIRATE_PATH_SHEETS.roundResponses);
  const existingKeys = {};
  getSheetObjects_(sheet).forEach(row => {
    if (String(row.attemptId || '') === String(attempt.attemptId)) {
      existingKeys[`${row.missionId}|${row.componentId}`] = true;
    }
  });
  const responseByMission = {};
  data.responses.forEach(response => { responseByMission[response.missionId] = response; });
  const rows = [];
  (result.itemResults || []).forEach(item => {
    const response = responseByMission[item.missionId] || {};
    (item.components || []).forEach(componentScore => {
      const key = `${item.missionId}|${componentScore.id}`;
      if (existingKeys[key]) return;
      rows.push({
        timestamp: new Date(),
        sessionId: attemptIdForLegacy_(attempt),
        studentKey: attempt.studentKeyHash,
        firstName: attempt.firstName,
        lastName: attempt.lastName,
        classPeriod: attempt.classPeriod,
        questionId: item.missionId,
        roundTitle: item.missionId,
        questionType: response.kind || '',
        responseStatus: 'final',
        itemLabel: componentScore.id,
        studentAnswer: JSON.stringify(response),
        correctAnswer: '',
        pointsEarned: componentScore.earned,
        pointsPossible: componentScore.possible,
        isCorrect: componentScore.correct,
        teacherSessionId: attempt.teacherSessionId,
        attemptId: attempt.attemptId,
        missionId: item.missionId,
        variantId: item.variantId,
        responseKind: response.kind || '',
        responseJson: JSON.stringify(response),
        componentId: componentScore.id,
        misconceptionCodes: JSON.stringify(item.misconceptions || []),
        routeMovesJson: response.route ? JSON.stringify(response.route.moves || []) : '',
        payloadHash
      });
    });
  });
  appendObjects_(sheet, rows);
}

function validateCanonicalResult_(result) {
  if (!result || typeof result !== 'object') throw bridgeError_('INVALID_REQUEST', 'Missing canonical score.');
  const score = Number(result.score);
  const directionScore = Number(result.directionScore);
  const rawTier = Number(result.rawTier);
  const masteryTier = Number(result.masteryTier);
  if (!Number.isInteger(score) || score < 0 || score > 20 ||
      !Number.isInteger(directionScore) || directionScore < 0 || directionScore > 5 ||
      !Number.isInteger(rawTier) || rawTier < 1 || rawTier > 5 ||
      !Number.isInteger(masteryTier) || masteryTier < 1 || masteryTier > 5 ||
      !Array.isArray(result.itemResults) || result.itemResults.length !== 8) {
    throw bridgeError_('INVALID_REQUEST', 'The canonical score is invalid.');
  }
  return {
    score,
    percent: Number(result.percent),
    directionScore,
    c3Correct: result.c3Correct === true,
    rawTier,
    masteryTier,
    capReason: result.capReason || '',
    itemResults: result.itemResults,
    misconceptions: Array.isArray(result.misconceptions) ? result.misconceptions : []
  };
}

function requireOpenSession_(ss, sessionId, classPeriod) {
  const session = getSheetObjects_(ss.getSheetByName(PIRATE_PATH_SHEETS.sessions))
    .find(row => String(row.sessionId || '') === sessionId);
  if (!session || String(session.status || '') !== 'open' || dateMillis_(session.closesAt) <= Date.now()) {
    throw bridgeError_('SESSION_NOT_AVAILABLE', 'This class session is closed or expired.');
  }
  if (String(session.classPeriod || '') !== classPeriod) {
    throw bridgeError_('PERIOD_MISMATCH', 'Choose the class period assigned to this session code.');
  }
  return session;
}

function attemptStartResponse_(attempt) {
  let checkpoint = null;
  if (attempt.checkpointJson) {
    try { checkpoint = JSON.parse(String(attempt.checkpointJson)); } catch (error) { checkpoint = null; }
  }
  return {
    attemptId: String(attempt.attemptId),
    studentKeyHash: String(attempt.studentKeyHash),
    status: 'in_progress',
    startedAt: asIso_(attempt.startedAt),
    checkpoint,
    variantSeed: String(attempt.variantSeed),
    contentVersion: String(attempt.contentVersion)
  };
}

function findAttempt_(sheet, attemptId) {
  const attempt = getSheetObjectsWithRows_(sheet).find(row => String(row.attemptId || '') === attemptId);
  if (!attempt) throw bridgeError_('ATTEMPT_NOT_FOUND', 'This attempt was not found.');
  return attempt;
}

function assertAttemptOwnership_(attempt, teacherSessionId, studentKeyHash) {
  if (String(attempt.teacherSessionId) !== teacherSessionId ||
      !constantTimeEquals_(String(attempt.studentKeyHash), studentKeyHash)) {
    throw bridgeError_('ATTEMPT_MISMATCH', 'This request does not match the active attempt.');
  }
}

function markGameResultInvalidated_(attemptId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PIRATE_PATH_SHEETS.results);
  if (!sheet || !attemptId) return;
  getSheetObjectsWithRows_(sheet).forEach(row => {
    if (String(row.attemptId || '') === attemptId) {
      updateObjectRow_(sheet, row._rowNumber, { invalidated: true });
    }
  });
}

function appendAttemptAudit_(entry) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  appendObjects_(ss.getSheetByName(PIRATE_PATH_SHEETS.attemptAudit), [{
    timestamp: new Date(),
    action: entry.action,
    teacherSessionId: entry.teacherSessionId || '',
    attemptId: entry.attemptId || '',
    replacementAttemptId: entry.replacementAttemptId || '',
    reason: entry.reason || '',
    teacherUser: Session.getActiveUser().getEmail() || 'spreadsheet-user'
  }]);
}

function selectedSheetRow_(requiredSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);
  const sheet = ss.getActiveSheet();
  const range = sheet.getActiveRange();
  if (sheet.getName() !== requiredSheetName || !range || range.getRow() < 2) {
    SpreadsheetApp.getUi().alert(`Select a data row on the ${requiredSheetName} tab first.`);
    return null;
  }
  const rowNumber = range.getRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const object = {};
  headers.forEach((header, index) => { if (header) object[header] = values[index]; });
  return { sheet, rowNumber, object };
}

function getSheetObjectsWithRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
    .map((values, index) => {
      const object = { _rowNumber: index + 2 };
      headers.forEach((header, column) => { if (header) object[header] = values[column]; });
      return object;
    })
    .filter(object => Object.keys(object).some(key => key !== '_rowNumber' && object[key] !== ''));
}

function updateObjectRow_(sheet, rowNumber, updates) {
  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, width).getValues()[0];
  headers.forEach((header, index) => {
    if (header && Object.prototype.hasOwnProperty.call(updates, header)) {
      values[index] = toSheetValue_(updates[header]);
    }
  });
  sheet.getRange(rowNumber, 1, 1, width).setValues([values]);
}

function generateSessionCode_() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const source = Utilities.getUuid().replace(/-/g, '');
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    const value = parseInt(source.slice(index * 2, index * 2 + 2), 16);
    code += alphabet[value % alphabet.length];
  }
  return code;
}

function hashSessionCode_(code) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('PIRATE_PATH_SESSION_CODE_SECRET') || getRequiredScriptProperty_('PIRATE_PATH_BRIDGE_SECRET');
  return hexHmac_(`session:${String(code).trim().toUpperCase()}`, secret);
}

function hashStudentKey_(student) {
  const secret = getRequiredScriptProperty_('PIRATE_PATH_STUDENT_KEY_SECRET');
  return hexHmac_(`student:${buildStudentKey_(student.firstName, student.lastName, student.classPeriod)}`, secret);
}

function getRequiredScriptProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value || value.length < 32) throw bridgeError_('BRIDGE_NOT_CONFIGURED', `Required Script Property ${name} is missing or too short.`);
  return value;
}

function base64UrlHmac_(message, secret) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8)
  ).replace(/=+$/g, '');
}

function hexHmac_(message, secret) {
  return Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8)
    .map(value => ((value + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEquals_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^
      (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
  }
  return mismatch === 0;
}

function requireText_(value, field, maxLength) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) throw bridgeError_('INVALID_REQUEST', `${field} is invalid.`);
  return text;
}

function requireUuid_(value, field) {
  const text = requireText_(value, field, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw bridgeError_('INVALID_REQUEST', `${field} is invalid.`);
  }
  return text;
}

function requireHash_(value, field) {
  const text = requireText_(value, field, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw bridgeError_('INVALID_REQUEST', `${field} is invalid.`);
  return text;
}

function parseRequiredDate_(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) throw bridgeError_('INVALID_REQUEST', `${field} is invalid.`);
  return date;
}

function asIso_(value) {
  return parseRequiredDate_(value, 'date').toISOString();
}

function dateMillis_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function attemptIdForLegacy_(attempt) {
  return String(attempt.attemptId || '');
}

function bridgeError_(code, message, details) {
  const error = new Error(message);
  error.bridgeCode = code;
  error.bridgeDetails = details;
  return error;
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
