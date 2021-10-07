const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse').default


export function getAllVariableReferences (code) {
    const codeWrappedWithFunction = `
        function myFunction () {
            ${code}
        }
    `

    const ast = parse(codeWrappedWithFunction)

    const variables = new Set()

    traverse(ast, {
        ReferencedIdentifier (path) {
            variables.add(path.node.name)
        }
    })

    return variables
}