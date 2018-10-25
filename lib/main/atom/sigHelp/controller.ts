import * as Atom from "atom"
import {debounce} from "lodash"
import {GetClientFunction} from "../../../client"
import {handlePromise} from "../../../utils"
import {WithTypescriptBuffer} from "../../pluginManager"
import {isTypescriptEditorWithPath} from "../utils"
import {TooltipView} from "./tooltipView"

export class TooltipController {
  private cancelled = false
  private view: TooltipView
  private disposables = new Atom.CompositeDisposable()
  constructor(
    private deps: {
      getClient: GetClientFunction
      withTypescriptBuffer: WithTypescriptBuffer
    },
    private editor: Atom.TextEditor,
    bufferPt: Atom.Point,
  ) {
    this.view = new TooltipView()
    document.body.appendChild(this.view.element)
    const debouncedUpdate = debounce(this.updateTooltip.bind(this), 100, {leading: true})
    this.disposables.add(
      this.editor.onDidChangeCursorPosition(evt => {
        handlePromise(debouncedUpdate(evt.newBufferPosition))
      }),
    )
    handlePromise(this.updateTooltip(bufferPt))
  }

  public isDisposed() {
    return this.cancelled
  }

  public dispose() {
    if (this.cancelled) return
    this.cancelled = true
    this.disposables.dispose()
    handlePromise(this.view.destroy())
  }

  private async updateTooltip(bufferPt: Atom.Point) {
    if (this.cancelled) return
    const rawView = atom.views.getView(this.editor)
    const pixelPos = rawView.pixelPositionForBufferPosition(bufferPt)
    const lines = rawView.querySelector(".lines")!
    const linesRect = lines.getBoundingClientRect()
    const lineH = this.editor.getLineHeightInPixels()
    const Y = pixelPos.top + linesRect.top + lineH / 2
    const X = pixelPos.left + linesRect.left
    const offset = lineH * 0.7
    const tooltipRect = {
      left: X,
      right: X,
      top: Y - offset,
      bottom: Y + offset,
    }

    const msg = await this.getMessage(bufferPt)
    if (!msg) {
      this.dispose()
      return
    }
    if (this.cancelled) return
    await this.view.update({...tooltipRect, sigHelp: msg})
  }

  private async getMessage(bufferPt: Atom.Point) {
    if (!isTypescriptEditorWithPath(this.editor)) return
    const filePath = this.editor.getPath()
    if (filePath === undefined) return
    const client = await this.deps.getClient(filePath)
    try {
      await this.deps.withTypescriptBuffer(filePath, buffer => buffer.flush())
      const result = await client.execute("signatureHelp", {
        file: filePath,
        line: bufferPt.row + 1,
        offset: bufferPt.column + 1,
      })
      return result.body
    } catch (e) {
      return
    }
  }
}