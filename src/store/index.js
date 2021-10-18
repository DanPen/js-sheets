import { configure, makeAutoObservable, toJS, when } from "mobx"
import CellStore from "./CellStore"
import UIStore from "./UIStore"
import HistoryStore from "./HistoryStore"

configure({
    disableErrorBoundaries: false,
    enforceActions: 'never'
})

class RootStore {
    uiStore
    cellStore
    historyStore

    stores = []

    constructor () {
        makeAutoObservable(this)

        this.uiStore = new UIStore(this)
        this.cellStore = new CellStore(this)
        this.historyStore = new HistoryStore(this)

        // A gimmick to make getStore work.
        this.stores = {...this}
    }

    getStore (store) {
        return when(() => this.stores[store]).then(() => this.stores[store])
    }
}

const rootStore = new RootStore()

// For debugging
if (window) {
    window.mobx = rootStore
    window.toJS = toJS
}

const uiStore = rootStore.uiStore
export { uiStore }

const cellStore = rootStore.cellStore
export { cellStore }

const historyStore = rootStore.historyStore
export { historyStore }

export default rootStore