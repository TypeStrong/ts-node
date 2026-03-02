console.log(
  JSON.stringify({
    stdinReport: typeof stdinReport !== 'undefined' && stdinReport,
    evalReport: typeof evalReport !== 'undefined' && evalReport,
    replReport: typeof replReport !== 'undefined' && replReport,
  })
);
