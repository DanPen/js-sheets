import { configure } from "mobx"
import Cells from "./Cells"
import UIStore from "./UIStore"

configure({
    disableErrorBoundaries: true,
    enforceActions: 'never'
})

class RootStore {
    uiStore
    cellStore

    constructor () {
        this.uiStore = new UIStore()
        this.cellStore = new Cells()
    }
}

const rootStore = new RootStore()

// For debugging
if (window) {
    window.mobx = rootStore
}

const uiStore = rootStore.uiStore
export { uiStore }

const cellStore = rootStore.cellStore
export { cellStore }

export default rootStore