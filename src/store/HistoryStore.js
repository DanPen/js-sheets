import { makeAutoObservable, reaction, runInAction, action, autorun, toJS } from "mobx";
import { mergeDeep } from '../helpers'
import { Cell } from "./CellStore";
import { SelectionManager } from "./UIStore";

function mergeMapsOfObjects (target, source) {
    for (let key of source.keys()) {
        if (!target.get(key)) target.set(key, {})
        target.set(key, {...target.get(key), ...source.get(key)})
    }
}

class HistoryStore {

    history = []
    historyIndex = 0

    // Used when calling undo/redo
    ignoreChanges = false

    searchForNearbyBatch (nearDate, tolerance=100) {
        // Only have to check first one since they're chronologically sorted.
        if (this.history[0]) {
            return nearDate - this.history[0].date < tolerance
                ? this.history[0]
                : undefined
        }
    }

    logChanges (changes) {
        if (this.ignoreChanges) {
            return
        }

        const date = Date.now()

        const batchWith = this.searchForNearbyBatch(date)
        if (batchWith) {
            mergeMapsOfObjects(batchWith.old, changes.old)
            mergeMapsOfObjects(batchWith.new, changes.new)
            batchWith.date = date
        }

        // In case the changes were applied to an alternate timeline, clip off that part of the redo history.
        this.history = this.history.slice(this.historyIndex)
        this.historyIndex = 0

        // Add to the history
        // Ignore SelectionManager changes when they can't be batched with something else.
        if (!batchWith/* && !([...changes.new.keys()][0] instanceof SelectionManager)*/) {
            changes.date = date
            this.history.unshift(changes)
        }

        console.log(toJS(this.history))
    }

    trackChanges (object, ...properties) {
        properties.forEach(prop => {
            reaction(
                () => object[prop],
                (state, oldState, r) => {
                    if (!this.ignoreChanges) {                    
                        const changeOld = new Map()
                        changeOld.set(object, {
                            [prop]: oldState
                        })

                        const changeNew = new Map()
                        changeNew.set(object, {
                            [prop]: state
                        })

                        const changes = {
                            old: changeOld,
                            new: changeNew
                        }
                        this.logChanges(changes)
                    }
                }
            )
        })
    }

    undo () {
        this.ignoreChanges = true

        const changes = this.history[this.historyIndex]
        if (changes) {
            changes.old.forEach((changes, object) => {
                Object.assign(object, changes)
            })

            this.historyIndex++
        }

        // HACK
        const interval = setInterval(() => {
            if (window.__mobxGlobals.pendingReactions.length === 0) {
                this.ignoreChanges = false
                clearInterval(interval)
            }
        }, 0)
    }

    redo () {
        this.ignoreChanges = true

        const changes = this.history[this.historyIndex-1]
        if (changes) {
            changes.new.forEach((changes, object) => {
                Object.assign(object, changes)
            })

            this.historyIndex--
        }

        // HACK
        const interval = setInterval(() => {
            if (window.__mobxGlobals.pendingReactions.length === 0) {
                this.ignoreChanges = false
                clearInterval(interval)
            }
        }, 0)
    }

    constructor () {
        makeAutoObservable(this, {
            ignoreChanges: false
        })
    }
}

export default HistoryStore