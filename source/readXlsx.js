import xpath from 'xpath'
import XMLDOM from 'xmldom'

const select = xpath.useNamespaces({
  a: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  sst: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
})

const letters = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]

/**
 * Reads an (unzipped) XLSX file structure into a 2D array of cells.
 * @param  {object} entries - A list of entries (files) inside XLSX file.
 * @return {string[][]} An array of rows, each row being an array of cells.
 */
export default function readXlsx(entries) {
  let sheet
  let values

  try {
    sheet = new XMLDOM.DOMParser().parseFromString(entries.sheet)
    const valuesDoc = new XMLDOM.DOMParser().parseFromString(entries.strings)
    values = select('//a:si', valuesDoc)
      .map(string => select('.//a:t[not(ancestor::a:rPh)]', string).map(_ => _.textContent).join(''))
  } catch (error) {
    // Guards against malformed XLSX files.
    console.error(error)
    return []
  }

  const cells = select('/a:worksheet/a:sheetData/a:row/a:c', sheet).map(Cell)

  let d = select('//a:dimension/@ref', sheet, 1)
  if (d) {
    d = d.textContent.split(':').map(CellCoords)
  } else {
    d = calculateDimensions(cells)
  }

  const cols = d[1].column - d[0].column + 1
  const rows = d[1].row - d[0].row + 1

  const data = []

  times(rows, () => {
    const row = []
    times(cols, () => row.push(''))
    data.push(row)
  })

  for (const cell of cells) {
    let value = cell.value

    if (cell.type === 's') {
      value = values[parseInt(value)]
    }

    if (data[cell.row - d[0].row]) {
      data[cell.row - d[0].row][cell.column - d[0].column] = value
    }
  }

  if (data.length === 0) {
    return []
  }

  return trimTrailingEmptyColumns(data)
}

function calculateDimensions (cells) {
  const comparator = (a, b) => a - b
  const allRows = cells.map(cell => cell.row).sort(comparator)
  const allCols = cells.map(cell => cell.column).sort(comparator)
  const minRow = allRows[0]
  const maxRow = allRows[allRows.length - 1]
  const minCol = allCols[0]
  const maxCol = allCols[allCols.length - 1]

  return [
    { row: minRow, column: minCol },
    { row: maxRow, column: maxCol }
  ]
}

function times(n, action) {
  let i = 0
  while (i < n) {
    action()
    i++
  }
}

function colToInt(col) {
  col = col.trim().split('')

  let n = 0;

  for (let i = 0; i < col.length; i++) {
    n *= 26
    n += letters.indexOf(col[i])
  }

  return n
}

function CellCoords(coords) {
  coords = coords.split(/(\d+)/)
  return {
    row    : parseInt(coords[1]),
    column : colToInt(coords[0])
  }
}

function Cell(cellNode) {
  const coords = CellCoords(cellNode.getAttribute('r'))
  const value = select('a:v', cellNode, 1)
  return {
    column : coords.column,
    row    : coords.row,
    value  : value && value.textContent && value.textContent.trim() || '',
    type   : cellNode.getAttribute('t')
  }
}

function trimTrailingEmptyColumns(data) {
  let i = data[0].length - 1
  while (i >= 0) {
    let notEmpty
    for (const row of data) {
      if (row[i]) {
        // Column is not empty.
        notEmpty = true
        break
      }
    }
    if (notEmpty) {
      break
    }
    let j = 0;
    while (j < data.length) {
      data[j].splice(i, 1)
      j++
    }
    i--
  }
  return data
}