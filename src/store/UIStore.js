import { action, autorun, computed, makeObservable, observable, runInAction } from "mobx"
import { BehaviorSubject, fromEvent, switchMap, timer } from "rxjs"
import { filter, first, reduce, share, takeUntil } from "rxjs/operators"
import { cellStore } from "."
import { cellNameToIndex, indexToCellName } from "./CellStore"

class SelectionManager {
    // Array of selections
    disjointSelections = []

    get latestSelection () {
        return this.disjointSelections[this.disjointSelections.length-1]
    }

    // Object reference to the primary selected cell
    _currentCell = null

    get currentCell () {
        return this._currentCell
    }

    set currentCell (cell) {
        this._currentCell = cell
    }

    hoveredCell = null
    autofillDirection = undefined

    dragAutofill = () => {
        const autofillSelection = new Selection()
        autofillSelection.add(this.currentCell)

        const disposeAutorun = autorun(() => {
            const firstI = autofillSelection.firstCell.index
            const lastI = this.hoveredCell.index
            const directionVector = [lastI[0] - firstI[0], lastI[1] - firstI[1]]

            const direction = Math.abs(directionVector[0]) > Math.abs(directionVector[1]) ? 'rows' : 'columns'
            this.autofillDirection = direction
            
            // Orthogonalize the direction
            if (direction === 'rows') {
                directionVector[1] = 0
            } else {
                directionVector[0] = 0
            }
            
            const adjustedI = [firstI[0] + directionVector[0], firstI[1] + directionVector[1]]
            const adjustedCell = cellStore.cells[adjustedI[0]][adjustedI[1]]
            
            autofillSelection.add(adjustedCell)
        })

        fromEvent(document, 'mouseup').pipe(
            first()
        ).subscribe(() => {
            disposeAutorun()

            this.disjointSelections = [autofillSelection]

            const firstCell = autofillSelection.firstCell
            
            if (firstCell.contentType === 'function') {

                this.forEachSelectedCell(cell => {
                    if (cell === firstCell) {
                        return
                    }

                    const directionFromFirstCell = cell.directionFrom(firstCell)

                    const replacer = (_, prefix, column, row) => {
                        const incrementColumn = !column.includes('$')
                        const incrementRow = !row.includes('$')

                        const nameWithout$ = `${column}${row}`.replaceAll(/\$/g, '')
                        const variableIndex = cellNameToIndex(nameWithout$)

                        const newVariableIndex = [...variableIndex]
                        if (incrementRow) {
                            newVariableIndex[0] += directionFromFirstCell[0]
                        }
                        if (incrementColumn) {
                            newVariableIndex[1] += directionFromFirstCell[1]
                        }
                        
                        let newVariableName = indexToCellName(newVariableIndex)
                        newVariableName = newVariableName.replace(/([a-z]+)([0-9]+)/i, (_, column, row) => {
                            column = `${column}${!incrementColumn ? '$' : ''}`
                            row = `${row}${!incrementRow ? '$' : ''}`
                            return `${column}${row}`
                        })

                        return `${prefix}${newVariableName}`
                    }
                    
                    let cellFunction = firstCell.rawContent.replaceAll(/([^0.])([a-z]+\$?)([0-9]+\$?)/gi, replacer)

                    cell._rawContent = cellFunction
                    cell.contentType = 'function'
                })

            }

            // If number, auto-increment, etc.
            else if (firstCell.contentType === 'number') {
                this.forEachSelectedCell(cell => {
                    if (cell === firstCell) {
                        return
                    }
                    const directionFromFirstCell = cell.directionFrom(firstCell)
                    const indexToUse = this.autofillDirection === 'rows' ? 0 : 1
                    cell.rawContent = `${firstCell.content + directionFromFirstCell[indexToUse]}`
                    cell.contentType = 'number'
                })
            }

            // Else, copy
            else {
                this.forEachSelectedCell(cell => {
                    cell.rawContent = firstCell.rawContent
                })
            }
        })
    }

    resetAllSelections () {
        // Reset state
        this.disjointSelections = [new Selection()]
        this.latestSelection.add(this.currentCell)
    }

    addToLatestSelection (cell) {
        this.latestSelection.add(cell)
        this.currentCell = cell
    }

    newSelection () {
        const selection = new Selection()
        this.disjointSelections.push(selection)
        return selection
    }

    isCellInASelection (cell) {
        return this.disjointSelections.find(selection => selection.cells.has(cell))
    }

    get allSelectedCells () {
        return new Set(this.disjointSelections.map(selection => [...selection.cells]).flat())
    }

    forEachSelectedCell (callback) {
        this.allSelectedCells.forEach(callback)
    }

    constructor () {
        makeObservable(this, {
            disjointSelections: observable,
            _currentCell: observable,
            currentCell: computed,
            hoveredCell: observable,
            allSelectedCells: computed,
            forEachSelectedCell: action,
            autofillDirection: observable
        })

        this.disjointSelections = [new Selection()]

        // autorun(() => {
        //     console.log(this.hoveredCell)
        // })
    }
}

class Selection {
    cells = new Set()
    firstCell
    lastCell

    // Can't be an action. That way, we can read the bounds after adding the newest member
    add (cell) {
        this.cells.add(cell)
        if (!this.firstCell) {
            this.firstCell = cell
        }
        this.lastCell = cell
        runInAction(() => {
            const cells = cellStore.getCellsInBounds(this.bounds)
            this.cells = cells
        })
    }

    get bounds () {
        const indices = [this.firstCell, this.lastCell].map(cell => cell.index)
        const min0 = Math.min(...indices.map(index => index[0]))
        const max0 = Math.max(...indices.map(index => index[0]))
        const min1 = Math.min(...indices.map(index => index[1]))
        const max1 = Math.max(...indices.map(index => index[1]))

        return [[min0, min1], [max0, max1]]
    }

