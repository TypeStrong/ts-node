exports.codes = {}

function defineError(code, buildMessage) {
  if (!buildMessage) {
    buildMessage = (...args) => args.join(' ')
  }

  exports.codes[code] = class CustomError extends Error {
    constructor(...args) {
      super(`${code}: ${buildMessage(...args)}`)
      this.code = code
    }
  }
}

defineError("ERR_INPUT_TYPE_NOT_ALLOWED")
defineError("ERR_INVALID_ARG_VALUE")
defineError("ERR_INVALID_MODULE_SPECIFIER")
defineError("ERR_INVALID_PACKAGE_CONFIG")
defineError("ERR_INVALID_PACKAGE_TARGET")
defineError("ERR_MANIFEST_DEPENDENCY_MISSING")
defineError("ERR_MODULE_NOT_FOUND", (path, base, type = 'package') => {
  return `Cannot find ${type} '${path}' imported from ${base}`
})
defineError("ERR_PACKAGE_IMPORT_NOT_DEFINED")
defineError("ERR_PACKAGE_PATH_NOT_EXPORTED")
defineError("ERR_UNSUPPORTED_DIR_IMPORT")
defineError("ERR_UNSUPPORTED_ESM_URL_SCHEME")
defineError("ERR_UNKNOWN_FILE_EXTENSION")
