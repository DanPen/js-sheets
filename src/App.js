/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

import './App.css'
import { observer } from 'mobx-react-lite'
import { cellStore, uiStore } from './store'
import { letters } from './store/CellStore'

import ErrorBoundary from './ErrorBoundary'

function tryStringify (object, opts={}) {
	let stringed
	try {
		if (opts.pretty) {
			stringed = JSON.stringify(object, null, 2)
		} else {
			stringed = JSON.stringify(object)
		}
	} catch (err) {
		return 'error JSONifying object'
	}

	return stringed
}

const Cell = observer( ({ cell }) => {
	const selectCell = (e) => {
		if (e.metaKey || e.ctrlKey) {
			uiStore.selectionManager.newSelection()
			uiStore.selectionManager.addToLatestSelection(cell)
		}
		else if (e.shiftKey) {
			uiStore.selectionManager.addToLatestSelection(cell)
		}
		else {
			cell.isSelected = true
		}
	}

	const hoverCell = (e) => {
		cell.isHovered = true
	}

	console.log('render cell')

	return (
		<ErrorBoundary>
			<td
				style={{
					height: 16,
					textAlign: cell.contentDisplayType === 'number' ? 'right' : 'left',
					width: 80,
					fontSize: 14,
					fontFamily: 'Arial',
					padding: 5,
					border: '1px solid #e3e3e3',
					boxShadow: cell.isSelected ? 'inset 0px 0px 0px 2px #3475e0' : '',
					whiteSpace: 'nowrap',
					position: 'relative',
					overflow: cell.neighborRight?.rawContent && 'hidden',
					background: cell.isInFullSelection && '#e9f0fc',
				}}
				onClick={selectCell}
				onMouseEnter={hoverCell}
			>
				{cell.contentDisplayType === 'object' ? tryStringify(cell.content)
				:cell.contentDisplayType === 'function' ? cell.content.toString()
				:cell.contentDisplayType === 'promise' ? cell.content.state === 'fulfilled' ? tryStringify(cell.content.value) : cell.content.state
				:cell.contentDisplayType === 'boolean' ? `${cell.content}`
				:cell.content}
				
				{cell.isSelected && (
					<>
						<div
							css={css`
								position: absolute;
								top: 2px;
								font-size: 7px;
								opacity: 0.75;
								color: #3475e0;
							`}
							style={{
								right: cell.contentDisplayType !== 'number' ? 3 : '',
								left: cell.contentDisplayType === 'number' ? 3 : ''
							}}
						>
							{cell.contentDisplayType}
						</div>
						<div
							css={css`
								position: absolute;
								bottom: -2px; right: -2px;
								background-color: #3475e0;
								border-top: 1px solid #fff;
								border-left: 1px solid #fff;
								width: 6px;
								height: 6px;
								cursor: crosshair;
							`}
							onMouseDown={uiStore.selectionManager.dragAutofill}
						>
						</div>
					</>
				)}
			</td>
		</ErrorBoundary>
	)
})

const Editor = observer(() => {
	const { currentCell } = uiStore.selectionManager

	return currentCell && (
		<div css={css`
			height: 100vh;
			width: 400px;
			background: #fff;
			box-shadow: -3px 0px 6px -3px rgb(60 64 67 / 15%), 3px 0px 6px -3px rgb(60 64 67 / 15%);
		`}>
			<div>
				Content Type
				<select
					name="contentType"
					id="contentType"
					value={currentCell.isStaging ? currentCell._contentTypeTemp : currentCell.contentType}
					onChange={e => currentCell.contentType = e.target.value}
				>
					<option value="number">number</option>
					<option value="string">string</option>
					<option value="boolean">boolean</option>
					<option value="function">function</option>
					<option value="object">object</option>
				</select>
			</div>
			<div>
				Content
				<textarea 
					ref={element => uiStore.contentEditorRef = element}
					value={currentCell.isStaging ? currentCell._rawContentTemp : currentCell.rawContent}
					onChange={e => {
						uiStore.selectionManager.forEachSelectedCell(cell => {
							cell.stageText(e.target.value)
						})
					}}
					onBlur={e => {
						uiStore.selectionManager.forEachSelectedCell(cell => {
							cell.commitChanges()
						})
					}}
				/>
			</div>
			{currentCell.contentType === 'function' && (
				<>
					<div>
						Function result
						<textarea readOnly value=
							{currentCell.contentDisplayType === 'object' ? tryStringify(currentCell.content, { pretty: true })
							:currentCell.contentDisplayType === 'function' ? currentCell.content.toString()
							:currentCell.content === undefined ? 'undefined'
							:currentCell.content}
						/>
					</div>
					<div>
						Function result type
						<textarea readOnly value={currentCell.contentDisplayType}/>
					</div>
				</>
			)}
		</div>
	)
})

const App = observer(() => {
	console.warn('COSTLY render app')

	return (
		<div css={css`
			overflow: hidden;
			width: 100vw;
			height: 100vh;
			display: flex;
		`}>
			<div css={css`
				flex: 1;
				height: 100%;
				width: 100%;
				overflow: scroll;
			`}>
				<table
					css={css`
						flex: 1;
						user-select: none;

						table-layout: fixed;
						border-collapse: collapse;
					`}
					style={{
						width: cellStore.cells[0].length * 80 + 18
					}}
				>
					<thead>
						<tr>
							<th css={css`
								font-weight: 400;
								font-size: 12px;
								border: 1px solid #e3e3e3;
								background-color: #f5f5f5;
								width: 18px;
							`}>
							</th>
							{cellStore.cells[0].map( (_, columnIndex) => (
								<th css={css`
									font-weight: 400;
									font-size: 12px;
									border: 1px solid #e3e3e3;
									background-color: #f5f5f5;
								`}>
									{letters[columnIndex]}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{cellStore.cells.map( (row, rowIndex) => (
							<tr key={rowIndex}>
								<td css={css`
									font-weight: 400;
									font-size: 12px;
									border: 1px solid #e3e3e3;
									background-color: #f5f5f5;
									width: 18px;
									text-align: center;
								`}>
									{rowIndex}
								</td>
								{row.map( (cell, columnIndex) => (
									<Cell cell={cell} key={columnIndex}/>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<Editor />
		</div>
	)
})
	
export default App
	