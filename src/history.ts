import { join } from 'path'
import * as os from 'os'
import * as fs from 'fs'

// TODO: Use `repl: REPLServer` when history-related properties are added to @types/node
export function useHistory (repl: any) {
  repl.historySize = process.env.TS_NODE_HISTORY !== ''
    ? Number(process.env.TS_NODE_HISTORY_SIZE || 1000)
    : 0

  if (repl.historySize > 0) {
    const file = process.env.TS_NODE_HISTORY || join(os.homedir(), '.ts_node_history')
    if (fs.existsSync(file)) {
      repl.history = fs.readFileSync(file, 'utf8').split(os.EOL)
    }
    repl.on('exit', () => {
      fs.writeFileSync(file, repl.history.join(os.EOL))
    })
  }
}