    constructor () {
        makeObservable(this, {
            cells: observable,
            bounds: computed,
            add: action
        })
    }
}

class UIStore {
    contentEditorRef = null

    selectionManager = null

    constructor () {
        makeObservable(this, {
            contentEditorRef: observable.ref,
            selectionManager: observable
        })

        this.selectionManager = new SelectionManager()
        this.setupKeyListeners()
    }

    setupKeyListeners () {
        const keyDown$ = fromEvent(window, 'keydown')
        const keyUp$ = fromEvent(window, 'keyup')

        // Prevent arrow keys from scrolling table area and select the appropriate cell.
        keyDown$.pipe(
            filter(e => e.key.includes('Arrow') || e.key === 'Enter' || e.key === 'Tab'),
            filter(e => document.activeElement.tagName === 'BODY')          // only if no field is focused.
        ).subscribe(e => {
            e.preventDefault()
            
            if (!this.selectionManager.currentCell) {
                return
            }

            let direction
            let notEnterOrTab = (e.key !== 'Enter' && e.key !== 'Tab')

            // Selection
            if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
                var newCurrentCell = this.selectionManager.currentCell.neighborTop
                direction = 'Top'
            }
            else if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
                var newCurrentCell = this.selectionManager.currentCell.neighborBottom
                direction = 'Bottom'
            }
            else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
                var newCurrentCell = this.selectionManager.currentCell.neighborLeft
                direction = 'Left'
            }
            else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
                var newCurrentCell = this.selectionManager.currentCell.neighborRight
                direction = 'Right'
            }

            // Moving to the last cell with/without content or to the start/end of rows/columns
            if ((e.metaKey || e.ctrlKey) && notEnterOrTab) {
                var newCurrentCell = this.selectionManager.currentCell
                var previousCurrentCell
                var nextCurrentCell = newCurrentCell['neighbor'+direction]

                // Go to the last cell before no content
                if (newCurrentCell.content && nextCurrentCell?.content) {
                    while (newCurrentCell && newCurrentCell.content) {
                        previousCurrentCell = newCurrentCell
                        newCurrentCell = newCurrentCell['neighbor'+direction]
                    }

                    newCurrentCell = previousCurrentCell
                }

                // Go to the next cell with content
                else {
                    // Skip outside of the current cell since it has content, but its next neighbor doesn't
                    if (newCurrentCell.content) {
                        newCurrentCell = nextCurrentCell
                    }

                    while (newCurrentCell && !newCurrentCell.content) {
                        previousCurrentCell = newCurrentCell
                        newCurrentCell = newCurrentCell['neighbor'+direction]
                    }

                    if (!newCurrentCell) {
                        newCurrentCell = previousCurrentCell
                    }
                }
            }

            if (newCurrentCell) {
                // Adding to selection
                if (e.shiftKey && notEnterOrTab) {
                    this.selectionManager.addToLatestSelection(newCurrentCell)
                    this.selectionManager.currentCell = newCurrentCell
                }
                // Moving to cell
                else {
                    this.selectionManager.currentCell = newCurrentCell
                    this.selectionManager.resetAllSelections()
                }
            }
        })

        // Support typing when textarea editor is not selected.
        const keyboardBlur$ = new BehaviorSubject()
        fromEvent(document, 'focusout').subscribe(keyboardBlur$)
        keyboardBlur$.next(1)

        const injectKeyStrokesToCells$ = keyboardBlur$.pipe(
            switchMap(() => keyDown$.pipe(
                takeUntil(fromEvent(document, 'focusin'))
            )),
            filter(e => !e.key.includes('Arrow')),
            filter(e => (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.metaKey),
            filter(e => document.activeElement.tagName === 'BODY'),                          // only if no field is focused
            filter(e => this.selectionManager.currentCell),                                  // and if there's a currentCell
        )
        
        // keyboardBlur$.pipe(
        //     switchMap(() => keyDown$.pipe(
        //         first(),
        //         takeUntil(fromEvent(document, 'focusin'))
        //     ))
        // ).subscribe(e => {
        //     this.selectionManager.forEachSelectedCell((cell) => {
        //         cell.rawContent = ''
        //         if (cell.contentType === 'number') {
        //             cell.hideZero = true
        //         }
        //     })
        // })

        injectKeyStrokesToCells$.pipe().subscribe(e => {
            e.preventDefault()

            this.selectionManager.forEachSelectedCell(cell => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    cell.rawContent = ''//cell.rawContent.substr(0, cell.rawContent.length-1)
                }
                else {
                    cell.rawContent += e.key
                }
            })
        })

        injectKeyStrokesToCells$.pipe(
            filter(e => e.key !== 'Backspace' && e.key !== 'Delete'),
            switchMap(e => timer(0))
        ).subscribe(() => {
            this.contentEditorRef?.focus()
        })

        // Now listen for an enter or tab to conclude editting and move the currentCell
        injectKeyStrokesToCells$.pipe(
            switchMap((e) => keyDown$.pipe(
                filter(e => e.key === 'Enter' || e.key === 'Tab'),
                first()
            ))
        ).subscribe(e => {
            e.preventDefault()
            this.contentEditorRef?.blur()

            if (e.key === 'Tab') {
                this.selectionManager.currentCell = this.selectionManager.currentCell.neighborRight
                this.selectionManager.resetAllSelections()
            }
            else if (e.key === 'Enter') {
                this.selectionManager.currentCell = this.selectionManager.currentCell.neighborBottom
                this.selectionManager.resetAllSelections()
            }
        })
    }
}

export default UIStore