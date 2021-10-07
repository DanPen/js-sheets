import { makeAutoObservable } from "mobx"
import { fromPromise } from "mobx-utils"
import { uiStore } from "."
import { getAllVariableReferences } from "../function-parsing"

function mapAndFilter (callback) {
    const returning = []

    if (Array.isArray(this)) {
        var data = this
    } else {
        var data = [...this]
    }

    for (let i = 0; i < data.length; i++) {
        const current = data[i]
        const callbackResult = callback(current)

        if (callbackResult !== undefined && callbackResult !== null) {
            returning.push(callbackResult)
        }
    }

    return returning
}
Array.prototype.mapAndFilter = mapAndFilter
Set.prototype.mapAndFilter = mapAndFilter

export const letters = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z']
const initialColumns = letters.length
const initialRows = 100

export function cellNameToIndex (name) {
    const match = name.match(/([a-z]+)([0-9]+)/i)
    const columnLetters = match[1].toLowerCase()
    const row = parseInt(match[2])
    // TODO: support more than one letter
    const column = letters.indexOf(columnLetters)
    return [row, column]
}

export function indexToCellName (index) {
    return [letters[index[1]], index[0]].join('')
}

class CellStore {
    // A 2D array representing the spreadsheet
    cells

    getCellByName (name) {
        const index = cellNameToIndex(name)
        return this.cells[index[0]][index[1]]
    }

    get allCellsByName () {
        return Object.fromEntries(this.cells.flat().map(cell => [cell.name, cell]))
    }
    
    getCellsInBounds (bounds) {
        const topLeft = bounds[0]
        const bottomRight = bounds[1]

        const returning = new Set()

        for (let i = topLeft[0]; i <= bottomRight[0]; i++) {
            for (let j = topLeft[1]; j <= bottomRight[1]; j++) {
                returning.add(this.cells[i][j])
            }
        }

        return returning
    }

    constructor () {
        makeAutoObservable(this)

        this.cells = [...Array(initialRows)].map( (_, rowIndex) => {
            return [...Array(initialColumns)].map( (_, columnIndex) => {
                return new Cell(this, [ rowIndex, columnIndex ])
            })
        })
    }
}

class Cell {
    // A 2-element array where the first element is the row index and the second element is the column index
    index

    // A classic spreadsheet index, however 0-indexed and lower-cased. e.g.: a0, g22
    get name () {
        return indexToCellName(this.index)
    }

    // Used for interpretting the cell
    contentType = 'string'

    // When the user erases a number field, force hideZero to not display the '0' in the spreadsheet
    hideZero = false

    // Cell content as a string, number, or boolean
    _rawContent = ''

    get rawContent () {
        return this._rawContent
    }

    set rawContent (value) {
        const { modifiedValue, contentType } = this.inferContentType(value)

        this._rawContent = modifiedValue
        if (contentType) {
            this.contentType = contentType
        }
    }

    get content () {
        if (this.contentType === 'string') {
            return this.rawContent
        }
        if (this.contentType === 'number') {
            const number = +this.rawContent
            if (number === 0 && this.hideZero) {
                return ''
            }
            return number
        }
        if (this.contentType === 'boolean') {
            return this.rawContent
        }
        if (this.contentType === 'function') {

            try {
                var variables = this.variableReferences
            } catch (err) {
                if (err.toString().includes('[MobX] Cycle detected in computation')) {
                    return 'cycle detected'
                }
                console.log(err)
                return 'unknown error'
            }

            variables['i'] = this.index[0]
            variables['j'] = this.index[1]
            variables['fetch'] = window.puppeteerFetch
            variables['puppeteer'] = window.puppeteer
            variables['setTimeout'] = null
            variables['setInterval'] = null

            try {
                const func = new Function(...Object.keys(variables), this.rawContent)
                let functionResult = func(...Object.values(variables))
                // Test for promise
                if (typeof functionResult?.then === 'function') {
                    fromPromise(functionResult)
                }
                return functionResult
            } catch (err) {
                return 'function error'
            }
        }

        else if (this.contentType === 'object') {
            try {
                return (new Function(`return ${this.rawContent}`))()
            } catch (err) {
                return this.rawContent
            }
        }
    }

