import {debounce} from "lodash"
import {Diagnostic} from "typescript/lib/protocol"
import {Linter, LinterMessage} from "../typings/linter"
import {locationsToRange} from "./utils/tsUtil"

/** Class that collects errors from all of the clients and pushes them to the Linter service */
export class ErrorPusher {
  private linter?: Linter
  private errors: Map<string, Map<string, Diagnostic[]>> = new Map()

  /** Add errors. Previous errors with the same prefix and filePath are going to be replaced */
  addErrors(prefix: string, filePath: string, errors: Diagnostic[]) {
    let prefixed = this.errors.get(prefix)
    if (!prefixed) {
      prefixed = new Map()
      this.errors.set(prefix, prefixed)
    }

    prefixed.set(filePath, errors)

    this.pushErrors()
  }

  /** Clear all errors */
  clear() {
    if (this.linter) {
      this.linter.deleteMessages()
    }
  }

  setLinter(linter: Linter) {
    this.linter = linter
    this.pushErrors()
  }

  private pushErrors = debounce(() => {
    const errors: LinterMessage[] = []

    for (const fileErrors of this.errors.values()) {
      for (const [filePath, diagnostics] of fileErrors) {
        for (const diagnostic of diagnostics) {
          errors.push({
            type: "Error",
            text: diagnostic.text,
            filePath: filePath,
            range: diagnostic.start ? locationsToRange(diagnostic.start, diagnostic.end) : undefined
          })
        }
      }
    }

    if (this.linter) {
      this.linter.setMessages(errors)
    }

  }, 100)
}
