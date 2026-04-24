const PIRATE_PATH_SHEETS = {
  results: 'GameResults',
  roundResponses: 'RoundResponses',
  reflections: 'Reflections',
  dashboard: 'Dashboard'
};

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
    'durationSeconds'
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
    'isCorrect'
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
  Dashboard: ['Pirate Path Dashboard']
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pirate Path')
    .addItem('Setup / Refresh Tabs', 'setupPiratePathSheets')
    .addItem('Refresh Dashboard', 'refreshPiratePathDashboard')
    .addToUi();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Pirate Path: Distance vs Displacement')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupPiratePathSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);
  refreshPiratePathDashboard_(ss);
}

function refreshPiratePathDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);
  refreshPiratePathDashboard_(ss);
}

function submitPiratePathSubmission(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPiratePathSheets_(ss);

  const normalizedPayload = normalizePayload_(payload);
  const timestamp = new Date();

  const resultsSheet = ss.getSheetByName(PIRATE_PATH_SHEETS.results);
  const roundSheet = ss.getSheetByName(PIRATE_PATH_SHEETS.roundResponses);
  const reflectionSheet = ss.getSheetByName(PIRATE_PATH_SHEETS.reflections);

  appendObjects_(resultsSheet, [
    {
      timestamp,
      sessionId: normalizedPayload.sessionId,
      studentKey: normalizedPayload.studentKey,
      firstName: normalizedPayload.student.firstName,
      lastName: normalizedPayload.student.lastName,
      classPeriod: normalizedPayload.student.classPeriod,
      completed: normalizedPayload.completed,
      submissionType: normalizedPayload.submissionType,
      progressStage: normalizedPayload.progressStage,
      gameVersion: normalizedPayload.gameVersion,
      score: normalizedPayload.summary.score,
      scoreMax: normalizedPayload.summary.scoreMax,
      percent: normalizedPayload.summary.percent,
      canvasGrade: normalizedPayload.summary.canvasGrade,
      level1Score: normalizedPayload.summary.level1Score,
      level1Max: normalizedPayload.summary.level1Max,
      level2Score: normalizedPayload.summary.level2Score,
      level2Max: normalizedPayload.summary.level2Max,
      level3Score: normalizedPayload.summary.level3Score,
      level3Max: normalizedPayload.summary.level3Max,
      reflectionScore: normalizedPayload.summary.reflectionScore,
      reflectionMax: normalizedPayload.summary.reflectionMax,
      questionSetSummary: normalizedPayload.summary.questionSetSummary,
      startTime: normalizedPayload.startTime,
      endTime: normalizedPayload.endTime,
      durationSeconds: normalizedPayload.durationSeconds
    }
  ]);

  appendObjects_(roundSheet, buildRoundResponseRows_(timestamp, normalizedPayload));
  appendObjects_(reflectionSheet, buildReflectionRows_(timestamp, normalizedPayload));

  const dashboardInfo = refreshPiratePathDashboard_(ss);
  const bestStudent = dashboardInfo.bestByStudent[normalizedPayload.studentKey] || null;
  const isHighest = !!(bestStudent && bestStudent.sessionId === normalizedPayload.sessionId);

  return {
    ok: true,
    isHighestAttempt: isHighest,
    bestCanvasGrade: bestStudent ? bestStudent.canvasGrade : null,
    message: buildSubmissionMessage_(normalizedPayload, isHighest, bestStudent)
  };
}

function setupPiratePathSheets_(ss) {
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.results, PIRATE_PATH_HEADERS.GameResults);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.roundResponses, PIRATE_PATH_HEADERS.RoundResponses);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.reflections, PIRATE_PATH_HEADERS.Reflections);
  ensureSheetHeaders_(ss, PIRATE_PATH_SHEETS.dashboard, PIRATE_PATH_HEADERS.Dashboard);
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
  }

  styleHeaderRow_(sheet, Math.max(sheet.getLastColumn(), requiredHeaders.length));
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
  const roundItems = getSheetObjects_(roundSheet);
  const reflectionItems = getSheetObjects_(reflectionSheet);

  const bestCompleteByStudent = {};
  const bestOverallByStudent = {};

  results.forEach(row => {
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

  const completedCount = results.filter(row => row.completed).length;
  const avgCanvas = average_(bestRows.map(row => row.canvasGrade));
  const avgPercent = average_(bestRows.map(row => row.percent));
  const missSummary = computeMissSummary_(roundItems, reflectionItems);
  const mostMissed = missSummary[0] || null;

  dashboardSheet.clearContents();
  dashboardSheet.clearFormats();

  const summaryRows = [
    ['Metric', 'Value'],
    ['Total submissions', results.length],
    ['Completed submissions', completedCount],
    ['Unique students', bestRows.length],
    ['Average percent (highest attempt)', formatPercent_(avgPercent)],
    ['Average Canvas grade (highest attempt)', roundNumber_(avgCanvas, 2)],
    ['Most commonly missed question', mostMissed ? mostMissed.displayLabel : 'None yet']
  ];

  dashboardSheet.getRange(1, 1, summaryRows.length, 2).setValues(summaryRows);
  dashboardSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#d9ead3');

  const attemptsStartRow = summaryRows.length + 3;
  const attemptsHeader = [[
    'classPeriod',
    'lastName',
    'firstName',
    'completed',
    'submissionType',
    'score',
    'scoreMax',
    'percent',
    'canvasGrade',
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
      row.lastName,
      row.firstName,
      row.completed,
      row.submissionType,
      row.score,
      row.scoreMax,
      row.percent,
      row.canvasGrade,
      row.level1Score,
      row.level2Score,
      row.level3Score,
      row.reflectionScore,
      row.questionSetSummary,
      row.timestamp
    ]));

    dashboardSheet.getRange(attemptsStartRow + 1, 1, attemptValues.length, attemptValues[0].length)
      .setValues(attemptValues);
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

    dashboardSheet.getRange(missesStartRow + 1, 1, missRows.length, missRows[0].length).setValues(missRows);
  }

  const finalWidth = Math.max(attemptsHeader[0].length, missesHeader[0].length, 2);
  dashboardSheet.setFrozenRows(1);
  dashboardSheet.autoResizeColumns(1, finalWidth);

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
  return value;
}