    // Like contentType, but if it's a function, return the content type of the function's response.
    get contentDisplayType () {
        if (this.contentType === 'function') {
            const jsType = typeof this.content
            // Test for promise
            if (typeof this.content?.then === 'function') {
                return 'promise'
            }
            else {
                return jsType
            }
        }
        return this.contentType
    }

    inferContentType (value) {
        var modifiedValue = value
        var contentType

        if (value === '') {
            contentType = 'string'
        }

        else if (value === 'true' || value === 'yes') {
            modifiedValue = true
            contentType = 'boolean'
        }

        else if (value === 'false' || value === 'no') {
            modifiedValue = false
            contentType = 'boolean'
        }

        else if (value === '=') {
            contentType = 'function'
            modifiedValue = 'return '
        }

        else if (value === 'return') {
            contentType = 'function'
        }

        else if (+value === +value) {
            contentType = 'number'
        }

        // If the last part of the string is a '%' and the beginning is a number
        else if (value[value.length-1] === '%') {
            const beginning = value.substr(0, value.length-1)
            if (+beginning === +beginning) {
                contentType = 'number'
                modifiedValue = +beginning/100
            }
        }

        // If the first part of the string starts with a '$' and latter part is a number
        else if (value[0] === '$' && value.length > 1) {
            const latter = value.substr(1)
            if (+latter === +latter) {
                contentType = 'number'
                modifiedValue = +latter
            }
        }

        // If starts with a '{' or '[' and can be parsed correctly
        else if ((value[0] === '{' || value[0] === '[') && value.length > 1) {
            let hasError
            try {
                var evalResult = (new Function(`return ${value}`))()
            } catch (err) {
                hasError = true
            }

            if (!hasError && typeof evalResult === 'object') {
                contentType = 'object'
                modifiedValue = value
            }
        }

        return {
            contentType,
            modifiedValue
        }
    }

    get variableReferences () {
        const allReferences = getAllVariableReferences(this.rawContent)

        const toInject = allReferences
            .mapAndFilter(variableName => {
                // Test if the variable name matches a cell. If so, strip the $.
                // If no match, return null, which filters it from the array
                return /^[a-z]+\$?[0-9]+\$?$/i.test(variableName) ? variableName.replace(/\$/g, '') : null
            })

        // Return an object with the variable names as keys, and the variable content.
        const variables = Object.fromEntries(toInject.map(variableName => {
            return [variableName, this.store.getCellByName(variableName)?.content]
        }))
        
        return variables
    }
    
    directionFrom (cell) {
        return [this.index[0] - cell.index[0], this.index[1] - cell.index[1]]
    }

    //
    get isSelected () {
        return uiStore.selectionManager.currentCell === this
    }
    set isSelected (yes) {
        uiStore.selectionManager.currentCell = yes ? this : null
        uiStore.selectionManager.resetAllSelections()
    }

    get isInFullSelection () {
        return uiStore.selectionManager.isCellInASelection(this)
    }

    get isHovered () {
        return uiStore.selectionManager.hoveredCell === this
    }

    set isHovered (yes) {
        uiStore.selectionManager.hoveredCell = yes ? this : null
    }

    get neighborTop () {
        try {
            return this.store.cells[this.index[0]-1][this.index[1]]
        } catch (err) {
            return null
        }
    }

    get neighborBottom () {
        try {
            return this.store.cells[this.index[0]+1][this.index[1]]
        } catch (err) {
            return null
        }
    }

    get neighborLeft () {
        try {
            return this.store.cells[this.index[0]][this.index[1]-1]
        } catch (err) {
            return null
        }
    }

    get neighborRight () {
        try {
            return this.store.cells[this.index[0]][this.index[1]+1]
        } catch (err) {
            return null
        }
    }
    
    constructor (store, index) {
        this.store = store
        makeAutoObservable(this)
        this.index = index
    }
}

export { Cell }
export default CellStore