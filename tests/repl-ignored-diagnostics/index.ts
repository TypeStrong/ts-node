// This script triggers a diagnostic that is ignored in the virtual <REPL> file but
// *not* in files such as this one.
// When this file is required by the REPL, the diagnostic *should* be logged.
export {};
function foo() {}
function foo() {}
